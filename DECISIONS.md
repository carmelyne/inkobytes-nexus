# Decisions

Short log for non-obvious architectural or organizational decisions.

## 2026-05-27 - Root-Cause Guardrails

- Decision: Add root-cause and decision-record guardrails to Nexus agent protocol.
- Reason: Keep agents from inventing fallback architectures or hiding unclear requirements behind workaround paths.
- Tradeoff: Agents must stop and report blockers more often instead of continuing speculatively.
- Files affected: `_NEXUS_CONSTITUTION.md`, `.codex/AGENTS.md`, `DECISIONS.md`.
