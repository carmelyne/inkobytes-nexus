/**
 * nexus init — scaffold Nexus files into the current repo
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import { AGENT_SCOPE_ENTRIES } from '../lib/agentScopes.js';
import { DEFAULT_MATRIX } from '../lib/permissions.js';
import {
  CONTINUITY_TEMPLATE,
  MEMORY_INDEX_TEMPLATE,
  currentMemoryMonthFolder,
  fullEntrypoint,
} from '../lib/protocolText.js';

const TEMPLATES = {
  '_NEXUS.md': '',
  'DECISIONS.md': `# Decisions

Local agent work decisions live here. This file is gitignored by Nexus.
`,

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
  - Review: approved
  - Approved by: human
  - Notes: Sample starter task — print a hello message from src/hello.js.

- [ ] TASK/Agent-2: Create the utils.js helper
  - Id: hello-utils
  - Epic: Hello World
  - Status: Ready
  - Depends on: none
  - Files: src/utils.js
  - Affinity: helpers
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: Sample starter task — add a small helper used by hello.js.

---

### 💬 Comms Log
*Rules: Append new entries at the bottom. One line per message. Use \`YYYY-MM-DD HH:MM AM/PM @agent [STATUS]: message\` so relevance is visible. Use 🧵 for long discussions.*
*Status examples: \`[DONE]\`, \`[READY]\`, \`[BLOCKED]\`, \`[NOTE]\`, \`[ASK]\`.*

`,

  '_NEXUS_REPORT.md': `# 📋 NEXUS REPORT
Repo-local release receipts and done-review notes live here.

Each \`nexus release\` appends a lightweight backup record:

\`\`\`markdown
Done claim:
- Changed:
- Validated:
- Risk:

Adversarial result:
- Pass, or:
- Finding:
\`\`\`

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
  - Review: approved
  - Approved by: human
  - Notes: Sample starter task — print a hello message from src/hello.js.

- [ ] TASK/Agent-2: Create the utils.js helper
  - Id: hello-utils
  - Epic: Hello World
  - Status: Ready
  - Depends on: none
  - Files: src/utils.js
  - Affinity: helpers
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: Sample starter task — add a small helper used by hello.js.
`,

  '_NEXUS_CHMOD.md': DEFAULT_MATRIX,

  '_NEXUS_CONSTITUTION.md': `# Nexus Swarm: Core Operating Protocol

Nexus is mandatory coordination for agents sharing a local repository.

## 1. Start With Doctor

When entering an existing Nexus repo, run:

\`\`\`bash
nexus doctor
\`\`\`

Use the cheap, local, idempotent report to notice missing protocol files, stale locks, missing continuity/memory scaffolds, and legacy helper references. Ask before running \`nexus doctor --fix\` unless the human already approved safe scaffold repair.

## 2. Queue First

Before choosing follow-on work, read \`_NEXUS_QUEUE.md\`.

- \`_NEXUS_QUEUE.md\` decides executable priority, dependencies, file scope, cost, and \`Auto-flow\`.
- \`_NEXUS_STANDUP.md\` is for comms, human context, decisions, and completion notes.
- \`USER.md\`, when present, is local-only human identity and preference context.
- If queue and standup conflict, follow the queue for what to work on, then use standup to explain or ask.
- Direct user instruction can override queue order, but not claim/release, data, security, or approval gates.
- If no explicit user task is given, run \`nexus next @Agent\` and only auto-claim returned work when \`Auto-flow: yes\`.

## 3. Approval Gate

If a queue item, standup note, or user instruction says to make a plan and get approval:

- stop before claiming implementation files
- present the plan in the terminal chat
- wait for explicit approval

## 4. Task Contract Guardrail

If a task lacks an explicit why, tradeoff, non-goal, and unacceptable interpretation, treat it as under-specified.

Before broad or destructive work, agents must restate:

- Why this task exists.
- What tradeoff is being accepted.
- What is explicitly out of scope.
- What interpretation would be unacceptable.

If any of those are missing or ambiguous and the task is broad, destructive, irreversible, security-sensitive, architecture-changing, or dependency-related, stop and ask before implementation.

## 5. Drill Guidance

Drills are preventive scenario guides for known agent failure modes. If a situation resembles a drill, use that drill to avoid the bad move before acting.

| Situation | Drill |
|---|---|
| Blocked or unsafe to proceed | \`drills/nexus-agent-protocol/cases/blocked.yaml\` |
| Found a bug, mismatch, suspicious behavior, or defect | \`drills/nexus-agent-protocol/cases/issue-found.yaml\` |
| Removing a dependency, service, framework, vendor, or integration | \`drills/nexus-agent-protocol/cases/removal-scope.yaml\` |
| Task is broad, destructive, irreversible, security-sensitive, architecture-changing, or dependency-related | \`drills/nexus-agent-protocol/cases/task-contract.yaml\` |
| Touching persisted data, fixtures, uploads, app caches, migrations, or ambiguous data terms | \`drills/nexus-agent-protocol/cases/data-mutation-delete-rows.yaml\` |

If no drill matches, continue with the smallest safe change.
If a referenced drill file is missing, continue from this constitution and use the smallest safe change; ask first if the task is risky.

## 6. Claim Granularity

Nexus supports two ownership levels:

- **Directory claim**: use for a self-contained module or component folder.
- **File claim**: use for standalone files, configs, stores, commands, or docs.

If a directory is claimed, no other agent may claim a file inside it. If a child file is claimed, another agent may not claim the parent directory.

If a claim appears stale, do not edit through it. Run \`nexus status\` or \`nexus doctor\`; use \`nexus clean --stale\` only when ownership is clearly abandoned, otherwise ask or report in standup.

## 7. Execution Loop

1. Select work from \`_NEXUS_QUEUE.md\` or \`nexus next @Agent\`.
2. Claim before reading or editing shared project files:

   \`\`\`bash
   nexus claim <path> @Agent "intent"
   \`\`\`

3. Treat \`nexus claim\` as the atomic lock-and-read boundary and claim output as current file state.
4. Do the scoped work only inside the claimed surface.
5. Release through Nexus:

   \`\`\`bash
   nexus release <path> "short commit message"
   \`\`\`

6. Add a short completion note with \`nexus standup "YYYY-MM-DD HH:MM AM/PM @agent [STATUS]: message"\` if useful.
7. Run \`nexus next @Agent\` or stand by.

## 8. Delegated Work

When a lead agent uses subagents, tools, or parallel workers, Nexus still treats the lead as accountable for repo state.

- Claim the full path scope before delegating work that may read or edit shared project files.
- Tell subagents the claimed path, intent, non-goals, and boundaries before they start.
- Subagents may help inspect, test, or draft changes, but they must not expand scope or touch unclaimed paths.
- After subagent work, the lead must re-read affected files before final edits, release, or claims about current state.
- The release or \`nexus standup\` note must mention delegated work when it affected repo files, tests, or risk.

Subagents can be an implementation detail; their repo effects cannot be invisible.

## 9. Current File State

- Treat previous chat context, cached model memory, and earlier reads as stale when file contents matter.
- Before claiming what a file says, making edits, or judging current state, read the file from disk with a fresh command.
- Treat \`nexus claim\` as the atomic lock-and-read boundary and its output as fresh file state for the claimed path.
- If you read a shared file before claiming it, treat that read as stale after claim succeeds.
- If another agent or tool may have touched the file since your last read, re-read it before editing.

## 10. Golden Rules

- Never modify shared project files without \`nexus claim\`.
- Never run \`git commit\` manually for claimed work; use \`nexus release\`.
- Never claim inside another agent's locked directory.
- Agent instruction files are shared protocol files; normal edits require claim/release, while \`nexus doctor --fix\` may update managed protocol blocks after user approval.
- Direct user instruction can override assignment, but not claim/release safety.
- Do not free-roam into \`Auto-flow: no\` work without approval.
- Agents work inside assigned work zones. If a change crosses work-zone boundaries or alters a shared contract another zone may depend on, announce it in \`_NEXUS_STANDUP.md\` before release and ask if coordination is needed.
- If no safe task remains, announce \`Standby\` with what you are waiting for, then stop until user input, queue change, or explicit assignment.
- A small safe change does not alter exported type signatures, public APIs, auth, billing, permissions, data schema, migrations, dependency graph, or cross-agent ownership boundaries.

## 11. Root-Cause Guardrails

- Prefer root-cause fixes over workaround paths.
- When removing a dependency, service, framework, or vendor, remove only project-owned integrations that are explicitly in scope.
- Treat third-party package internals, lockfiles, generated files, build output, and dependency trees as evidence to report, not permission to remove the package.
- If removing the target would delete or disable an unported feature, stop and ask whether to port it first or remove it.
- Treat persisted data as state, not an ordinary code artifact.
- Do not write, delete, reset, reseed, migrate, or alter data without explicit operation-level approval.
- Before data mutation, state the target environment, affected data, exact command or code path, expected effect, and rollback plan.
- Clarify ambiguous terms such as table, row, header, column, clean up, reset, remove, old, stale, or unused before mutating data.
- Never rewrite historical records just to make current code cleaner.
- For every non-obvious architectural or organizational decision, add a short entry to \`DECISIONS.md\` with:
  - decision
  - reason
  - tradeoff
  - files affected
- Do not agree reflexively with Pong. Flag technical flaws, hidden costs, security risks, or simpler alternatives plainly and respectfully.
- Use \`DECISIONS.md\` for durable architecture and protocol decisions; use memory files for session handoff, not permanent system truth.
- Mention a decision in \`_NEXUS_STANDUP.md\` only when active agents need to coordinate around it.
- Do not use standup as the permanent decision ledger.

## 12. Supply-Chain Safety

- Do not install third-party packages that have existed for less than 14 days.
- Before adding a new dependency, verify the package creation date and the specific version publish date.
- If the package or version is younger than 14 days, or either date cannot be verified, stop and ask the human.
- Treat install hooks and scripts with network commands, webhooks, raw sockets, SSH, or secret-looking variables as human-review only.

## 13. Agent-Local Files

Continuity and memory files are agent-local handoff state. They are exempt from claim/release unless the human says otherwise.

## 14. Legacy Helper Transition

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
DECISIONS.md
docs-priv/
.nexus/locks/
.nexus/presence/
*.lockdir
*.flock
`;


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
  for (const [, scaffold] of AGENT_SCOPE_ENTRIES) {
    const agentDir = scaffold.dir;
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
      writeFileSync(entrypointPath, fullEntrypoint(scaffold), 'utf-8');
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
