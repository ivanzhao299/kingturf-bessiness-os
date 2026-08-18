# Execution Boundary

- Control plane: Agent Studio lane `kingturf-business-os`.
- Worker: one Codex Worker dispatched by that lane; no independent Codex project task.
- Repository: `/Users/mac/Documents/kingturf-bessiness-os`, branch `main`.
- Current stage: `L02-CRM-CUSTOMER-360`.
- Website repository `ivanzhao299/kingturf-website` is excluded from this lane.
- Historical Studio jobs, old worktrees and cron snapshots are not active execution.
- Before dispatch: read all project Memory, verify one owner, branch, local/remote SHA and WIP.
