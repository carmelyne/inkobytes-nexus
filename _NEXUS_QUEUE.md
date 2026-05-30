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
