// @ts-nocheck — pdfkit type definitions don't cover the full fluent chaining API
/**
 * @module certificates-qr
 * Certificate Generation and QR Code System.
 *
 * Features:
 * - Template-based PDF certificate generation (pdf-lib overlay on uploaded backgrounds)
 * - Custom font embedding via fontkit
 * - QR code generation for event tickets and badges
 * - Badge printing system
 * - PDF and PNG output for certificates
 */

const { PDFDocument: PDFLib, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { verifyAuth } = require('./_lib/auth');

/**
 * Parse a hex color string to pdf-lib rgb values.
 * @param {string} hex - Hex color string (e.g. '#FF0000' or 'FF0000').
 * @returns {{r: number, g: number, b: number}} RGB values in 0-1 range.
 */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

/**
 * Substitute placeholders in text with winner data.
 * @param {string} text - Text with placeholders like {WINNER_NAME}, {AWARD_NAME}, {YEAR}, {DATE}, {COMPANY}.
 * @param {Object} winner - Winner record with joined award data.
 * @returns {string} Text with placeholders replaced.
 */
function substitutePlaceholders(text, winner) {
  const awardName = winner.awards?.award_name || winner.awards?.award_category || '';
  const year = winner.awards?.year || new Date().getFullYear();
  const company = winner.company_name || winner.organisation_name || '';
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (text || '')
    .replace(/\{WINNER_NAME\}/g, winner.winner_name || '')
    .replace(/\{AWARD_NAME\}/g, awardName)
    .replace(/\{YEAR\}/g, String(year))
    .replace(/\{DATE\}/g, date)
    .replace(/\{COMPANY\}/g, company);
}

/**
 * Fetch a file from a URL as a Buffer.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<Buffer>} The file content.
 */
async function fetchFileBuffer(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Load a template from DB with its background PDF and custom fonts.
 * @param {string} templateId - The template ID.
 * @returns {Promise<Object>} Template data with background bytes and font buffers.
 */
async function loadTemplate(templateId) {
  const { data: template, error } = await supabase
    .from('certificate_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) throw new Error('Template not found: ' + error.message);

  // Load background PDF if set
  let backgroundBytes = null;
  if (template.background_pdf_url) {
    backgroundBytes = await fetchFileBuffer(template.background_pdf_url);
  }

  // Load custom fonts
  const fontBuffers = {};
  const customFonts = template.custom_fonts_json || [];
  for (const font of customFonts) {
    if (font.url && font.name) {
      fontBuffers[font.name] = await fetchFileBuffer(font.url);
    }
  }

  return { template, backgroundBytes, fontBuffers };
}

/**
 * Generate a certificate PDF by overlaying text fields on a template background.
 * @param {Object} winner - Winner record with joined award data.
 * @param {Object} templateData - Result from loadTemplate().
 * @returns {Promise<Uint8Array>} The final PDF bytes.
 */
async function renderCertificatePDF(winner, templateData) {
  const { template, backgroundBytes, fontBuffers } = templateData;
  const fields = template.fields_json || [];
  const pageWidth = template.page_width || 842;
  const pageHeight = template.page_height || 595;

  let pdfDoc;
  if (backgroundBytes) {
    // Load existing background PDF and overlay text
    pdfDoc = await PDFLib.load(backgroundBytes);
  } else {
    // Create blank document
    pdfDoc = await PDFLib.create();
    pdfDoc.addPage([pageWidth, pageHeight]);
  }

  // Register fontkit for custom font embedding
  pdfDoc.registerFontkit(fontkit);

  // Pre-embed fonts used by fields
  const embeddedFonts = {};
  for (const field of fields) {
    const fontName = field.fontFamily || 'Helvetica';
    if (!embeddedFonts[fontName]) {
      if (fontBuffers[fontName]) {
        embeddedFonts[fontName] = await pdfDoc.embedFont(fontBuffers[fontName]);
      } else {
        // Fall back to standard fonts
        const stdFont = StandardFonts[fontName] || StandardFonts.Helvetica;
        embeddedFonts[fontName] = await pdfDoc.embedFont(stdFont);
      }
    }
  }

  // Get first page
  const page = pdfDoc.getPages()[0];
  const { height: actualHeight } = page.getSize();

  // Draw each text field
  for (const field of fields) {
    const text = substitutePlaceholders(field.text || '', winner);
    const fontName = field.fontFamily || 'Helvetica';
    const font = embeddedFonts[fontName];
    const fontSize = field.fontSize || 24;
    const color = hexToRgb(field.color || '#000000');

    // Convert from top-left origin (editor) to bottom-left origin (PDF)
    const y = actualHeight - (field.y || 0) - fontSize;

    const drawOptions = {
      x: field.x || 0,
      y,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
    };

    // Handle alignment by measuring text width
    if (field.align === 'center') {
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const fieldWidth = field.width || pageWidth;
      drawOptions.x = (field.x || 0) + (fieldWidth - textWidth) / 2;
    } else if (field.align === 'right') {
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const fieldWidth = field.width || pageWidth;
      drawOptions.x = (field.x || 0) + fieldWidth - textWidth;
    }

    page.drawText(text, drawOptions);
  }

  return pdfDoc.save();
}

/**
 * Generate a certificate for a single winner using a template.
 * @param {string} winnerId - The winner ID.
 * @param {string} templateId - The certificate template ID.
 * @param {string} [format='pdf'] - Output format: 'pdf' or 'png'.
 * @returns {Promise<{publicUrl: string, filename: string}>} Certificate file details.
 */
// eslint-disable-next-line no-unused-vars
async function generateWinnerCertificate(winnerId, templateId, format = 'pdf') {
  console.log(`Generating certificate for winner ${winnerId}...`);

  // Get winner with award data
  const { data: winner, error } = await supabase
    .from('winners')
    .select('*, awards:award_years!winners_award_id_fkey(*)')
    .eq('id', winnerId)
    .single();

  if (error) throw new Error('Winner not found: ' + error.message);

  // Load template
  const templateData = await loadTemplate(templateId);

  // Render PDF
  const pdfBytes = await renderCertificatePDF(winner, templateData);

  const safeName = (winner.winner_name || 'winner').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `certificate-${safeName}-${winnerId.slice(0, 8)}.pdf`;

  // Upload PDF to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from('certificate-assets')
    .upload(`generated/${filename}`, Buffer.from(pdfBytes), {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('certificate-assets').getPublicUrl(`generated/${filename}`);

  // Update winner record with certificate URL
  await supabase.from('winners').update({ certificate_url: urlData.publicUrl }).eq('id', winnerId);

  return {
    publicUrl: urlData.publicUrl,
    filename,
  };
}

/**
 * Generate certificates for multiple winners using a template.
 * @param {string[]} winnerIds - Array of winner IDs.
 * @param {string} templateId - The certificate template ID.
 * @param {string} [format='pdf'] - Output format.
 * @returns {Promise<Array<{winnerId: string, success: boolean, url?: string, error?: string}>>} Results for each winner.
 */
// eslint-disable-next-line no-unused-vars
async function generateBulkCertificates(winnerIds, templateId, format = 'pdf') {
  console.log(`Generating certificates for ${winnerIds.length} winners...`);

  // Pre-load template once for all winners
  const templateData = await loadTemplate(templateId);

  const results = [];
  for (const winnerId of winnerIds) {
    try {
      const { data: winner, error } = await supabase
        .from('winners')
        .select('*, awards:award_years!winners_award_id_fkey(*)')
        .eq('id', winnerId)
        .single();

      if (error) throw error;

      const pdfBytes = await renderCertificatePDF(winner, templateData);

      const safeName = (winner.winner_name || 'winner').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `certificate-${safeName}-${winnerId.slice(0, 8)}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('certificate-assets')
        .upload(`generated/${filename}`, Buffer.from(pdfBytes), {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('certificate-assets').getPublicUrl(`generated/${filename}`);

      await supabase.from('winners').update({ certificate_url: urlData.publicUrl }).eq('id', winnerId);

      results.push({ winnerId, winnerName: winner.winner_name, success: true, url: urlData.publicUrl });
    } catch (err) {
      results.push({ winnerId, success: false, error: err.message });
    }
  }

  console.log(`Generated ${results.filter((r) => r.success).length}/${winnerIds.length} certificates`);
  return results;
}

/**
 * Preview a certificate with sample data (does not save).
 * @param {string} templateId - The template ID.
 * @param {Object} [sampleData] - Optional sample winner data for preview.
 * @returns {Promise<string>} Base64-encoded PDF.
 */
async function previewCertificate(templateId, sampleData) {
  const templateData = await loadTemplate(templateId);

  const sampleWinner = sampleData || {
    winner_name: 'Sample Winner Name',
    company_name: 'Sample Company Ltd',
    organisation_name: 'Sample Company Ltd',
    awards: {
      award_name: 'Best Innovation Award',
      award_category: 'Innovation',
      year: new Date().getFullYear(),
    },
  };

  const pdfBytes = await renderCertificatePDF(sampleWinner, templateData);
  return Buffer.from(pdfBytes).toString('base64');
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
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function verifyQRCode(qrData) {
  try {
    const data = JSON.parse(qrData);

    if (!data.id || !UUID_PATTERN.test(data.id)) {
      return { valid: false, message: 'Invalid QR code format' };
    }

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
      error: 'QR verification error',
    };
  }
}

/**
 * API endpoint to generate a single winner certificate.
 */
async function generateCertificateEndpoint(req, res) {
  try {
    const { winnerId, templateId, format } = req.body;
    if (!winnerId || !templateId) {
      return res.status(400).json({ error: 'winnerId and templateId are required' });
    }
    const result = await generateWinnerCertificate(winnerId, templateId, format);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * API endpoint to generate certificates for multiple winners.
 */
async function generateBulkCertificatesEndpoint(req, res) {
  try {
    const { winnerIds, templateId, format } = req.body;
    if (!winnerIds?.length || !templateId) {
      return res.status(400).json({ error: 'winnerIds array and templateId are required' });
    }
    const results = await generateBulkCertificates(winnerIds, templateId, format);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * API endpoint to preview a certificate with sample data.
 */
async function previewCertificateEndpoint(req, res) {
  try {
    const { templateId, sampleData } = req.body;
    if (!templateId) {
      return res.status(400).json({ error: 'templateId is required' });
    }
    const base64Pdf = await previewCertificate(templateId, sampleData);
    res.json({ success: true, pdfBase64: base64Pdf });
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
 * API endpoint to generate badges for all confirmed attendees of an event.
 * POST /api/certificates-qr?action=generate-all-badges
 * @param {Object} req - Express request object with body.eventId.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
async function generateAllBadgesEndpoint(req, res) {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required' });
    }
    const results = await generateAllEventBadges(eventId);
    res.json({ success: true, results });
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
    case 'generate-bulk-certificates':
      return generateBulkCertificatesEndpoint(req, res);
    case 'preview-certificate':
      return previewCertificateEndpoint(req, res);
    case 'generate-qr-ticket':
      return generateQRTicketEndpoint(req, res);
    case 'generate-badge':
      return generateBadgeEndpoint(req, res);
    case 'verify-qr':
      return verifyQREndpoint(req, res);
    case 'generate-all-badges':
      return generateAllBadgesEndpoint(req, res);
    case 'generate-and-email':
    case 'generate_and_email': {
      const { winner_id, template_id } = req.body;
      if (!winner_id) return res.status(400).json({ error: 'Missing winner_id' });
      try {
        const cert = await generateWinnerCertificate(winner_id, template_id);
        // Look up winner email from organisations join
        const { data: winnerRow } = await supabase
          .from('winners')
          .select('winner_name, organisations(company_name, email)')
          .eq('id', winner_id)
          .single();
        const recipientEmail = winnerRow?.organisations?.email;
        if (recipientEmail) {
          const appUrl = process.env.APP_URL || '';
          await fetch(`${appUrl}/api/email-automation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'sendTemplate',
              templateKey: 'WINNER_ANNOUNCEMENT',
              toEmail: recipientEmail,
              variables: {
                company_name: winnerRow?.organisations?.company_name || '',
                certificate_url: cert.publicUrl,
              },
            }),
          });
        } else {
          console.warn(`[certificates-qr] generate_and_email: no recipient email for winner ${winner_id}`);
        }
        await supabase.from('winners').update({ certificate_sent_at: new Date().toISOString() }).eq('id', winner_id);
        return res.json({ success: true, certificate_url: cert.publicUrl });
      } catch (err) {
        console.error('[certificates-qr] generate_and_email error:', err.message);
        return res.status(500).json({ error: 'Certificate generation failed' });
      }
    }
    default:
      return res.status(400).json({
        error:
          'Invalid action. Use: generate-certificate, generate-bulk-certificates, preview-certificate, generate-qr-ticket, generate-badge, generate-all-badges, verify-qr, generate_and_email',
      });
  }
};

module.exports.generateWinnerCertificate = generateWinnerCertificate;
module.exports.generateBulkCertificates = generateBulkCertificates;
module.exports.previewCertificate = previewCertificate;
module.exports.renderCertificatePDF = renderCertificatePDF;
module.exports.hexToRgb = hexToRgb;
module.exports.substitutePlaceholders = substitutePlaceholders;
module.exports.generateEventTicketQR = generateEventTicketQR;
module.exports.generateEventBadge = generateEventBadge;
module.exports.generateAllEventBadges = generateAllEventBadges;
module.exports.verifyQRCode = verifyQRCode;
module.exports.generateCertificateEndpoint = generateCertificateEndpoint;
module.exports.generateBulkCertificatesEndpoint = generateBulkCertificatesEndpoint;
module.exports.previewCertificateEndpoint = previewCertificateEndpoint;
module.exports.generateQRTicketEndpoint = generateQRTicketEndpoint;
module.exports.generateBadgeEndpoint = generateBadgeEndpoint;
module.exports.verifyQREndpoint = verifyQREndpoint;
module.exports.generateAllBadgesEndpoint = generateAllBadgesEndpoint;
