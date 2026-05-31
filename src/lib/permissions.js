/**
 * promptCHMOD — permission matrix parser and helpers.
 * Advisory only: x bit cannot be mechanically enforced,
 * it is a contract for agents to honor at session start.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function getChmodPath() {
  return join(process.cwd(), '_NEXUS_CHMOD.md');
}

export function parsePermissions(content) {
  const entries = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    const [path, perms, agent = 'all'] = parts;
    if (!/^[r-][w-][x-]$/.test(perms)) continue;
    entries.push({
      path: path.replace(/^\.\//, ''),
      perms: perms.toLowerCase(),
      agent: agent.toLowerCase(),
    });
  }
  return entries;
}

export function loadPermissions() {
  const path = getChmodPath();
  if (!existsSync(path)) return [];
  try {
    return parsePermissions(readFileSync(path, 'utf-8'));
  } catch {
    return [];
  }
}

export function getPermission(filePath, agent = 'all') {
  const entries = loadPermissions();
  const normalized = filePath.replace(/^\.\//, '');
  const agentNorm = agent.toLowerCase();
  const agentEntry = entries.find(e => e.path === normalized && e.agent === agentNorm);
  const allEntry   = entries.find(e => e.path === normalized && e.agent === 'all');
  return agentEntry || allEntry || null;
}

export function isExecutable(filePath, agent = 'all') {
  const p = getPermission(filePath, agent);
  return p ? p.perms[2] === 'x' : null;
}
