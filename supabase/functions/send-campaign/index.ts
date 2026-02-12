// Supabase Edge Function: Send Email Campaign
// Supports two modes:
//   - test: send a single test email
//   - campaign: send to all active subscribers on a list

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { mode, to, listId, subject, html, fromName, campaignName } = await req.json()

    if (!subject || !html) {
      throw new Error('Subject and HTML content are required')
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const fromEmail = Deno.env.get('FROM_EMAIL') || 'awards@britishtrade.org'
    const from = `${fromName || 'British Trade Awards'} <${fromEmail}>`

    // Test mode: send to a single address
    if (mode === 'test') {
      if (!to) throw new Error('Recipient email is required for test mode')

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({ from, to: [to], subject: `[TEST] ${subject}`, html }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(`Email send failed: ${JSON.stringify(result)}`)

      return new Response(
        JSON.stringify({ success: true, sent: 1, emailId: result.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Campaign mode: send to all active subscribers on a list
    if (mode === 'campaign') {
      if (!listId) throw new Error('List ID is required for campaign mode')

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Fetch active subscribers
      const { data: subscribers, error: subError } = await supabase
        .from('email_list_subscribers')
        .select('email, first_name, last_name, company_name')
        .eq('list_id', listId)
        .eq('status', 'active')

      if (subError) throw subError
      if (!subscribers || subscribers.length === 0) {
        throw new Error('No active subscribers found on this list')
      }

      let sent = 0
      let failed = 0
      const errors: string[] = []

      // Send in batches of 10 to stay within rate limits
      const batchSize = 10
      for (let i = 0; i < subscribers.length; i += batchSize) {
        const batch = subscribers.slice(i, i + batchSize)

        const promises = batch.map(async (sub) => {
          try {
            // Personalise the HTML with subscriber data
            let personalHtml = html
              .replace(/\{\{contact_name\}\}/g, [sub.first_name, sub.last_name].filter(Boolean).join(' ') || 'there')
              .replace(/\{\{first_name\}\}/g, sub.first_name || '')
              .replace(/\{\{last_name\}\}/g, sub.last_name || '')
              .replace(/\{\{company_name\}\}/g, sub.company_name || '')
              .replace(/\{\{email\}\}/g, sub.email)

            let personalSubject = subject
              .replace(/\{\{contact_name\}\}/g, [sub.first_name, sub.last_name].filter(Boolean).join(' ') || 'there')
              .replace(/\{\{first_name\}\}/g, sub.first_name || '')
              .replace(/\{\{company_name\}\}/g, sub.company_name || '')

            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({ from, to: [sub.email], subject: personalSubject, html: personalHtml }),
            })

            if (response.ok) {
              sent++
              // Increment emails_received counter
              await supabase
                .from('email_list_subscribers')
                .update({ emails_received: (sub as any).emails_received ? (sub as any).emails_received + 1 : 1 })
                .eq('email', sub.email)
                .eq('list_id', listId)
            } else {
              const err = await response.json()
              failed++
              errors.push(`${sub.email}: ${JSON.stringify(err)}`)
            }
          } catch (e) {
            failed++
            errors.push(`${sub.email}: ${e.message}`)
          }
        })

        await Promise.all(promises)

        // Small delay between batches to respect rate limits
        if (i + batchSize < subscribers.length) {
          await new Promise(r => setTimeout(r, 200))
        }
      }

      // Log the campaign
      await supabase.from('email_log').insert({
        template_key: 'CAMPAIGN',
        recipient_email: `list:${listId} (${subscribers.length} subscribers)`,
        subject: campaignName || subject,
        status: failed === 0 ? 'sent' : 'partial',
        sent_at: new Date().toISOString(),
        error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null
      })

      return new Response(
        JSON.stringify({ success: true, sent, failed, total: subscribers.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    throw new Error('Invalid mode. Use "test" or "campaign".')

  } catch (error) {
    console.error('Error in send-campaign:', error)

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
