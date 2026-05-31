import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import {
  acquireLock,
  getLockPath,
  listLocks,
  releaseLock,
} from '../src/lib/lockManager.js';
import { resetConfig } from '../src/lib/config.js';

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
    assert.equal(typeof locks[0].age, 'number');
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
