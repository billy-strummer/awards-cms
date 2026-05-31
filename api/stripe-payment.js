/**
 * @module stripe-payment
 * Stripe Payment API Endpoints.
 * Deploy this as a serverless function or Express.js endpoint.
 *
 * Required Environment Variables:
 * - STRIPE_SECRET_KEY
 * - STRIPE_WEBHOOK_SECRET
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_KEY
 */

if (!process.env.STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY environment variable');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
  throw new Error('Missing Supabase environment variables');

// Warn if key mode (test vs live) is inconsistent with STRIPE_PRICE_ID
if (process.env.STRIPE_PRICE_ID) {
  const keyIsTest = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
  const priceIsTest =
    process.env.STRIPE_PRICE_ID.startsWith('price_test_') || process.env.STRIPE_PRICE_ID.includes('test');
  if (keyIsTest && !priceIsTest) {
    console.warn('⚠️  Stripe mode mismatch: STRIPE_SECRET_KEY is a test key but STRIPE_PRICE_ID may be a live price');
  }
}

// @ts-ignore — Stripe v12+ is a default export function, not a constructor
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const { wrapEmail, textToHtml } = require('./_lib/email-header');
const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.APP_URL || 'https://admin.britishtradeawards.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'awards@britishtradeawards.com';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { hasMinimumRole, getUserRole, verifyAuth } = require('./_lib/auth');

/**
 * Generate a unique invoice number (INV-YYYY-NNNNN).
 * @returns {Promise<string>}
 */
async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1);
  const lastNum = data && data.length > 0 ? parseInt(data[0].invoice_number.replace(prefix, ''), 10) || 0 : 0;
  return `${prefix}${String(lastNum + 1).padStart(5, '0')}`;
}

/**
 * Create a Stripe Checkout Session for an entry fee payment.
 * POST /api/create-checkout-session
 * @param {Object} req - Express request object with body containing entryId, amount, description, email.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function createCheckoutSession(req, res) {
  try {
    const user = await verifyAuth(req, res);
    if (!user) return;

    // Role check: only editor+ can initiate payment sessions
    const role = await getUserRole(user.email);
    if (!hasMinimumRole(role, 'editor')) {
      return res.status(403).json({ error: 'Insufficient permissions to create payment sessions' });
    }

    const { entryId, entry_id, description, email } = req.body;
    const resolvedEntryId = entryId || entry_id; // Accept both camelCase and snake_case

    if (!resolvedEntryId) {
      return res.status(400).json({ error: 'entry_id is required' });
    }

    // Get entry details from database
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .select('*, awards(entry_fee)')
      .eq('id', resolvedEntryId)
      .single();

    if (entryError || !entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Always use the server-side entry fee — never trust client-supplied amounts
    const amount = Number(entry.awards?.entry_fee) || 0;
    if (amount <= 0) {
      return res.status(400).json({ error: 'This entry has no fee configured' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'British Trade Awards Entry Fee',
              description: description || `Entry ${entry.entry_number}`,
              images: [process.env.BTA_LOGO_URL || `${process.env.APP_URL || ''}/assets/british-trade-awards-logo.png`],
            },
            unit_amount: Math.round(amount * 100), // Convert to pence
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${APP_URL}/submit-entry-success.html?session_id={CHECKOUT_SESSION_ID}&entry=${entry.entry_number}`,
      cancel_url: `${APP_URL}/submit-entry.html?cancelled=true`,
      customer_email: email || entry.contact_email,
      metadata: {
        entry_id: resolvedEntryId,
        entry_number: entry.entry_number,
      },
    });

    // Update entry with payment reference (use payment_intent for consistency with webhooks)
    await supabase
      .from('entries')
      .update({
        payment_reference: session.payment_intent || session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', resolvedEntryId);

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
}

/**
 * Stripe Webhook Handler. Processes checkout, payment, and refund events.
 * POST /api/stripe-webhook
 * @param {Object} req - Express request object with raw body and stripe-signature header.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Vercel may parse body as JSON object; Stripe needs raw body (string/Buffer)
    const rawBody = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the event — errors propagate as 500 so Stripe retries the webhook
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;

      case 'charge.succeeded':
        await handleChargeSucceeded(event.data.object);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;

      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (handlerError) {
    console.error(`Webhook handler error for ${event.type}:`, handlerError);
    return res.status(500).json({ error: 'Webhook handler failed — Stripe will retry' });
  }

  res.json({ received: true });
}

/**
 * Handle successful checkout session completion.
 * Updates entry status, creates invoice record, sends confirmation email, and logs activity.
 * @param {Object} session - Stripe checkout session object.
 * @returns {Promise<void>}
 */
async function handleCheckoutSessionCompleted(session) {
  try {
    const entryId = session.metadata.entry_id;

    // Update entry status
    const { error: updateError } = await supabase
      .from('entries')
      .update({
        payment_status: 'paid',
        status: 'submitted', // Change from draft to submitted
        submission_date: new Date().toISOString(),
        payment_reference: session.payment_intent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId);

    if (updateError) throw updateError;

    // Create invoice record
    const { data: entry } = await supabase.from('entries').select('*').eq('id', entryId).single();

    if (entry) {
      const invoiceNumber = await generateInvoiceNumber();
      await supabase.from('invoices').insert([
        {
          invoice_number: invoiceNumber,
          organisation_id: entry.organisation_id,
          invoice_type: 'entry_fee',
          status: 'paid',
          payment_status: 'paid',
          total_amount: session.amount_total / 100, // Convert from pence
          paid_amount: session.amount_total / 100,
          balance_due: 0,
          currency: 'GBP',
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: new Date().toISOString().split('T')[0],
          paid_date: new Date().toISOString(),
          payment_method: 'stripe',
          payment_reference: session.payment_intent,
          notes: `Entry ${entry.entry_number} - ${entry.entry_title}`,
        },
      ]);

      // Send confirmation email
      await sendEntryConfirmationEmail(entry);

      // Log activity
      await supabase.from('activity_logs').insert([
        {
          entity_type: 'entry',
          entity_id: entryId,
          action: 'payment_completed',
          details: `Payment received for entry ${entry.entry_number}`,
          performed_by: entry.contact_email,
        },
      ]);

      // Create admin notification
      await createPaymentNotification(entry, session.amount_total / 100);
    }

    console.log(`✅ Payment completed for entry ${entryId}`);
  } catch (error) {
    console.error('Error handling checkout session:', error);
    throw error; // Propagate so webhook handler returns 500 and Stripe retries
  }
}

/**
 * Handle expired checkout sessions. Marks the invoice/entry as cancelled.
 * @param {Object} session - Stripe checkout session object.
 * @returns {Promise<void>}
 */
async function handleCheckoutSessionExpired(session) {
  try {
    const entryId = session.metadata?.entry_id;
    if (!entryId) return;

    await supabase
      .from('entries')
      .update({ payment_status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', entryId)
      .eq('payment_status', 'pending');

    console.log(`⏰ Checkout session expired for entry ${entryId}`);
  } catch (error) {
    console.error('Error handling session expiry:', error);
    throw error;
  }
}

/**
 * Handle successful payment intent. Sends confirmation email for matching entries.
 * @param {Object} paymentIntent - Stripe payment intent object.
 * @returns {Promise<void>}
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log(`Payment succeeded: ${paymentIntent.id}`);
  try {
    const { data: entries } = await supabase.from('entries').select('*').eq('payment_reference', paymentIntent.id);
    if (entries && entries.length > 0) {
      const entry = entries[0];

      // Only process if not already handled by checkout.session.completed
      if (entry.payment_status !== 'paid') {
        await supabase
          .from('entries')
          .update({
            payment_status: 'paid',
            status: entry.status === 'draft' ? 'submitted' : entry.status,
            submission_date: entry.submission_date || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', entry.id);

        // Check if invoice already exists for this payment reference to avoid duplicates
        const { data: existingInvoice } = await supabase
          .from('invoices')
          .select('id')
          .eq('payment_reference', paymentIntent.id)
          .limit(1);

        if (!existingInvoice || existingInvoice.length === 0) {
          const amountPaid = paymentIntent.amount ? paymentIntent.amount / 100 : 95;
          const piInvoiceNumber = await generateInvoiceNumber();
          await supabase.from('invoices').insert([
            {
              invoice_number: piInvoiceNumber,
              organisation_id: entry.organisation_id,
              invoice_type: 'entry_fee',
              status: 'paid',
              payment_status: 'paid',
              total_amount: amountPaid,
              paid_amount: amountPaid,
              balance_due: 0,
              currency: 'GBP',
              invoice_date: new Date().toISOString().split('T')[0],
              due_date: new Date().toISOString().split('T')[0],
              paid_date: new Date().toISOString(),
              payment_method: 'stripe',
              payment_reference: paymentIntent.id,
              notes: `Entry ${entry.entry_number} - ${entry.entry_title}`,
            },
          ]);

          // Create admin notification
          const amountForNotification = paymentIntent.amount ? paymentIntent.amount / 100 : 95;
          await createPaymentNotification(entry, amountForNotification);
        }

        // Log activity
        await supabase.from('activity_logs').insert([
          {
            entity_type: 'entry',
            entity_id: entry.id,
            action: 'payment_completed',
            details: `Payment received for entry ${entry.entry_number} (via payment_intent)`,
            performed_by: entry.contact_email,
          },
        ]);

        await sendEntryConfirmationEmail(entry);
      }
    }
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
}

/**
 * Handle failed payment. Sends failure email and logs activity.
 * @param {Object} paymentIntent - Stripe payment intent object with failure details.
 * @returns {Promise<void>}
 */
async function handlePaymentIntentFailed(paymentIntent) {
  console.error(`❌ Payment failed: ${paymentIntent.id}`);

  // Try to find entry by payment reference
  const { data: entries } = await supabase.from('entries').select('*').eq('payment_reference', paymentIntent.id);

  if (entries && entries.length > 0) {
    const entry = entries[0];

    // Send payment failed email
    await sendPaymentFailedEmail(entry, paymentIntent.last_payment_error?.message);

    // Log activity
    await supabase.from('activity_logs').insert([
      {
        entity_type: 'entry',
        entity_id: entry.id,
        action: 'payment_failed',
        details: `Payment failed: ${paymentIntent.last_payment_error?.message}`,
        performed_by: entry.contact_email,
      },
    ]);
  }
}

/**
 * Handle successful charge event. Finds entry by payment_intent and updates status.
 * This catches payments that may not trigger checkout.session.completed (e.g. direct charges).
 * @param {Object} charge - Stripe charge object.
 * @returns {Promise<void>}
 */
async function handleChargeSucceeded(charge) {
  console.log(`Charge succeeded: ${charge.id}`);
  try {
    const paymentIntentId = charge.payment_intent;
    if (!paymentIntentId) {
      console.log('Charge has no payment_intent, skipping');
      return;
    }

    // Find entry by payment reference (payment_intent ID)
    const { data: entries } = await supabase.from('entries').select('*').eq('payment_reference', paymentIntentId);

    if (!entries || entries.length === 0) {
      console.log(`No entry found for payment_intent ${paymentIntentId}`);
      return;
    }

    const entry = entries[0];

    // Only update if not already marked as paid
    if (entry.payment_status === 'paid') {
      console.log(`Entry ${entry.entry_number} already marked as paid, skipping`);
      return;
    }

    // Update entry status
    await supabase
      .from('entries')
      .update({
        payment_status: 'paid',
        status: entry.status === 'draft' ? 'submitted' : entry.status,
        submission_date: entry.submission_date || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.id);

    // Create invoice record (only if one doesn't already exist for this payment)
    const amountPaid = charge.amount ? charge.amount / 100 : 95;
    const { data: existingChargeInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('payment_reference', paymentIntentId)
      .limit(1);

    if (!existingChargeInvoice || existingChargeInvoice.length === 0) {
      const chInvoiceNumber = await generateInvoiceNumber();
      await supabase.from('invoices').insert([
        {
          invoice_number: chInvoiceNumber,
          organisation_id: entry.organisation_id,
          invoice_type: 'entry_fee',
          status: 'paid',
          payment_status: 'paid',
          total_amount: amountPaid,
          paid_amount: amountPaid,
          balance_due: 0,
          currency: 'GBP',
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: new Date().toISOString().split('T')[0],
          paid_date: new Date().toISOString(),
          payment_method: 'stripe',
          payment_reference: paymentIntentId,
          notes: `Entry ${entry.entry_number} - ${entry.entry_title}`,
        },
      ]);
    }

    // Log activity
    await supabase.from('activity_logs').insert([
      {
        entity_type: 'entry',
        entity_id: entry.id,
        action: 'payment_completed',
        details: `Payment received for entry ${entry.entry_number} (via charge)`,
        performed_by: entry.contact_email,
      },
    ]);

    // Create admin notification
    await createPaymentNotification(entry, amountPaid);

    // Send confirmation email
    await sendEntryConfirmationEmail(entry);

    console.log(`✅ Charge processed for entry ${entry.entry_number}`);
  } catch (error) {
    console.error('Error handling charge succeeded:', error);
  }
}

/**
 * Create an admin notification for a received payment.
 * Inserts into the notifications table so the CMS bell icon shows the alert.
 * @param {Object} entry - The entry record.
 * @param {number} amount - The payment amount in pounds.
 * @returns {Promise<void>}
 */
async function createPaymentNotification(entry, amount) {
  try {
    // Notify all admin users by inserting a notification without user_email filter
    // This uses a generic admin notification approach
    const { data: admins } = await supabase.from('user_roles').select('email').in('role', ['admin', 'super_admin']);

    const notifications = (admins || []).map((admin) => ({
      user_email: admin.email,
      title: 'Payment Received',
      message: `£${amount.toFixed(2)} payment received for entry ${entry.entry_number || 'N/A'} - ${entry.entry_title || 'Untitled'}`,
      entity_type: 'entry',
      entity_id: entry.id,
      is_read: false,
      created_at: new Date().toISOString(),
    }));

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }
  } catch (error) {
    // Non-critical — log but don't fail the payment flow
    console.error('Error creating payment notification:', error);
  }
}

/**
 * Handle charge refund. Updates entry payment status and sends refund confirmation email.
 * @param {Object} charge - Stripe charge object with refund details.
 * @returns {Promise<void>}
 */
async function handleChargeRefunded(charge) {
  console.log(`🔄 Charge refunded: ${charge.id}`);

  // Find entry by payment reference
  const { data: entries } = await supabase.from('entries').select('*').eq('payment_reference', charge.payment_intent);

  if (entries && entries.length > 0) {
    const entry = entries[0];

    // Update entry payment status
    await supabase
      .from('entries')
      .update({
        payment_status: 'refunded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.id);

    // Also update linked invoice status to refunded
    try {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('entry_id', entry.id)
        .in('payment_status', ['paid', 'partial']);

      if (invoices && invoices.length > 0) {
        await supabase
          .from('invoices')
          .update({
            payment_status: 'refunded',
            status: 'refunded',
            updated_at: new Date().toISOString(),
          })
          .in(
            'id',
            invoices.map((i) => i.id)
          );
      }
    } catch (invoiceUpdateErr) {
      console.warn('Failed to update linked invoice on refund:', invoiceUpdateErr.message);
    }

    // Send refund confirmation email
    await sendRefundConfirmationEmail(entry);
  }
}

/**
 * Load an active email template from the database by type.
 * @param {string} templateType - The template type identifier (e.g. 'payment_confirmation').
 * @returns {Promise<{subject: string, body: string}|null>} Template data or null if none found.
 */
async function loadTemplate(templateType) {
  try {
    const { data } = await supabase
      .from('email_templates')
      .select('subject, body')
      .eq('template_type', templateType)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .single();
    return data;
  } catch {
    return null;
  }
}

/**
 * Load tenant branding for header/footer styling.
 * @returns {Promise<Object>} Branding configuration object (empty object if not found).
 */
async function loadBranding() {
  try {
    const { data } = await supabase.from('tenant_branding').select('*').eq('tenant_id', 'default').maybeSingle();
    return data || {};
  } catch {
    return {};
  }
}

/**
 * Replace {PLACEHOLDER} tokens in a string with values from a data object.
 * @param {string} text - The template string containing {KEY} placeholders.
 * @param {Object} data - Key-value pairs for placeholder replacement.
 * @returns {string} The string with all matching placeholders replaced.
 */
function replacePlaceholders(text, data) {
  let result = text;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return result;
}

// textToHtml imported from ./_lib/email-header

/**
 * Header subtitle text per payment template type.
 */
const SUBTITLE_MAP = {
  payment_confirmation: 'Self-Nomination Entry Confirmation',
  payment_failed: 'Payment Reminder',
  refund_confirmation: 'Refund Confirmation',
};

/**
 * Send entry confirmation email (after successful payment).
 * Loads editable template from CMS; falls back to hardcoded default.
 * @param {Object} entry - The entry record from the database.
 * @returns {Promise<void>}
 */
async function sendEntryConfirmationEmail(entry) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping email');
    return;
  }
  try {
    const branding = await loadBranding();
    const contactEmail =
      branding.email_from || process.env.CONTACT_EMAIL || process.env.FROM_EMAIL || 'awards@britishtradeawards.com';
    const uploadLink = `${APP_URL}/upload-documents.html?entry=${entry.entry_number || entry.id}`;

    const placeholders = {
      ENTRY_NUMBER: entry.entry_number || '',
      CONTACT_NAME: entry.contact_name || '',
      COMPANY_NAME: entry.company_name || '',
      ENTRY_TITLE: entry.entry_title || '',
      UPLOAD_LINK: uploadLink,
      CONTACT_EMAIL: contactEmail,
    };

    const tpl = await loadTemplate('payment_confirmation');
    let subject, bodyText;
    if (tpl) {
      subject = replacePlaceholders(tpl.subject, placeholders);
      bodyText = replacePlaceholders(tpl.body, placeholders);
    } else {
      subject = `Entry Confirmed: ${entry.entry_number || 'Your Submission'} - British Trade Awards`;
      bodyText = `Dear ${entry.contact_name || ''},\n\nThank you for your entry! Your entry ${entry.entry_number || ''} has been received and payment confirmed.\n\nEntry: ${entry.entry_title || ''}\n\nYou can upload supporting documents at:\n${uploadLink}\n\nWe will be in touch with next steps. Good luck!\n\nKind regards,\nThe British Trade Awards Team`;
    }

    const bodyHtml = textToHtml(bodyText);
    const html = wrapEmail(bodyHtml, branding, { subject, subtitle: SUBTITLE_MAP.payment_confirmation });
    await resend.emails.send({ from: FROM_EMAIL, to: entry.contact_email, subject, html });
  } catch (e) {
    console.error('Error sending confirmation email:', e.message);
  }
}

/**
 * Send payment failed email.
 * Loads editable template from CMS; falls back to hardcoded default.
 * @param {Object} entry - The entry record from the database.
 * @param {string} [errorMessage] - The payment error message to include.
 * @returns {Promise<void>}
 */
async function sendPaymentFailedEmail(entry, errorMessage) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping email');
    return;
  }
  try {
    const branding = await loadBranding();
    const contactEmail =
      branding.email_from || process.env.CONTACT_EMAIL || process.env.FROM_EMAIL || 'awards@britishtradeawards.com';

    const placeholders = {
      ENTRY_NUMBER: entry.entry_number || '',
      CONTACT_NAME: entry.contact_name || '',
      COMPANY_NAME: entry.company_name || '',
      ERROR_MESSAGE: errorMessage || 'Unknown error',
      CONTACT_EMAIL: contactEmail,
    };

    const tpl = await loadTemplate('payment_failed');
    let subject, bodyText;
    if (tpl) {
      subject = replacePlaceholders(tpl.subject, placeholders);
      bodyText = replacePlaceholders(tpl.body, placeholders);
    } else {
      subject = `Payment Issue: ${entry.entry_number || 'Your Entry'} - British Trade Awards`;
      bodyText = `Dear ${entry.contact_name || ''},\n\nWe were unable to process payment for entry ${entry.entry_number || ''}.\n\nReason: ${errorMessage || 'Unknown error'}\n\nPlease try again or contact us for assistance at ${contactEmail}\n\nKind regards,\nThe British Trade Awards Team`;
    }

    const bodyHtml = textToHtml(bodyText);
    const html = wrapEmail(bodyHtml, branding, { subject, subtitle: SUBTITLE_MAP.payment_failed });
    await resend.emails.send({ from: FROM_EMAIL, to: entry.contact_email, subject, html });
  } catch (e) {
    console.error('Error sending payment failed email:', e.message);
  }
}

/**
 * Send refund confirmation email.
 * Loads editable template from CMS; falls back to hardcoded default.
 * @param {Object} entry - The entry record from the database.
 * @returns {Promise<void>}
 */
async function sendRefundConfirmationEmail(entry) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping email');
    return;
  }
  try {
    const branding = await loadBranding();
    const contactEmail =
      branding.email_from || process.env.CONTACT_EMAIL || process.env.FROM_EMAIL || 'awards@britishtradeawards.com';

    const placeholders = {
      ENTRY_NUMBER: entry.entry_number || '',
      CONTACT_NAME: entry.contact_name || '',
      COMPANY_NAME: entry.company_name || '',
      CONTACT_EMAIL: contactEmail,
    };

    const tpl = await loadTemplate('refund_confirmation');
    let subject, bodyText;
    if (tpl) {
      subject = replacePlaceholders(tpl.subject, placeholders);
      bodyText = replacePlaceholders(tpl.body, placeholders);
    } else {
      subject = `Refund Processed: ${entry.entry_number || 'Your Entry'} - British Trade Awards`;
      bodyText = `Dear ${entry.contact_name || ''},\n\nA refund has been processed for entry ${entry.entry_number || ''}.\n\nThe refund should appear on your statement within 5-10 business days.\n\nIf you have any questions, please contact us at ${contactEmail}\n\nKind regards,\nThe British Trade Awards Team`;
    }

    const bodyHtml = textToHtml(bodyText);
    const html = wrapEmail(bodyHtml, branding, { subject, subtitle: SUBTITLE_MAP.refund_confirmation });
    await resend.emails.send({ from: FROM_EMAIL, to: entry.contact_email, subject, html });
  } catch (e) {
    console.error('Error sending refund email:', e.message);
  }
}

/**
 * Get payment status for an entry.
 * GET /api/payment-status/:entryId
 * @param {Object} req - Express request object with params.entryId.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function getPaymentStatus(req, res) {
  try {
    const user = await verifyAuth(req, res);
    if (!user) return;

    const { entryId } = req.params;

    const { data: entry, error } = await supabase
      .from('entries')
      .select('payment_status, payment_reference, status')
      .eq('id', entryId)
      .single();

    if (error) throw error;

    res.json({
      paymentStatus: entry.payment_status,
      entryStatus: entry.status,
      paymentReference: entry.payment_reference,
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
}

/**
 * Verify a Stripe payment session by retrieving its details.
 * GET /api/verify-payment/:sessionId
 * @param {Object} req - Express request object with params.sessionId.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function verifyPayment(req, res) {
  try {
    const user = await verifyAuth(req, res);
    if (!user) return;

    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    res.json({
      paymentStatus: session.payment_status,
      customerEmail: session.customer_email,
      amountTotal: session.amount_total / 100,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
}

/**
 * Create a public Stripe Checkout Session for entry fee payment.
 * No auth required — validates entry exists by ID and is unpaid.
 * POST ?action=public-checkout
 * @param {Object} req - Request with body containing entry_id and amount.
 * @param {Object} res - Response object.
 * @returns {Promise<void>}
 */
// Simple rate limiting for public checkout
const publicCheckoutLimits = new Map();
function checkPublicCheckoutRate(ip) {
  const now = Date.now();
  const entry = publicCheckoutLimits.get(ip);
  if (!entry || now - entry.start > 60000) {
    publicCheckoutLimits.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= 5; // Max 5 checkout sessions per minute per IP
}

async function createPublicCheckout(req, res) {
  try {
    // Use rightmost IP from x-forwarded-for (set by Vercel CDN, cannot be spoofed by client)
    const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const ip = rawIp.split(',').pop().trim();
    if (!checkPublicCheckoutRate(ip)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const { entry_id } = req.body;

    if (!entry_id) {
      return res.status(400).json({ error: 'Missing entry_id' });
    }

    // Look up the entry including the award's entry_fee — never trust client-supplied amounts
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .select('*, awards(entry_fee)')
      .eq('id', entry_id)
      .single();

    if (entryError || !entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Don't allow double-payment
    if (entry.payment_status === 'paid') {
      return res.status(400).json({ error: 'Entry has already been paid' });
    }

    const payAmount = Number(entry.awards?.entry_fee) || 95; // fall back to £95 default

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'British Trade Awards Entry Fee',
              description: `Entry ${entry.entry_number}`,
            },
            unit_amount: Math.round(payAmount * 100), // Convert to pence
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${APP_URL}/payment-success.html?session_id={CHECKOUT_SESSION_ID}&entry=${entry.entry_number}`,
      cancel_url: `${APP_URL}/submit-entry-payment.html?cancelled=true`,
      customer_email: entry.contact_email,
      metadata: {
        entry_id: entry_id,
        entry_number: entry.entry_number,
      },
    });

    // Store payment reference
    await supabase
      .from('entries')
      .update({
        payment_reference: session.payment_intent || session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry_id);

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating public checkout session:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
}

/**
 * Create a Stripe Checkout Session for event ticket purchases.
 * POST ?action=event-checkout
 * @param {Object} req - Request with body containing eventId, tickets array, success_url, cancel_url.
 * @param {Object} res - Response object.
 * @returns {Promise<void>}
 */
async function createEventCheckout(req, res) {
  try {
    const user = await verifyAuth(req, res);
    if (!user) return;

    const { eventId, tickets, success_url, cancel_url } = req.body;

    if (!eventId || !Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ error: 'Missing eventId or tickets' });
    }

    // Look up the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('event_name, event_date, venue')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Fetch ticket type prices from DB — never trust client-supplied prices
    const ticketTypeIds = tickets.map((t) => t.ticket_type_id).filter(Boolean);
    if (ticketTypeIds.length !== tickets.length) {
      return res.status(400).json({ error: 'Each ticket must include a ticket_type_id' });
    }

    const { data: ticketTypes, error: ttError } = await supabase
      .from('event_ticket_types')
      .select('id, name, price, description')
      .eq('event_id', eventId)
      .in('id', ticketTypeIds);

    if (ttError || !ticketTypes) {
      return res.status(500).json({ error: 'Failed to load ticket pricing' });
    }

    const ticketTypeMap = Object.fromEntries(ticketTypes.map((tt) => [tt.id, tt]));

    for (const t of tickets) {
      if (!ticketTypeMap[t.ticket_type_id]) {
        return res.status(400).json({ error: `Invalid ticket_type_id: ${t.ticket_type_id}` });
      }
    }

    const line_items = tickets.map((t) => {
      const tt = ticketTypeMap[t.ticket_type_id];
      return {
        price_data: {
          currency: 'gbp',
          product_data: {
            name: tt.name || `Event Ticket - ${event.event_name}`,
            description: tt.description || `${event.event_name} - ${event.event_date || ''}`,
          },
          unit_amount: Math.round((tt.price || 0) * 100),
        },
        quantity: t.quantity || 1,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: success_url || `${APP_URL}/ticket-success.html?session_id={CHECKOUT_SESSION_ID}&event=${eventId}`,
      cancel_url: cancel_url || `${APP_URL}/events.html`,
      metadata: {
        event_id: eventId,
        ticket_data: JSON.stringify(tickets.slice(0, 5)), // Store first 5 for reference
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating event checkout session:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
}

/**
 * Process a refund for a ticket / payment.
 * POST ?action=refund
 * Looks up the guest's payment_intent from their ticket record and issues a Stripe refund.
 * @param {Object} req - Request with body containing ticketId, guestEmail, guestName.
 * @param {Object} res - Response object.
 * @returns {Promise<void>}
 */
async function processRefund(req, res) {
  try {
    const user = await verifyAuth(req, res);
    if (!user) return;

    const { ticketId, payment_intent, payment_reference } = req.body;

    // Determine the payment_intent to refund
    let refundTarget = payment_intent || payment_reference;

    if (!refundTarget && ticketId) {
      // Try to find payment reference from the guest record
      const { data: guest } = await supabase
        .from('event_guests')
        .select('payment_reference, payment_intent')
        .eq('id', ticketId)
        .single();

      refundTarget = guest?.payment_intent || guest?.payment_reference;
    }

    if (!refundTarget) {
      return res.status(400).json({ error: 'No payment reference found for refund. Manual refund may be required.' });
    }

    // Issue Stripe refund
    const refund = await stripe.refunds.create({
      payment_intent: refundTarget,
    });

    // Log the refund
    await supabase.from('activity_logs').insert([
      {
        entity_type: 'payment',
        action: 'refund_processed',
        details: `Refund ${refund.id} for payment ${refundTarget}`,
        performed_by: user.email,
      },
    ]);

    res.json({ success: true, refundId: refund.id, status: refund.status });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ error: error.message || 'Refund failed' });
  }
}

/**
 * Vercel serverless handler — routes by query action or HTTP method.
 * POST ?action=create-checkout-session → createCheckoutSession
 * POST ?action=event-checkout          → createEventCheckout
 * POST ?action=public-checkout         → createPublicCheckout (no auth)
 * POST ?action=refund                  → processRefund
 * POST ?action=webhook                 → handleStripeWebhook
 * GET  ?action=payment-status&entryId=... → getPaymentStatus
 * GET  ?action=verify-payment&sessionId=... → verifyPayment
 */
module.exports = async function handler(req, res) {
  // CORS headers for public-facing actions (public-checkout, webhook)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Guard: return a clear JSON error when Stripe is not configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in environment variables.' });
  }

  const action = req.query.action || req.body?.action;

  if (req.method === 'POST' && action === 'webhook') {
    return handleStripeWebhook(req, res);
  }

  if (req.method === 'POST' && action === 'public-checkout') {
    return createPublicCheckout(req, res);
  }

  if (req.method === 'POST' && action === 'event-checkout') {
    return createEventCheckout(req, res);
  }

  if (req.method === 'POST' && action === 'refund') {
    return processRefund(req, res);
  }

  if (req.method === 'POST' && (action === 'create-checkout-session' || !action)) {
    return createCheckoutSession(req, res);
  }

  if (req.method === 'GET' && action === 'payment-status') {
    req.params = { entryId: req.query.entryId };
    return getPaymentStatus(req, res);
  }

  if (req.method === 'GET' && action === 'verify-payment') {
    req.params = { sessionId: req.query.sessionId };
    return verifyPayment(req, res);
  }

  res.status(400).json({ error: 'Invalid action or method' });
};

// Named exports for internal use and testing
module.exports.createCheckoutSession = createCheckoutSession;
module.exports.createPublicCheckout = createPublicCheckout;
module.exports.createEventCheckout = createEventCheckout;
module.exports.processRefund = processRefund;
module.exports.handleStripeWebhook = handleStripeWebhook;
module.exports.getPaymentStatus = getPaymentStatus;
module.exports.verifyPayment = verifyPayment;

/**
 * Example Express.js setup:
 *
 * const express = require('express');
 * const app = express();
 *
 * app.post('/api/create-checkout-session', express.json(), createCheckoutSession);
 * app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), handleStripeWebhook);
 * app.get('/api/payment-status/:entryId', getPaymentStatus);
 * app.get('/api/verify-payment/:sessionId', verifyPayment);
 *
 * app.listen(3000);
 */

/**
 * Example Vercel serverless function setup:
 *
 * // api/create-checkout-session.js
 * const { createCheckoutSession } = require('../stripe-payment');
 * module.exports = createCheckoutSession;
 *
 * // api/stripe-webhook.js
 * const { handleStripeWebhook } = require('../stripe-payment');
 * module.exports = handleStripeWebhook;
 */
