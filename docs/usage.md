# Using Project HQ

A tour of every area of the app. The [README](../README.md#usage) has the short version.

## Projects

One folder per project with a name, emoji, colour, type (mobile game, mobile app, web app, SaaS, other) and status
(idea, building, live, paused, archived). The dashboard shows your projects as cards with roadmap progress and store
status, plus today's plan. Edit a project's details in its **Overview** tab, where you also turn the Stores and Ads
tabs on or off and link its code repositories and website.

## Notes

As many Markdown notes per project as you like, with a real editor:

- Write, Split and Preview views;
- a formatting toolbar and [keyboard shortcuts](keyboard-shortcuts.md);
- task lists you can tick in the preview, tables, code blocks and links;
- images you can paste, drop or pick, saved next to the notes in `assets/` and linked with a relative path.

Notes save automatically; there is no save button.

## Roadmap

A board per project. Columns and cards are just `##` headings and `- [ ]` items in `roadmap.md`. You can add, edit,
move and tick cards, or switch to the raw Markdown. The format is in [content-format.md](content-format.md#roadmap).

## Planner

A week and month calendar across all projects. Plan a day, tag items with a project, and drag open roadmap cards from
the backlog onto a day. Today's plan is also on the dashboard. The format is in
[content-format.md](content-format.md#planner).

## Stores

Google Play and App Store per project: package name or bundle id, status, version, listing and console links, plus a
Markdown page for listing text and release checklists. See [integrations.md](integrations.md#google-play).

## Ads

AdMob publisher and app ids, a dashboard link and a notes page for ad units and experiments. See
[integrations.md](integrations.md#admob).

## Links

Quick-launch cards for consoles and dashboards (Play Console, App Store Connect, AdMob, Firebase, Stripe, Vercel and
so on), grouped as you like. They open in a new tab; nothing is embedded.

## Publish

See every unpublished change, write (or accept) a commit message, discard changes one by one, and publish. Open the
panel with `Mod+Shift+U`. Details in [publishing.md](publishing.md).

## Live refresh

In local mode the app notices changes made to the content folder by other tools (an editor, Claude Code, `git pull`)
and refreshes within a few seconds. See [claude-code.md](claude-code.md).

## Settings

Choose your content folder, connect GitHub (PWA mode), pick the theme (light, dark, system) and, in the desktop app,
turn on Open at login. The language switch (English, Türkçe) is in the top bar. All settings are listed in
[configuration.md](configuration.md#in-app-settings).
