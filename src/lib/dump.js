/**
 * File state dumper — outputs fresh file contents after a claim
 * to override stale agent context.
 */

import { existsSync, statSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
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
