# Configuration

Project HQ has no hard-coded user, repository, owner, app id or path. Everything that differs between users is one of:

- an environment variable (server or build),
- a setting in the app,
- a field in your own content.

## Running from source

```sh
git clone https://github.com/EngincanV/project-hq.git   # or your fork
cd project-hq
npm install
npm start            # serves http://127.0.0.1:4173 with demo content
```

The demo projects are there so every screen has something to show. You can edit freely: demo edits go to a temporary
copy and are gone when you stop the server, and publishing is off.

When you want your own content:

```sh
npm run setup        # asks where your content repo should live, creates it and points the app at it
npm start            # restart: now you see your own (empty) workspace
```

`npm start -- --open` also opens the browser. `npm start` builds the app first when needed, so there is no separate
build step.

### What `npm run setup` does

`npm run setup` asks where to put the content repository (by default a sibling folder next to the app, for example
`../project-hq-content`; any path works). Then it:

1. creates `<dir>/content/` and runs `git init -b main` there;
2. optionally copies the demo projects;
3. optionally adds a GitHub remote;
4. adds a `CLAUDE.md` for coding agents (see [claude-code.md](claude-code.md));
5. writes `HQ_ROOT=<dir>` to `.env.local` (git-ignored).

It never deletes anything, never creates a GitHub repo and never pushes. Run it again any time to switch to another
folder. Non-interactive example:

```sh
npm run setup -- --dir ~/notes/hq --no-examples --remote git@github.com:<you>/<your-content-repo>.git --yes
```

## `npm run setup` flags

| Flag | Default | What it does |
| --- | --- | --- |
| `--dir <path>` | asks; suggests `../project-hq-content` | Where the content repo lives. |
| `--here` | off | Keep content inside this app repo (`HQ_ROOT=.`), only for a **private** fork. |
| `--with-examples` / `--no-examples` | asks; no | Copy the demo projects as a starting point. |
| `--claude-md` / `--no-claude-md` | asks; yes | Add `CLAUDE.md` (content formats for coding agents) to the content repo. |
| `--remote <url>` | asks; none | Add this URL as `origin` of the content repo. |
| `-y`, `--yes` | off | Do not ask; use flags and defaults. |

## Environment variables

Copy [`.env.example`](../.env.example) to `.env.local` (git-ignored) or export the variables in your shell. Precedence:
environment, then `.env.local`, then the default. None of these is a secret. The desktop app ignores them; it uses
`settings.json` instead (see [desktop.md](desktop.md#where-desktop-settings-are-stored)).

| Variable | Used by | Default | What it does |
| --- | --- | --- | --- |
| `HQ_ROOT` | local server | *(unset: demo mode)* | Folder of your content git repo. Relative to the app folder, or absolute. `npm run setup` writes it. |
| `HQ_CONTENT_DIR` | local server | `content` | Sub-folder of `HQ_ROOT` that holds `projects/` and `plan/`. Must be inside `HQ_ROOT`; `.` means the repo root. |
| `PORT` | `npm start` | `4173` | Port of the local server (always bound to `127.0.0.1`). `npm run dev` uses Vite's port (5173). |
| `HQ_WATCH_INTERVAL_MS` | local server and app | `3000` | How often the open app checks the content folder for outside changes. `0` turns it off. |
| `VITE_HQ_REPO` | PWA build | *(empty)* | `owner/repo` that **prefills** the GitHub Settings form. Baked into the public bundle; never put a token here. |
| `VITE_HQ_BRANCH` | PWA build | `main` | Branch that prefills the Settings form. |

In the GitHub Pages workflow the two `VITE_*` values come from the repository **variables** `HQ_CONTENT_REPO` and
`HQ_CONTENT_BRANCH` (*Settings > Secrets and variables > Actions > Variables*).

## In-app settings

| Where | Setting | Stored in |
| --- | --- | --- |
| Settings > GitHub connection (PWA mode) | Repository (`owner/repo`), branch, content folder, access token | this browser's `localStorage` |
| Settings > Local repository (local mode) | Repository folder and content folder (with **Test connection**; **Choose folder** in the desktop app); shows the content folder path, GitHub remote and whether Publish works | `.env.local` (`HQ_ROOT`, `HQ_CONTENT_DIR`) from source; `settings.json` in the desktop app |
| Settings > Desktop app (desktop only) | Open at login; shows the version | the operating system's login items |
| Settings > Appearance | Theme (light, dark, system) | this browser |
| Top bar | Language (English, Türkçe) | this browser |
| Project > Overview | Name, tagline, type, status, emoji, colour, enabled tabs (Stores, Ads), code repositories, website | `projects/<slug>/project.json` |
| Project > Stores | Package name or bundle id, status, version, listing URL, console URL per store | `project.json` and `stores/*.md` |
| Project > Ads | AdMob publisher id, Android and iOS app ids, dashboard URL | `project.json` and `ads/admob.md` |
| Project > Links | Any console or dashboard links, with presets | `project.json` |

## Switching the content folder

In local mode you have three options:

- choose the folder in **Settings > Local repository** and press **Save** (the switch is immediate);
- run `npm run setup` again;
- edit `HQ_ROOT` in `.env.local` and restart the server.

When `HQ_ROOT` is set as an environment variable it wins, and the form says so instead of saving.
