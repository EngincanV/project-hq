# Project HQ content repository

This repository holds the notes, roadmaps and plans that [Project HQ](https://github.com/EngincanV/project-hq)
shows. Project HQ reads these files directly: any change you make here appears in the open app within a few seconds
(it polls the folder; `HQ_WATCH_INTERVAL_MS`, default 3000 ms). Keep to the formats below so the app can parse them.

## Layout

Everything the app shows lives under `content/` (the folder name is `HQ_CONTENT_DIR`, default `content`).

```
content/
  projects/<slug>/
    project.json        project metadata (see below)
    roadmap.md          roadmap board
    notes/<name>.md     free-form notes; the first "# " heading is the title
    stores/android.md   Google Play notes (listing text, release checklist)
    stores/ios.md       App Store notes
    ads/admob.md        AdMob notes (ad units, experiments)
    assets/<file>       images, linked from Markdown with relative paths (../assets/x.png)
  plan/<YYYY-MM>.md     planner, one file per month
```

`<slug>` is lower-case letters, digits and `-` (e.g. `pebble-quest`). Files and folders starting with `.` are ignored
by the app.

## roadmap.md

Every `## ` heading is a board column; every top-level task item is a card; indented lines under a card are its details.

```md
# Roadmap

## Now
- [ ] Daily challenge mode
  One hand-made level per day.
- [x] Haptics on stone landing

## Next
- [ ] Rewarded ad for an extra undo
```

To mark work as done, change `- [ ]` to `- [x]`; do not delete the card. Move a card by moving its lines (with its
indented details) under another `##` heading. Keep text outside cards as it is.

## plan/YYYY-MM.md

Every `## YYYY-MM-DD` heading is a day; a trailing `#<project-slug>` ties an item to a project.

```md
# 2026-11

## 2026-11-23
- [ ] Stripe checkout for the Pro plan #ledgerbird
- [x] Reply to store reviews #pebble-quest
```

## project.json

```jsonc
{
  "schema": 1,                       // always 1
  "name": "Pebble Quest",
  "tagline": "A cozy puzzle game",   // optional
  "type": "mobile-game",             // mobile-game | mobile-app | web-app | saas | other
  "status": "live",                  // idea | building | live | paused | archived
  "emoji": "🪨", "color": "#10b981", // optional; color must be a hex value
  "modules": { "stores": true, "ads": true },
  "repos": [{ "label": "App", "url": "https://github.com/<owner>/<repo>" }],
  "stores": {
    "android": { "enabled": true, "appId": "com.example.app", "status": "live", "version": "1.4.0" },
    "ios": { "enabled": true, "appId": "com.example.app", "status": "in-review", "version": "1.4.0" }
  },
  "ads": { "admob": { "publisherId": "pub-…", "androidAppId": "ca-app-pub-…~…", "iosAppId": "ca-app-pub-…~…" } },
  "links": [{ "id": "play-console", "label": "Play Console", "url": "https://play.google.com/console", "group": "Stores" }]
}
```

Store `status` is one of `not-started`, `draft`, `internal-testing`, `closed-testing`, `open-testing`, `in-review`,
`live`, `rejected`. Keep unknown keys: the app preserves them. Write valid JSON (no comments) with 2-space indentation.

## Rules for agents

- Only edit files under `content/` unless asked otherwise. Never write secrets (tokens, keys, passwords) into these
  files: they are committed and may be pushed to GitHub.
- Prefer small, targeted edits over rewriting whole files, and do not reformat files you only read.
- Do not commit or push unless the user asks; the user reviews and publishes changes from Project HQ's Publish panel
  (it lists every changed file and lets them discard changes one by one).
- If the user is editing the same file in Project HQ at the same moment, the last write wins. Tell the user which
  files you changed.
