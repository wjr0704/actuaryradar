# ActuaryRadar Production Automation Architecture

This document separates the current automation MVP from the target production architecture.

## Current State

ActuaryRadar is currently a static intelligence site generated from local files:

1. `src/digest.py` fetches RSS sources and writes daily report files.
2. `src/build_site.py` rebuilds `outputs/actuary_radar_site`.
3. The frontend reads `data/digest.json`, `data/archive_index.json`, and archived JSON files.
4. Learning preferences and progress are stored in browser `localStorage`.

The project includes dynamic refresh endpoints:

- Netlify function: `work/actuary_digest_mvp/netlify/functions/daily-refresh.mjs`
- Vercel API wrapper: `api/daily-refresh.mjs`

These endpoints can fetch fresh RSS data and return JSON, but they do not persist refreshed data into a database or update the static site files.

## MVP Daily Automation

The current deployable automation path is GitHub Actions:

```text
GitHub Actions schedule
  -> run digest.py for Europe/Paris today
  -> run build_site.py
  -> verify outputs/actuary_radar_site/data/digest.json date
  -> commit refreshed source data under work/actuary_digest_mvp/ui/data
  -> hosting platform redeploys from the new commit
```

Workflow:

```text
.github/workflows/daily-digest.yml
```

The workflow runs at both `06:00 UTC` and `07:00 UTC`, then checks the actual local hour in `Europe/Paris`.
Only the run where Paris local hour is `08` updates the site.

This handles daylight saving time:

- Paris summer time 08:00 = 06:00 UTC
- Paris winter time 08:00 = 07:00 UTC

## What This MVP Solves

- Daily RSS refresh
- Daily digest JSON/HTML/Markdown generation
- Daily static site rebuild
- Static archive generation
- Sitemap update
- Cache headers for JSON and `index.html`
- A committed refresh history through curated UI data files

## What Is Still Missing

The MVP does not yet include:

- A real database
- Durable article-level storage
- Article extraction job history
- Research refresh jobs
- User accounts
- Server-side personalized learning plans
- Retry queues
- Admin dashboard
- Production alerting
- CDN purge hooks

## Target Production Architecture

The long-term architecture should look like this:

```text
Scheduler
  -> Daily Refresh Worker
  -> Source Fetchers
  -> Article Resolver
  -> Article Extractor
  -> Classifier and Summarizer
  -> Database
  -> API Layer
  -> Frontend
```

Recommended storage:

- Supabase Postgres, Neon Postgres, or managed PostgreSQL
- Object storage for article snapshots or generated report files

Recommended tables:

- `sources`
- `articles`
- `article_extractions`
- `daily_briefings`
- `daily_picks`
- `daily_concepts`
- `research_items`
- `refresh_runs`
- `users`
- `user_learning_preferences`
- `learning_progress`
- `daily_learning_plans`

## Daily News Refresh

Run every day at 08:00 Europe/Paris:

1. Fetch RSS and official source feeds.
2. Resolve Google News or aggregator URLs to original publisher URLs where possible.
3. Deduplicate by `original_url`, or by `source + title + published_date`.
4. Extract readable article text without bypassing paywalls.
5. Classify using the fixed insurance taxonomy.
6. Generate key takeaway, AI summary, and why-it-matters text from extracted text or RSS excerpt.
7. Store articles and refresh logs.
8. Generate daily picks and today's highlight.

## Daily Research Refresh

Recommended cadence:

- Light check daily.
- Deeper source validation weekly.

Trusted sources include:

- SOA
- CAS
- IFoA
- Institut des Actuaires
- EIOPA
- IFRS Foundation
- Swiss Re Institute
- Munich Re
- IAIS
- OECD
- The Geneva Association

## Daily Concept

For the MVP, `digest.py` rotates concepts deterministically by date.

In production:

- Store concepts in `concepts`.
- Store date-level assignments in `daily_concepts`.
- Allow editorial override.
- Allow personalized concepts based on user learning preferences.

## Personalized Learning

Current MVP:

- Preferences and progress are stored in `localStorage`.
- Recommendations use existing daily concept, knowledge cards, briefing items, and trusted sources.

Production:

- Store user preferences and progress in the database.
- Generate `daily_learning_plans` after the daily refresh.
- Recommend from fresh articles, knowledge cards, research items, and concepts.

## Cache Policy

Current:

- `index.html`: `no-store`
- `/data/*.json`: `no-store`

Future:

- Add deployment hooks or CDN purge after successful refresh.
- Version generated JSON with `generation_date`.
- Serve API responses with short `s-maxage` and stale-if-error.
