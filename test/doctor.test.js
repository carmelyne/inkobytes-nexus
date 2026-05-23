import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import doctor from '../src/commands/doctor.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-doctor-'));
  chdir(root);
  resetConfig();

  try {
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

function captureLogs(fn) {
  const originalLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));

  try {
    fn();
  } finally {
    console.log = originalLog;
  }

  return lines.join('\n');
}

test('doctor --fix creates agent scaffolds and protocol blocks', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    mkdirSync(join(root, '.codex'), { recursive: true });
    writeFileSync(join(root, '.codex', 'AGENTS.md'), '# Existing notes\n', 'utf-8');

    const output = captureLogs(() => doctor(['--fix']));

    assert.match(output, /All checked Nexus categories are ready/);
    assert.match(readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8'), /NEXUS-AGENT-PROTOCOL:START/);
    assert.match(readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8'), /less than 14 days/);
    assert.match(readFileSync(join(root, '.codex', 'CONTINUITY.md'), 'utf-8'), /# CONTINUITY/);
    assert.match(readFileSync(join(root, '.codex', 'memories', 'INDEX.md'), 'utf-8'), /YYYY-Month/);
  });
});

test('doctor reports stale managed protocol blocks without supply-chain safety', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    mkdirSync(join(root, '.codex', 'memories', '2026-May'), { recursive: true });
    writeFileSync(join(root, '.codex', 'CONTINUITY.md'), '# CONTINUITY\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'memories', 'INDEX.md'), '- 2026-May/test.md\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'AGENTS.md'), [
      '<!-- NEXUS-AGENT-PROTOCOL:START -->',
      'Read .codex/CONTINUITY.md and .codex/memories/YYYY-Month/YYYY-MM-DD-HHMM-topic.md.',
      '<!-- NEXUS-AGENT-PROTOCOL:END -->',
      '',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /\.codex\/AGENTS\.md needs Nexus protocol block update/);
  });
});

test('doctor --fix replaces unmarked protocol text instead of duplicating it', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    mkdirSync(join(root, '.codex', 'memories', '2026-May'), { recursive: true });
    writeFileSync(join(root, '.codex', 'CONTINUITY.md'), '# CONTINUITY\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'memories', 'INDEX.md'), '- 2026-May/test.md\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'AGENTS.md'), `# Codex Agent Guide

This project uses Nexus for multi-agent coordination.

## Start Here

1. Read \`_NEXUS_CONSTITUTION.md\`.
2. Read \`_NEXUS_QUEUE.md\` for executable priorities.
3. Read \`_NEXUS_STANDUP.md\` for comms, decisions, and completion notes.
4. Read \`.codex/CONTINUITY.md\` for current session state.
5. Read \`.codex/memories/INDEX.md\` and the latest memory entry when resync is needed.

## Nexus Rules

- Claim before editing shared project files: \`nexus claim <path> @Agent "intent"\`.

## Supply-Chain Safety

- Do not install third-party packages that have existed for less than 14 days.

## Agent-Local Files

\`.codex/CONTINUITY.md\` and \`.codex/memories/INDEX.md\` are agent-local handoff files.

## Memory Flow

- On session start, read \`.codex/memories/INDEX.md\`.

Memory entry format:

\`\`\`markdown
# YYYY-MM-DD — HH:MM — <topic>
\`\`\`

## Local Notes

Keep this note.
`, 'utf-8');

    captureLogs(() => doctor(['--fix']));

    const next = readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8');
    assert.equal(next.match(/This project uses Nexus for multi-agent coordination\./g).length, 1);
    assert.equal(next.match(/NEXUS-AGENT-PROTOCOL:START/g).length, 1);
    assert.match(next, /## Local Notes\n\nKeep this note\./);
  });
});

test('doctor reports legacy helper references before fixing them', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), 'Use ./_nexus_claim.sh now.\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Legacy Helpers/);
    assert.match(output, /_NEXUS_CONSTITUTION.md references legacy _nexus_\*\.sh helpers/);
  });
});

test('doctor reports package script exfiltration risks', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      scripts: {
        postinstall: 'node setup.js',
        report: 'curl https://example.com/hook',
      },
    }), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Security/);
    assert.match(output, /postinstall/);
    assert.match(output, /network download command/);
  });
});
