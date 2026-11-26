# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's private vulnerability reporting instead:
*Security → Report a vulnerability* on this repository. Include the affected version or commit, steps to reproduce and
the impact you expect. You should get an answer within a week.

## Scope

In scope: the local server and API (`server/`), the setup scripts (`scripts/`), the web app (`src/`), including token
handling in PWA mode, Markdown/SVG rendering and the Publish / Discard / Refresh git flow, and the GitHub workflows.

Out of scope: vulnerabilities that need an attacker who can already write to your content repository's `.git` folder or
run code on your machine, and issues in third-party services (GitHub, Google, Apple).

## Supported versions

Only the latest release on `main` gets security fixes while the project is in `0.x`.
