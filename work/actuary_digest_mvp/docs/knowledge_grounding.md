# Knowledge Grounding Workflow

Actuary Radar knowledge cards use a source-grounded data model.

## Data Contract

Each card in `ui/data/knowledge.json` should include:

- `topic_id`
- `translations.zh/en/fr.title`
- `translations.zh/en/fr.description`
- `translations.zh/en/fr.learning_question`
- `translations.zh/en/fr.generated_answer`
- `grounding.zh/en/fr.source_links`
- `grounding.zh/en/fr.source_title`
- `grounding.zh/en/fr.source_domain`
- `grounding.zh/en/fr.retrieved_at`
- `grounding.zh/en/fr.status`

Chinese content is treated as the current source of truth for the MVP and should not be overwritten by automated scripts.

## Status Values

- `pending`: source retrieval has not been run.
- `no_verified_source`: no trusted source was found.
- `seeded_trusted_source`: curated trusted sources were attached, but no source-supported answer has been prepared.
- `sources_retrieved_answer_pending`: external search returned sources and an answer still needs to be prepared.
- `source_supported_manual`: answer has been prepared with trusted source support.
- `verified`: reserved for future fully automated retrieval plus citation validation.

## Trusted Sources

Trusted source domains are maintained in:

`config/trusted_domains.json`

Curated source seeds are maintained in:

`config/knowledge_source_seeds.json`

## External Search API

Copy the example config:

```bash
cp work/actuary_digest_mvp/config/search_api.json.example work/actuary_digest_mvp/config/search_api.json
```

Set one provider and export its API key:

```bash
export SEARCH_PROVIDER=tavily
export TAVILY_API_KEY=...
```

Supported provider adapters:

- Tavily
- Bing Web Search
- SerpAPI
- Perplexity

## Commands

Normalize the knowledge data model:

```bash
python3 work/actuary_digest_mvp/src/ground_knowledge.py
```

Attach curated trusted source seeds:

```bash
python3 work/actuary_digest_mvp/src/ground_knowledge.py --locale en --seed
python3 work/actuary_digest_mvp/src/ground_knowledge.py --locale fr --seed
python3 work/actuary_digest_mvp/src/ground_knowledge.py --locale zh --seed
```

Retrieve trusted sources through the configured API:

```bash
python3 work/actuary_digest_mvp/src/ground_knowledge.py --locale en
```

Limit to one topic:

```bash
python3 work/actuary_digest_mvp/src/ground_knowledge.py --locale en --topic-id pricing-glm-auto
```

Rebuild the static site:

```bash
python3 work/actuary_digest_mvp/src/build_site.py --base-url https://insuranceactuaryhub.com
```
