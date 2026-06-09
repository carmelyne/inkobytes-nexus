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
  assert.match(content, /NEXUS_HOOK_TEMPLATE_V1/);
  assert.match(content, /NEXUS_AGENT = '@codex'/);
  assert.match(content, /nexus claim \{first_rel\} \{NEXUS_AGENT\}/);
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

test('hookStatus detects current, foreign, and wrong-agent hooks', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexus-hooks-'));
  const current = join(root, 'current.py');
  const foreign = join(root, 'foreign.py');
  const wrong = join(root, 'wrong.py');

  writeFileSync(current, hookScriptContent('@codex'), 'utf-8');
  writeFileSync(foreign, 'custom hook\n', 'utf-8');
  writeFileSync(wrong, hookScriptContent('@claude'), 'utf-8');

  assert.equal(hookStatus('@codex', current).status, 'current');
  assert.equal(hookStatus('@codex', foreign).status, 'foreign');
  assert.equal(hookStatus('@codex', wrong).status, 'wrong-agent');
  assert.equal(hookStatus('@codex', join(root, 'missing.py')).status, 'missing');
});

test('doctor reports hooks only when explicitly requested', () => {
  const regular = captureLogs(() => doctor(['--json']));
  const report = JSON.parse(regular);
  assert.deepEqual(report.sections.Hooks, []);

  const withHooks = captureLogs(() => doctor(['--json', '--hooks']));
  const hooksReport = JSON.parse(withHooks);
  assert.ok(hooksReport.sections.Hooks.length >= 3);
});

