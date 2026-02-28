/* ==================================================== */
/* STRIPE FRONTEND INTEGRATION                           */
/* Connects payment UI to backend Stripe API             */
/* ==================================================== */

const stripeFrontend = {
  /** @type {Object|null} Stripe.js instance */
  stripe: null,
  /** @type {string} Base URL for the payment API endpoints */
  apiBase: '/api', // Override if API is hosted elsewhere

  /**
   * Initialize Stripe.js with the stored publishable key.
   */
  init() {
    const pk = this.getPublishableKey();
    if (pk && typeof Stripe !== 'undefined') {
      this.stripe = Stripe(pk);
      console.warn('Stripe.js initialized');
    } else {
      console.warn('Stripe.js not loaded or no publishable key set');
    }
  },

  /**
   * Get the Stripe publishable key from localStorage.
   * @returns {string} The Stripe publishable key or empty string
   */
  getPublishableKey() {
    return localStorage.getItem('bta_stripe_pk') || '';
  },

  /**
   * Create a Stripe checkout session and redirect the user to the hosted checkout page.
   * @param {string} entryId - The entry ID to pay for
   * @param {number} amount - Amount in GBP (e.g. 50.00)
   * @param {string} [description] - Payment description
   * @returns {Promise<void>}
   */
  async createCheckoutSession(entryId, amount, description) {
    if (!rbacModule.guard('create', 'payments')) return;

    try {
      utils.showLoading();

      const response = await fetch(`${this.apiBase}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await STATE.client.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          entry_id: entryId,
          amount: Math.round(amount * 100), // Convert to pence
          description: description || 'British Trade Awards Entry Fee',
          success_url: `${window.location.origin}/payment-success?entry=${entryId}`,
          cancel_url: `${window.location.origin}/payment-cancelled?entry=${entryId}`
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create checkout session');
      }

      const { sessionId, url } = await response.json();

      // Redirect to Stripe Checkout
      if (this.stripe && sessionId) {
        const { error } = await this.stripe.redirectToCheckout({ sessionId });
        if (error) throw error;
      } else if (url) {
        window.location.href = url;
      }

    } catch (error) {
      console.error('Stripe checkout error:', error);
      utils.showToast('Payment failed: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Check the payment status for an entry via the backend API.
   * @param {string} entryId - The entry ID to check status for
   * @returns {Promise<Object>} Payment status object with status and optional error
   */
  async checkPaymentStatus(entryId) {
    try {
      const response = await fetch(`${this.apiBase}/payment-status/${entryId}`, {
        headers: {
          'Authorization': `Bearer ${(await STATE.client.auth.getSession()).data.session?.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to check status');

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('Payment status check error:', error);
      return { status: 'unknown', error: error.message };
    }
  },

  /**
   * Render a payment button and status-check button into the specified container.
   * @param {string} entryId - The entry ID
   * @param {number} amount - Payment amount in GBP
   * @param {string} containerId - The DOM element ID for the button container
   */
  renderPaymentButton(entryId, amount, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const pk = this.getPublishableKey();
    if (!pk) {
      container.innerHTML = `<div class="alert alert-warning py-2">
        <i class="bi bi-exclamation-triangle me-2"></i>Stripe not configured. Set the publishable key in Settings.
      </div>`;
      return;
    }

    container.innerHTML = `
      <button class="btn btn-success" data-action="stripeFrontend.createCheckoutSession" data-id="${entryId}" data-amount="${amount}" data-description="Entry Fee"
              aria-label="Pay entry fee of ${amount} pounds">
        <i class="bi bi-credit-card me-2"></i>Pay &pound;${parseFloat(amount).toFixed(2)}
      </button>
      <button class="btn btn-outline-secondary ms-2" data-action="stripeFrontend.checkPaymentStatus" data-id="${entryId}"
              aria-label="Check payment status">
        <i class="bi bi-arrow-clockwise me-1"></i>Check Status
      </button>
    `;
  }
};

ModuleRegistry.register('stripeFrontend', stripeFrontend);
