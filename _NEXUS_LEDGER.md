# Nexus Completed Task Ledger

## nexus-ledger

- Id: nexus-ledger
- Title: Build Nexus completed task ledger
- Agent: @codex
- Epic: Dashboard observability
- Cost: medium
- Completed At: 2026-05-31T15:02:56.238Z
- Files: src/commands/ledger.js, src/commands/release.js, src/commands/dashboard.js, src/lib/config.js, bin/nexus.js, README.md, _NEXUS_LEDGER.md, test/ledger.test.js, test/release.test.js, test/dashboard.test.js
- SHA: e9323ab2000f49a3986d4663d867b74884c88950
- Commit: feat: add completed task ledger command
## agent-presence

- Id: agent-presence
- Title: Add agent presence check-in/check-out system
- Agent: @gemini
- Epic: Dashboard observability
- Cost: medium
- Completed At: 2026-05-31T17:01:41.692Z
- Files: src/commands/checkin.js, src/commands/checkout.js, src/lib/lockManager.js, src/commands/dashboard.js, nexus-dashboard/index.html, bin/nexus.js
- SHA: unknown
- Commit: backfill: agent-presence
- Source: backfill

## dashboard-aesthetic-overhaul

- Id: dashboard-aesthetic-overhaul
- Title: Dashboard aesthetic overhaul
- Agent: @gemini
- Epic: Dashboard observability
- Cost: medium
- Completed At: 2026-05-31T17:01:41.692Z
- Files: nexus-dashboard/index.html, nexus-dashboard/style.css
- SHA: unknown
- Commit: backfill: dashboard-aesthetic-overhaul
- Source: backfill

## release-head-drift

- Id: release-head-drift
- Title: Add same-branch HEAD drift warning before release
- Agent: @codex
- Epic: Same-branch recoverability
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: src/commands/claim.js, src/commands/release.js, src/lib/lockManager.js, test/release.test.js, test/lockManager.test.js
- SHA: unknown
- Commit: backfill: release-head-drift
- Source: backfill

## report-self-noise

- Id: report-self-noise
- Title: Add report self-noise handling for _NEXUS_REPORT.md releases
- Agent: @codex
- Epic: Same-branch recoverability
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: src/commands/release.js, test/release.test.js, _NEXUS_CONSTITUTION.md
- SHA: unknown
- Commit: backfill: report-self-noise
- Source: backfill

## skill-queue-authoring

- Id: skill-queue-authoring
- Title: Document queue item authoring pattern in Nexus skill
- Agent: @codex
- Epic: Open-source CLI release
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: skills/nexus/SKILL.md, README.md, test/security.test.js
- SHA: unknown
- Commit: backfill: skill-queue-authoring
- Source: backfill

## generated-artifact-ownership

- Id: generated-artifact-ownership
- Title: Add generated artifact ownership checks
- Agent: @codex
- Epic: Same-branch recoverability
- Cost: medium
- Completed At: 2026-05-31T17:01:41.692Z
- Files: src/commands/doctor.js, src/commands/status.js, test/doctor.test.js, test/status.test.js
- SHA: unknown
- Commit: backfill: generated-artifact-ownership
- Source: backfill

## metrics-identity-cleanup

- Id: metrics-identity-cleanup
- Title: Add identity cleanup for legacy Agent/unknown metrics
- Agent: @codex
- Epic: Metrics & observability
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: src/commands/metrics.js, test/metrics.test.js
- SHA: unknown
- Commit: backfill: metrics-identity-cleanup
- Source: backfill

## commit-attribution

- Id: commit-attribution
- Title: Add agent attribution to release commits
- Agent: @codex
- Epic: Metrics & observability
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: src/lib/git.js, src/commands/release.js, src/commands/claim.js
- SHA: unknown
- Commit: backfill: commit-attribution
- Source: backfill

## report-unification

- Id: report-unification
- Title: Unify _NEXUS_REPORT.md into single structured format
- Agent: @codex
- Epic: Metrics & observability
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: src/commands/release.js, _NEXUS_REPORT.md
- SHA: unknown
- Commit: backfill: report-unification
- Source: backfill

## nexus-metrics

- Id: nexus-metrics
- Title: Build nexus metrics command
- Agent: @codex
- Epic: Metrics & observability
- Cost: medium
- Completed At: 2026-05-31T17:01:41.692Z
- Files: src/commands/metrics.js, bin/nexus.js
- SHA: unknown
- Commit: backfill: nexus-metrics
- Source: backfill

## model-capture

- Id: model-capture
- Title: Add model + thinking level capture to claim metadata
- Agent: @codex
- Epic: Metrics & observability
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: src/commands/claim.js, src/lib/lockManager.js, src/commands/dashboard.js, nexus-dashboard/index.html, _NEXUS_CONSTITUTION.md
- SHA: unknown
- Commit: backfill: model-capture
- Source: backfill

## presence-checkout-wire

- Id: presence-checkout-wire
- Title: Wire nexus checkout to agent session end
- Agent: @claude
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: .claude/CLAUDE.md, .codex/AGENTS.md, .gemini/GEMINI.md, .agy/AGENTS.md, src/commands/doctor.js
- SHA: unknown
- Commit: backfill: presence-checkout-wire
- Source: backfill

## presence-gitignore

- Id: presence-gitignore
- Title: Add .nexus/presence/ to .gitignore
- Agent: @claude
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: .gitignore, src/commands/doctor.js
- SHA: unknown
- Commit: backfill: presence-gitignore
- Source: backfill

## agent-identity

- Id: agent-identity
- Title: Add agent identity verification via CLAUDECODE env var
- Agent: @claude
- Epic: Security & trust
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: src/commands/claim.js, src/lib/lockManager.js, src/commands/dashboard.js, nexus-dashboard/index.html
- SHA: unknown
- Commit: backfill: agent-identity
- Source: backfill

## prompt-chmod

- Id: prompt-chmod
- Title: Design and implement promptCHMOD — file permission model for agents
- Agent: @claude
- Epic: Security & trust
- Cost: medium
- Completed At: 2026-05-31T17:01:41.692Z
- Files: src/commands/chmod.js, src/lib/permissions.js, bin/nexus.js, _NEXUS_CHMOD.md, _NEXUS_CONSTITUTION.md
- SHA: unknown
- Commit: backfill: prompt-chmod
- Source: backfill

## nexus-db-protect

- Id: nexus-db-protect
- Title: Add nexus db protect — backup before migration
- Agent: @claude
- Epic: Recoverability
- Cost: medium
- Completed At: 2026-05-31T17:01:41.692Z
- Files: src/commands/db.js, bin/nexus.js, settings.json (PreToolUse hook)
- SHA: unknown
- Commit: backfill: nexus-db-protect
- Source: backfill

## lockmanager-tests

- Id: lockmanager-tests
- Title: Add lock manager tests
- Agent: @codex
- Epic: Open-source CLI release
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: test/lockManager.test.js, src/lib/lockManager.js
- SHA: unknown
- Commit: backfill: lockmanager-tests
- Source: backfill

## release-hygiene

- Id: release-hygiene
- Title: Prepare Nexus CLI for open-source release
- Agent: @codex
- Epic: Open-source CLI release
- Cost: medium
- Completed At: 2026-05-31T17:01:41.692Z
- Files: README.md, package.json, .gitignore, src/commands/doctor.test.js
- SHA: unknown
- Commit: backfill: release-hygiene
- Source: backfill

## dashboard-layout-overhaul

- Id: dashboard-layout-overhaul
- Title: Dashboard layout overhaul — Active block, Progress ring, Health alert
- Agent: @claude
- Epic: Dashboard observability
- Cost: medium
- Completed At: 2026-05-31T17:01:41.692Z
- Files: nexus-dashboard/index.html, src/commands/dashboard.js
- SHA: unknown
- Commit: backfill: dashboard-layout-overhaul
- Source: backfill

## dashboard-chart-epic

- Id: dashboard-chart-epic
- Title: Dashboard chart row — By Epic
- Agent: @claude
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: nexus-dashboard/index.html
- SHA: unknown
- Commit: backfill: dashboard-chart-epic
- Source: backfill

## dashboard-chart-cost

- Id: dashboard-chart-cost
- Title: Dashboard chart row — Cost Split
- Agent: @claude
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: nexus-dashboard/index.html
- SHA: unknown
- Commit: backfill: dashboard-chart-cost
- Source: backfill

## dashboard-chart-agent

- Id: dashboard-chart-agent
- Title: Dashboard chart row — By Agent pie
- Agent: @claude
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-05-31T17:01:41.692Z
- Files: nexus-dashboard/index.html
- SHA: unknown
- Commit: backfill: dashboard-chart-agent
- Source: backfill

