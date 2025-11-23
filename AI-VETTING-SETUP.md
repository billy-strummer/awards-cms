# AI Vetting Setup Guide

## Overview
The AI Company Vetting feature uses Claude API (Anthropic) to automatically vet all companies/nominees in your awards system. It checks for:

- ✅ Company still operational
- ✅ Sector/category matches actual business
- ⭐ Company reputation (1-10 rating)
- 📰 Recent news about the company
- 🔄 Ownership or significant business changes

## Setup Instructions

### 1. Create Database Tables

Run the SQL setup file in your Supabase SQL editor:

```bash
# File: database-ai-vetting-setup.sql
```

This creates two tables:
- `ai_vetting_results` - Stores individual company vetting results
- `ai_vetting_runs` - Tracks vetting run history

### 2. Get Claude API Key

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

**Cost Estimate:** ~$0.01-0.03 per company vetted

### 3. Configure API Key

**In Browser Console:**
```javascript
localStorage.setItem('claude_api_key', 'your-api-key-here');
```

**Or add a Settings UI** (recommended):
Add this to your Settings tab in `index.html`:

```html
<div class="mb-3">
  <label for="claudeApiKey" class="form-label">Claude API Key</label>
  <input type="password" class="form-control" id="claudeApiKey"
         placeholder="sk-ant-...">
  <button class="btn btn-primary mt-2" onclick="saveClaudeApiKey()">
    Save API Key
  </button>
</div>

<script>
function saveClaudeApiKey() {
  const key = document.getElementById('claudeApiKey').value;
  if (key) {
    localStorage.setItem('claude_api_key', key);
    alert('API key saved!');
  }
}
</script>
```

### 4. Run First Vetting

1. Go to Dashboard
2. Click on "AI Vetting" card
3. Click "Run AI Vetting" button
4. Wait for vetting to complete (shows progress)

## Features

### Dashboard Card
- Shows number of flagged companies
- Displays last vetting run time
- Click to open full modal

### Vetting Modal

**Progress Section** (during vetting):
- Real-time progress bar
- Current company being vetted
- Estimated completion

**Results Section**:
- Summary cards (Verified, Flagged, Total)
- Filter tabs (All, Flagged, Verified)
- Detailed table with:
  - Operational status
  - Category match
  - Reputation stars
  - AI findings
  - Actions (View, Dismiss)

**Actions**:
- Run vetting manually
- Export results to CSV
- View detailed findings
- Dismiss false positives

## How It Works

1. **Fetches all companies** from `organisations` table
2. **For each company**, sends request to Claude API with:
   - Company name
   - Sector/region
   - Vetting checklist
3. **Claude analyzes** using real-time knowledge:
   - Business search results
   - Recent news
   - Company information
4. **Returns structured data**:
   ```json
   {
     "is_operational": true/false,
     "category_match": true/false,
     "reputation_score": 1-10,
     "recent_news": "summary",
     "ownership_changes": "summary",
     "recommendation": "action needed",
     "confidence_score": 0.8
   }
   ```
5. **Saves to database** with timestamp
6. **Flags issues** if:
   - Not operational
   - Category mismatch
   - Reputation < 5/10

## Automatic Daily Vetting

### Option 1: Browser Extension (Simple)
Use a browser extension like "Auto Refresh" to reload the page daily and trigger vetting.

### Option 2: Supabase Edge Function (Recommended)

Create a Supabase Edge Function:

```typescript
// supabase/functions/daily-vetting/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // Call your app's vetting endpoint
  const response = await fetch('https://your-app.com/api/run-vetting', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

Set up a cron job in Supabase:
```sql
SELECT cron.schedule(
  'daily-ai-vetting',
  '0 2 * * *', -- Run at 2 AM daily
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/daily-vetting',
    headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  )
  $$
);
```

### Option 3: GitHub Actions (Alternative)

Create `.github/workflows/daily-vetting.yml`:

```yaml
name: Daily AI Vetting
on:
  schedule:
    - cron: '0 2 * * *' # 2 AM daily
  workflow_dispatch: # Manual trigger

jobs:
  run-vetting:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Vetting
        run: |
          curl -X POST https://your-app.com/api/run-vetting \
            -H "Authorization: Bearer ${{ secrets.API_TOKEN }}"
```

## Database Schema

### ai_vetting_results
- `id` - UUID
- `organisation_id` - FK to organisations
- `company_name` - Company name
- `sector` - Business sector
- `vetting_date` - When vetted
- `is_operational` - Still in business?
- `category_match` - Sector correct?
- `reputation_score` - 1-10 rating
- `recent_news` - News summary
- `ownership_changes` - Changes summary
- `ai_recommendation` - AI advice
- `confidence_score` - AI confidence (0-1)
- `status` - flagged/verified/needs_review
- `dismissed` - User dismissed flag?
- `raw_response` - Full API response (JSONB)

### ai_vetting_runs
- `id` - UUID
- `start_time` - Run started
- `end_time` - Run completed
- `total_companies` - Count
- `companies_vetted` - Completed count
- `companies_flagged` - Issues found
- `status` - running/completed/failed

## API Rate Limits

Claude API limits:
- **Free tier**: Limited requests per minute
- **Paid tier**: Higher limits

The system includes:
- 1 second delay between requests
- Error handling for rate limits
- Automatic retry logic

## Cost Management

Estimated costs (as of 2024):
- **Claude 3.5 Sonnet**: ~$0.015 per company
- **100 companies**: ~$1.50
- **1000 companies**: ~$15

Tips to reduce costs:
1. Only vet new/changed companies
2. Store results for 30-90 days
3. Use cheaper model for initial screening
4. Batch process during off-hours

## Troubleshooting

### API Key Not Working
- Check key starts with `sk-ant-`
- Verify key is active in Anthropic console
- Check browser console for error messages

### Vetting Hangs
- Check browser console for errors
- Verify Supabase connection
- Check API rate limits
- Try vetting smaller batch

### Inaccurate Results
- AI confidence score indicates certainty
- Lower confidence = needs manual review
- Dismiss false positives
- Can re-vet specific companies

## Privacy & Security

- API key stored in browser localStorage (local only)
- Never committed to git
- Company data sent to Claude API
- Review Anthropic's privacy policy
- Consider data sensitivity before use

## Support

For issues:
1. Check browser console for errors
2. Review Supabase logs
3. Check Anthropic API status
4. Verify database tables created
5. Test with single company first
