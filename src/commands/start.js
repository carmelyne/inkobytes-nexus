/**
 * nexus start - orient an agent entering a repo
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { cwd, env } from 'process';
import { spawnSync } from 'child_process';
import { listLocks } from '../lib/lockManager.js';
import { AGENT_SCOPE_ENTRIES, AGENT_SCOPES, normalizeAgentHandle } from '../lib/agentScopes.js';
import { loadPermissions, getChmodPath } from '../lib/permissions.js';

function git(args) {
  const result = spawnSync('git', args, { cwd: cwd(), encoding: 'utf-8', stdio: 'pipe' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function readFirstLines(path, maxLines = 8) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8').split('\n').slice(0, maxLines).join('\n').trim();
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] || null;
}

function latestMemoryEntry(root, scopeDir) {
  const memoryDir = join(root, scopeDir, 'memories');
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
        entries.push({ path: `${scopeDir}/memories/${month}/${file}`, mtimeMs: statSync(path).mtimeMs });
      } catch { /* ignore unreadable entries */ }
    }
  }

  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries[0]?.path || null;
}

export default function start(args = []) {
  const root = cwd();
  const agent = normalizeAgentHandle(optionValue(args, '--agent') || args[0] || env.NEXUS_AGENT);
  const scope = agent ? AGENT_SCOPES[agent] : null;
  const branch = git(['branch', '--show-current']) || '(unknown)';
  const commits = git(['log', '--oneline', '-n', '3']).split('\n').filter(Boolean);
  const dirtyFiles = git(['status', '--porcelain']).split('\n').filter(Boolean);
  const locks = listLocks();
  const continuityPath = scope ? `${scope.dir}/CONTINUITY.md` : null;
  const memoryIndexPath = scope ? `${scope.dir}/memories/INDEX.md` : null;
  const continuity = scope ? readFirstLines(join(root, continuityPath)) : null;
  const memoryEntry = scope ? latestMemoryEntry(root, scope.dir) : null;

  console.log('Nexus start');
  console.log(`Repo: ${root}`);
  console.log(`Branch: ${branch}`);
  console.log(`Agent: ${scope ? `${scope.label} (${agent})` : 'unspecified'}`);

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

  if (scope) {
    console.log(`\nContinuity (${continuityPath}):`);
    console.log(continuity ? continuity.split('\n').map((line) => `  ${line}`).join('\n') : '  missing');

    console.log(`\nLatest local memory (${memoryIndexPath}):`);
    console.log(`  ${memoryEntry || 'none'}`);
  } else {
    console.log('\nAgent memory scopes:');
    for (const [handle, item] of AGENT_SCOPE_ENTRIES) {
      console.log(`  - ${handle}: ${item.dir}/CONTINUITY.md, ${item.dir}/memories/INDEX.md`);
    }
    console.log('  Pick your model scope; do not read another model memory unless the user asks.');
  }

  // promptCHMOD — surface reference-only files so agents know what not to execute
  if (existsSync(getChmodPath())) {
    const perms = loadPermissions();
    const xOff = perms.filter(e => e.perms[2] !== 'x' && (e.agent === 'all' || e.agent === agent));
    const xOn  = perms.filter(e => e.perms[2] === 'x' && (e.agent === 'all' || e.agent === agent));
    console.log('\npromptCHMOD:');
    if (xOff.length) console.log(`  Reference only (do not execute): ${xOff.map(e => e.path).join(', ')}`);
    if (xOn.length)  console.log(`  Authoritative (execute as instructions): ${xOn.map(e => e.path).join(', ')}`);
  }

  // Trigger presence heartbeat
  if (agent) {
    spawnSync('node', [join(root, 'bin', 'nexus.js'), 'checkin', agent], { stdio: 'ignore' });
  }

  console.log('\nNext:');
  if (scope) {
    console.log('  Start is orientation only, not clearance to edit.');
    console.log(`  Read ${continuityPath} and latest ${scope.dir}/memories entry.`);
    console.log(`  Then: pick work -> nexus claim <path> ${agent} "intent" -> work only there -> nexus release <path> "message".`);
  } else {
    console.log('  Set NEXUS_AGENT or run `nexus start --agent @agy|@claude|@codex|@gemini`, then restart before claiming work.');
  }
}
