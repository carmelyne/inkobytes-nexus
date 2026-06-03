import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
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
    assert.match(readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8'), /### Current File State/);
    assert.match(readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8'), /### Git Write Safety/);
    assert.match(readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8'), /Never infer from similar folder names or cached context/);
    assert.match(readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8'), /untrack them; do not delete local folders/);
    assert.match(readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8'), /create the current month folder under `.codex\/memories` if it is missing/);
    assert.match(readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8'), /Do not create or repair other agents' memory folders manually/);
    assert.match(readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8'), /Read `USER\.md` if present/);
    assert.doesNotMatch(readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8'), /Pong/);
    assert.match(readFileSync(join(root, '.codex', 'CONTINUITY.md'), 'utf-8'), /# CONTINUITY/);
    assert.match(readFileSync(join(root, 'DECISIONS.md'), 'utf-8'), /Local agent work decisions live here/);
    assert.match(readFileSync(join(root, '.gitignore'), 'utf-8'), /DECISIONS\.md/);
    assert.match(readFileSync(join(root, '.gitignore'), 'utf-8'), /docs-priv\//);
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

test('doctor --fix repairs standup date guidance without removing entries', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), [
      '# Standup',
      '',
      '*Rules: Append new entries at the bottom. One line per message. Use `YYYY-MM-DD HH:MM @agent [STATUS]: message` so relevance is visible.*',
      '',
      '2026-06-01 08:38 @codex [DONE]: Old entry keeps its text.',
      '',
    ].join('\n'), 'utf-8');

    const report = captureLogs(() => doctor([]));
    assert.match(report, /_NEXUS_STANDUP\.md is missing standard dated AM\/PM message guidance/);

    captureLogs(() => doctor(['--fix']));

    const standup = readFileSync(join(root, '_NEXUS_STANDUP.md'), 'utf-8');
    assert.match(standup, /YYYY-MM-DD HH:MM AM\/PM @agent \[STATUS\]: message/);
    assert.match(standup, /Old entry keeps its text/);

    const cleanReport = captureLogs(() => doctor([]));
    assert.doesNotMatch(cleanReport, /_NEXUS_STANDUP\.md is missing standard dated AM\/PM message guidance/);
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
    assert.match(next, /atomic lock-and-read boundary/);
    assert.match(next, /read a shared file before claiming it, treat that read as stale after claim succeeds/);
    assert.match(next, /claim appears stale/);
    assert.match(next, /### Drills/);
    assert.match(next, /Drill guidance is defined in `_NEXUS_CONSTITUTION\.md`/);
    assert.match(next, /If the situation resembles a drill, use that drill before acting/);
    assert.doesNotMatch(next, /recipes\/task-contract\.md/);
    assert.match(next, /### Delegated Work/);
    assert.match(next, /Lead agents own the repo effects of their subagents/);
    assert.match(next, /Claim the full path scope before delegating shared-file work/);
    assert.match(next, /Mention delegated work in release or `nexus standup` notes/);
    assert.match(next, /Direct user instruction can override queue order/);
    assert.match(next, /announce `Standby` with what you are waiting for/);
    assert.match(next, /agent-native and file-native, not human-native/);
    assert.match(next, /Release each claimed file as soon as it reaches a coherent checkpoint/);
    assert.match(next, /Never hold claims just to bundle a prettier feature commit/);
    assert.match(next, /Agent instruction files are shared protocol files/);
    assert.match(next, /assigned work zones/);
    assert.match(next, /nexus doctor` is cheap, local, and idempotent/);
    assert.match(next, /Security, Package Privacy, Git Privacy, or supply-chain findings/);
    assert.match(next, /specific version publish date/);
    assert.match(next, /DECISIONS\.md/);
    assert.match(next, /mention them in `_NEXUS_STANDUP\.md` only when active agents need to coordinate around them/);
    assert.match(next, /Memory entries are session handoffs/);
    assert.match(next, /create the current month folder under `.codex\/memories` if it is missing/);
    assert.match(next, /Do not create or repair other agents' memory folders manually/);
    assert.match(next, /# YYYY-MM-DD-HHMM - <topic>/);
    assert.match(next, /## Local Notes\n\nKeep this note\./);
  });
});

test('doctor --fix removes duplicate unmarked text when managed block already exists', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    mkdirSync(join(root, '.codex', 'memories', '2026-May'), { recursive: true });
    writeFileSync(join(root, '.codex', 'CONTINUITY.md'), '# CONTINUITY\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'memories', 'INDEX.md'), '- 2026-May/test.md\n', 'utf-8');

    const unmarked = `# Codex Agent Guide

This project uses Nexus for multi-agent coordination.

## Start Here

1. Read \`_NEXUS_CONSTITUTION.md\`.

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
`;

    writeFileSync(join(root, '.codex', 'AGENTS.md'), unmarked, 'utf-8');
    captureLogs(() => doctor(['--fix']));

    const managed = readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8');
    writeFileSync(join(root, '.codex', 'AGENTS.md'), `${unmarked}\n${managed}`, 'utf-8');

    captureLogs(() => doctor(['--fix']));

    const next = readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8');
    assert.equal(next.match(/This project uses Nexus for multi-agent coordination\./g).length, 1);
    assert.equal(next.match(/NEXUS-AGENT-PROTOCOL:START/g).length, 1);
  });
});

test('doctor --fix refreshes stale managed instructions when template changes', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');

    captureLogs(() => doctor(['--fix']));
    const entrypointPath = join(root, '.codex', 'AGENTS.md');
    const current = readFileSync(entrypointPath, 'utf-8');
    writeFileSync(
      entrypointPath,
      current.replace('Use `nexus next @Agent` for the next safe queue task.', 'Use `nexus next @Agent` for queue work.'),
      'utf-8',
    );

    const report = captureLogs(() => doctor([]));
    assert.match(report, /\.codex\/AGENTS\.md needs Nexus protocol block update/);

    captureLogs(() => doctor(['--fix']));
    const next = readFileSync(entrypointPath, 'utf-8');
    assert.match(next, /Use `nexus next @Agent` for the next safe queue task\./);
    assert.match(next, /cached model memory/);
    assert.match(next, /Do not create or repair other agents' memory folders manually/);
    assert.doesNotMatch(next, /Use `nexus next @Agent` for queue work\./);
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

test('doctor --json emits structured sections for integrations', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');

    const output = captureLogs(() => doctor(['--json']));
    const report = JSON.parse(output);

    assert.ok(report.repo.endsWith(root.replace('/private', '')));
    assert.equal(report.fix, false);
    assert.ok(Array.isArray(report.sections.Security));
    assert.ok(Array.isArray(report.sections['Package Privacy']));
  });
});

test('doctor reports package privacy risks from package files allowlist', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      files: ['bin/', '.nexus/local/', '.agy/', '.antigravitycli/', '.codex/', '.agent-codex/', '.agent-session-logs/', 'session-logs/', 'docs-priv/', 'scratch/', 'DECISIONS.md'],
    }), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Package Privacy/);
    assert.match(output, /\.nexus\/local/);
    assert.match(output, /\.agy/);
    assert.match(output, /\.antigravitycli/);
    assert.match(output, /\.codex/);
    assert.match(output, /\.agent-codex/);
    assert.match(output, /\.agent-session-logs/);
    assert.match(output, /session-logs/);
    assert.match(output, /docs-priv/);
    assert.match(output, /scratch/);
    assert.match(output, /DECISIONS\.md/);
  });
});

test('doctor reports tracked private agent state without deleting local files', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.name', 'Test Agent'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    mkdirSync(join(root, '.antigravitycli'), { recursive: true });
    mkdirSync(join(root, '.codex'), { recursive: true });
    mkdirSync(join(root, '.claude'), { recursive: true });
    mkdirSync(join(root, '.gemini'), { recursive: true });
    mkdirSync(join(root, '.agent-codex'), { recursive: true });
    mkdirSync(join(root, '.agent-session-logs'), { recursive: true });
    mkdirSync(join(root, 'session-logs'), { recursive: true });
    mkdirSync(join(root, 'docs-priv'), { recursive: true });
    mkdirSync(join(root, 'scratch'), { recursive: true });
    writeFileSync(join(root, '.antigravitycli', 'AGENTS.md'), '# Local Antigravity notes\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'AGENTS.md'), '# Local agent notes\n', 'utf-8');
    writeFileSync(join(root, '.claude', 'CLAUDE.md'), '# Local Claude notes\n', 'utf-8');
    writeFileSync(join(root, '.gemini', 'GEMINI.md'), '# Local Gemini notes\n', 'utf-8');
    writeFileSync(join(root, '.agent-codex', 'notes.md'), '# Agent notes\n', 'utf-8');
    writeFileSync(join(root, '.agent-session-logs', 'run.log'), 'private log\n', 'utf-8');
    writeFileSync(join(root, 'session-logs', 'run.log'), 'session log\n', 'utf-8');
    writeFileSync(join(root, 'docs-priv', 'private.md'), '# Private docs\n', 'utf-8');
    writeFileSync(join(root, 'scratch', 'note.md'), '# Scratch\n', 'utf-8');
    writeFileSync(join(root, 'DECISIONS.md'), '# Decisions\n', 'utf-8');
    writeFileSync(join(root, 'USER.md'), '# Local user\n', 'utf-8');
    spawnSync('git', ['add', '.antigravitycli/AGENTS.md', '.codex/AGENTS.md', '.claude/CLAUDE.md', '.gemini/GEMINI.md', '.agent-codex/notes.md', '.agent-session-logs/run.log', 'session-logs/run.log', 'docs-priv/private.md', 'scratch/note.md', 'DECISIONS.md', 'USER.md'], { cwd: root, stdio: 'pipe' });

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Git Privacy/);
    assert.match(output, /Tracked shared agent trees detected: \.claude\/ \(1 files\), \.codex\/ \(1 files\), \.gemini\/ \(1 files\)/);
    assert.match(output, /This can be normal in private repos that share agent protocols and memory in Git\./);
    assert.match(output, /Git tracks private\/local path under \.antigravitycli\/ \(1 files\)/);
    assert.match(output, /sample: \.antigravitycli\/AGENTS\.md/);
    assert.doesNotMatch(output, /Git tracks private\/local path under \.codex\/ \(1 files\)/);
    assert.doesNotMatch(output, /Git tracks private\/local path under \.claude\/ \(1 files\)/);
    assert.doesNotMatch(output, /Git tracks private\/local path under \.gemini\/ \(1 files\)/);
    assert.match(output, /Git tracks private\/local path under \.agent-session-logs\/ \(1 files\)/);
    assert.match(output, /sample: \.agent-session-logs\/run\.log/);
    assert.match(output, /Git tracks private\/local path under session-logs\/ \(1 files\)/);
    assert.match(output, /sample: session-logs\/run\.log/);
    assert.match(output, /Git tracks private\/local path under docs-priv\/ \(1 files\)/);
    assert.match(output, /sample: docs-priv\/private\.md/);
    assert.match(output, /Git tracks private\/local path under scratch\/ \(1 files\)/);
    assert.match(output, /sample: scratch\/note\.md/);
    assert.match(output, /Git tracks private\/local path under \.agent-\*\/ \(1 files\)/);
    assert.match(output, /sample: \.agent-codex\/notes\.md/);
    assert.match(output, /Git tracks private\/local path: DECISIONS\.md/);
    assert.match(output, /Git tracks private\/local path: USER\.md/);
    assert.match(output, /git rm --cached -r -- <path>/);
  });
});

test('doctor collapses tracked agent trees into readable summaries', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.name', 'Test Agent'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    mkdirSync(join(root, '.codex', 'memories', '2026-June'), { recursive: true });
    writeFileSync(join(root, '.codex', 'AGENTS.md'), '# Codex\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'CONTINUITY.md'), '# Continuity\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'memories', 'INDEX.md'), '# Index\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'memories', '2026-June', 'one.md'), '# One\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'memories', '2026-June', 'two.md'), '# Two\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'notes.md'), '# Notes\n', 'utf-8');
    spawnSync('git', ['add', '.codex'], { cwd: root, stdio: 'pipe' });

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Tracked shared agent trees detected: \.codex\/ \(6 files\)/);
    assert.match(output, /This can be normal in private repos that share agent protocols and memory in Git\./);
    assert.doesNotMatch(output, /sample: \.codex\/CONTINUITY\.md/);
    assert.doesNotMatch(output, /Git tracks private\/local path: \.codex\/memories\/2026-June\/one\.md/);
  });
});

test('doctor treats tracked shared agent trees as informational when repo config allows them', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.name', 'Test Agent'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    mkdirSync(join(root, '.nexus'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'config.json'), JSON.stringify({
      doctor: {
        allowTrackedAgentTrees: true,
      },
    }), 'utf-8');
    mkdirSync(join(root, '.codex', 'memories'), { recursive: true });
    writeFileSync(join(root, '.codex', 'AGENTS.md'), '# Codex\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'CONTINUITY.md'), '# Continuity\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'memories', 'INDEX.md'), '# Index\n', 'utf-8');
    spawnSync('git', ['add', '.codex'], { cwd: root, stdio: 'pipe' });

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Review \/ informational/);
    assert.match(output, /Tracked shared agent trees detected: \.codex\/ \(3 files\)/);
    assert.match(output, /Allowed by `.nexus\/config\.json` because this repo intentionally versions shared agent trees\./);
    assert.doesNotMatch(output, /If these agent trees are intentionally versioned in this repo, keep them/);
  });
});

test('doctor reports untracked generated-looking artifacts without deleting them', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    mkdirSync(join(root, 'nexus-dashboard copy'), { recursive: true });
    mkdirSync(join(root, 'screenshots'), { recursive: true });
    writeFileSync(join(root, 'nexus-dashboard copy', 'index.html'), '<!doctype html>\n', 'utf-8');
    writeFileSync(join(root, 'screenshots', 'home.png'), 'not really a png\n', 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Generated Artifacts/);
    assert.match(output, /Untracked generated-looking artifact needs owner decision: nexus-dashboard copy/);
    assert.match(output, /Untracked generated-looking artifact needs owner decision: screenshots/);
    assert.match(output, /Nexus will not delete it automatically/);
  });
});

test('doctor reports active locks missing model metadata', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    mkdirSync(join(root, '.nexus', 'locks', 'file.txt.lock'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'locks', 'file.txt.lock', 'ts'), String(Math.floor(Date.now() / 1000)), 'utf-8');
    writeFileSync(join(root, '.nexus', 'locks', 'file.txt.lock', 'agent'), '@codex', 'utf-8');
    writeFileSync(join(root, '.nexus', 'locks', 'file.txt.lock', 'intent'), 'test missing model', 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Fix the following/);
    assert.match(output, /Review \/ informational/);
    assert.match(output, /file: file\.txt/);
    assert.match(output, /by: @codex/);
    assert.match(output, /missing --model metadata/);
    assert.match(output, /fix: use `nexus claim \.\.\. --model <name>` on future claims/);
  });
});

test('doctor renders unverified locks in compact eye-scannable fields', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    mkdirSync(join(root, '.nexus', 'locks', 'teams.svelte.lock'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'locks', 'teams.svelte.lock', 'ts'), String(Math.floor(Date.now() / 1000)), 'utf-8');
    writeFileSync(join(root, '.nexus', 'locks', 'teams.svelte.lock', 'agent'), '', 'utf-8');
    writeFileSync(join(root, '.nexus', 'locks', 'teams.svelte.lock', 'intent'), 'test unverified', 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /file: teams\.svelte/);
    assert.match(output, /by: unknown/);
    assert.match(output, /unverified claim \(trust: unverified\)/);
    assert.match(output, /missing --model metadata/);
    assert.match(output, /fix: set `NEXUS_AGENT=@handle` for local claims, or inspect the lock/);
  });
});

test('doctor colorizes when forced', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');

    const result = spawnSync('node', ['/Users/carmelyne/dev/nexus/bin/nexus.js', 'doctor'], {
      cwd: root,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /\u001b\[36m/);
    assert.match(result.stdout, /Nexus doctor/);
  });
});

test('doctor renders queue authorship warnings as compact task fields', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '# Queue',
      '',
      '## Ready Queue',
      '',
      '- [ ] TASK/Codex: Runtime handoff polling',
      '  - Id: codex-runtime-handoff-polling',
      '  - Auto-flow: yes',
      '',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Queue Authorship/);
    assert.match(output, /task: codex-runtime-handoff-polling/);
    assert.match(output, /auto-flow: yes in Ready Queue/);
    assert.match(output, /needs: Review: approved/);
    assert.match(output, /impact: nexus next will skip it/);
    assert.match(output, /fix: add `Review: approved` and `Approved by: human`, or move it to `## Proposed Queue`/);
    assert.doesNotMatch(output, /is auto-flow: yes in Ready Queue but missing Review: approved/);
  });
});
