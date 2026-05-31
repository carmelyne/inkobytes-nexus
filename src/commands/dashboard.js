/**
 * nexus dashboard --serve
 * Read-only local dashboard for human Nexus status checks.
 */

import { createServer } from 'http';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { spawnSync } from 'child_process';
import { networkInterfaces } from 'os';
import { join } from 'path';
import { getConfig } from '../lib/config.js';
import { listLocks } from '../lib/lockManager.js';

const DEFAULT_PORT = 13787;
const MAX_PORT_SEARCH = 30;
const DASHBOARD_HTML_URL = new URL('../../nexus-dashboard/index.html', import.meta.url);

export default function dashboard(args) {
  if (args.includes('--snapshot')) {
    console.log(JSON.stringify(buildSnapshot(), null, 2));
    return;
  }

  serveDashboard(resolveDashboardPort(args));
}

export function buildSnapshot() {
  const config = getConfig();
  const locks = listLocks().map(lock => ({
    target: lock.target,
    age: lock.age,
    stale: lock.age !== null && lock.age >= config.staleThreshold,
    agent: lock.agent || '',
    intent: lock.intent || '',
    subagents: lock.subagents || 0,
    model: lock.model || '',
    thinking: lock.thinking || '',
    verified: lock.verified ?? true,
    trustSource: lock.trustSource || 'unverified',
  }));

  const presence = {};
  if (existsSync(join(config.root, '.nexus', 'presence'))) {
    for (const file of readdirSync(join(config.root, '.nexus', 'presence'))) {
      try {
        presence[file] = parseInt(readFileSync(join(config.root, '.nexus', 'presence', file), 'utf-8').trim(), 10);
      } catch { /* ignore */ }
    }
  }

  const queueText = readText(config.queue);
  const standupText = readText(config.standup);
  const reportText = readText(config.report);
  const git = getGitStatus(config.root);

  return {
    generatedAt: new Date().toISOString(),
    repo: config.root,
    branch: git.branch,
    dirtyFiles: git.files,
    health: getHealth(config),
    locks,
    presence,
    queue: parseQueue(queueText),
    proposed: parseProposed(queueText),
    standup: parseStandupEntries(standupText).slice(-8),
    releases: parseReleaseEntries(reportText).slice(-6),
  };
}

function serveDashboard(port) {
  const clients = new Set();
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

    if (url.pathname === '/api/snapshot') {
      sendJson(res, buildSnapshot());
      return;
    }

    if (url.pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write('event: update\ndata: ready\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readDashboardHtml());
  });

  const interval = setInterval(() => {
    for (const client of clients) {
      client.write(`event: update\ndata: ${Date.now()}\n\n`);
    }
  }, 2000);

  server.on('close', () => clearInterval(interval));
  listenOnAvailablePort(server, port, port === DEFAULT_PORT);
}

export function resolveDashboardPort(args) {
  const index = args.indexOf('--port');
  if (index === -1) return DEFAULT_PORT;
  const value = Number.parseInt(args[index + 1], 10);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error('Invalid --port value.');
  }
  return value;
}

function listenOnAvailablePort(server, port, canSearch) {
  let attempts = 0;

  const tryListen = (candidate) => {
    server.once('error', (err) => {
      if (canSearch && err.code === 'EADDRINUSE' && attempts < MAX_PORT_SEARCH) {
        attempts++;
        tryListen(candidate + 1);
        return;
      }
      throw err;
    });

    server.listen(candidate, '0.0.0.0', () => {
      const moved = candidate !== port ? ` (default ${port} was busy)` : '';
      console.log(`Nexus dashboard listening at http://127.0.0.1:${candidate}${moved}`);
      for (const url of getLanUrls(candidate)) {
        console.log(`Local network: ${url}`);
      }
      console.log('Press Ctrl+C to stop.');
    });
  };

  tryListen(port);
}

function getLanUrls(port) {
  const urls = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      urls.push(`http://${entry.address}:${port}`);
    }
  }
  return urls;
}

function sendJson(res, body) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readText(path) {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

function getGitStatus(root) {
  const result = spawnSync('git', ['status', '--short', '--branch'], {
    cwd: root,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (result.status !== 0) return { branch: 'unknown', files: [] };

  const lines = result.stdout.trim().split('\n').filter(Boolean);
  const branch = lines[0]?.replace(/^##\s*/, '') || 'unknown';
  return { branch, files: lines.slice(1) };
}

function getHealth(config) {
  const issues = [];
  for (const file of ['_NEXUS_CONSTITUTION.md', '_NEXUS_QUEUE.md', '_NEXUS_STANDUP.md']) {
    if (!existsSync(`${config.root}/${file}`)) issues.push(`Missing ${file}`);
  }

  const trackedPrivate = spawnSync('git', ['ls-files', 'DECISIONS.md', 'docs-priv'], {
    cwd: config.root,
    encoding: 'utf-8',
    stdio: 'pipe',
  }).stdout.trim().split('\n').filter(Boolean);
  for (const file of trackedPrivate) issues.push(`Tracked private path: ${file}`);

  return { ok: issues.length === 0, issues };
}

function extractSection(content, heading) {
  const lines = content.split('\n');
  let inSection = false;
  const result = [];
  for (const line of lines) {
    if (line.startsWith('## ')) { inSection = line.trim() === heading; continue; }
    if (inSection) result.push(line);
  }
  return result.join('\n');
}

function parseTasks(content) {
  const tasks = [];
  const lines = content.split('\n');
  let current = null;

  for (const line of lines) {
    const task = line.match(/^- \[([ x])\] TASK\/([^:]+):\s*(.+)$/);
    if (task) {
      if (current) tasks.push(current);
      current = {
        checked: task[1] === 'x',
        agent: task[2].trim(),
        title: task[3].trim(),
        id: '', epic: '', status: '', depends: '',
        files: '', cost: '', autoFlow: '', notes: '',
        review: '', approvedBy: '',
      };
      continue;
    }
    if (!current) continue;
    const field = line.trim().match(/^- ([^:]+):\s*(.+)$/);
    if (!field) continue;
    const key = field[1].toLowerCase();
    if (key === 'id') current.id = field[2];
    if (key === 'epic') current.epic = field[2];
    if (key === 'status') current.status = field[2];
    if (key === 'depends on') current.depends = field[2];
    if (key === 'files') current.files = field[2];
    if (key === 'cost') current.cost = field[2];
    if (key === 'auto-flow') current.autoFlow = field[2];
    if (key === 'notes') current.notes = field[2];
    if (key === 'review') current.review = field[2];
    if (key === 'approved by') current.approvedBy = field[2];
  }
  if (current) tasks.push(current);
  return tasks;
}

function parseQueue(content) {
  return parseTasks(extractSection(content, '## Ready Queue'));
}

function parseProposed(content) {
  return parseTasks(extractSection(content, '## Proposed Queue'));
}

function parseStandupEntries(content) {
  const entries = [];
  const lines = content.split('\n');

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line.startsWith('#') || line.startsWith('---')) continue;

    const task = line.match(/^- \[([ x])\] TASK\/([^:]+):\s*(.+)$/);
    if (task) {
      const details = {};
      while (index + 1 < lines.length && lines[index + 1].trim().startsWith('- ')) {
        const field = lines[index + 1].trim().match(/^- ([^:]+):\s*(.+)$/);
        if (!field) break;
        details[field[1].toLowerCase()] = field[2];
        index++;
      }
      entries.push({
        type: 'Task',
        title: task[3].trim(),
        meta: [task[2].trim(), details.status, details.files].filter(Boolean).join(' · '),
      });
      continue;
    }

    const agent = line.match(/^(@[^:]+):\s*(.+)$/);
    if (agent) {
      entries.push({ type: agent[1], title: agent[2], meta: '' });
      continue;
    }

    entries.push({ type: 'Note', title: line.replace(/^- /, ''), meta: '' });
  }

  return entries;
}

function parseReleaseEntries(content) {
  const entries = [];
  const lines = content.split('\n');

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line.startsWith('#') || line.startsWith('---')) continue;

    if (line.startsWith('Commit:') || line.startsWith('- Commit:')) {
      entries.push({ type: 'Commit', title: line.replace(/^-?\s*Commit:\s*/, ''), meta: '' });
      continue;
    }

    if (line === 'Done claim:') {
      const details = [];
      while (index + 1 < lines.length && lines[index + 1].trim().startsWith('- ')) {
        const detail = lines[index + 1].trim().replace(/^- /, '');
        if (hasReleaseDetailValue(detail)) details.push(detail);
        index++;
      }
      if (details.length > 0) {
        entries.push({ type: 'Done Claim', title: details.join(' · '), meta: '' });
      }
    }
  }

  return entries;
}

function hasReleaseDetailValue(detail) {
  const colon = detail.indexOf(':');
  if (colon === -1) return detail.trim().length > 0;
  return detail.slice(colon + 1).trim().length > 0;
}

function readDashboardHtml() {
  return readFileSync(DASHBOARD_HTML_URL, 'utf-8');
}
