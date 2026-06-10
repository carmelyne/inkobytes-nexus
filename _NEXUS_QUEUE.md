# Nexus Queue

Completed tasks are archived monthly in `.nexus/archive/queue/` (see INDEX.md
there). Structured completion data lives in `_NEXUS_LEDGER.md`. New tasks
carry `Created:`; flip `Done:` and archive when the checkbox closes.

## Runways

- @Codex: Release hygiene -> open-source CLI prep

## Ready Queue

- [x] TASK/Claude: Build NexusShort — pure motion graphics short-form video
  - Id: nexus-short-video
  - Epic: Content & documentation
  - Status: Done
  - Done: 2026-06-10
  - Depends on: none
  - Files: remotion-labs/src/scenes/NsScene1.tsx, remotion-labs/src/scenes/NsSceneBridge.tsx, remotion-labs/src/scenes/NsScene2.tsx, remotion-labs/src/scenes/NsScene3.tsx, remotion-labs/src/scenes/NsScene4.tsx, remotion-labs/src/scenes/NsScene5.tsx, remotion-labs/src/NsComposition.tsx, remotion-labs/docs/short-form-motion-graphics.md
  - Affinity: remotion, video, motion-graphics, content
  - Cost: large
  - Auto-flow: no
  - Notes: 90s pure kinetic typography short-form video for Nexus. No agent panels, no terminals — motion graphics only. 11 scenes covering: the problem (chaos, merge conflicts), the fix (@inkobytes/nexus), 18 commands, no conflicts, memory/continuity, security, drills, dashboard, scale, solo use, close. Screenshots and short clips allowed as inserts. All scenes built: 1–10 plus 5b, 6b, bridge, and credits (completed 2026-06-01, confirmed against remotion-labs/src/scenes/ on 2026-06-10 — the earlier "scenes remain" reopen note was wrong). Render/export for release still pending; track separately if it becomes a task.

- [ ] TASK/Codex: Clean duplicated Inkobytes AGENTS instructions
  - Id: inkobytes-agents-dedup
  - Epic: Agent guardrails
  - Status: Ready
  - Depends on: hooks-install-command
  - Files: /Users/carmelyne/dev/inkobytes/.codex/AGENTS.md, /Users/carmelyne/dev/inkobytes/.claude/CLAUDE.md, /Users/carmelyne/dev/inkobytes/.gemini/GEMINI.md, /Users/carmelyne/dev/inkobytes/_NEXUS_QUEUE.md
  - Affinity: protocol, docs, cleanup
  - Cost: medium
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: After hook installation is documented/implemented, clean duplicated generated and hand-written Nexus protocol text in the Inkobytes agent instruction files. Preserve project-specific rules, keep agent-local continuity/memory guidance correct, and avoid broad doctor rewrites unless explicitly approved.

- [ ] TASK/Codex: Create Nexus dynamic/governed loops graphic
  - Id: nexus-dynamic-governed-loops-graphic
  - Epic: Content & documentation
  - Status: Ready
  - Depends on: hooks-install-command
  - Files: docs/nexus-dynamic-governed-loops.md, README.md, nexus-dashboard/docs/index.html, nexus-dashboard/style.css
  - Affinity: docs, visual-explainer, onboarding
  - Cost: medium
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: Use `docs/nexus-dynamic-governed-loops.md` as the source brief to create a clear graphic explaining the dynamic discovery loop, approval gate, and governed execution loop. Anchor the graphic around: "Dynamic before approval. Deterministic after approval." Decide whether the first deliverable is Mermaid, README art, dashboard explainer, or a Figma/FigJam handoff.

### Audit batch 2026-06-10 (source: docs-priv/audit-2026-06-10-claude.md)

- [x] TASK/Claude: Fix db restore path bug and add db command tests
  - Id: db-restore-path-fix
  - Epic: Security & trust
  - Status: Done
  - Created: 2026-06-10
  - Done: 2026-06-10
  - Depends on: none
  - Files: src/commands/db.js, test/db.test.js
  - Affinity: cli, db, recoverability, testing
  - Cost: medium
  - Auto-flow: yes
  - Review: approved
  - Approved by: human (2026-06-10, reassigned Codex->Claude, Codex rate-limited)
  - Notes: Manifest stores only the sqlite basename, but detectDatabases finds files at any depth, so restore writes to repo root instead of the original nested path. Store the full repo-relative path in the manifest, restore to it, and add tests covering nested sqlite backup/restore round trips, missing manifest, and incomplete-backup skip. Recoverability principle: restore must put data back exactly where it came from or fail loudly.

- [x] TASK/Claude: Remove shell interpolation from db mysql backup and restore
  - Id: db-shell-injection-fix
  - Epic: Security & trust
  - Status: Done
  - Created: 2026-06-10
  - Done: 2026-06-10
  - Depends on: db-restore-path-fix
  - Files: src/commands/db.js, test/db.test.js
  - Affinity: cli, security, db
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human (2026-06-10, reassigned Codex->Claude, Codex rate-limited)
  - Notes: backupMysql and the mysql restore path pass DATABASE_URL through `sh -c` string interpolation, which allows command injection via a crafted .env. Replace with direct spawnSync argument arrays and stream redirection handled in Node. Add a test asserting hostile URL strings are passed as literal arguments, never executed.

- [x] TASK/Claude: Default dashboard to localhost bind with explicit --lan flag
  - Id: dashboard-localhost-default
  - Epic: Security & trust
  - Status: Done
  - Created: 2026-06-10
  - Done: 2026-06-10
  - Depends on: none
  - Files: src/commands/dashboard.js, test/dashboard.test.js, README.md
  - Affinity: dashboard, security, network
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human (2026-06-10, reassigned Codex->Claude, Codex rate-limited)
  - Notes: The dashboard currently listens on 0.0.0.0 with no auth, exposing repo coordination state to the local network by default. Bind 127.0.0.1 by default; add `--lan` to opt into all-interface binding and only print LAN URLs when --lan is set. Document the tradeoff in README. Principle: network exposure is opt-in, never a default.

- [x] TASK/Claude: Correct promptCHMOD enforcement claims in CLI output
  - Id: chmod-advisory-wording
  - Epic: Security & trust
  - Status: Done
  - Created: 2026-06-10
  - Done: 2026-06-10
  - Depends on: none
  - Files: src/commands/chmod.js, _NEXUS_CHMOD.md, README.md, test/chmod.test.js
  - Affinity: cli, security, docs
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human (2026-06-10, reassigned Codex->Claude, Codex rate-limited)
  - Notes: chmod.js says "agents cannot self-elevate" but the gate is env vars any process can set; permissions.js correctly says advisory only. Align all chmod CLI messaging and docs to "advisory contract honored at session start, not mechanically enforced," add basic chmod parse/list/set tests, and document the x-bit threat model honestly. Credibility principle: never claim enforcement the code cannot deliver.

- [x] TASK/Claude: Single-source the CLI version and gate publish on tests
  - Id: version-single-source
  - Epic: Open-source CLI release
  - Status: Done
  - Created: 2026-06-10
  - Done: 2026-06-10
  - Depends on: none
  - Files: bin/nexus.js, package.json, test/help.test.js
  - Affinity: cli, release, npm
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human (2026-06-10, reassigned Codex->Claude, Codex rate-limited)
  - Notes: VERSION is hardcoded in bin/nexus.js separately from package.json and will drift. Read version from package.json at runtime. Add `prepublishOnly: npm test` so a failing suite blocks npm publish. Test that `nexus --version` matches package.json.

- [ ] TASK/Codex: Replace claim spin-wait with real sleep
  - Id: claim-spinwait-sleep
  - Epic: Agent guardrails
  - Status: Ready
  - Created: 2026-06-10
  - Depends on: none
  - Files: src/lib/lockManager.js, test/lockManager.test.js
  - Affinity: cli, locks, performance
  - Cost: small
  - Auto-flow: yes
  - Review: pending
  - Notes: acquireLock retry uses a busy loop that pegs a CPU core during contention, exactly when multiple agents are active. Replace with a synchronous sleep (e.g. Atomics.wait on a SharedArrayBuffer) keeping the API synchronous. Verify retry timing behavior in tests.

- [ ] TASK/Codex: Document all shipped commands in README with stable/experimental tiers
  - Id: readme-command-coverage
  - Epic: Open-source CLI release
  - Status: Ready
  - Created: 2026-06-10
  - Depends on: dashboard-localhost-default, chmod-advisory-wording
  - Files: README.md, src/commands/doctor.js, test/doctor.test.js
  - Affinity: docs, release, protocol
  - Cost: medium
  - Auto-flow: yes
  - Review: pending
  - Notes: checkin, checkout, chmod, db, and metrics exist in `nexus help` but not README. Add a Stable vs Experimental command split, document the five missing commands under the right tier, and add a doctor drift check that warns when bin/nexus.js COMMANDS and README command coverage disagree. Principle: the coordination tool must not have doc drift about itself.

- [x] TASK/Claude: Add GitHub Actions CI for tests and pack dry-run
  - Id: ci-github-actions
  - Epic: Open-source CLI release
  - Status: Done
  - Created: 2026-06-10
  - Done: 2026-06-10
  - Depends on: version-single-source
  - Files: .github/workflows/ci.yml, README.md
  - Affinity: ci, release, testing
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human (2026-06-10, reassigned Codex->Claude, Codex rate-limited)
  - Notes: No CI exists; tests only run when someone remembers. Add a workflow running `npm test` and `npm pack --dry-run` on a Node 18/20/22 matrix for pushes and PRs. Add a status badge to README.

- [ ] TASK/Codex: Split doctor.js into check modules
  - Id: doctor-split-check-modules
  - Epic: Release hygiene
  - Status: Ready
  - Created: 2026-06-10
  - Depends on: ci-github-actions
  - Files: src/commands/doctor.js, src/checks/, test/doctor.test.js
  - Affinity: cli, refactor, doctor
  - Cost: large
  - Auto-flow: no
  - Review: pending
  - Notes: doctor.js is ~45KB, far past the 800-line file guideline. Extract each check group (missing files, package privacy, git privacy, stale locks, agent scaffolds, protocol drift) into src/checks/*.js with a shared check interface; doctor.js becomes the orchestrator and reporter. Behavior-preserving refactor: existing doctor tests must pass unchanged before any wording edits.

- [ ] TASK/Codex: Log stale-lock auto-breaks to standup
  - Id: stale-break-standup-log
  - Epic: Same-branch recoverability
  - Status: Ready
  - Created: 2026-06-10
  - Depends on: stale-lock-recovery-safety
  - Files: src/lib/lockManager.js, test/lockManager.test.js
  - Affinity: cli, locks, comms
  - Cost: small
  - Auto-flow: yes
  - Review: pending
  - Notes: Auto-breaking a stale lock only console-warns the breaker; the original owner never learns its lock was stolen. Append a dated standup line naming the broken target, prior owner, age, and breaking agent so the owner discovers it on next session read.

- [ ] TASK/Codex: Doctor check for queue checkbox and Status drift
  - Id: queue-checkbox-status-drift
  - Epic: Dashboard observability
  - Status: Ready
  - Created: 2026-06-10
  - Depends on: none
  - Files: src/commands/doctor.js, test/doctor.test.js
  - Affinity: doctor, queue, protocol
  - Cost: small
  - Auto-flow: yes
  - Review: pending
  - Notes: Several queue tasks were marked [x] while Status said Ready (fixed in the 2026-06-10 archive pass). Add a doctor warning when checkbox state and the Status field disagree, listing offending task ids. Dogfood principle: the coordination ledger itself must not drift.

- [ ] TASK/Codex: Archive completed queue tasks by month and add task dates
  - Id: queue-month-archive
  - Epic: Release hygiene
  - Status: Ready
  - Created: 2026-06-10
  - Depends on: queue-checkbox-status-drift
  - Files: src/commands/ledger.js, src/commands/doctor.js, src/commands/init.js, _NEXUS_QUEUE.md, test/ledger.test.js, test/doctor.test.js, README.md
  - Affinity: cli, queue, archive, hygiene
  - Cost: medium
  - Auto-flow: yes
  - Review: pending
  - Notes: Add Created and Done date fields to the queue task template (init scaffold, skill docs). Add `nexus ledger archive` to move [x] tasks from _NEXUS_QUEUE.md into .nexus/archive/queue/YYYY-Month.md by completion month, newest-first, with an INDEX.md mirroring the agent memory index convention. Resolve Done dates from ledger or report timestamps; use `Done: unknown` when unrecoverable. Doctor warns when done tasks in the live queue exceed a threshold. Archiving must not touch Ready, In Progress, or Proposed tasks. The 2026-06-10 manual archive pass in .nexus/archive/queue/ is the reference layout. Principle: the queue is the program; history lives in ledger and archive, not in the hot file.

### Loop readiness 2026-06-10 (source: docs-priv/loop-readiness-plan-2026-06-10.md)

- [x] TASK/Claude: Add release verification gate
  - Id: release-verify-gate
  - Epic: Loop readiness
  - Status: Done
  - Created: 2026-06-10
  - Done: 2026-06-11
  - Depends on: ci-github-actions
  - Files: src/commands/release.js, src/lib/config.js, src/commands/doctor.js, test/release.test.js, test/doctor.test.js, README.md
  - Affinity: cli, release, safety, loop
  - Cost: medium
  - Auto-flow: yes
  - Review: approved
  - Approved by: human (2026-06-10, Wave 1 reassigned Codex->Claude)
  - Notes: Add release.verifyCommand to .nexus/config.json. When set, nexus release runs it before staging and refuses to commit on failure, keeping the claim, printing the failing command output summary, and appending a dated standup line. Allow --no-verify only when autonomy level is 0, and log its use to standup. Doctor warns when autonomy is 1 or higher and no verifyCommand is configured. Loop principle: agents must not compound on unverified commits.

- [x] TASK/Claude: Add nexus halt and resume circuit breaker
  - Id: nexus-halt
  - Epic: Loop readiness
  - Status: Done
  - Created: 2026-06-10
  - Done: 2026-06-10
  - Depends on: none
  - Files: bin/nexus.js, src/commands/halt.js, src/commands/claim.js, src/commands/release.js, src/commands/next.js, src/commands/dashboard.js, nexus-dashboard/index.html, test/halt.test.js, README.md
  - Affinity: cli, safety, loop, dashboard
  - Cost: medium
  - Auto-flow: yes
  - Review: approved
  - Approved by: human (2026-06-10, Wave 1 reassigned Codex->Claude)
  - Notes: nexus halt "<reason>" writes .nexus/HALT with reason, timestamp, and initiator. While present, claim, release, and next refuse with the halt reason and instruct agents to stand by and log a standup line. nexus resume removes it and is human-gated with honest advisory wording (same trust caveats as chmod, no enforcement overclaims). Dashboard shows a prominent halted banner. Agents may halt; only humans resume. Loop principle: one command stops the swarm, repo-wide, instantly.

- [x] TASK/Claude: Add autonomy level config and doctor awareness
  - Id: autonomy-level-config
  - Epic: Loop readiness
  - Status: Done
  - Done: 2026-06-11
  - Created: 2026-06-10
  - Depends on: release-verify-gate, nexus-halt
  - Files: src/lib/config.js, src/commands/doctor.js, src/commands/start.js, _NEXUS_CONSTITUTION.md, test/config.test.js, test/doctor.test.js, README.md
  - Affinity: cli, config, protocol, loop
  - Cost: medium
  - Auto-flow: yes
  - Review: approved
  - Approved by: human (2026-06-11, Wave 2 reassigned Codex->Claude)
  - Notes: Add autonomy: 0|1|2 to .nexus/config.json, default 0. nexus start reports the level to the agent. Doctor checks level prerequisites: level 1 requires verifyCommand configured; level 2 additionally requires agent budget files and warns if release-recovery is not available. Document the three levels and the human checkpoint ritual in the constitution. Changing the level is human-only by convention; state that honestly rather than claiming enforcement.

- [x] TASK/Claude: Enforce task contract for Auto-flow in next and doctor
  - Id: autoflow-task-contract
  - Epic: Loop readiness
  - Status: Done
  - Done: 2026-06-11
  - Created: 2026-06-10
  - Depends on: autonomy-level-config
  - Files: src/commands/next.js, src/commands/doctor.js, test/next.test.js, test/doctor.test.js
  - Affinity: cli, queue, guardrails, loop
  - Cost: medium
  - Auto-flow: yes
  - Review: approved
  - Approved by: human (2026-06-11, Wave 2 reassigned Codex->Claude)
  - Notes: At autonomy level 1 or higher, nexus next skips Auto-flow tasks missing required contract fields: non-empty Notes, Files, Cost, Review approved, and Approved by human; it prints which field is missing so the human can repair the task. Doctor lists Auto-flow tasks failing the contract at any level. Loop principle: in loop mode the queue is the program, so under-specified tasks are bugs and must not auto-flow.

- [ ] TASK/Claude: Introduce Task Primitive types for agent-native task definitions
  - Id: task-primitive-types
  - Epic: Loop readiness
  - Status: Ready
  - Created: 2026-06-11
  - Depends on: autoflow-task-contract
  - Files: src/lib/taskContract.js, src/commands/next.js, src/commands/doctor.js, src/commands/init.js, skills/nexus/SKILL.md, _NEXUS_QUEUE.md, README.md, test/next.test.js, test/doctor.test.js
  - Affinity: cli, queue, protocol, loop
  - Cost: medium
  - Auto-flow: yes
  - Review: approved
  - Approved by: human (2026-06-11, human-initiated)
  - Notes: Human-proposed primitive set (2026-06-11) for agent-native task definitions — Goal (why the task exists), Outcome (what must be true when complete), Scope (files/commands/surfaces included), Constraints (what the agent must not change or assume), Gates (what must be approved before proceeding), Stop If (conditions requiring human review), Evidence (tests/logs/screenshots/changelog/reports proving completion), Affinity, Cost, Dependencies. Mapping to existing template: Scope extends Files, Dependencies = Depends on, Gates extends Review/Approved by, Affinity and Cost already exist; net-new fields are Goal, Outcome, Constraints, Stop If, Evidence. Loop principle: Outcome + Evidence + Stop If define when a loop agent is finished and when it must stop — the anti-over-looping contract. Implementation: extend queue parsing to recognize the new fields, surface them in nexus next output, have doctor flag Auto-flow tasks missing them at autonomy 2 (advisory at lower levels), update the init scaffold and skill docs. Backward compatible: existing tasks stay valid; primitives tier into the Auto-flow contract gradually. Build on the shared field-contract module from autoflow-task-contract.

- [ ] TASK/@claude: Design loop progress signals for stuck-but-alive agents
  - Id: loop-progress-signals
  - Epic: Loop readiness
  - Status: Ready
  - Created: 2026-06-10
  - Depends on: nexus-halt
  - Files: docs/loop-progress-signals.md
  - Affinity: research, locks, loop
  - Cost: medium
  - Auto-flow: no
  - Review: pending
  - Notes: Stale detection assumes dead agents go quiet, but a stuck loop agent keeps its lock fresh while making no progress. Research and propose a cheap progress signal: candidates include claim metadata touch on meaningful events, releases-per-window per agent, or standup cadence analysis. Define how status and doctor would label active-but-not-progressing locks and what a human should do. Design doc only; no enforcement until the human reviews the proposal.

- [ ] TASK/Codex: Verify and document agent budget behavior for loop mode
  - Id: budget-loop-verify
  - Epic: Loop readiness
  - Status: Ready
  - Created: 2026-06-10
  - Depends on: autonomy-level-config
  - Files: src/commands/next.js, test/next.test.js, README.md, src/commands/doctor.js, test/doctor.test.js
  - Affinity: cli, queue, budgets, loop
  - Cost: small
  - Auto-flow: yes
  - Review: pending
  - Notes: nexus next already supports an optional agent budget file. Add tests pinning the current behavior, document the file format and semantics in README, and add a doctor warning at autonomy level 2 when no budget file exists for active agents. Loop principle: unattended work has explicit volume bounds.

## Proposed Queue

*(Agent-suggested tasks awaiting human review. nexus next ignores this section.)*

- [ ] TASK/Codex: Add atomic task state commands (take/done)
  - Id: task-state-commands
  - Epic: Loop readiness
  - Status: Ready
  - Created: 2026-06-10
  - Depends on: none
  - Files: src/commands/task.js, bin/nexus.js, src/commands/next.js, test/task.test.js, README.md
  - Affinity: cli, queue, loop, guardrails
  - Cost: medium
  - Auto-flow: no
  - Review: pending
  - Notes: Two gaps observed dogfooding on 2026-06-10. (1) Task assignment is not atomic: locks are file-granular, so between `nexus next` suggesting a task and the agent claiming its first file, a second loop agent can take the same task; agents also skip flipping In Progress because hand-editing the hot queue file under lock is expensive, so the queue lies about state mid-task. (2) Six manual queue claims in one session were spent purely on checkbox flips. Add `nexus task take <id> <agent>` (flips Status to In Progress, records agent + timestamp, refuses if another agent holds it) and `nexus task done <id>` (flips [x] + Status: Done + Done date in one atomic edit, appends a standup line). A one-command closeout is also far more likely to survive a rate-limit death than a claim-edit-clean sequence. Make the checkbox derived from Status on every command write so state stops being dual-encoded (root cause of nexus-short-video drift; queue-checkbox-status-drift is the detection half, this is prevention).

- [x] TASK/Claude: Decide and implement git tracking for queue and ledger
  - Id: queue-git-tracking
  - Epic: Loop readiness
  - Status: Done
  - Created: 2026-06-10
  - Done: 2026-06-11
  - Depends on: none
  - Files: .gitignore, src/commands/release.js, src/commands/doctor.js, test/release.test.js, README.md
  - Affinity: queue, git, audit, loop
  - Cost: small
  - Auto-flow: no
  - Review: approved
  - Approved by: human (2026-06-11, chose option (a) then widened: track ALL _NEXUS_* files)
  - Notes: _NEXUS_QUEUE.md and _NEXUS_LEDGER.md were gitignored, so the queue — the program a loop executes — had no commit history, no diffs, no rollback, and `nexus release` exited 1 on them, forcing receipt-less lock drops via `nexus clean`. Human decided 2026-06-11: track all _NEXUS_* coordination files (queue, ledger, constitution, blackboard, standup, report, chmod) so even doctor-managed protocol updates have visible history. State-flip commits are the audit receipts; npm publish already excludes them via the package files whitelist. No release.js or doctor.js changes needed — release works on tracked files natively. Caveat noted: _NEXUS.md blackboard is live lock state and will show as dirty between releases.

- [ ] TASK/@claude: Add reconnect resume packet derived from involuntary receipts
  - Id: agent-resume-packet
  - Epic: Loop readiness
  - Status: Ready
  - Created: 2026-06-10
  - Depends on: none
  - Files: src/commands/start.js, src/commands/claim.js, src/lib/lockManager.js, test/start.test.js, test/claim.test.js, README.md
  - Affinity: cli, locks, continuity, loop
  - Cost: medium
  - Auto-flow: no
  - Review: pending
  - Notes: Reconnect is not resume: rate-limit deaths and compaction destroy working context, and voluntary checkpoints (continuity/memory files) fail exactly when sessions die unexpectedly, before writing. Make repo state the bookmark instead. Add `--task <id>` metadata to `nexus claim` so locks carry the task they serve. Extend `nexus start --agent @handle` to print a resume packet assembled from involuntary receipts: the agent's active locks with intents, ages, and task ids; queue status of those tasks; the agent's recent standup lines; presence age. Goal: an agent reconnecting cold rebuilds "what was I doing" from repo state alone. Naming (human-decided 2026-06-10): `nexus whereami` — `resume` is reserved by nexus-halt, `recover` by release-recovery. Split by cost: `nexus start` stays the full one-time orientation; `whereami` prints only the compact resume packet, cheap enough to run after any disconnect or compaction. Token-efficiency goal: the packet replaces re-reading queue + standup + constitution wholesale on reconnect. Coordinates with loop-progress-signals (Gate G) and task-state-commands.

- [ ] TASK/Codex: Add hot-file contention warnings to next/status
  - Id: hot-file-contention
  - Epic: Same-branch recoverability
  - Status: Ready
  - Depends on: none
  - Files: src/commands/next.js, src/commands/status.js, test/next.test.js, test/status.test.js
  - Affinity: cli, protocol, coordination
  - Cost: medium
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: Surface known high-contention paths such as `nexus-dashboard/index.html`, `src/commands/dashboard.js`, `_NEXUS_QUEUE.md`, and `_NEXUS_REPORT.md`. `nexus next` should warn when a suggested task touches hot files; `nexus status` should show hot active locks. Recoverability principle: warn before agents stack work on the same fragile surfaces. Loop-readiness note 2026-06-10: promoted to loop-critical (Gate E in docs-priv/loop-readiness-plan-2026-06-10.md).

- [ ] TASK/Codex: Add semantic dependency hints for queue tasks
  - Id: semantic-dependency-hints
  - Epic: Same-branch recoverability
  - Status: Ready
  - Depends on: none
  - Files: _NEXUS_QUEUE.md, src/commands/next.js, test/next.test.js
  - Affinity: cli, queue, coordination
  - Cost: medium
  - Auto-flow: no
  - Notes: Extend queue parsing to recognize lightweight `Coordinates with:` or `Soft depends on:` lines. These do not block like `Depends on`, but `nexus next` should display them so an agent knows when Claude/Codex/Gemini work may be semantically adjacent. Recoverability principle: make hidden coordination assumptions visible before edits begin. Loop-readiness note 2026-06-10: promoted to loop-critical (Gate D in docs-priv/loop-readiness-plan-2026-06-10.md).

- [ ] TASK/Codex: Add release recovery command
  - Id: release-recovery
  - Epic: Same-branch recoverability
  - Status: Ready
  - Depends on: report-unification
  - Files: src/commands/recover.js, bin/nexus.js, test/recover.test.js
  - Affinity: cli, recoverability, git
  - Cost: medium
  - Auto-flow: no
  - Notes: Add `nexus recover <sha|target>` as a read-only helper that prints the release receipt, git show summary, files changed, and suggested rollback/reapply commands without executing destructive actions. This is the core advantage of 3 SOTA on one branch: when things go wrong, recovery should be fast, local, and evidence-backed. Loop-readiness note 2026-06-10: required before any Level 2 claim (Gate F).

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
