# Nexus Swarm: Core Operating Protocol

Nexus is mandatory coordination for agents sharing a local repository.

## 1. Start With Doctor

When entering an existing Nexus repo, run:

```bash
nexus doctor
```

Use the report to notice missing protocol files, stale locks, missing continuity/memory scaffolds, and legacy helper references. Ask before running `nexus doctor --fix` unless the human already approved safe scaffold repair.

## 2. Queue First

Before choosing follow-on work, read `_NEXUS_QUEUE.md`.

- `_NEXUS_QUEUE.md` decides executable priority, dependencies, file scope, cost, and `Auto-flow`.
- `_NEXUS_STANDUP.md` is for comms, human context, decisions, and completion notes.
- If queue and standup conflict, follow the queue for what to work on, then use standup to explain or ask.
- If no explicit user task is given, run `nexus next @Agent` and only auto-claim returned work when `Auto-flow: yes`.

## 3. Approval Gate

If a queue item, standup note, or user instruction says to make a plan and get approval:

- stop before claiming implementation files
- present the plan in the terminal chat
- wait for explicit approval

## 4. Claim Granularity

Nexus supports two ownership levels:

- **Directory claim**: use for a self-contained module or component folder.
- **File claim**: use for standalone files, configs, stores, commands, or docs.

If a directory is claimed, no other agent may claim a file inside it. If a child file is claimed, another agent may not claim the parent directory.

## 5. Execution Loop

1. Select work from `_NEXUS_QUEUE.md` or `nexus next @Agent`.
2. Claim before reading or editing shared project files:

   ```bash
   nexus claim <path> @Agent "intent"
   ```

3. Treat claim output as fresh file truth.
4. Do the scoped work only inside the claimed surface.
5. Release through Nexus:

   ```bash
   nexus release <path> "short commit message"
   ```

6. Add a short completion note to standup if useful.
7. Run `nexus next @Agent` or stand by.

## 6. Fresh File Truth

- Treat previous chat context, cached model memory, and earlier reads as stale when file contents matter.
- Before claiming what a file says, making edits, or judging current state, read the file from disk with a fresh command.
- Treat `nexus claim` output as fresh file state for the claimed path.
- If another agent or tool may have touched the file since your last read, re-read it before editing.

## 7. Golden Rules

- Never modify shared project files without `nexus claim`.
- Never run `git commit` manually for claimed work; use `nexus release`.
- Never claim inside another agent's locked directory.
- Direct user instruction can override assignment, but not claim/release safety.
- Do not free-roam into `Auto-flow: no` work without approval.
- If no safe task remains, announce `Standby`.

## 8. Agent-Local Files

Continuity and memory files are agent-local handoff state. They are exempt from claim/release unless the human says otherwise.

Examples:

- `.codex/CONTINUITY.md`
- `.claude/CONTINUITY.md`
- `.gemini/CONTINUITY.md`
- `.codex/memories/INDEX.md`

## 9. Legacy Helper Transition

Older repos may mention shell helpers:

```text
./_nexus_claim.sh   -> nexus claim
./_nexus_release.sh -> nexus release
./_nexus_next.sh    -> nexus next
```

Prefer the `nexus` CLI commands. `nexus doctor` reports legacy references.
