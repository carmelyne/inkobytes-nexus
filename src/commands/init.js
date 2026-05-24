/**
 * nexus init — scaffold Nexus files into the current repo
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';

const TEMPLATES = {
  '_NEXUS.md': '',

  '_NEXUS_STANDUP.md': `# 🎯 NEXUS SWARM HQ

## 📋 The Board
*Rules: Only work on tasks tagged with your @handle. Claim files with \`nexus claim\` before coding.*

### Epics (High Level)

- [ ] EPIC: Build a Hello World app
  - Status: Approved
  - Owner: @You
  - Assignments:
    - @Agent-1 → src/hello.js (main entry point)
    - @Agent-2 → src/utils.js (helper functions)
  - Owner comment: Keep it simple. One file each, no overlap.

## Runways

- @Agent-1: Hello World -> next assigned epic
- @Agent-2: Hello World -> next assigned epic

## Ready Queue

- [ ] TASK/Agent-1: Create the main hello.js entry point
  - Id: hello-main
  - Epic: Hello World
  - Status: Ready
  - Depends on: none
  - Files: src/hello.js
  - Affinity: entry-point
  - Cost: small
  - Auto-flow: yes

- [ ] TASK/Agent-2: Create the utils.js helper
  - Id: hello-utils
  - Epic: Hello World
  - Status: Ready
  - Depends on: none
  - Files: src/utils.js
  - Affinity: helpers
  - Cost: small
  - Auto-flow: yes

---

### 💬 Comms Log
*Rules: Append new entries at the bottom. One line per message. Use 🧵 for long discussions.*

`,

  '_NEXUS_REPORT.md': `# 📋 NEXUS REPORT
*Auto-generated. Do not edit manually.*

`,

  '_NEXUS_QUEUE.md': `# 🚀 NEXUS QUEUE

## Runways

- @Agent-1: Hello World -> next assigned epic
- @Agent-2: Hello World -> next assigned epic

## Ready Queue

- [ ] TASK/Agent-1: Create the main hello.js entry point
  - Id: hello-main
  - Epic: Hello World
  - Status: Ready
  - Depends on: none
  - Files: src/hello.js
  - Affinity: entry-point
  - Cost: small
  - Auto-flow: yes

- [ ] TASK/Agent-2: Create the utils.js helper
  - Id: hello-utils
  - Epic: Hello World
  - Status: Ready
  - Depends on: none
  - Files: src/utils.js
  - Affinity: helpers
  - Cost: small
  - Auto-flow: yes
`,

  '_NEXUS_CONSTITUTION.md': `# Nexus Swarm: Core Operating Protocol

Nexus is mandatory coordination for agents sharing a local repository.

## 1. Start With Doctor

When entering an existing Nexus repo, run:

\`\`\`bash
nexus doctor
\`\`\`

Use the report to notice missing protocol files, stale locks, missing continuity/memory scaffolds, and legacy helper references. Ask before running \`nexus doctor --fix\` unless the human already approved safe scaffold repair.

## 2. Queue First

Before choosing follow-on work, read \`_NEXUS_QUEUE.md\`.

- \`_NEXUS_QUEUE.md\` decides executable priority, dependencies, file scope, cost, and \`Auto-flow\`.
- \`_NEXUS_STANDUP.md\` is for comms, human context, decisions, and completion notes.
- If queue and standup conflict, follow the queue for what to work on, then use standup to explain or ask.
- If no explicit user task is given, run \`nexus next @Agent\` and only auto-claim returned work when \`Auto-flow: yes\`.

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

1. Select work from \`_NEXUS_QUEUE.md\` or \`nexus next @Agent\`.
2. Claim before reading or editing shared project files:

   \`\`\`bash
   nexus claim <path> @Agent "intent"
   \`\`\`

3. Treat claim output as fresh file truth.
4. Do the scoped work only inside the claimed surface.
5. Release through Nexus:

   \`\`\`bash
   nexus release <path> "short commit message"
   \`\`\`

6. Add a short completion note to standup if useful.
7. Run \`nexus next @Agent\` or stand by.

## 6. Golden Rules

- Never modify shared project files without \`nexus claim\`.
- Never run \`git commit\` manually for claimed work; use \`nexus release\`.
- Never claim inside another agent's locked directory.
- Direct user instruction can override assignment, but not claim/release safety.
- Do not free-roam into \`Auto-flow: no\` work without approval.
- If no safe task remains, announce \`Standby\`.

## 7. Supply-Chain Safety

- Do not install third-party packages that have existed for less than 14 days.
- Before adding a new dependency, verify its package registry creation date.
- If the package is younger than 14 days or the age cannot be verified, stop and ask Pong.
- Run \`nexus doctor\` before installs; review any Security findings before running package scripts.
- Treat install hooks and scripts with network commands, webhooks, raw sockets, SSH, or secret-looking variables as human-review only.
- Prefer built-in runtime APIs and existing project dependencies when they fit.

## 8. Agent-Local Files

Continuity and memory files are agent-local handoff state. They are exempt from claim/release unless the human says otherwise.

## 9. Legacy Helper Transition

Older repos may mention shell helpers:

\`\`\`text
./_nexus_claim.sh   -> nexus claim
./_nexus_release.sh -> nexus release
./_nexus_next.sh    -> nexus next
\`\`\`

Prefer the \`nexus\` CLI commands. \`nexus doctor\` reports legacy references.
`,
};

const GITIGNORE_ENTRY = `
# Nexus Swarm Stack
.DS_Store
.nexus/locks/
*.lockdir
*.flock
`;

const AGENT_SCAFFOLDS = {
  '.codex': {
    label: 'Codex',
    entrypoint: '.codex/AGENTS.md',
    continuity: '.codex/CONTINUITY.md',
    memoryIndex: '.codex/memories/INDEX.md',
    memoryDir: '.codex/memories',
  },
  '.claude': {
    label: 'Claude',
    entrypoint: '.claude/CLAUDE.md',
    continuity: '.claude/CONTINUITY.md',
    memoryIndex: '.claude/memories/INDEX.md',
    memoryDir: '.claude/memories',
  },
  '.gemini': {
    label: 'Gemini',
    entrypoint: '.gemini/GEMINI.md',
    continuity: '.gemini/CONTINUITY.md',
    memoryIndex: '.gemini/memories/INDEX.md',
    memoryDir: '.gemini/memories',
  },
};

const CONTINUITY_TEMPLATE = `# CONTINUITY
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

const MEMORY_INDEX_TEMPLATE = `# Memory Index

Newest first, max 10 visible entries.

Format:

- YYYY-Month/YYYY-MM-DD-HHMM-topic.md - short session label

Entries live in month folders from the start, for example:

- \`2026-January/2026-01-15-1030-project-setup.md\`
- \`2026-February/2026-02-01-0900-debug-session.md\`

This keeps monthly review simple: ask an agent to read one month folder and summarize the Markdown files.

`;

const MONTH_NAMES = [
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

const START_MARKER = '<!-- NEXUS-AGENT-PROTOCOL:START -->';
const END_MARKER = '<!-- NEXUS-AGENT-PROTOCOL:END -->';

function currentMemoryMonthFolder(now = new Date()) {
  return `${now.getFullYear()}-${MONTH_NAMES[now.getMonth()]}`;
}

function agentEntrypointTemplate(scaffold) {
  return `# ${scaffold.label} Agent Guide

${START_MARKER}

## Nexus Project Protocol

This project uses Nexus for multi-agent coordination.

### Start Here

1. Read \`_NEXUS_CONSTITUTION.md\`.
2. Read \`_NEXUS_QUEUE.md\` for executable priorities.
3. Read \`_NEXUS_STANDUP.md\` for comms, decisions, and completion notes.
4. Read \`${scaffold.continuity}\` for current session state.
5. Read \`${scaffold.memoryIndex}\` and the latest memory entry when resync is needed.

### Nexus Rules

- Claim before editing shared project files: \`nexus claim <path> @Agent "intent"\`.
- Release finished work through Nexus: \`nexus release <path> "commit message"\`.
- Use \`nexus next @Agent\` for the next safe queue task.
- Do not free-roam into unassigned or \`Auto-flow: no\` work without Pong approval.

### Fresh File Truth

- Treat previous chat context, cached model memory, and earlier reads as stale when file contents matter.
- Before claiming what a file says, making edits, or judging current state, read the file from disk with a fresh command.
- Treat \`nexus claim\` output as fresh file state for the claimed path.
- If another agent or tool may have touched the file since your last read, re-read it before editing.

### Supply-Chain Safety

- Do not install third-party packages that have existed for less than 14 days.
- Before adding a new dependency, verify its package registry creation date.
- If the package is younger than 14 days or the age cannot be verified, stop and ask Pong.
- Run \`nexus doctor\` before installs; review any Security findings before running package scripts.
- Treat install hooks and scripts with network commands, webhooks, raw sockets, SSH, or secret-looking variables as human-review only.
- Prefer built-in runtime APIs and existing project dependencies when they fit.

### Agent-Local Files

\`${scaffold.continuity}\` and \`${scaffold.memoryIndex}\` are agent-local handoff files.
They are exempt from Nexus claim/release unless Pong says otherwise.

### Memory Flow

- On session start, read \`${scaffold.memoryIndex}\`.
- If the index has entries, read the newest \`${scaffold.memoryDir}/YYYY-Month/YYYY-MM-DD-HHMM-topic.md\` entry.
- On session end, pause, or checkpoint request, create one new memory file:
  \`${scaffold.memoryDir}/YYYY-Month/YYYY-MM-DD-HHMM-topic.md\`.
- Add the newest file to the top of \`${scaffold.memoryIndex}\`.
- Keep the index to the 10 newest visible entries.
- For monthly review, read one month folder such as \`${scaffold.memoryDir}/2026-January/\` and summarize the Markdown files.

Memory entry format:

\`\`\`markdown
# YYYY-MM-DD — HH:MM — <topic>

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

export default function init(args) {
  const root = cwd();

  // Create .nexus directory
  const nexusDir = join(root, '.nexus');
  const locksDir = join(nexusDir, 'locks');

  if (!existsSync(nexusDir)) {
    mkdirSync(nexusDir, { recursive: true });
    console.log('  Created .nexus/');
  }

  if (!existsSync(locksDir)) {
    mkdirSync(locksDir, { recursive: true });
    console.log('  Created .nexus/locks/');
  }

  // Create agent-local continuity and memory scaffolds.
  // These files are exempt from Nexus claim/release because they are session-local handoff state.
  let agentFilesCreated = 0;
  for (const [agentDir, scaffold] of Object.entries(AGENT_SCAFFOLDS)) {
    const baseDir = join(root, agentDir);
    const memoryDir = join(root, scaffold.memoryDir);
    const memoryMonthDir = join(memoryDir, currentMemoryMonthFolder());
    const continuityPath = join(root, scaffold.continuity);
    const memoryIndexPath = join(root, scaffold.memoryIndex);

    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
      console.log(`  Created ${agentDir}/`);
    }

    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true });
      console.log(`  Created ${scaffold.memoryDir}/`);
    }

    if (!existsSync(memoryMonthDir)) {
      mkdirSync(memoryMonthDir, { recursive: true });
      console.log(`  Created ${scaffold.memoryDir}/${currentMemoryMonthFolder()}/`);
    }

    if (existsSync(continuityPath)) {
      console.log(`  ⏭  ${scaffold.continuity} (already exists)`);
    } else {
      writeFileSync(continuityPath, CONTINUITY_TEMPLATE, 'utf-8');
      console.log(`  ✅ ${scaffold.continuity}`);
      agentFilesCreated++;
    }

    if (existsSync(memoryIndexPath)) {
      console.log(`  ⏭  ${scaffold.memoryIndex} (already exists)`);
    } else {
      writeFileSync(memoryIndexPath, MEMORY_INDEX_TEMPLATE, 'utf-8');
      console.log(`  ✅ ${scaffold.memoryIndex}`);
      agentFilesCreated++;
    }

    const entrypointPath = join(root, scaffold.entrypoint);
    if (existsSync(entrypointPath)) {
      console.log(`  ⏭  ${scaffold.entrypoint} (already exists)`);
    } else {
      writeFileSync(entrypointPath, agentEntrypointTemplate(scaffold), 'utf-8');
      console.log(`  ✅ ${scaffold.entrypoint}`);
      agentFilesCreated++;
    }
  }

  // Create markdown files (skip if they exist)
  let created = 0;
  for (const [filename, content] of Object.entries(TEMPLATES)) {
    const filePath = join(root, filename);
    if (existsSync(filePath)) {
      console.log(`  ⏭  ${filename} (already exists)`);
    } else {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`  ✅ ${filename}`);
      created++;
    }
  }

  // Append to .gitignore if needed
  const gitignorePath = join(root, '.gitignore');
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (!content.includes('.nexus/locks/')) {
      writeFileSync(gitignorePath, content + GITIGNORE_ENTRY, 'utf-8');
      console.log('  ✅ Updated .gitignore');
    }
  } else {
    writeFileSync(gitignorePath, GITIGNORE_ENTRY.trim() + '\n', 'utf-8');
    console.log('  ✅ Created .gitignore');
  }

  console.log(`\n🐝 Nexus initialized. ${created} Nexus files created, ${agentFilesCreated} agent session files created.`);
  console.log('   Next steps:');
  console.log('   1. Copy _NEXUS_CONSTITUTION.md into your agent configs (CLAUDE.md, AGENTS.md, etc.)');
  console.log('   2. Add epics to _NEXUS_STANDUP.md');
  console.log('   3. Start claiming.\n');
}
