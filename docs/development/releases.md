# CI and GitHub releases

## Quality gate

[CI](../../.github/workflows/ci.yml) runs on pull requests, pushes to main, manual dispatch, and as a reusable release prerequisite. Node.js 24 and `npm ci` provide a lockfile-based install. `npm run check` runs ESLint, TypeScript, all Vitest tests, the production Chromium build, and popup verification. Playwright Chromium then runs `verify:integrity` and `verify:sidebar` against synthetic local data and routed X fixtures. No X credentials are needed. `test:e2e` is a scaffold without specs; the two browser verification scripts provide the current browser automation.

ESLint uses recommended JavaScript correctness rules and the TypeScript parser; TypeScript checks name resolution for TS files; unused TS variables are not currently a lint gate. The caught-error preservation rule is disabled because the CLI deliberately sanitizes transport errors. Lint does not enforce formatting.

## Release policy

[Release](../../.github/workflows/release.yml) runs after pushes to main, including PR merges and authorized direct commits. It reruns the same CI gate before publishing. Automatic releases increment patch; use Actions → Release → Run workflow on **main** to choose patch, minor, or major. The initial package version is 0.0.0, so the first automatic release is 0.0.1. Version selection is explicit rather than inferred from commit-message conventions.

The job increments `package.json` and `package-lock.json`, builds with WXT (which derives the extension manifest version from the package version), validates the ZIP manifest, and commits and tags the version as `vX.Y.Z`. An atomic push publishes the main commit and tag together; a concurrent main update rejects the push instead of overwriting it. A stale queued run skips publication; the newer main push has its own release run. GitHub concurrency can coalesce pending runs, so releases represent the latest checked main, not necessarily one release per merge during a burst.

One `contexto-X.Y.Z-chrome.zip` supports Chrome and Vivaldi MV3. Firefox/Safari artifacts are not advertised or built. GitHub Releases contains the ZIP, `SHA256SUMS`, installation guidance, and GitHub-generated notes listing changes/contributors since the previous release. GitHub Releases is the canonical changelog. Source archives are not extension bundles. Version numbers are extension/package versions, independent of database schema versions.

## Permissions and administration

CI has read-only repository permissions. Only the publishing job has `contents: write`; it uses the built-in `GITHUB_TOKEN` and GitHub CLI, with no additional secrets. Token-created version commits do not trigger recursive push workflows ([GitHub documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)). The versioned archive is checked in the release job before publishing.

Repository rules must permit the Actions bot to push release version commits and tags. If main requires PRs without an applicable bot bypass, this workflow will fail at push; configure the repository policy or adopt a release-PR process before enabling that restriction. Select the CI check as a required merge check in repository settings if desired; adding a workflow does not configure branch protection.

## Failure recovery

Failures before the atomic push publish no version changes or tag. Fix the cause and dispatch Release on main again. A main update during packaging can reject the atomic push; let the newer run release instead.

If tag publication succeeds but GitHub release creation fails, rerunning the failed publishing job detects advanced main and skips. Recover the existing tag explicitly instead of bumping another version: check out that tag, run `npm ci`, `npm run zip`, `node scripts/verify-release.mjs`, and create `.output/SHA256SUMS` with `sha256sum contexto-*-chrome.zip` from `.output`. Use `gh release create vX.Y.Z .output/contexto-X.Y.Z-chrome.zip .output/SHA256SUMS --verify-tag --generate-notes` with installation instructions, or upload the assets through GitHub's release UI. Inspect whether a release already exists before creating it. Do not move published tags. A fresh manual workflow run intentionally produces a new version.

## Installation and updates

See [README installation](../../README.md#download-and-install). Export a backup before updating, replace files in the same permanent unpacked folder, and reload the existing extension. Keep the same profile, path, and installation; do not uninstall to update. Downloads do not auto-update. Manual signed-in Chrome/Vivaldi QA remains necessary for X integration changes; CI fixtures do not reproduce every live X variant.
