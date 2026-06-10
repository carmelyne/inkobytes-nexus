/**
 * nexus install-skill - install the bundled Nexus agent skill
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { basename, dirname, parse, resolve } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const COMMAND_USAGE = 'Usage: nexus install-skill [--target <path>] [--force]';
const DEFAULT_TARGET = '~/.agents/skills/nexus';

function parseArgs(args) {
  let target = DEFAULT_TARGET;
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--force') {
      force = true;
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

  return { target, force };
}

function expandHome(path) {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return resolve(homedir(), path.slice(2));
  return resolve(path);
}

function packageRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function assertSafeSkillTarget(destination) {
  if (basename(destination) !== 'nexus') {
    throw new Error('Install target must be the Nexus skill directory, for example ~/.agents/skills/nexus.');
  }

  if (destination === parse(destination).root || destination === homedir()) {
    throw new Error('Install target is too broad.');
  }
}

export default function installSkill(args) {
  const { target, force } = parseArgs(args);
  const source = resolve(packageRoot(), 'skills', 'nexus');
  const destination = expandHome(target);

  if (!existsSync(source)) {
    throw new Error(`Bundled Nexus skill not found: ${source}`);
  }

  assertSafeSkillTarget(destination);

  if (existsSync(destination)) {
    if (!force) {
      console.log(`Nexus skill already installed at ${destination}`);
      console.log('Run `nexus install-skill --force` to refresh it.');
      return;
    }
    rmSync(destination, { recursive: true, force: true });
  }

  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });

  console.log(`Installed Nexus skill to ${destination}`);
  console.log('Restart or refresh your agent session so the skill registry can pick it up.');
}
