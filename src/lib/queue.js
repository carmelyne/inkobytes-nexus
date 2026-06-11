import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';

export const LANE_AGENT_PATTERN = /^@[a-z][a-z0-9_-]*$/i;

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
    if (id) completed.push({ id, block });
  }

  return { active, completed };
}

export function delegatedTaskIds(root, agents = ['@codex', '@claude', '@gemini', '@agy']) {
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

function parseLaneActive(content) {
  return splitBlocks(extractSection(content, '## Active')).map(block => ({
    id: parseField(block, 'Id'),
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

function writeFileEnsured(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
}
