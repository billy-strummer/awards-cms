/**
 * register-app.js
 *
 * Extracted from register.html inline <script> blocks to allow removal of
 * 'unsafe-inline' from the Content-Security-Policy script-src directive.
 */

// ---- CONFIG ----
const API_BASE = '/api/registration-proxy';

let currentEvent = null;
let selectedPackage = null;
let guestCount = 1;
let registrationId = null;

// Default packages (can be customised per event in future)
const DEFAULT_PACKAGES = [
  {
    id: 'individual',
    name: 'Individual Ticket',
    seats: 1,
    priceMultiplier: 1,
    features: ['1 Guest', 'Welcome drink', '3-course dinner', 'Awards ceremony'],
  },
  {
    id: 'table-8',
    name: 'Table of 8',
    seats: 8,
    priceMultiplier: 7.5,
    popular: true,
    features: [
      '8 Guests',
      'Reserved table',
      'Welcome drinks',
      '3-course dinner',
      'Awards ceremony',
      'Table wine included',
    ],
  },
  {
    id: 'table-10',
    name: 'Table of 10',
    seats: 10,
    priceMultiplier: 9,
    features: [
      '10 Guests',
      'Reserved table',
      'Welcome drinks',
      '3-course dinner',
      'Awards ceremony',
      'Table wine included',
    ],
  },
  {
    id: 'vip-table',
    name: 'VIP Table',
    seats: 10,
    priceMultiplier: 13,
    features: [
      '10 Guests',
      'Premium table position',
      'Champagne reception',
      '3-course dinner',
      'Awards ceremony',
      'Premium wine selection',
      'VIP lounge access',
    ],
  },
];

// ---- INIT ----
async function init() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('event');

  if (!eventId) {
    showError('No event specified. Please use a valid registration link.');
    return;
  }

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_event', eventId }),
    });
    const result = await res.json();

    if (!res.ok || !result.success || !result.event) {
      showError(result.error || 'Event not found or registration is closed.');
      return;
    }
    const event = result.event;

    if (event.event_status === 'cancelled') {
      showError('This event has been cancelled.');
      return;
    }

    currentEvent = event;
    renderEventDetails();
    renderPackages();

    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';

    // Check if returning from Stripe payment
    checkPaymentReturn();
  } catch (err) {
    showError('Failed to load event: ' + err.message);
  }
}

function showError(msg) {
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('errorMessage').textContent = msg;
  document.getElementById('errorState').style.display = 'block';
}

function renderEventDetails() {
  document.title = `Register - ${currentEvent.event_name}`;
  document.getElementById('eventTitle').textContent = currentEvent.event_name;
  document.getElementById('eventDateDisplay').innerHTML = currentEvent.event_date
    ? `<i class="bi bi-calendar me-1"></i>${new Date(currentEvent.event_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
    : '';
  document.getElementById('eventVenueDisplay').innerHTML = currentEvent.venue
    ? `<i class="bi bi-geo-alt me-1"></i>${escapeHtml(currentEvent.venue)}`
    : '';
  document.getElementById('eventDescription').textContent = currentEvent.description || '';
}

function renderPackages() {
  const container = document.getElementById('packagesContainer');
  const basePrice = currentEvent.ticket_price || 0;

  container.innerHTML = DEFAULT_PACKAGES.map((pkg) => {
    const price = basePrice > 0 ? (basePrice * pkg.priceMultiplier).toFixed(2) : 0;
    return `
      <div class="col-md-3 col-6">
        <div class="package-card" data-action="selectPackage" data-id="${pkg.id}" id="pkg-${pkg.id}">
          ${pkg.popular ? '<span class="badge bg-primary position-absolute" style="top:-10px;right:10px;">Most Popular</span>' : ''}
          <div class="pkg-name">${pkg.name}</div>
          <div class="price">
            ${basePrice > 0 ? `£${price}<small>/total</small>` : 'Free'}
          </div>
          <ul class="pkg-features">
            ${pkg.features.map((f) => `<li><i class="bi bi-check-circle-fill"></i>${f}</li>`).join('')}
          </ul>
        </div>
      </div>`;
  }).join('');
}

function selectPackage(pkgId) {
  selectedPackage = DEFAULT_PACKAGES.find((p) => p.id === pkgId);
  document.querySelectorAll('.package-card').forEach((c) => c.classList.remove('selected'));
  document.getElementById('pkg-' + pkgId).classList.add('selected');

  // Short delay then go to step 2
  setTimeout(() => goToStep(2), 300);
}

// ---- STEPS ----
function goToStep(step) {
  if (step === 2 && !selectedPackage) {
    alert('Please select a package first');
    return;
  }
  if (step === 3) {
    // Validate guest details
    const name = document.getElementById('guestName1').value.trim();
    const email = document.getElementById('guestEmail1').value.trim();
    if (!name || !email) {
      alert('Please enter the primary guest name and email');
      return;
    }
    renderOrderSummary();
  }

  document.querySelectorAll('[id^="step"]').forEach((el) => {
    if (el.id.match(/^step\d$/)) el.style.display = 'none';
  });
  document.getElementById('step' + step).style.display = 'block';

  // Update dots
  document.querySelectorAll('.step-indicator .step').forEach((dot, i) => {
    dot.classList.toggle('active', i < step);
  });

  // Setup guest rows for multi-seat packages
  if (step === 2 && selectedPackage.seats > 1) {
    document.getElementById('addGuestBtnContainer').style.display = 'block';
    document.getElementById('guestMaxLabel').textContent = selectedPackage.seats;
    updateGuestCountLabel();
  } else if (step === 2) {
    document.getElementById('addGuestBtnContainer').style.display = 'none';
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function addGuestRow() {
  guestCount++;
  if (guestCount > selectedPackage.seats) {
    alert('Maximum guests for this package reached');
    guestCount--;
    return;
  }

  const container = document.getElementById('additionalGuestsContainer');
  const row = document.createElement('div');
  row.className = 'guest-row';
  row.id = `guestRow${guestCount}`;
  row.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <strong>Guest ${guestCount}</strong>
      <button class="btn btn-sm btn-outline-danger" data-action="removeGuestRow" data-id="${guestCount}"><i class="bi bi-x"></i></button>
    </div>
    <div class="row g-2">
      <div class="col-md-4"><input type="text" class="form-control form-control-sm" id="guestName${guestCount}" placeholder="Full Name"></div>
      <div class="col-md-4"><input type="email" class="form-control form-control-sm" id="guestEmail${guestCount}" placeholder="Email"></div>
      <div class="col-md-4"><input type="text" class="form-control form-control-sm" id="guestDietary${guestCount}" placeholder="Dietary requirements"></div>
    </div>`;
  container.appendChild(row);
  updateGuestCountLabel();
}

function removeGuestRow(num) {
  const row = document.getElementById('guestRow' + num);
  if (row) row.remove();
  updateGuestCountLabel();
}

function updateGuestCountLabel() {
  const count = document.querySelectorAll('.guest-row').length;
  document.getElementById('guestCountLabel').textContent = count;
}

function renderOrderSummary() {
  const basePrice = currentEvent.ticket_price || 0;
  const total = basePrice * selectedPackage.priceMultiplier;
  const primaryName = document.getElementById('guestName1').value.trim();

  // Collect all guest names
  const guestNames = [primaryName];
  document.querySelectorAll('[id^="guestName"]').forEach((el) => {
    if (el.id !== 'guestName1' && el.value.trim()) guestNames.push(el.value.trim());
  });

  document.getElementById('orderSummary').innerHTML = `
    <div class="d-flex justify-content-between mb-2">
      <span>${escapeHtml(selectedPackage.name)}</span>
      <span>${basePrice > 0 ? '£' + total.toFixed(2) : 'Free'}</span>
    </div>
    <small class="text-muted">${guestNames.length} guest(s): ${guestNames.map(escapeHtml).join(', ')}</small>
  `;
  document.getElementById('orderTotal').textContent = basePrice > 0 ? `£${total.toFixed(2)}` : 'Free';
  document.getElementById('submitBtnText').textContent =
    basePrice > 0 ? `Pay £${total.toFixed(2)}` : 'Confirm Registration';
}

// ---- STRIPE INTEGRATION ----
let stripePublicKey = localStorage.getItem('bta_stripe_pk') || '';

async function handleStripePayment(totalAmount, guestData) {
  if (!stripePublicKey || !window.Stripe) return false;
  try {
    const stripe = window.Stripe(stripePublicKey);
    // Create a pending registration ID we can track
    const pendingId = 'reg_' + Date.now();
    // Store guest data temporarily for post-payment completion
    sessionStorage.setItem(
      'pending_registration',
      JSON.stringify({
        id: pendingId,
        eventId: currentEvent.id,
        packageName: selectedPackage.name,
        guests: guestData,
        amount: totalAmount,
      })
    );

    // Validate price matches expected server-side calculation
    const expectedPrice = (currentEvent.ticket_price || 0) * selectedPackage.priceMultiplier;
    if (Math.abs(totalAmount - expectedPrice) > 0.01) {
      throw new Error('Price mismatch detected. Please refresh and try again.');
    }

    // Redirect to Stripe Checkout - price will be re-validated server-side via webhook
    const { error } = await stripe.redirectToCheckout({
      lineItems: [
        {
          price_data: {
            currency: 'gbp',
            product_data: { name: `${currentEvent.event_name} - ${selectedPackage.name}` },
            unit_amount: Math.round(totalAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      successUrl: `${window.location.origin}${window.location.pathname}?event=${currentEvent.id}&payment=success&ref=${pendingId}`,
      cancelUrl: `${window.location.origin}${window.location.pathname}?event=${currentEvent.id}&payment=cancelled`,
    });
    if (error) throw error;
    return true; // Redirecting to Stripe
  } catch (err) {
    console.warn('Stripe checkout unavailable, falling back to free registration:', err.message);
    return false;
  }
}

// Check for payment return
function checkPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    const pending = sessionStorage.getItem('pending_registration');
    if (pending) {
      sessionStorage.removeItem('pending_registration');
      const reg = JSON.parse(pending);
      completeRegistration(reg.guests, reg.packageName);
    }
  } else if (params.get('payment') === 'cancelled') {
    alert('Payment was cancelled. You can try again.');
  }
}

// ---- SUBMIT ----
async function submitRegistration() {
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';

  try {
    const primaryName = document.getElementById('guestName1').value.trim();
    const primaryEmail = document.getElementById('guestEmail1').value.trim();
    const primaryDietary = document.getElementById('guestDietary1')?.value.trim() || '';
    const company = document.getElementById('guestCompany').value.trim();
    const notes = document.getElementById('guestNotes').value.trim();

    // Collect all guests
    const guests = [
      {
        name: primaryName,
        email: primaryEmail,
        dietary: primaryDietary,
        isPrimary: true,
        company,
        notes,
      },
    ];

    document.querySelectorAll('[id^="guestRow"]').forEach((row) => {
      const num = row.id.replace('guestRow', '');
      const name = document.getElementById('guestName' + num)?.value.trim();
      if (name) {
        guests.push({
          name,
          email: document.getElementById('guestEmail' + num)?.value.trim() || '',
          dietary: document.getElementById('guestDietary' + num)?.value.trim() || '',
          isPrimary: false,
        });
      }
    });

    // If paid event and Stripe is configured, redirect to Stripe Checkout
    const basePrice = currentEvent.ticket_price || 0;
    const total = basePrice * selectedPackage.priceMultiplier;
    if (total > 0 && stripePublicKey) {
      const redirected = await handleStripePayment(total, guests);
      if (redirected) return; // User is being redirected to Stripe
    }

    // Free event or no Stripe - complete directly
    await completeRegistration(guests, selectedPackage.name);
  } catch (err) {
    console.error('Registration error:', err);
    alert('Registration failed: ' + err.message);
    btn.disabled = false;
    const btnText = document.getElementById('submitBtnText');
    if (btnText) btnText.textContent = 'Confirm Registration';
  }
}

async function completeRegistration(guests, packageName) {
  const primaryGuest = guests.find((g) => g.isPrimary) || guests[0];

  // Insert all guests into event_guests
  const guestRows = guests.map((g) => ({
    event_id: currentEvent.id,
    guest_name: g.name,
    guest_email: g.email || '',
    guest_type: g.isPrimary ? (packageName.toLowerCase().includes('vip') ? 'vip' : 'guest') : 'guest',
    rsvp_status: 'confirmed',
    rsvp_date: new Date().toISOString(),
    dietary_requirements: g.dietary || null,
    plus_ones: g.isPrimary ? guests.length - 1 : 0,
    notes: g.isPrimary
      ? [g.company ? `Company: ${g.company}` : '', g.notes || '', `Package: ${packageName}`].filter(Boolean).join(' | ')
      : null,
  }));

  const regRes = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'register_guest', eventId: currentEvent.id, guests: guestRows }),
  });
  const regResult = await regRes.json();

  if (!regRes.ok || !regResult.success) {
    throw new Error(regResult.error || 'Registration failed');
  }
  const insertedGuests = regResult.guests || [];

  registrationId = insertedGuests[0]?.id;

  // Show confirmation with QR code
  document.getElementById('confirmGuestName').textContent = primaryGuest.name;
  document.getElementById('confirmPackageName').textContent = packageName;
  document.getElementById('confirmEmail').textContent = primaryGuest.email;

  generateQRCode(registrationId, primaryGuest.name);
  goToStep(4);
}

// ---- QR CODE ----
function generateQRCode(guestId, guestName) {
  const img = document.getElementById('qrCode');
  const data = JSON.stringify({ gid: guestId, eid: currentEvent.id, n: guestName });
  const encoded = encodeURIComponent(data);
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`;
  img.alt = `Check-in QR for ${guestName}`;
}

function downloadQR() {
  const img = document.getElementById('qrCode');
  fetch(img.src)
    .then((r) => r.blob())
    .then((blob) => {
      const link = document.createElement('a');
      link.download = `ticket_${registrationId || 'unknown'}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    })
    .catch(() => window.open(img.src, '_blank'));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Event delegation for data-action attributes ----
document.addEventListener('click', function (event) {
  var el = event.target.closest('[data-action]');
  if (!el) return;
  var actionName = el.getAttribute('data-action');
  if (!actionName) return;

  // Resolve the function by walking the dotted path on window
  var parts = actionName.split('.');
  var obj = window;
  for (var i = 0; i < parts.length - 1; i++) {
    obj = obj[parts[i]];
    if (!obj) {
      console.warn('[data-action] No handler found:', actionName);
      return;
    }
  }
  var fn = obj[parts[parts.length - 1]];
  if (typeof fn !== 'function') {
    console.warn('[data-action] No handler found:', actionName);
    return;
  }

  var id = el.getAttribute('data-id');
  if (id !== null) {
    fn.call(obj, id, event);
  } else {
    fn.call(obj, event);
  }
});

// ---- START ----
init();
