# Open Source Learning Layer

ActuaryRadar uses open-source actuarial projects as curated learning pathways, not as copied content.

## Principle

- Do not copy GitHub README files or documentation.
- Do not scrape repository content into ActuaryRadar.
- Provide original ActuaryRadar summaries, structured metadata and external links.
- Respect repository licenses.
- Prefer projects with visible documentation, useful examples and recent maintenance activity.

## Data Files

Curated repository metadata lives in:

```text
config/open_source_resources.json
```

The static build copies it to:

```text
outputs/actuary_radar_site/data/open_source_resources.json
```

## Repository Schema

Each repository entry contains:

- `id`
- `name`
- `owner`
- `github_url`
- `official_website`
- `license`
- `programming_language`
- `difficulty`
- `business_lines`
- `topics`
- `tracks`
- `use_cases`
- `recommended_for`
- `summary.zh/en/fr`
- `curation.status`
- `curation.maintenance_status`
- `curation.documentation_quality`
- `curation.quality_score`
- `curation.last_reviewed_at`

## Knowledge Card Integration

Knowledge cards match repositories through:

- card track
- card title and summary
- core concepts
- repository topics
- repository tracks
- repository use cases

The UI displays at most three open-source resources per knowledge card.

## Learning Journey Integration

Daily learning plans can recommend a `GitHub Example` item:

```text
Concept
-> Official Reading
-> GitHub Example
-> Case Study
-> Related News
-> Related Concept
```

For the MVP, this is deterministic and topic-driven. Future versions can add user-level recommendation scores and GitHub API metadata refreshes.

## Future Automation

A future maintenance job can refresh:

- stars
- forks
- latest commit date
- archived status
- license
- default branch
- issue activity

That job should update metadata only. It should not copy code, README content or documentation into ActuaryRadar.
