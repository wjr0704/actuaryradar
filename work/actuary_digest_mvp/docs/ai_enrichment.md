# AI Enrichment Pipeline

ActuaryRadar generates AI-assisted intelligence during the daily backend refresh.
The browser never calls OpenAI or Perplexity directly.

## Flow

```text
RSS sources
  -> deduplicate articles
  -> resolve original URL where possible
  -> fetch original article HTML
  -> extract readable article text
  -> call AI provider
  -> generate Key Takeaway, AI Summary, Why It Matters
  -> save results into digest.json
  -> frontend renders pre-generated fields only
```

The frontend does not call any LLM provider. It only reads fields already saved
in `work/actuary_digest_mvp/ui/data/digest.json`.

## Providers

The daily script supports:

- OpenAI via `OPENAI_API_KEY`
- Perplexity via `PERPLEXITY_API_KEY`

Provider selection:

```text
--ai-provider auto
  -> use OpenAI if OPENAI_API_KEY exists
  -> otherwise use Perplexity if PERPLEXITY_API_KEY exists
  -> otherwise keep rule-based fallback
```

## Local Run

```bash
export OPENAI_API_KEY="..."
export OPENAI_MODEL="gpt-4o-mini"
python work/actuary_digest_mvp/src/digest.py --date 2026-07-07 --ai-provider auto
python work/actuary_digest_mvp/src/build_site.py --base-url https://insuranceactuaryhub.com
```

## GitHub Actions

Add repository secrets:

- `OPENAI_API_KEY`
- or `PERPLEXITY_API_KEY`

Optional repository variables:

- `OPENAI_MODEL`
- `PERPLEXITY_MODEL`

The workflow runs at 08:00 Europe/Paris and writes generated results to
`work/actuary_digest_mvp/ui/data/digest.json`.

After each run, check the **Verify refreshed site data** step. It prints the
saved AI status from `refresh_log.ai`, for example:

```json
{
  "requested_provider": "auto",
  "selected_provider": "openai",
  "model": "gpt-4o-mini",
  "eligible_articles": 6,
  "enriched_articles": 5,
  "status": "partial_success"
}
```

If no API key is configured, the status will be `not_configured` and the
frontend will hide unavailable AI summary sections instead of showing fake AI
content.

## Safety Rules

- API keys are read only on the backend / GitHub Actions side.
- API keys are never written into `digest.json`.
- The frontend only displays saved fields.
- If article text is unavailable, paywalled or too thin, AI generation is skipped.
- If the AI call fails or returns invalid JSON, the pipeline falls back to the existing rule-based content.
