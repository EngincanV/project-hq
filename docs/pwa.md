# Using it on your phone (PWA)

The same build runs as an installable web app on static hosting. It talks to GitHub directly; there is no server. Your
GitHub token and the offline copy of your notes stay in the browser.

## Setup

1. **Fork** this repo. In your fork, go to *Settings > Pages > Source* and choose *GitHub Actions*, and allow workflows
   in the *Actions* tab (GitHub disables them on new forks). Then run *Actions > Deploy to GitHub Pages > Run workflow*
   (it also runs on every push to `main`). The site appears at `https://<you>.github.io/project-hq/`. Before you store a
   token there, read [Where to host it](#where-to-host-it) below. Optional: set the repository variables
   `HQ_CONTENT_REPO` (`owner/repo`) and `HQ_CONTENT_BRANCH` to prefill the Settings form.
2. **Create a fine-grained token** at
   [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new):
   - Repository access: *Only select repositories*, and select only your **content** repo.
   - Permissions: under Repository permissions, set **Contents** to **Read and write**. Nothing else.
   - Pick an expiration date you are comfortable with.
3. Open the site, enter the content repo and the token in **Settings**, press *Test connection*, then *Save*.
4. **Install it:** on Android (Chrome) use *Install app* or *Add to Home screen*; on iPhone (Safari) use *Share > Add to
   Home Screen*.

Your edits are kept as drafts in that browser until you publish. To load changes made elsewhere, use *Refresh* in the
Publish panel. See [publishing.md](publishing.md#pwa-mode).

## Where to host it

Browsers keep `localStorage` and IndexedDB (where the token and the offline copy of your notes live) per *origin*: scheme
plus host, without the path. Every GitHub Pages project site of an account, `https://<you>.github.io/<any-repo>/`, has
the same origin `https://<you>.github.io`. So any other project site you publish there, now or later, could read the
token and notes stored by Project HQ. The app shows a warning in Settings when it runs from such a URL.

Give the app an origin of its own instead, any of:

- a **custom (sub)domain** for this Pages site (*Settings > Pages > Custom domain*, for example `hq.example.com`);
- a **`<you>.github.io` root repository** used only for this app (then do not host other user-site content there);
- a **static host that gives each site its own subdomain**.

## Keeping the token safe

- Use a fine-grained token limited to the content repo with *Contents* permission only, and give it an expiration date.
- Anyone who can run JavaScript on the app's origin could read the token, which is why the origin matters.
- Use *Settings > Disconnect* to remove the token, its cache and drafts from a browser.

More in [security.md](security.md).
