/**
 * nexus doctor - inspect and repair agent protocol scaffolds in existing repos
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { cwd } from 'process';
import { spawnSync } from 'child_process';
import { listLocks } from '../lib/lockManager.js';
import { getConfig } from '../lib/config.js';
import { AGENT_SCOPE_LIST } from '../lib/agentScopes.js';
import { DEFAULT_MATRIX, loadPermissions, getChmodPath } from '../lib/permissions.js';
import {
  CONTINUITY_TEMPLATE,
  END_MARKER,
  MEMORY_INDEX_GUARDRAIL,
  MEMORY_INDEX_TEMPLATE,
  REQUIRED_CONTEXT_READ,
  SKILL_CONTEXT_GUARDRAIL,
  START_MARKER,
  currentMemoryMonthFolder,
  fullEntrypoint,
  protocolBlock,
} from '../lib/protocolText.js';
import { HOOK_AGENT_CONFIGS, hookStatus } from './hooks.js';
import { contractViolations, parseContractTasks, primitiveGaps } from '../lib/taskContract.js';
import { scanQueueLanes } from '../lib/queue.js';

const LOCAL_DECISIONS_TEMPLATE = `# Decisions

Local agent work decisions live here. This file is gitignored by Nexus.
`;

const LOCAL_GITIGNORE_LINES = ['DECISIONS.md', 'docs-priv/', '.nexus/presence/'];
const STANDUP_FORMAT_GUIDANCE = 'YYYY-MM-DD HH:MM AM/PM @agent [STATUS]: message';
const STANDUP_RULES_LINE = `*Rules: Append new entries at the bottom. One line per message. Use \`${STANDUP_FORMAT_GUIDANCE}\` so relevance is visible. Use 🧵 for long discussions.*`;


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
  const checkHooks = args.includes('--hooks');
  const root = cwd();
  const colors = createColors();
  const sections = {
    'Nexus Files': [],
    'Agent Instructions': [],
    'Docs & Skills': [],
    Security: [],
    'Package Privacy': [],
    'Git Privacy': [],
    'Legacy Helpers': [],
    Continuity: [],
    Memories: [],
    Locks: [],
    'Generated Artifacts': [],
    Hooks: [],
    promptCHMOD: [],
    'Queue Authorship': [],
    'Queue Lanes': [],
    'Loop Readiness': [],
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

  if (checkHooks) {
    for (const agent of Object.keys(HOOK_AGENT_CONFIGS)) {
      const status = hookStatus(agent);
      if (status.status === 'current') {
        sections.Hooks.push({
          issue: `${agent} Nexus hook is installed`,
          fix: 'No action needed.',
          ok: true,
        });
        continue;
      }

      const fixHint = `Run \`nexus hooks install --agent ${agent}\`${status.status === 'foreign' ? ' after reviewing the existing hook, or add `--force` to replace it' : ''}.`;
      sections.Hooks.push({
        issue: `${agent} Nexus hook is ${status.status} at ${status.path}`,
        fix: fixHint,
      });
    }
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

  const protocolDocs = [];
  if (isNexusProductRepo(root)) {
    protocolDocs.push({
      path: 'README.md',
      label: 'README.md',
      repair: repairReadmeProtocolDoc,
    });
  }
  protocolDocs.push({
    path: 'skills/nexus/SKILL.md',
    label: 'skills/nexus/SKILL.md',
    repair: repairNexusSkillDoc,
  });

  for (const doc of protocolDocs) {
    const path = join(root, doc.path);
    if (!existsSync(path)) continue;
    const existing = readFileSync(path, 'utf-8');
    const next = doc.repair(existing);
    if (next === existing) continue;
    if (fix) {
      writeFileSync(path, next, 'utf-8');
      changes.push(`updated ${doc.label}`);
    } else {
      sections['Docs & Skills'].push({
        issue: `${doc.label} is out of sync with current Nexus protocol wording`,
        fix: 'Run `nexus doctor --fix`.',
      });
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

  // Queue authorship gate — list auto-flow tasks in Ready Queue failing the
  // task contract (Review approved, Approved by human, Notes, Files, Cost).
  // Reported at every autonomy level; nexus next enforces it at autonomy 1+.
  const queuePath = join(root, '_NEXUS_QUEUE.md');
  if (existsSync(queuePath)) {
    const queueContent = readFileSync(queuePath, 'utf-8');
    const readySection = extractReadyQueueSection(queueContent);
    const failing = parseContractTasks(readySection)
      .filter((t) => !t.done && t.status !== 'Done' && t.autoFlow === 'yes')
      .map((t) => ({ task: t, violations: contractViolations(t) }))
      .filter(({ violations }) => violations.length);

    if (failing.length) {
      for (const { task, violations } of failing) {
        const id = task.id || task.title;
        const needsApproval = violations.some((v) => v.field === 'Review' || v.field === 'Approved by');
        sections['Queue Authorship'].push({
          issue: `Task "${id}" fails the auto-flow task contract (${violations.map((v) => v.field).join(', ')})`,
          fix: needsApproval
            ? 'add `Review: approved` and `Approved by: human`, or move it to `## Proposed Queue`'
            : 'fill in the missing fields in `_NEXUS_QUEUE.md`, or move it to `## Proposed Queue`',
          displayGroup: id,
          queueInfo: {
            taskId: id,
            state: 'auto-flow: yes in Ready Queue',
            needs: violations.map((v) => v.needs).join(', '),
            impact: 'nexus next will skip it',
          },
        });
      }
    } else {
      sections['Queue Authorship'].push({
        issue: 'All auto-flow tasks in Ready Queue satisfy the task contract',
        fix: 'No action needed.',
        ok: true,
      });
    }

    // Task primitives — Outcome + Evidence + Stop If are the anti-over-looping
    // contract: they say when a loop agent is finished and when it must stop.
    // Missing primitives are actionable at autonomy 2, advisory below.
    const primitivesRequired = config.autonomy >= 2;
    const primitiveFailing = parseContractTasks(readySection)
      .filter((t) => !t.done && t.status !== 'Done' && t.autoFlow === 'yes')
      .map((t) => ({ task: t, gaps: primitiveGaps(t) }))
      .filter(({ gaps }) => gaps.length);

    if (primitiveFailing.length) {
      for (const { task, gaps } of primitiveFailing) {
        const id = task.id || task.title;
        sections['Queue Authorship'].push({
          issue: `Task "${id}" is missing task primitives (${gaps.map((g) => g.field).join(', ')})`,
          fix: 'declare Goal, Outcome, Constraints, Stop If, and Evidence in `_NEXUS_QUEUE.md` — Outcome + Evidence + Stop If define when a loop agent is done and when it must stop',
          ok: !primitivesRequired,
          displayGroup: id,
          queueInfo: {
            taskId: id,
            state: primitivesRequired
              ? `auto-flow: yes in Ready Queue at autonomy ${config.autonomy}`
              : `auto-flow: yes in Ready Queue (advisory at autonomy ${config.autonomy}; required at autonomy 2)`,
            needs: gaps.map((g) => `${g.field} (${g.describes})`).join(', '),
            impact: primitivesRequired ? 'under-specified for unattended loop work' : '',
          },
        });
      }
    } else {
      sections['Queue Authorship'].push({
        issue: 'All auto-flow tasks in Ready Queue declare the task primitives',
        fix: 'No action needed.',
        ok: true,
      });
    }

    const laneScan = scanQueueLanes(root, queueContent, undefined, new Date(), config.staleThreshold);
    for (const receipt of laneScan.pendingReceipts) {
      sections['Queue Lanes'].push({
        issue: `Unreconciled lane receipt for ${receipt.id} in ${receipt.lane}`,
        fix: 'Run `nexus queue reconcile` to batch lane receipts back into `_NEXUS_QUEUE.md`.',
      });
    }
    for (const issue of laneScan.issues) {
      const fix = issue.kind === 'duplicate_pending_receipt'
        ? 'Resolve duplicate lane receipts manually, then run `nexus queue reconcile`.'
        : 'Inspect the lane and master queue before reconciling.';
      sections['Queue Lanes'].push({
        issue: `${issue.kind}: ${issue.id} (${issue.lane || 'no lane'}) ${issue.detail}`,
        fix,
      });
    }
    if (!laneScan.pendingReceipts.length && !laneScan.issues.length) {
      sections['Queue Lanes'].push({
        issue: 'No unreconciled lane receipts or lane/master disagreements',
        fix: 'No action needed.',
        ok: true,
      });
    }
  }

  // Loop readiness — autonomy above supervised requires a release verify gate
  if (config.autonomy >= 1) {
    if (!config.release.verifyCommand) {
      sections['Loop Readiness'].push({
        issue: `autonomy is ${config.autonomy} but release.verifyCommand is not configured — agents can compound on unverified commits`,
        fix: 'Set release.verifyCommand in .nexus/config.json (e.g. "npm test") or lower autonomy to 0.',
      });
    } else {
      sections['Loop Readiness'].push({
        issue: `autonomy ${config.autonomy} with release verify gate configured (${config.release.verifyCommand})`,
        ok: true,
      });
    }
  }

  // Level 2 — bounded unattended additionally requires volume bounds and a recovery path
  if (config.autonomy >= 2) {
    if (!existsSync(config.budgetFile)) {
      sections['Loop Readiness'].push({
        issue: `autonomy is ${config.autonomy} but no agent budget file exists (.nexus/agent-budgets.json) — unattended work has no volume bounds`,
        fix: 'Create .nexus/agent-budgets.json with per-agent budgets, or lower autonomy to 1.',
      });
    } else {
      sections['Loop Readiness'].push({
        issue: `autonomy ${config.autonomy} with agent budget file present (.nexus/agent-budgets.json)`,
        ok: true,
      });
    }

    if (!existsSync(join(dirname(fileURLToPath(import.meta.url)), 'recover.js'))) {
      sections['Loop Readiness'].push({
        issue: `autonomy is ${config.autonomy} but this Nexus build has no \`nexus recover\` command — rollback after unattended mistakes is manual git work`,
        fix: 'Accept manual git recovery for now, or hold Level 2 until release-recovery ships.',
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

function isNexusProductRepo(root) {
  const packagePath = join(root, 'package.json');
  if (!existsSync(packagePath)) return false;

  try {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return pkg?.name === '@inkobytes/nexus';
  } catch {
    return false;
  }
}

function repairReadmeProtocolDoc(content) {
  let next = content
    .replace(
      [
        '- [ ] TASK/Codex: Add doctor stale-lock category',
        '  - Id: doctor-stale-locks',
        '  - Epic: Release hygiene',
        '  - Status: Ready',
        '  - Depends on: none',
        '  - Files: src/commands/doctor.js',
        '  - Affinity: cli, diagnostics',
        '  - Cost: small',
        '  - Auto-flow: yes',
        '  - Notes: Add a doctor section for stale locks with tests and clear fix guidance.',
      ].join('\n'),
      [
        '- [ ] TASK/Codex: Add doctor stale-lock category',
        '  - Id: doctor-stale-locks',
        '  - Epic: Release hygiene',
        '  - Status: Ready',
        '  - Depends on: none',
        '  - Files: src/commands/doctor.js',
        '  - Affinity: cli, diagnostics',
        '  - Cost: small',
        '  - Auto-flow: yes',
        '  - Review: approved',
        '  - Approved by: human',
        '  - Notes: Add a doctor section for stale locks with tests and clear fix guidance.',
      ].join('\n'),
    )
    .replace(
      [
        '1. Run `nexus start` when entering an existing repo; it does not replace claim/release.',
        '2. Read `USER.md` when present.',
        '3. Read continuity and latest memory when present.',
        '4. Read `_NEXUS_QUEUE.md` before taking follow-on work.',
        '5. Claim before touching shared project files.',
        '6. Release when finished.',
        '7. Use `nexus next @Agent` instead of free-roaming.',
      ].join('\n'),
      [
        '1. Run `nexus start` when entering an existing repo; it does not replace claim/release.',
        '2. Read `_NEXUS_CONSTITUTION.md`.',
        '3. Read `USER.md` when present.',
        `4. ${REQUIRED_CONTEXT_READ}`,
        '5. Read `_NEXUS_QUEUE.md` before taking follow-on work.',
        '6. Claim before touching shared project files.',
        '7. Release each claimed tracked file as soon as it reaches a coherent checkpoint.',
        '8. Use `nexus next @Agent` instead of free-roaming.',
      ].join('\n'),
    )
    .replace(
      'The CLI is the coordination engine. The skill is the lean playbook for this flow: `start -> claim -> release`.',
      'The CLI is the coordination engine. The skill is the lean playbook for this flow: `start -> claim -> work -> release -> next`.',
    );

  const queueReviewReadme = 'Auto-flow work in `Ready Queue` should also include `Review: approved` and `Approved by: human`, or `doctor` will flag it and `nexus next` may skip it.';
  if (!next.includes(queueReviewReadme)) {
    next = next.replace(
      'Keep items dashboard-friendly: include `Id`, `Epic`, `Status`, `Depends on`, `Files`, `Affinity`, `Cost`, `Auto-flow`, and `Notes`. Use `Files` to expose conflict surfaces, `Depends on` for hard blockers, and `Auto-flow: no` when a task needs planning or human approval before an agent grabs it.',
      `Keep items dashboard-friendly: include \`Id\`, \`Epic\`, \`Status\`, \`Depends on\`, \`Files\`, \`Affinity\`, \`Cost\`, \`Auto-flow\`, and \`Notes\`. Use \`Files\` to expose conflict surfaces, \`Depends on\` for hard blockers, and \`Auto-flow: no\` when a task needs planning or human approval before an agent grabs it. ${queueReviewReadme}`,
    );
  }

  const agentNativeReadme = 'Nexus is agent-native and file-native, not human-native: optimize for concurrency and rollback, not feature-commit aesthetics. Do not hold claims to bundle related work into prettier feature commits; that blocks other agents waiting on files.';
  if (!next.includes(agentNativeReadme)) {
    next = next.replace(
      'Agent-local continuity and memory files are exempt from claim/release unless the human says otherwise.',
      `Agent-local continuity and memory files are exempt from claim/release unless the human says otherwise.\n\n${agentNativeReadme}`,
    );
  }

  return next;
}

function repairNexusSkillDoc(content) {
  let next = content
    .replace(
      [
        '1. Run `nexus start`; set `NEXUS_AGENT` for your CLI, or pass `--agent @agy|@claude|@codex|@gemini`. Start is orientation only, not permission to edit.',
        '2. Read `USER.md` if present for local user preferences.',
        '3. Read continuity and latest memory when present.',
        '4. Read `_NEXUS_QUEUE.md` and `_NEXUS_STANDUP.md`.',
        '5. Choose user-assigned work or `nexus next @Agent`; do not free-roam into `Auto-flow: no`.',
        '6. Claim exact shared files before reading/editing:',
      ].join('\n'),
      [
        '1. Run `nexus start`; set `NEXUS_AGENT` for your CLI, or pass `--agent @agy|@claude|@codex|@gemini`. Start is orientation only, not permission to edit.',
        '2. Read `_NEXUS_CONSTITUTION.md`.',
        '3. Read `USER.md` if present for local user preferences.',
        '4. Read continuity and latest memory when present.',
        '5. Read `_NEXUS_QUEUE.md` and `_NEXUS_STANDUP.md`.',
        '6. Choose user-assigned work or `nexus next @Agent`; do not free-roam into `Auto-flow: no`.',
        '7. Claim exact shared files before reading/editing:',
      ].join('\n'),
    )
    .replace(
      [
        '7. Treat claim output as current file state. Ignore cached file memory when contents matter.',
        '8. Work only inside the claimed surface and run focused validation.',
        '9. If the user wants a commit, release through Nexus:',
      ].join('\n'),
      [
        '8. Treat claim output as current file state. Ignore cached file memory when contents matter.',
        '9. If a hook blocks access because a path is unclaimed, stop and claim that exact path. Do not work around the hook with another command, cached content, or manual git operation.',
        '10. Work only inside the claimed surface and run focused validation.',
        '11. Release each claimed tracked file through Nexus as soon as it reaches a coherent checkpoint:',
      ].join('\n'),
    )
    .replace(
      '```\\n\\n## Queue Items',
      '```\\n\\n12. Do not hold claims to bundle related work into a prettier feature commit. Nexus is agent-native and file-native: optimize for file availability, rollback safety, and agent throughput.\\n\\n## Queue Items',
    )
    .replace(
      [
        '  - Cost: small',
        '  - Auto-flow: yes',
        '  - Notes: One practical paragraph with scope, constraints, and definition of done.',
      ].join('\n'),
      [
        '  - Cost: small',
        '  - Auto-flow: yes',
        '  - Review: approved',
        '  - Approved by: human',
        '  - Notes: One practical paragraph with scope, constraints, and definition of done.',
      ].join('\n'),
    )
    .replace(
      '- `Auto-flow: yes` means an agent can grab it after `nexus next`; use `no` when planning or human approval is needed.\n- `Notes` should carry dashboard-useful context, not a whole design doc.',
      '- `Auto-flow: yes` means an agent can grab it after `nexus next`; use `no` when planning or human approval is needed.\n- Auto-flow work in `Ready Queue` should include `Review: approved` and `Approved by: human`, or `doctor` will flag it and `nexus next` may skip it.\n- `Notes` should carry dashboard-useful context, not a whole design doc.',
    );

  if (!next.includes('Continuity is the compaction-safe session ledger; latest memory is required startup/resume context.')) {
    next = next.replace(
      '- Agent-local continuity and memory files are claim-exempt unless the user says otherwise.',
      `- Agent-local continuity and memory files are claim-exempt unless the user says otherwise.\n- ${SKILL_CONTEXT_GUARDRAIL}\n- ${MEMORY_INDEX_GUARDRAIL}`,
    );
  }

  const mandatoryNote = 'If the user, repo, or hook says Nexus is active, treat this skill as mandatory workflow. It is not optional advice.';
  if (!next.includes(mandatoryNote)) {
    next = next.replace('## Loop', `${mandatoryNote}\n\n## Loop`);
  }

  if (!next.includes('  - Stop If: Conditions that require stopping for human review.')) {
    next = next.replace(
      '  - Notes: One practical paragraph with scope, constraints, and definition of done.',
      [
        '  - Notes: One practical paragraph with scope, constraints, and definition of done.',
        '  - Goal: Why this task exists, one line.',
        '  - Outcome: What must be true when the task is complete.',
        '  - Constraints: What the agent must not change or assume.',
        '  - Stop If: Conditions that require stopping for human review.',
        '  - Evidence: Tests, logs, or reports that prove completion.',
      ].join('\n'),
    );
  }

  if (!next.includes('are the loop contract')) {
    next = next.replace(
      '- `Notes` should carry dashboard-useful context, not a whole design doc.',
      [
        '- `Notes` should carry dashboard-useful context, not a whole design doc.',
        '- Task primitives (`Goal`, `Outcome`, `Constraints`, `Stop If`, `Evidence`) are advisory today and required for auto-flow at autonomy 2. `Outcome` + `Evidence` + `Stop If` are the loop contract: when an agent is finished and when it must stop.',
        '- Write `Evidence` prospectively when authoring (what will prove completion); update it to point at the real artifacts when the task is Done.',
      ].join('\n'),
    );
  }

  next = next.replace(
    '4. Read continuity and latest memory when present.',
    `4. ${REQUIRED_CONTEXT_READ}`,
  );

  return next;
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
