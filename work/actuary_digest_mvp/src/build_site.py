#!/usr/bin/env python3
"""Build a self-contained static website for Actuary Radar."""

from __future__ import annotations

import json
import pathlib
import shutil
import sys
import argparse
import datetime as dt
import html
from urllib.parse import urljoin


ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parents[1]
OUTPUTS = WORKSPACE / "outputs"
SITE_DIR = OUTPUTS / "actuary_radar_site"


def copy_file(src: pathlib.Path, dst: pathlib.Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def normalize_base_url(base_url: str) -> str:
    if not base_url:
        return "https://insuranceactuaryhub.com/"
    return base_url.rstrip("/") + "/"


def inject_absolute_meta(index_path: pathlib.Path, base_url: str) -> None:
    absolute_url = normalize_base_url(base_url)
    content = index_path.read_text(encoding="utf-8")
    extra = f"""
  <link rel="canonical" href="{html.escape(absolute_url)}">
  <meta property="og:url" content="{html.escape(absolute_url)}">
"""
    if 'rel="canonical"' not in content:
        content = content.replace("  <link rel=\"stylesheet\" href=\"./styles.css\">", extra + "  <link rel=\"stylesheet\" href=\"./styles.css\">")
    index_path.write_text(content, encoding="utf-8")


def write_seo_files(site_dir: pathlib.Path, archives: list[dict], base_url: str) -> None:
    absolute_base = normalize_base_url(base_url)
    today = dt.date.today().isoformat()
    urls = [
        {
            "loc": absolute_base,
            "lastmod": today,
            "priority": "1.0",
            "changefreq": "daily",
        }
    ]
    for archive in archives:
        urls.append({
            "loc": urljoin(absolute_base, archive["html"].lstrip("./")),
            "lastmod": archive["date"],
            "priority": "0.8",
            "changefreq": "weekly",
        })

    sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for item in urls:
        sitemap.extend([
            "  <url>",
            f"    <loc>{html.escape(item['loc'])}</loc>",
            f"    <lastmod>{html.escape(item['lastmod'])}</lastmod>",
            f"    <changefreq>{html.escape(item['changefreq'])}</changefreq>",
            f"    <priority>{html.escape(item['priority'])}</priority>",
            "  </url>",
        ])
    sitemap.append("</urlset>")
    (site_dir / "sitemap.xml").write_text("\n".join(sitemap) + "\n", encoding="utf-8")

    robots = [
        "User-agent: *",
        "Allow: /",
        "",
        f"Sitemap: {urljoin(absolute_base, 'sitemap.xml')}",
        "",
    ]
    (site_dir / "robots.txt").write_text("\n".join(robots), encoding="utf-8")


def build_site(site_dir: pathlib.Path = SITE_DIR, base_url: str = "") -> None:
    site_dir.mkdir(parents=True, exist_ok=True)

    for filename in ["index.html", "styles.css", "app.js", "favicon.svg"]:
        copy_file(ROOT / "ui" / filename, site_dir / filename)
    copy_file(ROOT / "ui" / "config" / "taxonomy.js", site_dir / "config" / "taxonomy.js")
    inject_absolute_meta(site_dir / "index.html", base_url)

    (site_dir / "data" / "archive").mkdir(parents=True, exist_ok=True)
    (site_dir / "reports").mkdir(parents=True, exist_ok=True)

    archives = []
    for json_path in sorted(OUTPUTS.glob("insurance_actuary_digest_*.json"), reverse=True):
        date = json_path.stem.replace("insurance_actuary_digest_", "")
        html_path = OUTPUTS / f"insurance_actuary_digest_{date}.html"
        md_path = OUTPUTS / f"insurance_actuary_digest_{date}.md"

        site_json = site_dir / "data" / "archive" / f"{date}.json"
        site_html = site_dir / "reports" / f"{date}.html"
        site_md = site_dir / "reports" / f"{date}.md"

        copy_file(json_path, site_json)
        if html_path.exists():
            copy_file(html_path, site_html)
        if md_path.exists():
            copy_file(md_path, site_md)

        payload = json.loads(json_path.read_text(encoding="utf-8"))
        archives.append({
            "date": date,
            "title": payload.get("report_date", date),
            "mode": payload.get("mode", ""),
            "theme": payload.get("focus_profile", {}).get("theme", ""),
            "json": f"./data/archive/{date}.json",
            "html": f"./reports/{date}.html",
            "markdown": f"./reports/{date}.md",
        })

    knowledge_path = ROOT / "ui" / "data" / "knowledge.json"
    if knowledge_path.exists():
        copy_file(knowledge_path, site_dir / "data" / "knowledge.json")
    open_source_path = ROOT / "config" / "open_source_resources.json"
    if open_source_path.exists():
        copy_file(open_source_path, site_dir / "data" / "open_source_resources.json")
    knowledge_sources_path = ROOT / "config" / "knowledge_sources.json"
    if knowledge_sources_path.exists():
        copy_file(knowledge_sources_path, site_dir / "data" / "knowledge_sources.json")

    if archives:
        latest = archives[0]
        copy_file(site_dir / "data" / "archive" / f"{latest['date']}.json", site_dir / "data" / "digest.json")
    else:
        copy_file(ROOT / "ui" / "data" / "digest.json", site_dir / "data" / "digest.json")

    (site_dir / "data" / "archive_index.json").write_text(
        json.dumps({"archives": archives}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    write_seo_files(site_dir, archives, base_url)

    (site_dir / "README_DEPLOY.md").write_text(
        """# ActuaryRadar Static Site

This folder is a self-contained static website.

Local preview:

```bash
python3 -m http.server 8787
```

Then open:

```text
http://localhost:8787/outputs/actuary_radar_site/
```

Deploy the entire `actuary_radar_site` folder to any static hosting service.

For production SEO, rebuild with your real domain:

```bash
python3 work/actuary_digest_mvp/src/build_site.py --base-url https://your-domain.com
```
""",
        encoding="utf-8",
    )


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Build the ActuaryRadar static website.")
    parser.add_argument("--output-dir", default=str(SITE_DIR), help="Static site output directory.")
    parser.add_argument("--base-url", default="", help="Production domain, for example https://actuaryradar.com")
    args = parser.parse_args(argv)

    target = pathlib.Path(args.output_dir).resolve()
    build_site(target, args.base_url)
    print(f"Built static site: {target}")
    if not args.base_url:
        print("SEO note: rebuild with --base-url https://your-domain.com before production deployment.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
