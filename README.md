# @inkobytes/nexus

Swarm traffic control for AI coding agents sharing one local repository.

Nexus is local-first, Git-backed, Markdown-readable, and built for agent teams that need lane discipline without a server.

## Why Nexus Exists

Claude Code, Codex CLI, Gemini CLI, and other agents can all work in the same repo, but they need a shared operating protocol. Without one, agents can collide on files, pollute each other's staging area, lose context, or ask the human to keep the whole work map in their head.

Nexus keeps agents in one shared branch so they do not drift into separate realities. Everyone sees the same files, queue, locks, and latest repo state; claims and scoped release give that shared room enough discipline to stay usable.

Nexus gives the swarm a simple loop:

```text
start -> claim -> work -> release -> next
```

Git still stores the real commits. Nexus handles the agent coordination around those commits.

## Install

```bash
npm install -g @inkobytes/nexus
```

Or run without installing:

```bash
npx @inkobytes/nexus help
```

Requires Node.js 18 or newer.

## Quick Start

In a Git repo:

```bash
nexus init
nexus start
```

`nexus init` creates the Nexus coordination files:

- `_NEXUS.md` - live blackboard showing active locks
- `_NEXUS_QUEUE.md` - executable ready queue for agents
- `_NEXUS_STANDUP.md` - human-readable comms and decisions
- `_NEXUS_REPORT.md` - release receipt log
- `_NEXUS_CONSTITUTION.md` - agent operating protocol
- `.nexus/locks/` - local lock state, ignored by Git

It also scaffolds agent-local startup and handoff files when missing:

- `.codex/AGENTS.md`
- `.codex/CONTINUITY.md`
- `.codex/memories/INDEX.md`
- `.agy/AGENTS.md`
- `.agy/CONTINUITY.md`
- `.agy/memories/INDEX.md`
- `.claude/CLAUDE.md`
- `.claude/CONTINUITY.md`
- `.claude/memories/INDEX.md`
- `.gemini/GEMINI.md`
- `.gemini/CONTINUITY.md`
- `.gemini/memories/INDEX.md`

`USER.md`, when present, is the local user profile for identity, preferences, and workspace-specific instructions. Nexus treats it as private/local context and `nexus doctor` flags it if package files would publish it.

Memory folders are month-based from the start, for example:

```text
.codex/memories/2026-May/
.agy/memories/2026-May/
.claude/memories/2026-May/
.gemini/memories/2026-May/
```

## Commands

### `nexus init`

Scaffold Nexus coordination files, agent protocol entrypoints, continuity files, and monthly memory folders.

```bash
nexus init
```

Existing files are not overwritten.

### `nexus doctor [--fix] [--json]`

Check repo coordination health.

```bash
nexus doctor
nexus doctor --fix
nexus doctor --json
```

Doctor reports grouped issues:

- missing Nexus files
- package script exfiltration and install-hook risks
- package privacy risks for local/private files
- stale locks
- missing agent instructions
- missing continuity and memory scaffolds
- legacy `_nexus_*.sh` helper references

With `--fix`, Nexus creates safe missing scaffolds and updates managed protocol blocks in agent instruction files. It does not erase existing agent notes.

With `--json`, Nexus prints the same health sections as structured JSON for tools such as Inkobytes reports.

Use `doctor` for audit or repair. Do not make it the normal first command for every agent session.

### `nexus soul [--file <path>] [--status | --remove]`

Apply a local soul overlay to agent instruction files.

```bash
nexus soul
nexus soul --status
nexus soul --remove
nexus soul --file .nexus/local/my-agent-overlay.md
```

By default, Nexus creates `.nexus/local/agent-overlay.md` if it does not exist, then inserts that file above the managed Nexus protocol block in `.codex/AGENTS.md`, `.claude/CLAUDE.md`, and `.gemini/GEMINI.md`. Edit the overlay file locally, then rerun `nexus soul` to refresh the inserted blocks.

The overlay content is local repo state, not package content. `nexus doctor` ignores soul blocks and only manages the public Nexus protocol block.

### `nexus start`

Orient an agent entering this repo.

```bash
nexus start
```

Start reports only local facts: repo path, branch, last commits, dirty files, active locks, and the continuity/memory path for the selected model scope. Start is orientation only, not clearance to edit; agents still claim before shared reads/edits and release when done. Set `NEXUS_AGENT=@claude`, `@codex`, `@gemini`, or `@agy` so agents can run plain `nexus start`; `--agent` is available as an override.

### `nexus claim <path> <agent> "<intent>"`

Lock a file or directory before reading or editing it.

```bash
nexus claim src/lib/components/login/ @claude "Building login UI"
nexus claim src-tauri/src/commands/auth.rs @gemini "Adding auth command"
```

Claims are hierarchy-aware:

- a claimed directory blocks claims inside it
- a claimed child file blocks a parent directory claim
- stale locks older than the configured threshold are auto-broken
- missing core Nexus protocol files produce a short `nexus doctor` warning
- fresh file state is printed so the agent starts from disk truth

### `nexus release <path> "<commit message>"`

Release a claimed path, commit it through Git, update the blackboard, and append a report entry.

```bash
nexus release src/lib/components/login/ "feat: login form"
```

Nexus stages only the released path before committing, which helps avoid stowaway changes from other agents.
If Git's index is temporarily locked by another release, Nexus waits briefly and retries before failing with a clearer message.

Each release appends a repo-local backup record to `_NEXUS_REPORT.md`:

```md
Done claim:
- Changed:
- Validated:
- Risk:

Adversarial result:
- Pass, or:
- Finding:
```

### `nexus next <agent>`

Suggest the next safe auto-flow task from `_NEXUS_QUEUE.md`.

```bash
nexus next @codex
```

Nexus checks:

- task status
- `Auto-flow`
- dependencies
- claimed file conflicts
- optional agent budget file

If nothing is safe, the agent should stand by.

### `nexus status`

Show active locks with age and agent metadata.

```bash
nexus status
```

### `nexus clean [--stale | <path>]`

Clean lock state when needed.

```bash
nexus clean --stale
nexus clean src/App.svelte
nexus clean
```

`nexus clean` without arguments asks before clearing all locks.

## Queue Format

Nexus reads tasks from `_NEXUS_QUEUE.md`:

```md
- [ ] TASK/Codex: Add doctor stale-lock category
  - Id: doctor-stale-locks
  - Epic: Release hygiene
  - Status: Ready
  - Depends on: none
  - Files: src/commands/doctor.js
  - Affinity: cli, diagnostics
  - Cost: small
  - Auto-flow: yes
```

The queue is the executable priority surface. Standup is for comms and human context.

## Agent Protocol

The agent rule of thumb:

1. Run `nexus start` when entering an existing repo; it does not replace claim/release.
2. Read `USER.md` when present.
3. Read continuity and latest memory when present.
4. Read `_NEXUS_QUEUE.md` before taking follow-on work.
5. Claim before touching shared project files.
6. Release when finished.
7. Use `nexus next @Agent` instead of free-roaming.

Use model names as lock handles so ownership stays clear:

- `@claude`
- `@codex`
- `@gemini`
- `@agy`

Agent-local continuity and memory files are exempt from claim/release unless the human says otherwise.

Supply-chain rule: agents should not install third-party packages that have existed for less than 14 days. If package age cannot be verified, stop and ask the human. `nexus doctor` also flags install hooks and package scripts that look like they could exfiltrate data.

## Demo And Video Notes

For tutorials, docs, or video walkthroughs, use the same vocabulary as the CLI:

- `start` means entering a repo and orienting the agent to its own model memory scope.
- `doctor` means audit or repair.
- `claim` means taking a file or directory.
- `release` means finishing and committing.
- `next` means asking for safe follow-on work.
- Lock handles should use CLI/model names, such as `@claude`, `@codex`, `@gemini`, and `@agy`.

Avoid introducing extra startup names in scripts or narration.

## Bundled Skill

Nexus ships an agent skill at `skills/nexus/SKILL.md`.

The CLI is the coordination engine. The skill is the lean playbook for this flow: `start -> claim -> release`.

## Legacy Helper Transition

Older Nexus experiments used shell helpers:

```text
./_nexus_claim.sh   -> nexus claim
./_nexus_release.sh -> nexus release
./_nexus_next.sh    -> nexus next
```

`nexus doctor` reports these references. `nexus doctor --fix` updates checked protocol docs to the CLI form.

## Design Notes

Nexus is intentionally boring:

- no daemon
- no cloud service
- no database
- no private hidden coordination channel
- no branch choreography requirement

The current storage substrate is Git. Future Nexit planning explores agent-native zones, hive growth, inspection, publish, and recall, but Nexus keeps today's release path stable.

See `docs/plan/` for current planning notes.

## Development

```bash
npm test
npm pack --dry-run
```

## License

MIT - Carmelyne Thompson / InkoBytes
