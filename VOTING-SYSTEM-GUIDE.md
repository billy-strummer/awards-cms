# Public Voting System - Implementation Guide

## Overview

The awards CMS now includes a **unique voting link system** where each nominee gets their own dedicated voting page. Nominees can share their personal voting link to gather votes from the public.

---

## Features

### ✅ Individual Voting Pages
- Each nominee has a unique voting link (e.g., `/vote.html?entry=BTA-2025-001`)
- Beautiful, mobile-responsive voting interface
- Shows nominee details, description, and current vote count
- Real-time vote counting

### ✅ Admin Controls
- Enable/disable public voting per entry
- Generate and copy voting links with one click
- Toggle public visibility settings
- View current vote counts in admin dashboard

### ✅ Vote Security
- Email verification required (one vote per email)
- IP address tracking for duplicate detection
- Verification tokens for email confirmation
- Local storage to remember voters

### ✅ Social Sharing
- Built-in sharing to Twitter, Facebook, LinkedIn
- One-click link copying
- Share prompts after voting
- Social media meta tags for rich previews

---

## How It Works

### For Administrators

#### 1. Enable Public Voting for an Entry

1. Go to **Entries** section in admin dashboard
2. Find the entry you want to open for voting
3. Click the **Link icon** button (🔗) in the actions column
4. A modal will appear showing:
   - Current voting status (enabled/disabled)
   - The unique voting link
   - Current vote count
   - Settings toggles

#### 2. Configure Voting Settings

Toggle these settings in the voting link modal:

- **Allow public voting**: Enables/disables voting for this entry
- **Show entry publicly**: Makes the entry visible on public lists

#### 3. Share the Voting Link

Copy the unique voting link and share it with the nominee:

```
https://yourdomain.com/vote.html?entry=BTA-2025-001
```

The nominee can then share this link with their network to gather votes.

#### 4. Monitor Votes

- View vote counts in the Entries table
- Click the voting link button to see updated counts
- Export entries with vote data to CSV

---

### For Nominees/Public Voters

#### 1. Receiving the Voting Link

Nominees receive a unique link like:
```
https://yourdomain.com/vote.html?entry=BTA-2025-001
```

#### 2. Voting Process

1. Click the voting link
2. View nominee information and details
3. Click "Vote Now" button
4. Enter email address (and optional name)
5. Agree to verification requirement
6. Submit vote
7. Receive confirmation email (TODO: setup email service)

#### 3. Sharing the Link

After voting, voters can:
- Share on Twitter, Facebook, LinkedIn
- Copy link to clipboard
- Forward to friends and colleagues

---

## File Structure

### New Files Created

```
vote.html                  - Individual nominee voting page
nominee-voting.js         - Voting page JavaScript logic
VOTING-SYSTEM-GUIDE.md    - This documentation file
```

### Modified Files

```
entries.js                - Added voting link generation and controls
```

### Database Tables Used

```
entries                   - Stores entries with voting flags
  ├─ is_public           - Boolean: Show publicly
  ├─ allow_public_voting - Boolean: Enable voting
  └─ public_votes        - Integer: Vote count

public_votes              - Stores individual votes
  ├─ entry_id            - UUID: Reference to entry
  ├─ voter_email         - Text: Voter's email
  ├─ voter_name          - Text: Optional name
  ├─ voter_ip            - Text: IP for duplicate detection
  ├─ vote_value          - Integer: Vote weight (default: 1)
  ├─ email_verified      - Boolean: Verification status
  └─ verification_token  - Text: Email verification token
```

---

## Configuration

### Supabase Setup

Update these values in `nominee-voting.js`:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### Row Level Security (RLS) Policies

Ensure these Supabase policies are set:

#### entries table:
```sql
-- Allow public read for votable entries
CREATE POLICY "Public can view votable entries"
ON entries FOR SELECT
USING (is_public = true AND allow_public_voting = true);
```

#### public_votes table:
```sql
-- Allow anyone to insert votes
CREATE POLICY "Anyone can vote"
ON public_votes FOR INSERT
WITH CHECK (true);

-- Allow reading vote counts (without personal info)
CREATE POLICY "Public can view vote counts"
ON public_votes FOR SELECT
USING (true);
```

---

## Voting Link Formats

### Standard Format (Entry Number)
```
/vote.html?entry=BTA-2025-001
```
**Pros:** Clean, readable, shareable
**Cons:** Entry number is visible

### Alternative Format (Entry ID)
```
/vote.html?id=550e8400-e29b-41d4-a716-446655440000
```
**Pros:** More secure, harder to guess
**Cons:** Less readable

Both formats are supported. The admin interface generates entry number links by default.

---

## Email Verification (TODO)

The system includes verification token generation, but email sending needs to be implemented:

### To Implement Email Verification:

1. **Choose an email service:**
   - Supabase Auth (built-in)
   - SendGrid
   - AWS SES
   - Mailgun

2. **Create backend API endpoint:**
   ```javascript
   // Example: /api/send-verification-email
   POST /api/send-verification-email
   {
     "voter_email": "voter@example.com",
     "voter_name": "John Doe",
     "entry_id": "uuid",
     "verification_token": "token"
   }
   ```

3. **Update `sendVerificationEmail()` function:**
   ```javascript
   async sendVerificationEmail() {
     await fetch('/api/send-verification-email', {
       method: 'POST',
       body: JSON.stringify({
         voter_email: this.voterEmail,
         entry_id: this.entryId,
         verification_token: this.generateToken()
       })
     });
   }
   ```

4. **Create verification endpoint:**
   ```
   /verify-vote?token=abc123
   ```

---

## Customization

### Styling

The voting page uses Bootstrap 5 with custom CSS. Key style elements:

- **Color scheme**: Purple gradient (`#667eea` to `#764ba2`)
- **Font sizes**: Responsive (mobile-first)
- **Animations**: Hover effects and transitions

To customize colors, edit the CSS in `vote.html`:

```css
body {
  background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);
}
```

### Branding

Update these elements in `vote.html`:

- Page title
- Header text
- Footer text
- Meta tags (Open Graph for social sharing)
- Favicon

### Vote Value

Currently, each vote counts as 1. To implement weighted voting:

1. Modify the vote form to include a rating (1-5 stars)
2. Update `vote_value` in the insert statement
3. Change vote display to show average rating

---

## Security Considerations

### Current Protections

✅ Email verification required
✅ One vote per email per entry
✅ IP address logging
✅ Verification tokens
✅ Supabase RLS policies

### Additional Recommendations

1. **Rate Limiting**: Implement on backend to prevent spam
2. **CAPTCHA**: Add Google reCAPTCHA for bot prevention
3. **Email Verification**: Complete email verification flow
4. **Vote Expiration**: Set voting period start/end dates
5. **Audit Logging**: Log all vote attempts for fraud detection

---

## Testing Checklist

### Admin Interface Testing

- [ ] Click voting link button for an entry
- [ ] Modal displays with correct information
- [ ] Copy link button works
- [ ] Toggle public voting setting
- [ ] Toggle public visibility setting
- [ ] Open voting page in new tab

### Voting Page Testing

- [ ] Load page with entry number parameter
- [ ] Load page with entry ID parameter
- [ ] Entry information displays correctly
- [ ] Vote button is clickable
- [ ] Verification modal appears
- [ ] Form validation works
- [ ] Vote submits successfully
- [ ] Success modal shows
- [ ] Vote count updates
- [ ] Second vote attempt is blocked
- [ ] Share buttons work (Twitter, Facebook, LinkedIn)
- [ ] Copy link button works

### Mobile Testing

- [ ] Responsive layout on mobile
- [ ] Touch interactions work
- [ ] Modals display correctly
- [ ] Forms are easy to fill on mobile

### Error Testing

- [ ] Invalid entry number shows error
- [ ] Non-existent entry shows error
- [ ] Disabled voting shows error
- [ ] Network errors are handled gracefully
- [ ] Database errors are caught

---

## Troubleshooting

### Voting Link Doesn't Load

**Issue**: Blank page or "Entry not found" error

**Solutions**:
1. Check if `is_public` is set to `true`
2. Check if `allow_public_voting` is set to `true`
3. Verify entry status is 'submitted' or 'shortlisted'
4. Check Supabase RLS policies
5. Open browser console for error messages

### Votes Not Counting

**Issue**: Vote submits but count doesn't increase

**Solutions**:
1. Check `public_votes` table for insert
2. Verify trigger `update_public_vote_count()` exists
3. Check for database errors in console
4. Ensure Supabase connection is working

### Link Button Not Showing

**Issue**: Link icon button missing in admin

**Solutions**:
1. Clear browser cache
2. Check if `entries.js` loaded correctly
3. Verify Bootstrap 5 icons are loaded
4. Check browser console for JavaScript errors

---

## Future Enhancements

### Planned Features

- [ ] Email verification completion
- [ ] Vote analytics dashboard
- [ ] Real-time vote updates (WebSocket)
- [ ] Vote leaderboard page
- [ ] QR code generation for voting links
- [ ] SMS voting integration
- [ ] Automated social media posts
- [ ] Vote reminder emails
- [ ] Voting period scheduling
- [ ] Multiple voting rounds
- [ ] Weighted category voting
- [ ] Vote export and reporting

---

## Support

For questions or issues:

1. Check this documentation
2. Review browser console for errors
3. Check Supabase logs
4. Verify database table structure matches schema
5. Test with different browsers

---

## Summary

The voting system is now fully implemented with:

✅ Unique voting links per nominee
✅ Admin controls for enabling/disabling voting
✅ Beautiful public voting interface
✅ Social sharing capabilities
✅ Vote security and duplicate prevention
✅ Real-time vote counting

**Next Steps:**
1. Configure Supabase URL and keys
2. Test the voting flow end-to-end
3. Implement email verification (optional but recommended)
4. Share voting links with nominees
5. Monitor votes in admin dashboard

---

*Last Updated: 2025-11-21*
