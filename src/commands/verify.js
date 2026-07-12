import { existsSync, readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { getConfig } from '../lib/config.js';
import { parseReadyTasks } from '../lib/queue.js';

export default function verify(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printVerifyHelp();
    return;
  }

  const id = args.find(arg => !arg.startsWith('--'));
  if (!id) {
    console.error('Usage: nexus verify <task-id>');
    process.exit(1);
  }

  const config = getConfig();
  const tasks = existsSync(config.queue) ? parseReadyTasks(readFileSync(config.queue, 'utf-8')) : [];
  const task = tasks.find(entry => entry.id === id);
  if (!task) {
    console.error(`[ERROR] Unknown task id: ${id}`);
    process.exit(1);
  }

  const receipts = readReportReceipts(config.report).filter(receipt => receipt.commit.includes(id));
  const verifiable = receipts.filter(receipt => isFullSha(receipt.sha) && commitExists(config.root, receipt.sha));

  console.log(`[VERIFY ${id}]`);
  console.log(`Task: ${task.title}`);
  console.log(`Files: ${task.files.join(', ') || '(none declared)'}`);

  if (!verifiable.length) {
    console.error('[ERROR] No release receipts with existing commit hashes matched this task id.');
    if (receipts.length) {
      console.error(`Matched receipt(s): ${receipts.length}; verifiable: 0.`);
    }
    console.log('Status: failed');
    process.exit(1);
  }

  const scoped = task.files.filter(file => file && !file.startsWith('/'));
  const results = verifiable.map(receipt => {
    const changedFiles = changedFilesForCommit(config.root, receipt.sha);
    const inScopeFiles = changedFiles.filter(file => isInScope(file, scoped));
    return { ...receipt, changedFiles, inScopeFiles };
  });

  console.log('Commits:');
  for (const result of results) {
    const scopeLabel = result.inScopeFiles.length ? 'in-scope' : 'out-of-scope-only';
    console.log(`- ${result.sha.slice(0, 7)} ${scopeLabel}: ${result.commit}`);
  }

  const inScopeResults = results.filter(result => result.inScopeFiles.length);
  if (!inScopeResults.length) {
    console.error('[ERROR] Matched receipt commits have out-of-scope-only changes.');
    for (const result of results) {
      console.error(`- ${result.sha.slice(0, 7)} changed: ${result.changedFiles.join(', ') || '(none)'}`);
    }
    console.log('Status: failed');
    process.exit(1);
  }

  console.log('In-scope diffstat:');
  for (const result of inScopeResults) {
    const stat = diffstatForCommit(config.root, result.sha, scoped);
    console.log(stat || `  ${result.sha.slice(0, 7)} touched ${result.inScopeFiles.join(', ')}`);
  }
  console.log('Status: ok');
}

function printVerifyHelp() {
  console.log([
    'Usage: nexus verify <task-id>',
    '',
    'Checks recorded release receipts for a task id against git commits.',
    'Reports matched commits and whether they changed files declared on the task.',
  ].join('\n'));
}

function readReportReceipts(reportPath) {
  if (!existsSync(reportPath)) return [];

  const receipts = [];
  for (const block of readFileSync(reportPath, 'utf-8').split(/\n(?=## \[)/)) {
    const sha = field(block, 'SHA');
    const commit = field(block, 'Commit');
    const target = field(block, 'Target');
    if (sha || commit || target) receipts.push({ sha, commit, target, block });
  }
  return receipts;
}

function field(block, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`^- ${escaped}:\\s*(.+)$`, 'im'));
  return match ? match[1].trim() : '';
}

function isFullSha(value) {
  return /^[0-9a-f]{40}$/i.test(value || '');
}

function commitExists(root, sha) {
  const result = spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], {
    cwd: root,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function changedFilesForCommit(root, sha) {
  const result = spawnSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', sha], {
    cwd: root,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) return [];
  return result.stdout.split('\n').map(line => line.trim()).filter(Boolean);
}

function diffstatForCommit(root, sha, scoped) {
  const args = ['show', '--stat', '--format=', '--no-renames', sha];
  if (scoped.length) args.push('--', ...scoped);
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) return '';
  return result.stdout.trimEnd();
}

function isInScope(changedFile, scoped) {
  if (!scoped.length) return false;
  return scoped.some(scope => changedFile === scope || changedFile.startsWith(`${scope.replace(/\/+$/, '')}/`));
}
