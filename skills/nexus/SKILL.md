---
name: nexus
description: Use in repos coordinated by the Nexus CLI, especially when _NEXUS_CONSTITUTION.md, _NEXUS_QUEUE.md, _NEXUS_STANDUP.md, or .nexus/ exists, or when the user asks about Nexus claim/release/doctor/status/next.
---

# Nexus

Nexus CLI is the coordination engine. This skill is only the agent playbook.

## Loop

1. Run `nexus doctor`.
2. Read `_NEXUS_CONSTITUTION.md`, `_NEXUS_QUEUE.md`, and `_NEXUS_STANDUP.md`.
3. Choose user-assigned work or `nexus next @Agent`; do not free-roam into `Auto-flow: no`.
4. Claim exact shared files before reading/editing:

   ```bash
   nexus claim <path> @Agent "intent"
   ```

5. Treat claim output as fresh file truth. Ignore cached file memory when contents matter.
6. Work only inside the claimed surface and run focused validation.
7. If the user wants a commit, release through Nexus:

   ```bash
   nexus release <path> "short commit message"
   ```

## Guardrails

- Ask before `nexus doctor --fix` unless scaffold repair is already approved.
- Agent-local continuity and memory files are claim-exempt unless the user says otherwise.
- Avoid parallel `nexus release`.
- Do not install packages younger than 14 days; if age is unknown, ask.
- Use `nexus status`, `nexus clean --stale`, or surgical `nexus clean <path>` for lock recovery. Never nuke all locks without explicit approval.
