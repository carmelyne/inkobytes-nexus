/**
 * nexus doctor - inspect and repair agent protocol scaffolds in existing repos
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import { spawnSync } from 'child_process';
import { listLocks } from '../lib/lockManager.js';
import { getConfig } from '../lib/config.js';
import { AGENT_SCOPE_LIST } from '../lib/agentScopes.js';

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
- Release finished work through Nexus: \`nexus release <path> "commit message"\`.
- Use \`nexus next @Agent\` for the next safe queue task.
- Do not free-roam into unassigned or \`Auto-flow: no\` work without user approval.

### Fresh File Truth

- Treat previous chat context, cached model memory, and earlier reads as stale when file contents matter.
- Before claiming what a file says, making edits, or judging current state, read the file from disk with a fresh command.
- Treat \`nexus claim\` output as fresh file state for the claimed path.
- If another agent or tool may have touched the file since your last read, re-read it before editing.

### Git Write Safety

- Before git writes, verify \`pwd\`, repo root, branch/status, and remotes.
- Stop if they do not match the requested project.
- Never infer from similar folder names or cached context.
- Require explicit confirmation before push/force-push, main/master, remote changes, or deletes.
- To remove private agent files from git, untrack them; do not delete local folders.

### Supply-Chain Safety

- Do not install third-party packages that have existed for less than 14 days.
- Before adding a new dependency, verify its package registry creation date.
- If the package is younger than 14 days or the age cannot be verified, stop and ask the user.
- Run \`nexus doctor\` before installs; review any Security findings before running package scripts.
- Treat install hooks and scripts with network commands, webhooks, raw sockets, SSH, or secret-looking variables as human-review only.
- Prefer built-in runtime APIs and existing project dependencies when they fit.

### Agent-Local Files

\`${agent.continuity}\` and \`${agent.memoryIndex}\` are agent-local handoff files.
They are exempt from Nexus claim/release unless the user says otherwise.

### Memory Flow

- On session start, read \`${agent.memoryIndex}\`.
- If the index has entries, read the newest \`${agent.memoryDir}/YYYY-Month/YYYY-MM-DD-HHMM-topic.md\` entry.
- On session end, pause, or checkpoint request, create one new memory file:
  \`${agent.memoryDir}/YYYY-Month/YYYY-MM-DD-HHMM-topic.md\`.
- Add the newest file to the top of \`${agent.memoryIndex}\`.
- Keep the index to the 10 newest visible entries.
- For monthly review, read one month folder such as \`${agent.memoryDir}/2026-January/\` and summarize the Markdown files.

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

export default function doctor(args) {
  const fix = args.includes('--fix');
  const json = args.includes('--json');
  const root = cwd();
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
  };
  const changes = [];
  const config = getConfig(root);

  if (!json) {
    console.log(`Nexus doctor${fix ? ' --fix' : ''}`);
    console.log(`Repo: ${root}\n`);
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

  for (const issue of scanPackageSecurity(root)) {
    sections.Security.push(issue);
  }

  for (const issue of scanPackagePrivacy(root)) {
    sections['Package Privacy'].push(issue);
  }

  for (const issue of scanGitPrivacy(root)) {
    sections['Git Privacy'].push(issue);
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
    console.log('Applied fixes:');
    for (const change of changes) console.log(`  - ${change}`);
    console.log('');
  }

  let problemCount = 0;
  for (const [title, entries] of Object.entries(sections)) {
    console.log(`[${title}]`);
    if (!entries.length) {
      console.log('  OK');
      console.log('');
      continue;
    }

    for (const entry of entries) {
      const prefix = entry.ok ? '-' : '!';
      console.log(`  ${prefix} ${entry.issue}`);
      console.log(`    Fix: ${entry.fix}`);
      if (!entry.ok) problemCount++;
    }
    console.log('');
  }

  if (problemCount) {
    console.log('Some issues need attention. Safe scaffold fixes: `nexus doctor --fix`.');
    return;
  }

  console.log('All checked Nexus categories are ready.');
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
  '.nexus/local',
  '.agy',
  '.antigravitycli',
  '.codex',
  '.claude',
  '.gemini',
  'agent-overlay.md',
  'SOUL.md',
  'IDENTITY.md',
  'USER.md',
];

const PRIVATE_GIT_PATHS = [
  '.agy',
  '.antigravitycli',
  '.codex',
  '.claude',
  '.gemini',
  '.nexus/local',
  'USER.md',
];

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
      if (normalized === privatePath || normalized.startsWith(`${privatePath}/`) || normalized.endsWith(`/${privatePath}`)) {
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

function scanGitPrivacy(root) {
  const gitDir = join(root, '.git');
  if (!existsSync(gitDir)) return [];

  const result = spawnSync('git', ['ls-files', '--', ...PRIVATE_GIT_PATHS], {
    cwd: root,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (result.status !== 0) return [];

  const tracked = result.stdout.split('\n').filter(Boolean);
  return tracked.map((file) => ({
    issue: `Git tracks private/local path: ${file}`,
    fix: 'Untrack it without deleting local files: `git rm --cached -r -- <path>`, then add an ignore rule.',
  }));
}
