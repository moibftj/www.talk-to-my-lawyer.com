# Email Deliverability Troubleshooting Guide

This guide helps you diagnose and fix issues with emails not reaching the inbox.

## Table of Contents

1. [Quick Diagnostic Checklist](#quick-diagnostic-checklist)
2. [Common Issues & Solutions](#common-issues--solutions)
3. [Domain Authentication (SPF/DKIM/DMARC)](#domain-authentication-spfdkimdmarc)
4. [Improving Email Content](#improving-email-content)
5. [Monitoring & Testing](#monitoring--testing)
6. [Environment Configuration](#environment-configuration)

---

## Quick Diagnostic Checklist

Run these steps immediately when you notice email delivery issues:

### 1. Check Email Queue Status

```sql
-- Check recent emails in Supabase SQL Editor
SELECT
  status,
  COUNT(*) as count,
  MAX(created_at) as last_attempt
FROM email_queue
GROUP BY status;

-- Check for failed emails with errors
SELECT
  to,
  subject,
  error,
  attempts,
  created_at
FROM email_queue
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;
```

### 2. Check Application Logs

Look for these log patterns:
- `[ResendProvider] Attempting to send email` - Email sending initiated
- `[ResendProvider] Email sent successfully` - Email sent successfully
- `[ResendProvider] Send failed with error` - Email failed with specific error

### 3. Check Resend Dashboard

Visit https://resend.com/emails and filter by:
- **Bounced** - Email address invalid or blocked
- **Spam** - Marked as spam by recipient
- **Delivered** - Successfully delivered but may be in spam folder

### 4. Test Email Delivery

```bash
# Trigger a test email (replace with actual API endpoint)
curl -X POST "https://yourdomain.com/api/test-email" \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com"}'
```

---

## Common Issues & Solutions

### Issue 1: All Emails Going to Spam

**Symptoms:**
- Emails are delivered but go to spam folder
- Resend dashboard shows "Delivered" but recipients don't see emails

**Most Likely Cause:** Missing or incorrect domain authentication (SPF/DKIM/DMARC)

**Solution:** See [Domain Authentication](#domain-authentication-spfdkimdmarc) below

---

### Issue 2: Emails Not Being Sent

**Symptoms:**
- `email_queue` shows status = 'pending' for old emails
- No `[ResendProvider]` logs in application
- Cron job not running

**Solutions:**

1. **Check cron job is running:**
   ```bash
   # Check Vercel cron logs
   # In Vercel dashboard > Your Project > Logs > Cron Jobs
   ```

2. **Verify CRON_SECRET is set:**
   ```bash
   echo $CRON_SECRET  # Should output a secret string
   ```

3. **Manually trigger queue processing:**
   ```bash
   curl -X POST "https://yourdomain.com/api/cron/process-email-queue?secret=YOUR_CRON_SECRET"
   ```

---

### Issue 3: "Resend is not configured" Errors

**Symptoms:**
- Logs show: `[ResendProvider] Send failed: Resend client not configured`
- All emails have status = 'failed' with error about configuration

**Solution:**

```bash
# Verify RESEND_API_KEY is set
echo $RESEND_API_KEY

# Should start with "re_"
# If empty, add to .env.local:
RESEND_API_KEY=re_your-api-key-here
```

---

### Issue 4: Domain Not Verified in Resend

**Symptoms:**
- Resend dashboard shows domain as "Not Verified" or "Pending"
- Error: "from domain is not verified"

**Solution:**

1. Go to https://resend.com/domains
2. Click "Add Domain"
3. Add your domain (e.g., `talk-to-my-lawyer.com`)
4. Add the DNS records provided by Resend to your domain registrar
5. Wait for verification (5-60 minutes)

---

### Issue 5: Specific Email Addresses Failing

**Symptoms:**
- Some emails succeed, others fail
- Errors mention "invalid email", "bounced", or "rejected"

**Common Causes:**
- Recipient email address is invalid or doesn't exist
- Recipient's mail server is blocking your emails
- Recipient's mailbox is full

**Solution:**
- Verify recipient email addresses are correct
- Check if recipient's domain has strict spam filters
- Consider using a different email address for testing

---

## Domain Authentication (SPF/DKIM/DMARC)

### Why This Matters

Email providers (Gmail, Outlook, etc.) use DNS records to verify that:
1. You're authorized to send email from your domain (SPF)
2. The email hasn't been tampered with (DKIM)
3. What to do with suspicious emails (DMARC)

Without these records, your emails will likely go to spam.

### How to Set Up

#### Step 1: Add SPF Record

Go to your domain registrar (GoDaddy, Namecheap, etc.) and add this TXT record:

```
Type: TXT
Name: @
Value: v=spf1 include:resend.com ~all
TTL: 3600
```

#### Step 2: Add DKIM Record

Resend will provide this when you add your domain. It looks like:

```
Type: CNAME
Name: resend._domainkey
Value: resend-custom-domain-x.resend.com
TTL: 3600
```

#### Step 3: Add DMARC Record

```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
TTL: 3600
```

#### Step 4: Verify

1. Go to https://resend.com/domains
2. Wait for all records to show as "Verified"
3. This may take 5-60 minutes depending on DNS propagation

### Testing Your Records

```bash
# Check SPF record
dig txt yourdomain.com +short

# Check DMARC record
dig txt _dmarc.yourdomain.com +short

# Check DKIM record
dig resend._domainkey.yourdomain.com +short
```

---

## Improving Email Content

### CAN-SPAM Compliance (Legal Requirement)

All marketing emails must include:

1. **Physical mailing address** - Already included in footer
2. **Unsubscribe link** - Automatically added to marketing templates
3. **Clear subject lines** - Avoid misleading subject lines

Our templates now include:
- ✅ Physical address: "123 Legal Street, Suite 100, San Francisco, CA 94102"
- ✅ Unsubscribe links for marketing emails
- ✅ Clear branding in footer

### Best Practices

#### DO:
- Use clear, descriptive subject lines
- Include plain text version (automatically generated)
- Use personalization (recipient's name)
- Keep content relevant and valuable

#### DON'T:
- Use ALL CAPS in subject lines
- Include excessive exclamation marks!!!
- Use misleading sender information
- Send too frequently to the same recipient

### Content That Triggers Spam Filters

Avoid these words/phrases in subject lines:
- "Free", "Winner", "Congratulations"
- "Urgent", "Act now", "Limited time"
- "Make money", "Earn extra income"
- Excessive use of "$", "!!!", or ALL CAPS

---

## Monitoring & Testing

### Set Up Monitoring

1. **Check Resend Dashboard Weekly**
   - Visit https://resend.com/emails
   - Look for patterns in bounced/spam emails
   - Monitor delivery rates

2. **Set Up Alerts**
   ```sql
   -- Create a Supabase query to monitor failures
   SELECT
     DATE(created_at) as date,
     COUNT(*) FILTER (WHERE status = 'failed') as failed,
     COUNT(*) FILTER (WHERE status = 'sent') as sent,
     ROUND(COUNT(*) FILTER (WHERE status = 'failed')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as failure_rate
   FROM email_queue
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

3. **Use Email Testing Tools**
   - https://www.mail-tester.com/ - Test email content
   - https://www.glockapps.com/ - Spam testing
   - https://www.emailonacid.com/ - Client compatibility

### Test Your Setup

```bash
# 1. Send a test email to yourself
# (Use the API or trigger a signup)

# 2. Check it arrives in inbox (not spam)

# 3. Check email headers:
# - In Gmail: More > Show original
# - Look for: "Received-SPF: pass"
# - Look for: "DKIM-Signature"
# - Look for: "DMARC" results

# 4. Test with multiple providers:
# - Gmail
# - Outlook/Hotmail
# - Yahoo Mail
# - Apple Mail
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Email Configuration
RESEND_API_KEY=re_your-api-key-here
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Talk-To-My-Lawyer

# Optional but Recommended
EMAIL_REPLY_TO=support@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Cron Configuration
CRON_SECRET=your-random-secret-key
```

### Updating Your Environment

```bash
# 1. Add missing variables to .env.local
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@talk-to-my-lawyer.com
EMAIL_REPLY_TO=support@talk-to-my-lawyer.com

# 2. Restart your development server
pnpm dev

# 3. Or redeploy to production
vercel --prod
```

### Vercel Environment Variables

1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Add/update variables:
   - `RESEND_API_KEY` (encrypted)
   - `EMAIL_FROM`
   - `EMAIL_REPLY_TO`
   - `EMAIL_FROM_NAME`
3. Redeploy your application

---

## What We've Fixed

### Recent Improvements

1. **Enhanced Logging** ✅
   - Detailed logs for email sending attempts
   - Error tracking with stack traces
   - Success confirmation with message IDs

2. **CAN-SPAM Compliance** ✅
   - Physical mailing address in footer
   - Automatic unsubscribe links for marketing emails
   - Clear branding and disclosure

3. **Reply-To Headers** ✅
   - Automatically adds reply-to for better deliverability
   - Configurable via `EMAIL_REPLY_TO` or `ADMIN_EMAIL`
   - Excluded for critical security emails

4. **Better Error Handling** ✅
   - Detailed error messages from Resend
   - Retry logic with exponential backoff
   - Fallback to queue on failure

### Files Modified

- `lib/email/providers/resend.ts` - Enhanced logging and reply-to support
- `lib/email/templates.ts` - CAN-SPAM compliance footer
- `lib/email/service.ts` - Automatic reply-to and unsubscribe URLs
- `lib/email/types.ts` - Added unsubscribeUrl field
- `.env.example` - Added EMAIL_REPLY_TO configuration

---

## Next Steps

### Immediate Actions

1. **Verify domain in Resend dashboard**
   - Go to https://resend.com/domains
   - Add your domain if not already added
   - Wait for DNS records to verify

2. **Add DNS records** to your domain registrar:
   - SPF record
   - DKIM record
   - DMARC record

3. **Update environment variables:**
   ```bash
   EMAIL_REPLY_TO=support@yourdomain.com
   ```

4. **Test email delivery:**
   - Send a test email to yourself
   - Check it arrives in inbox
   - Verify unsubscribe link works

### Ongoing Maintenance

1. **Monitor weekly:**
   - Check Resend dashboard for delivery rates
   - Review email queue for failures
   - Monitor spam complaints

2. **Maintain good sending practices:**
   - Don't send too many emails too quickly
   - Honor unsubscribe requests promptly
   - Keep email lists clean (remove bounces)

3. **Keep domain reputation high:**
   - Avoid spam triggers
   - Send relevant, valuable content
   - Respond to user feedback

---

## Support & Resources

- **Resend Documentation:** https://resend.com/docs
- **Resend Dashboard:** https://resend.com/dashboard
- **Resend Domains:** https://resend.com/domains
- **Email Headers Guide:** https://sendgrid.com/blog/how-to-read-email-headers/
- **CAN-SPAM Act:** https://www.ftc.gov/enforcement/rules/rulemaking-regulatory-reform-proceedings/can-spam-act

---

## Quick Reference

### Check Email Status

```sql
-- Most recent emails
SELECT * FROM email_queue
ORDER BY created_at DESC
LIMIT 20;

-- Failed emails with errors
SELECT to, subject, error, attempts
FROM email_queue
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Queue statistics
SELECT status, COUNT(*)
FROM email_queue
GROUP BY status;
```

### Manual Queue Processing

```bash
# Trigger cron job manually
curl -X POST "https://yourdomain.com/api/cron/process-email-queue?secret=YOUR_CRON_SECRET"
```

### Test Email Template

```typescript
import { queueTemplateEmail } from '@/lib/email'

await queueTemplateEmail(
  'welcome',
  'test@example.com',
  {
    userName: 'Test User',
    actionUrl: 'https://yourdomain.com/dashboard'
  }
)
```

---

Last updated: 2026-01-16
