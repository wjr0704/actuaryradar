import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const DIGEST_PATHS = [
  path.join(ROOT, "outputs/actuary_radar_site/data/digest.json"),
  path.join(ROOT, "work/actuary_digest_mvp/ui/data/digest.json")
];

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitBuckets = new Map();

export class HttpError extends Error {
  constructor(status, message, publicMessage = message) {
    super(message);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

export function jsonResponse(body, status = 200, headers = {}) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    },
    body: JSON.stringify(body)
  };
}

export function htmlResponse(body, status = 200) {
  return {
    statusCode: status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    },
    body
  };
}

export function methodNotAllowed() {
  return jsonResponse({ error: "Method not allowed" }, 405, { allow: "POST" });
}

export function requireNewsletterEnv() {
  const missing = ["SUPABASE_URL", "RESEND_API_KEY"].filter(name => !process.env[name]);
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SECRET_KEY");
  }
  if (missing.length) {
    throw new HttpError(500, `Missing newsletter environment variables: ${missing.join(", ")}`, "Newsletter service is not configured yet.");
  }
}

export function siteBaseUrl() {
  return (process.env.SITE_BASE_URL || process.env.URL || "https://insuranceactuaryhub.com").replace(/\/+$/, "");
}

export function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Invalid email", "Please enter a valid email address.");
  }
  return email;
}

export function normalizeLanguage(value) {
  const language = String(value || "en").trim().toLowerCase();
  return ["en", "zh", "fr"].includes(language) ? language : "en";
}

export function makeToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function checkRateLimit(key) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);
  if (bucket.count > RATE_LIMIT_MAX) {
    throw new HttpError(429, "Rate limit exceeded", "Too many attempts. Please try again later.");
  }
}

export function clientIp(event) {
  return event.headers?.["x-nf-client-connection-ip"]
    || event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
    || "unknown";
}

async function supabaseRequest(pathname, options = {}) {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new HttpError(500, "Supabase environment is missing", "Newsletter service is not configured yet.");
  const response = await fetch(`${baseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new HttpError(response.status, `Supabase error: ${text}`, "Newsletter service is temporarily unavailable.");
  }
  return data;
}

export async function getSubscriberByEmail(email) {
  const rows = await supabaseRequest(`newsletter_subscribers?email=eq.${encodeURIComponent(email)}&limit=1`, { method: "GET" });
  return rows?.[0] || null;
}

export async function getSubscriberByConfirmationTokenHash(tokenHash) {
  const rows = await supabaseRequest(`newsletter_subscribers?confirmation_token=eq.${encodeURIComponent(tokenHash)}&limit=1`, { method: "GET" });
  return rows?.[0] || null;
}

export async function getSubscriberByUnsubscribeToken(token) {
  const rows = await supabaseRequest(`newsletter_subscribers?unsubscribe_token=eq.${encodeURIComponent(token)}&limit=1`, { method: "GET" });
  return rows?.[0] || null;
}

export async function createSubscriber(payload) {
  const rows = await supabaseRequest("newsletter_subscribers", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return rows?.[0] || null;
}

export async function updateSubscriberById(id, payload) {
  const rows = await supabaseRequest(`newsletter_subscribers?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  return rows?.[0] || null;
}

export async function listActiveSubscribers(limit = 1000) {
  return supabaseRequest(`newsletter_subscribers?status=eq.active&select=id,email,language,preferred_topics,unsubscribe_token&limit=${limit}`, { method: "GET" });
}

export async function listDeliveriesForDate(digestDate) {
  return supabaseRequest(`newsletter_deliveries?digest_date=eq.${encodeURIComponent(digestDate)}&select=subscriber_id,status`, { method: "GET" });
}

export async function recordDelivery(payload) {
  const rows = await supabaseRequest("newsletter_deliveries?on_conflict=subscriber_id,digest_date", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || null;
}

export async function sendResendEmail({ to, subject, html }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.DAILY_BRIEFING_FROM || "ActuaryRadar <onboarding@resend.dev>",
      to,
      subject,
      html
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(response.status, `Resend error: ${JSON.stringify(data)}`, "Email could not be sent right now.");
  }
  return data;
}

export async function loadLatestDigest() {
  for (const digestPath of DIGEST_PATHS) {
    try {
      return JSON.parse(await readFile(digestPath, "utf8"));
    } catch {
      // Try the next generated-data location.
    }
  }
  const response = await fetch(`${siteBaseUrl()}/data/digest.json`, {
    headers: { "user-agent": "ActuaryRadar Newsletter/0.1" }
  });
  if (!response.ok) throw new HttpError(500, `Digest fetch failed: HTTP ${response.status}`, "Latest digest is not available yet.");
  return response.json();
}

export function pickNewsletterStories(digest, language = "en") {
  const items = Array.isArray(digest?.items) ? digest.items : [];
  return items
    .filter(item => {
      const itemLanguage = String(item.source_language || item.original_language || "en").toLowerCase();
      return itemLanguage.startsWith(language);
    })
    .slice(0, 5)
    .map(item => ({
      title: item.title || item.original_title || "Untitled",
      source: item.source_name || item.source || "Source",
      url: item.original_url || item.url || siteBaseUrl(),
      keyTakeaway: localizedValue(item.key_takeaway, language) || item.summary || "",
      whyItMatters: localizedValue(item.why_it_matters, language) || item.actuarial_angle || "",
      topic: item.platform_section || item.taxonomy_category || "market"
    }));
}

export function pickLearningItem(digest, language = "en") {
  const concept = digest?.daily_concept || {};
  const term = concept.term || (language === "zh" ? "今日概念" : language === "fr" ? "Concept du jour" : "Daily concept");
  return {
    title: term,
    time: "8 min",
    reason: language === "zh"
      ? "基于今日学习内容生成。"
      : language === "fr"
        ? "Recommandé à partir du contenu du jour."
        : "Recommended from today's learning content."
  };
}

export function localizedValue(value, language) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[language] || value.en || "";
}

export function confirmationEmail({ email, token, language }) {
  const confirmUrl = `${siteBaseUrl()}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
  const copy = {
    zh: {
      subject: "确认订阅 ActuaryRadar Daily",
      title: "确认你的 ActuaryRadar 日报订阅",
      body: "点击下面按钮确认订阅。确认后，你会收到每日保险情报和学习提示。",
      cta: "确认订阅",
      note: "如果你没有提交订阅，可以忽略这封邮件。"
    },
    fr: {
      subject: "Confirmez votre abonnement à ActuaryRadar Daily",
      title: "Confirmez votre abonnement",
      body: "Cliquez sur le bouton ci-dessous pour confirmer votre abonnement à la veille quotidienne ActuaryRadar.",
      cta: "Confirmer l’abonnement",
      note: "Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet e-mail."
    },
    en: {
      subject: "Confirm your ActuaryRadar Daily subscription",
      title: "Confirm your ActuaryRadar Daily subscription",
      body: "Click the button below to confirm your subscription. Once confirmed, you will receive the daily insurance briefing and learning prompt.",
      cta: "Confirm subscription",
      note: "If you did not request this, you can ignore this email."
    }
  }[language] || {};
  return {
    subject: copy.subject,
    html: emailShell(copy.title, `
      <p>${escapeHtml(copy.body)}</p>
      <p><a class="button" href="${confirmUrl}">${escapeHtml(copy.cta)}</a></p>
      <p class="muted">${escapeHtml(copy.note)}</p>
      <p class="muted">${escapeHtml(email)}</p>
    `)
  };
}

export function dailyNewsletterEmail({ digest, subscriber }) {
  const language = normalizeLanguage(subscriber.language);
  const stories = pickNewsletterStories(digest, language);
  const learning = pickLearningItem(digest, language);
  const digestDate = digest.report_date || digest.generation_date || new Date().toISOString().slice(0, 10);
  const unsubscribeUrl = `${siteBaseUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribe_token || "")}`;
  const labels = {
    zh: {
      subject: `ActuaryRadar Daily · ${digestDate}`,
      title: "ActuaryRadar Daily",
      radar: "今日保险雷达",
      learning: "今日学习",
      takeaway: "核心要点",
      why: "为什么重要",
      cta: "继续学习",
      footer: "你收到这封邮件，是因为你订阅了 ActuaryRadar Daily。"
    },
    fr: {
      subject: `ActuaryRadar Daily · ${digestDate}`,
      title: "ActuaryRadar Daily",
      radar: "Veille assurance du jour",
      learning: "Apprentissage du jour",
      takeaway: "Point clé",
      why: "Pourquoi c’est important",
      cta: "Continuer sur ActuaryRadar",
      footer: "Vous recevez cet e-mail car vous êtes abonné à ActuaryRadar Daily."
    },
    en: {
      subject: `ActuaryRadar Daily · ${digestDate}`,
      title: "ActuaryRadar Daily",
      radar: "Today's Insurance Radar",
      learning: "Today's Learning",
      takeaway: "Key Takeaway",
      why: "Why It Matters",
      cta: "Continue learning on ActuaryRadar",
      footer: "You are receiving this email because you subscribed to ActuaryRadar Daily."
    }
  }[language];
  const storyHtml = stories.length
    ? stories.map(story => `
      <article class="story">
        <p class="meta">${escapeHtml(story.source)} · ${escapeHtml(story.topic)}</p>
        <h3><a href="${escapeAttribute(story.url)}">${escapeHtml(story.title)}</a></h3>
        ${story.keyTakeaway ? `<p><strong>${escapeHtml(labels.takeaway)}:</strong> ${escapeHtml(story.keyTakeaway)}</p>` : ""}
        ${story.whyItMatters ? `<p><strong>${escapeHtml(labels.why)}:</strong> ${escapeHtml(story.whyItMatters)}</p>` : ""}
      </article>
    `).join("")
    : `<p>${language === "zh" ? "今日暂无可发送情报。" : language === "fr" ? "Aucune veille disponible aujourd’hui." : "No briefing items are available today."}</p>`;
  return {
    subject: labels.subject,
    html: emailShell(labels.title, `
      <p class="date">${escapeHtml(digestDate)}</p>
      <h2>${escapeHtml(labels.radar)}</h2>
      ${storyHtml}
      <section class="learning">
        <h2>${escapeHtml(labels.learning)}</h2>
        <h3>${escapeHtml(learning.title)}</h3>
        <p>${escapeHtml(learning.time)} · ${escapeHtml(learning.reason)}</p>
      </section>
      <p><a class="button" href="${siteBaseUrl()}">${escapeHtml(labels.cta)}</a></p>
      <p class="muted">${escapeHtml(labels.footer)}</p>
      <p class="muted"><a href="${unsubscribeUrl}">Unsubscribe</a> · Privacy notice: your email is used only for ActuaryRadar Daily.</p>
    `)
  };
}

export function statusPage({ title, body, cta = "Open ActuaryRadar" }) {
  return emailShell(title, `
    <p>${escapeHtml(body)}</p>
    <p><a class="button" href="${siteBaseUrl()}">${escapeHtml(cta)}</a></p>
  `);
}

function emailShell(title, content) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin:0; background:#f7f5ec; color:#102033; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif; line-height:1.55; }
    .wrap { max-width:680px; margin:0 auto; padding:32px 18px; }
    .card { background:#fffdf7; border:1px solid #dfe8dc; border-radius:24px; padding:28px; box-shadow:0 18px 45px rgba(23,52,43,.08); }
    h1 { margin:0 0 14px; font-size:28px; }
    h2 { margin:28px 0 12px; font-size:20px; }
    h3 { margin:6px 0 8px; font-size:17px; }
    p { margin:0 0 14px; }
    a { color:#1f6f5b; }
    .button { display:inline-block; background:#245f4b; color:#fff !important; text-decoration:none; padding:12px 18px; border-radius:999px; font-weight:700; }
    .story { padding:16px 0; border-top:1px solid #e7ece4; }
    .meta, .muted, .date { color:#66746d; font-size:13px; }
    .learning { background:#eef7f0; border-radius:18px; padding:16px; margin:24px 0; }
  </style>
</head>
<body><div class="wrap"><div class="card"><h1>${escapeHtml(title)}</h1>${content}</div></div></body>
</html>`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
