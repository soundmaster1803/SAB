Run a quick current-state audit of the SAB project and update the Obsidian snapshot.

Steps:
1. Run `git log --oneline -5` and `cat VERSION` — get version and recent commits
2. Run `git status --short` — check for uncommitted changes
3. Read `SAB — Snapshot.md` from `~/Desktop/SAB - Obsidian/Claude code SAB/`
4. Update the snapshot only if something has changed: version, branch, recent commits, or next step
5. Report: version, branch, last 3 commits, next task, whether snapshot was updated

Keep the report short. Do not read source files unless something looks broken.
