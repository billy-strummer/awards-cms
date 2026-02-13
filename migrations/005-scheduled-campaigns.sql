-- Migration: Scheduled Campaign Processing
-- Adds a function to process scheduled campaigns that are due to be sent

-- Function to process scheduled campaigns
CREATE OR REPLACE FUNCTION process_scheduled_campaigns()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  campaign RECORD;
  result jsonb := '[]'::jsonb;
  send_result jsonb;
  campaign_notes jsonb;
BEGIN
  -- Find all scheduled campaigns that are due
  FOR campaign IN
    SELECT * FROM email_campaigns
    WHERE status = 'Scheduled'
      AND scheduled_date <= NOW()
    ORDER BY scheduled_date ASC
  LOOP
    BEGIN
      -- Parse the stored campaign data from notes
      campaign_notes := campaign.notes::jsonb;

      -- Mark as sending
      UPDATE email_campaigns
      SET status = 'Sending', updated_at = NOW()
      WHERE id = campaign.id;

      -- Call the existing send_campaign_emails function
      SELECT send_campaign_emails(
        p_list_id := (campaign_notes->>'list_id')::uuid,
        p_subject := campaign.subject,
        p_html := campaign_notes->>'html',
        p_from_name := campaign_notes->>'from_name',
        p_from_email := campaign_notes->>'from_email',
        p_reply_to := campaign_notes->>'reply_to',
        p_campaign_name := campaign.campaign_name
      ) INTO send_result;

      -- Update campaign as sent
      UPDATE email_campaigns
      SET status = 'Sent',
          sent_date = NOW(),
          updated_at = NOW()
      WHERE id = campaign.id;

      result := result || jsonb_build_object(
        'campaign_id', campaign.id,
        'campaign_name', campaign.campaign_name,
        'status', 'sent'
      );

    EXCEPTION WHEN OTHERS THEN
      -- Mark as failed if error occurs
      UPDATE email_campaigns
      SET status = 'Failed',
          notes = jsonb_set(
            COALESCE(campaign.notes::jsonb, '{}'::jsonb),
            '{error}',
            to_jsonb(SQLERRM)
          )::text,
          updated_at = NOW()
      WHERE id = campaign.id;

      result := result || jsonb_build_object(
        'campaign_id', campaign.id,
        'campaign_name', campaign.campaign_name,
        'status', 'failed',
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object('processed', jsonb_array_length(result), 'campaigns', result);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_scheduled_campaigns() TO authenticated;
GRANT EXECUTE ON FUNCTION process_scheduled_campaigns() TO service_role;

-- Optional: Create a pg_cron job to check for scheduled campaigns every minute
-- (Requires pg_cron extension to be enabled in Supabase dashboard)
-- SELECT cron.schedule('process-scheduled-emails', '* * * * *', 'SELECT process_scheduled_campaigns()');
