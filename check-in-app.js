/* eslint-disable no-unused-vars */
/* check-in.html extracted scripts — SA2-C1 CSP inline-script fix */
/* global Html5Qrcode */

const { escapeHtml, showPublicToast } = window.publicUtils;

const SUPABASE_URL = window.SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG.anonKey;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let eventId = null;
let currentEvent = null;
let guests = [];
let html5QrCode = null;
let scanCooldown = false;
let currentMode = 'scan';

async function init() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    showError('Authentication required. Please <a href="index.html">log in</a> to access the check-in system.');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  eventId = params.get('event');

  if (!eventId) {
    showError('No event specified. Use: check-in.html?event=EVENT_ID');
    return;
  }

  try {
    const { data: event, error: eventError } = await supabase.from('events').select('*').eq('id', eventId).single();

    if (eventError || !event) throw new Error('Event not found');
    currentEvent = event;

    await loadGuests();

    document.getElementById('ciEventName').textContent = event.event_name;
    document.getElementById('ciEventDate').textContent = event.event_date
      ? new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';

    updateStats();

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';

    initScanner();
  } catch (err) {
    showError(err.message);
  }
}

function showError(msg) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorMsg').textContent = msg;
  document.getElementById('errorState').style.display = 'block';
}

async function loadGuests() {
  const { data, error } = await supabase
    .from('event_guests')
    .select('*')
    .eq('event_id', eventId)
    .order('guest_name', { ascending: true });

  if (error) throw error;
  guests = data || [];
}

function updateStats() {
  const confirmed = guests.filter((g) => g.rsvp_status === 'confirmed');
  const checkedIn = confirmed.filter((g) => g.checked_in);
  const pending = confirmed.filter((g) => !g.checked_in);
  const rate = confirmed.length > 0 ? Math.round((checkedIn.length / confirmed.length) * 100) : 0;

  document.getElementById('statChecked').textContent = checkedIn.length;
  document.getElementById('statPending').textContent = pending.length;
  document.getElementById('statRate').textContent = rate + '%';
}

function switchMode(mode) {
  currentMode = mode;
  document.getElementById('scannerContainer').style.display = mode === 'scan' ? 'flex' : 'none';
  document.getElementById('searchContainer').style.display = mode === 'search' ? 'block' : 'none';
  document.getElementById('btnScanMode').className = mode === 'scan' ? 'btn btn-primary' : 'btn btn-outline-light';
  document.getElementById('btnSearchMode').className = mode === 'search' ? 'btn btn-primary' : 'btn btn-outline-light';

  if (mode === 'search') {
    renderGuestList();
    setTimeout(() => document.getElementById('searchInput').focus(), 100);
    if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop();
  } else {
    if (html5QrCode && !html5QrCode.isScanning) {
      initScanner();
    }
  }
}

function initScanner() {
  if (html5QrCode) {
    try {
      html5QrCode.stop();
    } catch (e) {}
  }

  html5QrCode = new Html5Qrcode('reader');
  html5QrCode
    .start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess, () => {})
    .catch((err) => {
      console.error('Camera error:', err);
      document.getElementById('reader').innerHTML = `
      <div class="text-center p-4" style="background:rgba(255,255,255,0.05); border-radius:12px;">
        <i class="bi bi-camera-video-off display-4 mb-3 d-block" style="opacity:0.3;"></i>
        <p style="opacity:0.5;">Camera not available. Use name search instead.</p>
        <button class="btn btn-outline-light btn-sm" data-action="switchMode" data-id="search">
          <i class="bi bi-search me-1"></i>Switch to Search
        </button>
      </div>`;
    });
}

async function onScanSuccess(decodedText) {
  if (scanCooldown) return;
  scanCooldown = true;

  try {
    let guestId = null;
    try {
      const data = JSON.parse(decodedText);
      guestId = data.gid || data.id;
    } catch {
      guestId = decodedText.trim();
    }

    if (!guestId) {
      showResult('error', 'Invalid QR Code', 'Could not read ticket data');
      return;
    }

    let guest = guests.find((g) => g.id === guestId);

    if (!guest) {
      const { data } = await supabase
        .from('event_guests')
        .select('*')
        .eq('id', guestId)
        .eq('event_id', eventId)
        .single();
      guest = data;
    }

    if (!guest) {
      showResult('error', 'Guest Not Found', 'This QR code is not valid for this event');
      return;
    }

    if (guest.checked_in) {
      const time = guest.check_in_time
        ? new Date(guest.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '';
      showResult('already', 'Already Checked In', guest.guest_name, '', `Checked in at ${time}`, '');
      return;
    }

    await performCheckIn(guest);
  } catch (err) {
    showResult('error', 'Scan Error', err.message);
  } finally {
    setTimeout(() => {
      scanCooldown = false;
    }, 2000);
  }
}

async function performCheckIn(guest) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('event_guests')
    .update({ checked_in: true, check_in_time: now })
    .eq('id', guest.id);

  if (error) throw error;

  const local = guests.find((g) => g.id === guest.id);
  if (local) {
    local.checked_in = true;
    local.check_in_time = now;
  }

  updateStats();

  let tableInfo = '';
  const { data: assignment } = await supabase
    .from('table_assignments')
    .select('*, event_tables(*)')
    .eq('guest_id', guest.id)
    .single();

  if (assignment && assignment.event_tables) {
    const t = assignment.event_tables;
    tableInfo = t.table_name ? `${t.table_name} (Table ${t.table_number})` : `Table ${t.table_number}`;
  }

  showResult(
    'success',
    'Checked In!',
    guest.guest_name,
    guest.notes || '',
    tableInfo ? `Seat: ${tableInfo}` : '',
    guest.dietary_requirements ? `Dietary: ${guest.dietary_requirements}` : ''
  );

  if (currentMode === 'search') renderGuestList();
}

async function checkInByButton(guestId) {
  const guest = guests.find((g) => g.id === guestId);
  if (!guest) return;

  if (guest.checked_in) {
    const { error } = await supabase
      .from('event_guests')
      .update({ checked_in: false, check_in_time: null })
      .eq('id', guestId);

    if (error) {
      showPublicToast('Error: ' + error.message, 'error');
      return;
    }
    guest.checked_in = false;
    guest.check_in_time = null;
    updateStats();
    renderGuestList();
    return;
  }

  try {
    await performCheckIn(guest);
  } catch (err) {
    showPublicToast('Check-in error: ' + err.message, 'error');
  }
}

function showResult(type, title, name, company, tableInfo, dietary) {
  const overlay = document.getElementById('checkInResult');
  const card = document.getElementById('resultCard');

  card.className = `result-card ${type}`;
  document.getElementById('resultIcon').textContent = type === 'success' ? '✓' : type === 'already' ? '⚠' : '✗';
  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultName').textContent = name || '';
  document.getElementById('resultCompany').textContent = company || '';
  document.getElementById('resultTable').textContent = tableInfo || '';
  document.getElementById('resultDietary').textContent = dietary || '';

  overlay.classList.add('show');
  setTimeout(dismissResult, 3000);
}

function dismissResult() {
  document.getElementById('checkInResult').classList.remove('show');
}

function filterGuests() {
  renderGuestList();
}

function renderGuestList() {
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const container = document.getElementById('guestList');

  const confirmed = guests.filter((g) => g.rsvp_status === 'confirmed');
  const filtered = search ? confirmed.filter((g) => (g.guest_name || '').toLowerCase().includes(search)) : confirmed;

  filtered.sort((a, b) => {
    if (a.checked_in && !b.checked_in) return 1;
    if (!a.checked_in && b.checked_in) return -1;
    return (a.guest_name || '').localeCompare(b.guest_name || '');
  });

  container.innerHTML = filtered
    .map((g) => {
      const isChecked = g.checked_in;
      const time = g.check_in_time
        ? new Date(g.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '';
      const typeColors = { vip: 'warning', speaker: 'primary', sponsor: 'info', media: 'purple', staff: 'secondary' };
      const typeBadge =
        g.guest_type && g.guest_type !== 'guest'
          ? `<span class="badge bg-${typeColors[g.guest_type] || 'secondary'}" style="${g.guest_type === 'media' ? 'background:#6f42c1!important;' : ''}">${escapeHtml(g.guest_type.toUpperCase())}</span>`
          : '';

      return `
      <div class="guest-item ${isChecked ? 'checked-in' : ''}" data-action="checkInByButton" data-id="${escapeHtml(g.id)}">
        <div class="guest-info">
          <div class="guest-name">
            ${isChecked ? '<i class="bi bi-check-circle-fill text-success me-1"></i>' : '<i class="bi bi-circle text-muted me-1"></i>'}
            ${escapeHtml(g.guest_name)}
          </div>
          <div class="guest-badges">
            ${typeBadge}
            ${g.dietary_requirements ? `<span class="badge bg-warning text-dark" style="font-size:0.6rem;"><i class="bi bi-egg-fried"></i> ${escapeHtml(g.dietary_requirements)}</span>` : ''}
            ${g.plus_ones > 0 ? `<span class="badge bg-info" style="font-size:0.6rem;">+${g.plus_ones}</span>` : ''}
          </div>
          ${isChecked ? `<div class="guest-meta">Checked in at ${escapeHtml(time)}</div>` : ''}
        </div>
        <div>
          ${
            isChecked
              ? '<button class="btn btn-sm btn-outline-warning" data-action="checkInByButton" data-id="' +
                escapeHtml(g.id) +
                '" data-stop-propagation="true"><i class="bi bi-arrow-counterclockwise"></i></button>'
              : '<button class="btn btn-sm btn-success" data-action="checkInByButton" data-id="' +
                escapeHtml(g.id) +
                '" data-stop-propagation="true"><i class="bi bi-check-lg me-1"></i>Check In</button>'
          }
        </div>
      </div>`;
    })
    .join('');

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-center py-4" style="opacity:0.3;">
      <i class="bi bi-search display-4 d-block mb-2"></i>
      <p>${search ? 'No matching guests' : 'No confirmed guests'}</p>
    </div>`;
  }
}

document.getElementById('searchInput').addEventListener('input', filterGuests);

document.addEventListener('click', function (e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  if (e.target.closest('[data-stop-propagation]') && e.target.closest('[data-stop-propagation]') !== target) return;
  const fn = window[target.getAttribute('data-action')];
  if (typeof fn === 'function') fn(target.getAttribute('data-id'));
});

init();
