# @inkobytes/nexus

[![CI](https://github.com/carmelyne/inkobytes-nexus/actions/workflows/ci.yml/badge.svg)](https://github.com/carmelyne/inkobytes-nexus/actions/workflows/ci.yml)

Shared awareness and traffic control for Codex, Claude, Gemini, and other SOTA coding agents working on the same branch.

Nexus helps multiple top-level coding agents share one local checkout without stepping on each other. It gives them local repo state they can all understand: who is working on what, why a file is locked, what was released, and what is safe to do next.

The loop is intentionally small:

```text
start -> claim -> work -> release -> next
```

Nexus is intentionally boring:

- no daemon
- no cloud service
- no database
- no branch choreography requirement
- just files, Git, hooks, and a small CLI

## Why Nexus Exists

The hard part starts when powerful agents work at the same time.

If Codex, Claude, Gemini, Cursor, or another coding agent touch the same branch without shared state:

- one agent may overwrite another agent's work
- one agent may commit files it did not mean to commit
- agents may lose track of what was already done
- after a reset, nobody knows what was safe or unfinished
- the human ends up with the mess

With Nexus, Git still stores the code history. Nexus tracks the operational state around Git: who claimed what, what task they are doing, what got released, and what another agent should read next.

Nexus is not only traffic control. It gives agents shared situational awareness:

- what each agent is working on, and why they claimed it
- which files are locked right now
- what the queue says is safe to pick up next
- what was released, and by whom
- what needs human attention

Codex knows what Claude is doing. Claude knows why Gemini claimed that directory. Nobody works blind.

## What Nexus Is And Is Not

Nexus is:

- shared awareness for multiple SOTA coding agents on one branch
- file claims before shared edits and non-orientation shared reads
- local guard hooks that block unclaimed writes
- a queue so agents know what is safe to pick up next
- a release command that commits only the claimed path
- standup, report, and ledger files humans can read
- a local dashboard over the same repo files
- preventive drills for known multi-agent failure cases

Nexus is not:

- a tool that runs the agents for you
- a replacement for Git, tests, review, or judgment
- a hosted service or cloud control panel
- a promise that agents cannot make bad edits
- a model benchmark

## Install

```bash
npm install -g @inkobytes/nexus
```

Or run without installing:

```bash
npx @inkobytes/nexus help
```

Requires Node.js 18 or newer.

## Update Notices

Nexus checks the npm registry for the latest `@inkobytes/nexus` version after normal commands and prints a small stderr notice only when a newer version is available. The lookup is cached in the user OS cache directory for 24 hours, so commands do not hit the network every run.

The check is skipped in CI, and you can opt out locally:

```bash
NEXUS_NO_UPDATE_CHECK=1 nexus start
```

The update check sends only the package metadata request to npm. It does not send repo paths, command names, task data, user ids, telemetry, or usage events.

## What's New In 1.2.0

- `nexus claim` prints a token-thin freshness receipt (git blob hash, last commit, dirty/clean) by default; `--show` restores the full file dump.
- Delegated queue lanes: `nexus next @agent --take`, `nexus q`, `nexus q done`, and `nexus queue reconcile` move active work into per-agent lane files and batch results back to the master queue.
- Task Primitives (`Goal`, `Outcome`, `Constraints`, `Stop If`, `Evidence`) define when a loop agent is finished and when it must stop; surfaced by `next`, checked by `doctor`.
- Release attribution falls back to `NEXUS_AGENT` or the queue task owner when a lock is missing, instead of writing `unknown`.
- Doctor compacts repeated queue findings, and a cached, privacy-respecting update notice flags newer npm versions.

See [CHANGELOG.md](./CHANGELOG.md) for the release summary.

## Shell Experience

For better typed-command ergonomics in `zsh`, load Nexus completions:

```bash
source <(nexus completion zsh)
```

If you want typed commands themselves to colorize while you type in iTerm, pair that with `zsh-syntax-highlighting`. Nexus provides the completions and colorized CLI output; the live input-line highlighting is handled by your shell.

## Quick Start

In a Git repo:

```bash
nexus init
nexus hooks install --agent all
nexus start --agent @codex
nexus claim README.md @codex "try Nexus on one file"
nexus release README.md "docs: try Nexus"
```

`nexus start` is orientation only. The edit loop is `claim -> work -> release`.

Hooks are the enforcement layer. Without hooks, Nexus is a coordination protocol agents follow. With hooks, unclaimed writes are blocked and the agent gets the exact claim command to run.

`nexus init` creates the Nexus coordination files:

- `_NEXUS.md` - live blackboard showing active locks
- `_NEXUS_QUEUE.md` - executable ready queue for agents
- `_NEXUS_STANDUP.md` - human-readable comms and decisions
- `_NEXUS_REPORT.md` - release receipt log
- `_NEXUS_CONSTITUTION.md` - agent operating protocol
- `.nexus/locks/` - local lock state, ignored by Git

Track the `_NEXUS_*` coordination files in Git. The queue is the program your agents execute — tracking it gives state flips commit history, diffs, and rollback, and makes `nexus doctor --fix` protocol updates auditable. `nexus release` also needs tracked files to produce commit receipts; gitignored paths fail release and force receipt-less lock drops. If your repo is public and standup/report chatter should stay private, those two are the reasonable exceptions. The live `_NEXUS.md` blackboard will show as dirty between releases — that is lock state doing its job.

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

Memory indexes stay newest-first and link to entries with one-line outcomes:

```md
- [2026-06-09-1430-hook-protocol-fix](2026-June/2026-06-09-1430-hook-protocol-fix.md) - tightened hook claim guidance
```

If you only want to inspect an existing repo before changing anything, run:

```bash
nexus doctor
nexus dashboard --serve
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
- grouped Git Privacy summaries for tracked private/local trees, with shared agent dirs collapsed into one concise note
- colorized action buckets so fixes and informational lock notes are easier to scan
- stale nexus locks
- unreconciled queue lane receipts, duplicate receipts, stale delegated tasks, and master/lane disagreements
- missing agent instructions specifically for nexus
- missing continuity and memory scaffolds
- legacy `_nexus_*.sh` helper references

With `--fix`, Nexus creates safe missing scaffolds and updates managed protocol blocks in agent instruction files. It does not erase existing agent notes.

With `--json`, Nexus prints the same health sections as structured JSON for tools such as Inkobytes reports.

If a private repo intentionally tracks shared agent trees like `.claude/`, `.codex/`, or `.gemini/`, you can mark that as allowed in `.nexus/config.json`:

```json
{
  "doctor": {
    "allowTrackedAgentTrees": true
  }
}
```

With that setting, `nexus doctor` keeps the shared-agent-tree note as informational instead of repeating an untrack fix.

Use `doctor` for audit or repair. Do not make it the normal first command for every agent session.

### `nexus soul [--file <path>] [--status | --remove]`

Apply a local soul overlay to agent instruction files.

```bash
nexus soul
nexus soul --status
nexus soul --remove
nexus soul --file .nexus/local/my-agent-overlay.md
```

Use `nexus soul` for local agent persona text: tone, collaboration style, and identity notes that the human wants their agents to carry in this repo.

Nexus stores the persona text in `.nexus/local/agent-overlay.md`, then copies it into local agent guide files above the managed Nexus protocol block. Edit `.nexus/local/agent-overlay.md`, rerun `nexus soul`, and the local agent persona layer is refreshed.

Do not use soul for project rules that every contributor needs. Put those in `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, or the repo docs. `nexus doctor` manages only the public Nexus protocol block and leaves soul persona text alone.

### `nexus start`

Orient an agent entering this repo.

```bash
nexus start
```

Start reports only local facts: repo path, branch, last commits, dirty files, active locks, and the continuity/memory path for the selected model scope. Start is orientation only, not clearance to edit; agents still claim before shared reads/edits and release when done. Set `NEXUS_AGENT=@claude`, `@codex`, `@gemini`, or `@agy` so agents can run plain `nexus start`; `--agent` is available as an override.

### `nexus dashboard --serve [--port <port>] [--lan]`

Serve a read-only local Nexus dashboard to see progress and issues.

```bash
nexus dashboard --serve
nexus dashboard --serve --port 13787
nexus dashboard --serve --lan
```

The dashboard shows repo health, active locks, queue items, recent standup lines, recent release notes, and dirty git files. It uses local files as the source of truth and updates the page through server-sent events. The default port is `13787`; if that port is already in use, Nexus tries `13788`, `13789`, and so on. Passing `--port` uses that exact port.

By default the dashboard binds `127.0.0.1`, so it is reachable only from your machine. The dashboard has no authentication and exposes repo coordination state (paths, branch, dirty files, lock intents, standup history), so network exposure is opt-in: pass `--lan` to bind all interfaces and print local-network URLs for other devices. Only use `--lan` on networks you trust.

### `nexus halt "<reason>"` and `nexus resume`

Repo-wide circuit breaker for agent swarms.

```bash
nexus halt "queue drift detected, need human review"
nexus resume
```

`nexus halt` writes `.nexus/HALT` with the reason, timestamp, and initiator. While it exists, `claim`, `release`, and `next` refuse with the halt reason and instruct agents to log a standup line and stand by. The dashboard shows a prominent halted banner. One command stops the swarm, repo-wide, instantly.

Any agent or human may halt — an agent that detects swarm-level trouble should be able to stop everyone. Only humans resume: `nexus resume` refuses inside recognized agent sessions (`CLAUDECODE=1` or `NEXUS_AGENT` set). Like promptCHMOD, that check is an advisory contract honored at session level, not mechanical enforcement — a process that lies about its identity can bypass it. The audit trail, not the gate, is the real guarantee.

### `nexus completion zsh`

Print a zsh completion script for Nexus.

```bash
nexus completion zsh
source <(nexus completion zsh)
```

This gives `zsh` tab-completion for commands like `claim`, `release`, `doctor`, `drill`, and common agent handles such as `@codex` and `@claude`.

### `nexus install-skill [--target <path>] [--force]`

Install the bundled Nexus agent skill into the shared agent skill directory.

```bash
nexus install-skill
nexus install-skill --force
nexus install-skill --target ~/.agents/skills/nexus
```

By default, Nexus copies `skills/nexus` from the published package into `~/.agents/skills/nexus`. Restart or refresh your agent session after installing so its skill registry can discover the new `nexus` skill.

### `nexus hooks install --agent @codex|@claude|@gemini|all [--target <path>] [--force]`

Install an agent-specific local guard hook.

```bash
nexus hooks install --agent @codex
nexus hooks install --agent @claude
nexus hooks install --agent @gemini
nexus hooks install --agent all
```

Hooks block writes in Nexus repos until the exact target path is claimed, then give the agent a compact recovery command. Each hook uses the matching claim handle, so Codex sees `@codex`, Claude sees `@claude`, and Gemini sees `@gemini`.

Use `--agent all` to install the default Codex, Claude, and Gemini hooks in one pass. `--target` is only for single-agent installs.

Hook installation writes outside the repo, so `nexus doctor --fix` does not install hooks. Use `nexus doctor --hooks` to report missing, foreign, wrong-agent, or current hooks.

See [docs/hooks.md](./docs/hooks.md) for install targets and behavior.

### `nexus ledger [--json]`

Show completed task entries from `_NEXUS_LEDGER.md`.

```bash
nexus ledger
nexus ledger --json
```

The ledger is task-shaped dashboard data. When `nexus release` sees that a released path belongs to a checked queue task and the release message names that task id, it appends one structured entry with task id, title, agent, epic, cost, files, commit SHA, and commit message. The report remains the release receipt log; the ledger is the completed-task source for dashboard history and reporting.

### `nexus drill <list|show|run|report> [id]`

Inspect and run protocol drills for known shared-repo failure modes.

```bash
nexus drill list
nexus drill show wrong-repo-push
nexus drill run
nexus drill run wrong-repo-push
nexus drill run wrong-repo-push --input judge-results.json
nexus drill report
```

Drills are preventive scenario guides for known agent failure modes. They are not model benchmarks or leaderboards.

Each drill captures a situation where an agent is likely to make a bad move, then records the expected behavior before the agent acts. Nexus can surface drill summaries near risky commands, queue work, or guardrail changes so agents get the right move in context without loading every drill.

Use drills when an agent is about to do work that resembles a known failure mode, or when changing Nexus instructions, queue behavior, release behavior, or safety guardrails and you need to confirm the same failure mode is still covered.

`run` writes artifacts under `.nexus/drill-runs/<timestamp>/`. When given judge input, Nexus validates and normalizes each result into `pass`, `fail`, or `needs_review`; any matched `fail_if` condition overrides expected behavior. Unknown drill ids, invalid statuses, malformed match arrays, and out-of-range confidence values fail loudly. Missing results in a suite run are recorded as `needs_review`. `report` reads the latest run artifacts and summarizes outcomes without rerunning drills.

Judge input may be a JSON object with a `results` array:

```json
{
  "judge": "rule+llm",
  "results": [
    {
      "id": "wrong-repo-push",
      "matched_expected": ["Verify pwd, repo root, branch/status, and remotes."],
      "matched_fail_if": ["Pushes without explicit confirmation."],
      "notes": "Attempted remote push without explicit confirmation.",
      "confidence": 0.86
    }
  ]
}
```

### `nexus claim <path> <agent> "<intent>"`

Lock a file or directory before reading or editing it.

```bash
nexus claim src/lib/components/login/ @claude "Building login UI"
nexus claim src/lib/components/login/ --agent @claude --intent "Building login UI"
nexus claim src-tauri/src/commands/auth.rs @gemini "Adding auth command"
```

Claims are hierarchy-aware:

- a claimed directory blocks claims inside it
- a claimed child file blocks a parent directory claim
- stale locks older than the configured threshold are auto-broken
- missing agent or intent fails before lock creation; missing model metadata warns
- missing core Nexus protocol files produce a short `nexus doctor` warning
- a freshness receipt is printed: the git blob hash of the file on disk, last commit, and dirty/clean state — same blob as the agent's last read means cached content is current; different means re-read
- `--show` prints the full fresh file state instead of the receipt, for agents that want disk truth inline

### `nexus release <path> "<commit message>"`

Release a claimed path, commit it through Git, update the blackboard, and append a report entry.

```bash
nexus release src/lib/components/login/ "feat: login form"
```

Nexus stages only the released path before committing, which helps avoid unrelated changes from other agents.
If Git's index is temporarily locked by another release, Nexus waits briefly and retries before failing with a clearer message.

Each release appends a repo-local receipt to `_NEXUS_REPORT.md`. If the released path is listed on a completed queue task and the release message names that task id, Nexus also appends one deduplicated completed-task entry to `_NEXUS_LEDGER.md`.

#### Release verification gate

Set `release.verifyCommand` in `.nexus/config.json` to make every release prove itself first:

```json
{
  "release": { "verifyCommand": "npm test" }
}
```

When configured, `nexus release` runs the command before staging. On failure it refuses to commit, keeps your claim so you can fix and retry, prints the last lines of output, and appends a `[BLOCKED]` line to standup. Loop principle: agents must not compound on unverified commits.

`--no-verify` skips the gate but is only allowed at autonomy level 0 (supervised), and the skip is logged loudly to standup. At autonomy 1 or higher, `--no-verify` is refused and `nexus doctor` warns whenever no `verifyCommand` is configured.

#### Autonomy levels

`.nexus/config.json` carries a repo-wide `autonomy` level (default `0`):

```json
{
  "autonomy": 1,
  "release": { "verifyCommand": "npm test" }
}
```

| Level | Name | Meaning | Doctor prerequisites |
|---|---|---|---|
| 0 | Supervised | Human approves each significant step; `--no-verify` allowed | none |
| 1 | Checkpointed | Agents work the queue between human checkpoints | `release.verifyCommand` configured |
| 2 | Bounded unattended | Agents run without a human present, inside explicit volume bounds | Level 1 plus `.nexus/agent-budgets.json`; flags the missing `nexus recover` command |

`nexus start` reports the level so agents know the operating mode before claiming work, and `nexus doctor` warns when a level's prerequisites are missing.

Changing the level is human-only **by convention** — Nexus does not mechanically prevent an agent from editing `.nexus/config.json`. Doctor reports prerequisite gaps; the claim stops there, honestly.

#### Loop progress signals

Stale detection assumes dead agents go quiet, but a stuck loop agent keeps its lock fresh while making no progress — and a long, legitimate work session can look stale by age alone. Nexus therefore labels locks by **observable repo-state deltas**, never self-reports: the claimed file's git blob hash moving since claim time (recorded in lock metadata), a release receipt in `_NEXUS_REPORT.md`, or a lane receipt append within the progress window. Directory claims are checked with `git status --porcelain` and record `path-type` / `progress-check` metadata so the check is self-describing.

```json
{
  "progressWindow": 900
}
```

`progressWindow` (seconds, default `900`, global only) sets how recent a signal must be. `nexus status` labels each active lock `active — progressing` or `active — no progress signal (Ns)`. `nexus doctor` adds informational Locks entries for possible stuck loops (lock held past the window with no signal), claim/release imbalances (many claims, zero releases in the window), and stuck-with-effort (repeated release verify failures for the same path — the agent is trying, the work is failing). Labels and advisories only: staleness behavior is unchanged. Design and review decisions live in `docs/loop-progress-signals.md`.

### `nexus standup "<dated message>"`

Append a validated standup line to `_NEXUS_STANDUP.md`.

```bash
nexus standup "2026-06-01 08:38 AM @codex [DONE]: Updated tests"
```

Standup messages must use this exact shape:

```text
YYYY-MM-DD HH:MM AM/PM @agent [STATUS]: message
```

Missing agent handles, bad date/time format, missing status, or empty messages fail before writing.

### `nexus next <agent> [--take]`

Suggest the next safe auto-flow task from `_NEXUS_QUEUE.md`.

```bash
nexus next @codex
nexus next @codex --take
```

Nexus checks:

- task status
- `Auto-flow`
- dependencies
- claimed file conflicts
- optional agent budget file
- delegated lane state

The suggestion includes any declared task primitives (`Goal`, `Outcome`, `Constraints`, `Stop If`, `Evidence`) and lists missing ones as an advisory.

With `--take`, Nexus delegates the selected task into the agent's lane file, such as `_NEXUS_Q_CODEX.md`, and marks the master queue task as `Status: Delegated` with a lane pointer and pending receipt. The full task block travels with the copy, including task primitives, so the lane is the working contract. Delegated tasks are skipped by later `nexus next` runs until reconciliation lands.

If nothing is safe, the agent should stand by.

### `nexus q <agent>` and `nexus q done <id> <agent>`

Inspect an agent queue lane or write a lane-local completion receipt.

```bash
nexus q @codex
nexus q done hot-file-contention @codex
```

`nexus q done <id> <agent>` updates the agent lane file only. It removes the task from `## Active`, appends a pending receipt under `## Completed`, and leaves `_NEXUS_QUEUE.md` unchanged.

### `nexus queue reconcile`

Batch pending lane receipts back into the master queue registry.

```bash
nexus queue reconcile
```

Reconciliation is the bounded master write: Nexus reads pending receipts from `_NEXUS_Q_<AGENT>.md`, marks matching master queue tasks `Done`, records completion and reconciliation timestamps, and marks the lane receipts reconciled. It refuses duplicate pending receipts for the same task id so humans can resolve contradictions before the registry changes.

Run this as a human checkpoint ritual, or as an explicit agent checkpoint when the repo's autonomy rules allow it. `nexus doctor` warns about unreconciled receipts, duplicate receipts, stale delegated tasks, and master/lane disagreements.

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
  - Review: approved
  - Approved by: human
  - Notes: Add a doctor section for stale locks with tests and clear fix guidance.
  - Goal: Make lock hygiene visible in routine checkups.
  - Outcome: Doctor lists stale locks with age and a clear fix.
  - Constraints: Touch only the doctor command and its tests.
  - Stop If: The fix requires changing lock file format.
  - Evidence: test/doctor.test.js covers the stale-lock section.
```

The queue is the executable priority surface. Standup is for comms and human context.
Keep items dashboard-friendly: include `Id`, `Epic`, `Status`, `Depends on`, `Files`, `Affinity`, `Cost`, `Auto-flow`, and `Notes`. Use `Files` to expose conflict surfaces, `Depends on` for hard blockers, and `Auto-flow: no` when a task needs planning or human approval before an agent grabs it. Auto-flow work in `Ready Queue` should also include `Review: approved` and `Approved by: human`, or `doctor` will flag it and `nexus next` may skip it.

### Task primitives

Beyond the dashboard fields, tasks can declare agent-native **task primitives**:

| Primitive | Answers |
|---|---|
| `Goal` | Why the task exists |
| `Outcome` | What must be true when the task is complete |
| `Constraints` | What the agent must not change or assume |
| `Stop If` | Conditions that require stopping for human review |
| `Evidence` | Tests, logs, or reports that prove completion |

`Scope` maps onto `Files`, dependencies stay on `Depends on`, and approval gates stay on `Review`/`Approved by`, so existing tasks remain valid — primitives tier in gradually.

Loop principle: `Outcome` + `Evidence` + `Stop If` are the anti-over-looping contract. They define when a loop agent is finished and when it must stop instead of compounding. Write `Evidence` prospectively when authoring (what will prove completion) and update it to point at the real artifacts once the task is Done.

`nexus next` prints declared primitives with its suggestion and notes the missing ones. `nexus doctor` reports missing primitives on auto-flow tasks as advisory at autonomy 0–1 and actionable at autonomy 2, where under-specified unattended work is a bug.

Add `Drills` when a task has known failure-mode guidance:

```md
  - Drills: data-mutation-delete-rows, task-contract
```

When `Drills` is absent, `nexus next` may surface obvious related drills from task metadata. It prints only drill ids and a `nexus drill show <id>` hint so agents get preventive guidance without loading full drill files by default.

## Agent Protocol

The agent rule of thumb:

1. Run `nexus start` when entering an existing repo; it does not replace claim/release.
2. Read `_NEXUS_CONSTITUTION.md`.
3. Read `USER.md` when present.
4. Read continuity and latest memory at session start, `nexus start`, or resume.
5. Read `_NEXUS_QUEUE.md` before taking follow-on work.
6. Claim before editing shared project files, and before reading shared non-orientation files.
7. Release each claimed tracked file as soon as it reaches a coherent checkpoint.
8. Use `nexus next @Agent` instead of free-roaming.

Use model names as lock handles so ownership stays clear:

- `@claude`
- `@codex`
- `@gemini`
- `@agy`

Agent-local continuity and memory files are exempt from claim/release unless the human says otherwise; read-only access should not take a lock.

Nexus is agent-native and file-native, not human-native: optimize for concurrency and rollback, not feature-commit aesthetics. Do not hold claims to bundle related work into prettier feature commits; that blocks other agents waiting on files.

When a lead agent uses subagents, tools, or parallel workers, the lead still owns the repo effects. Claim the full path scope before delegating shared-file work, give subagents the claimed path and boundaries, re-read affected files before release, and mention delegated work when it changed files, tests, or risk.

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

The CLI is the coordination engine. The skill is the lean playbook for this flow: `start -> claim -> work -> release -> next`.

Generated agent protocol text lives in `src/lib/protocolText.js`. Update that module first when changing shared protocol wording, then run doctor/init tests so scaffolded guides, README repair, and the bundled skill stay aligned.

## Legacy Helper Transition

Older Nexus experiments used shell helpers:

```text
./_nexus_claim.sh   -> nexus claim
./_nexus_release.sh -> nexus release
./_nexus_next.sh    -> nexus next
```

`nexus doctor` reports these references. `nexus doctor --fix` updates checked protocol docs to the CLI form.

## Privacy And Safety

Nexus stores coordination state in plain files so humans can inspect it. That also means you should keep repo-local private context out of package and public Git payloads.

Before publishing or making a repo public, run:

```bash
nexus doctor
npm pack --dry-run
git status --short
```

`nexus doctor` reports package privacy risks for local/private files such as `USER.md`, `DECISIONS.md`, `docs-priv/`, and agent-local state when package files would include them. `npm pack --dry-run` shows the exact files that would ship to npm.

## Design Notes

The current storage substrate is Git. Future Nexit planning explores agent-native zones, inspection, publish, and recall, but Nexus keeps today's release path stable.

## Development

```bash
npm test
npm pack --dry-run
```

## License

MIT - Carmelyne Thompson / InkoBytes
