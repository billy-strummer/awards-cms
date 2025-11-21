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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Create Stripe Checkout Session
 * POST /api/create-checkout-session
 */
async function createCheckoutSession(req, res) {
  try {
    const { entryId, amount, description, email } = req.body;

    // Validate inputs
    if (!entryId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get entry details from database
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .select('*')
      .eq('id', entryId)
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
              images: ['https://yourdomain.com/logo.png'], // TODO: Add actual logo URL
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
        entry_id: entryId,
        entry_number: entry.entry_number,
      },
    });

    // Update entry with payment session ID
    await supabase
      .from('entries')
      .update({
        payment_reference: session.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', entryId);

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
  console.log(`💳 Payment succeeded: ${paymentIntent.id}`);
  // Additional payment success logic
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
  // TODO: Integrate with email service (SendGrid, Mailgun, AWS SES)
  console.log(`📧 Sending confirmation email to ${entry.contact_email}`);

  // Email content would include:
  // - Entry number
  // - Submission details
  // - Payment receipt
  // - Next steps
  // - Timeline information
}

/**
 * Send payment failed email
 */
async function sendPaymentFailedEmail(entry, errorMessage) {
  console.log(`📧 Sending payment failed email to ${entry.contact_email}`);
  // Email with retry payment link
}

/**
 * Send refund confirmation email
 */
async function sendRefundConfirmationEmail(entry) {
  console.log(`📧 Sending refund confirmation to ${entry.contact_email}`);
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
