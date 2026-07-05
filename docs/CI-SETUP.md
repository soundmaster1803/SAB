# Enabling the GitHub build (Windows exe + mac DMG)

The workflow that builds the installers lives at `.github/workflows/build.yml`
(present in the working tree). It is **not yet pushed** because the current
GitHub token lacks the `workflow` scope, so GitHub refuses to accept workflow
files over the API/push.

## One-time enable (run these in the SAB folder)

```bash
# 1) grant the workflow scope to your gh login (opens a browser once)
gh auth refresh -s workflow

# 2) commit and push the workflow
git add .github/workflows/build.yml
git commit -m "ci: build Windows exe + mac DMG"
git push origin main
```

In Claude Code you can run each line by typing it with a leading `!`.

## What it does
- On a pushed tag `v*` (e.g. `v1.1.0-beta`, already pushed) **or** a manual run
  (Actions tab → “Build installers” → Run workflow), it builds:
  - **Windows**: NSIS `.exe` + `.zip` on a Windows runner (no wine needed).
  - **macOS**: universal `.dmg` on a mac runner.
- Download them from the run’s **Artifacts** (SAB-windows / SAB-macos).

## Why this route
macOS cannot build the Windows NSIS installer locally without `wine`, which isn’t
installed. Building on GitHub’s Windows runner is the clean way to get the exe.
The installers are self-contained — Electron bundles Node + Chromium, and the
bridge + UI ship inside the app, so nothing extra needs installing on the target PC.

## Local mac build (already done)
`npm run app:pack:mac` → `release/SAB-1.1.0-beta-universal.dmg`, collected into
`releases/v1.1.0-beta/`. Use `./scripts/sab.sh start` to run without packaging.
