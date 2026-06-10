# Changelog

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
