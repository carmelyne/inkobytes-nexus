import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import { buildSnapshot, resolveDashboardPort, resolveDashboardHost } from '../src/commands/dashboard.js';
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
      '  - Created: 2000-01-01',
      '  - Files: src/commands/dashboard.js',
      '  - Cost: small',
      '  - Auto-flow: yes',
      '  - Review: pending',
      '  - Notes: Show the full queue task block in the dashboard.',
    ].join('\n'), 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), [
      '# Standup',
      '- [ ] TASK/@codex: Build dashboard',
      '  - Id: dashboard-v1',
      '  - Status: Ready',
      '  - Files: src/commands/dashboard.js',
      '@codex: Dashboard v1 started',
      '2026-06-01 09:30 AM @codex [DONE]: Dashboard v1 shipped',
    ].join('\n'), 'utf-8');
    writeFileSync(join(root, '_NEXUS_REPORT.md'), [
      '# Nexus Report',
      '',
      'Structured release receipts.',
      '',
      '## [2026-05-31 12:00:00 PM] docs/README.md',
      '- Agent: @codex',
      '- Target: docs/README.md',
      '- Commit: docs: placeholder',
      '## [2026-06-01 12:01:00 PM] src/commands/dashboard.js',
      '- Agent: @codex',
      '- Target: src/commands/dashboard.js',
      '- Commit: feat: dashboard',
    ].join('\n'), 'utf-8');
    writeFileSync(join(root, '_NEXUS_LEDGER.md'), [
      '# Nexus Completed Task Ledger',
      '',
      '## dashboard-v1',
      '',
      '- Id: dashboard-v1',
      '- Title: Build dashboard',
      '- Agent: @codex',
      '- Epic: Dashboard observability',
      '- Cost: small',
      '- Completed At: 2026-05-31T12:00:00.000Z',
      '- Files: src/commands/dashboard.js',
      '- SHA: abc123',
      '- Commit: feat: dashboard',
      '',
    ].join('\n'), 'utf-8');

    const snapshot = buildSnapshot();

    assert.equal(snapshot.health.ok, true);
    assert.equal(snapshot.queue[0].id, 'dashboard-v1');
    assert.equal(snapshot.queue[0].autoFlow, 'yes');
    assert.equal(snapshot.queue[0].created, '2000-01-01');
    assert.equal(snapshot.queue[0].date, '2000-01-01');
    assert.ok(snapshot.queue[0].raw.includes('- [ ] TASK/@codex: Build dashboard'));
    assert.ok(snapshot.queue[0].raw.includes('  - Notes: Show the full queue task block in the dashboard.'));
    assert.deepEqual(snapshot.queue[0].issues, ['stale', 'review', 'approval']);
    assert.deepEqual(snapshot.queue[0].issueLabels.map(issue => issue.label), ['stale', 'review pending', 'approval needed']);
    assert.equal(snapshot.locks[0].target, 'src/app.js');
    assert.equal(snapshot.locks[0].model, 'gpt-5-codex');
    assert.equal(snapshot.locks[0].thinking, 'medium');
    assert.deepEqual(snapshot.standup, [
      { type: '@codex', title: 'Dashboard v1 shipped', meta: '2026-06-01 09:30 AM · DONE' },
      {
        type: '@codex',
        title: 'Dashboard v1 started',
        meta: '',
        warning: 'Missing date/time. Use YYYY-MM-DD HH:MM AM/PM @agent [STATUS]: message',
      },
    ]);
    assert.deepEqual(snapshot.releases, [
      { type: 'Commit', title: 'feat: dashboard', meta: '' },
      { type: 'Commit', title: 'docs: placeholder', meta: '' },
    ]);
    assert.equal(snapshot.reportIntro, '# Nexus Report\n\nStructured release receipts.');
    assert.equal(snapshot.reportBlocks[0].target, 'src/commands/dashboard.js');
    assert.equal(snapshot.reportBlocks[0].monthKey, '2026-06');
    assert.equal(snapshot.reportBlocks[1].monthLabel, 'May 2026');
    assert.ok(snapshot.report.indexOf('## [2026-06-01 12:01:00 PM] src/commands/dashboard.js') < snapshot.report.indexOf('## [2026-05-31 12:00:00 PM] docs/README.md'));
    assert.match(snapshot.report, /^# Nexus Report\n\nStructured release receipts\./);
    assert.equal(snapshot.ledger[0].id, 'dashboard-v1');
    assert.equal(snapshot.ledger[0].epic, 'Dashboard observability');
  });
});

test('dashboard default port starts at the Nexus port', () => {
  assert.equal(resolveDashboardPort([]), 13787);
  assert.equal(resolveDashboardPort(['--port', '14000']), 14000);
});

test('dashboard binds localhost unless --lan opts into network exposure', () => {
  assert.equal(resolveDashboardHost([]), '127.0.0.1');
  assert.equal(resolveDashboardHost(['--serve', '--port', '14000']), '127.0.0.1');
  assert.equal(resolveDashboardHost(['--serve', '--lan']), '0.0.0.0');
});
