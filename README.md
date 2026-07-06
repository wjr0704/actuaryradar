# ActuaryRadar

**An AI-powered all-in-one Insurance Intelligence & Actuarial Learning Platform.**

ActuaryRadar helps insurance professionals discover trusted industry intelligence, actuarial knowledge, company results, regulatory developments and research resources in one place.

## Features

- Curated Insurance Intelligence
- Personalized Learning Journey
- Actuarial Knowledge Library
- Company Results
- Regulatory Updates
- Trusted Public Sources
- AI-assisted Learning

## Screenshots

Screenshots will be added soon.

| Home | Insurance Briefing | Learning Journey |
| --- | --- | --- |
| Placeholder | Placeholder | Placeholder |

## Technology Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Netlify
- AI-assisted development

> Note: the current MVP is a static Python/JavaScript prototype that generates a deployable site. The stack above reflects the intended production direction.

## Roadmap

### Current

- Personalized Learning Journey
- Daily Insurance Briefing
- Knowledge Library

### Coming Soon

- AI Copilot
- Email Digest
- User Accounts
- Saved Articles
- Personalized Recommendations

## Installation

Clone the repository:

```bash
git clone <repository_url>
cd insuranceactuaryhub
```

Create your local environment file:

```bash
cp .env.example .env
```

Generate today’s digest:

```bash
python3 work/actuary_digest_mvp/src/digest.py
```

Build the static site:

```bash
python3 work/actuary_digest_mvp/src/build_site.py --base-url https://insuranceactuaryhub.com
```

Run locally:

```bash
python3 -m http.server 8787
```

Open:

```text
http://localhost:8787/outputs/actuary_radar_site/
```

## Deployment

The MVP deploys as a static site on Netlify.

1. Push this repository to GitHub.
2. Connect the GitHub repository to Netlify.
3. Use the existing `netlify.toml` configuration.
4. Netlify will run:

```bash
python3 work/actuary_digest_mvp/src/digest.py && python3 work/actuary_digest_mvp/src/build_site.py --base-url https://insuranceactuaryhub.com
```

5. Publish directory:

```text
outputs/actuary_radar_site
```

## Daily Automation

The repository includes a GitHub Actions workflow:

```text
.github/workflows/daily-digest.yml
```

It runs daily at 08:00 Europe/Paris, generates the latest digest, rebuilds the static site, verifies the report date, and commits the refreshed source data under `work/actuary_digest_mvp/ui/data`. The `outputs/` directory is treated as a build artifact and is not committed.

## Environment Variables

See [.env.example](./.env.example) for supported environment variables.

Do not commit real API keys, Gmail app passwords, database URLs, Netlify secrets, or service-role credentials.

## Documentation

- [Production automation architecture](./work/actuary_digest_mvp/docs/production_automation_architecture.md)
- [Source strategy](./work/actuary_digest_mvp/docs/source_strategy.md)
- [Knowledge grounding](./work/actuary_digest_mvp/docs/knowledge_grounding.md)
- [Email setup](./work/actuary_digest_mvp/docs/email_setup.md)

## Repository Name

The current repository can remain `insuranceactuaryhub`.

Recommended public repository name:

```text
actuaryradar
```

## License

This project is released under the MIT License.
