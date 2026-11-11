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
  return ["en", "zh", "fr", "both"].includes(language) ? language : "en";
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
  const normalizedLanguage = ["en", "zh", "fr"].includes(language) ? language : "en";
  const items = Array.isArray(digest?.items) ? digest.items : [];
  const languageItems = items.filter(item => {
    const itemLanguage = String(item.source_language || item.original_language || "en").toLowerCase();
    return itemLanguage.startsWith(normalizedLanguage);
  });
  const configuredIdsValue = digest?.daily_picks?.ids_by_language?.[normalizedLanguage];
  const hasConfiguredPicks = Array.isArray(configuredIdsValue);
  const configuredIds = hasConfiguredPicks ? configuredIdsValue : [];
  const configuredItems = configuredIds
    .map(id => languageItems.find(item => (item.original_url || item.url) === id || item.url === id))
    .filter(Boolean);
  const selectedItems = hasConfiguredPicks
    ? configuredItems.slice(0, 5)
    : [...languageItems]
      .sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")))
      .slice(0, 5);
  return selectedItems
    .map(item => ({
      title: strictLocalizedValue(item.localized_title, normalizedLanguage)
        || item.title
        || item.original_title
        || (normalizedLanguage === "zh" ? "无标题" : "Untitled"),
      source: item.source_name || item.source || "Source",
      url: item.original_url || item.url || siteBaseUrl(),
      keyTakeaway: strictLocalizedValue(item.key_takeaway, normalizedLanguage) || item.summary || "",
      whyItMatters: strictLocalizedValue(item.why_it_matters, normalizedLanguage),
      topic: localizedTopic(item.platform_section || item.taxonomy_category || "market", normalizedLanguage)
    }));
}

export function pickLearningItem(digest, language = "en") {
  const concept = digest?.daily_concept || {};
  const translated = translateDailyConcept(concept.term, language);
  return {
    title: translated,
    time: language === "zh" ? "8 分钟" : "8 min",
    reason: language === "zh"
      ? "基于今日学习内容生成。"
      : language === "fr"
        ? "Recommandé à partir du contenu du jour."
        : "Recommended from today's learning content."
  };
}

export function strictLocalizedValue(value, language) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[language] || "";
}

function translateDailyConcept(term, language) {
  const raw = String(term || "").trim();
  const concepts = [
    {
      match: ["CSM", "合同服务边际"],
      en: "Contractual Service Margin (CSM)",
      zh: "CSM 合同服务边际",
      fr: "Marge sur services contractuels (CSM)"
    },
    {
      match: ["风险边际", "Risk Margin"],
      en: "Risk Margin",
      zh: "风险边际",
      fr: "Marge de risque"
    },
    {
      match: ["赔付率", "Loss Ratio"],
      en: "Loss Ratio",
      zh: "赔付率",
      fr: "Ratio de sinistralité"
    },
    {
      match: ["资产负债久期匹配"],
      en: "Asset–Liability Duration Matching",
      zh: "资产负债久期匹配",
      fr: "Adéquation de duration actif-passif"
    },
    {
      match: ["巨灾超赔再保险", "XL"],
      en: "Catastrophe Excess-of-Loss Reinsurance",
      zh: "巨灾超赔再保险 XL",
      fr: "Réassurance catastrophe en excédent de sinistre"
    }
  ];
  const match = concepts.find(entry => entry.match.some(value => raw.includes(value)));
  if (match) return match[language] || match.en;
  if (language === "zh") return raw || "今日精算概念";
  if (language === "fr") return "Concept actuariel du jour";
  return "Daily actuarial concept";
}

function localizedTopic(topic, language) {
  const labels = {
    regulation: { en: "Regulation", zh: "监管", fr: "Réglementation" },
    market: { en: "Market", zh: "市场", fr: "Marché" },
    reinsurance: { en: "Reinsurance", zh: "再保险", fr: "Réassurance" },
    technology_ai: { en: "Technology & AI", zh: "科技与 AI", fr: "Technologie et IA" },
    company_results_strategy: { en: "Company Results", zh: "公司业绩", fr: "Résultats" },
    research: { en: "Research", zh: "研究", fr: "Recherche" },
    career_learning: { en: "Career & Learning", zh: "职业与学习", fr: "Carrière et formation" }
  };
  return labels[topic]?.[language] || labels[topic]?.en || topic;
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
    },
    both: {
      subject: "Confirm your ActuaryRadar Daily subscription / 确认订阅",
      title: "Confirm subscription / 确认订阅",
      body: "Confirm to receive both the English and Chinese editions. 确认后，你将同时收到英文版和中文版日报。",
      cta: "Confirm / 确认",
      note: "If you did not request this, ignore this email. 如果不是你提交的订阅，请忽略此邮件。"
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
  const preference = normalizeLanguage(subscriber.language);
  const digestDate = digest.report_date || digest.generation_date || new Date().toISOString().slice(0, 10);
  const unsubscribeUrl = `${siteBaseUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribe_token || "")}`;
  const labelsByLanguage = {
    zh: {
      subject: `ActuaryRadar Daily · ${digestDate}`,
      title: "ActuaryRadar Daily",
      radar: "今日保险雷达",
      learning: "今日学习",
      takeaway: "核心要点",
      why: "为什么重要",
      cta: "继续学习",
      footer: "你收到这封邮件，是因为你订阅了 ActuaryRadar Daily。",
      empty: "今日暂无可发送的中文情报。",
      unsubscribe: "退订",
      privacy: "隐私说明：你的邮箱仅用于发送 ActuaryRadar 日报。"
    },
    fr: {
      subject: `ActuaryRadar Daily · ${digestDate}`,
      title: "ActuaryRadar Daily",
      radar: "Veille assurance du jour",
      learning: "Apprentissage du jour",
      takeaway: "Point clé",
      why: "Pourquoi c’est important",
      cta: "Continuer sur ActuaryRadar",
      footer: "Vous recevez cet e-mail car vous êtes abonné à ActuaryRadar Daily.",
      empty: "Aucune veille disponible aujourd’hui.",
      unsubscribe: "Se désabonner",
      privacy: "Votre adresse est utilisée uniquement pour ActuaryRadar Daily."
    },
    en: {
      subject: `ActuaryRadar Daily · ${digestDate}`,
      title: "ActuaryRadar Daily",
      radar: "Today's Insurance Radar",
      learning: "Today's Learning",
      takeaway: "Key Takeaway",
      why: "Why It Matters",
      cta: "Continue learning on ActuaryRadar",
      footer: "You are receiving this email because you subscribed to ActuaryRadar Daily.",
      empty: "No English briefing items are available today.",
      unsubscribe: "Unsubscribe",
      privacy: "Privacy notice: your email is used only for ActuaryRadar Daily."
    }
  };
  const languages = preference === "both" ? ["en", "zh"] : [preference];
  const sections = languages.map(language => renderNewsletterEdition({
    digest,
    language,
    labels: labelsByLanguage[language]
  })).join('<hr class="edition-divider">');
  const primaryLabels = labelsByLanguage[preference === "both" ? "en" : preference];
  const subject = preference === "both"
    ? `ActuaryRadar Daily · English + 中文 · ${digestDate}`
    : primaryLabels.subject;
  const footer = preference === "both"
    ? `You are receiving this email because you subscribed to ActuaryRadar Daily. 你收到这封邮件，是因为你订阅了 ActuaryRadar 日报。`
    : primaryLabels.footer;
  const unsubscribeLabel = preference === "both" ? "Unsubscribe / 退订" : primaryLabels.unsubscribe;
  const privacy = preference === "both"
    ? "Privacy notice: your email is used only for ActuaryRadar Daily. 隐私说明：你的邮箱仅用于发送 ActuaryRadar 日报。"
    : primaryLabels.privacy;
  return {
    subject,
    html: emailShell("ActuaryRadar Daily", `
      <p class="date">${escapeHtml(digestDate)}</p>
      ${sections}
      <p><a class="button" href="${siteBaseUrl()}">${escapeHtml(preference === "both" ? "Continue learning / 继续学习" : primaryLabels.cta)}</a></p>
      <p class="muted">${escapeHtml(footer)}</p>
      <p class="muted"><a href="${unsubscribeUrl}">${escapeHtml(unsubscribeLabel)}</a> · ${escapeHtml(privacy)}</p>
    `)
  };
}

function renderNewsletterEdition({ digest, language, labels }) {
  const stories = pickNewsletterStories(digest, language);
  const learning = pickLearningItem(digest, language);
  const storyHtml = stories.length
    ? stories.map(story => `
      <article class="story">
        <p class="meta">${escapeHtml(story.source)} · ${escapeHtml(story.topic)}</p>
        <h3><a href="${escapeAttribute(story.url)}">${escapeHtml(story.title)}</a></h3>
        ${story.keyTakeaway ? `<p><strong>${escapeHtml(labels.takeaway)}:</strong> ${escapeHtml(story.keyTakeaway)}</p>` : ""}
        ${story.whyItMatters ? `<p><strong>${escapeHtml(labels.why)}:</strong> ${escapeHtml(story.whyItMatters)}</p>` : ""}
      </article>
    `).join("")
    : `<p>${escapeHtml(labels.empty)}</p>`;
  return `
      <section lang="${escapeAttribute(language === "zh" ? "zh-CN" : language)}">
      <h2>${escapeHtml(labels.radar)}</h2>
      ${storyHtml}
      <section class="learning">
        <h2>${escapeHtml(labels.learning)}</h2>
        <h3>${escapeHtml(learning.title)}</h3>
        <p>${escapeHtml(learning.time)} · ${escapeHtml(learning.reason)}</p>
      </section>
      </section>`;
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
    .edition-divider { border:0; border-top:2px solid #dfe8dc; margin:34px 0; }
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
