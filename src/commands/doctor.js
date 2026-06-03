/**
 * nexus doctor - inspect and repair agent protocol scaffolds in existing repos
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import { spawnSync } from 'child_process';
import { listLocks } from '../lib/lockManager.js';
import { getConfig } from '../lib/config.js';
import { AGENT_SCOPE_LIST } from '../lib/agentScopes.js';
import { DEFAULT_MATRIX, loadPermissions, getChmodPath } from '../lib/permissions.js';

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

const LOCAL_DECISIONS_TEMPLATE = `# Decisions

Local agent work decisions live here. This file is gitignored by Nexus.
`;

const LOCAL_GITIGNORE_LINES = ['DECISIONS.md', 'docs-priv/', '.nexus/presence/'];
const STANDUP_FORMAT_GUIDANCE = 'YYYY-MM-DD HH:MM AM/PM @agent [STATUS]: message';
const STANDUP_RULES_LINE = `*Rules: Append new entries at the bottom. One line per message. Use \`${STANDUP_FORMAT_GUIDANCE}\` so relevance is visible. Use 🧵 for long discussions.*`;

const MEMORY_INDEX_TEMPLATE = `# Memory Index

Newest first, max 10 visible entries.

Format:

- YYYY-Month/YYYY-MM-DD-HHMM-topic.md - short session label

Entries live in month folders from the start, for example:

- \`2026-January/2026-01-15-1030-project-setup.md\`
- \`2026-February/2026-02-01-0900-debug-session.md\`

This keeps monthly review simple: ask an agent to read one month folder and summarize the Markdown files.

`;

function currentMemoryMonthFolder(now = new Date()) {
  return `${now.getFullYear()}-${MONTH_NAMES[now.getMonth()]}`;
}

function protocolBlock(agent) {
  return `${START_MARKER}

## Nexus Project Protocol

This project uses Nexus for multi-agent coordination.

### Start Here

1. Read \`_NEXUS_CONSTITUTION.md\`.
2. Read \`_NEXUS_QUEUE.md\` for executable priorities.
3. Read \`_NEXUS_STANDUP.md\` for comms, decisions, and completion notes.
4. Read \`USER.md\` if present for local human preferences.
5. Read \`${agent.continuity}\` for current session state.
6. Read \`${agent.memoryIndex}\` and the latest memory entry when resync is needed.

### Nexus Rules

- Claim before editing shared project files: \`nexus claim <path> @Agent "intent"\`.
- Nexus is agent-native and file-native, not human-native: optimize for concurrency and rollback, not feature-commit aesthetics.
- Release each claimed file as soon as it reaches a coherent checkpoint.
- Never hold claims just to bundle a prettier feature commit; that blocks other agents.
- Release finished work through Nexus: \`nexus release <path> "commit message"\`.
- Use \`nexus next @Agent\` for the next safe queue task.
- Do not free-roam into unassigned or \`Auto-flow: no\` work without user approval.
- Direct user instruction can override queue order, but not claim/release, data, security, or approval gates.
- If no safe task remains, announce \`Standby\` with what you are waiting for, then stop until user input, queue change, or explicit assignment.

### Current File State

- Treat previous chat context, cached model memory, and earlier reads as stale when file contents matter.
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

\`${agent.continuity}\` and \`${agent.memoryIndex}\` are agent-local handoff files.
They are exempt from Nexus claim/release unless the user says otherwise.

### Memory Flow

- On session start, read \`${agent.memoryIndex}\`.
- If the index has entries, read the newest \`${agent.memoryDir}/YYYY-Month/YYYY-MM-DD-HHMM-topic.md\` entry.
- Durable architecture and protocol decisions belong in \`DECISIONS.md\`; mention them in \`_NEXUS_STANDUP.md\` only when active agents need to coordinate around them.
- Memory entries are session handoffs.
- When writing your own memory entry, create the current month folder under \`${agent.memoryDir}\` if it is missing.
- Do not create or repair other agents' memory folders manually; use \`nexus doctor --fix\` for broad scaffold repair.
- On session end, pause, or checkpoint request:
  1. Run \`nexus checkout @${agent.aliases[0]}\` to clear your presence heartbeat.
  2. Create one new memory file: \`${agent.memoryDir}/YYYY-Month/YYYY-MM-DD-HHMM-topic.md\`.
- Add the newest file to the top of \`${agent.memoryIndex}\`.
- Keep the index to the 10 newest visible entries.
- For monthly review, read one month folder such as \`${agent.memoryDir}/2026-January/\` and summarize the Markdown files.

Memory entry format:

\`\`\`markdown
# YYYY-MM-DD-HHMM - <topic>

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

function fullEntrypoint(agent) {
  return `# ${agent.label} Agent Guide

${protocolBlock(agent)}`;
}

function upsertProtocolBlock(content, block) {
  const cleanContent = removeUnmanagedProtocolBlock(content);
  const start = cleanContent.indexOf(START_MARKER);
  const end = cleanContent.indexOf(END_MARKER);

  if (start !== -1 && end !== -1 && end > start) {
    const before = cleanContent.slice(0, start).trimEnd();
    const after = cleanContent.slice(end + END_MARKER.length).trimStart();
    return `${before}\n\n${block.trim()}\n${after ? `\n${after}` : ''}`;
  }

  const unmanagedRange = findUnmanagedProtocolRange(cleanContent);
  if (unmanagedRange) {
    const before = cleanContent.slice(0, unmanagedRange.start).trimEnd();
    const after = cleanContent.slice(unmanagedRange.end).trimStart();
    return `${before}\n\n${block.trim()}\n${after ? `\n${after}` : ''}`;
  }

  return `${cleanContent.trimEnd()}\n\n${block.trim()}\n`;
}

function findUnmanagedProtocolRange(content) {
  const protocolIntro = 'This project uses Nexus for multi-agent coordination.';
  let searchFrom = 0;

  const unmanagedMarkers = [
    '\n## Start Here',
    '\n## Nexus Rules',
    '\n## Supply-Chain Safety',
    '\n## Agent-Local Files',
    '\n## Memory Flow',
    'Memory entry format:',
  ];

  while (searchFrom < content.length) {
    const start = content.indexOf(protocolIntro, searchFrom);
    if (start === -1) return null;

    const nextManagedBlock = content.indexOf(START_MARKER, start);
    const sectionEnd = nextManagedBlock === -1 ? content.length : nextManagedBlock;
    const section = content.slice(start, sectionEnd);
    if (!unmanagedMarkers.every((marker) => section.includes(marker))) {
      searchFrom = start + protocolIntro.length;
      continue;
    }

    const memoryFormatStart = content.indexOf('Memory entry format:', start);
    if (memoryFormatStart === -1 || memoryFormatStart > sectionEnd) {
      searchFrom = start + protocolIntro.length;
      continue;
    }

    const codeFenceStart = content.indexOf('```markdown', memoryFormatStart);
    if (codeFenceStart === -1 || codeFenceStart > sectionEnd) {
      searchFrom = start + protocolIntro.length;
      continue;
    }

    const codeFenceEnd = content.indexOf('\n```', codeFenceStart + '```markdown'.length);
    if (codeFenceEnd === -1 || codeFenceEnd > sectionEnd) {
      searchFrom = start + protocolIntro.length;
      continue;
    }

    return {
      start,
      end: codeFenceEnd + '\n```'.length,
    };
  }

  return null;
}

function hasUnmanagedProtocolBlock(content) {
  return findUnmanagedProtocolRange(content) !== null;
}

function hasCurrentManagedProtocolBlock(content, block) {
  const start = content.indexOf(START_MARKER);
  const end = content.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end <= start) return false;

  const existingBlock = content.slice(start, end + END_MARKER.length).trim();
  return existingBlock === block.trim();
}

function removeUnmanagedProtocolBlock(content) {
  const unmanagedRange = findUnmanagedProtocolRange(content);
  if (!unmanagedRange) return content;

  const before = content.slice(0, unmanagedRange.start).trimEnd();
  const after = content.slice(unmanagedRange.end).trimStart();
  return `${before}${before && after ? '\n\n' : ''}${after}`;
}

function ensureDir(path, fix, changes) {
  if (existsSync(path)) return true;
  if (!fix) return false;
  mkdirSync(path, { recursive: true });
  changes.push(`created ${path}`);
  return true;
}

function ensureFile(path, content, fix, changes) {
  if (existsSync(path)) return true;
  if (!fix) return false;
  writeFileSync(path, content, 'utf-8');
  changes.push(`created ${path}`);
  return true;
}

function ensureGitignoreLines(root, lines, fix, changes) {
  const path = join(root, '.gitignore');
  const existing = existsSync(path) ? readFileSync(path, 'utf-8') : '';
  const missing = lines.filter((line) => !existing.split(/\r?\n/).includes(line));
  if (missing.length === 0) return true;
  if (!fix) return false;

  const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
  const heading = existing.includes('# Nexus local state') ? '' : `${prefix}# Nexus local state\n`;
  const next = `${existing}${heading}${missing.join('\n')}\n`;
  writeFileSync(path, next, 'utf-8');
  changes.push('updated .gitignore');
  return true;
}

function repairStandupGuidance(content) {
  if (content.includes(STANDUP_FORMAT_GUIDANCE)) return content;

  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const rulesIndex = lines.findIndex((line) => line.includes('*Rules:') && line.includes('@agent'));

  if (rulesIndex !== -1) {
    lines[rulesIndex] = STANDUP_RULES_LINE;
    return lines.join(newline);
  }

  const firstHeadingIndex = lines.findIndex((line) => line.trim().startsWith('#'));
  if (firstHeadingIndex !== -1) {
    lines.splice(firstHeadingIndex + 1, 0, '', STANDUP_RULES_LINE);
    return lines.join(newline);
  }

  const trimmed = content.trimEnd();
  return `${trimmed}${trimmed ? `${newline}${newline}` : ''}${STANDUP_RULES_LINE}${newline}`;
}

export default function doctor(args) {
  const fix = args.includes('--fix');
  const json = args.includes('--json');
  const root = cwd();
  const colors = createColors();
  const sections = {
    'Nexus Files': [],
    'Agent Instructions': [],
    Security: [],
    'Package Privacy': [],
    'Git Privacy': [],
    'Legacy Helpers': [],
    Continuity: [],
    Memories: [],
    Locks: [],
    'Generated Artifacts': [],
    promptCHMOD: [],
    'Queue Authorship': [],
  };
  const changes = [];
  const config = getConfig(root);

  if (!json) {
    console.log(colors.bold(colors.cyan(`Nexus doctor${fix ? ' --fix' : ''}`)));
    console.log(`${colors.dim('Repo:')} ${root}\n`);
  }

  const nexusProtocolFiles = ['_NEXUS_CONSTITUTION.md', '_NEXUS_QUEUE.md', '_NEXUS_STANDUP.md'];
  const legacyCheckFiles = [
    ...nexusProtocolFiles,
    '.agy/AGENTS.md',
    '.codex/AGENTS.md',
    '.claude/CLAUDE.md',
    '.gemini/GEMINI.md',
  ];

  for (const file of nexusProtocolFiles) {
    if (!existsSync(join(root, file))) {
      sections['Nexus Files'].push({
        issue: `Missing ${file}`,
        fix: 'Run `nexus init` or restore the Nexus protocol files.',
      });
    }
  }

  const standupPath = join(root, '_NEXUS_STANDUP.md');
  if (existsSync(standupPath)) {
    const existing = readFileSync(standupPath, 'utf-8');
    const next = repairStandupGuidance(existing);
    if (next !== existing) {
      if (fix) {
        writeFileSync(standupPath, next, 'utf-8');
        changes.push('updated _NEXUS_STANDUP.md date guidance');
      } else {
        sections['Nexus Files'].push({
          issue: '_NEXUS_STANDUP.md is missing standard dated AM/PM message guidance',
          fix: 'Run `nexus doctor --fix`.',
        });
      }
    }
  }

  for (const issue of scanPackageSecurity(root)) {
    sections.Security.push(issue);
  }

  for (const issue of scanPackagePrivacy(root)) {
    sections['Package Privacy'].push(issue);
  }

  for (const issue of scanGitPrivacy(root, config)) {
    sections['Git Privacy'].push(issue);
  }

  for (const issue of scanGeneratedArtifacts(root)) {
    sections['Generated Artifacts'].push(issue);
  }

  if (!ensureFile(join(root, 'DECISIONS.md'), LOCAL_DECISIONS_TEMPLATE, fix, changes)) {
    sections['Nexus Files'].push({
      issue: 'Missing local DECISIONS.md',
      fix: 'Run `nexus doctor --fix`.',
    });
  }

  if (!ensureGitignoreLines(root, LOCAL_GITIGNORE_LINES, fix, changes)) {
    sections['Git Privacy'].push({
      issue: '.gitignore is missing Nexus local state entries',
      fix: 'Run `nexus doctor --fix`.',
    });
  }

  for (const agent of AGENT_SCOPE_LIST) {
    const memoryDir = join(root, agent.memoryDir);
    const monthDir = join(memoryDir, currentMemoryMonthFolder());
    const continuityPath = join(root, agent.continuity);
    const memoryIndexPath = join(root, agent.memoryIndex);
    const entrypointPath = join(root, agent.entrypoint);

    if (!ensureDir(join(root, agent.entrypoint.split('/')[0]), fix, changes)) {
      sections['Agent Instructions'].push({
        issue: `Missing ${agent.entrypoint.split('/')[0]}/`,
        fix: 'Run `nexus doctor --fix`.',
      });
    }

    if (!ensureDir(memoryDir, fix, changes)) {
      sections.Memories.push({
        issue: `Missing ${agent.memoryDir}/`,
        fix: 'Run `nexus doctor --fix`.',
      });
    }

    if (!ensureDir(monthDir, fix, changes)) {
      sections.Memories.push({
        issue: `Missing ${agent.memoryDir}/${currentMemoryMonthFolder()}/`,
        fix: 'Run `nexus doctor --fix`.',
      });
    }

    if (!ensureFile(continuityPath, CONTINUITY_TEMPLATE, fix, changes)) {
      sections.Continuity.push({
        issue: `Missing ${agent.continuity}`,
        fix: 'Run `nexus doctor --fix`.',
      });
    }

    if (!ensureFile(memoryIndexPath, MEMORY_INDEX_TEMPLATE, fix, changes)) {
      sections.Memories.push({
        issue: `Missing ${agent.memoryIndex}`,
        fix: 'Run `nexus doctor --fix`.',
      });
    }

    if (!existsSync(entrypointPath)) {
      if (fix) {
        writeFileSync(entrypointPath, fullEntrypoint(agent), 'utf-8');
        changes.push(`created ${agent.entrypoint}`);
      } else {
        sections['Agent Instructions'].push({
          issue: `Missing ${agent.entrypoint}`,
          fix: 'Run `nexus doctor --fix`.',
        });
      }
      continue;
    }

    const existing = readFileSync(entrypointPath, 'utf-8');
    const hasProtocol = existing.includes(START_MARKER) && existing.includes(END_MARKER);
    const hasMemoryFlow = existing.includes('YYYY-Month/YYYY-MM-DD-HHMM-topic.md');
    const hasContinuity = existing.includes(agent.continuity);
    const hasSupplyChainSafety = existing.includes('third-party packages that have existed for less than 14 days');
    const hasUnmanagedDuplicate = hasProtocol && hasUnmanagedProtocolBlock(existing);
    const hasCurrentProtocol = hasCurrentManagedProtocolBlock(existing, protocolBlock(agent));

    if (!hasProtocol || !hasMemoryFlow || !hasContinuity || !hasSupplyChainSafety || hasUnmanagedDuplicate || !hasCurrentProtocol) {
      if (fix) {
        const next = upsertProtocolBlock(existing, protocolBlock(agent));
        writeFileSync(entrypointPath, next, 'utf-8');
        changes.push(`updated ${agent.entrypoint}`);
      } else {
        sections['Agent Instructions'].push({
          issue: `${agent.entrypoint} needs Nexus protocol block update`,
          fix: 'Run `nexus doctor --fix`.',
        });
      }
    }
  }

  const locks = listLocks();
  const staleLocks = locks.filter((lock) => lock.age !== null && lock.age >= config.staleThreshold);
  const freshLocks = locks.filter((lock) => lock.age === null || lock.age < config.staleThreshold);

  if (staleLocks.length) {
    for (const lock of staleLocks) {
      sections.Locks.push({
        issue: `Stale lock on ${lock.target} (${lock.age}s old)`,
        fix: 'Run `nexus clean --stale`.',
        displayGroup: lock.target,
        lockInfo: {
          target: lock.target,
          agent: lock.agent || '',
          kind: 'stale',
          age: `${lock.age}s old`,
        },
      });
    }
  }

  if (freshLocks.length) {
    for (const lock of freshLocks) {
      const age = lock.age === null ? 'unknown age' : `${lock.age}s old`;
      sections.Locks.push({
        issue: `Active lock on ${lock.target} (${age})`,
        fix: 'No action if the agent is still working. Use `nexus status` to inspect.',
        ok: true,
        displayGroup: lock.target,
        lockInfo: {
          target: lock.target,
          agent: lock.agent || '',
          kind: 'active',
          age,
        },
      });
      if (!lock.model) {
        sections.Locks.push({
          issue: `Active lock on ${lock.target} has no --model metadata`,
          fix: 'Use `nexus claim ... --model <name>` for future claims; only the human operator can declare the real model.',
          ok: true,
          displayGroup: lock.target,
          lockInfo: {
            target: lock.target,
            agent: lock.agent || '',
            kind: 'missing_model',
          },
        });
      }
      if (!lock.verified) {
        sections.Locks.push({
          issue: `Unverified claim on ${lock.target} by ${lock.agent} (trust: ${lock.trustSource}) — no CLAUDECODE or NEXUS_AGENT env detected at claim time`,
          fix: 'If this is a local/unverified model, set NEXUS_AGENT=@handle before claiming. If unexpected, inspect the lock.',
          displayGroup: lock.target,
          lockInfo: {
            target: lock.target,
            agent: lock.agent || '',
            kind: 'unverified',
            trustSource: lock.trustSource,
          },
        });
      }
    }
  }

  // Orphan presence — agent checked in but crashed without checking out
  const presenceDir = join(root, '.nexus', 'presence');
  if (existsSync(presenceDir)) {
    const activeLockAgents = new Set(freshLocks.map(l => l.agent.replace(/^@/, '').toLowerCase()));
    const now = Math.floor(Date.now() / 1000);
    for (const file of readdirSync(presenceDir)) {
      try {
        const ts = parseInt(readFileSync(join(presenceDir, file), 'utf-8').trim(), 10);
        const age = now - ts;
        if (age >= config.staleThreshold && !activeLockAgents.has(file.toLowerCase())) {
          sections.Locks.push({
            issue: `Orphan presence for @${file} (${age}s old, no active lock) — agent likely crashed without checking out`,
            fix: `Run \`nexus checkout @${file}\` to clear it.`,
          });
        }
      } catch { /* skip unreadable */ }
    }
  }

  // promptCHMOD hygiene — check matrix exists and covers core protocol files
  const CORE_PROTOCOL_FILES = ['_NEXUS_CONSTITUTION.md', '_NEXUS_QUEUE.md', '_NEXUS_STANDUP.md', '_NEXUS_REPORT.md'];
  if (!existsSync(getChmodPath())) {
    if (fix) {
      writeFileSync(getChmodPath(), DEFAULT_MATRIX, 'utf-8');
      changes.push('created _NEXUS_CHMOD.md');
      sections.promptCHMOD.push({
        issue: 'Permission matrix present and core protocol files covered',
        ok: true,
      });
    } else {
      sections.promptCHMOD.push({
        issue: '_NEXUS_CHMOD.md is missing — prompt injection surface is undeclared',
        fix: 'Run `nexus chmod --init` to create the default permission matrix.',
      });
    }
  } else {
    const perms = loadPermissions();
    const covered = new Set(perms.map(e => e.path));
    for (const file of CORE_PROTOCOL_FILES) {
      if (!covered.has(file)) {
        sections.promptCHMOD.push({
          issue: `${file} has no entry in _NEXUS_CHMOD.md`,
          fix: `Add it: nexus chmod ${file} rw- all  (or r-- if agents should not modify it)`,
        });
      }
    }
    if (!sections.promptCHMOD.length) {
      sections.promptCHMOD.push({
        issue: 'Permission matrix present and core protocol files covered',
        ok: true,
      });
    }
  }

  // Queue authorship gate — warn on auto-flow tasks in Ready Queue missing Review: approved
  const queuePath = join(root, '_NEXUS_QUEUE.md');
  if (existsSync(queuePath)) {
    const queueContent = readFileSync(queuePath, 'utf-8');
    const readySection = extractReadyQueueSection(queueContent);
    const unapproved = findUnapprovedAutoFlow(readySection);
    if (unapproved.length) {
      for (const id of unapproved) {
        sections['Queue Authorship'].push({
          issue: `Task "${id}" is missing Review: approved`,
          fix: 'add `Review: approved` and `Approved by: human`, or move it to `## Proposed Queue`',
          displayGroup: id,
          queueInfo: {
            taskId: id,
            state: 'auto-flow: yes in Ready Queue',
            needs: 'Review: approved',
            impact: 'nexus next will skip it',
          },
        });
      }
    } else {
      sections['Queue Authorship'].push({
        issue: 'All auto-flow tasks in Ready Queue have Review: approved',
        fix: 'No action needed.',
        ok: true,
      });
    }
  }

  for (const relativePath of legacyCheckFiles) {
    const path = join(root, relativePath);
    if (!existsSync(path)) continue;

    const existing = readFileSync(path, 'utf-8');
    const next = replaceLegacyHelperCommands(existing);
    if (next === existing) continue;

    if (fix) {
      writeFileSync(path, next, 'utf-8');
      changes.push(`updated legacy Nexus helper commands in ${relativePath}`);
    } else {
      sections['Legacy Helpers'].push({
        issue: `${relativePath} references legacy _nexus_*.sh helpers`,
        fix: 'Use `nexus claim`, `nexus release`, and `nexus next`; run `nexus doctor --fix` to update checked docs.',
      });
    }
  }

  if (json) {
    const problemCount = Object.values(sections)
      .flat()
      .filter((entry) => !entry.ok).length;
    console.log(JSON.stringify({
      ok: problemCount === 0,
      repo: root,
      fix,
      sections,
      changes,
    }, null, 2));
    return;
  }

  if (changes.length) {
    console.log(colors.bold(colors.green('Applied fixes')));
    for (const change of changes) console.log(`  ${colors.green('-')} ${change}`);
    console.log('');
  }

  let problemCount = 0;
  for (const [title, entries] of Object.entries(sections)) {
    console.log(colors.bold(colors.cyan(`[${title}]`)));
    if (!entries.length) {
      console.log(`  ${colors.green('OK')}`);
      console.log('');
      continue;
    }

    const actionable = entries.filter((entry) => !entry.ok);
    const informational = entries.filter((entry) => entry.ok);
    problemCount += actionable.length;

    if (actionable.length) renderEntryBucket('Fix the following', actionable, colors.yellow, colors.red, title, colors);
    if (informational.length) renderEntryBucket('Review / informational', informational, colors.blue, colors.green, title, colors);
    console.log('');
  }

  if (problemCount) {
    console.log(colors.bold(colors.yellow('Some issues need attention.')));
    console.log(colors.dim('Safe scaffold fixes: `nexus doctor --fix`.'));
    return;
  }

  console.log(colors.bold(colors.green('All checked Nexus categories are ready.')));
}

function renderEntryBucket(label, entries, headingColor, markerColor, sectionTitle, colors) {
  console.log(`  ${headingColor(label)}`);
  if (sectionTitle === 'Locks') {
    renderLockEntries(entries, markerColor, colors);
    return;
  }
  if (sectionTitle === 'Queue Authorship') {
    renderQueueEntries(entries, markerColor, colors);
    return;
  }
  const groups = groupEntriesForDisplay(entries, sectionTitle);
  for (const group of groups) {
    if (group.label) {
      console.log(`    ${colors.bold(group.label)}`);
    }
    for (const entry of group.entries) {
      const baseIndent = group.label ? '      ' : '    ';
      const detailIndent = group.label ? '        ' : '      ';
      const prefix = entry.ok ? '-' : '!';
      console.log(`${baseIndent}${markerColor(prefix)} ${entry.issue}`);
      if (entry.details) {
        for (const detail of entry.details) {
          console.log(`${detailIndent}${colors.dim(detail)}`);
        }
      }
      if (entry.fix) {
        console.log(`${detailIndent}${colors.bold('Fix:')} ${colors.dim(entry.fix)}`);
      }
    }
  }
}

function renderLockEntries(entries, markerColor, colors) {
  const groups = new Map();

  for (const entry of entries) {
    const target = entry.lockInfo?.target || entry.displayGroup || entry.issue;
    if (!groups.has(target)) groups.set(target, []);
    groups.get(target).push(entry);
  }

  for (const [target, lockEntries] of groups) {
    const agent = lockEntries.find((entry) => entry.lockInfo?.agent)?.lockInfo?.agent || '';
    console.log(`    ${colors.bold(`file: ${target}`)}`);
    console.log(`      ${colors.dim(`by: ${agent || 'unknown'}`)}`);
    for (const entry of lockEntries) {
      const prefix = entry.ok ? '-' : '!';
      const state = formatLockState(entry);
      console.log(`      ${markerColor(prefix)} ${state}`);
      if (entry.fix) {
        console.log(`        ${colors.bold('fix:')} ${colors.dim(compactLockFix(entry))}`);
      }
    }
  }
}

function renderQueueEntries(entries, markerColor, colors) {
  const groups = new Map();

  for (const entry of entries) {
    const taskId = entry.queueInfo?.taskId || entry.displayGroup || entry.issue;
    if (!groups.has(taskId)) groups.set(taskId, []);
    groups.get(taskId).push(entry);
  }

  for (const [taskId, taskEntries] of groups) {
    console.log(`    ${colors.bold(`task: ${taskId}`)}`);
    for (const entry of taskEntries) {
      const prefix = entry.ok ? '-' : '!';
      const state = entry.queueInfo?.state || entry.issue;
      const needs = entry.queueInfo?.needs;
      const impact = entry.queueInfo?.impact;
      console.log(`      ${markerColor(prefix)} ${state}`);
      if (needs) {
        console.log(`        ${colors.dim(`needs: ${needs}`)}`);
      }
      if (impact) {
        console.log(`        ${colors.dim(`impact: ${impact}`)}`);
      }
      if (entry.fix) {
        console.log(`        ${colors.bold('fix:')} ${colors.dim(entry.fix)}`);
      }
    }
  }
}

function formatLockState(entry) {
  const info = entry.lockInfo;
  if (!info) return entry.issue;

  switch (info.kind) {
    case 'stale':
      return `stale lock (${info.age})`;
    case 'active':
      return `active lock (${info.age})`;
    case 'missing_model':
      return 'missing --model metadata';
    case 'unverified':
      return `unverified claim (trust: ${info.trustSource || 'unknown'})`;
    default:
      return entry.issue;
  }
}

function compactLockFix(entry) {
  const info = entry.lockInfo;
  if (!info) return entry.fix;

  switch (info.kind) {
    case 'stale':
      return 'run `nexus clean --stale`';
    case 'active':
      return 'leave it if someone is working, or inspect with `nexus status`';
    case 'missing_model':
      return 'use `nexus claim ... --model <name>` on future claims';
    case 'unverified':
      return 'set `NEXUS_AGENT=@handle` for local claims, or inspect the lock';
    default:
      return entry.fix;
  }
}

function groupEntriesForDisplay(entries, sectionTitle) {
  const groups = [];
  const grouped = new Map();

  for (const entry of entries) {
    const label = entry.displayGroup || inferDisplayGroup(entry.issue, sectionTitle);
    if (!label) {
      groups.push({ label: '', entries: [entry] });
      continue;
    }
    if (!grouped.has(label)) {
      const group = { label, entries: [] };
      grouped.set(label, group);
      groups.push(group);
    }
    grouped.get(label).entries.push(entry);
  }

  return groups;
}

function inferDisplayGroup(issue, sectionTitle) {
  if (sectionTitle === 'Locks') {
    const lockMatch = issue.match(/^(?:Stale lock on|Active lock on|Unverified claim on) ([^ ]+)/);
    if (lockMatch) return lockMatch[1];
  }

  if (sectionTitle === 'Queue Authorship') {
    const taskMatch = issue.match(/^Task "([^"]+)"/);
    if (taskMatch) return taskMatch[1];
  }

  return '';
}

function extractReadyQueueSection(content) {
  const lines = content.split('\n');
  let inSection = false;
  const result = [];
  for (const line of lines) {
    if (line.startsWith('## ')) { inSection = line.trim() === '## Ready Queue'; continue; }
    if (inSection) result.push(line);
  }
  return result.join('\n');
}

function findUnapprovedAutoFlow(sectionContent) {
  const unapproved = [];
  const lines = sectionContent.split('\n');
  let currentId = '';
  let isAutoFlow = false;
  let hasReview = false;

  for (const line of lines) {
    const taskMatch = line.match(/^- \[[ ]\] TASK\/.+?:\s*(.+)/);
    if (taskMatch) {
      if (currentId && isAutoFlow && !hasReview) unapproved.push(currentId);
      currentId = '';
      isAutoFlow = false;
      hasReview = false;
      continue;
    }
    if (line.match(/^- \[x\]/)) {
      if (currentId && isAutoFlow && !hasReview) unapproved.push(currentId);
      currentId = '';
      isAutoFlow = false;
      hasReview = false;
      continue;
    }
    if (!line.trim().startsWith('- ')) continue;
    const kv = line.trim().replace(/^-\s*/, '');
    const colonIdx = kv.indexOf(':');
    if (colonIdx === -1) continue;
    const key = kv.slice(0, colonIdx).trim().toLowerCase();
    const val = kv.slice(colonIdx + 1).trim().toLowerCase();
    if (key === 'id') currentId = val;
    if (key === 'auto-flow' && val === 'yes') isAutoFlow = true;
    if (key === 'review' && val === 'approved') hasReview = true;
  }
  if (currentId && isAutoFlow && !hasReview) unapproved.push(currentId);
  return unapproved;
}

function replaceLegacyHelperCommands(content) {
  return content
    .split('\n')
    .map((line) => {
      if (line.includes('-> nexus ')) return line;
      return line
        .replaceAll('./_nexus_claim.sh', 'nexus claim')
        .replaceAll('_nexus_claim.sh', 'nexus claim')
        .replaceAll('./_nexus_release.sh', 'nexus release')
        .replaceAll('_nexus_release.sh', 'nexus release')
        .replaceAll('./_nexus_next.sh', 'nexus next')
        .replaceAll('_nexus_next.sh', 'nexus next');
    })
    .join('\n');
}

const SUSPICIOUS_SCRIPT_PATTERNS = [
  { pattern: /\b(curl|wget)\b/i, label: 'network download command' },
  { pattern: /\b(nc|netcat|ncat|socat)\b/i, label: 'raw network transfer command' },
  { pattern: /\b(scp|rsync)\b/i, label: 'remote file transfer command' },
  { pattern: /\bssh\b/i, label: 'remote shell command' },
  { pattern: /https?:\/\/|webhook|discord\.com\/api|hooks\.slack\.com/i, label: 'external URL or webhook' },
  { pattern: /\b[A-Z0-9_]*(TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\b/, label: 'secret-looking environment variable' },
];

const INSTALL_HOOKS = new Set([
  'preinstall',
  'install',
  'postinstall',
  'prepublish',
  'prepare',
]);

function scanPackageSecurity(root) {
  const packagePath = join(root, 'package.json');
  if (!existsSync(packagePath)) return [];

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
  } catch {
    return [{
      issue: 'package.json could not be parsed for security checks',
      fix: 'Fix package.json syntax before running agent installs.',
    }];
  }

  const issues = [];
  const scripts = pkg.scripts || {};

  for (const [name, command] of Object.entries(scripts)) {
    if (typeof command !== 'string') continue;

    if (INSTALL_HOOKS.has(name)) {
      issues.push({
        issue: `package.json script "${name}" runs during install`,
        fix: 'Human-review install hooks before allowing an agent to install dependencies.',
      });
    }

    for (const { pattern, label } of SUSPICIOUS_SCRIPT_PATTERNS) {
      if (!pattern.test(command)) continue;
      issues.push({
        issue: `package.json script "${name}" contains ${label}: ${command}`,
        fix: 'Human-review this script for exfiltration risk before an agent runs it.',
      });
      break;
    }
  }

  return issues;
}

const PRIVATE_PACKAGE_PATHS = [
  '.agent-*',
  '.agent-session-logs',
  '.nexus/local',
  '.agy',
  '.antigravitycli',
  '.codex',
  '.claude',
  '.gemini',
  'agent-overlay.md',
  'DECISIONS.md',
  'docs-priv',
  'SOUL.md',
  'scratch',
  'session-logs',
  'IDENTITY.md',
  'USER.md',
];

const PRIVATE_GIT_PATHS = [
  '.agent-*',
  '.agent-session-logs',
  '.agy',
  '.antigravitycli',
  '.codex',
  '.claude',
  '.gemini',
  '.nexus/local',
  'DECISIONS.md',
  'docs-priv',
  'scratch',
  'session-logs',
  'USER.md',
];

const GIT_PRIVACY_COLLAPSE_ROOTS = [
  '.agent-session-logs',
  '.agent-*',
  '.agy',
  '.antigravitycli',
  '.claude',
  '.codex',
  '.gemini',
  '.nexus/local',
  'docs-priv',
  'scratch',
  'session-logs',
];

const GIT_PRIVACY_AGENT_ROOTS = new Set([
  '.agy',
  '.claude',
  '.codex',
  '.gemini',
]);

function scanPackagePrivacy(root) {
  const packagePath = join(root, 'package.json');
  if (!existsSync(packagePath)) return [];

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
  } catch {
    return [];
  }

  const files = Array.isArray(pkg.files) ? pkg.files : [];
  const issues = [];

  for (const entry of files) {
    if (typeof entry !== 'string') continue;
    const normalized = entry.replace(/^\.\//, '').replace(/\/$/, '');
    for (const privatePath of PRIVATE_PACKAGE_PATHS) {
      if (matchesPrivatePath(normalized, privatePath)) {
        issues.push({
          issue: `package.json files includes private/local path: ${entry}`,
          fix: 'Remove private local agent state from package.json files before publishing.',
        });
        break;
      }
    }
  }

  return issues;
}

function scanGitPrivacy(root, config) {
  const gitDir = join(root, '.git');
  if (!existsSync(gitDir)) return [];

  const result = spawnSync('git', ['ls-files', '--', ...PRIVATE_GIT_PATHS], {
    cwd: root,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (result.status !== 0) return [];

  const tracked = result.stdout.split('\n').filter(Boolean);
  return summarizeGitPrivacyIssues(tracked, config);
}

function summarizeGitPrivacyIssues(tracked, config) {
  const grouped = new Map();
  const singles = [];

  for (const file of tracked) {
    const root = gitPrivacyRoot(file);
    if (!root) {
      singles.push(file);
      continue;
    }
    if (!grouped.has(root)) grouped.set(root, []);
    grouped.get(root).push(file);
  }

  const issues = [];
  const agentRootSummaries = [];

  for (const file of singles.sort()) {
    issues.push({
      issue: `Git tracks private/local path: ${file}`,
      fix: 'Untrack it without deleting local files: `git rm --cached -r -- <path>`, then add an ignore rule.',
    });
  }

  for (const root of Array.from(grouped.keys()).sort()) {
    const files = grouped.get(root).slice().sort(compareGitPrivacyFiles);
    if (GIT_PRIVACY_AGENT_ROOTS.has(root)) {
      agentRootSummaries.push(`${root}/ (${files.length} files)`);
      continue;
    }
    const samples = files.slice(0, 5);
    const hiddenCount = files.length - samples.length;
    const noun = files.length === 1 ? 'path' : 'paths';
    const issue = `Git tracks private/local ${noun} under ${root}/ (${files.length} files)`;
    const fix = 'Review the sample paths below. If the tree is intentionally tracked in this repo, keep it. Otherwise untrack it without deleting local files: `git rm --cached -r -- <path>`, then add an ignore rule.';
    const details = samples.map((file) => `sample: ${file}`);
    if (hiddenCount > 0) {
      details.push(`...and ${hiddenCount} more tracked paths`);
    }
    issues.push({ issue, fix, details });
  }

  if (agentRootSummaries.length) {
    issues.unshift({
      issue: `Tracked shared agent trees detected: ${agentRootSummaries.join(', ')}`,
      fix: config.doctor.allowTrackedAgentTrees
        ? undefined
        : 'If these agent trees are intentionally versioned in this repo, keep them. Otherwise untrack them without deleting local files: `git rm --cached -r -- <path>`, then add an ignore rule.',
      details: [
        config.doctor.allowTrackedAgentTrees
          ? 'Allowed by `.nexus/config.json` because this repo intentionally versions shared agent trees.'
          : 'This can be normal in private repos that share agent protocols and memory in Git.',
      ],
      ok: config.doctor.allowTrackedAgentTrees,
    });
  }

  return issues;
}

function gitPrivacyRoot(file) {
  for (const root of GIT_PRIVACY_COLLAPSE_ROOTS) {
    if (matchesPrivatePath(file, root)) {
      return root.replace(/\/$/, '');
    }
  }
  return '';
}

function compareGitPrivacyFiles(a, b) {
  return gitPrivacyPriority(a) - gitPrivacyPriority(b) || a.localeCompare(b);
}

function gitPrivacyPriority(file) {
  if (/\/(CONTINUITY\.md|memories\/)/.test(file)) return 0;
  if (/\/(AGENTS\.md|CLAUDE\.md|GEMINI\.md)$/.test(file)) return 1;
  return 2;
}

function createColors() {
  const enabled = supportsColor();
  const wrap = (open, close) => (value) => enabled ? `\u001b[${open}m${value}\u001b[${close}m` : String(value);
  return {
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    red: wrap(31, 39),
    green: wrap(32, 39),
    yellow: wrap(33, 39),
    blue: wrap(34, 39),
    cyan: wrap(36, 39),
  };
}

function supportsColor() {
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true;
  if ('NO_COLOR' in process.env) return false;
  return Boolean(process.stdout && process.stdout.isTTY);
}

function scanGeneratedArtifacts(root) {
  const gitDir = join(root, '.git');
  if (!existsSync(gitDir)) return [];

  const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: root,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (result.status !== 0) return [];

  const seen = new Set();
  const artifacts = [];
  for (const line of result.stdout.split('\n')) {
    if (!line.startsWith('?? ')) continue;
    const file = parseGitStatusPath(line.slice(3).trim());
    const ownerPath = generatedArtifactOwnerPath(file);
    if (!ownerPath || seen.has(ownerPath)) continue;
    seen.add(ownerPath);
    artifacts.push({
      issue: `Untracked generated-looking artifact needs owner decision: ${ownerPath}`,
      fix: 'Decide keep/delete/ignore, or claim and release it intentionally. Nexus will not delete it automatically.',
    });
  }
  return artifacts;
}

function generatedArtifactOwnerPath(file) {
  const normalized = file.replace(/\\/g, '/');
  if (/(^|\/)(dist|build|coverage|tmp|temp|exports?|reports?|ledgers?|screenshots?)(\/|$)/i.test(normalized)) {
    return firstPathSegment(normalized);
  }
  if (/(^|\/)[^/]*\bcopy\b[^/]*(\/|$)/i.test(normalized)) {
    return firstPathSegment(normalized);
  }
  if (/\.(png|jpe?g|gif|webp|pdf|log|tmp)$/i.test(normalized)) {
    return normalized;
  }
  return '';
}

function parseGitStatusPath(file) {
  if (!file.startsWith('"') || !file.endsWith('"')) return file;

  try {
    return JSON.parse(file);
  } catch {
    return file.slice(1, -1);
  }
}

function firstPathSegment(file) {
  return file.split('/')[0];
}

function matchesPrivatePath(normalized, privatePath) {
  if (privatePath.endsWith('*')) {
    const prefix = privatePath.slice(0, -1);
    return normalized.startsWith(prefix);
  }
  return normalized === privatePath ||
    normalized.startsWith(`${privatePath}/`) ||
    normalized.endsWith(`/${privatePath}`);
}
