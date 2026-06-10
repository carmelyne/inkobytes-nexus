import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { chdir, cwd } from 'process';
import { getConfig, resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-config-'));
  chdir(root);
  resetConfig();
  try {
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

test('getConfig() returns expected shape with all required keys', () => {
  inTempRepo((root) => {
    const cfg = getConfig();
    assert.ok(cfg, 'config should be truthy');
    assert.equal(typeof cfg.root, 'string');
    assert.equal(typeof cfg.lockDir, 'string');
    assert.equal(typeof cfg.budgetFile, 'string');
    assert.equal(typeof cfg.blackboard, 'string');
    assert.equal(typeof cfg.standup, 'string');
    assert.equal(typeof cfg.report, 'string');
    assert.equal(typeof cfg.queue, 'string');
    assert.equal(typeof cfg.staleThreshold, 'number');
    assert.equal(typeof cfg.maxDumpFiles, 'number');
    assert.equal(typeof cfg.maxClaimAttempts, 'number');
    assert.equal(typeof cfg.claimRetryMs, 'number');
  });
});

test('getConfig() returns numeric defaults at expected values', () => {
  inTempRepo(() => {
    const cfg = getConfig();
    assert.equal(cfg.staleThreshold, 600);
    assert.equal(cfg.maxDumpFiles, 20);
    assert.equal(cfg.maxClaimAttempts, 10);
    assert.equal(cfg.claimRetryMs, 2000);
  });
});

test('getConfig() caches — second call returns same object reference', () => {
  inTempRepo(() => {
    const first = getConfig();
    const second = getConfig();
    assert.equal(first, second, 'should return same cached object');
  });
});

test('resetConfig() clears the cache so next getConfig() returns fresh object', () => {
  inTempRepo(() => {
    const first = getConfig();
    resetConfig();
    const second = getConfig();
    assert.notEqual(first, second, 'should return new object after reset');
  });
});

test('getConfig(fromDir) uses the provided dir as root', () => {
  inTempRepo((root) => {
    const cfg = getConfig(root);
    assert.equal(cfg.root, root);
  });
});

test('path values are correctly joined to root', () => {
  inTempRepo((root) => {
    const cfg = getConfig(root);
    assert.equal(cfg.lockDir, join(root, '.nexus', 'locks'));
    assert.equal(cfg.budgetFile, join(root, '.nexus', 'agent-budgets.json'));
    assert.equal(cfg.blackboard, join(root, '_NEXUS.md'));
    assert.equal(cfg.standup, join(root, '_NEXUS_STANDUP.md'));
    assert.equal(cfg.report, join(root, '_NEXUS_REPORT.md'));
    assert.equal(cfg.queue, join(root, '_NEXUS_QUEUE.md'));
  });
});

test('getConfig() without fromDir uses cwd as root', () => {
  inTempRepo(() => {
    const cfg = getConfig();
    assert.equal(cfg.root, cwd());
  });
});

test('getConfig() caches — subsequent calls ignore new fromDir argument', () => {
  inTempRepo((root) => {
    const first = getConfig(root);
    const second = getConfig('/some/other/dir');
    assert.equal(first, second, 'cached config should be returned regardless of new fromDir');
    assert.equal(second.root, root);
  });
});

test('getConfig() defaults autonomy to 0 when config.json is absent', () => {
  inTempRepo(() => {
    assert.equal(getConfig().autonomy, 0);
  });
});

test('getConfig() reads valid autonomy levels from config.json', () => {
  for (const level of [0, 1, 2]) {
    inTempRepo(() => {
      mkdirSync('.nexus', { recursive: true });
      writeFileSync('.nexus/config.json', JSON.stringify({ autonomy: level }), 'utf-8');
      assert.equal(getConfig().autonomy, level);
    });
  }
});

test('getConfig() falls back to autonomy 0 for invalid values', () => {
  for (const bad of [3, -1, 1.5, '2', null, true]) {
    inTempRepo(() => {
      mkdirSync('.nexus', { recursive: true });
      writeFileSync('.nexus/config.json', JSON.stringify({ autonomy: bad }), 'utf-8');
      assert.equal(getConfig().autonomy, 0, `autonomy ${JSON.stringify(bad)} should fall back to 0`);
    });
  }
});

test('getConfig() reads .nexus/config.json doctor settings when present', () => {
  inTempRepo(() => {
    mkdirSync('.nexus', { recursive: true });
    writeFileSync('.nexus/config.json', JSON.stringify({
      doctor: {
        allowTrackedAgentTrees: true,
      },
    }), 'utf-8');

    const cfg = getConfig();
    assert.equal(cfg.doctor.allowTrackedAgentTrees, true);
  });
});
