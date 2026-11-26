# Using Project HQ with Claude Code

Project HQ's data is plain files in a git repo, so [Claude Code](https://docs.claude.com/en/docs/claude-code/overview)
can read and update it directly. The open app shows the changes within a few seconds. Typical uses:

- you finish a feature in your app's code with Claude Code, and it ticks the matching roadmap card and writes a release
  note;
- you ask Claude Code to turn a long note of player feedback into roadmap cards;
- you ask it to plan your week across projects in `plan/2026-12.md`;
- you ask it to draft store listing text in `stores/android.md`.

## What is supported today

| Step | Supported |
| --- | --- |
| Define a project and link its code repository in the app (Overview > repositories) | Yes |
| Claude Code edits notes, roadmap, plan, store and ads notes or `project.json` in the content folder | Yes, any tool can write the files |
| Project HQ shows those edits without a reload | Yes in local mode, polled every `HQ_WATCH_INTERVAL_MS` (3 s) and on window focus |
| The edits appear in the Publish panel for review, discard or commit | Yes |
| Claude Code commits or pulls in the content repo itself | Yes, the app notices new commits too (HEAD is part of the fingerprint) |
| Claude Code learns the file formats | Yes, through `CLAUDE.md` in the content repo (added by `npm run setup`, template in [`templates/content-repo/CLAUDE.md`](../templates/content-repo/CLAUDE.md)) |
| PWA / GitHub mode | Partly: no live refresh; changes pushed to GitHub show up after *Refresh* in the Publish panel |
| Project HQ reading your **code** repository (commits, issues, PRs) | Not yet; only links to it |
| Starting Claude Code from the app | Not planned; run it in your terminal or IDE |

## Setup

1. Run Project HQ in local mode with your own content: `npm run setup`, then `npm start` (or use the desktop app).
2. Make sure your content repo has the `CLAUDE.md`. Setup adds it; for an existing repo, copy
   `templates/content-repo/CLAUDE.md` to the root of the content repo. Commit it once yourself: it lives outside the
   content folder, so Publish does not commit it.
3. In Project HQ, open the project, go to **Overview** and add your code repository link. Note the project's **slug**
   (the last part of the URL, `#/p/<slug>`).
4. Copy the **content folder path** from **Settings > Local repository**.

## Workflow A: Claude Code in your app's code repository

Start Claude Code in the code repo and give it access to the content folder as an extra working directory:

```sh
cd ~/code/my-app
claude --add-dir /path/to/project-hq-content        # the content repo (HQ_ROOT)
```

Optionally tell it once, in your code repo's `CLAUDE.md`, how the two are connected:

```md
## Project HQ
This app is tracked in Project HQ as project `my-app` (content repo: /path/to/project-hq-content,
formats described in its CLAUDE.md). When you finish a task, tick the matching card in
content/projects/my-app/roadmap.md and add a short entry to content/projects/my-app/notes/changelog.md.
Do not commit in the content repo; I publish from Project HQ.
```

Then work as usual: "Implement the daily challenge mode, then update Project HQ." Keep Project HQ open: the roadmap card
is ticked and the note appears within seconds, and the Publish panel lists both files so you can review and publish
them.

## Workflow B: Claude Code in the content repository

```sh
cd /path/to/project-hq-content
claude "Read content/projects/pebble-quest/notes/player-feedback.md and add the top 5 requests as cards to the Next column of its roadmap."
```

## Good to know

- **Last write wins.** If you type in a note in Project HQ while Claude Code writes the same file, one of the edits is
  lost. The editor keeps unsaved typing and takes outside changes only when it has nothing unsaved; roadmap and planner
  actions write the whole file from what was last loaded (at most a few seconds old). Avoid editing the same file in
  both at the same moment.
- **Review before publishing.** Claude Code's edits are ordinary uncommitted changes; you can discard any of them from
  the Publish panel.
- **Never let an agent put secrets in content.** The content repo is committed and pushed. The `CLAUDE.md` template says
  so.
- Set `HQ_WATCH_INTERVAL_MS` lower for faster updates, or `0` to turn polling off (the app then refreshes after its own
  actions and on navigation only). See [configuration.md](configuration.md#environment-variables).
