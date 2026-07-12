/**
 * nexus trash — rollback-friendly local delete primitive.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { basename, dirname, join } from 'path';
import { cwd } from 'process';
import { normalizeTarget } from '../lib/pathSafety.js';

const TRASH_HOOK_FINGERPRINT = 'NEXUS_TRASH_GUARD_V1';

export default function trash(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args.includes('--hooks')) {
    installTrashHook();
    return;
  }

  if (args.includes('--list')) {
    listTrash();
    return;
  }

  const restoreIndex = args.indexOf('--restore');
  if (restoreIndex !== -1) {
    const id = args[restoreIndex + 1];
    if (!id || id.startsWith('--')) throw new Error('Usage: nexus trash --restore <id>');
    restoreTrash(id);
    return;
  }

  const target = args.find((arg) => !arg.startsWith('--'));
  if (!target) throw new Error('Usage: nexus trash <path> [--reason <text>] | --list | --restore <id> | --hooks');

  const reason = optionValue(args, '--reason') || '';
  moveToTrash(target, reason);
}

function moveToTrash(target, reason) {
  const root = cwd();
  const rel = normalizeTarget(target);
  const source = join(root, rel);
  if (!existsSync(source)) throw new Error(`Target does not exist: ${rel}`);

  const id = makeTrashId(rel);
  const itemPath = join(trashFilesDir(root), id, rel);
  const infoPath = join(trashInfoDir(root), `${id}.json`);
  mkdirSync(dirname(itemPath), { recursive: true });
  mkdirSync(dirname(infoPath), { recursive: true });

  renameSync(source, itemPath);
  const info = {
    id,
    originalPath: rel,
    trashedAt: new Date().toISOString(),
    reason,
  };
  writeFileSync(infoPath, `${JSON.stringify(info, null, 2)}\n`, 'utf-8');

  console.log(`Trashed ${rel}`);
  console.log(`id: ${id}`);
}

function listTrash() {
  const root = cwd();
  const entries = readTrashEntries(root);
  if (!entries.length) {
    console.log('Nexus trash is empty.');
    return;
  }

  for (const entry of entries) {
    console.log(`${entry.id}  ${entry.originalPath}  ${entry.reason || ''}`.trimEnd());
  }
}

function restoreTrash(id) {
  const root = cwd();
  const safeId = safeTrashId(id);
  const infoPath = join(trashInfoDir(root), `${safeId}.json`);
  if (!existsSync(infoPath)) throw new Error(`Trash entry not found: ${safeId}`);

  const info = JSON.parse(readFileSync(infoPath, 'utf-8'));
  const rel = normalizeTarget(info.originalPath);
  const source = join(trashFilesDir(root), safeId, rel);
  const destination = join(root, rel);
  if (!existsSync(source)) throw new Error(`Trash payload missing for ${safeId}`);
  if (existsSync(destination)) throw new Error(`Refusing to restore over existing path: ${rel}`);

  mkdirSync(dirname(destination), { recursive: true });
  renameSync(source, destination);
  rmSync(join(trashFilesDir(root), safeId), { recursive: true, force: true });
  rmSync(infoPath, { force: true });
  console.log(`Restored ${rel}`);
}

function installTrashHook() {
  const root = cwd();
  const settingsPath = join(root, '.claude', 'settings.json');
  const hookPath = join(root, '.claude', 'hooks', 'nexus_trash_guard.py');

  if (existsSync(settingsPath)) {
    throw new Error('Refusing to overwrite existing .claude/settings.json; merge the trash hook manually.');
  }

  mkdirSync(dirname(hookPath), { recursive: true });
  writeFileSync(hookPath, trashHookContent(), 'utf-8');
  writeFileSync(settingsPath, `${JSON.stringify(trashHookSettings(), null, 2)}\n`, 'utf-8');

  console.log('Installed Nexus trash guard hook.');
  console.log('Hook: .claude/hooks/nexus_trash_guard.py');
  console.log('Settings: .claude/settings.json');
}

function trashHookSettings() {
  return {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: 'python3 .claude/hooks/nexus_trash_guard.py',
            },
          ],
        },
      ],
    },
  };
}

function trashHookContent() {
  return `#!/usr/bin/env python3
"""Nexus trash guard.

${TRASH_HOOK_FINGERPRINT}
Blocks common irreversible shell deletes and points agents at nexus trash.
"""
from __future__ import annotations

import json
import re
import sys


def main() -> None:
    try:
        payload = json.loads(sys.stdin.read() or '{}')
    except Exception:
        payload = {}
    tool_input = payload.get('tool_input') if isinstance(payload.get('tool_input'), dict) else {}
    command = str(tool_input.get('command') or tool_input.get('cmd') or '')
    if re.search(r'(^|[;&|]\\s*)(rm|trash|gio\\s+trash|kioclient5\\s+move)\\b', command):
        print(json.dumps({
            'hookSpecificOutput': {
                'hookEventName': 'PreToolUse',
                'permissionDecision': 'deny',
                'permissionDecisionReason': 'Use \`nexus trash <path>\` instead of irreversible delete.',
            }
        }))


if __name__ == '__main__':
    main()
`;
}

function readTrashEntries(root) {
  const infoDir = trashInfoDir(root);
  if (!existsSync(infoDir)) return [];
  return readdirSync(infoDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(join(infoDir, file), 'utf-8')))
    .sort((a, b) => String(b.trashedAt).localeCompare(String(a.trashedAt)));
}

function makeTrashId(rel) {
  const timestamp = new Date().toISOString().replace(/\D/g, '');
  const slug = basename(rel).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'item';
  return safeTrashId(`${timestamp}-${slug}`);
}

function safeTrashId(id) {
  const value = String(id || '').trim();
  if (!/^[a-z0-9._-]+$/i.test(value)) throw new Error('Invalid trash id.');
  return value;
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return '';
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function trashFilesDir(root) {
  return join(root, '.nexus', 'trash', 'files');
}

function trashInfoDir(root) {
  return join(root, '.nexus', 'trash', 'info');
}

function printHelp() {
  console.log(`Usage:
  nexus trash <path> [--reason <text>]
  nexus trash --list
  nexus trash --restore <id>
  nexus trash --hooks
`);
}

export function trashSize(root = cwd()) {
  return directorySize(join(root, '.nexus', 'trash'));
}

function directorySize(path) {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return 0;
  return readdirSync(path).reduce((total, child) => total + directorySize(join(path, child)), 0);
}
