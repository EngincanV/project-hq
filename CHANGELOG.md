# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-26

### Added

- Desktop app for macOS (dmg and zip, Apple silicon and Intel) and Windows (installer), built with Electron from the
  same codebase as the web app. It runs the same local server in its own sandboxed window.
- Choose the local content folder from **Settings > Local repository**, with **Test connection** (git found, folder,
  repository, branch, remote, content files) and **Save**. The app switches folders without a restart.
- Desktop only: native **Choose folder** picker, **Open at login** switch, version display and an update notice.
- Automatic updates from GitHub Releases on Windows and signed macOS builds; unsigned macOS builds show a link to the
  new release.
- PATH fix for apps started from Finder or the Start menu, so your git, SSH agent and credential helpers keep working.
- `npm run desktop:dev`, `desktop:build`, `desktop:smoke` and `icons:desktop` scripts.
- Desktop release workflow that builds installers on `v*` tags, smoke-tests the packaged app on macOS and Windows and
  uploads the files to a draft release. It can also be run by hand to test packaging without a release.
- Issue forms, pull request template, Code of Conduct, Dependabot configuration and this changelog.

### Changed

- The local server is started through a shared `startServer()` and a single config module for web (`.env.local`) and
  desktop (`settings.json`). The Host allow-list also checks the bound port.
- Frontend libraries moved to `devDependencies`; the packaged app only ships `electron-updater`.
- The README is shorter, and the detailed documentation moved to focused pages under `docs/`.

### Fixed

- The embedded Vite dev server uses `server.ws` (Vite 8).
- The desktop demo points to the folder form instead of `npm run setup`.

## [0.1.0] - 2026-11-26

First public release.

### Added

- Projects with name, emoji, colour, type and status, and a dashboard with roadmap progress and store status.
- Markdown notes with Write, Split and Preview views, a formatting toolbar, task lists and image upload.
- Roadmap board per project, stored as headings and task items in `roadmap.md`.
- Planner with week and month views across all projects, and today's plan on the dashboard.
- Google Play, App Store and AdMob tracking (ids, status, versions, links and notes) and quick-launch link cards.
- Publish panel: review changes, discard them one by one, and commit and push with your own git.
- Local mode (Node server bound to `127.0.0.1`) and PWA mode (GitHub API with a fine-grained token).
- Live refresh of content changes made outside the app (local mode).
- `npm run setup` to create a content repository, with an optional `CLAUDE.md` template for coding agents.
- English and Turkish UI, light and dark themes.
- `.env.example`, `SECURITY.md` and documentation for using Project HQ with Claude Code.

### Security

- Hardened the local publish flow against clickjacking, symlinks and git option injection.
- Ignore environment files, keys and credentials in git.

[Unreleased]: https://github.com/EngincanV/project-hq/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/EngincanV/project-hq/releases/tag/v0.2.0
[0.1.0]: https://github.com/EngincanV/project-hq/tree/b564b78
