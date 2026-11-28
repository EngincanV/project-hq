# Desktop app (macOS and Windows)

The desktop app is Project HQ in its own window. It is the same app as the browser version, built from the same code,
and it keeps your content in your own git repository.

## Desktop app or from source?

| | Desktop app | From source (browser) |
| --- | --- | --- |
| Install | download an installer from [Releases](https://github.com/EngincanV/project-hq/releases) | clone, `npm install`, `npm start` |
| Needs | git | Node.js, npm and git |
| Opens in | its own window | your browser at `http://127.0.0.1:4173` |
| Settings stored in | `settings.json` in the app's data folder | `.env.local` in the app folder |
| Updates | built in (see [Updates](#updates)) | `git pull` |

The PWA on a phone ([pwa.md](pwa.md)) is a third way, for GitHub mode.

## Download and install

Get the latest version from [GitHub Releases](https://github.com/EngincanV/project-hq/releases):

- **macOS:** `Project-HQ-<version>-mac-arm64.dmg` for Apple silicon (M1 and later) or `Project-HQ-<version>-mac-x64.dmg`
  for Intel Macs. Open the dmg and drag **Project HQ** into **Applications**.
- **Windows:** `Project-HQ-Setup-<version>.exe`. It installs for your user only (no administrator rights needed) and adds
  a Start menu shortcut.

## First launch of an unsigned build

Release builds are not code-signed unless the maintainer has added signing certificates, so the operating system warns
you the first time:

- **macOS** marks every downloaded file as quarantined and checks it with Gatekeeper on first launch. For an unsigned
  build this ends in one of two messages:
  - **"Project HQ is damaged and can't be opened"**: shown for 0.3.0 and earlier on Apple silicon, whose app bundle has
    no signature. There is no "Open Anyway" button for this one.
  - **"Apple could not verify Project HQ is free of malware"**: shown for later, ad-hoc signed builds. Click **Done**,
    then open **System Settings > Privacy & Security**, scroll down and click **Open Anyway** next to Project HQ.

  The quickest fix for both is to remove the quarantine flag once in Terminal, then open the app as usual:

  ```sh
  xattr -dr com.apple.quarantine "/Applications/Project HQ.app"
  ```

  Right-click > **Open** no longer skips the check on macOS 15 (Sequoia) and later.

- **Windows** shows "Windows protected your PC" (SmartScreen). Click **More info**, then **Run anyway**.

You only need to do this once per installed version.

## git must be installed

The desktop app uses your own `git` for Publish, Discard and Refresh, exactly like `npm start`.

- macOS: run `xcode-select --install` or install git with [Homebrew](https://brew.sh) (`brew install git`).
- Windows: install [Git for Windows](https://git-scm.com/download/win).

Apps opened from Finder or the Start menu do not see your terminal's `PATH`. Project HQ fixes that at start-up: on macOS
it reads the `PATH` (and `SSH_AUTH_SOCK`) of your login shell and also looks in `/opt/homebrew/bin` and `/usr/local/bin`;
on Windows it looks in the standard Git for Windows and GitHub CLI folders. Your SSH agent, the macOS keychain, Git
Credential Manager and `gh` as a credential helper keep working.

To check, open **Settings > Local repository**, enter or choose a folder and press **Test connection**. It shows whether
git was found (and its version), whether the folder is a git repository, its branch and remote, and how many content
files it has. "Git was not found" means git is not installed or is somewhere unusual; install it as above and restart
the app.

## Choose your content folder

The first launch shows the demo content. Open **Settings > Local repository**, click **Choose folder** and pick your
content repository: the folder that contains `content/`. You can create one with `npm run setup` from a clone, or use
any git repository; the content folder is created on the first write. Press **Test connection**, then **Save**. The app
switches folders right away, no restart needed.

## Where desktop settings are stored

| OS | Folder |
| --- | --- |
| macOS | `~/Library/Application Support/Project HQ/` |
| Windows | `%APPDATA%\Project HQ\` (for example `C:\Users\<you>\AppData\Roaming\Project HQ\`) |

`settings.json` holds the content folder (`root`, `contentDir`) and the last port used; `window-state.json` holds the
window size and position. The app never reads `.env.local` or environment variables, so a shell variable cannot point it
somewhere unexpected. Theme, language and GitHub-mode drafts live in the app's browser storage in the same folder.
Development runs (`npm run desktop:dev`) use `Project HQ (dev)` instead, so they never touch an installed copy.

## Open at login

**Settings > Desktop app > Open at login** starts Project HQ when you log in. The same section shows the installed
version.

## Updates

The app checks GitHub Releases shortly after start and every six hours. It only looks at published releases, never
drafts or pre-releases.

- **Windows** (and **signed** macOS builds): the update downloads in the background. A small notice offers **Restart**;
  otherwise it installs the next time you quit.
- **Unsigned macOS builds** cannot replace themselves (macOS only allows that for signed apps), so a small notice says a
  new version is available, with a **Download** link to its release page. Install it like the first time.

**Help > Check for Updates...** (on macOS: **Project HQ > Check for Updates...**) checks right away.

## Run and build from source

```sh
npm install
npm run desktop:dev      # Electron window on the Vite dev server, with hot reload
npm run desktop:build    # builds the web app, then the installer for this OS into release/
npm run desktop:smoke    # starts the main process with --smoke-test: checks /api/health and the preload, exits 0 or 1
```

On macOS, `desktop:build` makes `release/Project-HQ-<version>-mac-arm64.dmg` and `Project-HQ-<version>-mac-x64.dmg`
(plus zips for updates). On Windows it makes `release/Project-HQ-Setup-<version>.exe`. Build each OS on that OS.

Maintainers: see [releasing.md](releasing.md) for how release builds are made and signed.

## One codebase

The desktop app is not a second app. `electron/main.mjs` calls the same `startServer()` as `npm start` and loads it in a
window; the React app, the local API, the content format and the security rules are shared. The only desktop-specific
parts are:

- the Electron files in `electron/` (main process, preload, menu, PATH fix, updates, window state);
- the `settings.json` branch of `server/config.mjs`;
- a few UI pieces that appear only when `window.hq` exists (Choose folder, Open at login, version, update notice).

Without Electron, the web version behaves exactly as before. More detail in
[ARCHITECTURE.md](ARCHITECTURE.md#desktop-app-electron).
