# Nexus Queue

## Runways

- @Codex: Release hygiene -> open-source CLI prep

## Ready Queue

- [ ] TASK/@gemini: Add agent presence check-in/check-out system
  - Id: agent-presence
  - Epic: Dashboard observability
  - Status: Ready
  - Depends on: none
  - Files: src/commands/checkin.js, src/commands/checkout.js, src/lib/lockManager.js, src/commands/dashboard.js, nexus-dashboard/index.html, bin/nexus.js
  - Affinity: cli, dashboard, protocol
  - Cost: medium
  - Auto-flow: no
  - Notes: Add `nexus checkin @agent` and `nexus checkout @agent` commands. Write a heartbeat timestamp to `.nexus/presence/@agent`. Dashboard reads freshness (online = updated within 60s, idle = 60-300s, offline = >300s or missing). Show green/yellow/gray dot on agent tabs in queue block. Checkin should be called by `nexus start`, checkout by agent on session end. Add `nexus checkout --all` for emergency cleanup.

- [ ] TASK/Codex: Add same-branch HEAD drift warning before release
  - Id: release-head-drift
  - Epic: Same-branch recoverability
  - Status: Ready
  - Depends on: commit-attribution
  - Files: src/commands/claim.js, src/commands/release.js, src/lib/lockManager.js, test/release.test.js, test/lockManager.test.js
  - Affinity: cli, safety, recoverability
  - Cost: small
  - Auto-flow: yes
  - Notes: Store claim-time HEAD SHA in lock metadata. On `nexus release`, compare current HEAD to claim HEAD. If HEAD changed, do not block; warn clearly before committing so same-branch interleaving is visible. Recoverability principle: every release should explain whether it was based on the same branch tip it claimed from.

- [ ] TASK/Codex: Add report self-noise handling for _NEXUS_REPORT.md releases
  - Id: report-self-noise
  - Epic: Same-branch recoverability
  - Status: Ready
  - Depends on: report-unification
  - Files: src/commands/release.js, test/release.test.js, _NEXUS_CONSTITUTION.md
  - Affinity: cli, reporting, recoverability
  - Cost: small
  - Auto-flow: yes
  - Notes: Releasing `_NEXUS_REPORT.md` appends a new receipt after the report commit, leaving the file dirty forever. Add an explicit self-noise rule: either skip appending when target is `_NEXUS_REPORT.md`, or append before commit for that target only. Pick the simplest behavior and document it. Recoverability principle: the audit log should not create endless audit-log noise.

- [ ] TASK/Codex: Add hot-file contention warnings to next/status
  - Id: hot-file-contention
  - Epic: Same-branch recoverability
  - Status: Ready
  - Depends on: none
  - Files: src/commands/next.js, src/commands/status.js, test/next.test.js, test/status.test.js
  - Affinity: cli, protocol, coordination
  - Cost: medium
  - Auto-flow: yes
  - Notes: Surface known high-contention paths such as `nexus-dashboard/index.html`, `src/commands/dashboard.js`, `_NEXUS_QUEUE.md`, and `_NEXUS_REPORT.md`. `nexus next` should warn when a suggested task touches hot files; `nexus status` should show hot active locks. Recoverability principle: warn before agents stack work on the same fragile surfaces.

- [ ] TASK/Codex: Add semantic dependency hints for queue tasks
  - Id: semantic-dependency-hints
  - Epic: Same-branch recoverability
  - Status: Ready
  - Depends on: none
  - Files: _NEXUS_QUEUE.md, src/commands/next.js, test/next.test.js
  - Affinity: cli, queue, coordination
  - Cost: medium
  - Auto-flow: no
  - Notes: Extend queue parsing to recognize lightweight `Coordinates with:` or `Soft depends on:` lines. These do not block like `Depends on`, but `nexus next` should display them so an agent knows when Claude/Codex/Gemini work may be semantically adjacent. Recoverability principle: make hidden coordination assumptions visible before edits begin.

- [ ] TASK/Codex: Add release recovery command
  - Id: release-recovery
  - Epic: Same-branch recoverability
  - Status: Ready
  - Depends on: report-unification
  - Files: src/commands/recover.js, bin/nexus.js, test/recover.test.js
  - Affinity: cli, recoverability, git
  - Cost: medium
  - Auto-flow: no
  - Notes: Add `nexus recover <sha|target>` as a read-only helper that prints the release receipt, git show summary, files changed, and suggested rollback/reapply commands without executing destructive actions. This is the core advantage of 3 SOTA on one branch: when things go wrong, recovery should be fast, local, and evidence-backed.

- [ ] TASK/Codex: Add stale-lock recovery safety metadata
  - Id: stale-lock-recovery-safety
  - Epic: Same-branch recoverability
  - Status: Ready
  - Depends on: release-head-drift, agent-presence
  - Files: src/lib/lockManager.js, src/commands/status.js, src/commands/doctor.js, test/lockManager.test.js, test/status.test.js, test/doctor.test.js
  - Affinity: cli, locks, recoverability
  - Cost: medium
  - Auto-flow: no
  - Notes: When a lock appears stale, show enough context to decide safely: agent, age, claim-time HEAD, current HEAD, model/thinking if present, and last heartbeat if presence exists. Do not auto-encourage cleanup when the agent may simply be timed out or reset. Recoverability principle: stale-lock cleanup must be an informed recovery action, not a reflex.

- [ ] TASK/Codex: Add generated artifact ownership checks
  - Id: generated-artifact-ownership
  - Epic: Same-branch recoverability
  - Status: Ready
  - Depends on: none
  - Files: src/commands/doctor.js, src/commands/status.js, test/doctor.test.js, test/status.test.js
  - Affinity: cli, artifacts, recoverability
  - Cost: medium
  - Auto-flow: no
  - Notes: Surface untracked generated-looking paths such as dashboard copies, screenshots, reports, ledgers, docs exports, build outputs, and temp artifacts. Do not delete them; label them as "needs owner/keep/delete decision" and suggest claiming or ignoring intentionally. Recoverability principle: generated artifacts should not become invisible clutter or accidental release payload.

- [ ] TASK/Codex: Add verification freshness warning
  - Id: verification-freshness
  - Epic: Same-branch recoverability
  - Status: Ready
  - Depends on: release-head-drift
  - Files: src/commands/release.js, src/lib/lockManager.js, test/release.test.js, test/lockManager.test.js
  - Affinity: cli, testing, recoverability
  - Cost: medium
  - Auto-flow: no
  - Notes: Record claim-time HEAD and optionally last verification command/time in lock metadata. On release, warn when HEAD moved after verification or when no verification note is present for a task that touched hot files. Do not block release. Recoverability principle: agents should know whether their tests/dev-server checks were against the state being committed.

- [ ] TASK/Codex: Add clean-stale guardrails
  - Id: clean-stale-guardrails
  - Epic: Same-branch recoverability
  - Status: Ready
  - Depends on: stale-lock-recovery-safety
  - Files: src/commands/clean.js, src/lib/lockManager.js, test/clean.test.js
  - Affinity: cli, locks, safety
  - Cost: medium
  - Auto-flow: no
  - Notes: Make `nexus clean --stale` safer for timed-out agents. Prefer listing stale locks with recovery context first; require explicit target or `--force` for bulk cleanup; never remove locks silently. Recoverability principle: cleanup should preserve human control when agents may resume after a reset.

- [ ] TASK/Codex: Add identity cleanup for legacy Agent/unknown metrics
  - Id: metrics-identity-cleanup
  - Epic: Metrics & observability
  - Status: Ready
  - Depends on: nexus-metrics
  - Files: src/commands/metrics.js, test/metrics.test.js
  - Affinity: cli, metrics, reporting
  - Cost: small
  - Auto-flow: yes
  - Notes: Metrics currently shows `Agent` and `unknown` for older commits/report entries. Add clearer buckets and explanation: `legacy-agent`, `unknown-agent`, and current explicit handles. Do not rewrite git history. Recoverability principle: metrics can be imperfect, but uncertainty must be labeled honestly.

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

- [x] TASK/Codex: Add agent attribution to release commits
  - Id: commit-attribution
  - Epic: Metrics & observability
  - Status: Done
  - Depends on: none
  - Files: src/lib/git.js, src/commands/release.js, src/commands/claim.js
  - Affinity: cli, metrics, protocol
  - Cost: small
  - Auto-flow: yes
  - Notes: Change commit format from `[Agent] message` to `[@agent] message` so every release is attributable. `release.js` reads the agent from the lock file (already stored as `agent` metadata) and passes it to `stageAndCommit`. Update `stageAndCommit` signature to accept optional agent param. This unlocks per-agent git metrics from day forward.

- [x] TASK/Codex: Unify _NEXUS_REPORT.md into single structured format
  - Id: report-unification
  - Epic: Metrics & observability
  - Status: Done
  - Depends on: commit-attribution
  - Files: src/commands/release.js, _NEXUS_REPORT.md
  - Affinity: cli, metrics, reporting
  - Cost: small
  - Auto-flow: yes
  - Notes: _NEXUS_REPORT.md currently has two formats — compact auto-log lines at top (legacy) and structured Done claim blocks below (current). Unify into one format per entry that includes: timestamp, agent, target, commit message. Remove the empty Done claim / Adversarial result template boilerplate since agents rarely fill it in. Result should be a clean append-only log that `nexus metrics` can parse reliably.

- [x] TASK/Codex: Build nexus metrics command
  - Id: nexus-metrics
  - Epic: Metrics & observability
  - Status: Done
  - Depends on: commit-attribution, report-unification
  - Files: src/commands/metrics.js, bin/nexus.js
  - Affinity: cli, metrics, reporting
  - Cost: medium
  - Auto-flow: no
  - Notes: Parse git log for `[@agent]` commits and _NEXUS_REPORT.md for release data. Surface: commits per agent, files most frequently released, release velocity by week, cost distribution from queue. Output as formatted table to terminal. Optional `--json` flag for dashboard consumption. Future: surface in dashboard as a Metrics panel.

- [x] TASK/Codex: Add model + thinking level capture to claim metadata
  - Id: model-capture
  - Epic: Metrics & observability
  - Status: Done
  - Depends on: none
  - Files: src/commands/claim.js, src/lib/lockManager.js, src/commands/dashboard.js, nexus-dashboard/index.html, _NEXUS_CONSTITUTION.md
  - Affinity: cli, metrics, protocol
  - Cost: small
  - Auto-flow: yes
  - Notes: Add `--model <name>` and `--thinking <low|medium|high>` flags to `nexus claim`. Write both to lock dir as `model` and `thinking` files. Read back in listLocks, pass through snapshot. Dashboard shows in accordion header (e.g. "sonnet-4-6 · medium"). IMPORTANT: --model is an operator declaration, not agent self-report. Local/Ollama models running inside Claude Code or Codex CLI have no intrinsic self-knowledge — a llama3.3 given a "you are Claude" system prompt will report itself as Claude. Only the human operator knows the real model. Add `nexus doctor` warning when recent claims have no --model set. Update _NEXUS_CONSTITUTION.md to document this. Feeds nexus-metrics for cost profiling per model.

- [ ] TASK/@claude: Research local model tooling compatibility with Nexus
  - Id: local-model-tooling
  - Epic: Local model support
  - Status: Ready
  - Depends on: none
  - Files: docs/local-model-compat.md
  - Affinity: research, local-models, tooling
  - Cost: medium
  - Auto-flow: no
  - Notes: The blocker for local models (Ollama, llama.cpp, lm-studio) in agent CLIs is not capability — it's tool/function call support. Known failure modes: inconsistent tool call JSON schema, no MCP protocol support, broken structured output, tool result format mismatches that crash the agent loop. Research and document: (1) which local models currently support tool calling reliably enough for Nexus commands (claim/release are just shell — the issue is the agent loop in Claude Code / Codex CLI itself), (2) what the actual failure surface looks like, (3) whether a Nexus-specific compatibility shim or reduced-tool mode could help. Output: compatibility matrix + recommended local models for swarm use. This is an open problem — document what we know, what we don't, and where the gap is.

- [ ] TASK/@claude: Add agent identity verification via CLAUDECODE env var
  - Id: agent-identity
  - Epic: Security & trust
  - Status: Ready
  - Depends on: none
  - Files: src/commands/claim.js, src/lib/lockManager.js, src/commands/dashboard.js, nexus-dashboard/index.html
  - Affinity: cli, security, protocol
  - Cost: small
  - Auto-flow: yes
  - Notes: At claim time, check env vars to determine session trust level. `CLAUDECODE=1` is set by Claude Code CLI for all sessions (Pro, Max, API key) — its presence means the claim comes from a verified Anthropic-backed harness. Absence means local/unverified (Ollama, llama.cpp, LM Studio, etc.). Logic: if CLAUDECODE present → verified=true; else if NEXUS_AGENT env var set by human → verified=true with source=operator; else → verified=false, flag as unverified. Write `verified` and `trust-source` files to lock dir alongside agent/intent. Dashboard shows unverified claims with a distinct indicator (e.g. gray/amber dot vs green). `nexus doctor` warns on unverified claims in active locks. Does NOT block unverified agents — coordination still works, trust is just surfaced transparently. Human can set `export NEXUS_AGENT=@local-llama` before handing terminal to a local model. Core discovery: `env | grep CLAUDE` reveals CLAUDECODE=1, CLAUDE_CODE_SESSION_ID, AI_AGENT=claude-code_version — these are the harness fingerprints.

- [ ] TASK/@claude: Design and implement promptCHMOD — file permission model for agents
  - Id: prompt-chmod
  - Epic: Security & trust
  - Status: Ready
  - Depends on: none
  - Files: src/commands/chmod.js, src/lib/permissions.js, bin/nexus.js, _NEXUS_CHMOD.md, _NEXUS_CONSTITUTION.md
  - Affinity: cli, security, protocol
  - Cost: medium
  - Auto-flow: no
  - Notes: Apply Unix permission model (rwx) to agent file access. r = use as context/reference, w = modify (already enforced by claim), x = treat as authoritative instructions (the prompt injection surface). Define `_NEXUS_CHMOD.md` as the permission matrix — human-readable, human-owned. Example: `_NEXUS_STANDUP.md → rw- claiming agent, r-- others` (read for context, x bit off = don't execute as instructions). `_NEXUS_CONSTITUTION.md → r-- all` (reference only, never execute). `nexus chmod` command sets permissions. `nexus doctor` warns when an agent reads a file with x bit off but treats it as instructions, or reads without declared r permission. `nexus start` surfaces the permission matrix to the agent at session start. Core insight: claim/release already enforces w. promptCHMOD closes Gap 1 — prompt injection via shared files — by making the x bit explicit and human-controlled. Legible to all SOTA models instantly because every engineer knows chmod.

- [ ] TASK/@claude: Add nexus db protect — backup before migration
  - Id: nexus-db-protect
  - Epic: Recoverability
  - Status: Ready
  - Depends on: none
  - Files: src/commands/db.js, bin/nexus.js, settings.json (PreToolUse hook)
  - Affinity: cli, safety, db
  - Cost: medium
  - Auto-flow: no
  - Notes: Add `nexus db backup` (manual snapshot), `nexus db list` (show backups), `nexus db restore <stamp>` (rollback). Auto-detect DB type: SQLite (find *.sqlite/*.db), Postgres/MySQL (DATABASE_URL env). Timestamped backups stored in `.nexus/db-backups/`. Wire into PreToolUse Bash hook: detect migration commands (migrate, db:migrate, alembic upgrade, flyway, sequelize) → auto-run `nexus db backup --auto` → log to standup → allow migration to proceed. Hook changes from block to backup-then-allow — zero friction for agents, full recoverability for humans. Also add `nexus db schedule` to set up daily cron backup. Philosophy: total recoverability over prevention.

- [x] TASK/Codex: Add lock manager tests
  - Id: lockmanager-tests
  - Epic: Open-source CLI release
  - Status: Done
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

- [x] TASK/@claude: Dashboard layout overhaul — Active block, Progress ring, Health alert
  - Id: dashboard-layout-overhaul
  - Epic: Dashboard observability
  - Status: Done
  - Depends on: none
  - Files: nexus-dashboard/index.html, src/commands/dashboard.js
  - Affinity: dashboard, ux
  - Cost: medium
  - Auto-flow: no
  - Notes: Replaced equal NOW/HEALTH two-column layout. NOW renamed Active (span 9) + Progress ring (span 3) in first row. Health section demoted to floating red alert card that only appears when nexus doctor finds issues — hidden when clean. Progress ring shows done/total queue tasks as SVG donut with smooth transition.

- [x] TASK/@claude: Dashboard chart row — By Epic
  - Id: dashboard-chart-epic
  - Epic: Dashboard observability
  - Status: Done
  - Depends on: dashboard-layout-overhaul
  - Files: nexus-dashboard/index.html
  - Affinity: dashboard, ux, charts
  - Cost: small
  - Auto-flow: no
  - Notes: Horizontal bar chart per epic showing done/total. Reads from queue snapshot — live, not accumulated. Each bar fills proportionally to completion %. Data source is _NEXUS_QUEUE.md via /api/snapshot; will improve once nexus-ledger ships.

- [x] TASK/@claude: Dashboard chart row — Cost Split
  - Id: dashboard-chart-cost
  - Epic: Dashboard observability
  - Status: Done
  - Depends on: dashboard-layout-overhaul
  - Files: nexus-dashboard/index.html
  - Affinity: dashboard, ux, charts
  - Cost: small
  - Auto-flow: no
  - Notes: Vertical column chart for small/medium/large task cost distribution. Uses flex-ratio trick (spacer + bar as flex children) so bars grow with card height automatically. Count label sits just above each bar. chart-sm sections are display:flex flex-direction:column to cascade height from grid row down to bars.

- [x] TASK/@claude: Dashboard chart row — By Agent pie
  - Id: dashboard-chart-agent
  - Epic: Dashboard observability
  - Status: Done
  - Depends on: dashboard-layout-overhaul
  - Files: nexus-dashboard/index.html
  - Affinity: dashboard, ux, charts
  - Cost: small
  - Auto-flow: no
  - Notes: SVG pie chart (not donut) showing task distribution by agent. Width: 60% of card with aspect-ratio:1. Colors synced from remotion-labs/src/tokens.ts AGENTS object (codex #2dd4bf, claude #F4845F, gemini #0EA5E9). Caption row "N tasks across N agents" pinned below pie+legend as separate block with top border.
