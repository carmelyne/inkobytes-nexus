import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import { buildSnapshot, resolveDashboardPort } from '../src/commands/dashboard.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-dashboard-'));
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

test('dashboard snapshot summarizes Nexus repo state', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, '.nexus', 'locks', 'src~2Fapp.js.lock'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'locks', 'src~2Fapp.js.lock', 'ts'), String(Math.floor(Date.now() / 1000)), 'utf-8');
    writeFileSync(join(root, '.nexus', 'locks', 'src~2Fapp.js.lock', 'model'), 'gpt-5-codex', 'utf-8');
    writeFileSync(join(root, '.nexus', 'locks', 'src~2Fapp.js.lock', 'thinking'), 'medium', 'utf-8');
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '# Queue',
      '## Ready Queue',
      '- [ ] TASK/@codex: Build dashboard',
      '  - Id: dashboard-v1',
      '  - Status: Ready',
      '  - Files: src/commands/dashboard.js',
      '  - Cost: small',
      '  - Auto-flow: yes',
      '  - Review: approved',
      '  - Approved by: human',
    ].join('\n'), 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), [
      '# Standup',
      '- [ ] TASK/@codex: Build dashboard',
      '  - Id: dashboard-v1',
      '  - Status: Ready',
      '  - Files: src/commands/dashboard.js',
      '@codex: Dashboard v1 started',
    ].join('\n'), 'utf-8');
    writeFileSync(join(root, '_NEXUS_REPORT.md'), [
      '## [12:00:00] docs/README.md',
      '- Agent: @codex',
      '- Target: docs/README.md',
      '- Commit: docs: placeholder',
      '## [12:01:00] src/commands/dashboard.js',
      '- Agent: @codex',
      '- Target: src/commands/dashboard.js',
      '- Commit: feat: dashboard',
    ].join('\n'), 'utf-8');

    const snapshot = buildSnapshot();

    assert.equal(snapshot.health.ok, true);
    assert.equal(snapshot.queue[0].id, 'dashboard-v1');
    assert.equal(snapshot.queue[0].autoFlow, 'yes');
    assert.equal(snapshot.locks[0].target, 'src/app.js');
    assert.equal(snapshot.locks[0].model, 'gpt-5-codex');
    assert.equal(snapshot.locks[0].thinking, 'medium');
    assert.deepEqual(snapshot.standup, [
      { type: 'Task', title: 'Build dashboard', meta: '@codex · Ready · src/commands/dashboard.js' },
      { type: '@codex', title: 'Dashboard v1 started', meta: '' },
    ]);
    assert.deepEqual(snapshot.releases, [
      { type: 'Commit', title: 'docs: placeholder', meta: '' },
      { type: 'Commit', title: 'feat: dashboard', meta: '' },
    ]);
  });
});

test('dashboard default port starts at the Nexus port', () => {
  assert.equal(resolveDashboardPort([]), 13787);
  assert.equal(resolveDashboardPort(['--port', '14000']), 14000);
});
