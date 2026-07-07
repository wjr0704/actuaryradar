#!/usr/bin/env python3
"""Daily insurance actuarial intelligence digest MVP.

Fetches insurance-related RSS items, ranks them with actuarial keywords, and
generates Markdown plus HTML reports with action-oriented cards.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import email.utils
import html
import json
import os
import pathlib
import re
import smtplib
import sys
import textwrap
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html.parser import HTMLParser
from typing import Iterable


ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parents[1]
DEFAULT_OUTPUT_DIR = WORKSPACE / "outputs"
DEFAULT_PREFERENCES_PATH = ROOT / "config" / "preferences.json"
DEFAULT_AI_MODEL = "gpt-4o-mini"
DEFAULT_PERPLEXITY_MODEL = "sonar"


@dataclasses.dataclass(frozen=True)
class NewsItem:
    title: str
    source: str
    url: str
    published: str
    summary: str
    region: str = "Global"
    source_type: str = "News"
    language: str = "en"
    source_name: str = ""
    source_url: str = ""
    original_url: str = ""
    via_source: str = ""
    rss_title: str = ""
    rss_description: str = ""
    extracted_text: str = ""
    extraction_status: str = "not_attempted"
    summary_basis: str = "rss_excerpt"


@dataclasses.dataclass(frozen=True)
class ActionCard:
    category: str
    taxonomy_category: str
    taxonomy_tags: list[str]
    needs_review: bool
    risk_level: str
    actuarial_angle: str
    actions: list[str]
    learning_prompt: str
    shareable: str
    score: int
    region: str
    line_of_business: str
    branch: str
    platform_section: str
    industry_category: str
    original_language: str
    localized_title: dict[str, str]
    key_takeaway: dict[str, str]
    ai_summary: dict[str, str]
    why_it_matters: dict[str, str]
    ai_enriched: bool = False
    enrichment_provider: str = ""
    enrichment_basis: str = ""


PRIMARY_SECTION_KEYS = {
    "regulation",
    "market",
    "reinsurance",
    "technology_ai",
    "company_results_strategy",
    "research",
    "career_learning",
}


TAXONOMY_RULES = [
    ("regulation", ["solvency_ii", "regulation"], ["solvency ii", "scr", "mcr", "eiopa", "acpr", "nfra", "naic", "regulator", "regulation", "supervision", "监管", "偿付", "处罚"]),
    ("company_results_strategy", ["ifrs17", "investment"], ["ifrs 17", "ifrs17", "csm", "insurance contract accounting", "annual report", "quarterly results", "earnings", "investor", "strategy", "results", "财报", "业绩", "战略"]),
    ("reinsurance", ["reinsurance", "catastrophe_risk"], ["reinsurance", "reinsurer", "retrocession", "swiss re", "munich re", "hannover re", "scor", "cat bond", "ils", "renewal", "再保险", "再保"]),
    ("technology_ai", ["data_ai", "insurtech"], ["ai", "artificial intelligence", "machine learning", "generative ai", "data", "digital", "insurtech", "telematics", "automation", "人工智能", "大模型", "数据", "保险科技"]),
    ("research", ["risk_management"], ["research", "report", "white paper", "sigma", "outlook", "survey", "milliman", "deloitte", "pwc", "kpmg", "ey", "mckinsey", "研究", "报告", "咨询"]),
    ("career_learning", ["risk_management"], ["actuarial", "actuary", "qualification", "exam", "career", "seminar", "webinar", "training", "精算", "职业", "考试", "研讨会"]),
    ("market", ["pricing"], ["pricing", "tariff", "premium", "rate change", "underwriting", "market", "mga", "broker", "distribution", "定价", "保费", "市场", "经纪", "渠道"]),
]


SECONDARY_RULES = [
    ("ifrs17", ["ifrs 17", "ifrs17", "csm", "contractual service margin", "insurance contract accounting", "合同服务边际"]),
    ("solvency_ii", ["solvency ii", "scr", "mcr", "eiopa", "acpr", "偿付能力"]),
    ("reinsurance", ["reinsurance", "reinsurer", "retrocession", "再保险", "再保"]),
    ("pricing", ["pricing", "tariff", "premium", "rate change", "tarification", "定价", "费率"]),
    ("reserving", ["reserving", "claims reserve", "provisionnement", "reserve", "准备金"]),
    ("catastrophe_risk", ["catastrophe", "nat cat", "hurricane", "earthquake", "flood", "wildfire", "typhoon", "巨灾", "洪水", "地震", "山火"]),
    ("climate_risk", ["climate", "transition risk", "physical risk", "气候"]),
    ("data_ai", ["ai", "artificial intelligence", "machine learning", "generative ai", "data", "大模型", "人工智能", "数据"]),
    ("cyber_risk", ["cyber", "ransomware", "网络安全", "网络风险"]),
    ("claims", ["claims", "sinistre", "loss ratio", "赔付", "理赔"]),
    ("health_insurance", ["health", "medical", "complémentaire santé", "prévoyance", "健康", "医疗"]),
    ("life_insurance", ["life insurance", "assurance vie", "annuity", "mortality", "寿险", "年金"]),
    ("non_life_insurance", ["p&c", "property", "casualty", "assurance dommages", "non-life", "liability", "财产险", "非寿险"]),
    ("insurtech", ["insurtech", "embedded insurance", "assurance affinitaire", "保险科技", "嵌入式保险"]),
    ("distribution", ["broker", "brokerage", "courtage", "distribution", "agency", "channel", "经纪", "渠道"]),
    ("pensions", ["pension", "retirement", "épargne retraite", "养老", "退休"]),
    ("investment", ["investment", "asset", "alm", "yield", "private credit", "投资", "资产"]),
    ("risk_management", ["risk management", "erm", "capital", "风险管理", "资本"])
]


SECTION_LABELS = {
    "regulation": {"en": "Regulation", "zh": "监管", "fr": "Réglementation"},
    "market": {"en": "Market", "zh": "市场", "fr": "Marché"},
    "reinsurance": {"en": "Reinsurance", "zh": "再保险", "fr": "Réassurance"},
    "technology_ai": {"en": "Technology & AI", "zh": "科技与 AI", "fr": "Technologie & IA"},
    "company_results_strategy": {"en": "Companies Results & Strategies", "zh": "公司财报与战略", "fr": "Résultats et stratégies"},
    "research": {"en": "Research", "zh": "研究", "fr": "Recherche"},
    "career_learning": {"en": "Career & Learning", "zh": "职业与学习", "fr": "Carrière & formation"},
}


KEYWORD_RULES = [
    {
        "category": "监管与合规",
        "keywords": ["监管", "通知", "处罚", "合规", "规则", "办法", "披露", "信披", "延期", "consumer", "regulator"],
        "angle": "可能改变产品备案、信息披露、销售合规或风险治理口径。",
        "actions": [
            "整理一页影响清单：涉及产品、模型、报告、流程和负责人。",
            "检查近期产品备案、精算报告和销售材料是否存在需要同步更新的口径。",
            "把监管要求拆成必须做、建议做、持续观察三类任务。"
        ],
        "learning": "复习监管资本、产品备案、信息披露与消费者保护之间的关系。"
    },
    {
        "category": "保险科技与数据前沿",
        "keywords": ["保险科技", "人工智能", "大模型", "机器学习", "ai", "artificial intelligence", "machine learning", "telematics", "digital", "cyber", "区块链", "数据", "自动驾驶", "智能网联"],
        "angle": "可能改变核保、定价、理赔、反欺诈、客户运营和模型治理方式。",
        "actions": [
            "判断技术处于概念验证、试点、规模化还是监管约束阶段。",
            "列出一个可落地场景：数据输入、模型输出、业务决策、风险控制。",
            "检查模型风险：公平性、可解释性、漂移监控、人工复核和数据授权。"
        ],
        "learning": "复习 GLM、机器学习定价、模型治理、反欺诈和可解释 AI。"
    },
    {
        "category": "跨行业联动",
        "keywords": ["银行", "投行", "券商", "车企", "汽车", "新能源", "能源", "data centre", "数据中心", "private credit", "私募信贷", "养老", "医疗服务", "healthcare", "ev", "bank", "auto", "energy"],
        "angle": "保险风险正在和银行资本、投行资产、车企生态、能源转型、医疗服务或数据中心投资互相传导。",
        "actions": [
            "画出联动链条：对手方、资产端、负债端、销售渠道和客户行为。",
            "判断风险落点：信用风险、市场风险、承保风险、操作风险还是声誉风险。",
            "找一个可量化指标跟踪，例如违约率、维修成本、医疗通胀、赔付频率或资产久期。"
        ],
        "learning": "复习资产负债联动、信用风险迁移、生态渠道和保险服务嵌入式销售。"
    },
    {
        "category": "偿付能力与资本",
        "keywords": ["偿付", "资本", "永续债", "发债", "补血", "分红", "盈余留存", "solvency", "capital", "scr", "mcr", "风险综合评级"],
        "angle": "可能影响资本占用、偿付能力充足率、风险偏好和业务增长空间。",
        "actions": [
            "检查最近一期偿付能力指标对利率、赔付率和退保率的敏感性。",
            "列出资本消耗最高的产品线，并标注可调整的定价或再保杠杆。",
            "准备一个 25bp/50bp 利率下行情景下的资本影响小测算。"
        ],
        "learning": "复习最低资本、实际资本、风险资本和偿付能力充足率。"
    },
    {
        "category": "利率与资产负债管理",
        "keywords": ["利率", "收益率", "贴现", "预定利率", "保证利率", "alm", "yield", "discount"],
        "angle": "会同时牵动资产收益、负债现值、新业务价值、保证利益成本和退保行为。",
        "actions": [
            "更新关键产品的贴现率敏感性：利率下移 25bp/50bp/100bp。",
            "对照资产久期与负债久期，标出错配最明显的产品或账户。",
            "写下利率变化对 EV、NBV、CSM 或准备金的传导链。"
        ],
        "learning": "用 200 字解释长期利率下降为什么会提高寿险负债价值。"
    },
    {
        "category": "健康险与赔付经验",
        "keywords": ["健康险", "医疗", "赔付率", "赔付", "medical", "health", "claims", "loss ratio"],
        "angle": "可能影响定价假设、续保管理、赔付率监控和准备金充足性。",
        "actions": [
            "拉取最近 12 个月赔付率、件均赔款、出险频率和续保率趋势。",
            "按年龄、地区、责任和渠道拆分经验偏差，找出主要驱动因素。",
            "做赔付率上升 5%/10% 对利润和准备金的敏感性测试。"
        ],
        "learning": "复习赔付率、医疗通胀、发病率、续保率与风险选择。"
    },
    {
        "category": "财报与 IFRS 17",
        "keywords": ["ifrs", "ifrs17", "ifrs 17", "csm", "合同服务边际", "风险调整", "财报", "利润", "annual report", "quarterly", "results", "strategy", "战略", "embedded value", "ev", "nbv", "新业务价值"],
        "angle": "影响保险服务结果、CSM 释放、亏损合同识别和利润解释。",
        "actions": [
            "检查 CSM roll-forward 中新业务、经验差异和假设变更的贡献。",
            "准备一张桥表，解释财务利润与管理口径利润的差异。",
            "识别是否有亏损合同组，以及亏损来源是定价、费用还是赔付经验。"
        ],
        "learning": "复习 CSM、RA、BEL、亏损组成部分和保险服务结果。"
    },
    {
        "category": "再保险与巨灾风险",
        "keywords": ["再保险", "巨灾", "catastrophe", "reinsurance", "retention", "nat cat", "typhoon"],
        "angle": "可能改变自留额、再保成本、尾部风险资本和财险定价充足性。",
        "actions": [
            "复核当前再保结构下 1-in-100 与 1-in-200 损失情景。",
            "比较不同自留额对利润波动、资本占用和再保费用的影响。",
            "把近期灾害经验纳入下一轮定价或预算假设讨论。"
        ],
        "learning": "复习 XL、quota share、aggregate cover 与巨灾模型输出。"
    }
    ,
    {
        "category": "保险经纪与分销",
        "keywords": ["经纪", "代理", "中介", "broker", "brokerage", "distribution", "渠道", "agency", "commission", "销售"],
        "angle": "可能影响获客成本、佣金结构、客户适当性、销售误导和产品组合。",
        "actions": [
            "拆分渠道价值：新单规模、继续率、赔付经验、费用率和投诉率。",
            "检查佣金或渠道政策变化是否改变产品利润测试假设。",
            "把渠道行为纳入经验分析，避免只看总体赔付率或退保率。"
        ],
        "learning": "复习渠道费用、继续率、佣金递延、适当性管理和销售质量指标。"
    },
    {
        "category": "咨询研究与方法论",
        "keywords": ["研究", "报告", "white paper", "survey", "outlook", "milliman", "wtw", "willis towers watson", "mercer", "deloitte", "pwc", "kpmg", "ey", "mckinsey", "swiss re", "munich re"],
        "angle": "适合沉淀为长期研究主题、假设库、方法论模板或同业 benchmark。",
        "actions": [
            "提炼三条可复用结论：趋势、数据口径、方法论。",
            "判断报告结论是否能转成模型假设、压力情景或管理层汇报图表。",
            "把关键图表或指标加入个人知识库，并记录适用市场和限制条件。"
        ],
        "learning": "复习经验研究、外部 benchmark、假设设定和管理层叙事。"
    }
]

DEFAULT_RULE = {
    "category": "行业趋势",
    "angle": "值得持续观察其对产品、风险、资本和客户行为的间接影响。",
    "actions": [
        "记录它可能影响的精算假设，并标注需要哪些数据验证。",
        "找一个同业或历史案例做对照，判断这是一日新闻还是长期趋势。",
        "把结论写成三句话，沉淀到个人知识库。"
    ],
    "learning": "练习把行业事件翻译成假设、现金流、资本和利润四个维度。"
}


def clean_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def parse_date(value: str) -> str:
    if not value:
        return ""
    try:
        parsed = email.utils.parsedate_to_datetime(value)
        return parsed.date().isoformat()
    except (TypeError, ValueError):
        return clean_text(value)[:30]


def fetch_url(url: str, timeout: int = 12) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "ActuaryDigestMVP/0.1 (+local learning prototype)"
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


class ReadableTextExtractor(HTMLParser):
    SKIP_TAGS = {"script", "style", "noscript", "svg", "canvas", "form", "nav", "footer", "header", "aside"}
    BLOCK_TAGS = {"p", "article", "main", "section", "h1", "h2", "h3", "li", "blockquote"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._skip_depth = 0
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in self.SKIP_TAGS:
            self._skip_depth += 1
            return
        if self._skip_depth == 0 and tag in self.BLOCK_TAGS:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in self.SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1
            return
        if self._skip_depth == 0 and tag in self.BLOCK_TAGS:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            text = clean_text(data)
            if text:
                self._parts.append(text)

    def text(self) -> str:
        text = " ".join(part.strip() for part in self._parts if part.strip())
        text = re.sub(r"\s+", " ", text).strip()
        boilerplate = [
            "accept cookies", "cookie policy", "privacy policy", "all rights reserved",
            "sign up", "newsletter", "subscribe to", "advertisement", "skip to content",
            "accepter les cookies", "politique de confidentialité", "abonnez-vous",
            "版权所有", "隐私政策", "广告", "登录", "注册"
        ]
        sentences = split_sentences(text)
        filtered = [sentence for sentence in sentences if not any(term in sentence.lower() for term in boilerplate)]
        return " ".join(filtered)


def split_sentences(text: str) -> list[str]:
    return [
        part.strip()
        for part in re.split(r"(?<=[.!?。！？])\s+|[；;]\s*", clean_text(text))
        if part.strip()
    ]


def is_paywalled_text(text: str) -> bool:
    lowered = text.lower()
    markers = [
        "subscribe to continue", "subscription required", "sign in to continue",
        "registration required", "paywall", "log in to continue",
        "abonnez-vous", "connectez-vous", "réservé aux abonnés",
        "订阅", "付费", "登录后", "注册后"
    ]
    return any(marker in lowered for marker in markers)


def extract_readable_article_text(url: str, timeout: int = 8) -> tuple[str, str]:
    if not url:
        return "", "title_only"
    if is_google_news_url(url):
        return "", "unresolved_google_news"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; ActuaryRadar/0.1; +https://actuaryradar.com)"
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status = getattr(response, "status", 200)
            content_type = response.headers.get("content-type", "")
            if status in {401, 402, 403}:
                return "", "paywalled_or_blocked"
            if "html" not in content_type.lower():
                return "", "unsupported_content"
            charset = response.headers.get_content_charset() or "utf-8"
            payload = response.read(700_000)
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 402, 403, 451}:
            return "", "paywalled_or_blocked"
        return "", "fetch_failed"
    except (urllib.error.URLError, TimeoutError, ValueError):
        return "", "fetch_failed"

    html_text = payload.decode(charset, errors="replace")
    extractor = ReadableTextExtractor()
    try:
        extractor.feed(html_text)
    except Exception:
        return "", "parse_failed"
    extracted = extractor.text()
    if len(extracted) >= 700:
        return extracted[:12_000], "extracted"
    if is_paywalled_text(html_text) or is_paywalled_text(extracted):
        return "", "paywalled_or_blocked"
    return extracted, "too_short" if extracted else "no_readable_text"


def enrich_article_extraction(item: NewsItem) -> NewsItem:
    text, status = extract_readable_article_text(item.original_url or item.url)
    if status == "extracted":
        basis = "article_text"
    elif item.summary and not is_title_like(item.summary, item.title):
        basis = "rss_excerpt"
    elif status == "paywalled_or_blocked":
        basis = "paywalled_or_blocked"
    else:
        basis = "title_only"
    return dataclasses.replace(
        item,
        rss_title=item.rss_title or item.title,
        rss_description=item.rss_description or item.summary,
        extracted_text=text,
        extraction_status=status,
        summary_basis=basis,
    )


def is_google_news_url(url: str) -> bool:
    host = urllib.parse.urlparse(url or "").netloc.lower()
    return host.endswith("news.google.com")


def resolve_google_news_url(url: str, timeout: int = 8) -> str:
    if not is_google_news_url(url):
        return url
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; ActuaryRadar/0.1)"
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            resolved = response.geturl()
    except (urllib.error.URLError, TimeoutError, ValueError):
        return ""
    return "" if is_google_news_url(resolved) else resolved


def parse_rss(payload: bytes, source_name: str, max_items: int) -> list[NewsItem]:
    root = ET.fromstring(payload)
    items: list[NewsItem] = []
    for node in root.findall(".//item")[:max_items]:
        title = clean_text(node.findtext("title"))
        link = clean_text(node.findtext("link"))
        source_node = node.find("source")
        publisher_name = clean_text(source_node.text if source_node is not None else "")
        publisher_url = clean_text(source_node.attrib.get("url", "") if source_node is not None else "")
        via_source = "Google News" if is_google_news_url(link) or "google news" in source_name.lower() else ""
        original_url = resolve_google_news_url(link) if is_google_news_url(link) else link
        published = parse_date(node.findtext("pubDate") or node.findtext("published") or "")
        summary = clean_text(node.findtext("description") or node.findtext("summary") or "")
        if title and link:
            display_source = publisher_name or source_name
            items.append(NewsItem(
                title=title,
                source=display_source,
                url=original_url or link,
                published=published,
                summary=summary,
                source_name=publisher_name or display_source,
                source_url=publisher_url,
                original_url=original_url,
                via_source=via_source,
                rss_title=title,
                rss_description=summary,
            ))
    return items


def load_config() -> dict:
    with (ROOT / "config" / "sources.json").open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_preferences(path: pathlib.Path = DEFAULT_PREFERENCES_PATH) -> dict:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_samples() -> list[NewsItem]:
    with (ROOT / "data" / "sample_items.json").open("r", encoding="utf-8") as handle:
        records = json.load(handle)
    return [NewsItem(**record) for record in records]


def collect_items(config: dict, report_date: str) -> tuple[list[NewsItem], list[str]]:
    items: list[NewsItem] = []
    errors: list[str] = []
    limit = int(config.get("limits", {}).get("max_items_per_source", 8))
    for source in config.get("rss_sources", []):
        try:
            payload = fetch_url(source["url"])
            parsed = parse_rss(payload, source["name"], limit)
            for item in parsed:
                items.append(dataclasses.replace(
                    item,
                    region=source.get("region", "Global"),
                    source_type=source.get("source_type", "News"),
                    language=source.get("language", "en"),
                ))
        except (urllib.error.URLError, TimeoutError, ET.ParseError, KeyError) as exc:
            errors.append(f"{source.get('name', 'Unknown source')}: {exc}")

    deduped: list[NewsItem] = []
    seen: set[str] = set()
    for item in items:
        key = re.sub(r"\W+", "", item.title.lower())[:80]
        if key not in seen:
            seen.add(key)
            deduped.append(item)
    return [enrich_article_extraction(item) for item in deduped], errors


def score_item(item: NewsItem, focus_profile: dict | None = None) -> int:
    text = f"{item.title} {item.summary}".lower()
    score = 0
    for rule in KEYWORD_RULES:
        for keyword in rule["keywords"]:
            if keyword.lower() in text:
                score += 3
    if any(word in text for word in ["精算", "actuarial", "准备金", "reserve", "pricing", "定价"]):
        score += 4
    if item.published:
        score += 1
    if focus_profile:
        score += focus_boost(item, focus_profile)
    return score


def focus_boost(item: NewsItem, focus_profile: dict) -> int:
    text = f"{item.title} {item.summary} {item.source}".lower()
    boost = 0
    for keyword in focus_profile.get("keywords", []):
        if keyword.lower() in text:
            boost += 6
    for tag in focus_profile.get("personal_tags", []):
        if tag.lower() in text:
            boost += 4
    for region in focus_profile.get("regions", []):
        if region == item.region:
            boost += 2
    return boost


def detect_language(item: NewsItem) -> str:
    text = f"{item.title} {item.summary} {item.source}"
    if re.search(r"[\u3400-\u9fff]", text):
        return "ZH"
    source = item.source.lower()
    if (
        re.search(r"[àâçéèêëîïôùûüÿœæ]", text.lower())
        or "argus" in source
        or "assurances pro" in source
        or "institut des actuaires" in source
        or "acpr" in source
    ):
        return "FR"
    return "EN"


def professional_terms(text: str, language: str) -> list[str]:
    lowered = text.lower()
    terms: list[str] = []
    fr_terms = {
        "prévoyance": "death, disability and incapacity protection / 身故、伤残、失能保障",
        "assurance affinitaire": "affinity or embedded insurance / 场景保险、嵌入式保险",
        "assurance dommages": "non-life / P&C insurance / 财产险、非寿险",
        "assurance vie": "life insurance / 寿险",
        "épargne retraite": "retirement savings / 养老储蓄",
        "sinistre": "claim / 理赔案件",
        "courtage": "brokerage / 经纪业务",
        "mutuelle": "mutual insurer or health mutual / 互助保险机构或补充健康险机构",
        "complémentaire santé": "supplementary health insurance / 补充健康险",
        "réassurance": "reinsurance / 再保险",
        "provisionnement": "reserving / 准备金计提",
        "tarification": "pricing / 定价",
    }
    en_terms = {
        "underwriting": "核保/承保",
        "claims": "理赔",
        "reserving": "准备金",
        "loss ratio": "赔付率",
        "combined ratio": "综合成本率",
        "solvency ratio": "偿付能力充足率",
        "embedded insurance": "嵌入式保险/场景保险",
        "affinity insurance": "场景保险/团体渠道保险/嵌入式保险",
        "p&c": "财产险/非寿险",
        "life & health": "寿险与健康险",
    }
    for key, value in {**fr_terms, **en_terms}.items():
        if key.lower() in lowered:
            terms.append(f"{key} = {value}")
    return terms[:3]


def classify_taxonomy(item: NewsItem) -> tuple[str, list[str], bool]:
    text = f"{item.title} {item.summary} {item.source}".lower()
    section_scores: list[tuple[int, str, list[str]]] = []
    for section, default_tags, keywords in TAXONOMY_RULES:
        hits = sum(1 for keyword in keywords if keyword.lower() in text)
        if hits:
            section_scores.append((hits, section, default_tags))
    section_scores.sort(reverse=True)
    if section_scores:
        hits, primary, default_tags = section_scores[0]
        needs_review = hits < 2
    else:
        primary = "market"
        default_tags = ["risk_management"]
        needs_review = True

    tags = []
    for tag, keywords in SECONDARY_RULES:
        if any(keyword.lower() in text for keyword in keywords):
            tags.append(tag)
    for tag in default_tags:
        if tag not in tags:
            tags.append(tag)
    return primary, tags[:3], needs_review


def taxonomy_label(key: str, language: str) -> str:
    return SECTION_LABELS.get(key, SECTION_LABELS["market"]).get(language, SECTION_LABELS["market"]["en"])


def localized_intelligence_title(item: NewsItem, primary: str, tags: list[str], language: str) -> str:
    section = taxonomy_label(primary, language)
    source = safe_source_label(item.source, language)
    if language == "zh":
        return f"{section}情报：{source}发布一项值得精算人跟踪的保险动态"
    if language == "fr":
        return f"Veille {section} : un signal assurance à suivre depuis {source}"
    return f"{section} intelligence: a source item to track from {source}"


def normalize_for_similarity(value: str) -> str:
    return re.sub(r"[\W_]+", "", clean_text(value).lower())


def is_title_like(value: str, title: str) -> bool:
    normalized = normalize_for_similarity(value)
    normalized_title = normalize_for_similarity(title)
    if not normalized or not normalized_title:
        return False
    if normalized == normalized_title:
        return True
    return len(normalized) < 260 and (normalized in normalized_title or normalized_title in normalized)


def source_text_for_summary(item: NewsItem) -> str:
    if item.summary_basis == "article_text" and item.extracted_text:
        return item.extracted_text
    if item.summary_basis == "rss_excerpt" and item.summary and not is_title_like(item.summary, item.title):
        return item.summary
    return ""


def informative_sentences(item: NewsItem, max_sentences: int = 4) -> list[str]:
    text = source_text_for_summary(item)
    if not text:
        return []
    blocked = [
        "google news", "source summary", "this item falls under", "original source",
        "read more", "click here", "cookie", "newsletter", "advertisement",
        "cette information relève", "point essentiel", "来源为", "原文要点显示"
    ]
    sentences: list[str] = []
    for sentence in split_sentences(text):
        if is_title_like(sentence, item.title):
            continue
        lowered = sentence.lower()
        if any(term in lowered for term in blocked):
            continue
        if len(sentence) < 45 and not re.search(r"[\u3400-\u9fff]", sentence):
            continue
        if sentence not in sentences:
            sentences.append(concise_backend_text(sentence, 230))
        if len(sentences) >= max_sentences:
            break
    return sentences


def concise_backend_text(value: str, max_length: int = 220) -> str:
    text = clean_text(value)
    if len(text) <= max_length:
        return text
    return text[: max_length - 1].rstrip(" ,.;:，。；：") + "…"


def localized_key_takeaway(item: NewsItem, language: str) -> str:
    sentences = informative_sentences(item, 1)
    return sentences[0] if sentences else ""


def localized_ai_summary(item: NewsItem, primary: str, tags: list[str], language: str) -> str:
    terms = professional_terms(f"{item.title} {item.summary}", language)
    term_note = f" Key terminology: {'; '.join(terms)}." if terms and language == "en" else ""
    if terms and language == "zh":
        term_note = f" 术语提示：{'；'.join(terms)}。"
    elif terms and language == "fr":
        term_note = f" Terminologie clé : {' ; '.join(terms)}."
    sentences = informative_sentences(item, 4)
    if not sentences:
        return ""
    summary_sentences = sentences[1:4] if len(sentences) > 1 else sentences[:1]
    summary = " ".join(summary_sentences)
    return f"{summary}{term_note}".strip()


def safe_source_label(source: str, language: str) -> str:
    if language == "zh" or not re.search(r"[\u3400-\u9fff]", source or ""):
        return source or "source"
    lowered = (source or "").lower()
    if "google news" in lowered:
        return "Chinese insurance news feed" if language == "en" else "flux d'actualité assurance chinois"
    return "Chinese-language source" if language == "en" else "source en langue chinoise"


def localized_why_it_matters(item: NewsItem, primary: str, tags: list[str], language: str) -> str:
    text = f"{item.title} {item.summary} {item.extracted_text[:1200]}".lower()
    tag_set = set(tags)
    if primary == "regulation" or {"solvency_ii", "regulation", "ifrs17"} & tag_set:
        if language == "zh":
            return "这类监管更新可能改变报告口径、资本约束或合规流程。精算人应关注模型假设、披露要求和管理层行动是否需要同步调整。"
        if language == "fr":
            return "Cette évolution peut modifier les exigences de reporting, de capital ou de gouvernance. Les actuaires doivent vérifier les impacts sur les hypothèses, les contrôles et les livrables réglementaires."
        return "This development can change reporting, capital or governance requirements. Actuaries should check whether assumptions, controls and regulatory deliverables need updating."
    if primary == "reinsurance" or "reinsurance" in tag_set:
        if language == "zh":
            return "再保险动态会影响自留额、保障层级、巨灾暴露和资本缓释效果。它也会传导到原保险定价、预算波动和风险偏好。"
        if language == "fr":
            return "Les évolutions de réassurance influencent la rétention, les protections, l’exposition catastrophe et l’allègement du capital. Elles peuvent aussi se répercuter sur la tarification et la volatilité du résultat."
        return "Reinsurance developments affect retentions, cover structure, catastrophe exposure and capital relief. They can also flow through to primary pricing, earnings volatility and risk appetite."
    if primary == "technology_ai" or {"data_ai", "insurtech"} & tag_set:
        if language == "zh":
            return "科技与 AI 新闻的关键在于是否真正改变核保、理赔、反欺诈或分销效率。精算人还需要关注数据质量、模型治理和监管可解释性。"
        if language == "fr":
            return "L’enjeu est de savoir si l’IA ou l’InsurTech améliore réellement la souscription, les sinistres, la fraude ou la distribution. Les points de vigilance restent la qualité des données, la gouvernance des modèles et l’explicabilité."
        return "The key question is whether AI or InsurTech changes underwriting, claims, fraud detection or distribution economics. Data quality, model governance and explainability remain the actuarial control points."
    if primary == "company_results_strategy" or any(word in text for word in ["earnings", "results", "annual report", "csm", "财报", "业绩", "résultats"]):
        if language == "zh":
            return "公司业绩会揭示增长、利润率、CSM、资本和再保使用的真实压力点。精算人可以用它更新同业 benchmark 和管理层叙事。"
        if language == "fr":
            return "Les résultats d’un assureur révèlent les tensions sur la croissance, les marges, le CSM, le capital et la réassurance. Ils alimentent les benchmarks et le dialogue avec le management."
        return "Insurer results reveal pressure points in growth, margins, CSM, capital and reinsurance use. They are useful for peer benchmarking and management narratives."
    if "catastrophe_risk" in tag_set or any(word in text for word in ["catastrophe", "hurricane", "flood", "wildfire", "earthquake", "巨灾", "tempête", "inondation"]):
        if language == "zh":
            return "巨灾事件会影响损失频率、严重程度、再保恢复和资本尾部风险。相关信息应进入下一轮定价、准备金和情景测试。"
        if language == "fr":
            return "Un événement catastrophe peut modifier la fréquence, la sévérité, les récupérations de réassurance et le risque extrême en capital. Il doit nourrir la tarification, le provisionnement et les scénarios de stress."
        return "Catastrophe events can change frequency, severity, reinsurance recoveries and tail capital risk. They should feed the next pricing, reserving and stress-testing cycle."
    if primary == "research":
        if language == "zh":
            return "研究报告的价值在于把市场信号转化为假设、情景和方法论。适合沉淀到个人知识库或用于管理层汇报。"
        if language == "fr":
            return "Une publication de recherche transforme des signaux de marché en hypothèses, scénarios et méthodes. Elle peut nourrir une base de connaissances ou un support de comité."
        return "Research turns market signals into assumptions, scenarios and methods. It can support a knowledge base, management pack or model review."
    if primary == "career_learning":
        if language == "zh":
            return "这类内容帮助精算人补齐技能、资格和行业理解。它适合作为学习计划或职业路径中的具体行动项。"
        if language == "fr":
            return "Ce contenu aide à développer les compétences, la qualification et la culture sectorielle. Il peut devenir une action concrète dans un parcours de formation."
        return "This content supports skills, qualification and sector knowledge. It can become a concrete action in a professional learning plan."
    if language == "zh":
        return "这条市场信号可能影响产品需求、渠道行为或竞争定价。建议关注它是否会持续改变保费增长、赔付经验或客户选择。"
    if language == "fr":
        return "Ce signal de marché peut influencer la demande, la distribution ou la concurrence tarifaire. Il faut suivre son effet sur la croissance des primes, l’expérience sinistres ou les comportements clients."
        return "This market signal may affect demand, distribution or competitive pricing. Track whether it changes premium growth, claims experience or customer behavior."


def ai_source_text(item: NewsItem) -> str:
    if item.summary_basis == "article_text" and item.extracted_text:
        return item.extracted_text
    if item.summary_basis == "rss_excerpt" and item.rss_description and not is_title_like(item.rss_description, item.title):
        return item.rss_description
    if item.summary and not is_title_like(item.summary, item.title):
        return item.summary
    return ""


def select_ai_provider(requested: str) -> str:
    provider = (requested or "auto").lower()
    if provider == "none":
        return "none"
    if provider in {"openai", "perplexity"}:
        return provider
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    if os.getenv("PERPLEXITY_API_KEY"):
        return "perplexity"
    return "none"


def ai_language_for_item(item: NewsItem) -> str:
    detected = detect_language(item)
    return detected if detected in {"en", "zh", "fr"} else "en"


def ai_enrichment_prompt(item: NewsItem, card: ActionCard, source_text: str, language: str) -> list[dict[str, str]]:
    language_name = {"en": "English", "zh": "Chinese", "fr": "French"}.get(language, "English")
    system = (
        "You are an insurance intelligence editor for actuaries, reinsurers and risk professionals. "
        "Use only the supplied article text. Do not invent facts, figures, sources or URLs. "
        "If the text is insufficient, return empty strings. "
        "Return strict JSON only."
    )
    user = {
        "task": "Generate source-grounded insurance intelligence fields.",
        "output_language": language_name,
        "required_json_schema": {
            "key_takeaway": "One concise sentence stating what happened.",
            "summary_bullets": ["Two or three short bullets grounded in the article text."],
            "why_it_matters": "One or two concise sentences for insurance, actuarial, reinsurance or risk professionals."
        },
        "rules": [
            "Do not repeat the title as the summary.",
            "Do not mention that you are an AI.",
            "Do not use generic wording such as 'may affect pricing assumptions, reserving and capital' unless the article text supports those links.",
            "Prefer actuarial relevance: pricing, reserving, capital, claims, risk management, IFRS 17, Solvency II, reinsurance, distribution, AI governance or market strategy.",
            "If the article text is only a title or too thin, return empty fields."
        ],
        "article": {
            "title": item.title,
            "source": item.source_name or item.source,
            "published": item.published,
            "category": card.taxonomy_category,
            "tags": card.taxonomy_tags,
            "summary_basis": item.summary_basis,
            "text": concise_backend_text(source_text, 6000)
        }
    }
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(user, ensure_ascii=False)}
    ]


def post_json(url: str, payload: dict, headers: dict[str, str], timeout: int = 30) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def extract_json_object(text: str) -> dict:
    cleaned = clean_text(text)
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.S)
        if not match:
            raise
        return json.loads(match.group(0))


def call_openai_enrichment(messages: list[dict[str, str]], model: str) -> dict:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    payload = {
        "model": model or os.getenv("OPENAI_MODEL") or DEFAULT_AI_MODEL,
        "messages": messages,
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }
    data = post_json(
        "https://api.openai.com/v1/chat/completions",
        payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return extract_json_object(content)


def call_perplexity_enrichment(messages: list[dict[str, str]], model: str) -> dict:
    api_key = os.getenv("PERPLEXITY_API_KEY", "")
    if not api_key:
        raise RuntimeError("PERPLEXITY_API_KEY is not set")
    payload = {
        "model": model or os.getenv("PERPLEXITY_MODEL") or DEFAULT_PERPLEXITY_MODEL,
        "messages": messages,
        "temperature": 0.2,
    }
    data = post_json(
        "https://api.perplexity.ai/chat/completions",
        payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return extract_json_object(content)


def sanitize_ai_enrichment(raw: dict) -> dict[str, str]:
    bullets = raw.get("summary_bullets") or raw.get("ai_summary") or []
    if isinstance(bullets, str):
        bullets = split_sentences(bullets)
    bullets = [concise_backend_text(str(item), 220) for item in bullets if clean_text(str(item))][:3]
    return {
        "key_takeaway": concise_backend_text(str(raw.get("key_takeaway", "")), 260),
        "ai_summary": " ".join(bullets),
        "why_it_matters": concise_backend_text(str(raw.get("why_it_matters", "")), 360),
    }


def ai_enrich_cards(
    items: list[NewsItem],
    cards: dict[str, ActionCard],
    provider: str,
    model: str,
    max_items: int,
) -> tuple[dict[str, ActionCard], list[str]]:
    selected_provider = select_ai_provider(provider)
    if selected_provider == "none":
        return cards, []
    updated = dict(cards)
    errors: list[str] = []
    enriched_count = 0
    for item in items:
        if enriched_count >= max_items:
            break
        source_text = ai_source_text(item)
        if len(source_text) < 350:
            continue
        card = updated[item.url]
        language = ai_language_for_item(item)
        messages = ai_enrichment_prompt(item, card, source_text, language)
        try:
            if selected_provider == "openai":
                raw = call_openai_enrichment(messages, model or DEFAULT_AI_MODEL)
            else:
                raw = call_perplexity_enrichment(messages, model or DEFAULT_PERPLEXITY_MODEL)
            clean = sanitize_ai_enrichment(raw)
        except Exception as exc:
            errors.append(f"AI enrichment failed for {item.source}: {exc}")
            continue
        if not any(clean.values()):
            continue
        key_takeaway = dict(card.key_takeaway)
        ai_summary = dict(card.ai_summary)
        why_it_matters = dict(card.why_it_matters)
        if clean["key_takeaway"]:
            key_takeaway[language] = clean["key_takeaway"]
        if clean["ai_summary"]:
            ai_summary[language] = clean["ai_summary"]
        if clean["why_it_matters"]:
            why_it_matters[language] = clean["why_it_matters"]
        updated[item.url] = dataclasses.replace(
            card,
            key_takeaway=key_takeaway,
            ai_summary=ai_summary,
            why_it_matters=why_it_matters,
            ai_enriched=True,
            enrichment_provider=selected_provider,
            enrichment_basis=item.summary_basis,
        )
        enriched_count += 1
    return updated, errors


def build_action_card(item: NewsItem) -> ActionCard:
    text = f"{item.title} {item.summary}".lower()
    matched_rules = []
    for rule in KEYWORD_RULES:
        hits = sum(1 for keyword in rule["keywords"] if keyword.lower() in text)
        if hits:
            matched_rules.append((hits, rule))
    matched_rules.sort(key=lambda pair: pair[0], reverse=True)
    rule = matched_rules[0][1] if matched_rules else DEFAULT_RULE
    taxonomy_category, taxonomy_tags, needs_review = classify_taxonomy(item)
    original_language = detect_language(item)
    score = score_item(item)
    risk_level = "高" if score >= 12 else "中" if score >= 6 else "观察"
    shareable = f"{item.title}：对精算人来说，关键不是新闻本身，而是它会怎样改变假设、现金流、资本和利润。"
    return ActionCard(
        category=rule["category"],
        taxonomy_category=taxonomy_category,
        taxonomy_tags=taxonomy_tags,
        needs_review=needs_review,
        risk_level=risk_level,
        actuarial_angle=rule["angle"],
        actions=list(rule["actions"]),
        learning_prompt=rule["learning"],
        shareable=shareable,
        score=score,
        region=item.region,
        line_of_business=infer_line_of_business(item),
        branch=infer_branch(item),
        platform_section=taxonomy_category,
        industry_category=infer_industry_category(item),
        original_language=original_language,
        localized_title={
            "en": localized_intelligence_title(item, taxonomy_category, taxonomy_tags, "en"),
            "zh": localized_intelligence_title(item, taxonomy_category, taxonomy_tags, "zh"),
            "fr": localized_intelligence_title(item, taxonomy_category, taxonomy_tags, "fr"),
        },
        key_takeaway={
            "en": localized_key_takeaway(item, "en"),
            "zh": localized_key_takeaway(item, "zh"),
            "fr": localized_key_takeaway(item, "fr"),
        },
        ai_summary={
            "en": localized_ai_summary(item, taxonomy_category, taxonomy_tags, "en"),
            "zh": localized_ai_summary(item, taxonomy_category, taxonomy_tags, "zh"),
            "fr": localized_ai_summary(item, taxonomy_category, taxonomy_tags, "fr"),
        },
        why_it_matters={
            "en": localized_why_it_matters(item, taxonomy_category, taxonomy_tags, "en"),
            "zh": localized_why_it_matters(item, taxonomy_category, taxonomy_tags, "zh"),
            "fr": localized_why_it_matters(item, taxonomy_category, taxonomy_tags, "fr"),
        },
        ai_enriched=False,
        enrichment_provider="rules",
        enrichment_basis=item.summary_basis,
    )


def infer_line_of_business(item: NewsItem) -> str:
    text = f"{item.title} {item.summary}".lower()
    checks = [
        ("寿险/年金", ["寿险", "life", "annuity", "年金", "分红险", "终身寿险", "定期寿险"]),
        ("健康险/医疗险", ["健康险", "医疗", "health", "medical", "long-term care", "护理"]),
        ("信用/保证保险", ["信用保险", "信贷保险", "保证保险", "trade credit", "credit insurance", "surety", "bond insurance", "mortgage insurance"]),
        ("金融险/专业责任", ["金融险", "董事责任", "董责险", "d&o", "financial lines", "professional indemnity", "errors and omissions", "e&o", "金融机构保险"]),
        ("特殊险/政治风险", ["特殊险", "specialty", "political risk", "terrorism insurance", "aviation", "marine", "cargo", "satellite", "space insurance", "energy insurance"]),
        ("网络安全保险", ["网络安全保险", "cyber insurance", "cyber risk", "ransomware"]),
        ("工程险/能源险", ["工程险", "construction insurance", "engineering insurance", "energy insurance", "renewable energy insurance", "offshore wind"]),
        ("责任险", ["责任险", "liability", "general liability", "product liability", "employers liability"]),
        ("财产险", ["财险", "财产险", "property", "commercial property", "homeowners"]),
        ("车险/出行", ["车险", "汽车", "auto insurance", "motor insurance", "telematics", "智能网联", "新能源车"]),
        ("农业险/巨灾", ["农险", "农业", "catastrophe", "巨灾", "nat cat", "flood", "wildfire", "typhoon"]),
        ("再保险", ["再保险", "reinsurance", "retrocession"]),
    ]
    for label, keywords in checks:
        if any(keyword in text for keyword in keywords):
            return label
    return "综合保险"


def infer_industry_category(item: NewsItem) -> str:
    text = f"{item.title} {item.summary} {item.source}".lower()
    checks = [
        ("银行/信贷", ["银行", "bank", "credit", "loan", "mortgage", "private credit"]),
        ("投行/资本市场", ["投行", "investment bank", "capital markets", "securit", "bond", "rating", "investor", "ir", "earnings"]),
        ("车企/出行", ["车企", "汽车", "auto", "motor", "ev", "新能源汽车", "telematics"]),
        ("能源/电力", ["能源", "energy", "power", "renewable", "solar", "wind", "oil", "gas"]),
        ("医疗/健康服务", ["医疗", "healthcare", "hospital", "pharma", "medical"]),
        ("地产/工程", ["地产", "real estate", "construction", "infrastructure", "engineering"]),
        ("科技/网络安全", ["科技", "technology", "ai", "digital", "cyber", "data center", "cloud"]),
        ("气候/巨灾", ["climate", "catastrophe", "hurricane", "earthquake", "flood", "wildfire", "storm"]),
    ]
    for label, keywords in checks:
        if any(keyword in text for keyword in keywords):
            return label
    return "保险本业/其他"


def infer_branch(item: NewsItem) -> str:
    text = f"{item.title} {item.summary}".lower()
    checks = [
        ("再保险", ["再保险", "reinsurance", "retrocession"]),
        ("保险经纪/中介", ["经纪", "中介", "代理", "broker", "brokerage", "agency"]),
        ("保险公司", ["保险公司", "insurer", "insurance company", "人寿", "财险", "life insurance"]),
        ("监管/协会/专业机构", ["监管", "协会", "eiopa", "naic", "nfra", "ifrs", "soa", "ifoa"]),
    ]
    for label, keywords in checks:
        if any(keyword in text for keyword in keywords):
            return label
    return "生态伙伴/其他行业"


def infer_platform_section(category: str, item: NewsItem) -> str:
    if category in {"监管与合规", "偿付能力与资本"}:
        return "法规与资本雷达"
    if category == "保险科技与数据前沿":
        return "科技前沿与落地"
    if category == "跨行业联动":
        return "跨行业联动"
    if category in {"再保险与巨灾风险", "保险经纪与分销"}:
        return "行业分支观察"
    if category in {"财报与 IFRS 17"}:
        return "公司财报与战略"
    if category == "咨询研究与方法论":
        return "研究方向与咨询报告"
    return "行业趋势与学习"


def select_items(items: Iterable[NewsItem], max_report_items: int, focus_profile: dict | None = None) -> list[NewsItem]:
    eligible = []
    for item in items:
        card = build_action_card(item)
        if card.platform_section != "company_results_strategy":
            eligible.append(item)
    return sorted(eligible, key=lambda item: score_item(item, focus_profile), reverse=True)[:max_report_items]


def render_markdown(items: list[NewsItem], cards: dict[str, ActionCard], report_date: str, errors: list[str], used_samples: bool, focus_profile: dict) -> str:
    concept = daily_concept(report_date)
    lines = [
        f"# 保险精算人每日学习平台简报",
        "",
        f"日期：{report_date}",
        "",
        "## 今日总览",
        "",
        f"- 今日精选：{len(items)} 条",
        f"- 数据模式：{'样例数据（网络抓取失败或未启用）' if used_samples else 'RSS 自动抓取'}",
        f"- 覆盖地区：{', '.join(sorted({cards[item.url].region for item in items}))}",
        f"- 今日主题：{focus_profile.get('theme', '综合保险学习')}",
        f"- 个人关注标签：{', '.join(focus_profile.get('personal_tags', []))}",
        "- 阅读方式：先看“建议行动”，再决定是否深入原文。",
        "",
        "## 今日主题学习任务",
        "",
        f"**主题**：{focus_profile.get('theme', '综合保险学习')}",
        "",
        f"**学习目标**：{focus_profile.get('learning_goal', '把今日信息转化为精算判断、行动和可复用笔记。')}",
        "",
        "**建议产出**：",
    ]
    lines.extend([f"{idx}. {task}" for idx, task in enumerate(focus_profile.get("tasks", []), start=1)])
    lines.extend([
        "",
        "## 平台板块索引",
        "",
        "- 法规与资本雷达：欧洲、美国、中国监管差异和资本要求。",
        "- 科技前沿与落地：AI、数据、车联网、网络安全、自动化理赔等。",
        "- 跨行业联动：银行、投行、车企、能源、医疗、数据中心等。",
        "- 行业分支观察：再保险、经纪中介、财险、寿险、健康险、车险。",
        "- 公司财报与战略：大保险公司业绩、IFRS 17、EV/NBV、资本策略。",
        "- 研究方向与咨询报告：SOA、IFoA、IFRS、咨询公司和再保研究。",
        "",
        "## 每日精算概念复习",
        "",
        f"**{concept['term']}**：{concept['definition']}",
        "",
        f"**精算人练习**：{concept['exercise']}",
        "",
    ])
    if errors:
        lines.extend(["## 抓取提示", ""])
        lines.extend([f"- {error}" for error in errors[:5]])
        lines.append("")

    for idx, item in enumerate(items, start=1):
        card = cards[item.url]
        lines.extend(
            [
                f"## {idx}. {item.title}",
                "",
                f"- 来源：{item.source}",
                f"- 时间：{item.published or '未标注'}",
                f"- 链接：{item.url}",
                f"- 地区：{card.region}",
                f"- 板块：{card.platform_section}",
                f"- 分类：{card.category}",
                f"- 险种：{card.line_of_business}",
                f"- 分支：{card.branch}",
                f"- 联动行业：{card.industry_category}",
                f"- 风险等级：{card.risk_level}",
                "",
                f"**摘要**：{item.summary or '暂无摘要，建议打开原文快速浏览。'}",
                "",
                f"**精算影响**：{card.actuarial_angle}",
                "",
                "**建议行动**：",
            ]
        )
        lines.extend([f"{pos}. {action}" for pos, action in enumerate(card.actions, start=1)])
        lines.extend(
            [
                "",
                f"**今日学习点**：{card.learning_prompt}",
                "",
                f"**可分享版本**：{card.shareable}",
                "",
            ]
        )

    lines.extend(
        [
            "## 今日 15 分钟练习",
            "",
            "选择上面任意一条信息，写出它对一个保险产品的四段式影响：假设、现金流、利润、资本。",
            "",
            "## 明日可迭代方向",
            "",
            "- 增加固定监管网站 HTML 抓取。",
            "- 接入邮件或企业微信推送。",
            "- 增加个人关注标签：寿险、健康险、财险、再保险、IFRS 17、资本管理。",
        ]
    )
    return "\n".join(lines) + "\n"


def daily_concept(report_date: str) -> dict[str, str]:
    concepts = [
        {
            "term": "CSM 合同服务边际",
            "definition": "IFRS 17 下未赚利润的负债组成部分，随保险服务提供逐步释放。",
            "exercise": "选一家上市险企，写出 CSM 变动可能来自新业务、经验差异、假设变更还是释放。"
        },
        {
            "term": "风险边际 / Risk Margin",
            "definition": "在经济资本或 Solvency II 中，为承担不可对冲保险风险所需的额外补偿。",
            "exercise": "解释为什么长久期寿险和年金业务通常对风险边际更敏感。"
        },
        {
            "term": "赔付率 Loss Ratio",
            "definition": "赔款及相关理赔成本相对保费的比例，是健康险、财险和车险经验分析核心指标。",
            "exercise": "把赔付率拆成出险频率、案均赔款、责任结构和渠道质量四个驱动。"
        },
        {
            "term": "资产负债久期匹配",
            "definition": "通过资产现金流和负债现金流期限结构匹配，控制利率变化带来的经济价值波动。",
            "exercise": "说明利率下行 50bp 对保证利率寿险产品的资产端和负债端分别有什么影响。"
        },
        {
            "term": "巨灾超赔再保险 XL",
            "definition": "超过自留额后由再保险人承担约定层级损失的非比例再保险安排。",
            "exercise": "画出 1-in-100 巨灾损失下，自留额、限额和恢复保费对净损失的影响。"
        },
    ]
    try:
        index = dt.date.fromisoformat(report_date).toordinal() % len(concepts)
    except ValueError:
        index = 0
    return concepts[index]


def render_html(markdown: str, report_date: str) -> str:
    body = markdown_to_html(markdown)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>保险精算人每日情报与行动简报 - {html.escape(report_date)}</title>
  <style>
    :root {{
      color-scheme: light;
      --ink: #202124;
      --muted: #667085;
      --line: #d8dee8;
      --paper: #ffffff;
      --bg: #f6f7f9;
      --accent: #0f766e;
      --accent-2: #b45309;
    }}
    body {{
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.65;
    }}
    main {{
      width: min(980px, calc(100% - 32px));
      margin: 32px auto 56px;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: clamp(24px, 5vw, 56px);
      box-sizing: border-box;
    }}
    h1 {{
      font-size: clamp(28px, 5vw, 44px);
      line-height: 1.14;
      margin: 0 0 16px;
      color: #111827;
    }}
    h2 {{
      border-top: 1px solid var(--line);
      padding-top: 24px;
      margin-top: 32px;
      font-size: 22px;
    }}
    p, li {{ font-size: 16px; }}
    a {{ color: var(--accent); overflow-wrap: anywhere; }}
    strong {{ color: var(--accent-2); }}
    ul, ol {{ padding-left: 24px; }}
    code {{
      background: #eef2f6;
      border-radius: 4px;
      padding: 2px 5px;
    }}
  </style>
</head>
<body>
  <main>
{body}
  </main>
</body>
</html>
"""


def markdown_to_html(markdown: str) -> str:
    output: list[str] = []
    list_mode = None
    paragraph: list[str] = []

    def flush_paragraph() -> None:
        if paragraph:
            output.append(f"    <p>{inline(' '.join(paragraph))}</p>")
            paragraph.clear()

    def close_list() -> None:
        nonlocal list_mode
        if list_mode:
            output.append(f"    </{list_mode}>")
            list_mode = None

    for raw in markdown.splitlines():
        line = raw.strip()
        if not line:
            flush_paragraph()
            close_list()
            continue
        if line.startswith("# "):
            flush_paragraph()
            close_list()
            output.append(f"    <h1>{inline(line[2:])}</h1>")
        elif line.startswith("## "):
            flush_paragraph()
            close_list()
            output.append(f"    <h2>{inline(line[3:])}</h2>")
        elif line.startswith("- "):
            flush_paragraph()
            if list_mode != "ul":
                close_list()
                output.append("    <ul>")
                list_mode = "ul"
            output.append(f"      <li>{inline(line[2:])}</li>")
        elif re.match(r"^\d+\. ", line):
            flush_paragraph()
            if list_mode != "ol":
                close_list()
                output.append("    <ol>")
                list_mode = "ol"
            list_text = re.sub(r"^\d+\. ", "", line)
            output.append(f"      <li>{inline(list_text)}</li>")
        else:
            close_list()
            paragraph.append(line)
    flush_paragraph()
    close_list()
    return "\n".join(output)


def inline(value: str) -> str:
    escaped = html.escape(value)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"(https?://[^\s<]+)", r'<a href="\1">\1</a>', escaped)
    return escaped


def render_json(
    items: list[NewsItem],
    cards: dict[str, ActionCard],
    report_date: str,
    used_samples: bool,
    focus_profile: dict,
    company_reports: list[dict] | None = None,
) -> str:
    concept = daily_concept(report_date)
    records = []
    for item in items:
        card = cards[item.url]
        records.append({
            "title": item.title,
            "original_title": item.title,
            "original_language": card.original_language,
            "source_language": item.language,
            "source": item.source,
            "source_name": item.source_name or item.source,
            "source_url": item.source_url,
            "original_url": item.original_url or item.url,
            "via_source": item.via_source,
            "rss_title": item.rss_title or item.title,
            "rss_description": item.rss_description or item.summary,
            "extracted_text": item.extracted_text,
            "extraction_status": item.extraction_status,
            "summary_basis": item.summary_basis,
            "url": item.url,
            "published": item.published,
            "summary": item.summary,
            "localized_title": card.localized_title,
            "key_takeaway": card.key_takeaway,
            "ai_summary": card.ai_summary,
            "why_it_matters": card.why_it_matters,
            "ai_enriched": card.ai_enriched,
            "enrichment_provider": card.enrichment_provider,
            "enrichment_basis": card.enrichment_basis,
            "region": card.region,
            "source_type": item.source_type,
            "platform_section": card.platform_section,
            "category": card.category,
            "taxonomy_category": card.taxonomy_category,
            "taxonomy_tags": card.taxonomy_tags,
            "needs_review": card.needs_review,
            "line_of_business": card.line_of_business,
            "branch": card.branch,
            "industry_category": card.industry_category,
            "risk_level": card.risk_level,
            "score": card.score,
            "actuarial_angle": card.actuarial_angle,
            "actions": card.actions,
            "learning_prompt": card.learning_prompt,
            "shareable": card.shareable,
        })
    featured_article_id = records[0]["url"] if records else ""
    payload = {
        "report_date": report_date,
        "generation_date": report_date,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "mode": "sample" if used_samples else "rss",
        "refresh_log": {
            "last_refresh_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "refresh_status": "sample_fallback" if used_samples else "success",
            "articles_fetched": len(items),
            "articles_added": len(records),
            "daily_concept_id": concept["term"],
            "featured_article_id": featured_article_id,
        },
        "focus_profile": focus_profile,
        "daily_concept": concept,
        "items": records,
        "company_reports": company_reports or [],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def write_reports(output_dir: pathlib.Path, report_date: str, markdown: str, html_report: str, json_report: str) -> tuple[pathlib.Path, pathlib.Path, pathlib.Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = f"insurance_actuary_digest_{report_date}"
    md_path = output_dir / f"{stem}.md"
    html_path = output_dir / f"{stem}.html"
    json_path = output_dir / f"{stem}.json"
    md_path.write_text(markdown, encoding="utf-8")
    html_path.write_text(html_report, encoding="utf-8")
    json_path.write_text(json_report, encoding="utf-8")
    ui_data_dir = ROOT / "ui" / "data"
    if ui_data_dir.exists():
        (ui_data_dir / "digest.json").write_text(json_report, encoding="utf-8")
        update_archive_index(output_dir, ui_data_dir)
    return md_path, html_path, json_path


def update_archive_index(output_dir: pathlib.Path, ui_data_dir: pathlib.Path) -> None:
    records = []
    for path in sorted(output_dir.glob("insurance_actuary_digest_*.json"), reverse=True):
        match = re.search(r"insurance_actuary_digest_(\d{4}-\d{2}-\d{2})\.json$", path.name)
        if not match:
            continue
        report_date = match.group(1)
        title = report_date
        mode = ""
        theme = ""
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            title = payload.get("report_date", report_date)
            mode = payload.get("mode", "")
            theme = payload.get("focus_profile", {}).get("theme", "")
        except (OSError, json.JSONDecodeError):
            pass
        records.append({
            "date": report_date,
            "title": title,
            "mode": mode,
            "theme": theme,
            "json": f"./data/archive/{report_date}.json",
            "html": f"./reports/{report_date}.html",
            "markdown": f"./reports/{report_date}.md",
        })
    (ui_data_dir / "archive_index.json").write_text(
        json.dumps({"archives": records}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def focus_profile_for_date(preferences: dict, report_date: str) -> dict:
    try:
        date_obj = dt.date.fromisoformat(report_date)
    except ValueError:
        date_obj = dt.date.today()
    weekday = str(date_obj.weekday())
    defaults = preferences.get("defaults", {})
    profile = dict(defaults)
    weekday_profile = preferences.get("weekly_schedule", {}).get(weekday, {})
    profile.update(weekday_profile)
    profile["weekday"] = date_obj.strftime("%A")
    return profile


def send_email_report(
    *,
    subject: str,
    html_body: str,
    text_body: str,
    to_addresses: list[str],
    attachments: list[pathlib.Path],
) -> None:
    smtp_user = os.environ.get("GMAIL_ADDRESS") or os.environ.get("ACTUARY_DIGEST_EMAIL_FROM")
    smtp_password = os.environ.get("GMAIL_APP_PASSWORD") or os.environ.get("ACTUARY_DIGEST_EMAIL_PASSWORD")
    if not smtp_user or not smtp_password:
        raise RuntimeError(
            "Missing Gmail credentials. Set GMAIL_ADDRESS and GMAIL_APP_PASSWORD environment variables."
        )

    message = MIMEMultipart("mixed")
    message["Subject"] = subject
    message["From"] = smtp_user
    message["To"] = ", ".join(to_addresses)

    alternative = MIMEMultipart("alternative")
    alternative.attach(MIMEText(text_body, "plain", "utf-8"))
    alternative.attach(MIMEText(html_body, "html", "utf-8"))
    message.attach(alternative)

    for path in attachments:
        part = MIMEApplication(path.read_bytes(), Name=path.name)
        part["Content-Disposition"] = f'attachment; filename="{path.name}"'
        message.attach(part)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(smtp_user, smtp_password)
        smtp.sendmail(smtp_user, to_addresses, message.as_string())


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Generate a daily insurance actuarial intelligence digest."
    )
    parser.add_argument("--date", default=dt.date.today().isoformat(), help="Report date, default: today.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Where to write Markdown and HTML reports.")
    parser.add_argument("--sample-only", action="store_true", help="Skip network fetch and use bundled sample items.")
    parser.add_argument("--preferences", default=str(DEFAULT_PREFERENCES_PATH), help="Weekly theme and personal tag config.")
    parser.add_argument("--send-email", action="store_true", help="Send the generated digest through Gmail SMTP.")
    parser.add_argument("--email-to", action="append", default=[], help="Recipient email address. Can be used multiple times.")
    parser.add_argument("--ai-provider", default="auto", choices=["auto", "none", "openai", "perplexity"], help="Optional daily AI enrichment provider. Default auto uses OPENAI_API_KEY then PERPLEXITY_API_KEY.")
    parser.add_argument("--ai-model", default="", help=f"Optional AI model override. Defaults: OpenAI {DEFAULT_AI_MODEL}, Perplexity {DEFAULT_PERPLEXITY_MODEL}.")
    parser.add_argument("--ai-max-items", type=int, default=8, help="Maximum selected articles to enrich with AI.")
    args = parser.parse_args(argv)

    config = load_config()
    preferences = load_preferences(pathlib.Path(args.preferences))
    focus_profile = focus_profile_for_date(preferences, args.date)
    errors: list[str] = []
    items: list[NewsItem] = []
    used_samples = args.sample_only
    if not args.sample_only:
        items, errors = collect_items(config, args.date)
    if not items:
        items = load_samples()
        used_samples = True

    selected = select_items(items, int(config.get("limits", {}).get("max_report_items", 8)), focus_profile)
    cards = {item.url: build_action_card(item) for item in selected}
    cards, ai_messages = ai_enrich_cards(
        selected,
        cards,
        provider=args.ai_provider,
        model=args.ai_model,
        max_items=max(0, args.ai_max_items),
    )
    errors.extend(ai_messages)
    markdown = render_markdown(selected, cards, args.date, errors, used_samples, focus_profile)
    html_report = render_html(markdown, args.date)
    json_report = render_json(
        selected,
        cards,
        args.date,
        used_samples,
        focus_profile,
        config.get("official_company_reports", []),
    )
    md_path, html_path, json_path = write_reports(pathlib.Path(args.output_dir), args.date, markdown, html_report, json_report)

    if args.send_email:
        recipients = args.email_to or preferences.get("email", {}).get("default_recipients", [])
        if not recipients:
            raise RuntimeError("No email recipients. Use --email-to or set email.default_recipients in preferences.json.")
        subject_prefix = preferences.get("email", {}).get("subject_prefix", "保险精算日报")
        subject = f"{subject_prefix} | {args.date} | {focus_profile.get('theme', '综合')}"
        send_email_report(
            subject=subject,
            html_body=html_report,
            text_body=markdown,
            to_addresses=recipients,
            attachments=[md_path, json_path],
        )

    print(textwrap.dedent(
        f"""
        Generated reports:
        - Markdown: {md_path}
        - HTML:     {html_path}
        - JSON:     {json_path}
        Items: {len(selected)}
        Mode: {'sample' if used_samples else 'rss'}
        Theme: {focus_profile.get('theme', '综合保险学习')}
        Email: {'sent' if args.send_email else 'not sent'}
        """
    ).strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
