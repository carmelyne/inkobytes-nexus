# Nexus Hooks

Nexus hooks are optional local guardrails for agent CLIs. They block file writes in Nexus repos until the target path has a matching Nexus claim.

Hooks are useful because agent instruction files can be forgotten after context compaction. The hook gives the agent a short recovery command instead of letting it edit around the protocol.

## Install

```bash
nexus hooks install --agent @codex
nexus hooks install --agent @claude
nexus hooks install --agent @gemini
nexus hooks install --agent all
```

Supported agents:

- `@codex`
- `@claude`
- `@gemini`

Each installed hook bakes in the matching claim handle, so a Codex hook says `@codex`, a Claude hook says `@claude`, and a Gemini hook says `@gemini`.

Use `--agent all` to install all default Codex, Claude, and Gemini hooks in one pass. `--target` is only available for a single agent because each agent has a different default file.

## Default Targets

```text
@codex  -> ~/.codex/hooks/pre_tool_use_guard.py
@claude -> ~/.claude/hooks/nexus_pre_tool_use_guard.py
@gemini -> ~/.gemini/hooks/nexus_pre_tool_use_guard.py
```

Use `--target` when your agent CLI needs a different hook path:

```bash
nexus hooks install --agent @codex --target ~/.codex/hooks/pre_tool_use_guard.py
```

If a hook file already exists, Nexus does not overwrite it unless it is already a current Nexus hook. Use `--force` only after reviewing the existing file:

```bash
nexus hooks install --agent @codex --force
```

## What The Hook Blocks

The hook looks for writes to files in a Nexus repo and enforces two rules (template V2):

**1. Unclaimed paths.** If the file has no covering claim, the tool call is denied with a recovery command:

```text
CLAIM FIRST: README.md
cd /path/to/repo && nexus claim README.md @codex "Describe the edit"
Retry edit. No workaround.
```

For multiple files, it adds:

```text
If multiple files are listed, claim each exact path.
```

**2. Foreign-owned locks.** If the covering claim belongs to a different agent, the write is denied naming the owner — holding the lock and being allowed to write are the same fact:

```text
LOCKED BY ANOTHER AGENT: src/terrain.js (held by @codex)
Do not edit through another agent's claim. Wait for release, or coordinate in _NEXUS_STANDUP.md.
No workaround.
```

This closes the lock-then-write-from-cache race: once a claim is released or taken over, the previous holder's writes stop passing, instead of relying on agents policing themselves. A lock whose owner metadata is unreadable is treated as foreign (safe default).

The hook discovers the Nexus repo root from the target path or current working directory. It checks the real Nexus lock path encoding, including nested paths such as `docs~2Fguide.md.lock`, and walks parent directories so a directory claim covers writes to files inside it — matching the CLI's claim hierarchy.

**Known gap:** the hook cannot verify that an edit was computed from the current file content (stale-base writes within a validly held claim), because hook input carries no base-content identity. The claim-time freshness receipt plus re-reading after any takeover remains the protocol answer there.

## Claim Exemptions

The hook allows agent-local continuity and memory handoff files without a claim:

- `.codex/CONTINUITY.md`
- `.codex/memories/`
- `.claude/CONTINUITY.md`
- `.claude/memories/`
- `.gemini/CONTINUITY.md`
- `.gemini/memories/`

Agent instruction files such as `.codex/AGENTS.md`, `.claude/CLAUDE.md`, and `.gemini/GEMINI.md` still require claim/release when they are shared project files.

## Doctor Check

Hook installation writes outside the repo, so `nexus doctor --fix` does not install or replace hooks.

To audit hook status explicitly:

```bash
nexus doctor --hooks
```

Doctor reports whether each supported agent hook is:

- `current`
- `missing`
- `foreign`
- `wrong-agent`
- `outdated` — an older Nexus template (e.g. V1, existence-only checking); rerun `nexus hooks install --agent <handle>` to refresh it, no `--force` needed

Use `nexus hooks install --agent <handle>` to install or refresh a hook.
