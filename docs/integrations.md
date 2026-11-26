# Integrations: GitHub, Google Play, App Store, AdMob

What each integration does today:

- **GitHub is a real API integration.** It is the storage backend of the PWA mode.
- **Google Play, App Store and AdMob are tracked, not synced.** You keep their ids, status, links and notes in your
  content, and Project HQ builds the right URLs and console links. Project HQ never asks for Google or Apple
  credentials and makes no calls to their APIs.

## GitHub

- **Local mode:** nothing to configure in the app. Create an **empty private repository** on github.com and add it as
  the remote of your content repo (or pass `--remote` to `npm run setup`):

  ```sh
  cd ../project-hq-content          # your HQ_ROOT
  git remote add origin https://github.com/<you>/<your-content-repo>.git
  ```

  Then press Publish; the first publish runs `git push -u origin main`. Authentication is your normal git setup
  (credential helper or SSH key). The app shows the remote in Settings and links each commit after publishing. See
  [publishing.md](publishing.md).
- **PWA mode:** create a fine-grained token and enter it in Settings. See [pwa.md](pwa.md).
- **Per-project code repositories:** in a project's Overview, add links to its code repositories (`repos` in
  `project.json`). They appear on the Overview, and the *GitHub* link preset points at the first one. This is also how
  you tell Claude Code which code belongs to which project (see [claude-code.md](claude-code.md)).

## Google Play

1. In a project's **Overview**, enable the *Stores* tab.
2. In **Stores > Google Play**, turn it on and enter the **package name** (for example `com.example.app`).
3. Pick the status (not started, draft, internal, closed or open testing, in review, live, rejected) and the version.

The public listing URL is built from the package name (`https://play.google.com/store/apps/details?id=...`). The console
link defaults to `https://play.google.com/console`, or you can paste your app's own console URL. `stores/android.md`
holds listing text and release checklists.

## App Store

Same tab, **App Store** panel: bundle id, status, version, the public listing URL and the App Store Connect URL (default
`https://appstoreconnect.apple.com`). Paste the listing URL yourself: it contains the numeric App Store id, which cannot
be derived from the bundle id. Notes go to `stores/ios.md`.

## AdMob

Enable the *Ads* tab in Overview. In **Ads**, enter the publisher id (`pub-...`) and the Android and iOS **app ids**
(`ca-app-pub-...~...`). The format is checked (warning only) and each id has a copy button. *Open AdMob* uses your
dashboard URL or `https://admob.google.com/v2/home`. Ad unit ids and experiments go to `ads/admob.md`.

AdMob ids are not secret (they ship inside your app), but they are yours: they live only in your content repo, never in
this repo.
