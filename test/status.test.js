import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import status from '../src/commands/status.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-status-'));
  chdir(root);
  resetConfig();

  try {
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

function captureLogs(fn) {
  const originalLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));

  try {
    fn();
  } finally {
    console.log = originalLog;
  }

  return lines.join('\n');
}

test('status reports idle swarm when there are no locks or generated artifacts', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });

    const output = captureLogs(() => status([]));

    assert.match(output, /No active locks\. The swarm is idle/);
    assert.doesNotMatch(output, /Generated-looking artifacts/);
  });
});

test('status reports generated-looking artifacts that need ownership', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    mkdirSync(join(root, 'nexus-dashboard copy'), { recursive: true });
    mkdirSync(join(root, 'screenshots'), { recursive: true });
    writeFileSync(join(root, 'nexus-dashboard copy', 'index.html'), '<!doctype html>\n', 'utf-8');
    writeFileSync(join(root, 'screenshots', 'home.png'), 'not really a png\n', 'utf-8');

    const output = captureLogs(() => status([]));

    assert.match(output, /No active locks\. The swarm is idle/);
    assert.match(output, /Generated-looking artifacts need owner decision/);
    assert.match(output, /nexus-dashboard copy/);
    assert.match(output, /screenshots/);
    assert.match(output, /Decide keep\/delete\/ignore, or claim and release intentionally/);
  });
});
