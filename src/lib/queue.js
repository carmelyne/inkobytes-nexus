import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';

export const LANE_AGENT_PATTERN = /^@[a-z][a-z0-9_-]*$/i;
export const DEFAULT_LANE_AGENTS = ['@codex', '@claude', '@gemini', '@agy'];

export function extractSection(content, heading) {
  const lines = content.split('\n');
  let inSection = false;
  const result = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      inSection = line.trim() === heading;
      continue;
    }
    if (inSection) result.push(line);
  }
  return result.join('\n');
}

export function parseReadyTasks(content) {
  const sectionContent = extractSection(content, '## Ready Queue');
  const tasks = [];
  const lines = sectionContent.split('\n');
  let current = null;
  let currentLines = [];

  for (const line of lines) {
    const taskMatch = line.match(/^- \[[ x~>]\] TASK\/(.+?):\s*(.+)/);
    if (taskMatch) {
      if (current) {
        current.block = currentLines.join('\n').trimEnd();
        tasks.push(current);
      }
      currentLines = [line];
      current = {
        title: taskMatch[2],
        owner: taskMatch[1],
        checkbox: (line.match(/^- \[([ x~>])\]/) || [])[1] || ' ',
        id: '',
        epic: '',
        status: '',
        dependsOn: '',
        files: [],
        affinity: [],
        drills: [],
        cost: '',
        autoFlow: 'no',
        review: '',
        approvedBy: '',
        notes: '',
        goal: '',
        outcome: '',
        constraints: '',
        stopIf: '',
        evidence: '',
        delegatedTo: '',
        delegatedAt: '',
        lane: '',
        receipt: '',
        done: '',
      };
      continue;
    }

    if (!current) continue;
    currentLines.push(line);

    if (line.match(/^\s+-\s/)) {
      const kv = line.trim().replace(/^-\s*/, '');
      const colonIdx = kv.indexOf(':');
      if (colonIdx === -1) continue;

      const key = kv.slice(0, colonIdx).trim().toLowerCase();
      const val = kv.slice(colonIdx + 1).trim();

      switch (key) {
        case 'id': current.id = val; break;
        case 'epic': current.epic = val; break;
        case 'status': current.status = val; break;
        case 'depends on': current.dependsOn = val; break;
        case 'files': current.files = splitCsv(val); break;
        case 'affinity': current.affinity = splitCsv(val); break;
        case 'drills': current.drills = splitCsv(val); break;
        case 'cost': current.cost = val; break;
        case 'auto-flow': current.autoFlow = val; break;
        case 'review': current.review = val.toLowerCase(); break;
        case 'approved by': current.approvedBy = val; break;
        case 'notes': current.notes = val; break;
        case 'goal': current.goal = val; break;
        case 'outcome': current.outcome = val; break;
        case 'constraints': current.constraints = val; break;
        case 'stop if': current.stopIf = val; break;
        case 'evidence': current.evidence = val; break;
        case 'delegated to': current.delegatedTo = val; break;
        case 'delegated at': current.delegatedAt = val; break;
        case 'lane': current.lane = val; break;
        case 'receipt': current.receipt = val; break;
        case 'done': current.done = val; break;
      }
    }
  }

  if (current) {
    current.block = currentLines.join('\n').trimEnd();
    tasks.push(current);
  }
  return tasks;
}

export function laneFileName(agent) {
  assertAgent(agent);
  return `_NEXUS_Q_${agent.slice(1).toUpperCase().replace(/[^A-Z0-9_-]/g, '_')}.md`;
}

export function lanePath(root, agent) {
  return join(root, laneFileName(agent));
}

export function readLane(root, agent) {
  const file = lanePath(root, agent);
  if (!existsSync(file)) return initialLane(agent);
  return readFileSync(file, 'utf-8');
}

export function parseLaneTasks(content) {
  const active = parseLaneActive(content);
  const completed = [];
  const completedSection = extractSection(content, '## Completed');

  for (const block of splitBlocks(completedSection)) {
    const id = parseField(block, 'Id') || parseReceiptId(block);
    if (id) {
      completed.push({
        id,
        agent: parseField(block, 'Agent'),
        completedAt: parseField(block, 'Completed at'),
        receipt: parseField(block, 'Receipt'),
        reconciledAt: parseField(block, 'Reconciled at'),
        block,
      });
    }
  }

  return { active, completed };
}

export function delegatedTaskIds(root, agents = DEFAULT_LANE_AGENTS) {
  const ids = new Set();
  for (const agent of agents) {
    const file = lanePath(root, agent);
    if (!existsSync(file)) continue;
    const lane = parseLaneTasks(readFileSync(file, 'utf-8'));
    for (const task of lane.active) ids.add(task.id);
    for (const task of lane.completed) ids.add(task.id);
  }
  return ids;
}

export function scanQueueLanes(root, queueContent, agents = DEFAULT_LANE_AGENTS, now = new Date(), staleSeconds = 24 * 60 * 60) {
  const masterTasks = parseReadyTasks(queueContent);
  const masterById = new Map(masterTasks.filter(t => t.id).map(t => [t.id, t]));
  const laneStates = [];
  const pendingReceipts = [];
  const issues = [];

  for (const agent of agents) {
    const file = lanePath(root, agent);
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf-8');
    const state = parseLaneTasks(content);
    laneStates.push({ agent, lane: laneFileName(agent), path: file, content, ...state });

    for (const task of state.active) {
      const master = masterById.get(task.id);
      if (!master) {
        issues.push(laneIssue('lane_active_missing_master', task.id, agent, laneFileName(agent), 'active lane task has no matching master queue task'));
      } else if (master.lane && master.lane !== laneFileName(agent)) {
        issues.push(laneIssue('lane_active_master_mismatch', task.id, agent, laneFileName(agent), `master points at ${master.lane}`));
      } else if (master.status !== 'Delegated') {
        issues.push(laneIssue('lane_active_master_status', task.id, agent, laneFileName(agent), `master status is ${master.status || 'missing'}`));
      }
    }

    for (const receipt of state.completed) {
      if (isPendingReceipt(receipt)) {
        pendingReceipts.push({ ...receipt, agent: receipt.agent || agent, lane: laneFileName(agent), path: file });
      }
    }
  }

  for (const task of masterTasks.filter(t => t.status === 'Delegated')) {
    const laneState = laneStates.find(state => state.lane === task.lane);
    if (!laneState) {
      issues.push(laneIssue('master_delegated_missing_lane', task.id, task.delegatedTo, task.lane, 'master delegated task points at a missing lane file'));
      continue;
    }
    const inLane = laneState.active.some(t => t.id === task.id) || laneState.completed.some(t => t.id === task.id);
    if (!inLane) {
      issues.push(laneIssue('master_delegated_missing_task', task.id, task.delegatedTo, task.lane, 'master delegated task is missing from its lane'));
    }
    if (task.delegatedAt && isOlderThan(task.delegatedAt, now, staleSeconds) && !laneState.completed.some(t => t.id === task.id)) {
      issues.push(laneIssue('stale_delegated_task', task.id, task.delegatedTo, task.lane, `delegated at ${task.delegatedAt}`));
    }
  }

  for (const [id, receipts] of groupById(pendingReceipts)) {
    if (receipts.length > 1) {
      for (const receipt of receipts) {
        issues.push(laneIssue('duplicate_pending_receipt', id, receipt.agent, receipt.lane, 'multiple pending lane receipts share this task id'));
      }
    }
  }

  return { laneStates, pendingReceipts, issues, masterTasks };
}

export function reconcileQueueLanes({ root, queuePath, agents = DEFAULT_LANE_AGENTS, now = new Date() }) {
  const queueContent = readFileSync(queuePath, 'utf-8');
  const scan = scanQueueLanes(root, queueContent, agents, now);
  const duplicateIds = new Set(scan.issues.filter(issue => issue.kind === 'duplicate_pending_receipt').map(issue => issue.id));
  if (duplicateIds.size) {
    throw new Error(`Duplicate pending receipts: ${Array.from(duplicateIds).join(', ')}. Resolve lane receipts before reconciling.`);
  }

  let nextQueue = queueContent;
  const reconciledAt = now.toISOString();
  const results = [];

  for (const receipt of scan.pendingReceipts) {
    const task = parseReadyTasks(nextQueue).find(t => t.id === receipt.id);
    if (!task) {
      results.push({ id: receipt.id, lane: receipt.lane, status: 'skipped', reason: 'missing master task' });
      continue;
    }
    if (task.status === 'Done') {
      markReceiptReconciled(receipt.path, receipt.block, reconciledAt);
      results.push({ id: receipt.id, lane: receipt.lane, status: 'already_done' });
      continue;
    }

    nextQueue = markQueueTaskDone(nextQueue, task, {
      agent: receipt.agent,
      completedAt: receipt.completedAt,
      reconciledAt,
    });
    markReceiptReconciled(receipt.path, receipt.block, reconciledAt);
    results.push({ id: receipt.id, lane: receipt.lane, status: 'reconciled' });
  }

  writeFileSync(queuePath, nextQueue, 'utf-8');
  return { reconciledAt, results };
}

export function delegateTask({ root, queuePath, queueContent, task, agent, now = new Date() }) {
  assertAgent(agent);
  if (!task || !task.id || !task.block) throw new Error('Cannot delegate task without a parsed task block and Id.');

  const lane = laneFileName(agent);
  const delegatedAt = now.toISOString();
  const currentLane = readLane(root, agent);
  const laneState = parseLaneTasks(currentLane);
  if (laneState.active.some(t => t.id === task.id) || laneState.completed.some(t => t.id === task.id)) {
    throw new Error(`Task ${task.id} is already present in ${lane}.`);
  }

  const updatedLane = addActiveTaskToLane(currentLane, {
    task,
    agent,
    lane,
    delegatedAt,
    source: basename(queuePath),
  });
  const updatedQueue = markQueueTaskDelegated(queueContent, task, { agent, lane, delegatedAt });

  writeFileEnsured(lanePath(root, agent), updatedLane);
  writeFileSync(queuePath, updatedQueue, 'utf-8');

  return { lane, delegatedAt };
}

export function markLaneTaskDone({ root, agent, id, now = new Date() }) {
  assertAgent(agent);
  if (!id) throw new Error('Usage: nexus q done <id> <agent>');

  const file = lanePath(root, agent);
  if (!existsSync(file)) throw new Error(`No lane found for ${agent} (${laneFileName(agent)}).`);

  const content = readFileSync(file, 'utf-8');
  const active = parseLaneActive(content);
  const task = active.find(t => t.id === id);
  if (!task) throw new Error(`No active task ${id} found in ${laneFileName(agent)}.`);

  const completedAt = now.toISOString();
  let nextContent = removeActiveBlock(content, task.block);
  nextContent = appendCompletedReceipt(nextContent, { id, agent, completedAt });
  writeFileSync(file, nextContent, 'utf-8');

  return { lane: laneFileName(agent), completedAt };
}

function splitCsv(value) {
  return String(value || '').split(',').map(s => s.trim()).filter(Boolean);
}

function assertAgent(agent) {
  if (!LANE_AGENT_PATTERN.test(String(agent || ''))) {
    throw new Error('Agent must look like @codex, @claude, @gemini, or another @handle.');
  }
}

function initialLane(agent) {
  return `# Nexus Queue Lane - ${agent}

## Active

## Completed
`;
}

function addActiveTaskToLane(content, { task, agent, lane, delegatedAt, source }) {
  const activeBlock = [
    task.block.replace(/^- \[[ x~>]\]/, '- [~]'),
    `  - Source: ${source}`,
    `  - Delegated to: ${agent}`,
    `  - Delegated at: ${delegatedAt}`,
    `  - Lane: ${lane}`,
    `  - Receipt: pending reconciliation`,
  ].join('\n');

  if (!content.includes('## Active')) content = `${content.trimEnd()}\n\n## Active\n\n## Completed\n`;
  const marker = '## Completed';
  const insertAt = content.indexOf(marker);
  if (insertAt === -1) return `${content.trimEnd()}\n\n${activeBlock}\n`;

  const before = content.slice(0, insertAt).trimEnd();
  const after = content.slice(insertAt).trimStart();
  return `${before}\n\n${activeBlock}\n\n${after}`;
}

function markQueueTaskDelegated(content, task, { agent, lane, delegatedAt }) {
  const lines = task.block.split('\n');
  const nextLines = [];
  let sawStatus = false;
  let sawDelegatedTo = false;
  let sawDelegatedAt = false;
  let sawLane = false;
  let sawReceipt = false;

  for (const line of lines) {
    if (/^\s+- Status:/i.test(line)) {
      nextLines.push('  - Status: Delegated');
      sawStatus = true;
      continue;
    }
    if (/^\s+- Delegated to:/i.test(line)) {
      nextLines.push(`  - Delegated to: ${agent}`);
      sawDelegatedTo = true;
      continue;
    }
    if (/^\s+- Delegated at:/i.test(line)) {
      nextLines.push(`  - Delegated at: ${delegatedAt}`);
      sawDelegatedAt = true;
      continue;
    }
    if (/^\s+- Lane:/i.test(line)) {
      nextLines.push(`  - Lane: ${lane}`);
      sawLane = true;
      continue;
    }
    if (/^\s+- Receipt:/i.test(line)) {
      nextLines.push('  - Receipt: pending');
      sawReceipt = true;
      continue;
    }
    nextLines.push(line);
  }

  if (!sawStatus) nextLines.push('  - Status: Delegated');
  if (!sawDelegatedTo) nextLines.push(`  - Delegated to: ${agent}`);
  if (!sawDelegatedAt) nextLines.push(`  - Delegated at: ${delegatedAt}`);
  if (!sawLane) nextLines.push(`  - Lane: ${lane}`);
  if (!sawReceipt) nextLines.push('  - Receipt: pending');

  return content.replace(task.block, nextLines.join('\n'));
}

function markQueueTaskDone(content, task, { agent, completedAt, reconciledAt }) {
  const doneDate = isoDate(completedAt || reconciledAt);
  const lines = task.block.split('\n');
  const nextLines = [];
  let sawStatus = false;
  let sawDone = false;
  let sawCompletedBy = false;
  let sawCompletedAt = false;
  let sawReceipt = false;

  for (const line of lines) {
    if (/^- \[[ x~>]\]/.test(line)) {
      nextLines.push(line.replace(/^- \[[ x~>]\]/, '- [x]'));
      continue;
    }
    if (/^\s+- Status:/i.test(line)) {
      nextLines.push('  - Status: Done');
      sawStatus = true;
      continue;
    }
    if (/^\s+- Done:/i.test(line)) {
      nextLines.push(`  - Done: ${doneDate}`);
      sawDone = true;
      continue;
    }
    if (/^\s+- Completed by:/i.test(line)) {
      nextLines.push(`  - Completed by: ${agent}`);
      sawCompletedBy = true;
      continue;
    }
    if (/^\s+- Completed at:/i.test(line)) {
      nextLines.push(`  - Completed at: ${completedAt || reconciledAt}`);
      sawCompletedAt = true;
      continue;
    }
    if (/^\s+- Receipt:/i.test(line)) {
      nextLines.push(`  - Receipt: reconciled at ${reconciledAt}`);
      sawReceipt = true;
      continue;
    }
    nextLines.push(line);
  }

  if (!sawStatus) nextLines.push('  - Status: Done');
  if (!sawDone) nextLines.push(`  - Done: ${doneDate}`);
  if (!sawCompletedBy) nextLines.push(`  - Completed by: ${agent}`);
  if (!sawCompletedAt) nextLines.push(`  - Completed at: ${completedAt || reconciledAt}`);
  if (!sawReceipt) nextLines.push(`  - Receipt: reconciled at ${reconciledAt}`);

  return content.replace(task.block, nextLines.join('\n'));
}

function parseLaneActive(content) {
  return splitBlocks(extractSection(content, '## Active')).map(block => ({
    id: parseField(block, 'Id'),
    status: parseField(block, 'Status'),
    delegatedAt: parseField(block, 'Delegated at'),
    lane: parseField(block, 'Lane'),
    block,
  })).filter(t => t.id);
}

function splitBlocks(sectionContent) {
  const blocks = [];
  let current = [];
  for (const line of sectionContent.split('\n')) {
    if (/^- \[[ x~>]\]/.test(line)) {
      if (current.length) blocks.push(current.join('\n').trimEnd());
      current = [line];
      continue;
    }
    if (current.length) current.push(line);
  }
  if (current.length) blocks.push(current.join('\n').trimEnd());
  return blocks;
}

function parseField(block, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`^\\s+- ${escaped}:\\s*(.+)$`, 'im'));
  return match ? match[1].trim() : '';
}

function parseReceiptId(block) {
  const match = block.match(/^- \[x\]\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function removeActiveBlock(content, block) {
  return content
    .replace(block, '')
    .replace(/\n{3,}(## Completed)/, '\n\n$1')
    .replace(/(## Active)\n{3,}/, '$1\n\n');
}

function appendCompletedReceipt(content, { id, agent, completedAt }) {
  if (!content.includes('## Completed')) content = `${content.trimEnd()}\n\n## Completed\n`;
  const receipt = [
    `- [x] ${id}`,
    `  - Id: ${id}`,
    `  - Agent: ${agent}`,
    `  - Completed at: ${completedAt}`,
    `  - Receipt: pending reconciliation`,
  ].join('\n');

  return `${content.trimEnd()}\n\n${receipt}\n`;
}

function isPendingReceipt(receipt) {
  return /pending reconciliation/i.test(receipt.receipt || '');
}

function markReceiptReconciled(path, block, reconciledAt) {
  const content = readFileSync(path, 'utf-8');
  let nextBlock = block.replace(/^(\s+- Receipt:).+$/im, `$1 reconciled at ${reconciledAt}`);
  if (!/^\s+- Reconciled at:/im.test(nextBlock)) {
    nextBlock = `${nextBlock}\n  - Reconciled at: ${reconciledAt}`;
  }
  writeFileSync(path, content.replace(block, nextBlock), 'utf-8');
}

function laneIssue(kind, id, agent, lane, detail) {
  return { kind, id, agent: agent || '', lane: lane || '', detail };
}

function groupById(receipts) {
  const groups = new Map();
  for (const receipt of receipts) {
    if (!groups.has(receipt.id)) groups.set(receipt.id, []);
    groups.get(receipt.id).push(receipt);
  }
  return groups.entries();
}

function isOlderThan(value, now, seconds) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  return now.getTime() - time >= seconds * 1000;
}

function isoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) || new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function writeFileEnsured(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
}
