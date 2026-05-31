/**
 * nexus next <agent>
 * Budget-aware task suggestion from the ready queue.
 */

import { readFileSync, existsSync } from 'fs';
import { getConfig } from '../lib/config.js';
import { readBoard } from '../lib/blackboard.js';
import { spawnSync } from 'child_process';

export default function next(args) {
  const agent = args[0];

  if (!agent) {
    console.error('Usage: nexus next <agent_name>');
    process.exit(1);
  }

  const config = getConfig();

  // Read queue file
  if (!existsSync(config.queue)) {
    console.log('No _NEXUS_QUEUE.md found. Nothing to suggest.');
    return;
  }

  const queueContent = readFileSync(config.queue, 'utf-8');
  const boardContent = readBoard();

  // Parse runway for this agent
  const runway = parseRunway(queueContent, agent);

  // Parse ready tasks
  const tasks = parseReadyTasks(queueContent);

  if (tasks.length === 0) {
    console.log(`📋 No Ready tasks in queue. Standby.`);
    return;
  }

  // Get currently claimed files from blackboard
  const claimedFiles = parseClaimed(boardContent);

  // Load budget if available
  const budget = loadBudget(config.budgetFile, agent);

  // Score and filter tasks — only Ready Queue, only human-approved auto-flow
  const candidates = tasks
    .filter(t => t.status === 'Ready')
    .filter(t => t.autoFlow === 'yes')
    .filter(t => t.review === 'approved')
    .filter(t => !hasFileConflict(t.files, claimedFiles))
    .filter(t => dependenciesMet(t.dependsOn, tasks, config.root))
    .filter(t => t.cost !== 'spiky')
    .filter(t => fitsbudget(t.cost, budget));

  if (candidates.length === 0) {
    console.log(`📋 No safe auto-flow tasks available for ${agent}. Standby.`);
    return;
  }

  // Prefer same-runway, lower cost
  const scored = candidates.map(t => ({
    ...t,
    score: scoreTask(t, runway),
  })).sort((a, b) => b.score - a.score);

  const pick = scored[0];
  console.log(`\n🐝 NEXUS SUGGESTS for ${agent}:`);
  console.log(`   Task: ${pick.id}`);
  console.log(`   Epic: ${pick.epic}`);
  console.log(`   Files: ${pick.files.join(', ')}`);
  console.log(`   Cost: ${pick.cost}`);
  console.log(`   Auto-flow: ${pick.autoFlow}`);
  console.log('');
}

function parseRunway(content, agent) {
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes(agent) && line.includes('->')) {
      return line
        .split(':').slice(1).join(':')
        .split('->')
        .map(s => s.trim());
    }
  }
  return [];
}

function extractSection(content, heading) {
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

function parseReadyTasks(content) {
  // Only read from ## Ready Queue — Proposed section is invisible to nexus next
  const sectionContent = extractSection(content, '## Ready Queue');
  const tasks = [];
  const lines = sectionContent.split('\n');
  let current = null;

  for (const line of lines) {
    const taskMatch = line.match(/^- \[[ x]\] TASK\/.+?:\s*(.+)/);
    if (taskMatch) {
      if (current) tasks.push(current);
      current = {
        title: taskMatch[1],
        id: '',
        epic: '',
        status: '',
        dependsOn: '',
        files: [],
        affinity: [],
        cost: 'medium',
        autoFlow: 'no',
        review: '',
        approvedBy: '',
      };
      continue;
    }

    if (current && line.match(/^\s+-\s/)) {
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
        case 'files': current.files = val.split(',').map(s => s.trim()); break;
        case 'affinity': current.affinity = val.split(',').map(s => s.trim()); break;
        case 'cost': current.cost = val; break;
        case 'auto-flow': current.autoFlow = val; break;
        case 'review': current.review = val.toLowerCase(); break;
        case 'approved by': current.approvedBy = val; break;
      }
    }
  }

  if (current) tasks.push(current);
  return tasks;
}

function parseClaimed(boardContent) {
  return boardContent
    .split('\n')
    .filter(l => l.includes('🔒'))
    .map(l => {
      const match = l.match(/\*\*(.+?)\*\*/);
      return match ? match[1] : '';
    })
    .filter(Boolean);
}

function hasFileConflict(taskFiles, claimedFiles) {
  for (const tf of taskFiles) {
    for (const cf of claimedFiles) {
      if (tf.startsWith(cf) || cf.startsWith(tf)) return true;
    }
  }
  return false;
}

function dependenciesMet(dep, allTasks, root) {
  if (!dep || dep === 'none') return true;

  // Check if it's a task ID
  const depTask = allTasks.find(t => t.id === dep);
  if (depTask) return depTask.status === 'Done';

  // Check if it's a git commit ref
  const result = spawnSync('git', ['cat-file', '-t', dep], {
    cwd: root,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  return result.status === 0;
}

function fitsbudget(cost, budget) {
  if (!budget) return true; // no budget file = no constraint

  const costMap = { small: 5, medium: 15, large: 30, spiky: 50 };
  const taskCost = costMap[cost] || 15;
  const remaining = budget.session_budget - budget.used_session;

  return taskCost <= remaining;
}

function loadBudget(budgetFile, agent) {
  if (!existsSync(budgetFile)) return null;

  try {
    const data = JSON.parse(readFileSync(budgetFile, 'utf-8'));
    return data[agent] || null;
  } catch {
    return null;
  }
}

function scoreTask(task, runway) {
  let score = 0;

  // Runway position bonus (earlier = better)
  const runwayIdx = runway.findIndex(r =>
    task.epic.toLowerCase().includes(r.toLowerCase()) ||
    r.toLowerCase().includes(task.epic.toLowerCase())
  );
  if (runwayIdx >= 0) score += (10 - runwayIdx);

  // Cost preference (smaller = safer)
  const costScore = { small: 3, medium: 2, large: 1, spiky: 0 };
  score += costScore[task.cost] || 0;

  return score;
}
