/**
 * Event Registration Proxy API
 *
 * Server-side proxy for public event registration.
 * Handles event lookup and guest registration without exposing
 * Supabase credentials to the browser.
 *
 * Environment Variables Required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 *
 * Deploy as: Vercel serverless function at /api/registration-proxy
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUUID(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 3600000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { action } = req.body || {};

  try {
    switch (action) {
      case 'get_event':
        return await handleGetEvent(req, res);
      case 'register_guest':
        return await handleRegisterGuest(req, res);
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('Registration proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

async function handleGetEvent(req, res) {
  const { eventId } = req.body;
  if (!eventId || !isValidUUID(eventId)) {
    return res.status(400).json({ error: 'Valid event ID is required' });
  }

  const { data: event, error } = await supabase
    .from('events')
    .select(
      'id, event_name, event_date, event_time, venue_name, venue_address, venue, description, status, event_status, max_capacity, registration_open, registration_close, ticket_price'
    )
    .eq('id', eventId)
    .single();

  if (error || !event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  return res.status(200).json({ success: true, event });
}

async function handleRegisterGuest(req, res) {
  const { eventId, guests } = req.body;

  if (!eventId || !isValidUUID(eventId)) {
    return res.status(400).json({ error: 'Valid event ID is required' });
  }

  if (!Array.isArray(guests) || guests.length === 0 || guests.length > 20) {
    return res.status(400).json({ error: 'Between 1 and 20 guests can be registered at a time' });
  }

  // Validate each guest
  const sanitizedGuests = [];
  for (const guest of guests) {
    if (!guest.guest_name || typeof guest.guest_name !== 'string' || guest.guest_name.trim().length < 2) {
      return res.status(400).json({ error: 'Guest name is required (min 2 characters)' });
    }
    if (!guest.guest_email || !isValidEmail(guest.guest_email)) {
      return res.status(400).json({ error: `Invalid email for guest: ${guest.guest_name}` });
    }

    sanitizedGuests.push({
      event_id: eventId,
      guest_name: sanitizeString(guest.guest_name, 200),
      guest_email: sanitizeString(guest.guest_email, 200),
      company_name: sanitizeString(guest.company_name || '', 200) || null,
      dietary_requirements: sanitizeString(guest.dietary_requirements || '', 500) || null,
      special_requirements: sanitizeString(guest.special_requirements || '', 500) || null,
      ticket_type: sanitizeString(guest.ticket_type || 'standard', 50),
      guest_type: sanitizeString(guest.guest_type || 'guest', 50),
      rsvp_status: sanitizeString(guest.rsvp_status || 'confirmed', 50),
      rsvp_date: new Date().toISOString(),
      plus_ones: typeof guest.plus_ones === 'number' ? Math.min(Math.max(Math.floor(guest.plus_ones), 0), 20) : 0,
      notes: sanitizeString(guest.notes || '', 500) || null,
      status: 'registered',
      registration_date: new Date().toISOString(),
    });
  }

  // Verify event exists and has capacity
  const { data: event } = await supabase.from('events').select('id, max_capacity').eq('id', eventId).single();

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  // Enforce max_capacity if set
  if (event.max_capacity && event.max_capacity > 0) {
    const { count: currentGuests, error: countError } = await supabase
      .from('event_guests')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .in('status', ['registered', 'confirmed', 'checked_in']);

    if (countError) {
      console.error('Error checking capacity:', countError);
      return res.status(500).json({ error: 'Failed to check event capacity' });
    }

    if ((currentGuests || 0) + sanitizedGuests.length > event.max_capacity) {
      const remaining = Math.max(0, event.max_capacity - (currentGuests || 0));
      return res.status(409).json({
        error: `Event is at capacity. Only ${remaining} spot${remaining !== 1 ? 's' : ''} remaining.`,
        remaining,
      });
    }
  }

  // Insert guests
  const { data: insertedGuests, error } = await supabase
    .from('event_guests')
    .insert(sanitizedGuests)
    .select('id, guest_name, guest_email');

  if (error) {
    console.error('Guest registration failed:', error);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }

  return res.status(200).json({
    success: true,
    registered: insertedGuests.length,
    guests: insertedGuests,
  });
}
