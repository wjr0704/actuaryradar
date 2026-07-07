import { readFile } from "node:fs/promises";
import path from "node:path";

export const config = {
  schedule: "0 6 * * *"
};

const ROOT = path.resolve(process.cwd(), "work/actuary_digest_mvp");
const SOURCE_CONFIG = path.join(ROOT, "config/sources.json");
const MAX_PER_SOURCE = 6;
const MAX_ITEMS = 64;
const RECENT_WINDOW_HOURS = 48;

const sectionRules = [
  ["regulation", ["eiopa", "solvency", "scr", "mcr", "naic", "acpr", "regulation", "监管", "偿付"]],
  ["reinsurance", ["reinsurance", "reinsurer", "retrocession", "swiss re", "munich re", "hannover re", "scor", "cat bond", "ils", "再保险", "再保"]],
  ["technology_ai", ["ai", "artificial intelligence", "machine learning", "data", "digital", "insurtech", "telematics", "automation", "人工智能", "数据", "保险科技"]],
  ["company_results_strategy", ["ifrs 17", "csm", "annual report", "earnings", "results", "investor", "strategy", "财报", "业绩", "战略"]],
  ["research", ["research", "report", "sigma", "outlook", "survey", "milliman", "deloitte", "pwc", "kpmg", "ey", "mckinsey", "研究", "报告"]],
  ["career_learning", ["actuarial", "actuary", "qualification", "exam", "career", "webinar", "training", "精算", "职业", "考试"]],
  ["market", ["pricing", "premium", "underwriting", "market", "mga", "broker", "distribution", "claims", "定价", "保费", "市场", "经纪", "理赔"]]
];

const concepts = [
  {
    term: "CSM 合同服务边际",
    definition: "IFRS 17 下未赚利润的负债组成部分，随保险服务提供逐步释放。",
    exercise: "选一家上市险企，写出 CSM 变动可能来自新业务、经验差异、假设变更还是释放。"
  },
  {
    term: "风险边际 / Risk Margin",
    definition: "在经济资本或 Solvency II 中，为承担不可对冲保险风险所需的额外补偿。",
    exercise: "解释为什么长久期寿险和年金业务通常对风险边际更敏感。"
  },
  {
    term: "赔付率 Loss Ratio",
    definition: "赔款及相关理赔成本相对保费的比例，是健康险、财险和车险经验分析核心指标。",
    exercise: "把赔付率拆成出险频率、案均赔款、责任结构和渠道质量四个驱动。"
  },
  {
    term: "资产负债久期匹配",
    definition: "通过资产现金流和负债现金流期限结构匹配，控制利率变化带来的经济价值波动。",
    exercise: "说明利率下行 50bp 对保证利率寿险产品的资产端和负债端分别有什么影响。"
  },
  {
    term: "巨灾超赔再保险 XL",
    definition: "超过自留额后由再保险人承担约定层级损失的非比例再保险安排。",
    exercise: "画出 1-in-100 巨灾损失下，自留额、限额和恢复保费对净损失的影响。"
  }
];

export async function handler(event) {
  const reportDate = normalizeDate(event.queryStringParameters?.date) || todayIsoDate();
  const refreshStartedAt = new Date().toISOString();
  try {
    const config = JSON.parse(await readFile(SOURCE_CONFIG, "utf8"));
    const fetched = await collectItems(config);
    if (!fetched.length) throw new Error("No RSS items were fetched.");
    const selected = selectItems(fetched, MAX_ITEMS, reportDate);
    const items = selected.map(item => toUiRecord(item, reportDate));
    const concept = dailyConcept(reportDate);
    return jsonResponse({
      report_date: reportDate,
      generation_date: reportDate,
      generated_at: refreshStartedAt,
      mode: "dynamic-rss",
      refresh_log: {
        last_refresh_at: refreshStartedAt,
        refresh_status: "success",
        articles_fetched: fetched.length,
        articles_added: items.length,
        daily_concept_id: concept.term,
        featured_article_id: items[0]?.original_url || items[0]?.url || ""
      },
      focus_profile: focusProfile(reportDate),
      daily_concept: concept,
      items,
      company_reports: config.official_company_reports || []
    }, 200, "public, max-age=300, s-maxage=1800");
  } catch (error) {
    return jsonResponse({
      error: error.message,
      report_date: reportDate,
      generation_date: reportDate,
      generated_at: refreshStartedAt,
      refresh_log: {
        last_refresh_at: refreshStartedAt,
        refresh_status: "failed",
        articles_fetched: 0,
        articles_added: 0,
        daily_concept_id: dailyConcept(reportDate).term,
        featured_article_id: ""
      },
      items: []
    }, 500, "no-store");
  }
}

async function collectItems(config) {
  const sourceResults = await Promise.allSettled((config.rss_sources || []).map(async source => {
    const response = await fetch(source.url, {
      headers: { "user-agent": "ActuaryRadar/0.1 (+https://insuranceactuaryhub.com)" }
    });
    if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
    const xml = await response.text();
    return parseRss(xml, source).slice(0, Number(config.limits?.max_items_per_source || MAX_PER_SOURCE));
  }));
  const flat = sourceResults.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const seen = new Set();
  return flat.filter(item => {
    const key = dedupeKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseRss(xml, source) {
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(match => match[0]);
  return itemBlocks.map(block => {
    const title = cleanXml(pick(block, "title"));
    const link = cleanXml(pick(block, "link"));
    const description = stripHtml(cleanXml(pick(block, "description")));
    const published = normalizePublished(cleanXml(pick(block, "pubDate") || pick(block, "published")));
    const sourceName = cleanXml(pick(block, "source")) || inferPublisher(title) || source.name;
    return {
      title: stripPublisher(title, sourceName),
      original_title: title,
      source: sourceName,
      source_name: sourceName,
      url: link,
      original_url: link,
      source_url: publisherUrl(sourceName),
      published,
      summary: description,
      language: source.language || "en",
      region: source.region || "Global",
      source_type: source.source_type || "RSS",
      score: scoreItem(`${title} ${description} ${sourceName}`)
    };
  }).filter(item => item.title && item.url);
}

function toUiRecord(item, reportDate) {
  const section = classifySection(item);
  const tags = taxonomyTags(item);
  const summary = concise(item.summary || item.title, 220);
  const takeaway = keyTakeaway(item, section);
  const why = whyItMatters(item, section);
  const localized = { [item.language]: item.title };
  return {
    title: item.title,
    original_title: item.original_title || item.title,
    original_language: item.language,
    source_language: item.language,
    source: item.source,
    source_name: item.source_name,
    source_url: item.source_url,
    original_url: item.original_url,
    via_source: item.url.includes("news.google.com") ? "Google News RSS" : "",
    rss_title: item.original_title || item.title,
    rss_description: item.summary,
    extracted_text: "",
    extraction_status: "rss_only",
    summary_basis: "rss_excerpt",
    url: item.url,
    published: item.published || reportDate,
    summary,
    localized_title: localized,
    key_takeaway: { [item.language]: takeaway },
    ai_summary: { [item.language]: summary ? [summary] : [] },
    why_it_matters: { [item.language]: why },
    ai_enriched: false,
    enrichment_provider: "rules",
    enrichment_basis: "rss_excerpt",
    region: item.region,
    source_type: item.source_type,
    platform_section: section,
    category: section,
    taxonomy_category: section,
    taxonomy_tags: tags,
    needs_review: false,
    line_of_business: classifyLine(item),
    branch: classifyBranch(item),
    industry_category: classifyIndustry(item),
    risk_level: item.score >= 12 ? "高" : item.score >= 6 ? "中" : "观察",
    score: item.score,
    actuarial_angle: why,
    actions: suggestedActions(section, item.language),
    learning_prompt: learningPrompt(section, item.language),
    shareable: `${item.title} — ${item.source}`
  };
}

function classifySection(item) {
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const match = sectionRules.find(([, keywords]) => keywords.some(keyword => text.includes(keyword)));
  return match?.[0] || "market";
}

function scoreItem(textValue) {
  const text = textValue.toLowerCase();
  let score = 1;
  ["solvency", "ifrs 17", "reinsurance", "actuarial", "pricing", "capital", "regulation", "ai", "climate", "catastrophe", "精算", "偿付", "再保险", "监管"].forEach(keyword => {
    if (text.includes(keyword)) score += 3;
  });
  ["eiopa", "swiss re", "munich re", "soa", "cas", "ifrs", "acpr", "insurance journal", "argus"].forEach(keyword => {
    if (text.includes(keyword)) score += 2;
  });
  return score;
}

function keyTakeaway(item, section) {
  const base = concise(item.summary || item.title, 180);
  if (base && base !== item.title) return base;
  const labels = {
    regulation: "A regulatory development may affect compliance, capital or product governance.",
    reinsurance: "A reinsurance market signal may affect risk transfer, capacity and renewal pricing.",
    technology_ai: "A technology development may affect underwriting, claims, distribution or model governance.",
    company_results_strategy: "A company update may affect earnings quality, capital strength or strategic direction.",
    research: "A research item may provide reusable assumptions, scenarios or market evidence.",
    career_learning: "A professional learning item may support actuarial skills and market literacy.",
    market: "A market development may affect pricing, demand, distribution or competitive dynamics."
  };
  return labels[section] || labels.market;
}

function whyItMatters(item, section) {
  const labels = {
    regulation: "Insurance and actuarial teams should monitor potential effects on solvency, reporting, controls and management actions.",
    reinsurance: "Pricing, reserving and capital teams may need to reassess tail exposure, retention, limits and counterparty capacity.",
    technology_ai: "Actuaries and risk managers should evaluate data quality, model risk, explainability and operational implementation.",
    company_results_strategy: "Results and strategy updates help interpret underwriting performance, capital deployment and management priorities.",
    research: "Research can be translated into assumptions, stress scenarios, benchmarking or model-review questions.",
    career_learning: "This can become a practical learning task for actuarial judgment, communication or technical development.",
    market: "Market signals can feed pricing adequacy, claims expectations, distribution strategy and portfolio monitoring."
  };
  return labels[section] || labels.market;
}

function suggestedActions(section, language) {
  const zh = language === "zh";
  if (section === "regulation") return [zh ? "记录潜在资本、合规或披露影响。" : "Record potential capital, compliance or disclosure impacts."];
  if (section === "reinsurance") return [zh ? "检查自留额、限额、续转价格和尾部风险。" : "Check retention, limits, renewal pricing and tail exposure."];
  if (section === "technology_ai") return [zh ? "判断这是 PoC、试点、规模化还是监管约束。" : "Classify it as PoC, pilot, scale-up or regulatory constraint."];
  return [zh ? "写下一条对假设、现金流、利润或资本的影响。" : "Write one impact on assumptions, cash flows, earnings or capital."];
}

function learningPrompt(section, language) {
  return language === "zh"
    ? "用精算视角写出这条信息对一个产品或组合的影响。"
    : "Translate this item into one product or portfolio implication from an actuarial perspective.";
}

function dailyConcept(reportDate) {
  const index = Math.abs(daysSinceEpoch(reportDate)) % concepts.length;
  return concepts[index];
}

function focusProfile(reportDate) {
  const day = new Date(`${reportDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return {
    weekday: day,
    theme: "Daily insurance intelligence",
    learning_goal: "Turn current insurance news into actuarial judgment and practical actions.",
    tasks: [
      "Identify what happened.",
      "Explain why it matters for insurance, actuarial work or risk management.",
      "Record one action or follow-up question."
    ],
    personal_tags: ["Life", "Health", "P&C", "Reinsurance", "IFRS 17", "Capital"]
  };
}

function taxonomyTags(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const tags = [];
  if (text.includes("ifrs 17") || text.includes("csm")) tags.push("ifrs17");
  if (text.includes("solvency") || text.includes("scr") || text.includes("eiopa")) tags.push("solvency_ii");
  if (text.includes("reinsurance")) tags.push("reinsurance");
  if (text.includes("climate")) tags.push("climate_risk");
  if (text.includes("catastrophe") || text.includes("hurricane") || text.includes("flood")) tags.push("catastrophe_risk");
  if (text.includes("ai") || text.includes("data")) tags.push("data_ai");
  return tags.slice(0, 3);
}

function classifyLine(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (text.includes("life") || text.includes("annuity") || text.includes("寿险")) return "life_insurance";
  if (text.includes("health") || text.includes("medical") || text.includes("健康")) return "health_insurance";
  if (text.includes("reinsurance") || text.includes("再保险")) return "reinsurance";
  if (text.includes("commercial")) return "commercial_insurance";
  if (text.includes("specialty") || text.includes("credit") || text.includes("cyber")) return "specialty_insurance";
  return "property_casualty";
}

function classifyBranch(item) {
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  if (text.includes("reinsurance") || text.includes("swiss re") || text.includes("munich re")) return "reinsurer";
  if (text.includes("broker")) return "broker";
  if (text.includes("regulator") || text.includes("eiopa") || text.includes("acpr") || text.includes("naic")) return "regulator";
  if (text.includes("rating") || text.includes("fitch") || text.includes("moody")) return "rating_agency";
  return "insurer";
}

function classifyIndustry(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (text.includes("bank") || text.includes("capital market") || text.includes("investment")) return "financial_services";
  if (text.includes("ai") || text.includes("technology") || text.includes("data")) return "technology_ai";
  if (text.includes("health")) return "healthcare";
  if (text.includes("energy") || text.includes("climate")) return "energy";
  if (text.includes("auto") || text.includes("mobility") || text.includes("vehicle")) return "mobility";
  return "insurance";
}

function pick(block, tag) {
  const match = block.match(new RegExp(`<[^>]*${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*${tag}>`, "i"));
  return match?.[1] || "";
}

function cleanXml(value) {
  return decodeEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim());
}

function stripHtml(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function inferPublisher(title) {
  const parts = title.split(" - ");
  return parts.length > 1 ? parts.at(-1).trim() : "";
}

function stripPublisher(title, publisher) {
  return publisher && title.endsWith(` - ${publisher}`) ? title.slice(0, -publisher.length - 3) : title;
}

function publisherUrl(sourceName) {
  const slug = sourceName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return slug ? `https://${slug}.com` : "";
}

function normalizePublished(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}

function normalizeKey(value) {
  return value.toLowerCase().replace(/\W+/g, "").slice(0, 96);
}

function dedupeKey(item) {
  const url = String(item.original_url || item.url || "").replace(/[?#].*$/, "");
  if (url && !url.includes("news.google.com/rss/articles")) return `url:${url}`;
  return `title:${normalizeKey(`${item.title}-${item.source_name || item.source}`)}`;
}

function selectItems(items, limit, reportDate) {
  const recent = items.filter(item => isRecentItem(item, reportDate));
  const pool = recent.length >= Math.min(limit, 12) ? recent : items;
  return [...pool].sort((a, b) => b.score - a.score || String(b.published).localeCompare(String(a.published))).slice(0, limit);
}

function isRecentItem(item, reportDate) {
  if (!item.published) return false;
  const itemTime = new Date(`${item.published}T00:00:00Z`).getTime();
  const reportTime = new Date(`${reportDate}T23:59:59Z`).getTime();
  if (Number.isNaN(itemTime) || Number.isNaN(reportTime)) return false;
  const diffHours = (reportTime - itemTime) / 3600000;
  return diffHours >= 0 && diffHours <= RECENT_WINDOW_HOURS;
}

function concise(value, max) {
  const text = stripHtml(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function normalizeDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "";
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function daysSinceEpoch(date) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86400000);
}

function jsonResponse(body, status, cacheControl) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl,
      "access-control-allow-origin": "*"
    },
    body: JSON.stringify(body)
  };
}
