# Contributing

Thank you for your interest in ActuaryRadar.

## How to Contribute

1. Open an issue describing the bug, feature, documentation update, or UI improvement.
2. Fork the repository.
3. Create a feature branch.
4. Make focused changes.
5. Run the relevant local checks.
6. Open a pull request with a clear summary.

## Local Checks

Generate a fresh digest:

```bash
python3 work/actuary_digest_mvp/src/digest.py
```

Build the static site:

```bash
python3 work/actuary_digest_mvp/src/build_site.py --base-url https://insuranceactuaryhub.com
```

Run Python syntax checks:

```bash
python3 -m py_compile work/actuary_digest_mvp/src/digest.py work/actuary_digest_mvp/src/build_site.py
```

## Contribution Guidelines

- Keep pull requests focused.
- Do not commit credentials or private data.
- Do not commit generated `outputs/` files unless a maintainer explicitly asks.
- Preserve professional insurance and actuarial terminology.
- Include source links for factual or research-oriented content.

