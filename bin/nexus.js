#!/usr/bin/env node

import { argv, exit } from 'process';

const COMMANDS = {
  init: () => import('../src/commands/init.js'),
  doctor: () => import('../src/commands/doctor.js'),
  checkin: () => import('../src/commands/checkin.js'),
  checkout: () => import('../src/commands/checkout.js'),
  claim: () => import('../src/commands/claim.js'),
  release: () => import('../src/commands/release.js'),
  status: () => import('../src/commands/status.js'),
  clean: () => import('../src/commands/clean.js'),
  next: () => import('../src/commands/next.js'),
  start: () => import('../src/commands/start.js'),
  dashboard: () => import('../src/commands/dashboard.js'),
  metrics: () => import('../src/commands/metrics.js'),
  ledger: () => import('../src/commands/ledger.js'),
  drill: () => import('../src/commands/drill.js'),
  soul: () => import('../src/commands/soul.js'),
  chmod: () => import('../src/commands/chmod.js'),
  db: () => import('../src/commands/db.js'),
  help: () => import('../src/commands/help.js'),
};

const VERSION = '1.0.0';

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
  console.error(`Unknown command: ${command}`);
  console.error(`Run "nexus help" for available commands.`);
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
  console.log(`
@inkobytes/nexus v${VERSION}
Multi-agent coordination for shared repositories.

Usage: nexus <command> [options]

Commands:
  init                              Scaffold Nexus files into current repo
  doctor [--fix] [--json]           Check or repair agent protocol files
  checkin <agent>                   Signal agent presence (heartbeat)
  checkout [--all] <agent>          Signal session end or cleanup
  claim <path> <agent> "<intent>"   Lock a file or directory
  release <path> "<commit msg>"     Unlock, auto-commit, and log
  status                            Show current blackboard state
  clean [--stale | <path>]          Prune locks (surgical, stale, or nuke)
  next <agent>                      Suggest next safe task from queue
  start [--agent @handle]           Orient an agent entering this repo
  dashboard --serve [--port <port>]  Serve live local Nexus dashboard
  metrics [--json]                   Summarize commits, releases, and queue cost
  ledger [--json|backfill]           Show or backfill completed task ledger
  chmod [--list] [--init]            Show or set promptCHMOD permissions
  db <backup|list|restore|schedule>  Database backup and recovery
  drill <list|show|run|report>       Inspect or run protocol drills
  soul [--file <path>] [--status | --remove]
                                    Manage local soul overlay in agent files
  help                              Show this help

Examples:
  nexus init
  nexus doctor --fix
  nexus doctor --json
  nexus start
  nexus dashboard --serve
  nexus metrics
  nexus metrics --json
  nexus ledger
  nexus ledger --json
  nexus ledger backfill
  nexus drill list
  nexus drill show wrong-repo-push
  nexus drill run wrong-repo-push
  nexus drill report
  nexus soul
  nexus claim src/lib/components/login/ @claude "Building login UI"
  nexus release src/lib/components/login/ "feat: login form component"
  nexus clean --stale
  nexus next @claude
`);
}
