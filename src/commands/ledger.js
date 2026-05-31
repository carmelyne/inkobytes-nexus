/**
 * nexus ledger [--json]
 * Read completed task ledger entries for dashboard/reporting.
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { getConfig } from '../lib/config.js';

export default function ledger(args) {
  const entries = readLedgerEntries();

  if (args.includes('--json')) {
    console.log(JSON.stringify({ entries, totals: buildTotals(entries) }, null, 2));
    return;
  }

  console.log('Nexus ledger');
  console.log('');
  if (!entries.length) {
    console.log('No completed task entries yet.');
    return;
  }

  for (const entry of entries.slice().reverse().slice(0, 20)) {
    console.log(`- ${entry.completedAt} ${entry.id} (${entry.agent})`);
    console.log(`  ${entry.title}`);
    console.log(`  Epic: ${entry.epic || 'unknown'} | Cost: ${entry.cost || 'unknown'}`);
    if (entry.files.length) console.log(`  Files: ${entry.files.join(', ')}`);
  }
}

export function appendCompletedLedgerEntries({ target, agent, sha, commit }) {
  const config = getConfig();
  const queueText = readText(config.queue);
  const existingIds = new Set(readLedgerEntries().map((entry) => entry.id));
  const tasks = parseQueueTasks(queueText)
    .filter((task) => task.checked)
    .filter((task) => task.id && !existingIds.has(task.id))
    .filter((task) => task.files.includes(target))
    .filter((task) => commitReferencesTask(commit, task.id));

  if (!tasks.length) return 0;
  ensureLedgerFile(config.ledger);

  const completedAt = new Date().toISOString();
  for (const task of tasks) {
    appendFileSync(config.ledger, renderEntry({
      ...task,
      agent,
      sha,
      commit,
      completedAt,
    }), 'utf-8');
  }

  return tasks.length;
}

export function readLedgerEntries() {
  const config = getConfig();
  const content = readText(config.ledger);
  const entries = [];
  const blocks = content.split(/\n(?=## )/);

  for (const block of blocks) {
    const header = block.match(/^## ([^\n]+)$/m);
    if (!header) continue;
    entries.push({
      id: readField(block, 'Id') || header[1].trim(),
      title: readField(block, 'Title'),
      agent: readField(block, 'Agent') || 'unknown',
      epic: readField(block, 'Epic'),
      cost: readField(block, 'Cost'),
      completedAt: readField(block, 'Completed At'),
      sha: readField(block, 'SHA'),
      commit: readField(block, 'Commit'),
      files: splitCsv(readField(block, 'Files')),
    });
  }

  return entries;
}

function buildTotals(entries) {
  return {
    completedTasks: entries.length,
    byAgent: countBy(entries, 'agent'),
    byEpic: countBy(entries, 'epic'),
    byCost: countBy(entries, 'cost'),
  };
}

function parseQueueTasks(content) {
  const tasks = [];
  const lines = content.split('\n');
  let current = null;

  for (const line of lines) {
    const match = line.match(/^- \[([ x])\] TASK\/([^:]+):\s*(.+)$/);
    if (match) {
      if (current) tasks.push(current);
      current = {
        checked: match[1] === 'x',
        agent: match[2].trim(),
        title: match[3].trim(),
        id: '',
        epic: '',
        files: [],
        cost: '',
      };
      continue;
    }

    if (!current) continue;
    const field = line.trim().match(/^- ([^:]+):\s*(.*)$/);
    if (!field) continue;

    const key = field[1].toLowerCase();
    const value = field[2].trim();
    if (key === 'id') current.id = value;
    if (key === 'epic') current.epic = value;
    if (key === 'files') current.files = splitCsv(value);
    if (key === 'cost') current.cost = value;
  }

  if (current) tasks.push(current);
  return tasks;
}

function ensureLedgerFile(path) {
  if (existsSync(path)) return;
  writeFileSync(path, '# Nexus Completed Task Ledger\n\n', 'utf-8');
}

function renderEntry(entry) {
  return `## ${entry.id}

- Id: ${entry.id}
- Title: ${entry.title}
- Agent: ${entry.agent || 'unknown'}
- Epic: ${entry.epic || 'unknown'}
- Cost: ${entry.cost || 'unknown'}
- Completed At: ${entry.completedAt}
- Files: ${entry.files.join(', ')}
- SHA: ${entry.sha || 'unknown'}
- Commit: ${entry.commit || ''}

`;
}

function readText(path) {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

function readField(block, label) {
  return block.match(new RegExp(`^- ${label}: (.*)$`, 'm'))?.[1]?.trim() || '';
}

function splitCsv(value) {
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function commitReferencesTask(commit, taskId) {
  const normalizedCommit = String(commit || '').toLowerCase();
  return normalizedCommit.includes(taskId.toLowerCase());
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key] || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}
