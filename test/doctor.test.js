import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const NEXUS_BIN = fileURLToPath(new URL('../bin/nexus.js', import.meta.url));
import doctor from '../src/commands/doctor.js';
import { AGENT_SCOPES } from '../src/lib/agentScopes.js';
import { resetConfig } from '../src/lib/config.js';
import { acquireLock } from '../src/lib/lockManager.js';
import {
  CONTINUITY_TEMPLATE,
  MEMORY_INDEX_TEMPLATE,
  REQUIRED_CONTEXT_READ,
  SKILL_CONTEXT_GUARDRAIL,
  MEMORY_INDEX_GUARDRAIL,
  protocolBlock,
} from '../src/lib/protocolText.js';

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
    const codexGuide = readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8');
    assert.ok(codexGuide.includes(protocolBlock(AGENT_SCOPES['@codex'])));
    assert.match(codexGuide, /less than 14 days/);
    assert.match(codexGuide, /### Current File State/);
    assert.match(codexGuide, /active requirements, not optional guidance/);
    assert.match(codexGuide, /Do not bypass the hook/);
    assert.match(codexGuide, /Claim before reading implementation files/);
    assert.match(codexGuide, /### Git Write Safety/);
    assert.match(codexGuide, /Never infer from similar folder names or cached context/);
    assert.match(codexGuide, /untrack them; do not delete local folders/);
    assert.match(codexGuide, /create the current month folder under `.codex\/memories` if it is missing/);
    assert.match(codexGuide, /Do not create or repair other agents' memory folders manually/);
    assert.match(codexGuide, /Markdown link plus one-line outcome/);
    assert.match(codexGuide, /Continuity is the compaction-safe session ledger/);
    assert.match(codexGuide, /latest memory entry at session start, `nexus start`, or resume/);
    assert.match(codexGuide, /Read `USER\.md` if present/);
    assert.doesNotMatch(codexGuide, /Pong/);
    assert.equal(readFileSync(join(root, '.codex', 'CONTINUITY.md'), 'utf-8'), CONTINUITY_TEMPLATE);
    assert.match(readFileSync(join(root, 'DECISIONS.md'), 'utf-8'), /Local agent work decisions live here/);
    assert.match(readFileSync(join(root, '.gitignore'), 'utf-8'), /DECISIONS\.md/);
    assert.match(readFileSync(join(root, '.gitignore'), 'utf-8'), /docs-priv\//);
    assert.equal(readFileSync(join(root, '.codex', 'memories', 'INDEX.md'), 'utf-8'), MEMORY_INDEX_TEMPLATE);
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

test('doctor reports Nexus README and skill protocol drift in the Nexus product repo', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    mkdirSync(join(root, 'skills', 'nexus'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@inkobytes/nexus' }), 'utf-8');
    writeFileSync(join(root, 'README.md'), [
      '## Queue Format',
      '',
      '- [ ] TASK/Codex: Add doctor stale-lock category',
      '  - Id: doctor-stale-locks',
      '  - Epic: Release hygiene',
      '  - Status: Ready',
      '  - Depends on: none',
      '  - Files: src/commands/doctor.js',
      '  - Affinity: cli, diagnostics',
      '  - Cost: small',
      '  - Auto-flow: yes',
      '  - Notes: Add a doctor section for stale locks with tests and clear fix guidance.',
      '',
      'The CLI is the coordination engine. The skill is the lean playbook for this flow: `start -> claim -> release`.',
      '',
    ].join('\n'), 'utf-8');
    writeFileSync(join(root, 'skills', 'nexus', 'SKILL.md'), [
      '## Loop',
      '',
      '1. Run `nexus start`; set `NEXUS_AGENT` for your CLI, or pass `--agent @agy|@claude|@codex|@gemini`. Start is orientation only, not permission to edit.',
      '2. Read `USER.md` if present for local user preferences.',
      '3. Read continuity and latest memory when present.',
      '4. Read `_NEXUS_QUEUE.md` and `_NEXUS_STANDUP.md`.',
      '5. Choose user-assigned work or `nexus next @Agent`; do not free-roam into `Auto-flow: no`.',
      '6. Claim exact shared files before reading/editing:',
      '',
      '9. If the user wants a commit, release through Nexus:',
      '',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Docs & Skills/);
    assert.match(output, /README\.md is out of sync with current Nexus protocol wording/);
    assert.match(output, /skills\/nexus\/SKILL\.md is out of sync with current Nexus protocol wording/);
  });
});

test('doctor does not treat root README as doctor-managed outside the Nexus product repo', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    mkdirSync(join(root, 'skills', 'nexus'), { recursive: true });
    writeFileSync(join(root, 'README.md'), 'project readme\n', 'utf-8');
    writeFileSync(join(root, 'skills', 'nexus', 'SKILL.md'), [
      '## Loop',
      '',
      '1. Run `nexus start`; set `NEXUS_AGENT` for your CLI, or pass `--agent @agy|@claude|@codex|@gemini`. Start is orientation only, not permission to edit.',
      '2. Read `USER.md` if present for local user preferences.',
      '3. Read continuity and latest memory when present.',
      '4. Read `_NEXUS_QUEUE.md` and `_NEXUS_STANDUP.md`.',
      '5. Choose user-assigned work or `nexus next @Agent`; do not free-roam into `Auto-flow: no`.',
      '6. Claim exact shared files before reading/editing:',
      '',
      '9. If the user wants a commit, release through Nexus:',
      '',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.doesNotMatch(output, /README\.md is out of sync with current Nexus protocol wording/);
    assert.match(output, /skills\/nexus\/SKILL\.md is out of sync with current Nexus protocol wording/);
  });
});

test('doctor --fix repairs Nexus README and skill protocol drift in the Nexus product repo', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    mkdirSync(join(root, 'skills', 'nexus'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@inkobytes/nexus' }), 'utf-8');
    writeFileSync(join(root, 'README.md'), [
      '## Queue Format',
      '',
      '- [ ] TASK/Codex: Add doctor stale-lock category',
      '  - Id: doctor-stale-locks',
      '  - Epic: Release hygiene',
      '  - Status: Ready',
      '  - Depends on: none',
      '  - Files: src/commands/doctor.js',
      '  - Affinity: cli, diagnostics',
      '  - Cost: small',
      '  - Auto-flow: yes',
      '  - Notes: Add a doctor section for stale locks with tests and clear fix guidance.',
      '',
      'The queue is the executable priority surface. Standup is for comms and human context.',
      'Keep items dashboard-friendly: include `Id`, `Epic`, `Status`, `Depends on`, `Files`, `Affinity`, `Cost`, `Auto-flow`, and `Notes`. Use `Files` to expose conflict surfaces, `Depends on` for hard blockers, and `Auto-flow: no` when a task needs planning or human approval before an agent grabs it.',
      '',
      '## Agent Protocol',
      '',
      '1. Run `nexus start` when entering an existing repo; it does not replace claim/release.',
      '2. Read `USER.md` when present.',
      '3. Read continuity and latest memory when present.',
      '4. Read `_NEXUS_QUEUE.md` before taking follow-on work.',
      '5. Claim before touching shared project files.',
      '6. Release when finished.',
      '7. Use `nexus next @Agent` instead of free-roaming.',
      '',
      'Agent-local continuity and memory files are exempt from claim/release unless the human says otherwise.',
      '',
      'The CLI is the coordination engine. The skill is the lean playbook for this flow: `start -> claim -> release`.',
      '',
    ].join('\n'), 'utf-8');
    writeFileSync(join(root, 'skills', 'nexus', 'SKILL.md'), [
      '## Loop',
      '',
      '1. Run `nexus start`; set `NEXUS_AGENT` for your CLI, or pass `--agent @agy|@claude|@codex|@gemini`. Start is orientation only, not permission to edit.',
      '2. Read `USER.md` if present for local user preferences.',
      '3. Read continuity and latest memory when present.',
      '4. Read `_NEXUS_QUEUE.md` and `_NEXUS_STANDUP.md`.',
      '5. Choose user-assigned work or `nexus next @Agent`; do not free-roam into `Auto-flow: no`.',
      '6. Claim exact shared files before reading/editing:',
      '',
      '7. Treat claim output as current file state. Ignore cached file memory when contents matter.',
      '8. Work only inside the claimed surface and run focused validation.',
      '9. If the user wants a commit, release through Nexus:',
      '',
      '- [ ] TASK/@agent: Short task title',
      '  - Id: stable-kebab-id',
      '  - Epic: Product area or safety theme',
      '  - Status: Ready',
      '  - Depends on: none',
      '  - Files: path/one.js, path/two.md',
      '  - Affinity: cli, docs, dashboard',
      '  - Cost: small',
      '  - Auto-flow: yes',
      '  - Notes: One practical paragraph with scope, constraints, and definition of done.',
      '',
      '- `Auto-flow: yes` means an agent can grab it after `nexus next`; use `no` when planning or human approval is needed.',
      '- `Notes` should carry dashboard-useful context, not a whole design doc.',
      '',
      '## Guardrails',
      '',
      '- Agent-local continuity and memory files are claim-exempt unless the user says otherwise.',
      '',
    ].join('\n'), 'utf-8');

    captureLogs(() => doctor(['--fix']));

    const readme = readFileSync(join(root, 'README.md'), 'utf-8');
    const skill = readFileSync(join(root, 'skills', 'nexus', 'SKILL.md'), 'utf-8');

    assert.match(readme, /Review: approved/);
    assert.match(readme, /Approved by: human/);
    assert.match(readme, /Read `_NEXUS_CONSTITUTION\.md`\./);
    assert.ok(readme.includes(REQUIRED_CONTEXT_READ));
    assert.match(readme, /Release each claimed tracked file as soon as it reaches a coherent checkpoint/);
    assert.match(readme, /agent-native and file-native, not human-native/);
    assert.match(readme, /start -> claim -> work -> release -> next/);
    assert.match(skill, /Read `_NEXUS_CONSTITUTION\.md`\./);
    assert.ok(skill.includes(REQUIRED_CONTEXT_READ));
    assert.ok(skill.includes(SKILL_CONTEXT_GUARDRAIL));
    assert.ok(skill.includes(MEMORY_INDEX_GUARDRAIL));
    assert.match(skill, /not optional advice/);
    assert.match(skill, /Do not work around the hook/);
    assert.match(skill, /Release each claimed tracked file through Nexus as soon as it reaches a coherent checkpoint/);
    assert.match(skill, /Review: approved/);
    assert.match(skill, /Approved by: human/);
    assert.match(skill, /doctor` will flag it and `nexus next` may skip it/);
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
    assert.match(next, /atomic lock boundary/);
    assert.match(next, /active requirements, not optional guidance/);
    assert.match(next, /Do not bypass the hook/);
    assert.match(next, /Claim before reading implementation files/);
    assert.match(next, /Same blob hash as your last read means that read is still current/);
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
    assert.match(next, /### Continuity Flow/);
    assert.match(next, /ask once instead of guessing/);
    assert.match(next, /read `.codex\/memories\/INDEX\.md`, then read the newest linked entry/);
    assert.match(next, /# YYYY-MM-DD - HH:MM - <topic>/);
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

    const result = spawnSync('node', [NEXUS_BIN, 'doctor'], {
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

test('doctor warns about unreconciled lane receipts', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '# Queue',
      '',
      '## Ready Queue',
      '',
      '- [ ] TASK/Codex: Build thing',
      '  - Id: build-thing',
      '  - Status: Delegated',
      '  - Lane: _NEXUS_Q_CODEX.md',
      '',
    ].join('\n'), 'utf-8');
    writeFileSync(join(root, '_NEXUS_Q_CODEX.md'), [
      '# Nexus Queue Lane - @codex',
      '',
      '## Active',
      '',
      '## Completed',
      '',
      '- [x] build-thing',
      '  - Id: build-thing',
      '  - Agent: @codex',
      '  - Completed at: 2026-06-11T09:00:00.000Z',
      '  - Receipt: pending reconciliation',
      '',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Queue Lanes/);
    assert.match(output, /Unreconciled lane receipt for build-thing in _NEXUS_Q_CODEX\.md/);
    assert.match(output, /Run `nexus queue reconcile`/);
  });
});

test('doctor warns about duplicate receipts and stale delegated lane disagreements', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '# Queue',
      '',
      '## Ready Queue',
      '',
      '- [ ] TASK/Codex: Build thing',
      '  - Id: build-thing',
      '  - Status: Delegated',
      '  - Delegated to: @codex',
      '  - Delegated at: 2000-01-01T00:00:00.000Z',
      '  - Lane: _NEXUS_Q_CODEX.md',
      '',
      '- [ ] TASK/Codex: Missing lane task',
      '  - Id: missing-lane-task',
      '  - Status: Delegated',
      '  - Delegated to: @codex',
      '  - Delegated at: 2000-01-01T00:00:00.000Z',
      '  - Lane: _NEXUS_Q_CODEX.md',
      '',
    ].join('\n'), 'utf-8');
    writeFileSync(join(root, '_NEXUS_Q_CODEX.md'), [
      '# Nexus Queue Lane - @codex',
      '',
      '## Active',
      '',
      '## Completed',
      '',
      '- [x] build-thing',
      '  - Id: build-thing',
      '  - Agent: @codex',
      '  - Completed at: 2026-06-11T09:00:00.000Z',
      '  - Receipt: pending reconciliation',
      '',
      '- [x] build-thing',
      '  - Id: build-thing',
      '  - Agent: @codex',
      '  - Completed at: 2026-06-11T09:01:00.000Z',
      '  - Receipt: pending reconciliation',
      '',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /duplicate_pending_receipt: build-thing/);
    assert.match(output, /master_delegated_missing_task: missing-lane-task/);
    assert.match(output, /stale_delegated_task: missing-lane-task|stale_delegated_task: build-thing/);
  });
});

test('doctor lists auto-flow tasks failing the full task contract with the missing fields', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '# Queue',
      '',
      '## Ready Queue',
      '',
      '- [ ] TASK/Codex: Approved but hollow task',
      '  - Id: hollow-task',
      '  - Status: Ready',
      '  - Auto-flow: yes',
      '  - Review: approved',
      '  - Approved by: human',
      '',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /task: hollow-task/);
    assert.match(output, /needs: non-empty Notes, non-empty Files, non-empty Cost/);
    assert.match(output, /fix: fill in the missing fields in `_NEXUS_QUEUE\.md`/);
  });
});

test('doctor ignores sample tasks in the executable auto-flow contract checks', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '# Queue',
      '',
      '## Ready Queue',
      '',
      '- [ ] TASK/Codex: Sample hello task',
      '  - Id: hello-main',
      '  - Status: Sample',
      '  - Auto-flow: yes',
      '',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /All auto-flow tasks in Ready Queue satisfy the task contract/);
    assert.match(output, /All auto-flow tasks in Ready Queue declare the task primitives/);
    assert.doesNotMatch(output, /task: hello-main/);
    assert.doesNotMatch(output, /fails the auto-flow task contract/);
  });
});

test('doctor notes sample tasks when a repo already has commits', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.name', 'Test Agent'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'README.md'), '# Real repo\n', 'utf-8');
    spawnSync('git', ['add', 'README.md'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'initial commit'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '# Queue',
      '',
      '## Ready Queue',
      '',
      '- [ ] TASK/Codex: Sample hello task',
      '  - Id: hello-main',
      '  - Status: Sample',
      '  - Auto-flow: no',
      '',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Sample queue tasks remain in a repo with commits \(hello-main\)/);
    assert.match(output, /Keep them as documentation, or remove them once real queue work exists/);
  });
});

test('doctor reports contract ok when auto-flow tasks carry all required fields', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '# Queue',
      '',
      '## Ready Queue',
      '',
      '- [ ] TASK/Codex: Fully specified task',
      '  - Id: good-task',
      '  - Status: Ready',
      '  - Files: src/good.js',
      '  - Cost: small',
      '  - Auto-flow: yes',
      '  - Review: approved',
      '  - Approved by: human',
      '  - Notes: Complete contract.',
      '',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /All auto-flow tasks in Ready Queue satisfy the task contract/);
    assert.doesNotMatch(output, /fails the auto-flow task contract/);
  });
});

test('doctor warns when autonomy is 1+ without a release verify command', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    mkdirSync(join(root, '.nexus'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'config.json'), JSON.stringify({ autonomy: 1 }), 'utf-8');
    resetConfig();

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Loop Readiness/);
    assert.match(output, /autonomy is 1 but release\.verifyCommand is not configured/);
    assert.match(output, /Set release\.verifyCommand in \.nexus\/config\.json/);
  });
});

test('doctor warns at autonomy 2 when no agent budget file exists', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    mkdirSync(join(root, '.nexus'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'config.json'), JSON.stringify({
      autonomy: 2,
      release: { verifyCommand: 'npm test' },
    }), 'utf-8');
    resetConfig();

    const output = captureLogs(() => doctor([]));

    assert.match(output, /autonomy is 2 but no agent budget file exists/);
    assert.match(output, /Create \.nexus\/agent-budgets\.json with per-agent budgets/);
  });
});

test('doctor reports budget ok at autonomy 2 when budget file exists, still flags missing recover', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    mkdirSync(join(root, '.nexus'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'config.json'), JSON.stringify({
      autonomy: 2,
      release: { verifyCommand: 'npm test' },
    }), 'utf-8');
    writeFileSync(join(root, '.nexus', 'agent-budgets.json'), JSON.stringify({ '@claude': { maxTasks: 3 } }), 'utf-8');
    resetConfig();

    const output = captureLogs(() => doctor([]));

    assert.match(output, /autonomy 2 with agent budget file present/);
    // Intentional tripwire: when release-recovery ships src/commands/recover.js,
    // this assertion fails and that task must update Level 2 readiness here.
    assert.match(output, /no `nexus recover` command/);
    assert.doesNotMatch(output, /autonomy is 2 but no agent budget file exists/);
  });
});

test('doctor stays quiet about level 2 prerequisites at autonomy 0 and 1', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    mkdirSync(join(root, '.nexus'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'config.json'), JSON.stringify({
      autonomy: 1,
      release: { verifyCommand: 'npm test' },
    }), 'utf-8');
    resetConfig();

    const output = captureLogs(() => doctor([]));

    assert.doesNotMatch(output, /agent budget file/);
    assert.doesNotMatch(output, /nexus recover/);
  });
});

test('doctor reports loop readiness ok when autonomy 1+ has a verify command', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Queue\n', 'utf-8');
    mkdirSync(join(root, '.nexus'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'config.json'), JSON.stringify({
      autonomy: 1,
      release: { verifyCommand: 'npm test' },
    }), 'utf-8');
    resetConfig();

    const output = captureLogs(() => doctor([]));

    assert.match(output, /autonomy 1 with release verify gate configured \(npm test\)/);
  });
});

const PRIMITIVE_GAP_QUEUE = [
  '# Queue',
  '',
  '## Ready Queue',
  '',
  '- [ ] TASK/Codex: Contract-complete task without primitives',
  '  - Id: no-primitives-task',
  '  - Status: Ready',
  '  - Files: src/good.js',
  '  - Cost: small',
  '  - Auto-flow: yes',
  '  - Review: approved',
  '  - Approved by: human',
  '  - Notes: Complete contract, no primitives yet.',
  '',
].join('\n');

test('doctor reports missing task primitives as advisory below autonomy 2', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), PRIMITIVE_GAP_QUEUE, 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /task: no-primitives-task/);
    assert.match(output, /advisory at autonomy 0; required at autonomy 2/);
    assert.match(output, /needs: Goal, Outcome, Constraints, Stop If, Evidence/);
    assert.doesNotMatch(output, /under-specified for unattended loop work/);
  });
});

test('doctor flags missing task primitives as actionable at autonomy 2', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), PRIMITIVE_GAP_QUEUE, 'utf-8');
    mkdirSync(join(root, '.nexus'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'config.json'), JSON.stringify({
      autonomy: 2,
      release: { verifyCommand: 'npm test' },
    }), 'utf-8');
    writeFileSync(join(root, '.nexus', 'agent-budgets.json'), JSON.stringify({ '@claude': { maxTasks: 3 } }), 'utf-8');
    resetConfig();

    const output = captureLogs(() => doctor([]));

    assert.match(output, /task: no-primitives-task/);
    assert.match(output, /auto-flow: yes in Ready Queue at autonomy 2/);
    assert.match(output, /impact: under-specified for unattended loop work/);
    assert.match(output, /fix: declare Goal, Outcome, Constraints, Stop If, and Evidence/);
    assert.doesNotMatch(output, /advisory at autonomy/);
  });
});

test('doctor compacts identical primitive advisories across multiple tasks', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '# Queue',
      '',
      '## Ready Queue',
      '',
      '- [ ] TASK/Codex: First task without primitives',
      '  - Id: first-task',
      '  - Status: Ready',
      '  - Files: src/a.js',
      '  - Cost: small',
      '  - Auto-flow: yes',
      '  - Review: approved',
      '  - Approved by: human',
      '  - Notes: Complete contract.',
      '',
      '- [ ] TASK/Codex: Second task without primitives',
      '  - Id: second-task',
      '  - Status: Ready',
      '  - Files: src/b.js',
      '  - Cost: small',
      '  - Auto-flow: yes',
      '  - Review: approved',
      '  - Approved by: human',
      '  - Notes: Complete contract.',
      '',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /2 task\(s\): auto-flow: yes in Ready Queue \(advisory at autonomy 0; required at autonomy 2\)/);
    assert.match(output, /tasks: first-task, second-task/);
    assert.equal(output.split('needs: Goal, Outcome').length, 2, 'needs line must print once, not per task');
    assert.equal(output.split('fix: declare Goal').length, 2, 'fix line must print once, not per task');
  });
});

test('doctor reports primitives ok when auto-flow tasks declare all of them', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_CONSTITUTION.md'), '# Constitution\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), '# Standup\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '# Queue',
      '',
      '## Ready Queue',
      '',
      '- [ ] TASK/Codex: Fully primitive task',
      '  - Id: primitive-task',
      '  - Status: Ready',
      '  - Files: src/good.js',
      '  - Cost: small',
      '  - Auto-flow: yes',
      '  - Review: approved',
      '  - Approved by: human',
      '  - Notes: Complete contract.',
      '  - Goal: Prove the primitive checks.',
      '  - Outcome: Doctor reports the primitives as declared.',
      '  - Constraints: Touch only src/good.js.',
      '  - Stop If: The check needs new fields.',
      '  - Evidence: test/doctor.test.js covers the ok path.',
      '',
    ].join('\n'), 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /All auto-flow tasks in Ready Queue declare the task primitives/);
    assert.doesNotMatch(output, /is missing task primitives/);
  });
});

test('doctor reports the active staleness mode', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });

    const onReport = JSON.parse(captureLogs(() => doctor(['--json'])));
    const onEntry = onReport.sections['Loop Readiness'].find((e) => /progress-aware staleness/.test(e.issue));
    assert.ok(onEntry, 'expected a staleness mode entry');
    assert.equal(onEntry.ok, true);
    assert.match(onEntry.issue, /progress-aware staleness on — stale = age >= 600s AND no progress signal within 900s/);

    resetConfig();
    mkdirSync(join(root, '.nexus'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'config.json'), '{ "progressAwareStale": false }', 'utf-8');
    const offReport = JSON.parse(captureLogs(() => doctor(['--json'])));
    const offEntry = offReport.sections['Loop Readiness'].find((e) => /progress-aware staleness/.test(e.issue));
    assert.match(offEntry.issue, /progress-aware staleness off — stale = age >= 600s \(age-only\)/);
  });
});

test('doctor lists an old-but-progressing lock as active, not stale', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'working.txt'), 'v1\n', 'utf-8');

    acquireLock('working.txt', '@claude', 'long session');
    const lockDir = join(root, '.nexus', 'locks', 'working.txt.lock');
    writeFileSync(join(lockDir, 'ts'), String(Math.floor(Date.now() / 1000) - 700), 'utf-8');
    writeFileSync(join(root, 'working.txt'), 'v2 — work in flight\n', 'utf-8');

    const report = JSON.parse(captureLogs(() => doctor(['--json'])));
    const stale = report.sections.Locks.find((e) => e.lockInfo?.kind === 'stale');
    const active = report.sections.Locks.find((e) => e.lockInfo?.kind === 'active');

    assert.equal(stale, undefined, 'progressing lock must not be reported stale');
    assert.ok(active, 'progressing lock is reported active');
  });
});

test('doctor reports an old silent lock as stale in both modes', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'silent.txt'), 'v1\n', 'utf-8');

    acquireLock('silent.txt', '@claude', 'abandoned');
    const lockDir = join(root, '.nexus', 'locks', 'silent.txt.lock');
    writeFileSync(join(lockDir, 'ts'), String(Math.floor(Date.now() / 1000) - 700), 'utf-8');

    const report = JSON.parse(captureLogs(() => doctor(['--json'])));
    const stale = report.sections.Locks.find((e) => e.lockInfo?.kind === 'stale');

    assert.ok(stale, 'silent old lock stays stale');
    assert.match(stale.issue, /Stale lock on silent\.txt/);
  });
});

test('doctor flags an active lock past the progress window with no progress signal', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    mkdirSync(join(root, '.nexus'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'config.json'), '{ "progressWindow": 120 }', 'utf-8');
    writeFileSync(join(root, 'file.txt'), 'v1\n', 'utf-8');

    acquireLock('file.txt', '@claude', 'looping work');
    const lockDir = join(root, '.nexus', 'locks', 'file.txt.lock');
    writeFileSync(join(lockDir, 'ts'), String(Math.floor(Date.now() / 1000) - 150), 'utf-8');

    const report = JSON.parse(captureLogs(() => doctor(['--json'])));
    const entry = report.sections.Locks.find((e) => e.lockInfo?.kind === 'no_progress');

    assert.ok(entry, 'expected a no_progress lock entry');
    assert.equal(entry.ok, true, 'no_progress entries are informational');
    assert.match(entry.issue, /held 1\d\ds with no progress signal — possible stuck loop/);
    assert.match(entry.fix, /nexus halt/);
  });
});

test('doctor does not flag a lock past the progress window when the blob moved', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    mkdirSync(join(root, '.nexus'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'config.json'), '{ "progressWindow": 120 }', 'utf-8');
    writeFileSync(join(root, 'file.txt'), 'v1\n', 'utf-8');

    acquireLock('file.txt', '@claude', 'looping work');
    const lockDir = join(root, '.nexus', 'locks', 'file.txt.lock');
    writeFileSync(join(lockDir, 'ts'), String(Math.floor(Date.now() / 1000) - 150), 'utf-8');
    writeFileSync(join(root, 'file.txt'), 'v2 — actual work happened\n', 'utf-8');

    const report = JSON.parse(captureLogs(() => doctor(['--json'])));
    const entry = report.sections.Locks.find((e) => e.lockInfo?.kind === 'no_progress');

    assert.equal(entry, undefined, 'progressing locks must not be flagged');
  });
});

test('doctor reports a claim/release imbalance when an agent holds claims with no releases', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'a.txt'), 'a\n', 'utf-8');
    writeFileSync(join(root, 'b.txt'), 'b\n', 'utf-8');

    acquireLock('a.txt', '@claude', 'work a');
    acquireLock('b.txt', '@claude', 'work b');

    const report = JSON.parse(captureLogs(() => doctor(['--json'])));
    const entry = report.sections.Locks.find((e) => e.lockInfo?.kind === 'claim_imbalance');

    assert.ok(entry, 'expected a claim_imbalance entry');
    assert.equal(entry.ok, true, 'imbalance entries are informational');
    assert.match(entry.issue, /Agent @claude: 2 claims, 0 releases in last 900s/);
  });
});

test('doctor reports stuck-with-effort on repeated verify failures for the same target', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    const stamp = (date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const rawHour = date.getHours();
      const hour = String(rawHour % 12 || 12).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      const period = rawHour < 12 ? 'AM' : 'PM';
      return `${yyyy}-${mm}-${dd} ${hour}:${minute} ${period}`;
    };
    const recent = stamp(new Date(Date.now() - 60 * 1000));
    writeFileSync(join(root, '_NEXUS_STANDUP.md'), [
      `${recent} @claude [BLOCKED]: release file.txt refused — verify failed (npm test)`,
      `${recent} @claude [BLOCKED]: release file.txt refused — verify failed (npm test)`,
      `${recent} @claude [BLOCKED]: release once.txt refused — verify failed (npm test)`,
    ].join('\n'), 'utf-8');

    const report = JSON.parse(captureLogs(() => doctor(['--json'])));
    const entries = report.sections.Locks.filter((e) => e.lockInfo?.kind === 'stuck_with_effort');

    assert.equal(entries.length, 1, 'only repeated failures are stuck-with-effort');
    assert.equal(entries[0].ok, true, 'stuck-with-effort entries are informational');
    assert.match(entries[0].issue, /Release verify failed 2 times for file\.txt/);
  });
});
