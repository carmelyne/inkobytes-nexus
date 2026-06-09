# Nexus Hooks

Nexus hooks are optional local guardrails for agent CLIs. They block file writes in Nexus repos until the target path has a matching Nexus claim.

Hooks are useful because agent instruction files can be forgotten after context compaction. The hook gives the agent a short recovery command instead of letting it edit around the protocol.

## Install

```bash
nexus hooks install --agent @codex
nexus hooks install --agent @claude
nexus hooks install --agent @gemini
```

Supported agents:

- `@codex`
- `@claude`
- `@gemini`

Each installed hook bakes in the matching claim handle, so a Codex hook says `@codex`, a Claude hook says `@claude`, and a Gemini hook says `@gemini`.

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

The hook looks for writes to files in a Nexus repo. If the file is not claimed, it denies the tool call with a compact message:

```text
CLAIM FIRST: README.md
cd /path/to/repo && nexus claim README.md @codex "Describe the edit"
Retry edit. No workaround.
```

For multiple files, it adds:

```text
If multiple files are listed, claim each exact path.
```

The hook discovers the Nexus repo root from the target path or current working directory. It checks the real Nexus lock path encoding, including nested paths such as `docs~2Fguide.md.lock`.

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

Use `nexus hooks install --agent <handle>` to install or refresh a hook.

