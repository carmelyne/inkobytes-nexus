# Nexus Queue

## Runways

- @Codex: Release hygiene -> open-source CLI prep

## Ready Queue

- [ ] TASK/@claude: Add agent presence check-in/check-out system
  - Id: agent-presence
  - Epic: Dashboard observability
  - Status: Ready
  - Depends on: none
  - Files: src/commands/checkin.js, src/commands/checkout.js, src/lib/lockManager.js, src/commands/dashboard.js, nexus-dashboard/index.html, bin/nexus.js
  - Affinity: cli, dashboard, protocol
  - Cost: medium
  - Auto-flow: no
  - Notes: Add `nexus checkin @agent` and `nexus checkout @agent` commands. Write a heartbeat timestamp to `.nexus/presence/@agent`. Dashboard reads freshness (online = updated within 60s, idle = 60-300s, offline = >300s or missing). Show green/yellow/gray dot on agent tabs in queue block. Checkin should be called by `nexus start`, checkout by agent on session end. Add `nexus checkout --all` for emergency cleanup.

- [ ] TASK/Codex: Build Nexus completed task ledger
  - Id: nexus-ledger
  - Epic: Dashboard observability
  - Status: Ready
  - Depends on: none
  - Files: src/commands/ledger.js, src/commands/dashboard.js, nexus-dashboard/index.html, _NEXUS_LEDGER.md
  - Affinity: cli, dashboard, reporting
  - Cost: medium
  - Auto-flow: no
  - Notes: When a task is marked [x] in _NEXUS_QUEUE.md, append a structured entry to _NEXUS_LEDGER.md with: task id, title, agent, epic, files touched, date completed, cost. `nexus release` should trigger this automatically when it detects a newly checked task. `nexus ledger` command shows a summary. Dashboard gets a new Ledger panel showing recent completions. This becomes the source of truth for reporting, velocity tracking, and handoff context across sessions.

- [ ] TASK/Codex: Add agent attribution to release commits
  - Id: commit-attribution
  - Epic: Metrics & observability
  - Status: Ready
  - Depends on: none
  - Files: src/lib/git.js, src/commands/release.js, src/commands/claim.js
  - Affinity: cli, metrics, protocol
  - Cost: small
  - Auto-flow: yes
  - Notes: Change commit format from `[Agent] message` to `[@agent] message` so every release is attributable. `release.js` reads the agent from the lock file (already stored as `agent` metadata) and passes it to `stageAndCommit`. Update `stageAndCommit` signature to accept optional agent param. This unlocks per-agent git metrics from day forward.

- [ ] TASK/Codex: Unify _NEXUS_REPORT.md into single structured format
  - Id: report-unification
  - Epic: Metrics & observability
  - Status: Ready
  - Depends on: commit-attribution
  - Files: src/commands/release.js, _NEXUS_REPORT.md
  - Affinity: cli, metrics, reporting
  - Cost: small
  - Auto-flow: yes
  - Notes: _NEXUS_REPORT.md currently has two formats — compact auto-log lines at top (legacy) and structured Done claim blocks below (current). Unify into one format per entry that includes: timestamp, agent, target, commit message. Remove the empty Done claim / Adversarial result template boilerplate since agents rarely fill it in. Result should be a clean append-only log that `nexus metrics` can parse reliably.

- [ ] TASK/Codex: Build nexus metrics command
  - Id: nexus-metrics
  - Epic: Metrics & observability
  - Status: Ready
  - Depends on: commit-attribution, report-unification
  - Files: src/commands/metrics.js, bin/nexus.js
  - Affinity: cli, metrics, reporting
  - Cost: medium
  - Auto-flow: no
  - Notes: Parse git log for `[@agent]` commits and _NEXUS_REPORT.md for release data. Surface: commits per agent, files most frequently released, release velocity by week, cost distribution from queue. Output as formatted table to terminal. Optional `--json` flag for dashboard consumption. Future: surface in dashboard as a Metrics panel.

- [ ] TASK/Codex: Add lock manager tests
  - Id: lockmanager-tests
  - Epic: Open-source CLI release
  - Status: Ready
  - Depends on: none
  - Files: test/lockManager.test.js, src/lib/lockManager.js
  - Affinity: cli, testing
  - Cost: small
  - Auto-flow: yes
  - Notes: lockManager now stores agent+intent files alongside ts in lock dir. Tests should cover acquireLock writes all three files, releaseLock cleans all three, listLocks reads agent+intent back correctly.

- [x] TASK/Codex: Prepare Nexus CLI for open-source release
  - Id: release-hygiene
  - Epic: Open-source CLI release
  - Status: Done
  - Depends on: none
  - Files: README.md, package.json, .gitignore, src/commands/doctor.test.js
  - Affinity: cli, release
  - Cost: medium
  - Auto-flow: no
