import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  CACHE_TTL_MS,
  getUpdateNotice,
  isVersionGreater,
  maybePrintUpdateNotice,
  shouldSkipUpdateCheck,
} from '../src/utils/update-check.js';

function tempCacheFile() {
  return join(mkdtempSync(join(tmpdir(), 'nexus-update-check-')), 'cache.json');
}

test('shows update notice only when latest version is greater than current version', async () => {
  const cacheFile = tempCacheFile();
  const notice = await getUpdateNotice({
    currentVersion: '1.1.0',
    cacheFile,
    env: {},
    requestLatestVersion: async () => '1.2.0',
  });

  assert.equal(notice, 'Update available: @inkobytes/nexus v1.1.0 -> v1.2.0. Run npm install -g @inkobytes/nexus');

  const noNotice = await getUpdateNotice({
    currentVersion: '1.2.0',
    cacheFile: tempCacheFile(),
    env: {},
    requestLatestVersion: async () => '1.2.0',
  });
  assert.equal(noNotice, null);
});

test('uses fresh cache for 24 hours instead of requesting npm again', async () => {
  const now = 1_800_000_000_000;
  const cacheFile = tempCacheFile();
  writeFileSync(cacheFile, JSON.stringify({
    checkedAt: now - CACHE_TTL_MS + 1,
    latestVersion: '1.3.0',
  }), 'utf-8');

  let requested = false;
  const notice = await getUpdateNotice({
    currentVersion: '1.2.0',
    now,
    cacheFile,
    env: {},
    requestLatestVersion: async () => {
      requested = true;
      return '9.9.9';
    },
  });

  assert.equal(requested, false);
  assert.match(notice, /v1\.2\.0 -> v1\.3\.0/);
});

test('refreshes stale cache and stores latest npm version', async () => {
  const now = 1_800_000_000_000;
  const cacheFile = tempCacheFile();
  writeFileSync(cacheFile, JSON.stringify({
    checkedAt: now - CACHE_TTL_MS,
    latestVersion: '1.3.0',
  }), 'utf-8');

  const notice = await getUpdateNotice({
    currentVersion: '1.2.0',
    now,
    cacheFile,
    env: {},
    requestLatestVersion: async () => '1.4.0',
  });

  const cached = JSON.parse(readFileSync(cacheFile, 'utf-8'));
  assert.match(notice, /v1\.2\.0 -> v1\.4\.0/);
  assert.equal(cached.checkedAt, now);
  assert.equal(cached.latestVersion, '1.4.0');
});

test('skips update check in CI or when opt-out env var is set', async () => {
  assert.equal(shouldSkipUpdateCheck({ CI: 'true' }), true);
  assert.equal(shouldSkipUpdateCheck({ NEXUS_NO_UPDATE_CHECK: '1' }), true);

  let requests = 0;
  const requestLatestVersion = async () => {
    requests += 1;
    return '9.9.9';
  };

  assert.equal(await getUpdateNotice({
    currentVersion: '1.0.0',
    cacheFile: tempCacheFile(),
    env: { CI: 'true' },
    requestLatestVersion,
  }), null);
  assert.equal(await getUpdateNotice({
    currentVersion: '1.0.0',
    cacheFile: tempCacheFile(),
    env: { NEXUS_NO_UPDATE_CHECK: '1' },
    requestLatestVersion,
  }), null);
  assert.equal(requests, 0);
});

test('fails silently when registry request fails', async () => {
  const notice = await getUpdateNotice({
    currentVersion: '1.0.0',
    cacheFile: tempCacheFile(),
    env: {},
    requestLatestVersion: async () => {
      throw new Error('offline');
    },
  });

  assert.equal(notice, null);
});

test('maybePrintUpdateNotice writes only when a newer version is available', async () => {
  const lines = [];
  await maybePrintUpdateNotice({
    currentVersion: '1.0.0',
    cacheFile: tempCacheFile(),
    env: {},
    requestLatestVersion: async () => '1.0.0',
    write: (line) => lines.push(line),
  });
  assert.deepEqual(lines, []);

  await maybePrintUpdateNotice({
    currentVersion: '1.0.0',
    cacheFile: tempCacheFile(),
    env: {},
    requestLatestVersion: async () => '1.0.1',
    write: (line) => lines.push(line),
  });
  assert.equal(lines.length, 1);
});

test('compares semantic versions without treating lower or prerelease latest as newer', () => {
  assert.equal(isVersionGreater('1.2.0', '1.1.9'), true);
  assert.equal(isVersionGreater('2.0.0', '1.9.9'), true);
  assert.equal(isVersionGreater('1.1.0', '1.1.0'), false);
  assert.equal(isVersionGreater('1.0.9', '1.1.0'), false);
  assert.equal(isVersionGreater('1.2.0-beta.1', '1.2.0'), false);
  assert.equal(isVersionGreater('1.2.0', '1.2.0-beta.1'), true);
});
