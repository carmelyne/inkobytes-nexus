import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import metrics from '../src/commands/metrics.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-metrics-'));
  chdir(root);
  resetConfig();

  try {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.name', 'Test Agent'], { cwd: root, stdio: 'pipe' });
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

function commit(root, file, body, message) {
  writeFileSync(join(root, file), body, 'utf-8');
  spawnSync('git', ['add', file], { cwd: root, stdio: 'pipe' });
  spawnSync('git', ['commit', '-m', message], { cwd: root, stdio: 'pipe' });
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

test('metrics summarizes git commits, release receipts, and queue costs', () => {
  inTempRepo((root) => {
    commit(root, 'a.md', 'a\n', '[@codex] add a');
    commit(root, 'b.md', 'b\n', '[@claude] add b');
    writeFileSync(join(root, '_NEXUS_REPORT.md'), [
      '# Nexus Report',
      '',
      '## [12:00:00] a.md',
      '',
      '- Agent: @codex',
      '- Target: a.md',
      '- SHA: 1111111111111111111111111111111111111111',
      '- Commit: add a',
      '## [12:01:00] a.md',
      '',
      '- Agent: @claude',
      '- Target: a.md',
      '- SHA: 2222222222222222222222222222222222222222',
      '- Commit: add b',
    ].join('\n'), 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '- [ ] TASK/Codex: One',
      '  - Cost: small',
      '- [ ] TASK/Codex: Two',
      '  - Cost: medium',
      '- [ ] TASK/Codex: Three',
      '  - Cost: small',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => metrics([]));

    assert.match(output, /Nexus metrics/);
    assert.match(output, /Totals: 2 commits, 2 release receipt\(s\)/);
    assert.match(output, /@codex: 1/);
    assert.match(output, /@claude: 1/);
    assert.match(output, /a\.md: 2/);
    assert.match(output, /small: 2/);
    assert.match(output, /medium: 1/);
  });
});

test('metrics --json emits structured summary', () => {
  inTempRepo((root) => {
    commit(root, 'a.md', 'a\n', '[@codex] add a');
    writeFileSync(join(root, '_NEXUS_REPORT.md'), [
      '## [12:00:00] a.md',
      '',
      '- Agent: @codex',
      '- Target: a.md',
      '- SHA: 1111111111111111111111111111111111111111',
      '- Commit: add a',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => metrics(['--json']));
    const summary = JSON.parse(output);

    assert.equal(summary.totals.commits, 1);
    assert.equal(summary.totals.releases, 1);
    assert.equal(summary.commitsByAgent['@codex'], 1);
    assert.equal(summary.releasesByAgent['@codex'], 1);
  });
});
