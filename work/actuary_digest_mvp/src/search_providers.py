from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass
class SearchResult:
    title: str
    url: str
    domain: str
    snippet: str = ""


class SearchProvider:
    name = "base"

    def search(self, query: str, domains: list[str], locale: str, limit: int = 5) -> list[SearchResult]:
        raise NotImplementedError

    def has_credentials(self) -> bool:
        return False


def result_domain(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    return parsed.netloc.lower().removeprefix("www.")


def domain_is_trusted(url: str, domains: list[str]) -> bool:
    domain = result_domain(url)
    return any(domain == trusted or domain.endswith(f".{trusted}") for trusted in domains)


def request_json(url: str, *, headers: dict[str, str] | None = None, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None
    method = "GET"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        method = "POST"
    request = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


class TavilyProvider(SearchProvider):
    name = "tavily"

    def __init__(self, api_key_env: str = "TAVILY_API_KEY", endpoint: str = "https://api.tavily.com/search") -> None:
        self.api_key = os.getenv(api_key_env, "")
        self.endpoint = endpoint

    def has_credentials(self) -> bool:
        return bool(self.api_key)

    def search(self, query: str, domains: list[str], locale: str, limit: int = 5) -> list[SearchResult]:
        if not self.has_credentials():
            return []
        payload = {
            "api_key": self.api_key,
            "query": query,
            "search_depth": "advanced",
            "max_results": limit,
            "include_domains": domains,
            "include_answer": False
        }
        data = request_json(self.endpoint, headers={"Content-Type": "application/json"}, payload=payload)
        return normalize_results(data.get("results", []), domains, title_key="title", url_key="url", snippet_key="content")


class BingProvider(SearchProvider):
    name = "bing"

    def __init__(self, api_key_env: str = "BING_WEB_SEARCH_API_KEY", endpoint: str = "https://api.bing.microsoft.com/v7.0/search") -> None:
        self.api_key = os.getenv(api_key_env, "")
        self.endpoint = endpoint

    def has_credentials(self) -> bool:
        return bool(self.api_key)

    def search(self, query: str, domains: list[str], locale: str, limit: int = 5) -> list[SearchResult]:
        if not self.has_credentials():
            return []
        domain_query = " OR ".join(f"site:{domain}" for domain in domains)
        params = urllib.parse.urlencode({"q": f"({domain_query}) {query}", "count": limit, "mkt": market_for_locale(locale)})
        data = request_json(f"{self.endpoint}?{params}", headers={"Ocp-Apim-Subscription-Key": self.api_key})
        return normalize_results(data.get("webPages", {}).get("value", []), domains, title_key="name", url_key="url", snippet_key="snippet")


class SerpApiProvider(SearchProvider):
    name = "serpapi"

    def __init__(self, api_key_env: str = "SERPAPI_API_KEY", endpoint: str = "https://serpapi.com/search.json") -> None:
        self.api_key = os.getenv(api_key_env, "")
        self.endpoint = endpoint

    def has_credentials(self) -> bool:
        return bool(self.api_key)

    def search(self, query: str, domains: list[str], locale: str, limit: int = 5) -> list[SearchResult]:
        if not self.has_credentials():
            return []
        domain_query = " OR ".join(f"site:{domain}" for domain in domains)
        params = urllib.parse.urlencode({"q": f"({domain_query}) {query}", "api_key": self.api_key, "num": limit, "hl": locale})
        data = request_json(f"{self.endpoint}?{params}")
        return normalize_results(data.get("organic_results", []), domains, title_key="title", url_key="link", snippet_key="snippet")


class PerplexityProvider(SearchProvider):
    name = "perplexity"

    def __init__(self, api_key_env: str = "PERPLEXITY_API_KEY", endpoint: str = "https://api.perplexity.ai/chat/completions") -> None:
        self.api_key = os.getenv(api_key_env, "")
        self.endpoint = endpoint

    def has_credentials(self) -> bool:
        return bool(self.api_key)

    def search(self, query: str, domains: list[str], locale: str, limit: int = 5) -> list[SearchResult]:
        if not self.has_credentials():
            return []
        domain_query = ", ".join(domains)
        payload = {
            "model": "sonar",
            "messages": [
                {
                    "role": "system",
                    "content": "Return only authoritative source links. Do not answer the learning question."
                },
                {
                    "role": "user",
                    "content": f"Find up to {limit} source links for this actuarial topic in locale {locale}. Trusted domains only: {domain_query}. Topic: {query}"
                }
            ]
        }
        data = request_json(
            self.endpoint,
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            payload=payload
        )
        urls = data.get("citations", []) or []
        return [
            SearchResult(title=result_domain(url), url=url, domain=result_domain(url), snippet="")
            for url in urls
            if domain_is_trusted(url, domains)
        ][:limit]


def normalize_results(items: list[dict[str, Any]], domains: list[str], *, title_key: str, url_key: str, snippet_key: str) -> list[SearchResult]:
    results = []
    seen = set()
    for item in items:
        url = str(item.get(url_key, "")).strip()
        if not url or url in seen or not domain_is_trusted(url, domains):
            continue
        seen.add(url)
        results.append(SearchResult(
            title=str(item.get(title_key, "")).strip() or result_domain(url),
            url=url,
            domain=result_domain(url),
            snippet=str(item.get(snippet_key, "")).strip()
        ))
    return results


def market_for_locale(locale: str) -> str:
    return {"zh": "zh-CN", "fr": "fr-FR", "en": "en-US"}.get(locale, "en-US")


def provider_from_config(config: dict[str, Any]) -> SearchProvider:
    provider_name = config.get("provider", "tavily")
    provider_config = config.get("providers", {}).get(provider_name, {})
    kwargs = {
        "api_key_env": provider_config.get("api_key_env", ""),
        "endpoint": provider_config.get("endpoint", "")
    }
    if provider_name == "bing":
        return BingProvider(**{key: value for key, value in kwargs.items() if value})
    if provider_name == "serpapi":
        return SerpApiProvider(**{key: value for key, value in kwargs.items() if value})
    if provider_name == "perplexity":
        return PerplexityProvider(**{key: value for key, value in kwargs.items() if value})
    return TavilyProvider(**{key: value for key, value in kwargs.items() if value})
