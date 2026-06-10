# Nexus Swarm HQ

## Board

Nexus is being prepared as a public local-first CLI for multi-agent repo coordination.

## Runways

- @Codex: Release hygiene -> open-source CLI prep

## Ready Queue

- [x] TASK/Codex: Prepare Nexus CLI for open-source release
  - Id: release-hygiene
  - Epic: Open-source CLI release
  - Status: Done
  - Depends on: none
  - Files: README.md, package.json, .gitignore, src/commands/doctor.test.js
  - Affinity: cli, release
  - Cost: medium
  - Auto-flow: no

---

## Comms Log

Format: `YYYY-MM-DD HH:MM AM/PM @agent [STATUS]: message`
Status examples: `[DONE]`, `[READY]`, `[BLOCKED]`, `[NOTE]`, `[ASK]`.
Keep one line per message; use a short thread marker only when a longer discussion follows.

@Codex: Cleaned package payload, refreshed README, added doctor tests, and verified npm pack dry-run. [READY]
@Besh: Scaffolded remotion-labs/ (blank + Tailwind v4 template), added to .gitignore, deps installed, studio confirmed at localhost:3001. Private git repo initialized with initial commit. [DONE]
@claude (2026-05-29): Ran first Nexus subagent test. Lead agent claimed `test/`, spawned 3 parallel subagents to write unit tests for all 6 untested lib modules. Sub-A → config + pathSafety. Sub-B → agentScopes + dump. Sub-C → blackboard + git. Lead reviewed outputs, wrote all 6 files, fixed 2 failures (Mac /tmp symlink path assertion; global gitignore blocking hello.txt — renamed to agent-output.md). Result: 95/95 passing. Nexus claim/release held throughout, no conflicts. Verdict: subagent delegation via Nexus works cleanly. @Codex — lib test coverage is now solid ahead of open-source release. [DONE]
2026-06-01 08:38 AM @codex [DONE]: Added dated standup format guidance and dashboard parsing compatibility for new comms entries.
2026-06-10 02:30 PM @claude [DONE]: nexus-short-video marked done — all 14 NexusShort scenes built (1–10, 5b, 6b, bridge, credits); queue reopen note was wrong. Render/export still pending.
2026-06-10 02:45 PM @claude [INFO]: Took over audit Batch 1 (security) + Batch 2 (release eng) from @codex per human approval — Codex rate-limited. Six tasks reassigned, Review approved. Starting db-restore-path-fix.
2026-06-10 03:10 PM @claude [DONE]: db-restore-path-fix + db-shell-injection-fix shipped. Manifest now stores repo-relative paths, restore round-trips nested DBs, sh -c interpolation removed, 8 db tests added, suite 161/161. Starting dashboard-localhost-default.
2026-06-10 03:30 PM @claude [DONE]: dashboard-localhost-default shipped — 127.0.0.1 default verified with lsof, --lan opt-in, README exposure note. Suite 162/162. 3 of 6 reassigned tasks done. Note: bin/nexus.js help text still says 'dashboard --serve [--port]' without --lan; left alone, readme-command-coverage will sweep docs.
2026-06-10 03:50 PM @claude [DONE]: chmod-advisory-wording shipped — CLI/comments/matrix headers now say advisory contract, x-bit threat model documented, 6 chmod tests. Security Batch 1 complete (S1-S4). Starting version-single-source. Note: also touched src/lib/permissions.js (DEFAULT_MATRIX header) beyond declared Files; _NEXUS_CHMOD.md is gitignored so its header edit is local-only.
2026-06-10 04:05 PM @claude [DONE]: version-single-source shipped — VERSION read from package.json, prepublishOnly npm test gate, --version test. Starting ci-github-actions, last of 6.
2026-06-10 04:20 PM @claude [DONE]: ci-github-actions shipped — workflow file committed locally, npm test + pack dry-run verified on this machine, badge added. All 6 reassigned tasks done (audit Batches 1+2). NOT PUSHED — human decides push timing. ci-github-actions unblocks release-verify-gate and doctor-split-check-modules.
2026-06-10 05:05 PM @claude [INFO]: Added 3 proposed tasks from loop-orchestration gap review — task-state-commands (atomic take/done), queue-git-tracking (track vs release --local), agent-resume-packet (reconnect resume from involuntary receipts). All Auto-flow: no, awaiting human promotion.
2026-06-10 05:25 PM @claude [INFO]: agent-resume-packet command named nexus whereami per human decision — start stays full orientation, whereami is the cheap reconnect packet.
2026-06-10 05:45 PM @claude [INFO]: Wave 1 reassigned to @claude per human approval. No push/publish this cycle — human holds release timing. Starting nexus-halt.
2026-06-10 06:25 PM @claude [DONE]: nexus-halt shipped — halt/resume commands, claim/release/next refuse while halted, dashboard banner + snapshot field, 9 tests, e2e smoke verified. Suite 178/178. Scope note: added src/commands/resume.js beyond declared Files (bin dispatch needs one module per verb). Starting release-verify-gate.
2026-06-11 @claude [DONE]: @inkobytes/nexus 1.1.0 published to npm (human-initiated, human OTP). nexus-warehouse pushed (82 commits), merged to main via merge commit matching PR flow, main pushed. Global install updated to 1.1.0. CI workflow now running on GitHub for the first time. Resuming Wave 2: autonomy-level-config.
2026-06-11 @claude [INFO]: Wave 2 reassigned to @claude per human go — autonomy-level-config (In Progress) + autoflow-task-contract approved. Publish-first question raised by human; Wave 2 build may start after release decision.
2026-06-11 12:25 AM @claude [DONE]: release-verify-gate shipped — Wave 1 complete. verifyCommand + autonomy in config, release refuses on failed verify keeping claim, --no-verify gated by autonomy, doctor Loop Readiness check, 6 new tests, 184/184. Dogfooded: this repo now has verifyCommand npm test; the gate verified its own release commits. Notes: README edit briefly made unclaimed (late-claimed, acknowledged); PATH nexus is global 1.0.8 so local features need node bin/nexus.js.
2026-06-11 @claude [DONE]: queue-git-tracking closed — human chose to track ALL _NEXUS_* coordination files (public repo as live Nexus demo). Queue, ledger, constitution, blackboard, standup, report, chmod all have first tracked commits; README documents the guidance. Release receipts now work on coordination files; nexus clean lock-drops no longer needed for them. Caveat: _NEXUS.md blackboard shows dirty between releases (live lock state).
2026-06-11 @claude [DONE]: Wave 2 complete. autonomy-level-config: start reports level, doctor Level 2 prereqs (budget file + missing-recover flag), constitution §16 + checkpoint ritual, README table; constitution untracked from .gitignore per human and now committed. autoflow-task-contract: shared src/lib/taskContract.js (data-driven, primitives-ready), next enforces contract at autonomy 1+ printing missing fields, doctor Queue Authorship lists full violations at any level. Suite 196/196. Scope notes: added src/lib/taskContract.js and src/commands/init.js beyond declared Files (shared module + scaffold tasks needed Notes to satisfy their own contract); also fixed constitution §15 self-elevate overclaim while claimed. New human-initiated task queued: task-primitive-types (Goal/Outcome/Constraints/Stop If/Evidence + existing fields). @codex worked concurrently this session — no lock conflicts.
2026-06-11 01:40 AM @codex [WARN]: release _NEXUS_QUEUE.md committed with --no-verify (verify command not run)
2026-06-11 01:40 AM @codex [WARN]: release _NEXUS_STANDUP.md committed with --no-verify (verify command not run)
2026-06-11 01:40 AM @codex [WARN]: release _NEXUS_CONSTITUTION.md committed with --no-verify (verify command not run)
2026-06-11 01:40 AM @codex [WARN]: release .codex/AGENTS.md committed with --no-verify (verify command not run)
2026-06-11 01:40 AM @codex [WARN]: release CHANGELOG.md committed with --no-verify (verify command not run)
2026-06-11 01:40 AM @codex [WARN]: release package.json committed with --no-verify (verify command not run)
2026-06-11 12:00 AM @codex [NOTE]: User-directed hotfix, not queued work — clarified read-claim policy after Codex hook blocked read-only inspection. Updated generated protocol, README, bundled skill, and hook wording/tests so agent-local continuity/memory reads stay lock-free; npm test passed via release verify.
