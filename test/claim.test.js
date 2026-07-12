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

test('claim only prints one missing model metadata warning while missing-metadata locks exist', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, 'one.txt'), 'one\n', 'utf-8');
    writeFileSync(join(root, 'two.txt'), 'two\n', 'utf-8');
    writeFileSync(join(root, 'three.txt'), 'three\n', 'utf-8');

    const output = capture(() => {
      claim(['one.txt', '@codex', 'first claim']);
      claim(['two.txt', '@codex', 'second claim']);
      claim(['three.txt', '@codex', 'third claim']);
    });

    const warnings = output.match(/Claim has no model metadata/g) || [];
    assert.equal(warnings.length, 1);
  });
});

test('claim warns cheaply when Nexus protocol files are missing', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');

    const output = capture(() => claim(['file.txt', '@codex', 'test claim warning']));

    assert.match(output, /Missing Nexus protocol files/);
    assert.match(output, /Run `nexus doctor`/);
    assert.match(output, /FRESHNESS RECEIPT/);
  });
});

test('claim prints a freshness receipt by default instead of the full dump', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'secret file body\n', 'utf-8');

    const output = capture(() => claim(['file.txt', '@codex', 'test receipt default']));

    assert.match(output, /FRESHNESS RECEIPT/);
    assert.match(output, /Path: file\.txt \(2 lines\)/);
    assert.match(output, /Same blob as your last read = cached content is current/);
    assert.doesNotMatch(output, /secret file body/);
    assert.doesNotMatch(output, /START OF FRESH FILE STATE/);
  });
});

test('claim --show prints the full fresh file state', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'full dump body\n', 'utf-8');

    const output = capture(() => claim(['file.txt', '@codex', 'test full dump', '--show']));

    assert.match(output, /START OF FRESH FILE STATE/);
    assert.match(output, /full dump body/);
    assert.doesNotMatch(output, /FRESHNESS RECEIPT/);
    assert.ok(listLocks().find((lock) => lock.target === 'file.txt'), '--show must not break the lock parse');
  });
});

test('claim --help prints claim-specific help without creating a lock', () => {
  inTempRepo(() => {
    const output = capture(() => claim(['--help']));

    assert.match(output, /Usage: nexus claim/);
    assert.match(output, /freshness receipt/);
    assert.match(output, /Same blob as your last read/);
    assert.match(output, /Use --show/);
    assert.equal(listLocks().length, 0);
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

test('claim accepts agent and intent flags', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');

    capture(() => claim(['file.txt', '--agent', '@codex', '--intent', 'flag claim']));

    const locks = listLocks();
    assert.equal(locks.length, 1);
    assert.equal(locks[0].agent, '@codex');
    assert.equal(locks[0].intent, 'flag claim');
  });
});

test('claim rejects missing agent or intent before creating a lock', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');

    const missingAgent = captureExit(() => claim(['file.txt']));
    assert.match(missingAgent, /Missing or invalid claim agent/);

    const missingIntent = captureExit(() => claim(['file.txt', '@codex']));
    assert.match(missingIntent, /Missing claim intent/);
    assert.equal(listLocks().length, 0);
  });
});

test('claim rejects intent-looking positional agent values', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');

    const output = captureExit(() => claim(['file.txt', 'document preventive drill framing']));

    assert.match(output, /Missing or invalid claim agent/);
    assert.match(output, /nexus claim <path> @codex "intent"/);
    assert.equal(listLocks().length, 0);
  });
});
