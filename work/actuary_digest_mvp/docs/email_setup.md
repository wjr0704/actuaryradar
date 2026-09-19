# Daily briefing email setup

## Production MVP: Supabase + Resend

The homepage subscription form posts to:

```text
/api/newsletter/subscribe
```

Netlify redirects this path to the server-side function:

```text
/.netlify/functions/newsletter-subscribe
```

The subscription system uses:

- Supabase/PostgreSQL for subscribers and delivery logs
- Resend for double-opt-in confirmation and daily email delivery
- Netlify Scheduled Functions for the daily send job

The daily email does not call OpenAI per subscriber. It reuses the latest
already-generated `digest.json`.

### 1. Create Supabase tables

Run this migration in Supabase SQL Editor:

```text
supabase/migrations/202609020001_newsletter.sql
```

It creates:

- `newsletter_subscribers`
- `newsletter_deliveries`

The unique `subscriber_id + digest_date` constraint prevents duplicate daily
editions for the same subscriber.

### 2. Configure Netlify environment variables

Set these in Netlify:

```bash
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SECRET_KEY="your_sb_secret_key"
RESEND_API_KEY="your_resend_api_key"
DAILY_BRIEFING_FROM="ActuaryRadar <briefing@your-domain.com>"
SITE_BASE_URL="https://insuranceactuaryhub.com"
```

Keep `SUPABASE_SECRET_KEY` and `RESEND_API_KEY` server-side only. Do not put
them in frontend JavaScript or commit them to GitHub. Existing projects may
use `SUPABASE_SERVICE_ROLE_KEY` as a legacy fallback.

### 3. Confirm Resend sender domain

For production, verify the sender domain in Resend before using a custom
`DAILY_BRIEFING_FROM` address.

### 4. Endpoints

```text
POST /api/newsletter/subscribe
GET  /api/newsletter/confirm?token=...
GET  /api/newsletter/unsubscribe?token=...
GET  /api/newsletter/send-daily
```

### 5. Daily send schedule

`newsletter-daily-send` runs daily through Netlify Scheduled Functions. It:

1. Loads the latest `digest.json`.
2. Fetches active subscribers from Supabase.
3. Skips subscribers already sent for the same `digest_date`.
4. Sends through Resend.
5. Writes a delivery record.

### 6. Privacy notes

- Email addresses are stored in Supabase.
- Confirmation tokens are stored as SHA-256 hashes.
- Unsubscribe tokens are stable random tokens so links in older emails continue to work.
- The frontend never sees Supabase service-role keys or Resend keys.
- Add a public privacy notice before inviting a wider audience.

---

# Gmail 推送配置

## 1. 准备 Gmail App Password

Gmail SMTP 通常不能直接用网页登录密码。建议开启两步验证后，在 Google Account 里创建 App Password。

需要两个环境变量：

```bash
export GMAIL_ADDRESS="user@example.com"
export GMAIL_APP_PASSWORD="gmail_app_password_placeholder"
```

也可以使用别名：

```bash
export ACTUARY_DIGEST_EMAIL_FROM="user@example.com"
export ACTUARY_DIGEST_EMAIL_PASSWORD="email_password_placeholder"
```

## 2. 测试发送

```bash
python3 work/actuary_digest_mvp/src/digest.py --sample-only --send-email --email-to user@example.com
```

## 3. 正式发送

```bash
python3 work/actuary_digest_mvp/src/digest.py --send-email --email-to user@example.com
```

## 4. 默认收件人

在 `work/actuary_digest_mvp/config/preferences.json` 里设置：

```json
"email": {
  "subject_prefix": "保险精算每日学习简报",
  "default_recipients": ["user@example.com"]
}
```

之后可以直接运行：

```bash
python3 work/actuary_digest_mvp/src/digest.py --send-email
```

## 5. 注意

- 不要把 Gmail App Password 提交到代码或文档里。
- 邮件会包含 HTML 正文，并附件发送 Markdown 和 JSON。
- 如果要发给社群，可以先发给自己确认内容，再加入更多收件人。
