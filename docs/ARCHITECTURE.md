# Project HQ architecture

One place to manage all side projects (apps, games, SaaS): per-project notes, roadmap, a planner,
store listings (Play Store / App Store), ads (AdMob) and quick-launch panels. Content is plain Markdown +
JSON kept in the user's own content repo; a **Publish** button turns edits into a git commit.

Runs two ways from the same build:

| Mode | How it runs | Where edits go | Publish |
| --- | --- | --- | --- |
| `local` | `npm run dev` / `npm start` on the laptop | straight to files in `content/` | `git commit` + `git push` through the local API |
| `github` | installed PWA / static hosting | drafts in IndexedDB on top of the repo tree | one commit through the GitHub Git Data API (PAT) |

The **desktop app** (Electron, macOS + Windows) is `local` mode in its own window: it runs the same server and the same
build, see [Desktop app](#desktop-app-electron).

The app decides at start-up: `GET ./api/health` answers with `{"app":"project-hq"}` → `local`, otherwise `github`.

## App repo and content repo

The app is open source; a user's notes are not. They live in two repositories, so the app repo stays clean
and `git pull` always updates it. Nothing personal is hard-coded in `src/`, `server/` or `scripts/`;
projects exist only as files in the content folder.

- `content/` in the app repo is **demo content** (three fictional projects and a plan) used by demo mode,
  `npm run sandbox`, `npm run setup -- --with-examples` and some tests.
- A user's content repo is any git repo with a `content/` folder. The local server finds it through `HQ_ROOT`
  (environment variable, or a `HQ_ROOT=…` line in the git-ignored `.env.local` at the app root; relative paths
  are relative to the app folder). `HQ_ROOT=.` keeps content inside the app repo (a private fork used as one repo).
- In `github` mode the content repo is whatever `owner/repo` is entered in Settings, so one public hosted
  build of the app can serve anyone's private content repo. The Pages workflow prefills it only from the
  `HQ_CONTENT_REPO` repository variable (empty otherwise).

### Demo mode

When `HQ_ROOT` is set neither in the environment nor in `.env.local`, the local server runs in demo mode
(`server/demo.mjs`): it copies the app's `content/` into a fresh temp folder, `git init`s it with one commit,
shifts the demo plan so that its anchor day (`DEMO_ANCHOR`, 2026-11-23) becomes today (day sections are moved
and regrouped into month files), and serves that copy. The temp folder is deleted on exit. Editing works;
`/api/health` reports `demo: true`, `canPublish: false`, `reasonCode: 'demo'`, and `POST /api/publish` refuses with
`code: 'demo'`. The shell shows `DemoBanner` (dismissed per browser session via `sessionStorage`).
The demo copy is prepared lazily by the Vite plugin (so `vite build` never creates one) and eagerly by `npm start`.

### Outside changes (live refresh)

`GET /api/stamp` returns a SHA-1 over every content file's path, size and mtime plus the git `HEAD`. `/api/health`
reports `watchIntervalMs` (`HQ_WATCH_INTERVAL_MS`, default 3000, 0 = off) and, outside demo mode, `contentPath`.
`src/storage/useOutsideChanges.ts` (mounted once by `StorageProvider`) calls `LocalStorage.checkOutsideChanges()`
on that interval while the page is visible and on window focus; when the stamp differs from the previous one, the
adapter notifies its subscribers, so every `useStorageQuery` re-reads. `MarkdownDoc` takes the new text only when it
has no unsaved typing. This is how edits made by other editors or by coding agents such as Claude Code show up.
GitHub mode does not implement `checkOutsideChanges` (refresh is manual).

### `npm run setup`

`scripts/setup.mjs` (zero dependencies; pure helpers in `scripts/setup-lib.mjs`, unit-tested) asks (or takes flags
`--dir`, `--here`, `--with-examples` / `--no-examples`, `--claude-md` / `--no-claude-md`, `--remote`, `--yes`, `--help`) where the content repo goes
(default `../project-hq-content`), creates `<dir>/content/`, optionally copies the demo projects (never overwriting),
copies `templates/content-repo/CLAUDE.md` to `<dir>/CLAUDE.md` unless it exists or `--no-claude-md` is given,
runs `git init -b main` unless `<dir>` already is the top of a git repo, optionally adds `origin`, merges `HQ_ROOT=` into
`.env.local` without touching other lines, warns when git has no user email, and prints next steps. It never deletes,
never creates remote repos and never pushes; re-running is safe.

## Stack

- Vite + React + TypeScript (strict), `HashRouter` (works on any static host / sub-path, `base: './'`).
- Plain CSS: design tokens in `src/styles/tokens.css`, one CSS Module per component. No Tailwind, no UI kit.
- `lucide-react` icons, CodeMirror 6 editor, `markdown-it` + `DOMPurify` preview, `idb-keyval` for IndexedDB.
- `vite-plugin-pwa` for the service worker/manifest. `vitest` + Testing Library (jsdom) for tests.
- Local API: plain Node ESM in `server/`, **zero runtime dependencies**.

## Content layout (the data model)

Everything lives under `content/`. All storage paths are POSIX and **relative to `content/`**.

```
content/projects/<slug>/
  project.json          metadata (ProjectMeta below)
  roadmap.md            roadmap board (format below)
  notes/<note>.md       free notes; title = first "# " heading, fallback = file name
  stores/android.md     Play Store notes (listing text, release checklist…)
  stores/ios.md         App Store notes
  ads/admob.md          ad notes (unit ids, experiments…)
  assets/<file>         uploaded images, referenced from markdown with relative paths
```

```ts
// src/data/types.ts
export type ProjectType = 'mobile-game' | 'mobile-app' | 'web-app' | 'saas' | 'other';
export type ProjectStatus = 'idea' | 'building' | 'live' | 'paused' | 'archived';
export type StoreStatus = 'not-started' | 'draft' | 'internal-testing' | 'closed-testing'
  | 'open-testing' | 'in-review' | 'live' | 'rejected';

export interface StoreListing {
  enabled: boolean;
  appId?: string;        // Android package name / iOS bundle id
  storeUrl?: string;     // public listing
  consoleUrl?: string;   // Play Console / App Store Connect deep link
  status?: StoreStatus;
  version?: string;
}
export interface PanelLink { id: string; label: string; url: string; group?: string }
export interface ProjectMeta {
  schema: 1;
  name: string;
  tagline?: string;
  type: ProjectType;
  status: ProjectStatus;
  emoji?: string;
  color?: string;                       // accent, hex
  order?: number;
  modules?: { stores?: boolean; ads?: boolean };   // which optional tabs show
  repos?: { label: string; url: string }[];
  web?: { url?: string };
  stores?: { android?: StoreListing; ios?: StoreListing };
  ads?: { admob?: { publisherId?: string; androidAppId?: string; iosAppId?: string; dashboardUrl?: string } };
  links?: PanelLink[];
}
```

Unknown keys in `project.json` must survive a load → save round trip.

### roadmap.md format

```md
# Roadmap

## Now
- [ ] Item title
  Optional indented detail lines (kept verbatim).
- [x] Done item

## Next
…
```

Every `## ` heading is a board column, every top-level task list item a card. Anything the parser does not
understand (text before the first `##`, loose paragraphs inside a column) is preserved verbatim on save.

### Planner (calendar) format

What gets worked on which day, across all projects. One Markdown file per month, `plan/<YYYY-MM>.md`
(relative to `content/`):

```md
# 2026-11

## 2026-11-23
- [ ] Store screenshots #pebble-quest
- [x] Landing page copy #ledgerbird
- [ ] Taxes
```

Every `## YYYY-MM-DD` heading is a day; every task item is a plan item; a trailing `#<project-slug>` ties
it to a project (none = general). Unknown content is preserved on save, like the roadmap.

As built (`src/features/planner/`): only a known project slug counts as a tag (any other `#word` stays in the
title); an item that is just a tag (`- [ ] #my-app`) means "work on this project". A missing month file is
created with a `# YYYY-MM` title on first write, new days are inserted in date order, and a day left with no
items and no other content is removed. Dates are plain local calendar dates (all maths on year/month/day
numbers); weeks start on the locale's first day (`Intl.Locale` week info, Monday otherwise).

## Storage contract

```ts
// src/storage/types.ts
export type ChangeKind = 'added' | 'modified' | 'deleted';
export interface Change { path: string; kind: ChangeKind }
export interface StorageInfo {
  mode: 'local' | 'github';
  label: string;            // local: repo folder name · branch; github: owner/repo@branch
  canPublish: boolean;      // false e.g. when not a git repo / no token
  remoteUrl?: string;       // https URL of the GitHub repo if known
  reason?: string;          // why canPublish is false
  reasonCode?: string;      // local API: stable code for `reason`
  demo?: boolean;           // local API serves the demo content
}
export interface PublishResult {
  ok: boolean; pushed: boolean;
  commitSha?: string; commitUrl?: string;
  error?: string;           // a real failure (e.g. the push was attempted and failed)
  message?: string;         // informational, not an error (e.g. nothing to commit, committed locally: no remote)
  conflicts?: string[];
  code?: string;            // local API: stable code for `error` / `message`
}
export interface Storage {
  info(): Promise<StorageInfo>;
  list(prefix?: string): Promise<string[]>;             // files only, sorted
  readText(path: string): Promise<string | null>;       // null when missing
  readBytes(path: string): Promise<Uint8Array | null>;
  writeText(path: string, text: string): Promise<void>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  removeDir(prefix: string): Promise<void>;
  changes(): Promise<Change[]>;                         // unpublished changes
  discard(paths?: string[]): Promise<void>;             // revert unpublished changes (all when omitted)
  publish(message: string, opts?: { force?: boolean }): Promise<PublishResult>;
  pull(): Promise<{ updated: number }>;                 // refresh from the remote
  subscribe(listener: () => void): () => void;          // called after any mutation / pull / publish
}
```

`src/storage/index.ts` exports `getStorage(): Promise<Storage>` (memoised mode detection) and
`StorageProvider` / `useStorage()`.

## Local API (`server/`)

Layers, bottom up:

- `server/api.mjs`: `createApiHandler({ root, contentDir, demo, watchIntervalMs, port })` → `(req, res, next)`, the
  content API for one folder.
- `server/config.mjs`: `createConfigStore({ mode: 'web' | 'desktop', projectDir, userDataDir })` → `{ load(), save(),
  remember() }`, the one place settings come from. `web`: environment, then `.env.local` (`server/env.mjs`), then defaults;
  `save()` merges `HQ_ROOT` / `HQ_CONTENT_DIR` into `.env.local` and refuses (`env_override`) when the environment sets
  `HQ_ROOT`. `desktop`: `settings.json` in Electron's `userData` (`root`, `contentDir`, `lastPort`); the environment is ignored.
- `server/app.mjs`: `createAppHandler({ config, projectDir, port, root?, contentDir? })` adds the settings routes and swaps
  the content API in place when the folder changes (no restart). A `root` passed in pins the folder (`pinned`).
- `server/server.mjs`: `startServer({ port, host, root, contentDir, config, projectDir, distDir, dev, fallbackToRandomPort })`
  → `{ port, url, server, current(), close() }`. Binds loopback only, serves `dist/` (`server/static.mjs`) or, with
  `dev: true`, an embedded Vite dev server in middleware mode (HMR on the same port; the Vite plugin then stays out of
  the way and this server mounts the API and the content guard). `port: 0` = random; `fallbackToRandomPort` retries with 0
  on `EADDRINUSE`.
- Callers: `server/index.mjs` (`npm start`: runs `vite build` first when `dist/index.html` is missing or older than
  `src/`, `public/`, `index.html`, `vite.config.ts` or the package files (`server/build.mjs`); `--open` opens the browser),
  `electron/main.mjs` (desktop), and `server/vite-plugin.mjs` (dev + preview; uses `createAppHandler` directly).

Env (web mode): `HQ_ROOT` (content repo root; unset = demo mode), `HQ_CONTENT_DIR` (default `content`), `PORT` (default 4173).

| Route | Does |
| --- | --- |
| `GET /api/health` | `{ app: 'project-hq', mode: 'local', demo?, label, canPublish, remoteUrl, contentPath?, watchIntervalMs, reason, reasonCode }` |
| `GET /api/stamp` | `{ stamp }`: fingerprint of the content folder (file paths, sizes, mtimes, git HEAD) |
| `GET /api/files` | `{ files: string[] }` |
| `GET /api/file?path=` | raw bytes, 404 when missing |
| `PUT /api/file?path=` | raw body → file (creates folders) |
| `DELETE /api/file?path=[&dir=1]` | delete file / folder (a symlink is removed itself, never its target) |
| `GET /api/changes` | `{ changes: Change[] }` from `git status` limited to the content dir |
| `POST /api/discard` | `{ paths?: string[] }` → restore from HEAD / remove untracked |
| `POST /api/publish` | `{ message }` → `git add` + `git commit` (content dir only) + `git push` when a remote exists; `PublishResult` (no remote / nothing to commit = `message`, failed push = `error`) |
| `POST /api/pull` | `git pull --ff-only` when a remote exists |
| `GET /api/settings` | `{ mode: 'web' \| 'desktop', root, contentDir, demo, file, envOverride, pinned }` (`root` is `''` in demo mode) |
| `PUT /api/settings` | `{ root, contentDir }` → saves (`.env.local` / `settings.json`) and switches folders; `root: ''` = demo. Codes `root_not_found`, `root_not_directory`, `invalid_content_dir`, `env_override`, `pinned` |
| `POST /api/settings/test` | `{ root, contentDir }` → `{ ok, gitVersion?, gitError?, folderExists, isRepo, branch?, remote?, remoteUrl?, contentExists, contentFiles }` (`server/repo-check.mjs`) |

**Codes.** Every error response is `{ error, code }`; `reason` comes with `reasonCode`, and publish results carry
`code` next to `message` / `error`. The codes are listed in `CODES` in `server/api.mjs` (`demo`, `not_a_repo`,
`no_remote`, `nothing_to_publish`, `committed_local`, `pushed_earlier`, `commit_failed`, `diff_failed`, `push_failed`,
`pull_failed`, `invalid_path`, `too_large`, `invalid_json`, `is_directory`, `not_found`, `forbidden`,
`method_not_allowed`, `unknown_route`, `server_error`). The English text stays the fallback; the UI translates known
codes with `serverText(code, text, lang)` from `src/storage/serverMessages.ts` (TR + EN). Codes whose text carries git
output (`commit_failed`, `push_failed`, …) are deliberately not translated, so the details stay visible.

Safety rules (non-negotiable):

- Bind `127.0.0.1` only (`startServer` refuses other hosts). Reject requests whose `Host` is not `localhost`/`127.0.0.1`/`[::1]`,
  on the API and on the static files (`server/static.mjs`, which also answers 400 to malformed percent-encoding).
  Under `startServer` the `Host` must also name the **bound port** (`isAllowedHost(req, port)`), which matters when the
  port is chosen at random: a page served by another local server cannot pass the check by guessing the name.
- Every API request, **GET included**, is refused (403 `forbidden`) when an `Origin` header is present and does not
  match the request's host, or when `Sec-Fetch-Site` is `cross-site` or `same-site` (`same-origin`, `none` and no header
  are allowed); see `crossSiteReason()` in `server/api.mjs`. Other loopback origins (`*.localhost`, other ports) are other sites.
- No CORS, ever: the API removes any `Access-Control-*` header set by an earlier middleware before it answers, and
  `vite.config.ts` runs the dev and preview servers with `cors: false` (Vite's default lets any localhost origin read).
- Every non-GET also needs header `X-HQ: 1`.
- Paths are normalised and must stay inside the content dir (no `..`, no absolute paths, no dot-files, symlinks
  resolved and not allowed to lead into dot-folders). Writes and deletes resolve only the parent folder, so they replace
  or remove a symlink itself rather than its target. `GET /api/file` answers with a `sandbox` CSP and `nosniff`.
- Settings routes follow the same rules (cross-site check, `X-HQ` on writes). A folder chosen there must exist; the content
  folder must stay inside it.
- No framing: `startServer` (npm start, desktop) sends `X-Frame-Options: DENY` and `frame-ancestors 'none'` on every response, the dev server sends
  `X-Frame-Options: DENY`, and `src/main.tsx` refuses to start inside a frame (static hosts cannot send headers).
- The first push is `git push -u --end-of-options <remote> refs/heads/<branch>`; git output returned to the UI has
  credentials in URLs masked (`redactCredentials`).
- Body limit 25 MB. Git only through `execFile` with argument arrays and `GIT_LITERAL_PATHSPECS=1` (no globs or
  `:(magic)` pathspecs; folder paths still match their contents).
- The dev/preview servers never serve a content folder as static files: `server/content-guard.mjs` (mounted by the Vite
  plugin before Vite's own middlewares) answers 404 for any URL that resolves into the configured content dir or the
  app's own `content/`: decoded repeatedly, normalised, case-insensitive on macOS/Windows, ignoring `?raw`/`?url`/`?import`,
  following `/@fs/` and `/@id/`. The same folders are added to `server.fs.deny` as a second line.

In the app: rendered Markdown never links into the app's own origin (relative paths, `/…`, this host or another
loopback name on the same port, `blob:` lose their `href`; `#…` routes and other sites work;
see `linkTarget()` in `src/components/markdown/render.ts`); SVG assets are cleaned with DOMPurify's SVG profile before
they become `blob:` URLs (`src/components/markdown/svg.ts`); `parseProjectMeta` keeps `color` only when it is a hex
colour (the stored value is never rewritten unless the user picks another); Settings warns when the PWA runs as a
GitHub Pages project site (`*.github.io/<repo>/`), whose origin is shared with every other Pages site of the account.

## Source layout and ownership

```
server/                     local server (server = startServer, app = settings routes, config, api, repo-check, git,
                            env, demo, build helpers, content-guard, static, index = `npm start`)
electron/                   desktop app: main, preload (window.hq), menu, path-env, updater, window-state
build/                      desktop icons (icon.png, icon.ico), generated by scripts/desktop-icons.mjs
scripts/                    setup.mjs (+ setup-lib.mjs), sandbox.mjs, desktop-icons.mjs
src/desktop/                window.hq type + getDesktop(), DesktopUpdateBanner
content/                    demo content
src/app/                    shell: App, routes, Sidebar, Topbar, ProjectLayout (tabs)
src/ui/                     shared primitives: Button, IconButton, Input, Textarea, Select, Modal,
                            ConfirmDialog, Tabs, Toast (useToast), EmptyState, Spinner, Badge, Card
src/styles/                 tokens.css, base.css
src/i18n/                   useLang(), useMessages(dict); each feature keeps its own `messages.ts` ({ tr, en })
src/storage/                types.ts, index.ts, local.ts, github.ts (+ github settings helpers)
src/data/                   types.ts, projects.ts (useProjects, useProject, saveProjectMeta, createProject,
                            deleteProject), files.ts (useTextFile, useFileList), slug.ts
src/components/markdown/    MarkdownDoc (editor + preview + image upload): `<MarkdownDoc path="…" />`
src/features/dashboard/     DashboardPage
src/features/overview/      OverviewTab (project details + edit form)
src/features/notes/         NotesTab
src/features/roadmap/       RoadmapTab
src/features/stores/        StoresTab
src/features/ads/           AdsTab
src/features/links/         LinksTab (quick-launch cards, grouped)
src/features/settings/      SettingsPage (GitHub connection; local repository info + LocalRepoForm; desktop section;
                            theme, language)
src/features/publish/       PublishButton (topbar) + publish panel
src/features/planner/       PlannerPage (week / month / day detail, backlog of open roadmap cards), dashboard
                            TodayBlock; model.ts + operations.ts + dates.ts are pure and unit-tested
```

### Foundation details (as built)

- `server/env.mjs` resolves `HQ_ROOT` / `HQ_CONTENT_DIR` / `PORT` for web mode: environment first, then `.env.local`, then
  defaults; it also holds `mergeEnvLine` / `hqRootValue`, shared by `npm run setup` and the Settings form.
  `npm run sandbox -- <port>` (`scripts/sandbox.mjs`) runs the dev server against a temp git copy of `content/`
  (sets `HQ_ROOT`, so it is not demo mode and publishing works into the temp repo).
- `src/storage/`: `detect.ts` (`getStorage`, `getStorageSetup`, `resetStorage`), `StorageProvider.tsx`
  (`StorageProvider`, `useStorage`, `useStorageInfo`, `useStorageSetup` → `{ storage, mode, needsSetup }`),
  `memory.ts` (`MemoryStorage`, in-memory fake for tests), `githubSettings.ts`, `listeners.ts`.
  In `github` mode without saved settings `needsSetup` is true and every route redirects to `/settings`.
  `GitHubStorage` is a stub until implemented: `info()` resolves, all other methods reject.
- `src/data/useStorageQuery.ts`: `useStorageQuery(key, load)`, the re-read-on-change hook every data hook uses.
  `src/data/messages.ts`: TR/EN labels for project types/statuses/store statuses + starter-file text.
- `src/ui/` also has `Field` (label/hint/error wrapper) and `TabNav` (route tabs; `Tabs` is in-page tabs).
- `src/app/`: `Shell.tsx` (sidebar/drawer + topbar frame + `DemoBanner`), `ProjectAvatar.tsx`, `projectStatus.ts`,
  `ProjectLayout.tsx` exports `useCurrentProject()` and `CurrentProjectProvider`.
- `src/i18n`: `defineMessages({ tr, en })` types a feature's dictionary; `useMessages(dict)` returns the active one.

Routes (hash): `/` dashboard · `/plan[/:date]` planner (opens on the week of `date`, `YYYY-MM-DD`) ·
`/p/:slug` overview · `/p/:slug/notes[/:note]` · `/p/:slug/roadmap` · `/p/:slug/stores` · `/p/:slug/ads` ·
`/p/:slug/links` · `/settings`.

## Desktop app (Electron)

Plain Electron + electron-builder (no Forge, no electron-vite). `package.json` `main` is `electron/main.mjs`.

- **Start-up.** `fixProcessEnv()` (`electron/path-env.mjs`) repairs `PATH` for GUI launches: macOS asks the login shell
  (`$SHELL -ilc`, 5 s timeout) for `PATH` and `SSH_AUTH_SOCK` (the latter only when unset), then adds existing fallback
  folders (`/opt/homebrew/bin`, `/usr/local/bin`, …); Windows adds existing Git for Windows / GitHub CLI / scoop folders.
  Entries are only added, never removed. Then `startServer({ config: desktop store, port: lastPort, fallbackToRandomPort })`:
  reusing the last port keeps the origin, and so `localStorage` / IndexedDB, stable across launches.
- **Window.** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, preload `electron/preload.mjs` (run as a
  plain script in the sandbox). `will-navigate` / `will-redirect` allow only the server origin; other http(s)/mailto URLs
  open in the default browser; `setWindowOpenHandler` always denies; webviews are blocked; every permission request
  and check is denied except `clipboard-sanitized-write` from the app origin (copy buttons). DevTools only in unpackaged runs.
  Bounds are saved in `window-state.json` and restored only when on a connected display.
- **`window.hq`** (`DesktopApi` in `src/desktop/bridge.ts`): `isDesktop`, `version` (passed via `additionalArguments`),
  `platform`, `pickFolder()`, `getOpenAtLogin()`, `setOpenAtLogin()`, `getUpdateState()`, `onUpdateState()`,
  `installUpdate()`. Each IPC handler checks that `event.senderFrame.url` has the server origin. UI code calls
  `getDesktop()` and renders desktop-only parts (Choose folder, Desktop app section, update notice) only when it exists.
  The service worker is not registered in the desktop app.
- **Lifecycle.** Single-instance lock (`second-instance` focuses the window); macOS keeps running with no window;
  `will-quit` waits for `running.close()` (max 3 s). Menu: app (macOS), File, Edit (roles, so Cmd+C/V/Z work), View,
  Window, Help (docs, releases, issues, check for updates). Unpackaged runs use `userData` = `Project HQ (dev)`.
- **Updates** (`electron/updater.mjs`, packaged builds only, 15 s after start then every 6 h): Windows and macOS builds
  with a Developer ID signature (`codesign -dv` shows a `TeamIdentifier`, not ad-hoc) use `electron-updater` (download
  in the background, `ready` → restart). Otherwise the app reads `GET /repos/<owner>/<repo>/releases/latest` (repository from
  `package.json`) and reports `available` with the release URL when the tag is newer.
- **`--smoke-test`**: temp `userData`, server on a random port, `/api/health` must answer `app: 'project-hq'`; when
  `dist/` exists a hidden sandboxed window must load and see `window.hq.version`, with no Node globals. Exit 0 / 1.
- **Packaging** (`electron-builder.yml`): files `package.json`, `dist/`, `server/`, `electron/`, `content/` in `app.asar`
  (the demo copy uses plain read/write calls so it works from the archive); only `dependencies` (`electron-updater`) ship.
  macOS dmg + zip (arm64, x64), Windows nsis (x64, per user). Signing / notarization only via env vars. Release CI:
  `.github/workflows/desktop-release.yml` (tag `v*` → draft release).

## External panels are launch cards, never iframes

AdMob, Play Console, App Store Connect, Firebase, analytics… are shown as quick-launch cards that open the
right page (deep link where the project has one) in a new tab. The app embeds nothing: no iframes, and the
production CSP sets `frame-src 'none'`.

## UI language and look

Turkish or English (Turkish when the browser language starts with `tr`, English otherwise; toggle in the top bar). Minimal, calm, content-first (think Linear / Notion): system font stack,
one accent colour, per-project colour dot, light + dark theme (system default, manual toggle), fully usable
on a phone (sidebar becomes a drawer, tabs scroll horizontally, 44 px touch targets).
