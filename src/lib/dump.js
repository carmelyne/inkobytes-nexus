/**
 * File state dumper — outputs fresh file contents after a claim
 * to override stale agent context.
 */

import { existsSync, statSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { getConfig } from './config.js';
import { normalizeTarget } from './pathSafety.js';

/**
 * Recursively collect files in a directory
 */
function collectFiles(dir, files = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files.sort();
}

/**
 * Dump file state for a target (file or directory).
 * Returns the output string.
 */
export function dumpState(target) {
  const config = getConfig();
  const safeTarget = normalizeTarget(target);
  const absoluteTarget = resolve(config.root, safeTarget);
  const lines = [];

  lines.push('--- START OF FRESH FILE STATE ---');

  if (!existsSync(absoluteTarget)) {
    lines.push('(New file/dir — does not exist yet)');
  } else if (statSync(absoluteTarget).isDirectory()) {
    const files = collectFiles(absoluteTarget);

    if (files.length > config.maxDumpFiles) {
      lines.push(`[WARN] Directory contains ${files.length} files. Showing first ${config.maxDumpFiles}.`);
      for (const f of files.slice(0, config.maxDumpFiles)) {
        lines.push(`=== ${f} ===`);
        lines.push(readFileSync(f, 'utf-8'));
      }
      lines.push(`=== ... and ${files.length - config.maxDumpFiles} more files ===`);
    } else {
      for (const f of files) {
        lines.push(`=== ${f} ===`);
        lines.push(readFileSync(f, 'utf-8'));
      }
    }
  } else {
    lines.push(readFileSync(absoluteTarget, 'utf-8'));
  }

  lines.push('--- END OF FRESH FILE STATE ---');
  return lines.join('\n');
}

/**
 * Token-thin alternative to dumpState: prove content identity instead of
 * printing content. The blob hash moves whenever the file changes — shared
 * edits land as commits under claim discipline, and hash-object reads the
 * working tree, so uncommitted drift moves it too.
 */
export function freshnessReceipt(target) {
  const config = getConfig();
  const safeTarget = normalizeTarget(target);
  const absoluteTarget = resolve(config.root, safeTarget);
  const lines = [];

  lines.push('--- FRESHNESS RECEIPT ---');

  if (!existsSync(absoluteTarget)) {
    lines.push(`Path: ${safeTarget}`);
    lines.push('State: new path — does not exist yet');
    lines.push('--- END RECEIPT ---');
    return lines.join('\n');
  }

  const status = gitRun(['status', '--porcelain', '--', safeTarget], config.root);
  const inRepo = status.ok;
  const treeLine = inRepo
    ? `Working tree: ${status.out ? 'dirty vs HEAD' : 'clean vs HEAD'}`
    : 'Working tree: unknown — not a git repo';

  if (statSync(absoluteTarget).isDirectory()) {
    const files = collectFiles(absoluteTarget);
    lines.push(`Path: ${safeTarget}/ (${files.length} files)`);
    lines.push(treeLine);
  } else {
    // hash-object works without a repository: it is pure content identity.
    const blob = gitRun(['hash-object', safeTarget], config.root);
    const lastCommit = inRepo ? gitRun(['log', '-1', '--format=%h %s', '--', safeTarget], config.root) : { out: '' };
    const lineCount = readFileSync(absoluteTarget, 'utf-8').split('\n').length;
    lines.push(`Path: ${safeTarget} (${lineCount} lines)`);
    lines.push(`Blob: ${blob.out || 'unavailable'}`);
    lines.push(`Last commit: ${lastCommit.out || '(none — untracked or no git history)'}`);
    lines.push(treeLine);
  }

  lines.push('Same blob as your last read = cached content is current. Different or unknown = re-read before editing.');
  lines.push('Full contents: claim with --show, or read the file directly.');
  lines.push('--- END RECEIPT ---');
  return lines.join('\n');
}

function gitRun(gitArgs, root) {
  const result = spawnSync('git', gitArgs, { cwd: root, encoding: 'utf-8', stdio: 'pipe' });
  return { ok: result.status === 0, out: result.status === 0 ? String(result.stdout || '').trim() : '' };
}
