import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import claim from '../src/commands/claim.js';
import { resetConfig } from '../src/lib/config.js';
import { listLocks } from '../src/lib/lockManager.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-claim-'));
  chdir(root);
  resetConfig();

  try {
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

function capture(fn) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  console.warn = (...args) => lines.push(args.join(' '));

  try {
    fn();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }

  return lines.join('\n');
}

test('claim warns cheaply when Nexus protocol files are missing', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');

    const output = capture(() => claim(['file.txt', '@codex', 'test claim warning']));

    assert.match(output, /Missing Nexus protocol files/);
    assert.match(output, /Run `nexus doctor`/);
    assert.match(output, /START OF FRESH FILE STATE/);
  });
});

test('claim nudges non-canonical shared model lock handles', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');

    const output = capture(() => claim(['file.txt', '@my_gemini', 'test handle warning']));

    assert.match(output, /Use CLI\/model names as lock handles/);
    assert.match(output, /@agy, @claude, @codex, or @gemini/);
  });
});

test('claim stores operator-declared model and thinking metadata', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');

    capture(() => claim(['file.txt', '@codex', 'test metadata', '--model', 'gpt-5-codex', '--thinking', 'medium']));

    const locks = listLocks();
    assert.equal(locks.length, 1);
    assert.equal(locks[0].model, 'gpt-5-codex');
    assert.equal(locks[0].thinking, 'medium');
  });
});
