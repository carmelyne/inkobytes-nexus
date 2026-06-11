export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const START_MARKER = '<!-- NEXUS-AGENT-PROTOCOL:START -->';
export const END_MARKER = '<!-- NEXUS-AGENT-PROTOCOL:END -->';
export const REQUIRED_CONTEXT_READ = 'Read continuity and latest memory at session start, `nexus start`, or resume.';
export const CONTINUITY_LEDGER_LINE = 'Compaction-safe session ledger. Read this first after context loss, restart, or fresh entry.';
export const SKILL_CONTEXT_GUARDRAIL = 'Continuity is the compaction-safe session ledger; latest memory is required startup/resume context.';
export const MEMORY_INDEX_GUARDRAIL = 'Memory indexes use monthly folders and newest-first Markdown links with one-line outcomes.';

export const CONTINUITY_TEMPLATE = `# CONTINUITY

${CONTINUITY_LEDGER_LINE}

Goal: Project setup
State: Planning

Now: Initial Nexus setup
Next: Confirm first task
Blockers: None
Decisions:
- Nexus manages swarm coordination
- Continuity and memories are agent-local
Files:
- _NEXUS_QUEUE.md
- _NEXUS_STANDUP.md
`;

export const MEMORY_INDEX_TEMPLATE = `# Memory Index

Newest first, max 10 visible entries.

Format:

- [YYYY-MM-DD-HHMM-topic](YYYY-Month/YYYY-MM-DD-HHMM-topic.md) - one-line outcome

Entries live in month folders from the start, for example:

- [2026-01-15-1030-project-setup](2026-January/2026-01-15-1030-project-setup.md) - initialized Nexus scaffolds
- [2026-02-01-0900-debug-session](2026-February/2026-02-01-0900-debug-session.md) - isolated the failing hook path

This keeps monthly review simple: ask an agent to read one month folder and summarize the Markdown files.

`;

export function currentMemoryMonthFolder(now = new Date()) {
  return `${now.getFullYear()}-${MONTH_NAMES[now.getMonth()]}`;
}

export function protocolBlock(agent) {
  return `${START_MARKER}

## Nexus Project Protocol

This project uses Nexus for multi-agent coordination.

### Start Here

1. Read \`_NEXUS_CONSTITUTION.md\`.
2. Read \`_NEXUS_QUEUE.md\` for executable priorities.
3. Read \`_NEXUS_STANDUP.md\` for comms, decisions, and completion notes.
4. Read \`USER.md\` if present for local human preferences.
5. Read \`${agent.continuity}\` for current session state.
6. Read \`${agent.memoryIndex}\` and the latest memory entry at session start, \`nexus start\`, or resume.

### Nexus Rules

- On compaction, resume, or a fresh turn, treat this file and the Nexus protocol as active requirements, not optional guidance.
- Claim before touching shared project files: \`nexus claim <path> @Agent "intent"\`.
- If a hook blocks reading, editing, committing, or releasing because a shared path is unclaimed, stop and claim the exact path. Do not bypass the hook with another tool, shell trick, cached content, or manual git command.
- Claim shared project files before editing. Claim before reading only when the file is outside the startup/orientation set or a hook explicitly requires it.
- Nexus is agent-native and file-native, not human-native: optimize for concurrency and rollback, not feature-commit aesthetics.
- Release each claimed file as soon as it reaches a coherent checkpoint.
- Never hold claims just to bundle a prettier feature commit; that blocks other agents.
- Release finished work through Nexus: \`nexus release <path> "commit message"\`.
- Use \`nexus next @Agent\` for the next safe queue task.
- Use \`nexus next @Agent --take\` when work should be delegated into an agent lane; it copies the full task block into \`_NEXUS_Q_<AGENT>.md\` and marks the master task delegated.
- Use \`nexus q @Agent\` to inspect an agent lane, and \`nexus q done <id> @Agent\` to write a lane-local receipt without mutating \`_NEXUS_QUEUE.md\`.
- Use \`nexus queue reconcile\` at a human checkpoint or explicit agent checkpoint to batch pending lane receipts back into \`_NEXUS_QUEUE.md\`.
- Treat \`_NEXUS_QUEUE.md\` as the registry during delegated work; active notes and done receipts live in the assigned lane until batch reconciliation. If \`nexus doctor\` reports unreconciled receipts, duplicate receipts, stale delegated tasks, or master/lane disagreement, inspect before reconciling.
- Do not free-roam into unassigned or \`Auto-flow: no\` work without user approval.
- Direct user instruction can override queue order, but not claim/release, data, security, or approval gates.
- If no safe task remains, announce \`Standby\` with what you are waiting for, then stop until user input, queue change, or explicit assignment.

### Current File State

- Treat previous chat context, cached model memory, and earlier reads as stale when file contents matter.
- Unclaimed orientation reads are limited to Nexus protocol, queue, standup, human preference, continuity, and memory files named in Start Here.
- Claim before reading implementation files, tests, docs, generated artifacts, or shared agent instruction files outside that orientation set.
- Before claiming what a file says, making edits, or judging current state, read the file from disk with a fresh command.
- Treat \`nexus claim\` as the atomic lock-and-read boundary and its output as fresh file state for the claimed path.
- If you read a shared file before claiming it, treat that read as stale after claim succeeds.
- If another agent or tool may have touched the file since your last read, re-read it before editing.
- If a claim appears stale, do not edit through it; run \`nexus status\` or \`nexus doctor\`, then clean only when ownership is clearly abandoned.

### Drills

Drill guidance is defined in \`_NEXUS_CONSTITUTION.md\`.
If the situation resembles a drill, use that drill before acting.

### Delegated Work

- Lead agents own the repo effects of their subagents, tools, and parallel workers.
- Claim the full path scope before delegating shared-file work.
- Give subagents the claimed path, intent, non-goals, and boundaries.
- Re-read affected files after subagent work before final edits, release, or current-state claims.
- Mention delegated work in release or \`nexus standup\` notes when it affected files, tests, or risk.

### Git Write Safety

- Before git writes, verify \`pwd\`, repo root, branch/status, and remotes.
- Stop if they do not match the requested project.
- Never infer from similar folder names or cached context.
- Require explicit confirmation before push/force-push, main/master, remote changes, or deletes.
- To remove private agent files from git, untrack them; do not delete local folders.
- Agent instruction files are shared protocol files; normal edits require claim/release, while \`nexus doctor --fix\` may update managed protocol blocks after user approval.
- Agents work inside assigned work zones. If a change crosses work-zone boundaries or alters a shared contract another zone may depend on, announce it in \`_NEXUS_STANDUP.md\` before release and ask if coordination is needed.

### Supply-Chain Safety

- Do not install third-party packages that have existed for less than 14 days.
- Before adding a new dependency, verify the package creation date and the specific version publish date.
- If the package or version is younger than 14 days, or either date cannot be verified, stop and ask the user.
- Run \`nexus doctor\` before installs; review any Security findings before running package scripts.
- \`nexus doctor\` is cheap, local, and idempotent.
- If \`nexus doctor\` reports Security, Package Privacy, Git Privacy, or supply-chain findings, stop and report before fixing or installing.
- Treat install hooks and scripts with network commands, webhooks, raw sockets, SSH, or secret-looking variables as human-review only.
- Prefer built-in runtime APIs and existing project dependencies when they fit.

### Agent-Local Files

\`${agent.continuity}\`, \`${agent.memoryIndex}\`, and files under \`${agent.memoryDir}/\` are agent-local handoff files.
They are exempt from Nexus claim/release unless the user says otherwise, and read-only access to them should not take a lock.

### Continuity Flow

- Continuity is the compaction-safe session ledger.
- On session start, read \`${agent.continuity}\` once and treat it as current state unless the user contradicts it.
- Write continuity only on task switch, blocker, checkpoint request, or session end.
- Replace the ledger instead of appending to it.
- In task replies, use a one-line status summary instead of echoing the full ledger.
- If the ledger is missing, stale, or lacks referenced context, ask once instead of guessing.

### Memory Flow

- On session start, \`nexus start\`, or resume, read \`${agent.memoryIndex}\`, then read the newest linked entry.
- Memory entries are session handoffs, not permanent system truth.
- Durable architecture and protocol decisions belong in \`DECISIONS.md\`; mention them in \`_NEXUS_STANDUP.md\` only when active agents need to coordinate around them.
- Write memory once per session, only when the user asks, or on session end, pause, or checkpoint request.
- When writing your own memory entry, create the current month folder under \`${agent.memoryDir}\` if it is missing.
- Do not create or repair other agents' memory folders manually; use \`nexus doctor --fix\` for broad scaffold repair.
- On session end, pause, or checkpoint request:
  1. Run \`nexus checkout @${agent.aliases[0]}\` to clear your presence heartbeat.
  2. Create one new memory file: \`${agent.memoryDir}/YYYY-Month/YYYY-MM-DD-HHMM-topic.md\`.
- Add the newest file to the top of \`${agent.memoryIndex}\` as a Markdown link plus one-line outcome.
- Keep the index to the 10 newest visible entries.
- For monthly review, read one month folder such as \`${agent.memoryDir}/2026-January/\` and summarize the Markdown files.

Memory entry format:

\`\`\`markdown
# YYYY-MM-DD - HH:MM - <topic>

## Session Summary
- What we worked on: [<=50 words]
- What got done: [bullet list, max 5]
- Where we stopped: [exact state, <=30 words]

## Next Session Needs
- Immediate next task: [<=20 words]
- Blockers: [None, or list]
- Open questions: [if any]

## Context to Carry
- Key decisions made: [max 3 bullets]
- Files touched: [max 5 paths]
- Gotchas/warnings: [anything next session should watch for]
\`\`\`

${END_MARKER}
`;
}

export function fullEntrypoint(agent) {
  return `# ${agent.label} Agent Guide

${protocolBlock(agent)}`;
}
