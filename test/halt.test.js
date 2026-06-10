import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import halt, { getHalt, getHaltPath } from '../src/commands/halt.js';
import resume from '../src/commands/resume.js';
import claim from '../src/commands/claim.js';
import release from '../src/commands/release.js';
import next from '../src/commands/next.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-halt-'));
  chdir(root);
  resetConfig();

  try {
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

// halt/resume read CLAUDECODE / NEXUS_AGENT to identify the session.
function withSessionEnv(values, fn) {
  const keys = ['CLAUDECODE', 'NEXUS_AGENT'];
  const original = {};
  for (const key of keys) {
    original[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, values);

  try {
    return fn();
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

function capture(fn) {
  const originalLog = console.log;
  const originalError = console.error;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  console.error = (...args) => lines.push(args.join(' '));

  try {
    fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return lines.join('\n');
}

function captureExit(fn) {
  const originalLog = console.log;
  const originalError = console.error;
  const originalExit = process.exit;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  console.error = (...args) => lines.push(args.join(' '));
  process.exit = (code) => {
    throw Object.assign(new Error(`process.exit ${code}`), { code });
  };

  try {
    assert.throws(fn, /process\.exit 1/);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
  }

  return lines.join('\n');
}

test('halt writes .nexus/HALT with reason, timestamp, and initiator', () => {
  inTempRepo((root) => {
    withSessionEnv({ NEXUS_AGENT: '@claude' }, () => {
      const output = capture(() => halt(['runaway loop suspected']));

      assert.match(output, /\[HALT\] Swarm halted: runaway loop suspected/);
      assert.ok(existsSync(join(root, '.nexus', 'HALT')));
      const state = getHalt();
      assert.equal(state.reason, 'runaway loop suspected');
      assert.equal(state.by, '@claude');
      assert.match(state.at, /^\d{4}-\d{2}-\d{2}T/);
    });
  });
});

test('halt requires a reason', () => {
  inTempRepo(() => {
    const output = captureExit(() => halt([]));

    assert.match(output, /Usage: nexus halt "<reason>"/);
  });
});

test('halt does not overwrite an existing halt', () => {
  inTempRepo(() => {
    withSessionEnv({ NEXUS_AGENT: '@claude' }, () => {
      capture(() => halt(['first reason']));
      const output = capture(() => halt(['second reason']));

      assert.match(output, /already halted/);
      assert.equal(getHalt().reason, 'first reason');
    });
  });
});

test('claim refuses while halted', () => {
  inTempRepo(() => {
    capture(() => halt(['stop the swarm']));

    const output = captureExit(() => claim(['file.txt', '@codex', 'should not work']));

    assert.match(output, /\[HALTED\] nexus claim refused/);
    assert.match(output, /stop the swarm/);
  });
});

test('release refuses while halted', () => {
  inTempRepo(() => {
    capture(() => halt(['stop the swarm']));

    const output = captureExit(() => release(['file.txt', 'feat: nope']));

    assert.match(output, /\[HALTED\] nexus release refused/);
  });
});

test('next refuses while halted', () => {
  inTempRepo(() => {
    capture(() => halt(['stop the swarm']));

    const output = captureExit(() => next(['@codex']));

    assert.match(output, /\[HALTED\] nexus next refused/);
  });
});

test('resume refuses in a recognized agent session', () => {
  inTempRepo(() => {
    capture(() => halt(['agent should not lift this']));

    withSessionEnv({ CLAUDECODE: '1' }, () => {
      const output = captureExit(() => resume([]));

      assert.match(output, /human-owned/);
      assert.match(output, /advisory/);
    });
    assert.notEqual(getHalt(), null);
  });
});

test('resume lifts the halt in a plain session', () => {
  inTempRepo(() => {
    capture(() => halt(['done for the day']));

    withSessionEnv({}, () => {
      const output = capture(() => resume([]));

      assert.match(output, /\[RESUME\] Halt lifted/);
    });
    assert.equal(getHalt(), null);
    assert.ok(!existsSync(getHaltPath()));
  });
});

test('resume without a halt is a safe no-op', () => {
  inTempRepo(() => {
    withSessionEnv({}, () => {
      const output = capture(() => resume([]));

      assert.match(output, /No halt in place/);
    });
  });
});
