# Contributing

Thanks for helping. Project HQ is small on purpose; please keep changes focused.

- **Bugs and ideas:** open an issue with steps to reproduce (or the problem you want solved) before a large pull request.
- **Security problems:** do not open a public issue; see [SECURITY.md](SECURITY.md).

## Setup

```sh
npm install
npm run dev              # dev server + local API, shows the demo content
npm run sandbox -- 5190  # dev server on a throw-away git copy of content/ (publishing works there)
```

Node 22.22+ or 24.15+ (`.nvmrc` says 24) and git are needed.

Desktop app (Electron, same code):

```sh
npm run desktop:dev      # Electron window on the Vite dev server (hot reload); settings in "Project HQ (dev)"
npm run desktop:smoke    # main process with --smoke-test: /api/health + preload check, exit code 0 or 1
npm run desktop:build    # installer for the current OS into release/
```

## Before you open a pull request

```sh
npm run typecheck
npm test
npm run build
```

CI runs the same three commands. There is no separate linter; TypeScript runs in strict mode. If you touched `electron/`,
`server/server.mjs` or `server/config.mjs`, also run `npm run build && npm run desktop:smoke`.

## Pull requests

- One topic per pull request, with a short description of the why. Screenshots for UI changes (both themes if colours change).
- Small commits with imperative messages (`fix: …`, `feat: …`, `docs: …` are welcome but not required).
- Add or update tests next to the code you change (`*.test.ts(x)` in `src/`, `*.test.mjs` in `server/`, `scripts/` and `electron/`).
- New server configuration goes through `server/config.mjs` (web mode reads `server/env.mjs`: environment, then
  `.env.local`; desktop mode reads `settings.json` in the app's data folder), build configuration into
  `import.meta.env.VITE_*`, always with a default, documented in `.env.example` and [docs/configuration.md](docs/configuration.md).

## Conventions

- **Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first** and update it when you change something it describes.
- **Two languages.** Every user-facing string lives in the feature's own `messages.ts` with a `tr` and an `en` entry of the same shape
  (`defineMessages({ tr, en })`). No hard-coded UI text in components. Strings from the local server carry a stable `code`
  (see `server/api.mjs` `CODES`) that the UI translates in `src/storage/serverMessages.ts`.
- **Plain CSS modules** (`Component.module.css`) using the tokens in `src/styles/tokens.css`. No CSS frameworks or UI kits.
- **Pure logic + tests.** Keep parsing, formatting and data operations in small pure modules (`model.ts`, `operations.ts`, …) with unit tests next to them; components stay thin.
- **Small files**, one component per file.
- **No new dependencies without a reason** stated in the pull request. The local server (`server/`) and `scripts/` have zero runtime dependencies and should stay that way. `dependencies` in
  `package.json` is what the desktop app ships (today only `electron-updater`); libraries Vite bundles belong in
  `devDependencies`.
- **Content is the user's.** The app must never hard-code projects, names or paths; everything comes from the content folder. Unknown keys in `project.json` and unknown Markdown must survive a load → save round trip.
- **One codebase for web and desktop.** Desktop-only UI checks `getDesktop()` (`src/desktop`) and renders nothing in a
  browser; never fork a component per platform. Anything the page asks of Electron goes through the small typed
  `window.hq` API (`electron/preload.mjs`, typed in `src/desktop/bridge.ts`), and every IPC handler in
  `electron/main.mjs` checks that the sender is the app's own origin. Keep `contextIsolation`, `sandbox` and
  `nodeIntegration: false`.
- **Nothing embedded.** External dashboards are links that open in a new tab, never iframes.
- `content/` in this repo is **demo content** for new users and tests. Keep it fictional: placeholder ids such as
  `com.example.app` and `ca-app-pub-0000000000000000~…`, no real names, emails or URLs.
- **No secrets, no personal data** in code, tests, fixtures or screenshots. `.gitignore` covers `.env*` and common key
  files; do not work around it.
