/**
 * nexus db — database backup, restore, and schedule.
 * Philosophy: total recoverability over prevention.
 *
 * nexus db backup [--auto]      Snapshot all detected DBs
 * nexus db list                 List available backups
 * nexus db restore <stamp>      Restore from a backup
 * nexus db schedule             Show cron setup instructions
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { cwd, env } from 'process';
import { spawnSync } from 'child_process';

const BACKUP_DIR = '.nexus/db-backups';
const MIGRATION_PATTERNS = /\b(migrate|db:migrate|alembic\s+upgrade|flyway|sequelize.*migrate|knex.*migrate|prisma\s+migrate)\b/i;

export { MIGRATION_PATTERNS };

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function detectDatabases(root) {
  const dbs = [];

  // SQLite: scan for .sqlite and .db files, skip node_modules/.git/.nexus
  const SKIP = new Set(['node_modules', '.git', '.nexus', 'dist', 'build']);
  function scanDir(dir, depth = 0) {
    if (depth > 4) return;
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      if (SKIP.has(entry)) continue;
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) { scanDir(full, depth + 1); continue; }
        if (/\.(sqlite|sqlite3|db)$/.test(entry)) {
          dbs.push({ type: 'sqlite', path: full, relPath: relative(root, full), name: entry });
        }
      } catch { /* skip unreadable */ }
    }
  }
  scanDir(root);

  // Postgres / MySQL via DATABASE_URL
  const dbUrl = env.DATABASE_URL || env.POSTGRES_URL || env.MYSQL_URL;
  if (dbUrl) {
    const isPostgres = /^postgres(ql)?:\/\//i.test(dbUrl);
    const isMysql = /^mysql:\/\//i.test(dbUrl);
    if (isPostgres) dbs.push({ type: 'postgres', url: dbUrl, name: 'postgres' });
    if (isMysql) dbs.push({ type: 'mysql', url: dbUrl, name: 'mysql' });
  }

  return dbs;
}

function backupSqlite(db, backupPath) {
  // Mirror the repo-relative path inside the backup so same-named DBs in
  // different directories cannot overwrite each other.
  const dest = join(backupPath, db.relPath);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(db.path, dest);
  return db.relPath;
}

function backupPostgres(db, backupPath) {
  const outFile = join(backupPath, 'dump.sql');
  const result = spawnSync('pg_dump', [db.url, '--file', outFile], {
    encoding: 'utf-8', stdio: 'pipe',
  });
  if (result.status !== 0) throw new Error(`pg_dump failed: ${result.stderr}`);
  return 'dump.sql';
}

function backupMysql(db, backupPath) {
  const outFile = join(backupPath, 'dump.sql');
  const result = spawnSync('sh', ['-c', `mysqldump "${db.url}" > "${outFile}"`], {
    encoding: 'utf-8', stdio: 'pipe',
  });
  if (result.status !== 0) throw new Error(`mysqldump failed: ${result.stderr}`);
  return 'dump.sql';
}

export default function db(args) {
  const root = cwd();
  const subcommand = args[0];

  if (!subcommand || subcommand === '--help') {
    console.log('Usage: nexus db <backup|list|restore|schedule> [options]');
    console.log('  backup [--auto]    Snapshot all detected databases');
    console.log('  list               Show available backups');
    console.log('  restore <stamp>    Restore from a backup stamp');
    console.log('  schedule           Show cron setup for daily backups');
    return;
  }

  if (subcommand === 'backup') return runBackup(root, args.includes('--auto'));
  if (subcommand === 'list')   return runList(root);
  if (subcommand === 'restore') return runRestore(root, args[1]);
  if (subcommand === 'schedule') return runSchedule(root);

  console.error(`Unknown db subcommand: ${subcommand}`);
  process.exit(1);
}

function runBackup(root, auto = false) {
  const dbs = detectDatabases(root);

  if (!dbs.length) {
    console.log('[nexus db] No databases detected. Checked: *.sqlite, *.db, DATABASE_URL.');
    return;
  }

  const stamp = timestamp();
  const backupPath = join(root, BACKUP_DIR, stamp);
  mkdirSync(backupPath, { recursive: true });

  const results = [];
  for (const db of dbs) {
    try {
      let file;
      if (db.type === 'sqlite')   file = backupSqlite(db, backupPath);
      if (db.type === 'postgres') file = backupPostgres(db, backupPath);
      if (db.type === 'mysql')    file = backupMysql(db, backupPath);
      results.push({ db: db.name, path: db.relPath, type: db.type, file, ok: true });
      console.log(`[nexus db] ✓ ${db.type} ${db.name} → ${BACKUP_DIR}/${stamp}/${file}`);
    } catch (err) {
      results.push({ db: db.name, type: db.type, ok: false, error: err.message });
      console.error(`[nexus db] ✗ ${db.type} ${db.name}: ${err.message}`);
    }
  }

  // Write manifest
  writeFileSync(
    join(backupPath, 'manifest.json'),
    JSON.stringify({ stamp, auto, root, dbs: results }, null, 2),
    'utf-8'
  );

  const ok = results.every(r => r.ok);
  if (auto) {
    console.log(`[nexus db] Backup complete (${stamp}). Proceeding with migration.`);
  } else {
    console.log(`\nStamp: ${stamp}`);
    console.log(`Restore with: nexus db restore ${stamp}`);
  }

  return ok;
}

function runList(root) {
  const backupRoot = join(root, BACKUP_DIR);
  if (!existsSync(backupRoot)) {
    console.log('[nexus db] No backups found. Run `nexus db backup` first.');
    return;
  }

  const entries = readdirSync(backupRoot)
    .filter(e => statSync(join(backupRoot, e)).isDirectory())
    .sort()
    .reverse();

  if (!entries.length) {
    console.log('[nexus db] No backups found.');
    return;
  }

  console.log('\nNexus DB Backups\n');
  console.log('  ' + 'STAMP'.padEnd(22) + 'DATABASES');
  console.log('  ' + '─'.repeat(50));

  for (const stamp of entries) {
    const manifestPath = join(backupRoot, stamp, 'manifest.json');
    let dbs = '(no manifest)';
    if (existsSync(manifestPath)) {
      try {
        const m = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        dbs = m.dbs.map(d => `${d.type}:${d.db}`).join(', ');
        if (m.auto) dbs += ' [auto]';
      } catch { /* ignore */ }
    }
    console.log('  ' + stamp.padEnd(22) + dbs);
  }
  console.log('');
}

function runRestore(root, stamp) {
  if (!stamp) {
    console.error('Usage: nexus db restore <stamp>');
    console.error('Run `nexus db list` to see available stamps.');
    process.exit(1);
  }

  const backupPath = join(root, BACKUP_DIR, stamp);
  if (!existsSync(backupPath)) {
    console.error(`[nexus db] Backup not found: ${stamp}`);
    console.error('Run `nexus db list` to see available stamps.');
    process.exit(1);
  }

  const manifestPath = join(backupPath, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`[nexus db] No manifest in backup ${stamp}. Cannot restore safely.`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  console.log(`\n[nexus db] Restoring from ${stamp}...\n`);

  for (const entry of manifest.dbs) {
    if (!entry.ok) {
      console.log(`  skip ${entry.db} — backup was incomplete`);
      continue;
    }
    const backupFile = join(backupPath, entry.file);

    if (entry.type === 'sqlite') {
      // Older manifests stored only the basename; fall back so they stay restorable.
      const rel = entry.path || entry.db;
      const target = join(root, rel);
      if (!existsSync(backupFile)) {
        console.error(`  ✗ sqlite ${entry.db}: backup file missing — expected ${backupFile}`);
        process.exitCode = 1;
      } else if (!existsSync(dirname(target))) {
        console.error(`  ✗ sqlite ${entry.db}: original directory is gone (${dirname(rel)}/) — restore manually from ${backupFile}`);
        process.exitCode = 1;
      } else {
        copyFileSync(backupFile, target);
        console.log(`  ✓ sqlite ${entry.db} → ${rel}`);
      }
    }

    if (entry.type === 'postgres') {
      const url = env.DATABASE_URL || env.POSTGRES_URL;
      if (!url) { console.log(`  ✗ postgres: DATABASE_URL not set`); continue; }
      const result = spawnSync('psql', [url, '--file', backupFile], { stdio: 'inherit' });
      console.log(result.status === 0 ? `  ✓ postgres restored` : `  ✗ postgres restore failed`);
    }

    if (entry.type === 'mysql') {
      const url = env.DATABASE_URL || env.MYSQL_URL;
      if (!url) { console.log(`  ✗ mysql: DATABASE_URL not set`); continue; }
      const result = spawnSync('sh', ['-c', `mysql "${url}" < "${backupFile}"`], { stdio: 'inherit' });
      console.log(result.status === 0 ? `  ✓ mysql restored` : `  ✗ mysql restore failed`);
    }
  }
  console.log('');
}

function runSchedule(root) {
  const nexusBin = 'nexus db backup';
  console.log('\nnexus db schedule — daily backup setup\n');
  console.log('Add one of these to your crontab (`crontab -e`):\n');
  console.log(`  # Daily at 2am`);
  console.log(`  0 2 * * * cd ${root} && ${nexusBin} >> .nexus/db-backups/cron.log 2>&1\n`);
  console.log('Or for a project-specific .env-aware setup:');
  console.log(`  0 2 * * * cd ${root} && source .env && ${nexusBin} >> .nexus/db-backups/cron.log 2>&1\n`);
  console.log('Backups are stored in: .nexus/db-backups/');
  console.log('Restore with: nexus db restore <stamp>');
  console.log('');
}
