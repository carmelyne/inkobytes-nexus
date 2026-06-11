import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { get } from 'https';
import { homedir, platform } from 'os';
import { dirname, join } from 'path';

export const PACKAGE_NAME = '@inkobytes/nexus';
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const REGISTRY_LATEST_URL = 'https://registry.npmjs.org/@inkobytes%2Fnexus/latest';

export async function maybePrintUpdateNotice(options = {}) {
  const notice = await getUpdateNotice(options);
  if (notice) {
    const write = options.write || ((message) => console.error(message));
    write(notice);
  }
  return notice;
}

export async function getUpdateNotice(options = {}) {
  const env = options.env || process.env;
  const currentVersion = options.currentVersion;
  const now = options.now || Date.now();
  const cacheFile = options.cacheFile || defaultCacheFile(env);
  const requestLatestVersion = options.requestLatestVersion || fetchLatestVersion;

  if (!currentVersion || shouldSkipUpdateCheck(env)) return null;

  const cached = readFreshCache(cacheFile, now);
  if (cached) return noticeFor(currentVersion, cached.latestVersion);

  let latestVersion = null;
  try {
    latestVersion = await requestLatestVersion();
  } catch {
    return null;
  }

  if (!latestVersion) return null;
  writeCache(cacheFile, { checkedAt: now, latestVersion });
  return noticeFor(currentVersion, latestVersion);
}

export function shouldSkipUpdateCheck(env = process.env) {
  return (env.CI && env.CI !== 'false') || env.NEXUS_NO_UPDATE_CHECK === '1';
}

export function isVersionGreater(latestVersion, currentVersion) {
  const latest = parseVersion(latestVersion);
  const current = parseVersion(currentVersion);
  if (!latest || !current) return false;

  for (let index = 0; index < 3; index += 1) {
    if (latest.parts[index] > current.parts[index]) return true;
    if (latest.parts[index] < current.parts[index]) return false;
  }

  return !latest.prerelease && Boolean(current.prerelease);
}

function noticeFor(currentVersion, latestVersion) {
  if (!isVersionGreater(latestVersion, currentVersion)) return null;
  return `Update available: ${PACKAGE_NAME} v${currentVersion} -> v${latestVersion}. Run npm install -g ${PACKAGE_NAME}`;
}

function readFreshCache(cacheFile, now) {
  try {
    if (!cacheFile || !existsSync(cacheFile)) return null;
    const parsed = JSON.parse(readFileSync(cacheFile, 'utf-8'));
    if (!parsed || typeof parsed.latestVersion !== 'string') return null;
    if (!Number.isFinite(parsed.checkedAt)) return null;
    if (now - parsed.checkedAt >= CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cacheFile, data) {
  try {
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  } catch {
    // Cache failures must never affect the CLI command.
  }
}

function parseVersion(version) {
  const match = String(version).trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) return null;
  return {
    parts: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] || '',
  };
}

function defaultCacheFile(env = process.env) {
  return join(defaultCacheDir(env), 'update-check.json');
}

function defaultCacheDir(env = process.env) {
  if (env.XDG_CACHE_HOME) return join(env.XDG_CACHE_HOME, 'nexus');
  if (platform() === 'darwin') return join(homedir(), 'Library', 'Caches', 'nexus');
  if (platform() === 'win32' && env.LOCALAPPDATA) return join(env.LOCALAPPDATA, 'nexus');
  return join(homedir(), '.cache', 'nexus');
}

function fetchLatestVersion() {
  return new Promise((resolve, reject) => {
    const request = get(REGISTRY_LATEST_URL, {
      headers: {
        accept: 'application/vnd.npm.install-v1+json',
      },
      timeout: 1000,
    }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`npm registry status ${response.statusCode}`));
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (typeof parsed.version === 'string') {
            resolve(parsed.version);
          } else {
            reject(new Error('npm registry response missing version'));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('npm registry request timed out'));
    });
    request.on('error', reject);
  });
}
