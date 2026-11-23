# Contributing

Thanks for helping. Project HQ is small on purpose; please keep changes focused.

## Setup

```sh
npm install
npm run dev              # dev server + local API, shows the demo content
npm run sandbox -- 5190  # dev server on a throw-away git copy of content/ (publishing works there)
```

Node 22.22+ or 24.15+ (`.nvmrc` says 24) and git are needed.

## Before you open a pull request

```sh
npm run typecheck
npm test
npm run build
```

CI runs the same three commands.

## Conventions

- **Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first** and update it when you change something it describes.
- **Two languages.** Every user-facing string lives in the feature's own `messages.ts` with a `tr` and an `en` entry of the same shape
  (`defineMessages({ tr, en })`). No hard-coded UI text in components. Strings from the local server carry a stable `code`
  (see `server/api.mjs` `CODES`) that the UI translates in `src/storage/serverMessages.ts`.
- **Plain CSS modules** (`Component.module.css`) using the tokens in `src/styles/tokens.css`. No CSS frameworks or UI kits.
- **Pure logic + tests.** Keep parsing, formatting and data operations in small pure modules (`model.ts`, `operations.ts`, …) with unit tests next to them; components stay thin.
- **Small files**, one component per file.
- **No new dependencies without a reason** stated in the pull request. The local server (`server/`) and `scripts/` have zero runtime dependencies and should stay that way.
- **Content is the user's.** The app must never hard-code projects, names or paths; everything comes from the content folder. Unknown keys in `project.json` and unknown Markdown must survive a load → save round trip.
- **Nothing embedded.** External dashboards are links that open in a new tab, never iframes.
- `content/` in this repo is **demo content** for new users and tests. Keep it fictional.
