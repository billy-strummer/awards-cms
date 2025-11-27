# Email Automation Setup Guide

This guide will help you set up automatic confirmation emails when entries are submitted.

## Overview

When someone submits an entry:
1. Entry is saved to database
2. Edge function is triggered
3. Function fetches email template from CMS
4. Placeholders are replaced with actual data
5. Email is sent via Resend
6. Email is logged in database

## Prerequisites

- Supabase project (you already have this)
- Resend account (free tier is fine - 100 emails/day, 3,000/month)
- Supabase CLI installed (optional, for deployment)

---

## Step 1: Set Up Resend Email Service

### 1.1 Create Resend Account
1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email

### 1.2 Add Your Domain (Recommended) OR Use Test Email
**Option A: Use your own domain (Recommended for production)**
1. Go to Domains in Resend dashboard
2. Add your domain (e.g., `britishtrade.org`)
3. Add the DNS records they provide to your domain
4. Wait for verification (usually takes a few minutes)

**Option B: Use Resend's test domain (For testing only)**
- You can send to your own email for testing
- Use `onboarding@resend.dev` as the from address

### 1.3 Generate API Key
1. Go to API Keys in Resend dashboard
2. Click "Create API Key"
3. Name it "British Trade Awards CMS"
4. Copy the API key (starts with `re_...`)
5. **Save this key** - you'll need it in Step 3

---

## Step 2: Run Database Migrations

### 2.1 Create Email Templates Table
1. Go to your Supabase Dashboard
2. Click **SQL Editor** in the left menu
3. Run the contents of `email-templates-schema.sql`

### 2.2 Create Email Logs Table
1. In SQL Editor
2. Run the contents of `migrations/email-automation.sql`

### 2.3 Add Missing Column (if not already done)
1. In SQL Editor
2. Run:
```sql
ALTER TABLE entries
ADD COLUMN IF NOT EXISTS is_self_nomination BOOLEAN DEFAULT false;
```

---

## Step 3: Configure Supabase Edge Function

### 3.1 Set Environment Variables in Supabase

1. Go to your Supabase Dashboard
2. Click **Edge Functions** in the left menu
3. Click **Manage secrets**
4. Add these secrets:

| Secret Name | Value | Example |
|------------|-------|---------|
| `RESEND_API_KEY` | Your Resend API key | `re_123abc...` |
| `FROM_EMAIL` | Your sending email | `British Trade Awards <awards@britishtrade.org>` |
| `PUBLIC_SITE_URL` | Your website URL | `https://britishtrade.org` |
| `CONTACT_EMAIL` | Your contact email | `awards@britishtrade.org` |
| `ENTRY_DEADLINE_DATE` | Entry deadline | `31st December 2025` |
| `WINNER_ANNOUNCEMENT_DATE` | Winner announcement | `15th February 2026` |

### 3.2 Deploy the Edge Function

**Option A: Using Supabase Dashboard (Easiest)**
1. Go to **Edge Functions** in Supabase Dashboard
2. Click **Create Function**
3. Name it: `send-entry-confirmation`
4. Copy the contents of `supabase/functions/send-entry-confirmation/index.ts`
5. Paste into the editor
6. Click **Deploy**

**Option B: Using Supabase CLI**
```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy send-entry-confirmation
```

---

## Step 4: Update Your Entry Submission Form

We need to call the edge function after an entry is submitted.

### 4.1 Modify `submit-entry.js`

Find the `submitEntry()` function and add the email trigger after the entry is saved:

```javascript
async submitEntry() {
  try {
    // ... existing entry submission code ...

    // After successful entry submission:
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert([entryData])
      .select()
      .single();

    if (entryError) throw entryError;

    // ✨ NEW: Send confirmation email
    try {
      const { data, error: emailError } = await supabase.functions.invoke(
        'send-entry-confirmation',
        {
          body: { entryId: entry.id }
        }
      );

      if (emailError) {
        console.error('Email send failed:', emailError);
        // Don't block the submission if email fails
      } else {
        console.log('Confirmation email sent:', data);
      }
    } catch (emailError) {
      console.error('Email error:', emailError);
      // Email failure doesn't affect the entry submission
    }

    // ... rest of success handling ...
  } catch (error) {
    // ... error handling ...
  }
}
```

---

## Step 5: Test the Email System

### 5.1 Submit a Test Entry
1. Go to your entry form: `yourdomain.com/submit-entry.html`
2. Fill out the form with your email address
3. Submit the entry

### 5.2 Check if Email Was Sent

**Check Resend Dashboard:**
1. Go to Resend dashboard
2. Click **Emails** to see sent emails
3. You should see your confirmation email

**Check Supabase Logs:**
1. Go to Supabase Dashboard → Edge Functions
2. Click on `send-entry-confirmation`
3. Click **Logs** tab
4. You should see the function execution

**Check Email Logs Table:**
```sql
SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 10;
```

### 5.3 Check Your Inbox
- You should receive the confirmation email with:
  - Your entry number
  - Company details
  - Upload link
  - All other information from the template

---

## Step 6: Customize Email Template

1. Login to your CMS
2. Go to **Email Templates** tab
3. Click on "Entry Confirmation"
4. Edit the text as needed
5. Click **Preview** to see it with sample data
6. Click **Save Template**

The next time someone submits an entry, it will use your updated template!

---

## Troubleshooting

### Email Not Sending

**Check Edge Function Logs:**
1. Supabase Dashboard → Edge Functions → send-entry-confirmation → Logs
2. Look for errors

**Common Issues:**

| Issue | Solution |
|-------|----------|
| "RESEND_API_KEY not configured" | Add the API key in Edge Functions secrets |
| "Email template not found" | Run the email-templates-schema.sql migration |
| "Failed to send email" | Check Resend dashboard for details |
| "Invalid from address" | Verify your domain in Resend or use test address |

### Test the Edge Function Directly

You can test the function directly from Supabase Dashboard:

1. Go to Edge Functions → send-entry-confirmation
2. Click **Invoke Function**
3. Use this test payload:
```json
{
  "entryId": "your-entry-id-here"
}
```

---

## Email Template Placeholders

These placeholders are automatically replaced:

- `{ENTRY_NUMBER}` - Entry reference number
- `{CONTACT_NAME}` - Entrant's name
- `{COMPANY_NAME}` - Company name
- `{AWARD_NAME}` - Award category
- `{SECTOR}` - Business sector
- `{REGION}` - Geographic region
- `{UPLOAD_LINK}` - Document upload link (most important!)
- `{DEADLINE_DATE}` - Entry deadline
- `{ANNOUNCEMENT_DATE}` - Winner announcement date
- `{CONTACT_EMAIL}` - Your contact email

---

## Production Checklist

Before going live:

- [ ] Set up custom domain in Resend
- [ ] Update `FROM_EMAIL` to use your domain
- [ ] Test with multiple email addresses
- [ ] Customize email template in CMS
- [ ] Set correct `PUBLIC_SITE_URL` environment variable
- [ ] Set correct deadline and announcement dates
- [ ] Test the upload link in the email
- [ ] Check spam folder and adjust if needed

---

## Alternative: Manual Email Sending

If you prefer to send emails manually:

1. Don't deploy the edge function
2. When an entry comes in, view it in CMS
3. Click "View Upload Link" button
4. Copy the link
5. Send it manually via your email client

The Email Templates tab still helps you manage the email copy!

---

## Support

If you run into issues:
1. Check Supabase Edge Function logs
2. Check Resend dashboard for email delivery status
3. Check browser console for errors
4. Verify all environment variables are set correctly

---

## Cost

**Resend Free Tier:**
- 3,000 emails per month
- 100 emails per day
- Free forever

If you need more:
- Pro plan: $20/month for 50,000 emails
