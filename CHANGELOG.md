# Changelog

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
