# Phase 2 Architecture: Personalized Learning Companion

## Branch

All Phase 2 work lives on:

```text
feature/phase2-personalized-learning
```

The `main` branch remains the production-ready Phase 1 branch.

## Product Positioning

ActuaryRadar Phase 2 is not a broad insurance news portal.

It should become:

```text
Your AI Learning Companion for Early-Career Insurance Professionals.
```

The homepage should answer one question:

```text
What should I learn today?
```

Target users:

- Actuarial students
- Junior actuaries
- Early-career insurance professionals
- 0-5 years of experience

Phase 2 should not optimize for executives, senior managers or investor-relations users yet.

## Product Principles

1. Learning-first homepage
   The homepage should guide a user through today's learning, not behave like a news portal.

2. Personalization without hiding the full database
   The homepage is personalized. The Insurance Intelligence page still shows all available news.

3. AI as curator, not inventor
   AI should choose, rank and explain existing learning materials. It must not invent concepts, sources or references.

4. Sources must be concept-specific
   Source links answer: "Where should I learn this concept?" They must not be generic or random.

5. Small daily progress
   The user should feel: "I have 15 minutes today, and I know exactly what to do."

## Current Phase 1 Architecture

Phase 1 is a static-site MVP:

```text
RSS sources
  -> src/digest.py
  -> generated digest JSON / HTML / Markdown
  -> src/build_site.py
  -> outputs/actuary_radar_site
  -> browser reads static JSON
```

Frontend state is mostly held in `ui/app.js` and `localStorage`:

- selected language
- learning preferences
- learning progress
- saved and completed items
- saved daily reports

Key data files:

- `ui/data/knowledge.json`
- `config/knowledge_sources.json`
- `config/open_source_resources.json`
- `ui/data/digest.json`
- `ui/data/archive_index.json`

## What Remains Unchanged

Phase 2 should preserve the stable Phase 1 modules:

- Static deployment model
- Daily digest generation
- GitHub Actions daily refresh
- Insurance Intelligence page
- Knowledge Library page
- Multilingual interface
- Trusted source configuration
- Open-source actuarial resource database
- Local MVP storage through `localStorage`

The homepage changes first. The underlying database of news and knowledge should not be reduced.

## New Homepage Information Architecture

Phase 2 homepage order:

```text
Hero
  -> Today's Learning
  -> Continue Learning
  -> Recommended Next
  -> Latest Insurance Intelligence
  -> Browse All Intelligence
```

The homepage should no longer feel like:

```text
news website + knowledge base + research portal
```

It should feel like:

```text
daily learning workspace
```

## Component Architecture

Recommended frontend components:

```text
HomeLearningDashboard
LearningOnboardingCard
TodaysLearningPanel
ContinueLearningPanel
RecommendedNextPanel
LatestInsuranceIntelligence
LearningHistory
LearningSourceBlock
```

Implementation can remain vanilla JavaScript for the MVP. The code should be split into small Phase 2 modules rather than adding more logic to the existing monolithic `app.js`.

Suggested structure:

```text
work/actuary_digest_mvp/ui/phase2/
  learningState.js
  learningRecommendations.js
  learningHistory.js
  learningRenderers.js
  learningI18n.js
```

## Data Model

### Learning Preferences

```json
{
  "career_stage": "student | junior_actuary | early_career_insurance",
  "learning_goal": "exam | job_ready | pricing | reserving | regulation | general",
  "topics": ["pricing", "reserving"],
  "daily_minutes": 15,
  "difficulty": "beginner | intermediate | advanced",
  "updated_at": "2026-07-08T08:00:00+02:00"
}
```

### Daily Learning Plan

```json
{
  "date": "2026-07-08",
  "locale": "en",
  "daily_concept_id": "reserving-chain-ladder",
  "knowledge_item_id": "reserving-chain-ladder",
  "industry_insight_ids": ["article-id-1"],
  "trusted_source_ids": ["cas-basic-ratemaking"],
  "open_source_resource_ids": ["chainladder-python"],
  "recommended_next_ids": ["pricing-glm-auto"],
  "ai_reasoning_summary": "Short explanation based only on existing content."
}
```

### Learning History

```json
{
  "date": "2026-07-08",
  "items": [
    {
      "id": "knowledge:reserving-chain-ladder",
      "type": "knowledge",
      "status": "completed"
    }
  ],
  "reflection_note": ""
}
```

### Knowledge Sources

Each knowledge item maps to curated references:

```json
{
  "knowledge_id": "ifrs17-csm",
  "official": [],
  "open_source": [],
  "research": [],
  "related_news_rules": []
}
```

If a knowledge item has no curated source, the source section should be hidden.

## Recommendation Logic

Phase 2 MVP starts with deterministic rules:

```text
selected topics
  -> matching daily concept
  -> matching knowledge card
  -> matching industry insight
  -> matching trusted source
  -> recommended next step
```

AI can later improve ranking and explanation, but it must only use existing data:

- knowledge cards
- trusted source mappings
- open-source resources
- daily intelligence articles
- research items

No hallucinated references.

## News Architecture

Personalization must not shrink the news database.

```text
Homepage = personalized recommendations
Insurance Intelligence page = all available news
```

This follows a Spotify-style model:

```text
Home = for you
Browse/Search = everything
```

## Learning History

Do not restore a Monday-Sunday weekly plan.

Use date-based history:

```text
Today
Yesterday
Jul 5
Jul 4
Jul 3
```

Each day preserves:

- Daily Concept
- Knowledge Item
- Industry Insight
- Recommended Reading
- Trusted Source

## Design Direction

Phase 2 should feel like:

```text
Duolingo + Notion + Morningstar
```

Avoid:

- admin dashboard patterns
- generic news portal layout
- documentation-site density

Design emphasis:

- clear daily learning goal
- compact task cards
- progress signals
- gentle motivation
- trusted references
- only a few high-value choices per screen

## Implementation Roadmap

### Commit 1: Phase 2 Architecture Snapshot

- Add this architecture document.
- Update changelog.
- No product functionality changes.

### Commit 2: Learning Taxonomy

- Add `config/learning_taxonomy.json`.
- Normalize topics, difficulty levels, career stages and learning goals.

### Commit 3: Learning Preferences

- Add lightweight homepage onboarding.
- Save preferences to `localStorage`.
- Keep existing knowledge and briefing pages unchanged.

### Commit 4: Learning-First Homepage

- Replace portal-first homepage with daily learning dashboard.
- Keep latest intelligence as a secondary section with three items.

### Commit 5: Recommendation Engine MVP

- Generate today's learning plan from existing content.
- Include concept, knowledge item, one industry insight and one trusted source.

### Commit 6: Learning History

- Save daily learning plans locally.
- Allow users to revisit previous learning days.

## Release Rules

Before each commit, verify:

- Homepage
- Insurance Intelligence page
- Knowledge Library page
- Search and filters
- Language switcher
- Learning progress
- Responsive layout

Do not merge into `main` until Phase 2 is tested end to end.
