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
        organisations(company_name, website),
        awards(award_name, sector, county)
      `)
      .eq('id', entryId)
      .single()

    if (entryError) throw entryError
    if (!entry) throw new Error('Entry not found')

    // Fetch the active confirmation email template
    const { data: template, error: templateError } = await supabaseClient
      .from('email_templates')
      .select('*')
      .eq('template_type', 'confirmation')
      .eq('is_active', true)
      .eq('is_default', true)
      .single()

    if (templateError || !template) {
      console.error('Email template not found, using default')
      // Fallback to basic template if none found in database
      throw new Error('No active confirmation email template found')
    }

    // Prepare placeholder data
    const uploadLink = `${Deno.env.get('PUBLIC_SITE_URL')}/upload-documents.html?entry=${entry.entry_number}`

    const placeholderData = {
      ENTRY_NUMBER: entry.entry_number,
      CONTACT_NAME: entry.contact_name,
      COMPANY_NAME: entry.organisations?.company_name || 'Your Company',
      AWARD_NAME: entry.awards?.award_name || 'Award Category',
      SECTOR: entry.awards?.sector || 'Your Sector',
      REGION: entry.awards?.county || 'Your Region',
      UPLOAD_LINK: uploadLink,
      DEADLINE_DATE: Deno.env.get('ENTRY_DEADLINE_DATE') || 'TBA',
      ANNOUNCEMENT_DATE: Deno.env.get('WINNER_ANNOUNCEMENT_DATE') || 'TBA',
      CONTACT_EMAIL: Deno.env.get('CONTACT_EMAIL') || 'awards@britishtrade.org'
    }

    // Replace placeholders in subject and body
    let emailSubject = template.subject
    let emailBody = template.body

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

    // Log the email in database (optional)
    await supabaseClient
      .from('email_log')
      .insert({
        recipient_email: entry.contact_email,
        template_id: template.id,
        template_key: 'ENTRY_CONFIRMATION',
        subject: emailSubject,
        sent_at: new Date().toISOString(),
        status: 'sent'
      })
      .select()

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
