Run a quick current-state audit of the SAB project and update the Obsidian snapshot.

Steps:
1. Read `VERSION` and run `git log --oneline -5` to get current version and recent commits
2. Check `git status` for uncommitted changes
3. Identify the current branch and active work
4. Read `src/index.ts` first line and `src/sony/ptp-client.ts` first 10 lines to confirm entry points are intact
5. Read the current `SAB — Snapshot.md` from Obsidian vault at `~/Desktop/SAB - Obsidian/Claude code SAB/SAB — Snapshot.md`
6. Update the snapshot only if something has changed: version, branch, recent commits, or next steps
7. Report: current version, recent commits, active branch, next task, and whether snapshot was updated

Keep the report short. Do not read more files than needed.
