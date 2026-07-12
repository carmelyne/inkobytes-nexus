# Changelog

## 1.4.0 - 2026-07-13

The dogfooding release: 15 of the 17 friction points logged while using Nexus on a real multi-agent project (`docs/nexus-issues.md`) are fixed or designed in this version.

- **Release sweep guard**: `nexus claim` records whether the path already had uncommitted changes (`dirty-at-claim`) and warns immediately; every `nexus release` prints a `[DIFF]` diffstat (including untracked files) of exactly what is about to be committed, and refuses to sweep changes that predate the claim unless run with `--include-preexisting`. One agent's release can no longer silently commit another agent's work.
- **Hook guard V2 (write-path lock binding)**: the PreToolUse guard now enforces lock *ownership*, not just lock existence — writes through another agent's claim are denied naming the owner, and parent-directory claims cover child files, matching the CLI hierarchy. Older V1 hooks report as `outdated` in `nexus doctor --hooks` and refresh with `nexus hooks install` (no `--force` needed). Known gap documented: stale-base writes within a validly held claim cannot be hook-detected.
- **Soft claim TTL**: `claimTtl` (default 7200s) flags long-held locks as `⏰ OVERDUE` in `nexus status` and as a doctor finding naming the owner. Opt-in `claimTtlAutoRelease` lets sweeps break an overdue lock only when the claimed file's content has not moved since claim — path-local work always protects a lock; directory and new-path claims are never TTL-swept.
- **`nexus trash`**: reversible deletes for agents — moves targets into `.nexus/trash/` with restore metadata (`--list`, `--restore`), plus an optional `nexus trash --hooks` guard that intercepts destructive `rm` in favor of trash. `nexus doctor` reports trash directory usage.
- **`nexus verify <task-id>`**: read-only receipt checker — resolves a done-task's commits and shows diffstat and touched paths against the task's declared file scope, so checking another agent's receipt costs one command instead of manual diff archaeology.
- **`nexus next` explainability**: done tasks are cross-checked against receipts and lane files before being suggested; standby responses list each skipped candidate with the reason (blocked-by, claimed, review state, delegated), so a false standby is diagnosable.
- **Sample-task safety**: freshly scaffolded Hello World tasks ship as `Status: Sample`; `nexus next` skips them with a pointer instead of sending an agent off to build `src/hello.js` in a real project, and doctor flags samples that coexist with real commits.
- **CLI papercuts**: the `--model` metadata warning prints once per session instead of on every claim; `--help`/`-h` is intercepted on path-taking subcommands instead of falling through to git as a pathspec; same-agent sequential releases no longer trigger false "HEAD changed" warnings (own release commits are excluded from the drift check); standup timestamps accept one-digit hours.
- **Design doc**: `docs/claim-semantics-rework.md` proposes free reads (claims reserved for writes), a lock-less `nexus fresh` receipt command, and atomic batch claim — awaiting human review before implementation.
- **Dogfooding log**: `docs/nexus-issues.md` imported and extended live; issue 17 (repo-global verify gate blocks unrelated releases while another agent's in-flight test is red) is logged with a proposed fix task.

## 1.3.0 - 2026-06-21

- Added observable loop progress signals built from repo-state changes rather than agent self-reports. Nexus now detects claimed-file blob movement, recent release receipts, and delegated-lane receipts through a shared agent trace reader.
- Made stale-lock handling progress-aware by default: old locks are sweepable only when they are past `staleThreshold` and show no progress within `progressWindow`. Set `progressAwareStale` to `false` to restore age-only behavior.
- Updated `nexus status` to label active locks as progressing or showing no progress signal, and aligned its `STALE` result with `nexus clean --stale`.
- Added informational `nexus doctor` diagnostics for possible stuck loops, claim/release imbalance, repeated release-verification failures, and the active staleness mode.
- Fixed `nexus claim --help` so it prints claim-specific usage instead of failing as a malformed claim, and updated top-level help to mention the default freshness receipt plus `--show` for full contents.
- Added the loop-progress design and review decisions to `docs/loop-progress-signals.md`.

## 1.2.0 - 2026-06-11

- **Changed the default `nexus claim` output**: claim now prints a freshness receipt (git blob hash of on-disk content, last commit, dirty/clean state, line count) instead of dumping the full file. Same blob hash as the agent's last read means cached content is current; different means re-read. Use `nexus claim --show` for the previous full fresh-state dump. Run `nexus doctor --fix` in consumer repos to sync the generated agent protocol wording.
- Added delegated queue lanes: `nexus next @agent --take` copies a task (including its primitives) into `_NEXUS_Q_<AGENT>.md` and marks the master task delegated; `nexus q @agent` inspects the lane; `nexus q done <id> @agent` writes a lane-local receipt without mutating the master queue; `nexus queue reconcile` batches receipts back into `_NEXUS_QUEUE.md`; `nexus doctor` warns about unreconciled receipts, duplicates, stale delegated tasks, and master/lane disagreement.
- Added Task Primitives to the queue format: `Goal`, `Outcome`, `Constraints`, `Stop If`, and `Evidence`. `nexus next` prints declared primitives with its suggestion and lists missing ones as an advisory; `nexus doctor` reports primitive gaps on auto-flow tasks (advisory at autonomy 0–1, actionable at autonomy 2). `Outcome` + `Evidence` + `Stop If` are the anti-over-looping contract. Backward compatible — existing tasks stay valid.
- Added release attribution fallback: when a lock is missing at release time (for example after a stale-lock sweep), commits, report receipts, and ledger entries attribute from `NEXUS_AGENT` or the queue task's `TASK/<owner>` header instead of `unknown`.
- Compacted `nexus doctor` queue-authorship output: findings identical across tasks print once with a task id list instead of repeating per task.
- Added a cached npm update notice: after normal commands, Nexus prints a small stderr note when a newer version exists. Cached 24 hours, skipped in CI, opt-out with `NEXUS_NO_UPDATE_CHECK=1`. Only the package metadata request goes to npm — no repo paths, command names, task data, user ids, telemetry, or usage events.

## 1.1.0 - 2026-06-11

- Added `nexus halt "<reason>"` / `nexus resume` circuit breaker: claim, release, and next refuse while `.nexus/HALT` is present, the dashboard shows a halted banner, and resume is human-gated by convention.
- Added a release verification gate: when `release.verifyCommand` is set in `.nexus/config.json`, `nexus release` runs it before staging and refuses to commit on failure, keeping the claim. `--no-verify` is allowed only at autonomy level 0 and logged to standup.
- Added `autonomy` level (0–2) to `.nexus/config.json`; `nexus doctor` now warns when autonomy 1+ has no `verifyCommand` (Loop Readiness check).
- Dashboard now binds 127.0.0.1 by default; LAN exposure requires the explicit `--lan` flag.
- Fixed `nexus db restore` writing nested database files to the repo root: the backup manifest now stores repo-relative paths and restores round-trip exactly.
- Removed shell interpolation from mysql backup/restore; `DATABASE_URL` is passed as literal arguments, never through `sh -c`.
- Aligned promptCHMOD messaging and docs to "advisory contract, not mechanically enforced," with the x-bit threat model documented honestly.
- CLI version is now read from `package.json` at runtime, and `prepublishOnly: npm test` blocks publishing on a failing suite.
- Added GitHub Actions CI running tests and `npm pack --dry-run` on Node 18/20/22.

## 1.0.8 - 2026-06-10

- Added a shared protocol wording source so `nexus init`, `nexus doctor`, README repair, and tests stay aligned.
- Tightened generated agent protocol around required continuity/latest-memory reads and claim-before-read/edit behavior.
- Added `nexus hooks install --agent all` for installing Codex, Claude, and Gemini guard hooks in one pass.

## 1.0.7 - 2026-06-06

- Added `nexus install-skill` to install the bundled Nexus skill into `~/.agents/skills/nexus`.
- Added `--target` and `--force` options for custom or refreshed skill installs, with a guard against broad overwrite targets.
- Updated help, zsh completion, README docs, and regression coverage for the new skill installer command.

## 1.0.6 - 2026-06-03

- Extended Nexus protocol drift checks so `nexus doctor` now covers the bundled `skills/nexus/SKILL.md`.
- Kept Nexus repo docs aligned with the agent-native release model while scoping root `README.md` doctor repair to the actual `@inkobytes/nexus` product repo.
- Added regression coverage for Nexus-product README repair and for avoiding root README mutation in ordinary consumer repos.

## 1.0.5 - 2026-06-03

- Reframed doctor-managed agent guides around agent-native, file-native release flow instead of human-oriented feature commit bundling.
- Updated `nexus doctor --fix` and `nexus init` scaffolds to teach release-by-file at coherent checkpoints.
- Added regression coverage so scaffold generation and repair keep the new agent-native wording stable.

## 1.0.4 - 2026-06-03

- Collapsed large `nexus doctor` Git Privacy floods into grouped per-root summaries with sample paths.
- Prioritized `CONTINUITY.md` and `memories/` samples first so agent-local issues stay visible.
- Collapsed shared agent roots like `.claude/`, `.codex/`, and `.gemini/` into one concise Git Privacy note for repos that intentionally track them.
- Colorized `nexus doctor` output and grouped findings under clearer action buckets like `Fix the following` and `Review / informational`.
- Added `.nexus/config.json` support for `doctor.allowTrackedAgentTrees` so intentionally tracked shared agent trees can be treated as informational.
- Reformatted lock and queue findings into compact field-style output like `file`, `by`, `needs`, `impact`, and shorter `fix` lines.

## 1.0.1 - 2026-06-02

- Added colorized `nexus help` output for a more readable CLI experience.
- Added `nexus completion zsh` so users can load shell completions without extra scripts.
