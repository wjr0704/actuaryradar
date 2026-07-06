from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import pathlib
from typing import Any

from search_providers import SearchResult, provider_from_config


ROOT = pathlib.Path(__file__).resolve().parents[1]
KNOWLEDGE_PATH = ROOT / "ui" / "data" / "knowledge.json"
TRUSTED_DOMAINS_PATH = ROOT / "config" / "trusted_domains.json"
SEARCH_CONFIG_PATH = ROOT / "config" / "search_api.json"
SEARCH_CONFIG_EXAMPLE_PATH = ROOT / "config" / "search_api.json.example"
SOURCE_SEEDS_PATH = ROOT / "config" / "knowledge_source_seeds.json"

NO_VERIFIED = "No verified source available yet."


def load_json(path: pathlib.Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def trusted_domains(path: pathlib.Path = TRUSTED_DOMAINS_PATH) -> list[str]:
    data = load_json(path, {"trusted_domains": []})
    return data.get("trusted_domains", [])


def search_config(path: pathlib.Path = SEARCH_CONFIG_PATH) -> dict[str, Any]:
    if path.exists():
        return load_json(path, {})
    return load_json(SEARCH_CONFIG_EXAMPLE_PATH, {})


def searchAuthoritativeSources(topic: dict[str, Any], locale: str) -> list[SearchResult]:
    domains = trusted_domains()
    provider = provider_from_config(search_config())
    if not domains or not provider.has_credentials():
        return []
    query = build_query(topic, locale)
    return provider.search(query=query, domains=domains, locale=locale, limit=5)


def seeded_authoritative_sources(topic: dict[str, Any]) -> list[SearchResult]:
    seeds = load_json(SOURCE_SEEDS_PATH, {})
    topic_id = topic.get("topic_id") or topic.get("id")
    return [
        SearchResult(
            title=item.get("title", ""),
            url=item.get("url", ""),
            domain=item.get("domain", ""),
            snippet=""
        )
        for item in seeds.get(topic_id, [])
        if item.get("url")
    ]


def build_query(topic: dict[str, Any], locale: str) -> str:
    translation = topic.get("translations", {}).get(locale) or topic.get("translations", {}).get("zh") or {}
    title = translation.get("title") or topic.get("title") or topic.get("track") or ""
    question = translation.get("learning_question") or topic.get("case", {}).get("question") or ""
    concepts = " ".join(topic.get("concepts", [])[:5])
    return " ".join(part for part in [title, question, concepts, "actuarial insurance"] if part)


def normalize_schema(data: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(data)
    normalized["modules"] = [normalize_module(module) for module in normalized.get("modules", [])]
    return normalized


def normalize_module(module: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(module)
    topic_id = result.get("topic_id") or result.get("id")
    result["topic_id"] = topic_id
    result.setdefault("id", topic_id)
    case = result.get("case", {})
    translations = result.get("translations") or {}
    translations["zh"] = {
        "title": result.get("title", ""),
        "description": result.get("summary", ""),
        "learning_question": case.get("question", ""),
        "generated_answer": case.get("reference_answer", "")
    }
    translations.setdefault("en", {
        "title": "",
        "description": "",
        "learning_question": "",
        "generated_answer": NO_VERIFIED
    })
    translations.setdefault("fr", {
        "title": "",
        "description": "",
        "learning_question": "",
        "generated_answer": NO_VERIFIED
    })
    result["translations"] = translations
    result["grounding"] = ensure_grounding(result.get("grounding") or {})
    return result


def ensure_grounding(grounding: dict[str, Any]) -> dict[str, Any]:
    for locale in ["zh", "en", "fr"]:
        current = grounding.get(locale, {})
        grounding[locale] = {
            "source_links": current.get("source_links", []),
            "source_title": current.get("source_title", []),
            "source_domain": current.get("source_domain", []),
            "retrieved_at": current.get("retrieved_at"),
            "status": current.get("status", "legacy_manual" if locale == "zh" else "pending")
        }
    return grounding


def apply_search_results(module: dict[str, Any], locale: str, results: list[SearchResult], *, status: str | None = None) -> dict[str, Any]:
    updated = copy.deepcopy(module)
    grounding = ensure_grounding(updated.get("grounding") or {})
    if not results:
        grounding[locale] = {
            "source_links": [],
            "source_title": [],
            "source_domain": [],
            "retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "status": "no_verified_source"
        }
        translations = updated.setdefault("translations", {})
        translations.setdefault(locale, {})
        translations[locale]["generated_answer"] = NO_VERIFIED
        updated["grounding"] = grounding
        return updated
    grounding[locale] = {
        "source_links": [item.url for item in results],
        "source_title": [item.title for item in results],
        "source_domain": [item.domain for item in results],
        "retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": status or "sources_retrieved_answer_pending"
    }
    updated["grounding"] = grounding
    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare source-grounded actuarial knowledge cards.")
    parser.add_argument("--knowledge", default=str(KNOWLEDGE_PATH))
    parser.add_argument("--locale", choices=["zh", "en", "fr"], help="Optionally retrieve trusted sources for one locale.")
    parser.add_argument("--seed", action="store_true", help="Use curated trusted source seeds when API results are unavailable.")
    parser.add_argument("--topic-id", help="Limit retrieval to a single topic_id.")
    args = parser.parse_args()

    path = pathlib.Path(args.knowledge)
    data = normalize_schema(load_json(path, {"catalog": [], "modules": []}))
    if args.locale:
        modules = []
        for module in data.get("modules", []):
            if args.topic_id and module.get("topic_id") != args.topic_id:
                modules.append(module)
                continue
            results = searchAuthoritativeSources(module, args.locale)
            if not results and args.seed:
                results = seeded_authoritative_sources(module)
                modules.append(apply_search_results(module, args.locale, results, status="seeded_trusted_source"))
            else:
                modules.append(apply_search_results(module, args.locale, results))
        data["modules"] = modules
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
