/**
 * Agent trace reader — the single parsing path for involuntary receipts.
 *
 * Progress signals (status/doctor) and reconnect tooling (whereami /
 * agent-resume-packet) must read the same traces through this module so two
 * commands never disagree about whether an agent is working
 * (loop-progress-signals review decision 4, 2026-06-12).
 *
 * Principle: measure the mound, not the ant. Self-reported liveness is
 * gameable by exactly the failure mode we care about — a stuck loop is great
 * at touching files on schedule. Only observable repo-state deltas count.
 */

import { existsSync, readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { getConfig } from './config.js';
import { listLocks } from './lockManager.js';
import { LANE_AGENT_PATTERN, laneFileName, lanePath, parseLaneTasks } from './queue.js';

export function normalizeAgent(agent) {
  const handle = String(agent || '').trim().toLowerCase();
  if (!handle) return '';
  return handle.startsWith('@') ? handle : `@${handle}`;
}

function sameAgent(a, b) {
  const left = normalizeAgent(a);
  return left !== '' && left === normalizeAgent(b);
}

/**
 * Parse the `2026-06-12 04:05:06 PM` (report) and `2026-06-12 04:05 PM`
 * (standup) timestamp formats. Returns a Date or null.
 */
export function parseAmPmTimestamp(value) {
  const match = String(value || '').trim()
    .match(/^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2})(?::(\d{2}))? (AM|PM)$/);
  if (!match) return null;

  const [, year, month, day, rawHour, minute, second, period] = match;
  let hour = parseInt(rawHour, 10) % 12;
  if (period === 'PM') hour += 12;

  const date = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    hour,
    parseInt(minute, 10),
    second ? parseInt(second, 10) : 0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Current locks held by an agent (all locks when no handle is given).
 */
export function readClaimState(agent) {
  const locks = listLocks();
  if (!normalizeAgent(agent)) return locks;
  return locks.filter((lock) => sameAgent(lock.agent, agent));
}

/**
 * Release receipts parsed from _NEXUS_REPORT.md, filtered to an agent and a
 * window in seconds. Pass a non-finite window to keep all receipts.
 */
export function readRecentReceipts(agent, windowSeconds, now = new Date()) {
  const config = getConfig();
  if (!existsSync(config.report)) return [];

  const receipts = [];
  let current = null;
  for (const line of readFileSync(config.report, 'utf-8').split('\n')) {
    const heading = line.match(/^## \[(.+?)\] (.+)$/);
    if (heading) {
      current = { at: parseAmPmTimestamp(heading[1]), target: heading[2].trim(), agent: '', sha: '', commit: '' };
      receipts.push(current);
      continue;
    }
    if (!current) continue;
    const field = line.match(/^- (Agent|SHA|Commit):\s*(.+)$/);
    if (field) current[field[1].toLowerCase()] = field[2].trim();
  }

  return receipts.filter((receipt) => {
    if (normalizeAgent(agent) && !sameAgent(receipt.agent, agent)) return false;
    if (!Number.isFinite(windowSeconds)) return true;
    if (!receipt.at) return false;
    return now.getTime() - receipt.at.getTime() <= windowSeconds * 1000;
  });
}

/**
 * Lane state for an agent: active delegated tasks, completion receipts, and
 * the receipts appended within the window.
 */
export function readLaneNotes(agent, windowSeconds, now = new Date()) {
  const handle = normalizeAgent(agent);
  if (!LANE_AGENT_PATTERN.test(handle)) {
    return { lane: '', active: [], completed: [], recentReceipts: [] };
  }

  const config = getConfig();
  const lane = laneFileName(handle);
  const file = lanePath(config.root, handle);
  if (!existsSync(file)) {
    return { lane, active: [], completed: [], recentReceipts: [] };
  }

  const { active, completed } = parseLaneTasks(readFileSync(file, 'utf-8'));
  const recentReceipts = completed.filter((receipt) => {
    const at = Date.parse(receipt.completedAt);
    if (!Number.isFinite(at)) return false;
    return !Number.isFinite(windowSeconds) || now.getTime() - at <= windowSeconds * 1000;
  });

  return { lane, active, completed, recentReceipts };
}

/**
 * Verify-gate failures from standup [BLOCKED] lines within the window
 * (default 24h). These mark stuck-with-effort: the agent is trying, the work
 * is failing — distinct from the silent stuck loop.
 */
export function readVerifyFailures(agent, windowSeconds = 24 * 60 * 60, now = new Date()) {
  const config = getConfig();
  if (!existsSync(config.standup)) return [];

  const failures = [];
  for (const line of readFileSync(config.standup, 'utf-8').split('\n')) {
    const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{1,2}:\d{2} [AP]M) (\S+) \[BLOCKED\]: release (\S+) refused — verify failed/);
    if (!match) continue;

    const at = parseAmPmTimestamp(match[1]);
    const failure = { at, agent: match[2], target: match[3], line: line.trim() };
    if (normalizeAgent(agent) && !sameAgent(failure.agent, agent)) continue;
    if (Number.isFinite(windowSeconds) && (!at || now.getTime() - at.getTime() > windowSeconds * 1000)) continue;
    failures.push(failure);
  }
  return failures;
}

/**
 * Evaluate whether a lock shows a progress signal: claimed content moved,
 * a release landed, or a lane receipt appended within the window.
 * Pass pre-read receipts/laneNotes to avoid re-parsing per lock.
 */
export function evaluateLockProgress(lock, { progressWindow, now = new Date(), receipts, laneNotes } = {}) {
  const config = getConfig();
  const window = Number.isFinite(progressWindow) ? progressWindow : config.progressWindow;
  const signals = [];

  if (lock.pathType === 'directory' && lock.progressCheck === 'git-status-porcelain') {
    // Decision 3 (2026-06-12): porcelain non-empty is the v1 directory check;
    // committed work inside the directory shows up as a release receipt instead.
    const status = gitRun(['status', '--porcelain', '--', lock.target], config.root);
    if (status.ok && status.out) signals.push('uncommitted changes inside claimed directory');
  } else if (lock.pathType === 'new') {
    if (existsSync(lock.target)) signals.push('claimed path created since claim');
  } else if (lock.blob) {
    const current = gitRun(['hash-object', lock.target], config.root);
    if (current.ok && current.out && current.out !== lock.blob) {
      signals.push('claimed file changed since claim (blob moved)');
    }
  }

  const agentReceipts = receipts ?? readRecentReceipts(lock.agent, window, now);
  if (agentReceipts.length) {
    signals.push(`release receipt within ${window}s (${agentReceipts[agentReceipts.length - 1].target})`);
  }

  const lane = laneNotes ?? readLaneNotes(lock.agent, window, now);
  if (lane.recentReceipts.length) {
    signals.push(`lane receipt within ${window}s (${lane.recentReceipts[lane.recentReceipts.length - 1].id})`);
  }

  return { progressing: signals.length > 0, signals, window };
}

/**
 * Evaluate many locks with one trace read per agent.
 * Returns a Map of lock target -> { progressing, signals, window }.
 */
export function evaluateLocksProgress(locks, { progressWindow, now = new Date() } = {}) {
  const config = getConfig();
  const window = Number.isFinite(progressWindow) ? progressWindow : config.progressWindow;
  const receiptsByAgent = new Map();
  const lanesByAgent = new Map();
  const results = new Map();

  for (const lock of locks) {
    const key = normalizeAgent(lock.agent);
    if (!receiptsByAgent.has(key)) receiptsByAgent.set(key, readRecentReceipts(key, window, now));
    if (!lanesByAgent.has(key)) lanesByAgent.set(key, readLaneNotes(key, window, now));

    results.set(lock.target, evaluateLockProgress(lock, {
      progressWindow: window,
      now,
      receipts: receiptsByAgent.get(key),
      laneNotes: lanesByAgent.get(key),
    }));
  }
  return results;
}

/**
 * Composite trace for one agent — the read path a reconnect packet
 * (whereami) replays. Locks, receipts, lane state, verify failures.
 */
export function readAgentTrace(agent, { window, now = new Date() } = {}) {
  const config = getConfig();
  const effectiveWindow = Number.isFinite(window) ? window : config.progressWindow;

  return {
    agent: normalizeAgent(agent),
    window: effectiveWindow,
    locks: readClaimState(agent),
    receipts: readRecentReceipts(agent, effectiveWindow, now),
    lane: readLaneNotes(agent, effectiveWindow, now),
    verifyFailures: readVerifyFailures(agent, undefined, now),
  };
}

function gitRun(gitArgs, root) {
  const result = spawnSync('git', gitArgs, { cwd: root, encoding: 'utf-8', stdio: 'pipe' });
  return { ok: result.status === 0, out: result.status === 0 ? String(result.stdout || '').trim() : '' };
}
