import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import {
  acquireLock,
  breakStaleLocks,
  getLockPath,
  isSweepEligible,
  listLocks,
  releaseLock,
} from '../src/lib/lockManager.js';
import { getConfig, resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-lock-manager-'));
  chdir(root);
  resetConfig();

  try {
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

test('acquireLock writes timestamp, agent, intent, subagent, model, and thinking metadata', () => {
  inTempRepo(() => {
    const result = acquireLock('file.txt', '@codex', 'test metadata', 2, {
      model: 'gpt-5-codex',
      thinking: 'medium',
    });

    assert.equal(result.success, true);
    const lockPath = getLockPath('file.txt');
    assert.ok(existsSync(join(lockPath, 'ts')));
    assert.equal(readFileSync(join(lockPath, 'agent'), 'utf-8'), '@codex');
    assert.equal(readFileSync(join(lockPath, 'intent'), 'utf-8'), 'test metadata');
    assert.equal(readFileSync(join(lockPath, 'subagents'), 'utf-8'), '2');
    assert.equal(readFileSync(join(lockPath, 'model'), 'utf-8'), 'gpt-5-codex');
    assert.equal(readFileSync(join(lockPath, 'thinking'), 'utf-8'), 'medium');
    assert.equal(readFileSync(join(lockPath, 'claim-head'), 'utf-8'), 'unknown');
  });
});

test('acquireLock records current git HEAD when available', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.name', 'Test Agent'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');
    spawnSync('git', ['add', 'file.txt'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
    const head = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).stdout.trim();

    const result = acquireLock('file.txt', '@codex', 'test claim head');

    assert.equal(result.success, true);
    assert.equal(readFileSync(join(getLockPath('file.txt'), 'claim-head'), 'utf-8'), head);
  });
});

test('releaseLock removes lock directory and metadata files', () => {
  inTempRepo(() => {
    acquireLock('file.txt', '@codex', 'test release cleanup', 1);
    const lockPath = getLockPath('file.txt');

    const result = releaseLock('file.txt');

    assert.equal(result.success, true);
    assert.equal(existsSync(lockPath), false);
  });
});

test('listLocks reads lock metadata and defaults missing subagents to zero', () => {
  inTempRepo(() => {
    acquireLock('file.txt', '@codex', 'test list metadata', 0, {
      model: 'gpt-5-codex',
      thinking: 'medium',
    });

    const locks = listLocks();

    assert.equal(locks.length, 1);
    assert.equal(locks[0].target, 'file.txt');
    assert.equal(locks[0].agent, '@codex');
    assert.equal(locks[0].intent, 'test list metadata');
    assert.equal(locks[0].subagents, 0);
    assert.equal(locks[0].model, 'gpt-5-codex');
    assert.equal(locks[0].thinking, 'medium');
    assert.equal(locks[0].claimHead, 'unknown');
    assert.equal(typeof locks[0].age, 'number');
  });
});

function backdateLock(target, seconds) {
  const tsFile = join(getLockPath(target), 'ts');
  writeFileSync(tsFile, String(Math.floor(Date.now() / 1000) - seconds), 'utf-8');
}

test('progressAwareStale defaults to true and honors an explicit false', () => {
  inTempRepo((root) => {
    assert.equal(getConfig().progressAwareStale, true);

    resetConfig();
    writeFileSync(join(root, 'placeholder.txt'), 'x\n', 'utf-8');
    spawnSync('mkdir', ['-p', join(root, '.nexus')], { stdio: 'pipe' });
    writeFileSync(join(root, '.nexus', 'config.json'), '{ "progressAwareStale": false }', 'utf-8');
    assert.equal(getConfig().progressAwareStale, false);
  });
});

test('breakStaleLocks spares an old lock whose claimed blob moved', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'working.txt'), 'v1\n', 'utf-8');
    writeFileSync(join(root, 'silent.txt'), 'v1\n', 'utf-8');
    acquireLock('working.txt', '@claude', 'long implementation session');
    acquireLock('silent.txt', '@claude', 'abandoned work');
    backdateLock('working.txt', 700);
    backdateLock('silent.txt', 700);
    writeFileSync(join(root, 'working.txt'), 'v2 — real work happened\n', 'utf-8');

    const broken = breakStaleLocks();

    assert.deepEqual(broken.map((b) => b.target), ['silent.txt']);
    assert.deepEqual(listLocks().map((l) => l.target), ['working.txt']);
  });
});

test('breakStaleLocks sweeps by age alone when progressAwareStale is false', () => {
  inTempRepo((root) => {
    spawnSync('mkdir', ['-p', join(root, '.nexus')], { stdio: 'pipe' });
    writeFileSync(join(root, '.nexus', 'config.json'), '{ "progressAwareStale": false }', 'utf-8');
    writeFileSync(join(root, 'working.txt'), 'v1\n', 'utf-8');
    acquireLock('working.txt', '@claude', 'long implementation session');
    backdateLock('working.txt', 700);
    writeFileSync(join(root, 'working.txt'), 'v2 — progress does not matter in age-only mode\n', 'utf-8');

    const broken = breakStaleLocks();

    assert.deepEqual(broken.map((b) => b.target), ['working.txt']);
    assert.equal(listLocks().length, 0);
  });
});

test('acquireLock still auto-breaks an old lock with no progress signal', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'silent.txt'), 'v1\n', 'utf-8');
    acquireLock('silent.txt', '@codex', 'crashed session');
    backdateLock('silent.txt', 700);

    const result = acquireLock('silent.txt', '@claude', 'taking over');

    assert.equal(result.success, true);
    assert.equal(listLocks()[0].agent, '@claude');
  });
});

test('regression: the 2026-06-11 incident shape survives the sweep', () => {
  inTempRepo((root) => {
    // 75-minute session against the 600s threshold, blob moving = working.
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue v1\n', 'utf-8');
    acquireLock('_NEXUS_QUEUE.md', '@claude', 'mid-release chain');
    backdateLock('_NEXUS_QUEUE.md', 75 * 60);
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue v2 — task flipped during session\n', 'utf-8');

    const lock = listLocks()[0];
    assert.equal(isSweepEligible(lock), false, 'a working lock must not be sweep-eligible');

    const broken = breakStaleLocks();
    assert.equal(broken.length, 0);
    assert.equal(listLocks()[0].agent, '@claude', 'attribution survives — no Agent: unknown');
  });
});

test('listLocks ignores non-lock entries in the lock directory', () => {
  inTempRepo((root) => {
    acquireLock('file.txt', '@codex', 'test ignore noise');
    writeFileSync(join(root, '.nexus', 'locks', 'README.md'), 'noise\n', 'utf-8');

    const locks = listLocks();

    assert.equal(locks.length, 1);
    assert.equal(locks[0].target, 'file.txt');
  });
});
