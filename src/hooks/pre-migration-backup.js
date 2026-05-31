#!/usr/bin/env node
/**
 * PreToolUse hook — auto-backup databases before migration commands.
 * Reads Claude Code tool input from stdin, detects migration patterns,
 * runs `nexus db backup --auto` if matched, then exits 0 (allow).
 * Philosophy: backup-then-allow, never block.
 */

import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';

const MIGRATION_PATTERNS = /\b(migrate|db:migrate|alembic\s+upgrade|flyway|sequelize.*migrate|knex.*migrate|prisma\s+migrate)\b/i;

let input;
try {
  input = JSON.parse(readFileSync('/dev/stdin', 'utf-8'));
} catch {
  process.exit(0);
}

const command = input?.tool_input?.command || '';

if (MIGRATION_PATTERNS.test(command)) {
  console.log('[nexus db] Migration detected — running backup before proceeding...');
  const result = spawnSync('nexus', ['db', 'backup', '--auto'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  });
  if (result.status !== 0) {
    console.error('[nexus db] Backup failed — proceeding anyway (check .nexus/db-backups/)');
  }
}

process.exit(0);
