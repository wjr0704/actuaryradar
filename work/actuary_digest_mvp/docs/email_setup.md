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
