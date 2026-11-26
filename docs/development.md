# Development

Read [CONTRIBUTING.md](../CONTRIBUTING.md) for conventions and [ARCHITECTURE.md](ARCHITECTURE.md) for how the app is
built.

## Commands

```sh
npm run dev               # Vite dev server with the local API (hot reload)
npm test                  # unit and integration tests (Vitest)
npm run typecheck         # TypeScript
npm run build             # type-check and production build into dist/
npm run sandbox -- 5190   # dev server on a throw-away git copy of the demo content (publishing works)
```

`npm run dev` follows the same rule as `npm start`: it shows demo content until a folder is chosen in Settings,
`npm run setup` has been run, or `HQ_ROOT` is set. Desktop commands are in
[desktop.md](desktop.md#run-and-build-from-source).

## How it fits together

```
             ┌──────────────── browser ─────────────────┐
             │  React app (src/)                        │
             │  features/* ── data/* ── storage adapter │
             └───────────────┬───────────────┬──────────┘
                 local mode  │               │  github (PWA) mode
                             ▼               ▼
         ┌──────────────────────────┐   ┌──────────────────────────┐
         │ Local API (server/)      │   │ api.github.com           │
         │ Node, 127.0.0.1 only     │   │ fine-grained token,      │
         │ files + git CLI          │   │ drafts in IndexedDB      │
         └────────────┬─────────────┘   └────────────┬─────────────┘
                      ▼                              ▼
         your content repo on disk          your content repo on GitHub
         (<HQ_ROOT>/content/...)            (<owner>/<repo>/<content dir>/...)
```

- **The app** (`src/`) is React and TypeScript with plain CSS modules. Every feature reads and writes files through one
  small storage interface (`src/storage/types.ts`), so it does not care where the files live.
- **Local mode** (`npm start`, `npm run dev`, or the desktop app): a zero-dependency Node server (`server/`) serves the
  app and a local API on `127.0.0.1`. The API reads and writes files in your content folder and runs your own `git` for
  Publish, Discard and Refresh. It also exposes a cheap fingerprint of the content folder that the app polls, which is
  how outside changes show up without a reload.
- **PWA / GitHub mode** (static hosting such as GitHub Pages): there is no server. The app talks to the GitHub REST API
  with a fine-grained token you enter in Settings. Edits are kept as drafts in the browser and Publish makes one commit.
- **Desktop app** (Electron): the same local mode in its own window. It starts the same server (`startServer()` in
  `server/server.mjs`) on a free `127.0.0.1` port and shows it; only where settings are stored differs.
- **The app picks its mode by itself**: if `./api/health` answers, it is local mode; otherwise GitHub mode.
- **Two repositories.** This repo (the app) never contains your data. Your content lives in its own, usually private,
  repository, so updating the app is a plain `git pull`.

## Repository layout

```
src/          React app: app shell, features/* (one folder per tab), data/ (models), storage/ (local + GitHub adapters)
server/       zero-dependency Node server: startServer(), local API, settings, git helpers, static files, Vite plugin
electron/     desktop app: main process, preload (window.hq), menu, PATH fix, updates, window state
build/        desktop app icons (generated from public/logo.svg by npm run icons:desktop)
scripts/      npm run setup / sandbox / desktop icons
templates/    files copied into new content repos (CLAUDE.md)
content/      fictional demo content (also used by tests)
docs/         documentation and the README screenshot
```

## Limitations and known gaps

- Google Play, App Store and AdMob are tracked by hand (ids, status, links, notes); there is no API sync yet.
- Publishing through the GitHub API (PWA mode) has so far only been tested against a simulated GitHub in the test suite,
  not against github.com.
- Live refresh of outside changes works in local mode only, and edits to the same file from two places are
  last-write-wins.
- One person, one content repo: there are no accounts, sharing or real-time collaboration. Conflicts are detected per
  file, not merged.
- Local mode needs git on the machine (and Node when run from source); PWA mode needs a GitHub account and token.
- Desktop builds are unsigned unless signing secrets are configured: expect the first-launch warnings, and no
  self-update on macOS. There is no Linux package yet (run from source).
- UI languages: English and Turkish.
