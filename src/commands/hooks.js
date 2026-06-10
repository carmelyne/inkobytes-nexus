/**
 * nexus hooks - install agent-specific local guard hooks
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { homedir } from 'os';

export const HOOK_AGENT_CONFIGS = {
  '@codex': {
    label: 'Codex',
    defaultTarget: '~/.codex/hooks/pre_tool_use_guard.py',
  },
  '@claude': {
    label: 'Claude',
    defaultTarget: '~/.claude/hooks/nexus_pre_tool_use_guard.py',
  },
  '@gemini': {
    label: 'Gemini',
    defaultTarget: '~/.gemini/hooks/nexus_pre_tool_use_guard.py',
  },
};

export const HOOK_FINGERPRINT = 'NEXUS_HOOK_TEMPLATE_V1';

const COMMAND_USAGE = 'Usage: nexus hooks install --agent @codex|@claude|@gemini|all [--target <path>] [--force]';

function parseArgs(args) {
  if (args[0] !== 'install') throw new Error(COMMAND_USAGE);

  let agent = '';
  let target = '';
  let force = false;

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--force') {
      force = true;
      continue;
    }

    if (arg === '--agent') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(COMMAND_USAGE);
      agent = value;
      index += 1;
      continue;
    }

    if (arg === '--target') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(COMMAND_USAGE);
      target = value;
      index += 1;
      continue;
    }

    throw new Error(COMMAND_USAGE);
  }

  const normalizedAgent = agent === '@all' ? 'all' : agent;
  if (normalizedAgent === 'all' && target) throw new Error('Usage: nexus hooks install --agent all [--force]');
  if (normalizedAgent !== 'all' && !HOOK_AGENT_CONFIGS[normalizedAgent]) throw new Error(COMMAND_USAGE);
  return {
    agent: normalizedAgent,
    target: normalizedAgent === 'all' ? '' : target || HOOK_AGENT_CONFIGS[normalizedAgent].defaultTarget,
    force,
  };
}

export function expandHome(path) {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return resolve(homedir(), path.slice(2));
  return resolve(path);
}

export function hookStatus(agent, target = HOOK_AGENT_CONFIGS[agent]?.defaultTarget) {
  if (!HOOK_AGENT_CONFIGS[agent]) throw new Error(`Unsupported hook agent: ${agent}`);
  const path = expandHome(target);
  if (!existsSync(path)) return { agent, path, status: 'missing' };

  const content = readFileSync(path, 'utf-8');
  if (!content.includes(HOOK_FINGERPRINT)) return { agent, path, status: 'foreign' };
  if (!content.includes(`NEXUS_AGENT = '${agent}'`)) return { agent, path, status: 'wrong-agent' };
  return { agent, path, status: 'current' };
}

export function hookScriptContent(agent) {
  if (!HOOK_AGENT_CONFIGS[agent]) throw new Error(`Unsupported hook agent: ${agent}`);

  return `#!/usr/bin/env python3
"""Nexus PreToolUse guard.

${HOOK_FINGERPRINT}
Blocks writes to Nexus repo files until the exact path is claimed.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

NEXUS_AGENT = '${agent}'
ALLOW_WITHOUT_CLAIM = {
    '_NEXUS.md',
    '.codex/CONTINUITY.md',
    '.claude/CONTINUITY.md',
    '.gemini/CONTINUITY.md',
}
ALLOW_PREFIXES = (
    '.nexus/',
    '.codex/memories/',
    '.claude/memories/',
    '.gemini/memories/',
)


def load_payload() -> dict:
    try:
        raw = sys.stdin.read()
        return json.loads(raw) if raw.strip() else {}
    except Exception:
        return {}


def block(reason: str) -> None:
    print(json.dumps({
        'hookSpecificOutput': {
            'hookEventName': 'PreToolUse',
            'permissionDecision': 'deny',
            'permissionDecisionReason': reason,
        }
    }))
    raise SystemExit(0)


def tool_input(payload: dict) -> dict:
    value = payload.get('tool_input') or {}
    return value if isinstance(value, dict) else {}


def command_text(payload: dict) -> str:
    value = tool_input(payload)
    return str(value.get('command') or value.get('cmd') or '')


def find_nexus_root(start: Path) -> Path | None:
    current = start if start.is_dir() else start.parent
    for candidate in (current, *current.parents):
        if (candidate / '.nexus').exists() or (candidate / '_NEXUS_CONSTITUTION.md').exists():
            return candidate
    return None


def repo_relative(path_text: str) -> tuple[Path, str] | None:
    if not path_text:
        return None
    path_text = path_text.strip().strip('"\\'')
    if path_text.startswith('/dev/null'):
        return None
    path = Path(path_text)
    path = (Path.cwd() / path).resolve() if not path.is_absolute() else path.resolve()
    root = find_nexus_root(path) or find_nexus_root(Path.cwd())
    if root is None:
        return None
    try:
        return root, path.relative_to(root).as_posix()
    except ValueError:
        return None


def needs_claim(rel: str) -> bool:
    if rel in ALLOW_WITHOUT_CLAIM:
        return False
    return not rel.startswith(ALLOW_PREFIXES)


def lock_path(root: Path, rel: str) -> Path:
    return root / '.nexus' / 'locks' / f"{rel.replace('/', '~2F')}.lock" / 'ts'


def add_path(paths: set[tuple[Path, str]], path_text: str) -> None:
    item = repo_relative(path_text)
    if item:
        paths.add(item)


def patch_paths(command: str) -> set[tuple[Path, str]]:
    paths: set[tuple[Path, str]] = set()
    for line in command.splitlines():
        match = re.match(r"^\\*\\*\\* (?:Update|Add|Delete) File: (.+)$", line.strip())
        if match:
            add_path(paths, match.group(1))
        move = re.match(r"^\\*\\*\\* Move to: (.+)$", line.strip())
        if move:
            add_path(paths, move.group(1))
    return paths


def input_file_paths(payload: dict) -> set[tuple[Path, str]]:
    paths: set[tuple[Path, str]] = set()
    value = tool_input(payload)
    for key in ('file_path', 'path'):
        if isinstance(value.get(key), str):
            add_path(paths, value[key])
    return paths


def bash_write_paths(command: str) -> set[tuple[Path, str]]:
    paths: set[tuple[Path, str]] = set()
    patterns = [
        r"\\bmv\\s+([^;&|]+?)\\s+([^;&|]+)",
        r"\\bcp\\s+([^;&|]+?)\\s+([^;&|]+)",
        r">> ?([^;&|\\s]+)",
        r"> ?([^;&|\\s]+)",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, command):
            for group in match.groups():
                if not group:
                    continue
                for token in re.split(r"\\s+", group.strip()):
                    add_path(paths, token)
    return paths


def missing_locks(paths: set[tuple[Path, str]]) -> list[tuple[Path, str]]:
    missing = []
    for root, rel in sorted(paths, key=lambda item: (str(item[0]), item[1])):
        if needs_claim(rel) and not lock_path(root, rel).exists():
            missing.append((root, rel))
    return missing


def claim_required_message(missing: list[tuple[Path, str]]) -> str:
    shown = ', '.join(rel for _, rel in missing[:8]) + (' ...' if len(missing) > 8 else '')
    first_root, first_rel = missing[0]
    multi = '\\nIf multiple files are listed, claim each exact path.' if len(missing) > 1 else ''
    return (
        '⛔ CLAIM FIRST: '
        + shown
        + '\\n'
        + f'cd {first_root} && nexus claim {first_rel} {NEXUS_AGENT} "Describe the edit"\\n'
        + 'Retry edit. No workaround.'
        + multi
    )


def main() -> None:
    payload = load_payload()
    command = command_text(payload)
    tool_name = str(payload.get('tool_name') or '')
    paths = input_file_paths(payload)

    if tool_name == 'apply_patch' or command.startswith('*** Begin Patch'):
        paths.update(patch_paths(command))
    else:
        paths.update(bash_write_paths(command))

    missing = missing_locks(paths)
    if missing:
        block(claim_required_message(missing))


if __name__ == '__main__':
    main()
`;
}

export default function hooks(args) {
  const { agent, target, force } = parseArgs(args);
  if (agent === 'all') {
    for (const handle of Object.keys(HOOK_AGENT_CONFIGS)) {
      installHook(handle, HOOK_AGENT_CONFIGS[handle].defaultTarget, force);
    }
    return;
  }

  installHook(agent, target, force);
}

function installHook(agent, target, force) {
  const destination = expandHome(target);
  const current = hookStatus(agent, target);

  if (current.status === 'current' && !force) {
    console.log(`Nexus ${HOOK_AGENT_CONFIGS[agent].label} hook already current at ${destination}`);
    console.log('Run `nexus hooks install --force` to refresh it.');
    return;
  }

  if (existsSync(destination) && current.status === 'foreign' && !force) {
    console.log(`Hook file already exists at ${destination}`);
    console.log('Run with `--force` after reviewing the existing file.');
    return;
  }

  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, hookScriptContent(agent), 'utf-8');
  chmodSync(destination, 0o755);

  console.log(`Installed Nexus ${HOOK_AGENT_CONFIGS[agent].label} hook to ${destination}`);
  console.log('Restart or refresh the agent session so the hook is loaded.');
}
