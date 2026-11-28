# Releasing (maintainers)

Desktop builds are made by [`.github/workflows/desktop-release.yml`](../.github/workflows/desktop-release.yml) on
`macos-latest` (dmg and zip, arm64 and x64) and `windows-latest` (NSIS installer).

## Make a release

1. Bump the version on `main`. This changes `package.json` and `package-lock.json`:

   ```sh
   npm version 0.3.0 --no-git-tag-version
   ```

2. Add the release to [CHANGELOG.md](../CHANGELOG.md), commit, and push to `main`.
3. Tag the commit and push the tag. The tag must be `v` plus the `package.json` version:

   ```sh
   git tag v0.3.0
   git push origin v0.3.0
   ```

4. The workflow checks the tag against `package.json`, runs the tests, builds on both operating systems, smoke-tests the
   packaged app on macOS and Windows, and uploads everything to a **draft** release. That includes `latest.yml` and
   `latest-mac.yml`, which the updater reads.
5. Check the draft on the Releases page, edit the notes and **Publish** it. Installed apps see the new version only
   after that.

## If the tag does not match package.json

The build fails with "Tag vX.Y.Z does not match package.json version A.B.C". Fix it like this:

```sh
npm version X.Y.Z --no-git-tag-version
git commit -am "chore: bump version to X.Y.Z"
git push origin main
git tag -d vX.Y.Z                       # delete the local tag
git push origin :refs/tags/vX.Y.Z       # delete the remote tag
git tag vX.Y.Z                          # tag the new commit
git push origin vX.Y.Z
```

If a draft release was already created for the tag, delete it on the Releases page first.

## Test packaging without a release

Run the workflow by hand: *Actions > Desktop release > Run workflow*, and pick a branch. A manual run skips the tag
check and the release job. It still builds and smoke-tests both operating systems and uploads the installers as workflow
artifacts (`desktop-macOS`, `desktop-Windows`), kept for 7 days.

## Signing (optional)

Without these repository secrets the builds are unsigned and still work (users see the first-launch warnings described
in [desktop.md](desktop.md#first-launch-of-an-unsigned-build), and unsigned macOS builds cannot update themselves). On
macOS such builds are ad-hoc signed with hardened runtime turned off; an app bundle with no signature at all is reported
as "damaged" after a download on Apple silicon. Only a Developer ID certificate with notarization removes the warning.

| Secret | For |
| --- | --- |
| `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD` | macOS Developer ID Application certificate (`.p12`, base64) and its password. Enables signing and macOS auto-update. |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | Notarization (only runs when the app is signed). |
| `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | Windows code-signing certificate (`.pfx`, base64) and its password. Avoids the SmartScreen warning once the certificate has a reputation. |

Locally the same variables work with `npm run desktop:build` (`CSC_LINK` and `CSC_KEY_PASSWORD` on macOS); see
[`electron-builder.yml`](../electron-builder.yml). To make a local build that matches an unsigned CI build on macOS, run
`CSC_IDENTITY_AUTO_DISCOVERY=false npm run desktop:build -- -c.mac.identity=- -c.mac.hardenedRuntime=false`.
