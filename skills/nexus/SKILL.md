---
name: nexus
description: Use in repos coordinated by the Nexus CLI, especially when _NEXUS_CONSTITUTION.md, _NEXUS_QUEUE.md, _NEXUS_STANDUP.md, or .nexus/ exists, or when the user asks about Nexus start/claim/release/doctor/status/next.
---

# Nexus

Nexus CLI is the coordination engine. This skill is only the agent playbook.

If the user, repo, or hook says Nexus is active, treat this skill as mandatory workflow. It is not optional advice.

## Loop

1. Run `nexus start`; set `NEXUS_AGENT` for your CLI, or pass `--agent @agy|@claude|@codex|@gemini`. Start is orientation only, not permission to edit.
2. Read `_NEXUS_CONSTITUTION.md`.
3. Read `USER.md` if present for local user preferences.
4. Read continuity and latest memory at session start, `nexus start`, or resume.
5. Read `_NEXUS_QUEUE.md` and `_NEXUS_STANDUP.md`.
6. Choose user-assigned work or `nexus next @Agent`; do not free-roam into `Auto-flow: no`.
7. Claim exact shared files before reading/editing:

   ```bash
   nexus claim <path> @Agent "intent"
   ```

8. Treat claim output as current file state. Ignore cached file memory when contents matter.
9. If a hook blocks access because a path is unclaimed, stop and claim that exact path. Do not work around the hook with another command, cached content, or manual git operation.
10. Work only inside the claimed surface and run focused validation.
11. Release each claimed tracked file through Nexus as soon as it reaches a coherent checkpoint:

   ```bash
   nexus release <path> "short commit message"
   ```

12. Do not hold claims to bundle related work into a prettier feature commit. Nexus is agent-native and file-native: optimize for file availability, rollback safety, and agent throughput.

## Queue Items

When adding work to `_NEXUS_QUEUE.md`, keep tasks dashboard-parseable and immediately actionable. Use this shape:

```md
- [ ] TASK/@agent: Short task title
  - Id: stable-kebab-id
  - Epic: Product area or safety theme
  - Status: Ready
  - Depends on: none
  - Files: path/one.js, path/two.md
  - Affinity: cli, docs, dashboard
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: One practical paragraph with scope, constraints, and definition of done.
```

- `Files` should name the likely edit surface so other agents can spot conflicts before claiming.
- `Depends on` should list hard blockers by `Id`; use `none` when the task is independent.
- `Auto-flow: yes` means an agent can grab it after `nexus next`; use `no` when planning or human approval is needed.
- Auto-flow work in `Ready Queue` should include `Review: approved` and `Approved by: human`, or `doctor` will flag it and `nexus next` may skip it.
- `Notes` should carry dashboard-useful context, not a whole design doc.

## Guardrails

- Ask before `nexus doctor --fix` unless scaffold repair is already approved.
- Use `nexus doctor` for audit/repair, not as the normal startup command.
- Use CLI/model names as lock handles: `@agy`, `@claude`, `@codex`, `@gemini`.
- Agent-local continuity and memory files are claim-exempt unless the user says otherwise.
- Continuity is the compaction-safe session ledger; latest memory is required startup/resume context.
- Memory indexes use monthly folders and newest-first Markdown links with one-line outcomes.
- Shared generated protocol wording is sourced from `src/lib/protocolText.js`; update that first, then run doctor/init tests.
- When using subagents or parallel workers, the lead agent owns the repo effects: claim the full path scope, pass boundaries down, re-read affected files, and mention delegated work in release or standup notes.
- Avoid parallel `nexus release`.
- Do not install packages younger than 14 days; if age is unknown, ask.
- Use `nexus status`, `nexus clean --stale`, or surgical `nexus clean <path>` for lock recovery. Never nuke all locks without explicit approval.
