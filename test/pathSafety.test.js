import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { chdir, cwd } from 'process';
import { resetConfig } from '../src/lib/config.js';
import { normalizeTarget, targetToLockName, lockNameToTarget } from '../src/lib/pathSafety.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-pathsafety-'));
  chdir(root);
  resetConfig();
  try {
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

test('normalizeTarget throws on empty string', () => {
  inTempRepo(() => {
    assert.throws(() => normalizeTarget(''), { message: 'Missing target path.' });
  });
});

test('normalizeTarget throws on whitespace-only string', () => {
  inTempRepo(() => {
    assert.throws(() => normalizeTarget('   '), { message: 'Missing target path.' });
  });
});

test('normalizeTarget throws on null', () => {
  inTempRepo(() => {
    assert.throws(() => normalizeTarget(null), { message: 'Missing target path.' });
  });
});

test('normalizeTarget throws on undefined', () => {
  inTempRepo(() => {
    assert.throws(() => normalizeTarget(undefined), { message: 'Missing target path.' });
  });
});

test('normalizeTarget throws on number input', () => {
  inTempRepo(() => {
    assert.throws(() => normalizeTarget(42), { message: 'Missing target path.' });
  });
});

test('normalizeTarget throws on absolute path', () => {
  inTempRepo(() => {
    assert.throws(
      () => normalizeTarget('/absolute/path/file.md'),
      { message: 'Target must be a relative path inside the repo.' }
    );
  });
});

test('normalizeTarget throws on path escaping repo with ../', () => {
  inTempRepo(() => {
    assert.throws(
      () => normalizeTarget('../outside'),
      { message: 'Target must stay inside the repo.' }
    );
  });
});

test('normalizeTarget throws on deeply nested path escape', () => {
  inTempRepo(() => {
    assert.throws(
      () => normalizeTarget('foo/../../outside'),
      { message: 'Target must stay inside the repo.' }
    );
  });
});

test('normalizeTarget throws on .git/ reserved root', () => {
  inTempRepo(() => {
    assert.throws(
      () => normalizeTarget('.git/config'),
      { message: 'Target cannot be inside .git.' }
    );
  });
});

test('normalizeTarget throws on .nexus/ reserved root', () => {
  inTempRepo(() => {
    assert.throws(
      () => normalizeTarget('.nexus/locks/something.lock'),
      { message: 'Target cannot be inside .nexus.' }
    );
  });
});

test('normalizeTarget throws on .git as exact target', () => {
  inTempRepo(() => {
    assert.throws(
      () => normalizeTarget('.git'),
      { message: 'Target cannot be inside .git.' }
    );
  });
});

test('normalizeTarget throws on .nexus as exact target', () => {
  inTempRepo(() => {
    assert.throws(
      () => normalizeTarget('.nexus'),
      { message: 'Target cannot be inside .nexus.' }
    );
  });
});

test('normalizeTarget returns normalized path for simple file', () => {
  inTempRepo(() => {
    const result = normalizeTarget('README.md');
    assert.equal(result, 'README.md');
  });
});

test('normalizeTarget returns forward-slash path for nested file', () => {
  inTempRepo(() => {
    const result = normalizeTarget('src/lib/config.js');
    assert.equal(result, 'src/lib/config.js');
  });
});

test('normalizeTarget trims leading/trailing whitespace', () => {
  inTempRepo(() => {
    const result = normalizeTarget('  src/lib/config.js  ');
    assert.equal(result, 'src/lib/config.js');
  });
});

test('normalizeTarget resolves redundant path segments', () => {
  inTempRepo(() => {
    const result = normalizeTarget('src/../src/lib/config.js');
    assert.equal(result, 'src/lib/config.js');
  });
});

test('normalizeTarget uses forward slashes on all platforms', () => {
  inTempRepo(() => {
    const result = normalizeTarget('a/b/c/file.txt');
    assert.ok(!result.includes('\\'), 'should not contain backslashes');
  });
});

test('targetToLockName returns .lock suffixed name', () => {
  inTempRepo(() => {
    const lockName = targetToLockName('README.md');
    assert.ok(lockName.endsWith('.lock'));
  });
});

test('targetToLockName + lockNameToTarget round-trip for simple path', () => {
  inTempRepo(() => {
    const original = 'src/lib/config.js';
    assert.equal(lockNameToTarget(targetToLockName(original)), original);
  });
});

test('targetToLockName + lockNameToTarget round-trip for path with spaces', () => {
  inTempRepo(() => {
    const original = 'my folder/my file.md';
    assert.equal(lockNameToTarget(targetToLockName(original)), original);
  });
});

test('targetToLockName + lockNameToTarget round-trip for deeply nested path', () => {
  inTempRepo(() => {
    const original = 'a/b/c/d/deep-file.json';
    assert.equal(lockNameToTarget(targetToLockName(original)), original);
  });
});

test('targetToLockName encodes spaces — lock name has no spaces', () => {
  inTempRepo(() => {
    const lockName = targetToLockName('folder/file with spaces.md');
    assert.ok(!lockName.includes(' '));
  });
});

test('targetToLockName encodes slashes — lock name body has no unencoded slashes', () => {
  inTempRepo(() => {
    const lockName = targetToLockName('src/lib/config.js');
    const body = lockName.slice(0, -5);
    assert.ok(!body.includes('/'));
  });
});

test('targetToLockName uses ~ instead of % for encoding', () => {
  inTempRepo(() => {
    const lockName = targetToLockName('folder/file with spaces.md');
    assert.ok(!lockName.includes('%'));
    assert.ok(lockName.includes('~'));
  });
});
