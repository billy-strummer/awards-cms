/**
 * Stripe Payment API Endpoints
 * Deploy this as a serverless function or Express.js endpoint
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
const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.APP_URL || 'https://admin.britishtrade.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'awards@britishtradeawards.com';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Create Stripe Checkout Session
 * POST /api/create-checkout-session
 */
/**
 * Verify Supabase JWT from Authorization header
 */
async function verifyAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
  return user;
}

async function createCheckoutSession(req, res) {
  try {
    const user = await verifyAuth(req, res);
    if (!user) return;

    const { entryId, entry_id, amount, description, email } = req.body;
    const resolvedEntryId = entryId || entry_id;  // Accept both camelCase and snake_case

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
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedEntryId);

    res.json({ id: session.id, url: session.url });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Stripe Webhook Handler
 * POST /api/stripe-webhook
 */
async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
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
 * Handle successful checkout session
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
        updated_at: new Date().toISOString()
      })
      .eq('id', entryId);

    if (updateError) throw updateError;

    // Create invoice record
    const { data: entry } = await supabase
      .from('entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (entry) {
      await supabase.from('invoices').insert([{
        organisation_id: entry.organisation_id,
        invoice_type: 'entry_fee',
        status: 'paid',
        total_amount: session.amount_total / 100, // Convert from pence
        currency: 'GBP',
        paid_date: new Date().toISOString(),
        payment_method: 'stripe',
        payment_reference: session.payment_intent,
        notes: `Entry ${entry.entry_number} - ${entry.entry_title}`
      }]);

      // Send confirmation email
      await sendEntryConfirmationEmail(entry);

      // Log activity
      await supabase.from('activity_log').insert([{
        entity_type: 'entry',
        entity_id: entryId,
        action: 'payment_completed',
        details: `Payment received for entry ${entry.entry_number}`,
        performed_by: entry.contact_email
      }]);
    }

    console.log(`✅ Payment completed for entry ${entryId}`);

  } catch (error) {
    console.error('Error handling checkout session:', error);
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log(`Payment succeeded: ${paymentIntent.id}`);
  const { data: entries } = await supabase
    .from('entries')
    .select('*')
    .eq('payment_reference', paymentIntent.id);
  if (entries && entries.length > 0) {
    await sendEntryConfirmationEmail(entries[0]);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentIntentFailed(paymentIntent) {
  console.error(`❌ Payment failed: ${paymentIntent.id}`);

  // Try to find entry by payment reference
  const { data: entries } = await supabase
    .from('entries')
    .select('*')
    .eq('payment_reference', paymentIntent.id);

  if (entries && entries.length > 0) {
    const entry = entries[0];

    // Send payment failed email
    await sendPaymentFailedEmail(entry, paymentIntent.last_payment_error?.message);

    // Log activity
    await supabase.from('activity_log').insert([{
      entity_type: 'entry',
      entity_id: entry.id,
      action: 'payment_failed',
      details: `Payment failed: ${paymentIntent.last_payment_error?.message}`,
      performed_by: entry.contact_email
    }]);
  }
}

/**
 * Handle refund
 */
async function handleChargeRefunded(charge) {
  console.log(`🔄 Charge refunded: ${charge.id}`);

  // Find entry by payment reference
  const { data: entries } = await supabase
    .from('entries')
    .select('*')
    .eq('payment_reference', charge.payment_intent);

  if (entries && entries.length > 0) {
    const entry = entries[0];

    // Update entry payment status
    await supabase
      .from('entries')
      .update({
        payment_status: 'refunded',
        updated_at: new Date().toISOString()
      })
      .eq('id', entry.id);

    // Send refund confirmation email
    await sendRefundConfirmationEmail(entry);
  }
}

/**
 * Send entry confirmation email
 */
async function sendEntryConfirmationEmail(entry) {
  if (!process.env.RESEND_API_KEY) { console.log('RESEND_API_KEY not set, skipping email'); return; }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: entry.contact_email,
      subject: `Entry Confirmed: ${entry.entry_number || 'Your Submission'} - British Trade Awards`,
      html: `<h2>Thank you for your entry!</h2>
        <p>Your entry <strong>${entry.entry_number || ''}</strong> has been received and payment confirmed.</p>
        <p><strong>Entry:</strong> ${entry.entry_title || ''}</p>
        <p><strong>Contact:</strong> ${entry.contact_name || ''}</p>
        <p>You can upload supporting documents at: <a href="${APP_URL}/upload-documents.html?entry=${entry.entry_number || entry.id}">Upload Documents</a></p>
        <p>We will be in touch with next steps. Good luck!</p>
        <p>British Trade Awards Team</p>`
    });
  } catch (e) { console.error('Error sending confirmation email:', e.message); }
}

async function sendPaymentFailedEmail(entry, errorMessage) {
  if (!process.env.RESEND_API_KEY) { console.log('RESEND_API_KEY not set, skipping email'); return; }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: entry.contact_email,
      subject: `Payment Issue: ${entry.entry_number || 'Your Entry'} - British Trade Awards`,
      html: `<h2>Payment Issue</h2>
        <p>We were unable to process payment for entry <strong>${entry.entry_number || ''}</strong>.</p>
        <p><strong>Reason:</strong> ${errorMessage || 'Unknown error'}</p>
        <p>Please try again or contact us for assistance.</p>
        <p>British Trade Awards Team</p>`
    });
  } catch (e) { console.error('Error sending payment failed email:', e.message); }
}

async function sendRefundConfirmationEmail(entry) {
  if (!process.env.RESEND_API_KEY) { console.log('RESEND_API_KEY not set, skipping email'); return; }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: entry.contact_email,
      subject: `Refund Processed: ${entry.entry_number || 'Your Entry'} - British Trade Awards`,
      html: `<h2>Refund Confirmation</h2>
        <p>A refund has been processed for entry <strong>${entry.entry_number || ''}</strong>.</p>
        <p>The refund should appear on your statement within 5-10 business days.</p>
        <p>If you have any questions, please contact us.</p>
        <p>British Trade Awards Team</p>`
    });
  } catch (e) { console.error('Error sending refund email:', e.message); }
}

/**
 * Get payment status
 * GET /api/payment-status/:entryId
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
      paymentReference: entry.payment_reference
    });

  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Verify payment session
 * GET /api/verify-payment/:sessionId
 */
async function verifyPayment(req, res) {
  try {
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    res.json({
      paymentStatus: session.payment_status,
      customerEmail: session.customer_email,
      amountTotal: session.amount_total / 100
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: error.message });
  }
}

// Export functions for serverless deployment or Express routes
module.exports = {
  createCheckoutSession,
  handleStripeWebhook,
  getPaymentStatus,
  verifyPayment
};

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
