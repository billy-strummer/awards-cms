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

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const { wrapEmail } = require('./_lib/email-header');
const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.APP_URL || 'https://admin.britishtrade.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'awards@britishtradeawards.com';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * Verify Supabase JWT from Authorization header.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<Object|null>} The authenticated user object, or null if authentication fails (401 sent).
 */
async function verifyAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
  return user;
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

    const { entryId, entry_id, amount, description, email } = req.body;
    const resolvedEntryId = entryId || entry_id; // Accept both camelCase and snake_case

    // Validate inputs
    if (!resolvedEntryId || !amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Missing or invalid required fields' });
    }

    // Get entry details from database
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .select('*')
      .eq('id', resolvedEntryId)
      .single();

    if (entryError || !entry) {
      return res.status(404).json({ error: 'Entry not found' });
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
      success_url: `${req.headers.origin}/submit-entry-success.html?session_id={CHECKOUT_SESSION_ID}&entry=${entry.entry_number}`,
      cancel_url: `${req.headers.origin}/submit-entry.html?cancelled=true`,
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
    res.status(500).json({ error: error.message });
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
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
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

    case 'charge.refunded':
      await handleChargeRefunded(event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
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
      await supabase.from('invoices').insert([
        {
          organisation_id: entry.organisation_id,
          invoice_type: 'entry_fee',
          status: 'paid',
          total_amount: session.amount_total / 100, // Convert from pence
          currency: 'GBP',
          paid_date: new Date().toISOString(),
          payment_method: 'stripe',
          payment_reference: session.payment_intent,
          notes: `Entry ${entry.entry_number} - ${entry.entry_title}`,
        },
      ]);

      // Send confirmation email
      await sendEntryConfirmationEmail(entry);

      // Log activity
      await supabase.from('activity_log').insert([
        {
          entity_type: 'entry',
          entity_id: entryId,
          action: 'payment_completed',
          details: `Payment received for entry ${entry.entry_number}`,
          performed_by: entry.contact_email,
        },
      ]);
    }

    console.log(`✅ Payment completed for entry ${entryId}`);
  } catch (error) {
    console.error('Error handling checkout session:', error);
  }
}

/**
 * Handle successful payment intent. Sends confirmation email for matching entries.
 * @param {Object} paymentIntent - Stripe payment intent object.
 * @returns {Promise<void>}
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log(`Payment succeeded: ${paymentIntent.id}`);
  const { data: entries } = await supabase.from('entries').select('*').eq('payment_reference', paymentIntent.id);
  if (entries && entries.length > 0) {
    await sendEntryConfirmationEmail(entries[0]);
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
    await supabase.from('activity_log').insert([
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

/**
 * Convert plain-text template body to styled HTML with paragraph wrapping.
 * @param {string} text - Plain text content to convert.
 * @returns {string} HTML string with paragraphs and line breaks.
 */
function textToHtml(text) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = escaped.replace(/\n\n/g, '</p><p style="margin:0 0 16px 0;">').replace(/\n/g, '<br>');
  return `<div style="padding:30px 40px;"><p style="margin:0 0 16px 0;">${html}</p></div>`;
}

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
    const contactEmail = branding.email_from || process.env.CONTACT_EMAIL || 'awards@britishtrade.org';
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
    const contactEmail = branding.email_from || process.env.CONTACT_EMAIL || 'awards@britishtrade.org';

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
    const contactEmail = branding.email_from || process.env.CONTACT_EMAIL || 'awards@britishtrade.org';

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
    res.status(500).json({ error: error.message });
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
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    res.json({
      paymentStatus: session.payment_status,
      customerEmail: session.customer_email,
      amountTotal: session.amount_total / 100,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Vercel serverless handler — routes by query action or HTTP method.
 * POST ?action=create-checkout-session → createCheckoutSession
 * POST ?action=webhook              → handleStripeWebhook
 * GET  ?action=payment-status&entryId=... → getPaymentStatus
 * GET  ?action=verify-payment&sessionId=... → verifyPayment
 */
module.exports = async function handler(req, res) {
  const action = req.query.action || req.body?.action;

  if (req.method === 'POST' && action === 'webhook') {
    return handleStripeWebhook(req, res);
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
