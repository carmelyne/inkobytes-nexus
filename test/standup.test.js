import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import standup, { validateStandupLine } from '../src/commands/standup.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-standup-'));
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
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));

  try {
    fn();
  } finally {
    console.log = originalLog;
  }

  return lines.join('\n');
}

function captureExit(fn) {
  const originalError = console.error;
  const originalExit = process.exit;
  const lines = [];
  console.error = (...args) => lines.push(args.join(' '));
  process.exit = (code) => {
    throw Object.assign(new Error(`process.exit ${code}`), { code });
  };

  try {
    assert.throws(fn, /process\.exit 1/);
  } finally {
    console.error = originalError;
    process.exit = originalExit;
  }

  return lines.join('\n');
}

test('validateStandupLine accepts dated AM/PM agent status messages', () => {
  const result = validateStandupLine('2026-06-01 08:38 AM @codex [DONE]: Updated tests');

  assert.equal(result.ok, true);
  assert.equal(result.line, '2026-06-01 08:38 AM @codex [DONE]: Updated tests');
});

test('standup appends valid messages', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n\n', 'utf-8');

    const output = capture(() => standup(['2026-06-01 08:38 AM @codex [DONE]: Updated tests']));
    const standupText = readFileSync(join(root, '_NEXUS_STANDUP.md'), 'utf-8');

    assert.match(output, /Message recorded/);
    assert.match(standupText, /2026-06-01 08:38 AM @codex \[DONE\]: Updated tests/);
  });
});

test('standup rejects missing agent before writing', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n\n', 'utf-8');

    const output = captureExit(() => standup(['2026-06-01 08:38 AM [DONE]: Updated tests']));
    const standupText = readFileSync(join(root, '_NEXUS_STANDUP.md'), 'utf-8');

    assert.match(output, /Missing or invalid standup agent/);
    assert.match(output, /nexus standup "YYYY-MM-DD HH:MM AM\/PM @agent \[STATUS\]: message"/);
    assert.equal(standupText, '# Standup\n\n');
  });
});

test('standup rejects bad date time format before writing', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n\n', 'utf-8');

    const output = captureExit(() => standup(['2026-06-01 20:38 @codex [DONE]: Updated tests']));
    const standupText = readFileSync(join(root, '_NEXUS_STANDUP.md'), 'utf-8');

    assert.match(output, /Invalid standup message format/);
    assert.match(output, /YYYY-MM-DD HH:MM AM\/PM @agent \[STATUS\]: message/);
    assert.equal(standupText, '# Standup\n\n');
  });
});

test('standup rejects impossible dates before writing', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n\n', 'utf-8');

    const output = captureExit(() => standup(['2026-02-30 08:38 AM @codex [DONE]: Updated tests']));
    const standupText = readFileSync(join(root, '_NEXUS_STANDUP.md'), 'utf-8');

    assert.match(output, /Invalid standup date/);
    assert.equal(standupText, '# Standup\n\n');
  });
});
