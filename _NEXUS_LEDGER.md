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

## dashboard-docs-release-cleanup

- Id: dashboard-docs-release-cleanup
- Title: Release dashboard docs and reset recovery cleanup
- Agent: @codex
- Epic: Open-source CLI release
- Cost: medium
- Completed At: 2026-05-31T23:41:49.603Z
- Files: README.md, _NEXUS.md, _NEXUS_QUEUE.md, _NEXUS_REPORT.md, _NEXUS_LEDGER.md, bin/nexus.js, nexus-dashboard/docs/index.html, nexus-dashboard/index.html, nexus-dashboard/style.css, src/commands/claim.js, src/commands/dashboard.js, src/commands/init.js, test/claim.test.js
- SHA: 89698d027607022a42215f88f05d5d93dd6b153b
- Commit: dashboard-docs-release-cleanup: document claim flags
- Source: release

## memory-month-folder-boundary

- Id: memory-month-folder-boundary
- Title: Clarify memory month folder ownership
- Agent: @codex
- Epic: Release hygiene
- Cost: small
- Completed At: 2026-06-01T00:00:26.967Z
- Files: src/commands/init.js, src/commands/doctor.js, test/init.test.js, test/doctor.test.js, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: d0411b5c3eb9b84ce3d29f7ea6d9ab4485c1449e
- Commit: memory-month-folder-boundary: clarify init memory ownership
- Source: release

## standup-dated-format

- Id: standup-dated-format
- Title: Add dated standup entry format
- Agent: @codex
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-06-01T00:38:41.429Z
- Files: src/commands/init.js, src/commands/dashboard.js, test/dashboard.test.js, _NEXUS_STANDUP.md, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: a31cef550c1f4b70f561824781d9ec821c08a4ee
- Commit: standup-dated-format: parse dated standup entries
- Source: release

## npm-publish-metadata-cleanup

- Id: npm-publish-metadata-cleanup
- Title: Clean npm publish metadata warnings
- Agent: @codex
- Epic: Open-source CLI release
- Cost: small
- Completed At: 2026-06-01T01:16:16.959Z
- Files: package.json, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: e2ad203425942c48437617e960915b52be145c31
- Commit: npm-publish-metadata-cleanup: normalize package metadata
- Source: release

## readme-public-release-pass

- Id: readme-public-release-pass
- Title: Tighten README for first public release
- Agent: @codex
- Epic: Open-source CLI release
- Cost: small
- Completed At: 2026-06-01T05:54:23.027Z
- Files: README.md, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: ffc7e2cb5871948917db6f4bd91d049cd0143f87
- Commit: readme-public-release-pass: clarify public positioning
- Source: release

## standup-ampm-timestamps

- Id: standup-ampm-timestamps
- Title: Add AM/PM to standup timestamps
- Agent: @codex
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-06-01T06:58:50.958Z
- Files: _NEXUS_STANDUP.md, src/commands/init.js, src/commands/dashboard.js, test/dashboard.test.js, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: 178a0cdf604eec6b886c2afb2aae9720ae18e345
- Commit: standup-ampm-timestamps: update standup format
- Source: release

## dashboard-latest-first-feeds

- Id: dashboard-latest-first-feeds
- Title: Show latest dashboard feed items first
- Agent: @codex
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-06-01T06:58:51.066Z
- Files: src/commands/dashboard.js, test/dashboard.test.js, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: 32ab8d1dae2bbb3d5172cab694149c039b258b5d
- Commit: dashboard-latest-first-feeds: show newest dashboard feeds first
- Source: release

## readme-plain-language-opening

- Id: readme-plain-language-opening
- Title: Rewrite README opening in plain language
- Agent: @codex
- Epic: Open-source CLI release
- Cost: small
- Completed At: 2026-06-01T06:58:52.008Z
- Files: README.md, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: 87ee9ff25fbf75edc4dd86fef8e0160e8d3fe14f
- Commit: readme-plain-language-opening: rewrite README opening
- Source: release

## report-dated-ampm-receipts

- Id: report-dated-ampm-receipts
- Title: Add date and AM/PM to report receipts
- Agent: @codex
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-06-01T06:59:07.655Z
- Files: src/commands/release.js, test/release.test.js, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: 293131fe3d05aa3b6bd25a8bddcac59391a9e265
- Commit: report-dated-ampm-receipts: format report receipt timestamps
- Source: release

## standup-feed-labels

- Id: standup-feed-labels
- Title: Add labels to standup dashboard rows
- Agent: @codex
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-06-01T07:15:40.558Z
- Files: nexus-dashboard/index.html, nexus-dashboard/style.css, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: 9ec0a520579db946b176ede78ddc4f04d3efb893
- Commit: standup-feed-labels: queue dashboard label metric
- Source: release

## standup-clean-dated-layout

- Id: standup-clean-dated-layout
- Title: Clean Standup dashboard row order
- Agent: @codex
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-06-01T07:25:43.061Z
- Files: src/commands/dashboard.js, test/dashboard.test.js, nexus-dashboard/index.html, nexus-dashboard/style.css, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: 3ef8b799eca07468d8f29376aa9f3d8981ef4b1d
- Commit: standup-clean-dated-layout: test dated standup feed
- Source: release

## standup-unlabeled-standard-layout

- Id: standup-unlabeled-standard-layout
- Title: Remove Standup dashboard labels
- Agent: @codex
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-06-01T07:29:45.347Z
- Files: nexus-dashboard/index.html, nexus-dashboard/style.css, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: 8f2dc7989429e2fb67ed0ad2863af39f9da9d61b
- Commit: standup-unlabeled-standard-layout: queue dashboard metric
- Source: release

## standup-missing-date-warning

- Id: standup-missing-date-warning
- Title: Warn on undated Standup messages
- Agent: @codex
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-06-01T07:35:21.673Z
- Files: src/commands/dashboard.js, test/dashboard.test.js, nexus-dashboard/index.html, nexus-dashboard/style.css, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: ada1e4cf1768d67c05b4e07d5d95a6f3ac5a2334
- Commit: standup-missing-date-warning: warn on legacy standup lines
- Source: release

## drill-agent-playbook-copy

- Id: drill-agent-playbook-copy
- Title: Reframe drills as agent playbooks
- Agent: @codex
- Epic: Open-source CLI release
- Cost: small
- Completed At: 2026-06-01T08:20:13.957Z
- Files: README.md, drills/nexus-agent-protocol/README.md, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: e689d45837e05edd325b97e6f5643a57b5e6f985
- Commit: drill-agent-playbook-copy: clarify drills as recovery playbooks
- Source: release

## standup-doctor-format-fix

- Id: standup-doctor-format-fix
- Title: Carry Standup date guidance through doctor
- Agent: @codex
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-06-01T08:24:06.262Z
- Files: src/commands/doctor.js, test/doctor.test.js, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: 73f4e5c6aa3624a332cc792e08b723f4f3256853
- Commit: standup-doctor-format-fix: repair dated standup guidance
- Source: release

## dashboard-report-latest-first

- Id: dashboard-report-latest-first
- Title: Show Nexus Report dashboard entries latest first
- Agent: @codex
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-06-01T11:39:56.863Z
- Files: src/commands/dashboard.js, test/dashboard.test.js, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: 0414e684b51fdbe5bb31c51de8fb187ba2da3222
- Commit: dashboard-report-latest-first: sort report blocks
- Source: release

## dashboard-docs-sticky-toc

- Id: dashboard-docs-sticky-toc
- Title: Make CLI Docs TOC sticky
- Agent: @codex
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-06-01T11:43:50.190Z
- Files: nexus-dashboard/style.css, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: 5f93087398bbb7000f5970b03f6548a3f100e052
- Commit: dashboard-docs-sticky-toc: pin docs toc
- Source: release

## standup-agent-icon-label

- Id: standup-agent-icon-label
- Title: Replace Standup @agent labels with agent icon
- Agent: @codex
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-06-01T12:03:15.622Z
- Files: nexus-dashboard/index.html, nexus-dashboard/style.css, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: 72bfb631e34396865afe667dab738ce80453f315
- Commit: standup-agent-icon-label: render bot icon
- Source: release

## queue-presence-dot-active-locks

- Id: queue-presence-dot-active-locks
- Title: Make queue presence dots follow active locks
- Agent: @codex
- Epic: Dashboard observability
- Cost: small
- Completed At: 2026-06-01T12:15:44.130Z
- Files: nexus-dashboard/index.html, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: 71ebf9d4ff7e371ed4748b47c8a18363ca539fc9
- Commit: queue-presence-dot-active-locks: use active locks
- Source: release

## next-related-drills

- Id: next-related-drills
- Title: Surface related drills in nexus next
- Agent: @codex
- Epic: Agent guardrails
- Cost: small
- Completed At: 2026-06-01T13:09:41.280Z
- Files: src/commands/next.js, test/next.test.js, README.md, drills/nexus-agent-protocol/README.md, _NEXUS_QUEUE.md, _NEXUS_LEDGER.md
- SHA: 9b41f15c3f0ad8c0a127df12f5f9c6f74dd54c95
- Commit: next-related-drills: surface related drill ids
- Source: release
