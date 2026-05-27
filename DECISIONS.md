# Decisions

Short log for non-obvious architectural or organizational decisions.

## 2026-05-27 - Root-Cause Guardrails

- Decision: Add root-cause and decision-record guardrails to Nexus agent protocol.
- Reason: Keep agents from inventing fallback architectures or hiding unclear requirements behind workaround paths.
- Tradeoff: Agents must stop and report blockers more often instead of continuing speculatively.
- Files affected: `_NEXUS_CONSTITUTION.md`, `.codex/AGENTS.md`, `DECISIONS.md`.

## 2026-05-27 - Stale Lock Incident Eval

- Decision: Capture committed-but-still-locked work as a Nexus protocol eval.
- Reason: The incident showed that batch/manual commits can leave coordination state stale.
- Tradeoff: The eval documents desired agent behavior before a CLI-level root-cause fix exists.
- Files affected: `evals/nexus-agent-protocol/README.md`, `evals/nexus-agent-protocol/cases/stale-lock-after-commit.yaml`, `DECISIONS.md`.
