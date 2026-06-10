#!/usr/bin/env node

import { argv, exit } from 'process';
import { readFileSync } from 'fs';

const COMMANDS = {
  init: () => import('../src/commands/init.js'),
  doctor: () => import('../src/commands/doctor.js'),
  completion: () => import('../src/commands/completion.js'),
  checkin: () => import('../src/commands/checkin.js'),
  checkout: () => import('../src/commands/checkout.js'),
  claim: () => import('../src/commands/claim.js'),
  release: () => import('../src/commands/release.js'),
  standup: () => import('../src/commands/standup.js'),
  status: () => import('../src/commands/status.js'),
  clean: () => import('../src/commands/clean.js'),
  next: () => import('../src/commands/next.js'),
  start: () => import('../src/commands/start.js'),
  dashboard: () => import('../src/commands/dashboard.js'),
  metrics: () => import('../src/commands/metrics.js'),
  ledger: () => import('../src/commands/ledger.js'),
  drill: () => import('../src/commands/drill.js'),
  hooks: () => import('../src/commands/hooks.js'),
  soul: () => import('../src/commands/soul.js'),
  'install-skill': () => import('../src/commands/install-skill.js'),
  chmod: () => import('../src/commands/chmod.js'),
  db: () => import('../src/commands/db.js'),
  help: () => import('../src/commands/help.js'),
};

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version;
const COLORS = createColors();

const args = argv.slice(2);
const command = args[0];

if (!command || command === 'help' || command === '--help' || command === '-h') {
  printHelp();
  exit(0);
}

if (command === '--version' || command === '-v') {
  console.log(`@inkobytes/nexus v${VERSION}`);
  exit(0);
}

if (!COMMANDS[command]) {
  console.error(COLORS.red(`Unknown command: ${command}`));
  console.error(`Run ${COLORS.cyan('nexus help')} for available commands.`);
  exit(1);
}

try {
  const mod = await COMMANDS[command]();
  await mod.default(args.slice(1));
} catch (err) {
  console.error(`[ERROR] ${err.message}`);
  exit(1);
}

function printHelp() {
  const commands = [
    ['init', 'Scaffold Nexus files into current repo'],
    ['doctor [--fix] [--json]', 'Check or repair agent protocol files'],
    ['completion zsh', 'Print zsh completion script for nexus'],
    ['checkin <agent>', 'Signal agent presence (heartbeat)'],
    ['checkout [--all] <agent>', 'Signal session end or cleanup'],
    ['claim <path> <agent> "<intent>"', 'Lock a file or directory'],
    ['release <path> "<commit msg>"', 'Unlock, auto-commit, and log'],
    ['standup "<dated message>"', 'Append a validated standup line'],
    ['status', 'Show current blackboard state'],
    ['clean [--stale | <path>]', 'Prune locks (surgical, stale, or nuke)'],
    ['next <agent>', 'Suggest next safe task from queue'],
    ['start [--agent @handle]', 'Orient an agent entering this repo'],
    ['dashboard --serve [--port <port>]', 'Serve live local Nexus dashboard'],
    ['metrics [--json]', 'Summarize commits, releases, and queue cost'],
    ['ledger [--json|backfill]', 'Show or backfill completed task ledger'],
    ['chmod [--list] [--init]', 'Show or set promptCHMOD permissions'],
    ['db <backup|list|restore|schedule>', 'Database backup and recovery'],
    ['drill <list|show|run|report>', 'Inspect or run protocol drills'],
    ['hooks install --agent @handle|all', 'Install agent-specific local guard hooks'],
    ['soul [--file <path>] [--status | --remove]', 'Manage local soul overlay in agent files'],
    ['install-skill [--target <path>] [--force]', 'Install bundled Nexus skill into ~/.agents/skills'],
    ['help', 'Show this help'],
  ];

  const examples = [
    'nexus init',
    'nexus doctor --fix',
    'nexus doctor --json',
    'nexus completion zsh',
    'nexus start',
    'nexus dashboard --serve',
    'nexus metrics --json',
    'nexus ledger backfill',
    'nexus drill show wrong-repo-push',
    'nexus hooks install --agent @codex',
    'nexus hooks install --agent all',
    'nexus install-skill',
    'nexus claim src/lib/components/login/ @claude "Building login UI"',
    'nexus release src/lib/components/login/ "feat: login form component"',
    'nexus standup "2026-06-01 08:38 AM @codex [DONE]: Updated tests"',
    'nexus clean --stale',
    'nexus next @claude',
  ];

  const width = Math.max(...commands.map(([left]) => left.length)) + 2;
  const lines = [
    '',
    COLORS.bold(COLORS.cyan(`@inkobytes/nexus v${VERSION}`)),
    COLORS.dim('Multi-agent coordination for shared repositories.'),
    '',
    COLORS.bold('Usage'),
    `  ${COLORS.cyan('nexus')} ${COLORS.yellow('<command>')} ${COLORS.dim('[options]')}`,
    '',
    COLORS.bold('Commands'),
    ...commands.map(([left, right]) => `  ${COLORS.cyan(left.padEnd(width))}${COLORS.dim(right)}`),
    '',
    COLORS.bold('Examples'),
    ...examples.map((example) => `  ${colorizeInline(example)}`),
    '',
    COLORS.dim('Tip: load zsh completions with `source <(nexus completion zsh)` and pair it with zsh-syntax-highlighting for typed command color.'),
    '',
  ];

  console.log(lines.join('\n'));
}

function colorizeInline(value) {
  return String(value)
    .split(/(\s+)/)
    .map((part, index) => {
      if (/^\s+$/.test(part)) return part;
      if (index === 0 && part === 'nexus') return COLORS.cyan(part);
      if (part.startsWith('--')) return COLORS.blue(part);
      if (part.startsWith('@')) return COLORS.green(part);
      if (part.startsWith('"') || part.endsWith('"')) return COLORS.yellow(part);
      return part;
    })
    .join('');
}

function createColors() {
  const enabled = supportsColor();
  const wrap = (open, close) => (value) => enabled ? `\u001b[${open}m${value}\u001b[${close}m` : String(value);
  return {
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    red: wrap(31, 39),
    green: wrap(32, 39),
    yellow: wrap(33, 39),
    blue: wrap(34, 39),
    cyan: wrap(36, 39),
  };
}

function supportsColor() {
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true;
  if ('NO_COLOR' in process.env) return false;
  return Boolean(process.stdout && process.stdout.isTTY);
}
