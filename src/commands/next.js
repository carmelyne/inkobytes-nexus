/**
 * nexus next <agent>
 * Budget-aware task suggestion from the ready queue.
 */

import { readFileSync, existsSync } from 'fs';
import { getConfig } from '../lib/config.js';
import { readBoard } from '../lib/blackboard.js';
import { contractViolations, TASK_PRIMITIVES, primitiveGaps } from '../lib/taskContract.js';
import { spawnSync } from 'child_process';
import { refuseIfHalted } from './halt.js';
import {
  delegatedTaskIds,
  delegateTask,
  extractSection,
  parseReadyTasks,
} from '../lib/queue.js';

export default function next(args) {
  refuseIfHalted('next');

  const take = args.includes('--take');
  const agent = args.find(arg => !arg.startsWith('--'));

  if (!agent) {
    console.error('Usage: nexus next <agent_name> [--take]');
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
  const delegatedIds = delegatedTaskIds(config.root);

  // Score and filter tasks — only Ready Queue, only human-approved auto-flow.
  // At autonomy 1+ the queue is the program: the full task contract applies,
  // and skipped tasks are reported so the human can repair them.
  const contractSkipped = [];
  const skipped = [];
  const candidates = [];
  for (const task of tasks) {
    const reason = skipReasonForTask(task, {
      config,
      tasks,
      root: config.root,
      claimedFiles,
      delegatedIds,
      budget,
      contractSkipped,
    });
    if (reason) skipped.push({ id: task.id || task.title, reason });
    else candidates.push(task);
  }

  if (contractSkipped.length) {
    console.log(`⚠️  Task contract (autonomy ${config.autonomy}): skipped ${contractSkipped.length} auto-flow task(s) with missing fields:`);
    for (const { id, violations } of contractSkipped) {
      console.log(`   - ${id}: needs ${violations.map(v => v.needs).join(', ')}`);
    }
    console.log('   Repair the fields in _NEXUS_QUEUE.md or move the task to ## Proposed Queue.');
  }

  if (candidates.length === 0) {
    console.log(`📋 No safe auto-flow tasks available for ${agent}. Standby.`);
    printSkippedCandidates(skipped);
    printSampleTaskPointer(tasks);
    return;
  }

  // Prefer same-runway, lower cost
  const scored = candidates.map(t => ({
    ...t,
    score: scoreTask(t, runway),
  })).sort((a, b) => b.score - a.score);

  const pick = scored[0];
  console.log(`\nNEXUS SUGGESTS for ${agent}:`);
  console.log(`   Task: ${pick.id}`);
  console.log(`   Epic: ${pick.epic}`);
  console.log(`   Files: ${pick.files.join(', ')}`);
  console.log(`   Cost: ${pick.cost || 'unspecified (treated as medium)'}`);
  console.log(`   Auto-flow: ${pick.autoFlow}`);
  printTaskPrimitives(pick, config.autonomy);
  printRelatedDrills(pick);

  if (take) {
    const result = delegateTask({
      root: config.root,
      queuePath: config.queue,
      queueContent,
      task: pick,
      agent,
    });
    console.log('');
    console.log(`   Delegated: ${pick.id} -> ${result.lane}`);
    console.log(`   Delegated at: ${result.delegatedAt}`);
    console.log('   Receipt: pending reconciliation');
  }

  console.log('');
}

function printSampleTaskPointer(tasks) {
  const sampleTasks = tasks.filter(t => String(t.status || '').toLowerCase() === 'sample');
  if (sampleTasks.length === 0) return;

  console.log(`   Sample tasks found: ${sampleTasks.map(t => t.id || t.title).join(', ')}`);
  console.log('   They are documentation only. Copy one into real queue work with Status: Ready and Auto-flow: yes after human approval.');
}

function printSkippedCandidates(skipped) {
  if (skipped.length === 0) return;

  console.log('   Skipped candidates:');
  for (const { id, reason } of skipped) {
    console.log(`   - ${id}: ${reason}`);
  }
}

function skipReasonForTask(task, {
  config,
  tasks,
  root,
  claimedFiles,
  delegatedIds,
  budget,
  contractSkipped,
}) {
  if (hasAmbiguousTaskState(task)) return 'ambiguous task state';
  if (isDoneTask(task)) return 'done';
  if (task.status !== 'Ready') return `status ${task.status || 'missing'}`;
  if (task.autoFlow !== 'yes') return `auto-flow ${task.autoFlow || 'missing'}`;

  if (config.autonomy < 1) {
    if (task.review !== 'approved') return `review ${task.review || 'missing'}`;
  } else {
    const violations = contractViolations(task);
    if (violations.length) {
      contractSkipped.push({ id: task.id || task.title, violations });
      return `task contract missing ${violations.map(v => v.needs).join(', ')}`;
    }
  }

  if (delegatedIds.has(task.id)) return 'delegated lane state';
  if (hasFileConflict(task.files, claimedFiles)) return 'claimed file conflict';
  if (!dependenciesMet(task.dependsOn, tasks, root)) return `dependency ${task.dependsOn} not met`;
  if (task.cost === 'spiky') return 'cost spiky';
  if (!fitsbudget(task.cost, budget)) return 'budget exceeded';
  return '';
}

function hasAmbiguousTaskState(task) {
  return task.status === 'Ready' && (task.checkbox === 'x' || Boolean(task.done));
}

function isDoneTask(task) {
  return task.checkbox === 'x' || task.status === 'Done' || Boolean(task.done);
}

// Task primitives travel with the suggestion so the agent starts with the
// full contract: Outcome + Evidence + Stop If say when it is finished and
// when it must stop for a human.
function printTaskPrimitives(task, autonomy) {
  for (const { field, key } of TASK_PRIMITIVES) {
    if (String(task[key] || '').trim()) console.log(`   ${field}: ${task[key]}`);
  }

  const gaps = primitiveGaps(task);
  if (gaps.length) {
    console.log(`   Primitives missing: ${gaps.map(g => g.field).join(', ')} (advisory at autonomy ${autonomy}; doctor requires them at autonomy 2)`);
  }
}

const DATA_MUTATION_DRILL = `data-mutation-${'delete-rows'}`;

const DRILL_GROUPS = [
  {
    group: 'data',
    hints: [
      { id: DATA_MUTATION_DRILL, keywords: ['db', 'database', 'migration', 'persisted'] },
      { id: 'data-boundary-table-header', keywords: ['table header', 'table headers', 'columns', 'csv headers', 'schema'] },
    ],
  },
  {
    group: 'removal',
    hints: [
      { id: 'vendor-cleanup-preserve-history', keywords: ['payment vendor', 'audit log', 'audit logs', 'historical records', 'all traces'] },
      { id: 'removal-scope', keywords: ['vendor', 'dependency', 'legacy integration', 'remove', 'cleanup'] },
      { id: 'task-contract', keywords: ['completely', 'broad task', 'remove all', 'all traces', 'migration'] },
    ],
  },
  {
    group: 'publish',
    hints: [
      { id: 'private-path-protection', keywords: ['publish', 'npm', 'package', 'public', 'privacy', 'private'] },
      { id: 'remove-agent-folders-from-git', keywords: ['untrack', 'gitignore', '.codex', '.claude', '.gemini', '.agy', '.nexus/local', 'user.md'] },
    ],
  },
  {
    group: 'git',
    hints: [
      { id: 'wrong-repo-push', keywords: ['push', 'remote', 'github', 'origin'] },
      { id: 'stale-lock-after-commit', keywords: ['stale lock', 'stale locks', 'nexus clean', 'lock cleanup'] },
    ],
  },
  {
    group: 'protocol',
    hints: [
      { id: 'queue-is-thin-index', keywords: ['_nexus_queue.md', 'queue', 'task plan', 'handoff'] },
      { id: 'current-file-state', keywords: ['current file', 'edited', 'existing file', 'stale context'] },
      { id: 'ghost-file-claim-loop', keywords: ['pre-claim', 'claim loop', 'fresh file state'] },
      { id: 'claim-before-edit', keywords: ['readme', 'docs', 'edit', 'update', 'modify'] },
      { id: 'start-does-not-replace-claim-release', keywords: ['nexus start', 'start then edit'] },
      { id: 'done-claim-adversarial', keywords: ['done', 'validated', 'verification', 'release'] },
    ],
  },
];

function printRelatedDrills(task) {
  const drills = relatedDrillsForTask(task);
  if (drills.length === 0) return;

  console.log('');
  console.log('   Related Drills:');
  for (const id of drills) {
    console.log(`   - ${id}`);
  }
  console.log('   Run `nexus drill show <id>` if the task matches that risk.');
}

function relatedDrillsForTask(task) {
  if (task.drills.length > 0) return task.drills;

  const haystack = [
    task.title,
    task.id,
    task.epic,
    task.dependsOn,
    task.files.join(' '),
    task.affinity.join(' '),
    task.notes,
  ].join(' ').toLowerCase();

  const matches = [];
  for (const group of DRILL_GROUPS) {
    for (const hint of group.hints) {
      if (hint.keywords.some(keyword => haystack.includes(keyword))) {
        matches.push(hint.id);
      }
    }
  }
  return [...new Set(matches)];
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
