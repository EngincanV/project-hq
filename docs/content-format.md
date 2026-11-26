# Content format

Everything is hand-editable and reads well on GitHub. All paths are inside the content folder:

```
content/
  projects/<slug>/
    project.json        name, type, status, emoji, colour, store ids, links...
    roadmap.md          the roadmap board
    notes/<note>.md     notes; the title is the first "# " heading
    stores/android.md   Play Store notes
    stores/ios.md       App Store notes
    ads/admob.md        AdMob notes
    assets/<image>      images used by the notes (relative links)
  plan/<YYYY-MM>.md     the planner, one file per month
```

The app understands three Markdown formats. Anything else in these files is kept as is.

## Notes

Any Markdown. The first `# ` heading is the title. Images you paste, drop or pick in the editor are saved in `assets/`
and linked with a relative path.

## Roadmap

In `roadmap.md`, every `## ` heading is a column and every top-level task item is a card. Indented lines are the card's
details.

```md
# Roadmap

## Now
- [ ] Daily challenge mode
  One hand-made level per day.
- [x] Haptics on stone landing

## Next
- [ ] Rewarded ad for an extra undo
```

## Planner

In `plan/2026-11.md`, every `## YYYY-MM-DD` heading is a day. A trailing `#<project-slug>` ties an item to a project.

```md
# 2026-11

## 2026-11-23
- [ ] Stripe checkout for the Pro plan #ledgerbird
- [x] Reply to store reviews #pebble-quest
- [ ] Send November invoices
```

## More

The demo content in [`content/`](../content/) shows every format, and the `project.json` schema is in
[ARCHITECTURE.md](ARCHITECTURE.md#content-layout-the-data-model). Coding agents get the same rules from the `CLAUDE.md`
template in [`templates/content-repo/`](../templates/content-repo/CLAUDE.md).
