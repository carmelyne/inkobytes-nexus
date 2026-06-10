/**
 * nexus chmod — manage the promptCHMOD permission matrix.
 * Advisory contract honored at session start, not mechanically enforced:
 * the matrix is human-owned by convention, and the session gate below is an
 * env-var check any process can set in one line. It deters accidental edits;
 * it cannot stop a process that lies about its identity.
 *
 * r = read for reference
 * w = modify (claim/release already enforces this)
 * x = treat as authoritative instructions (the injection surface)
 */

import { DEFAULT_MATRIX, loadPermissions, getChmodPath } from '../lib/permissions.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const VALID_PERMS = /^[r-][w-][x-]$/;

export default function chmod(args) {
  const chmodPath = getChmodPath();

  if (args.includes('--init')) {
    if (existsSync(chmodPath)) {
      console.log('[INFO] _NEXUS_CHMOD.md already exists. Use --list to inspect or edit directly.');
      return;
    }
    writeFileSync(chmodPath, DEFAULT_MATRIX, 'utf-8');
    console.log('[OK] Created _NEXUS_CHMOD.md with default permission matrix.');
    return;
  }

  if (args.length === 0 || args.includes('--list')) {
    if (!existsSync(chmodPath)) {
      console.log('[WARN] No _NEXUS_CHMOD.md found. Run `nexus chmod --init` to create defaults.');
      return;
    }
    const entries = loadPermissions();
    if (!entries.length) {
      console.log('No permissions defined.');
      return;
    }
    console.log('\npromptCHMOD — permission matrix\n');
    console.log('  ' + 'PATH'.padEnd(36) + 'PERMS  AGENT         NOTE');
    console.log('  ' + '─'.repeat(72));
    for (const e of entries) {
      const note = e.perms[2] === 'x' ? 'authoritative' : 'reference only';
      console.log('  ' + e.path.padEnd(36) + e.perms + '   ' + e.agent.padEnd(14) + note);
    }
    console.log('');
    return;
  }

  // nexus chmod <path> <perms> [agent]
  const positional = args.filter(a => !a.startsWith('--'));
  const [target, perms, agent = 'all'] = positional;

  if (!target || !perms) {
    console.error('Usage: nexus chmod <path> <perms> [agent]\n  e.g. nexus chmod USER.md r-x all\nFlags: --list, --init');
    process.exit(1);
  }
  if (!VALID_PERMS.test(perms)) {
    console.error('[ERROR] perms must be 3 chars: [r-][w-][x-]  e.g. r--, rw-, r-x, rwx');
    process.exit(1);
  }

  // Session gate — advisory by design: these env vars are settable by any
  // process, so this deters accidental edits, nothing more.
  const trustSource = process.env.CLAUDECODE === '1' ? 'harness'
    : process.env.NEXUS_AGENT ? 'operator'
    : 'unverified';
  if (trustSource === 'unverified') {
    console.error('[ERROR] nexus chmod expects a recognized session (CLAUDECODE=1 or NEXUS_AGENT set).\nThe matrix is human-owned by convention; this gate is advisory, not enforcement.\nHumans can edit _NEXUS_CHMOD.md directly.');
    process.exit(1);
  }

  const content = existsSync(chmodPath) ? readFileSync(chmodPath, 'utf-8') : DEFAULT_MATRIX;
  const lines = content.split('\n');
  const agentNorm  = agent.toLowerCase();
  const targetNorm = target.replace(/^\.\//, '');

  let found = false;
  const newLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const parts = trimmed.split(/\s+/);
    if (parts[0] === targetNorm && (parts[2] || 'all').toLowerCase() === agentNorm) {
      found = true;
      return targetNorm.padEnd(36) + perms + '   ' + agentNorm;
    }
    return line;
  });

  if (!found) newLines.push(targetNorm.padEnd(36) + perms + '   ' + agentNorm);
  writeFileSync(chmodPath, newLines.join('\n'), 'utf-8');

  const note = perms[2] === 'x' ? 'authoritative (x-on)' : 'reference only (x-off)';
  console.log(`[OK] ${targetNorm} → ${perms} for ${agentNorm} — ${note}`);
}
