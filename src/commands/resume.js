/**
 * nexus resume - summarize local repo state for a fresh agent session
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import { spawnSync } from 'child_process';
import { listLocks } from '../lib/lockManager.js';

function git(args) {
  const result = spawnSync('git', args, { cwd: cwd(), encoding: 'utf-8', stdio: 'pipe' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function readFirstLines(path, maxLines = 8) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8').split('\n').slice(0, maxLines).join('\n').trim();
}

function latestMemoryEntry(root) {
  const memoryDir = join(root, '.codex', 'memories');
  if (!existsSync(memoryDir)) return null;

  const entries = [];
  for (const month of readdirSync(memoryDir)) {
    const monthPath = join(memoryDir, month);
    try {
      if (!statSync(monthPath).isDirectory()) continue;
    } catch {
      continue;
    }

    for (const file of readdirSync(monthPath)) {
      if (!file.endsWith('.md')) continue;
      const path = join(monthPath, file);
      try {
        entries.push({ path: `.codex/memories/${month}/${file}`, mtimeMs: statSync(path).mtimeMs });
      } catch { /* ignore unreadable entries */ }
    }
  }

  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries[0]?.path || null;
}

export default function resume() {
  const root = cwd();
  const branch = git(['branch', '--show-current']) || '(unknown)';
  const commits = git(['log', '--oneline', '-n', '3']).split('\n').filter(Boolean);
  const dirtyFiles = git(['status', '--porcelain']).split('\n').filter(Boolean);
  const locks = listLocks();
  const continuity = readFirstLines(join(root, '.codex', 'CONTINUITY.md'));
  const memoryEntry = latestMemoryEntry(root);

  console.log('Nexus resume');
  console.log(`Repo: ${root}`);
  console.log(`Branch: ${branch}`);

  console.log('\nLast commits:');
  if (commits.length) {
    for (const commit of commits) console.log(`  - ${commit}`);
  } else {
    console.log('  none');
  }

  console.log(`\nDirty files: ${dirtyFiles.length}`);
  for (const file of dirtyFiles.slice(0, 20)) console.log(`  - ${file}`);
  if (dirtyFiles.length > 20) console.log(`  ... ${dirtyFiles.length - 20} more`);

  console.log(`\nLocks: ${locks.length}`);
  for (const lock of locks) {
    const age = lock.age === null ? 'unknown age' : `${lock.age}s old`;
    console.log(`  - ${lock.target} (${age})`);
  }

  console.log('\nContinuity:');
  console.log(continuity ? continuity.split('\n').map((line) => `  ${line}`).join('\n') : '  missing');

  console.log('\nLatest local memory:');
  console.log(`  ${memoryEntry || 'none'}`);
}
