/**
 * @module certificates-qr
 * Certificate Generation and QR Code System.
 *
 * Features:
 * - PDF certificate generation for winners
 * - QR code generation for event tickets and badges
 * - Automated certificate email delivery
 * - Badge printing system
 * - Digital certificate downloads
 */

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY
);

/**
 * Verify the caller's Supabase JWT.
 * Returns the authenticated user or sends 401 and returns null.
 */
async function verifyAuth(req, res) {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  try {
    const {
      data: { user },
      error,
    } = await supabaseAuth.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return null;
    }
    return user;
  } catch (_err) {
    res.status(401).json({ error: 'Token verification failed' });
    return null;
  }
}

/**
 * Generate a PDF winner certificate for an entry and upload it to Supabase storage.
 * @param {string} entryId - The ID of the winning entry.
 * @param {string|null} [outputPath=null] - Optional custom file path for the PDF output.
 * @returns {Promise<{filepath: string, publicUrl: string, filename: string}>} Certificate file details.
 * @throws {Error} If the entry is not found, is not a winner, or upload fails.
 */
async function generateWinnerCertificate(entryId, outputPath = null) {
  try {
    console.log(`📜 Generating certificate for entry ${entryId}...`);

    // Get entry and winner details
    const { data: entry, error } = await supabase
      .from('entries')
      .select('*, organisations(*), awards:award_years(*)')
      .eq('id', entryId)
      .single();

    if (error) throw error;
    if (entry.status !== 'winner') {
      throw new Error('Entry is not a winner');
    }

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 50,
    });

    // Set output — use /tmp for serverless environments
    const filename = `certificate-${entry.entry_number}.pdf`;
    const filepath = outputPath || path.join('/tmp', filename);

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // Add border
    doc
      .rect(40, 40, doc.page.width - 80, doc.page.height - 80)
      .lineWidth(3)
      .strokeColor('#FFD700')
      .stroke();

    doc
      .rect(50, 50, doc.page.width - 100, doc.page.height - 100)
      .lineWidth(1)
      .strokeColor('#FFD700')
      .stroke();

    // Add logo (if available)
    // doc.image('path/to/logo.png', 350, 70, { width: 100 });

    // Title
    doc.fontSize(48).font('Helvetica-Bold').fillColor('#1a1a1a').text('CERTIFICATE', 0, 120, { align: 'center' });

    doc.fontSize(20).font('Helvetica').fillColor('#666').text('OF EXCELLENCE', 0, 180, { align: 'center' });

    // Presented to
    doc.fontSize(14).fillColor('#999').text('This certificate is proudly presented to', 0, 250, { align: 'center' });

    // Company name
    doc
      .fontSize(36)
      .font('Helvetica-Bold')
      .fillColor('#1a1a1a')
      .text(entry.organisations.company_name, 0, 290, { align: 'center' });

    // Award details
    doc.fontSize(18).font('Helvetica').fillColor('#444').text('For winning the', 0, 350, { align: 'center' });

    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#FFD700')
      .text(entry.awards.award_name, 0, 380, { align: 'center' });

    doc
      .fontSize(16)
      .font('Helvetica')
      .fillColor('#444')
      .text(`at the British Trade Awards ${entry.awards?.year || new Date().getFullYear()}`, 0, 420, {
        align: 'center',
      });

    // Date
    const awardDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    doc.fontSize(12).fillColor('#666').text(awardDate, 0, 480, { align: 'center' });

    // Signature line
    doc.moveTo(250, 530).lineTo(550, 530).stroke();

    doc.fontSize(10).text('Chief Executive Officer', 0, 540, { align: 'center' });

    // Certificate ID
    doc
      .fontSize(8)
      .fillColor('#999')
      .text(`Certificate ID: ${entry.entry_number}`, 0, doc.page.height - 80, { align: 'center' });

    // Trophy icon (text-based)
    doc.fontSize(48).text('🏆', 0, 70, { align: 'center' });

    // Finalize PDF
    doc.end();

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    console.log(`✅ Certificate generated: ${filepath}`);

    // Upload to Supabase storage
    const { data: _uploadData, error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(filename, fs.readFileSync(filepath), {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage.from('certificates').getPublicUrl(filename);

    // Update entry with certificate URL
    await supabase
      .from('entries')
      .update({
        certificate_url: urlData.publicUrl,
      })
      .eq('id', entryId);

    return {
      filepath,
      publicUrl: urlData.publicUrl,
      filename,
    };
  } catch (error) {
    console.error('Error generating certificate:', error);
    throw error;
  }
}

/**
 * Generate PDF certificates for all entries with 'winner' status.
 * @returns {Promise<Array<{entryId: string, entryNumber: string, company?: string, success: boolean, url?: string, error?: string}>>} Results for each winner.
 * @throws {Error} If a database error occurs.
 */
async function generateAllWinnerCertificates() {
  try {
    console.log('📜 Generating certificates for all winners...');

    const { data: winners, error } = await supabase
      .from('entries')
      .select('id, entry_number, organisations(company_name), awards:award_years(award_name)')
      .eq('status', 'winner');

    if (error) throw error;

    const results = [];

    for (const winner of winners) {
      try {
        const result = await generateWinnerCertificate(winner.id);
        results.push({
          entryId: winner.id,
          entryNumber: winner.entry_number,
          company: winner.organisations.company_name,
          success: true,
          url: result.publicUrl,
        });
        console.log(`✅ ${winner.entry_number}: ${winner.organisations.company_name}`);
      } catch (err) {
        console.error(`❌ ${winner.entry_number}: ${err.message}`);
        results.push({
          entryId: winner.id,
          entryNumber: winner.entry_number,
          success: false,
          error: err.message,
        });
      }
    }

    console.log(`\n✅ Generated ${results.filter((r) => r.success).length}/${winners.length} certificates`);
    return results;
  } catch (error) {
    console.error('Error generating all certificates:', error);
    throw error;
  }
}

/**
 * Generate a QR code for an event ticket and upload it to Supabase storage.
 * @param {string} attendeeId - The ID of the event attendee.
 * @param {string} [ticketType='standard'] - The ticket type (e.g. 'standard', 'vip').
 * @returns {Promise<{qrCodeUrl: string, qrCodeDataURL: string, filename: string}>} QR code details.
 * @throws {Error} If the attendee is not found or upload fails.
 */
async function generateEventTicketQR(attendeeId, ticketType = 'standard') {
  try {
    console.log(`🎫 Generating QR code for attendee ${attendeeId}...`);

    // Get attendee details
    const { data: attendee, error } = await supabase
      .from('event_attendees')
      .select('*, events(*), contacts(*)')
      .eq('id', attendeeId)
      .single();

    if (error) throw error;

    // Create QR code data
    const qrData = JSON.stringify({
      id: attendee.id,
      name: attendee.contacts?.full_name || attendee.attendee_name,
      email: attendee.contacts?.email || attendee.attendee_email,
      event: attendee.events?.event_name,
      ticket_type: ticketType,
      table: attendee.table_number,
      meal_preference: attendee.meal_preference,
      timestamp: new Date().toISOString(),
    });

    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Save QR code to storage
    const filename = `qr-ticket-${attendee.id}.png`;
    const buffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');

    const { data: _uploadData, error: uploadError } = await supabase.storage.from('qr-codes').upload(filename, buffer, {
      contentType: 'image/png',
      upsert: true,
    });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage.from('qr-codes').getPublicUrl(filename);

    // Update attendee with QR code URL
    await supabase
      .from('event_attendees')
      .update({
        qr_code_url: urlData.publicUrl,
      })
      .eq('id', attendeeId);

    console.log(`✅ QR code generated for ${attendee.contacts?.full_name || attendee.attendee_name}`);

    return {
      qrCodeUrl: urlData.publicUrl,
      qrCodeDataURL,
      filename,
    };
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

/**
 * Generate a printable event badge PDF with embedded QR code for an attendee.
 * @param {string} attendeeId - The ID of the event attendee.
 * @returns {Promise<{filepath: string, filename: string, qrCodeUrl: string}>} Badge file details.
 * @throws {Error} If the attendee is not found or badge generation fails.
 */
async function generateEventBadge(attendeeId) {
  try {
    console.log(`🏷️ Generating badge for attendee ${attendeeId}...`);

    // Get attendee details
    const { data: attendee, error } = await supabase
      .from('event_attendees')
      .select('*, events(*), contacts(*), organisations(*)')
      .eq('id', attendeeId)
      .single();

    if (error) throw error;

    // Generate QR code first
    const qrResult = await generateEventTicketQR(attendeeId);

    // Create badge PDF
    const doc = new PDFDocument({
      size: [252, 378], // 3.5" x 5.25" at 72 DPI
      margin: 20,
    });

    const filename = `badge-${attendee.id}.pdf`;
    const filepath = path.join('/tmp', filename);

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8f9fa');

    // Header
    doc.rect(0, 0, doc.page.width, 80).fill('#667eea');

    // Event name
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#FFFFFF')
      .text('British Trade Awards', 0, 25, { align: 'center' });

    doc.fontSize(10).font('Helvetica').text(String(new Date().getFullYear()), 0, 45, { align: 'center' });

    // Attendee name
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .fillColor('#1a1a1a')
      .text(attendee.contacts?.full_name || attendee.attendee_name, 20, 100, {
        align: 'center',
        width: doc.page.width - 40,
      });

    // Company
    if (attendee.organisations?.company_name) {
      doc
        .fontSize(14)
        .font('Helvetica')
        .fillColor('#666')
        .text(attendee.organisations.company_name, 20, 140, {
          align: 'center',
          width: doc.page.width - 40,
        });
    }

    // Table number
    if (attendee.table_number) {
      doc
        .fontSize(12)
        .fillColor('#444')
        .text(`Table ${attendee.table_number}`, 20, 170, {
          align: 'center',
          width: doc.page.width - 40,
        });
    }

    // QR Code
    const qrBuffer = Buffer.from(qrResult.qrCodeDataURL.split(',')[1], 'base64');
    doc.image(qrBuffer, (doc.page.width - 120) / 2, 200, { width: 120 });

    // Footer
    doc
      .fontSize(8)
      .fillColor('#999')
      .text(attendee.events?.event_date || 'Event Date', 0, doc.page.height - 30, { align: 'center' });

    doc.end();

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    console.log(`✅ Badge generated: ${filepath}`);

    return {
      filepath,
      filename,
      qrCodeUrl: qrResult.qrCodeUrl,
    };
  } catch (error) {
    console.error('Error generating badge:', error);
    throw error;
  }
}

/**
 * Generate badges for all confirmed attendees of an event.
 * @param {string} eventId - The ID of the event.
 * @returns {Promise<Array<{attendeeId: string, name: string, success: boolean, filepath?: string, error?: string}>>} Results for each attendee.
 * @throws {Error} If a database error occurs.
 */
async function generateAllEventBadges(eventId) {
  try {
    console.log(`🏷️ Generating badges for event ${eventId}...`);

    const { data: attendees, error } = await supabase
      .from('event_attendees')
      .select('id, attendee_name, contacts(full_name)')
      .eq('event_id', eventId)
      .eq('rsvp_status', 'confirmed');

    if (error) throw error;

    const results = [];

    for (const attendee of attendees) {
      try {
        const result = await generateEventBadge(attendee.id);
        results.push({
          attendeeId: attendee.id,
          name: attendee.contacts?.full_name || attendee.attendee_name,
          success: true,
          filepath: result.filepath,
        });
        console.log(`✅ ${attendee.contacts?.full_name || attendee.attendee_name}`);
      } catch (err) {
        console.error(`❌ ${attendee.contacts?.full_name || attendee.attendee_name}: ${err.message}`);
        results.push({
          attendeeId: attendee.id,
          name: attendee.contacts?.full_name || attendee.attendee_name,
          success: false,
          error: err.message,
        });
      }
    }

    console.log(`\n✅ Generated ${results.filter((r) => r.success).length}/${attendees.length} badges`);
    return results;
  } catch (error) {
    console.error('Error generating all badges:', error);
    throw error;
  }
}

/**
 * Verify a QR code at event check-in and mark the attendee as checked in.
 * @param {string} qrData - The JSON string from the scanned QR code.
 * @returns {Promise<{valid: boolean, message: string, attendee?: Object, error?: string}>} Verification result.
 */
async function verifyQRCode(qrData) {
  try {
    const data = JSON.parse(qrData);

    const { data: attendee, error } = await supabase
      .from('event_attendees')
      .select('*, events(*), contacts(*)')
      .eq('id', data.id)
      .single();

    if (error) throw error;

    if (!attendee) {
      return {
        valid: false,
        message: 'Attendee not found',
      };
    }

    if (attendee.checked_in) {
      return {
        valid: false,
        message: 'Already checked in',
        attendee,
      };
    }

    // Mark as checked in
    await supabase
      .from('event_attendees')
      .update({
        checked_in: true,
        check_in_time: new Date().toISOString(),
      })
      .eq('id', data.id);

    return {
      valid: true,
      message: 'Check-in successful',
      attendee,
    };
  } catch (error) {
    return {
      valid: false,
      message: 'Invalid QR code',
      error: error.message,
    };
  }
}

/**
 * API endpoint to generate a winner certificate.
 * POST /api/generate-certificate
 * @param {Object} req - Express request object with body.entryId.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function generateCertificateEndpoint(req, res) {
  try {
    const { entryId } = req.body;
    const result = await generateWinnerCertificate(entryId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * API endpoint to generate certificates for all winners.
 * POST /api/generate-all-certificates
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function generateAllCertificatesEndpoint(req, res) {
  try {
    const results = await generateAllWinnerCertificates();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * API endpoint to generate a QR code ticket for an attendee.
 * POST /api/generate-qr-ticket
 * @param {Object} req - Express request object with body.attendeeId.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function generateQRTicketEndpoint(req, res) {
  try {
    const { attendeeId } = req.body;
    const result = await generateEventTicketQR(attendeeId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * API endpoint to generate a printable event badge.
 * POST /api/generate-badge
 * @param {Object} req - Express request object with body.attendeeId.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function generateBadgeEndpoint(req, res) {
  try {
    const { attendeeId } = req.body;
    const result = await generateEventBadge(attendeeId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * API endpoint to verify a QR code at event check-in.
 * POST /api/verify-qr
 * @param {Object} req - Express request object with body.qrData.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function verifyQREndpoint(req, res) {
  try {
    const { qrData } = req.body;
    const result = await verifyQRCode(qrData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Vercel serverless handler — routes by query action.
 */
module.exports = async function handler(req, res) {
  // Verify authentication for all actions
  const user = await verifyAuth(req, res);
  if (!user) return;

  const action = req.query.action || req.body?.action;

  switch (action) {
    case 'generate-certificate':
      return generateCertificateEndpoint(req, res);
    case 'generate-all-certificates':
      return generateAllCertificatesEndpoint(req, res);
    case 'generate-qr-ticket':
      return generateQRTicketEndpoint(req, res);
    case 'generate-badge':
      return generateBadgeEndpoint(req, res);
    case 'verify-qr':
      return verifyQREndpoint(req, res);
    default:
      return res.status(400).json({
        error:
          'Invalid action. Use: generate-certificate, generate-all-certificates, generate-qr-ticket, generate-badge, verify-qr',
      });
  }
};

module.exports.generateWinnerCertificate = generateWinnerCertificate;
module.exports.generateAllWinnerCertificates = generateAllWinnerCertificates;
module.exports.generateEventTicketQR = generateEventTicketQR;
module.exports.generateEventBadge = generateEventBadge;
module.exports.generateAllEventBadges = generateAllEventBadges;
module.exports.verifyQRCode = verifyQRCode;
module.exports.generateCertificateEndpoint = generateCertificateEndpoint;
module.exports.generateAllCertificatesEndpoint = generateAllCertificatesEndpoint;
module.exports.generateQRTicketEndpoint = generateQRTicketEndpoint;
module.exports.generateBadgeEndpoint = generateBadgeEndpoint;
module.exports.verifyQREndpoint = verifyQREndpoint;
