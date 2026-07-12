import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import hooks, { hookScriptContent, hookStatus } from '../src/commands/hooks.js';
import doctor from '../src/commands/doctor.js';

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

test('hooks install writes Codex hook to explicit target', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexus-hooks-'));
  const target = join(root, 'pre_tool_use_guard.py');

  const output = captureLogs(() => hooks(['install', '--agent', '@codex', '--target', target]));

  assert.match(output, /Installed Nexus Codex hook/);
  assert.ok(existsSync(target));
  const content = readFileSync(target, 'utf-8');
  assert.match(content, /NEXUS_HOOK_TEMPLATE_V2/);
  assert.match(content, /NEXUS_AGENT = '@codex'/);
  assert.match(content, /nexus claim \{first_rel\} \{NEXUS_AGENT\}/);
});

test('hooks install --agent all writes every supported hook to default targets', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexus-hooks-home-'));
  const previousHome = process.env.HOME;
  process.env.HOME = root;

  try {
    const output = captureLogs(() => hooks(['install', '--agent', 'all']));

    assert.match(output, /Installed Nexus Codex hook/);
    assert.match(output, /Installed Nexus Claude hook/);
    assert.match(output, /Installed Nexus Gemini hook/);
    assert.match(readFileSync(join(root, '.codex', 'hooks', 'pre_tool_use_guard.py'), 'utf-8'), /NEXUS_AGENT = '@codex'/);
    assert.match(readFileSync(join(root, '.claude', 'hooks', 'nexus_pre_tool_use_guard.py'), 'utf-8'), /NEXUS_AGENT = '@claude'/);
    assert.match(readFileSync(join(root, '.gemini', 'hooks', 'nexus_pre_tool_use_guard.py'), 'utf-8'), /NEXUS_AGENT = '@gemini'/);
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
  }
});

test('hooks install --agent all rejects a single explicit target', () => {
  assert.throws(
    () => hooks(['install', '--agent', 'all', '--target', '/tmp/nexus-hook.py']),
    /--agent all/,
  );
});

test('hooks install keeps existing current hook unless forced', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexus-hooks-'));
  const target = join(root, 'pre_tool_use_guard.py');

  captureLogs(() => hooks(['install', '--agent', '@claude', '--target', target]));
  const output = captureLogs(() => hooks(['install', '--agent', '@claude', '--target', target]));

  assert.match(output, /already current/);
  assert.match(output, /--force/);
});

test('hooks install does not overwrite foreign hooks without force', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexus-hooks-'));
  const target = join(root, 'pre_tool_use_guard.py');
  writeFileSync(target, 'custom hook\n', 'utf-8');

  const output = captureLogs(() => hooks(['install', '--agent', '@gemini', '--target', target]));

  assert.match(output, /already exists/);
  assert.equal(readFileSync(target, 'utf-8'), 'custom hook\n');

  captureLogs(() => hooks(['install', '--agent', '@gemini', '--target', target, '--force']));
  assert.match(readFileSync(target, 'utf-8'), /NEXUS_AGENT = '@gemini'/);
});

test('hooks rejects unsupported agents', () => {
  assert.throws(
    () => hooks(['install', '--agent', '@agy']),
    /Usage: nexus hooks install/,
  );
});

test('hook template includes compact multi-file claim guidance', () => {
  const content = hookScriptContent('@codex');

  assert.match(content, /CLAIM FIRST/);
  assert.match(content, /Retry edit\. No workaround\./);
  assert.match(content, /If multiple files are listed, claim each exact path\./);
  assert.match(content, /rel\.replace\('\/', '~2F'\)/);
});

test('hook template describes write blocking rather than read blocking', () => {
  const content = hookScriptContent('@codex');

  assert.match(content, /Blocks writes to Nexus repo files/);
  assert.doesNotMatch(content, /Claim first, then read\/edit/);
});

test('hookStatus detects current, foreign, wrong-agent, and outdated hooks', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexus-hooks-'));
  const current = join(root, 'current.py');
  const foreign = join(root, 'foreign.py');
  const wrong = join(root, 'wrong.py');
  const outdated = join(root, 'outdated.py');

  writeFileSync(current, hookScriptContent('@codex'), 'utf-8');
  writeFileSync(foreign, 'custom hook\n', 'utf-8');
  writeFileSync(wrong, hookScriptContent('@claude'), 'utf-8');
  writeFileSync(outdated, "# NEXUS_HOOK_TEMPLATE_V1\nNEXUS_AGENT = '@codex'\n", 'utf-8');

  assert.equal(hookStatus('@codex', current).status, 'current');
  assert.equal(hookStatus('@codex', foreign).status, 'foreign');
  assert.equal(hookStatus('@codex', wrong).status, 'wrong-agent');
  assert.equal(hookStatus('@codex', outdated).status, 'outdated');
  assert.equal(hookStatus('@codex', join(root, 'missing.py')).status, 'missing');
});

test('hooks install refreshes an outdated Nexus hook without --force', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexus-hooks-'));
  const target = join(root, 'pre_tool_use_guard.py');
  writeFileSync(target, "# NEXUS_HOOK_TEMPLATE_V1\nNEXUS_AGENT = '@codex'\n", 'utf-8');

  const output = captureLogs(() => hooks(['install', '--agent', '@codex', '--target', target]));

  assert.match(output, /Installed Nexus Codex hook/);
  assert.match(readFileSync(target, 'utf-8'), /NEXUS_HOOK_TEMPLATE_V2/);
});

test('hook template blocks foreign-owned locks, not just missing claims', () => {
  const content = hookScriptContent('@claude');

  assert.match(content, /LOCKED BY ANOTHER AGENT/);
  assert.match(content, /lock_owner/);
  assert.match(content, /owner != NEXUS_AGENT/);
  assert.match(content, /Wait for release, or coordinate in _NEXUS_STANDUP\.md/);
});

test('hook template walks parent directories so directory claims cover children', () => {
  const content = hookScriptContent('@claude');

  assert.match(content, /find_lock/);
  assert.match(content, /rsplit\('\/', 1\)\[0\]/);
});

test('doctor reports hooks only when explicitly requested', () => {
  const regular = captureLogs(() => doctor(['--json']));
  const report = JSON.parse(regular);
  assert.deepEqual(report.sections.Hooks, []);

  const withHooks = captureLogs(() => doctor(['--json', '--hooks']));
  const hooksReport = JSON.parse(withHooks);
  assert.ok(hooksReport.sections.Hooks.length >= 3);
});
