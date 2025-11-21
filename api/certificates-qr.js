/**
 * Certificate Generation & QR Code System
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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Generate Winner Certificate
 */
async function generateWinnerCertificate(entryId, outputPath = null) {
  try {
    console.log(`📜 Generating certificate for entry ${entryId}...`);

    // Get entry and winner details
    const { data: entry, error } = await supabase
      .from('entries')
      .select('*, organisations(*), awards(*)')
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
      margin: 50
    });

    // Set output
    const filename = `certificate-${entry.entry_number}.pdf`;
    const filepath = outputPath || path.join(__dirname, '../certificates', filename);

    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // Add border
    doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80)
       .lineWidth(3)
       .strokeColor('#FFD700')
       .stroke();

    doc.rect(50, 50, doc.page.width - 100, doc.page.height - 100)
       .lineWidth(1)
       .strokeColor('#FFD700')
       .stroke();

    // Add logo (if available)
    // doc.image('path/to/logo.png', 350, 70, { width: 100 });

    // Title
    doc.fontSize(48)
       .font('Helvetica-Bold')
       .fillColor('#1a1a1a')
       .text('CERTIFICATE', 0, 120, { align: 'center' });

    doc.fontSize(20)
       .font('Helvetica')
       .fillColor('#666')
       .text('OF EXCELLENCE', 0, 180, { align: 'center' });

    // Presented to
    doc.fontSize(14)
       .fillColor('#999')
       .text('This certificate is proudly presented to', 0, 250, { align: 'center' });

    // Company name
    doc.fontSize(36)
       .font('Helvetica-Bold')
       .fillColor('#1a1a1a')
       .text(entry.organisations.company_name, 0, 290, { align: 'center' });

    // Award details
    doc.fontSize(18)
       .font('Helvetica')
       .fillColor('#444')
       .text('For winning the', 0, 350, { align: 'center' });

    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#FFD700')
       .text(entry.awards.award_name, 0, 380, { align: 'center' });

    doc.fontSize(16)
       .font('Helvetica')
       .fillColor('#444')
       .text('at the British Trade Awards 2025', 0, 420, { align: 'center' });

    // Date
    const awardDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    doc.fontSize(12)
       .fillColor('#666')
       .text(awardDate, 0, 480, { align: 'center' });

    // Signature line
    doc.moveTo(250, 530)
       .lineTo(550, 530)
       .stroke();

    doc.fontSize(10)
       .text('Chief Executive Officer', 0, 540, { align: 'center' });

    // Certificate ID
    doc.fontSize(8)
       .fillColor('#999')
       .text(`Certificate ID: ${entry.entry_number}`, 0, doc.page.height - 80, { align: 'center' });

    // Trophy icon (text-based)
    doc.fontSize(48)
       .text('🏆', 0, 70, { align: 'center' });

    // Finalize PDF
    doc.end();

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    console.log(`✅ Certificate generated: ${filepath}`);

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(filename, fs.readFileSync(filepath), {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('certificates')
      .getPublicUrl(filename);

    // Update entry with certificate URL
    await supabase
      .from('entries')
      .update({
        certificate_url: urlData.publicUrl
      })
      .eq('id', entryId);

    return {
      filepath,
      publicUrl: urlData.publicUrl,
      filename
    };

  } catch (error) {
    console.error('Error generating certificate:', error);
    throw error;
  }
}

/**
 * Generate certificates for all winners
 */
async function generateAllWinnerCertificates() {
  try {
    console.log('📜 Generating certificates for all winners...');

    const { data: winners, error } = await supabase
      .from('entries')
      .select('id, entry_number, organisations(company_name), awards(award_name)')
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
          url: result.publicUrl
        });
        console.log(`✅ ${winner.entry_number}: ${winner.organisations.company_name}`);
      } catch (err) {
        console.error(`❌ ${winner.entry_number}: ${err.message}`);
        results.push({
          entryId: winner.id,
          entryNumber: winner.entry_number,
          success: false,
          error: err.message
        });
      }
    }

    console.log(`\n✅ Generated ${results.filter(r => r.success).length}/${winners.length} certificates`);
    return results;

  } catch (error) {
    console.error('Error generating all certificates:', error);
    throw error;
  }
}

/**
 * Generate QR Code for event ticket
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
      timestamp: new Date().toISOString()
    });

    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Save QR code to storage
    const filename = `qr-ticket-${attendee.id}.png`;
    const buffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('qr-codes')
      .upload(filename, buffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('qr-codes')
      .getPublicUrl(filename);

    // Update attendee with QR code URL
    await supabase
      .from('event_attendees')
      .update({
        qr_code_url: urlData.publicUrl
      })
      .eq('id', attendeeId);

    console.log(`✅ QR code generated for ${attendee.contacts?.full_name || attendee.attendee_name}`);

    return {
      qrCodeUrl: urlData.publicUrl,
      qrCodeDataURL,
      filename
    };

  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

/**
 * Generate event badge with QR code
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
      margin: 20
    });

    const filename = `badge-${attendee.id}.pdf`;
    const filepath = path.join(__dirname, '../badges', filename);

    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height)
       .fill('#f8f9fa');

    // Header
    doc.rect(0, 0, doc.page.width, 80)
       .fill('#667eea');

    // Event name
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#FFFFFF')
       .text('British Trade Awards', 0, 25, { align: 'center' });

    doc.fontSize(10)
       .font('Helvetica')
       .text('2025', 0, 45, { align: 'center' });

    // Attendee name
    doc.fontSize(22)
       .font('Helvetica-Bold')
       .fillColor('#1a1a1a')
       .text(attendee.contacts?.full_name || attendee.attendee_name, 20, 100, {
         align: 'center',
         width: doc.page.width - 40
       });

    // Company
    if (attendee.organisations?.company_name) {
      doc.fontSize(14)
         .font('Helvetica')
         .fillColor('#666')
         .text(attendee.organisations.company_name, 20, 140, {
           align: 'center',
           width: doc.page.width - 40
         });
    }

    // Table number
    if (attendee.table_number) {
      doc.fontSize(12)
         .fillColor('#444')
         .text(`Table ${attendee.table_number}`, 20, 170, {
           align: 'center',
           width: doc.page.width - 40
         });
    }

    // QR Code
    const qrBuffer = Buffer.from(qrResult.qrCodeDataURL.split(',')[1], 'base64');
    doc.image(qrBuffer, (doc.page.width - 120) / 2, 200, { width: 120 });

    // Footer
    doc.fontSize(8)
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
      qrCodeUrl: qrResult.qrCodeUrl
    };

  } catch (error) {
    console.error('Error generating badge:', error);
    throw error;
  }
}

/**
 * Generate badges for all event attendees
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
          filepath: result.filepath
        });
        console.log(`✅ ${attendee.contacts?.full_name || attendee.attendee_name}`);
      } catch (err) {
        console.error(`❌ ${attendee.contacts?.full_name || attendee.attendee_name}: ${err.message}`);
        results.push({
          attendeeId: attendee.id,
          name: attendee.contacts?.full_name || attendee.attendee_name,
          success: false,
          error: err.message
        });
      }
    }

    console.log(`\n✅ Generated ${results.filter(r => r.success).length}/${attendees.length} badges`);
    return results;

  } catch (error) {
    console.error('Error generating all badges:', error);
    throw error;
  }
}

/**
 * Verify QR code at event check-in
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
        message: 'Attendee not found'
      };
    }

    if (attendee.checked_in) {
      return {
        valid: false,
        message: 'Already checked in',
        attendee
      };
    }

    // Mark as checked in
    await supabase
      .from('event_attendees')
      .update({
        checked_in: true,
        check_in_time: new Date().toISOString()
      })
      .eq('id', data.id);

    return {
      valid: true,
      message: 'Check-in successful',
      attendee
    };

  } catch (error) {
    return {
      valid: false,
      message: 'Invalid QR code',
      error: error.message
    };
  }
}

/**
 * API Endpoints
 */

// POST /api/generate-certificate
async function generateCertificateEndpoint(req, res) {
  try {
    const { entryId } = req.body;
    const result = await generateWinnerCertificate(entryId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/generate-all-certificates
async function generateAllCertificatesEndpoint(req, res) {
  try {
    const results = await generateAllWinnerCertificates();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/generate-qr-ticket
async function generateQRTicketEndpoint(req, res) {
  try {
    const { attendeeId } = req.body;
    const result = await generateEventTicketQR(attendeeId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/generate-badge
async function generateBadgeEndpoint(req, res) {
  try {
    const { attendeeId } = req.body;
    const result = await generateEventBadge(attendeeId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// POST /api/verify-qr
async function verifyQREndpoint(req, res) {
  try {
    const { qrData } = req.body;
    const result = await verifyQRCode(qrData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  generateWinnerCertificate,
  generateAllWinnerCertificates,
  generateEventTicketQR,
  generateEventBadge,
  generateAllEventBadges,
  verifyQRCode,
  generateCertificateEndpoint,
  generateAllCertificatesEndpoint,
  generateQRTicketEndpoint,
  generateBadgeEndpoint,
  verifyQREndpoint
};
