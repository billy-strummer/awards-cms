// Supabase Edge Function: Send Entry Confirmation Email
// This function is triggered when a new entry is submitted

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the entry data from the request
    const { entryId } = await req.json()

    if (!entryId) {
      throw new Error('Entry ID is required')
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch entry with related data
    const { data: entry, error: entryError } = await supabaseClient
      .from('entries')
      .select(`
        *,
        organisations(company_name, website, sector, region)
      `)
      .eq('id', entryId)
      .single()

    if (entryError) throw entryError
    if (!entry) throw new Error('Entry not found')

    // Try to get linked award data if award_id exists
    let awardData = null
    if (entry.award_id) {
      const { data: award } = await supabaseClient
        .from('awards')
        .select('award_name, sector, county')
        .eq('id', entry.award_id)
        .single()
      awardData = award
    }

    // Fetch the active confirmation email template
    const { data: template } = await supabaseClient
      .from('email_templates')
      .select('*')
      .eq('template_type', 'confirmation')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .single()

    // Build fallback template if none found in database
    const emailTemplate = template || {
      subject: 'British Trade Awards - Entry Received ({ENTRY_NUMBER})',
      body: `Dear {CONTACT_NAME},

Thank you for submitting your entry to the British Trade Awards!

Entry Details:
- Entry Number: {ENTRY_NUMBER}
- Company: {COMPANY_NAME}
- Award Category: {AWARD_NAME}
- Sector: {SECTOR}
- Region: {REGION}

What happens next:
Your entry will be reviewed by our judging panel. We will be in touch with further details.

If you have any questions, please contact us at {CONTACT_EMAIL}

Best regards,
The British Trade Awards Team`,
      id: null
    }

    // Extract award category from entry_title (format: "Company - Category")
    const categoryFromTitle = entry.entry_title ? entry.entry_title.split(' - ').slice(1).join(' - ') : ''

    // Prepare placeholder data — use award data if linked, fall back to org/entry data
    const uploadLink = `${Deno.env.get('PUBLIC_SITE_URL') || ''}/upload-documents.html?entry=${entry.entry_number}`

    const placeholderData = {
      ENTRY_NUMBER: entry.entry_number || '',
      CONTACT_NAME: entry.contact_name || '',
      COMPANY_NAME: entry.organisations?.company_name || '',
      AWARD_NAME: awardData?.award_name || categoryFromTitle || '',
      SECTOR: awardData?.sector || entry.organisations?.sector || '',
      REGION: awardData?.county || entry.organisations?.region || '',
      UPLOAD_LINK: uploadLink,
      DEADLINE_DATE: Deno.env.get('ENTRY_DEADLINE_DATE') || 'TBA',
      ANNOUNCEMENT_DATE: Deno.env.get('WINNER_ANNOUNCEMENT_DATE') || 'TBA',
      CONTACT_EMAIL: Deno.env.get('CONTACT_EMAIL') || 'awards@britishtrade.org'
    }

    // Replace placeholders in subject and body
    let emailSubject = emailTemplate.subject
    let emailBody = emailTemplate.body

    Object.entries(placeholderData).forEach(([key, value]) => {
      const placeholder = `{${key}}`
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      emailSubject = emailSubject.replace(regex, value)
      emailBody = emailBody.replace(regex, value)
    })

    // Send email using Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: Deno.env.get('FROM_EMAIL') || 'British Trade Awards <awards@britishtrade.org>',
        to: [entry.contact_email],
        subject: emailSubject,
        text: emailBody,
        // Optional: Add HTML version
        // html: emailBody.replace(/\n/g, '<br>')
      }),
    })

    const emailResult = await emailResponse.json()

    if (!emailResponse.ok) {
      throw new Error(`Email send failed: ${JSON.stringify(emailResult)}`)
    }

    console.log('Email sent successfully:', emailResult)

    // Log the email in database
    await supabaseClient
      .from('email_log')
      .insert({
        recipient_email: entry.contact_email,
        template_id: emailTemplate.id || null,
        subject: emailSubject,
        status: 'sent'
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        emailId: emailResult.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error sending email:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
