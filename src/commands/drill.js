/**
 * nexus drill <list|show|run|report> [id]
 * Protocol drills for known shared-repo failure modes.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from '../lib/config.js';

const DRILL_ROOT = 'drills/nexus-agent-protocol';
const RUNS_ROOT = '.nexus/drill-runs';
const COMMAND_DIR = dirname(fileURLToPath(import.meta.url));
const VALID_STATUSES = new Set(['pass', 'fail', 'needs_review']);

export default function drill(args) {
  const action = args[0] || 'list';
  const rest = args.slice(1);

  switch (action) {
    case 'list':
      listDrills();
      break;
    case 'show':
      requireId(action, rest[0]);
      showDrill(rest[0]);
      break;
    case 'run':
      runDrills(rest);
      break;
    case 'report':
      reportDrills();
      break;
    case '--help':
    case '-h':
    case 'help':
      printHelp();
      break;
    default:
      console.error(`Unknown drill action: ${action}`);
      printHelp();
      process.exit(1);
  }
}

function listDrills() {
  const drills = loadDrills();

  if (drills.length === 0) {
    console.log('No protocol drills found.');
    return;
  }

  console.log('Nexus protocol drills:');
  for (const item of drills) {
    console.log(`- ${item.id} - ${item.description}`);
  }
}

function showDrill(id) {
  const item = findDrill(id);
  console.log(item.raw.trim());
}

function runDrills(args) {
  const options = parseRunOptions(args);
  const drills = options.id ? [findDrill(options.id)] : loadDrills();

  if (drills.length === 0) {
    console.log('No protocol drills found.');
    return;
  }

  const run = createRunArtifacts(drills, options);
  const counts = countStatuses(run.results);

  console.log('# Nexus Protocol Drill Run');
  console.log('');
  console.log(`Run: ${run.id}`);
  console.log(`Artifacts: ${run.relativeDir}`);
  console.log('');
  console.log(`Total: ${run.results.length}`);
  console.log(`Passed: ${counts.pass}`);
  console.log(`Failed: ${counts.fail}`);
  console.log(`Needs Review: ${counts.needs_review}`);
}

function reportDrills() {
  const latest = findLatestRun();

  console.log('# Nexus Protocol Drill Report');
  console.log('');

  if (!latest) {
    console.log('Latest results: none recorded yet.');
    console.log('');
    console.log('Run `nexus drill run` to create .nexus/drill-runs artifacts.');
    return;
  }

  let data;
  try {
    data = JSON.parse(readFileSync(join(latest.absoluteDir, 'results.json'), 'utf-8'));
  } catch {
    console.log('Latest results: unreadable results file.');
    return;
  }

  const results = Array.isArray(data.results) ? data.results : [];
  const counts = countStatuses(results);

  console.log(`Run: ${data.run_id || latest.id}`);
  console.log(`Artifacts: ${latest.relativeDir}`);
  if (data.ran_at) console.log(`Ran at: ${data.ran_at}`);
  if (data.agent) console.log(`Agent: ${data.agent}`);
  console.log('');
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${counts.pass}`);
  console.log(`Failed: ${counts.fail}`);
  console.log(`Needs Review: ${counts.needs_review}`);
  console.log('');

  printResultGroup('Failed', results.filter(result => result.status === 'fail'));
  printResultGroup('Needs Review', results.filter(result => result.status === 'needs_review'));
  printResultGroup('Passed', results.filter(result => result.status === 'pass'));
}

function createRunArtifacts(drills, options) {
  const config = getConfig();
  const runId = formatRunId(new Date());
  const relativeDir = `${RUNS_ROOT}/${runId}`;
  const absoluteDir = join(config.root, RUNS_ROOT, runId);
  mkdirSync(absoluteDir, { recursive: true });

  const input = options.input ? readResultInput(options.input) : {};
  const inputResults = normalizeInputResults(input);
  validateInputResults(drills, inputResults, Boolean(options.input));
  const results = drills.map(item => buildResult(item, inputResults.get(item.id), options, input));

  for (const result of results) {
    writeFileSync(join(absoluteDir, `${result.id}.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
  }

  const payload = {
    run_id: runId,
    ran_at: new Date().toISOString(),
    agent: options.agent || input.agent || process.env.NEXUS_AGENT || null,
    judge: options.judge || input.judge || 'manual',
    source: options.input || null,
    results,
  };
  writeFileSync(join(absoluteDir, 'results.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  writeFileSync(join(absoluteDir, 'report.md'), renderReport(payload), 'utf-8');

  return { id: runId, relativeDir, absoluteDir, results };
}

function parseRunOptions(args) {
  const options = {
    id: null,
    input: null,
    agent: null,
    judge: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--input' || arg === '--results') {
      options.input = requireValue(args, index, arg);
      index += 1;
    } else if (arg === '--agent') {
      options.agent = requireValue(args, index, arg);
      index += 1;
    } else if (arg === '--judge') {
      options.judge = requireValue(args, index, arg);
      index += 1;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown drill run option: ${arg}`);
    } else if (!options.id) {
      options.id = arg;
    } else {
      throw new Error(`Unexpected drill run argument: ${arg}`);
    }
  }

  return options;
}

function requireValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function readResultInput(inputPath) {
  const absolutePath = join(getConfig().root, inputPath);
  try {
    return JSON.parse(readFileSync(absolutePath, 'utf-8'));
  } catch (err) {
    throw new Error(`Could not read drill result input ${inputPath}: ${err.message}`);
  }
}

function normalizeInputResults(input) {
  if (input.id) {
    validateResultShape(input, 'result');
    return new Map([[input.id, input]]);
  }

  const rawResults = Array.isArray(input)
    ? input
    : Array.isArray(input.results)
      ? input.results
      : Object.entries(input.results || {}).map(([id, value]) => ({ id, ...value }));

  const mapped = new Map();
  rawResults.forEach((result, index) => {
    validateResultShape(result, `results[${index}]`);
    if (mapped.has(result.id)) {
      throw new Error(`Duplicate drill result id: ${result.id}`);
    }
    mapped.set(result.id, result);
  });
  return mapped;
}

function validateInputResults(drills, inputResults, inputProvided) {
  const knownIds = new Set(drills.map(item => item.id));

  for (const id of inputResults.keys()) {
    if (!knownIds.has(id)) {
      throw new Error(`Result input contains unknown drill id: ${id}`);
    }
  }

  if (!inputProvided) return;

  const missing = drills
    .filter(item => !inputResults.has(item.id))
    .map(item => item.id);

  if (missing.length > 0) {
    console.warn(`[WARN] Missing result input for drill(s): ${missing.join(', ')}`);
  }
}

function validateResultShape(result, label) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(`Invalid drill result at ${label}: expected object`);
  }
  if (!result.id || typeof result.id !== 'string') {
    throw new Error(`Invalid drill result at ${label}: missing string id`);
  }
  if (result.status !== undefined && !VALID_STATUSES.has(result.status)) {
    throw new Error(`Invalid status for ${result.id}: ${result.status}`);
  }
  validateStringArray(result, 'matched_expected');
  validateStringArray(result, 'matched_fail_if');
  if (result.notes !== undefined && typeof result.notes !== 'string') {
    throw new Error(`Invalid notes for ${result.id}: expected string`);
  }
  if (result.judge !== undefined && typeof result.judge !== 'string') {
    throw new Error(`Invalid judge for ${result.id}: expected string`);
  }
  if (result.confidence !== undefined && (
    typeof result.confidence !== 'number' ||
    result.confidence < 0 ||
    result.confidence > 1
  )) {
    throw new Error(`Invalid confidence for ${result.id}: expected number from 0 to 1`);
  }
}

function validateStringArray(result, field) {
  if (result[field] === undefined) return;
  if (!Array.isArray(result[field]) || result[field].some(item => typeof item !== 'string')) {
    throw new Error(`Invalid ${field} for ${result.id}: expected string array`);
  }
}

function buildResult(drillCase, inputResult, options, input) {
  const matchedExpected = normalizeMatches(inputResult?.matched_expected);
  const matchedFailIf = normalizeMatches(inputResult?.matched_fail_if);
  const unmatchedExpected = drillCase.expected.filter(expected => !matchedExpected.includes(expected));
  const status = decideStatus(inputResult?.status, matchedExpected, matchedFailIf, unmatchedExpected);

  return {
    id: drillCase.id,
    status,
    matched_expected: matchedExpected,
    unmatched_expected: unmatchedExpected,
    matched_fail_if: matchedFailIf,
    notes: inputResult?.notes || defaultNotes(status, inputResult),
    judge: inputResult?.judge || options.judge || input.judge || 'manual',
    confidence: typeof inputResult?.confidence === 'number' ? inputResult.confidence : null,
  };
}

function normalizeMatches(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(item => typeof item === 'string');
}

function decideStatus(requestedStatus, matchedExpected, matchedFailIf, unmatchedExpected) {
  if (matchedFailIf.length > 0 || requestedStatus === 'fail') return 'fail';
  if (requestedStatus === 'needs_review') return 'needs_review';
  if (requestedStatus === 'pass' || (matchedExpected.length > 0 && unmatchedExpected.length === 0)) return 'pass';
  return 'needs_review';
}

function defaultNotes(status, inputResult) {
  if (!inputResult) return 'Missing result input for this drill.';
  if (status === 'fail') return 'A fail_if condition triggered.';
  if (status === 'pass') return 'Expected behavior satisfied and no fail_if condition triggered.';
  return 'Expected behavior is incomplete or judge confidence is low.';
}

function findLatestRun() {
  const config = getConfig();
  const runsDir = join(config.root, RUNS_ROOT);
  if (!existsSync(runsDir)) return null;

  const runs = readdirSync(runsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      id: entry.name,
      relativeDir: `${RUNS_ROOT}/${entry.name}`,
      absoluteDir: join(runsDir, entry.name),
    }))
    .filter(entry => existsSync(join(entry.absoluteDir, 'results.json')))
    .sort((a, b) => a.id.localeCompare(b.id));

  return runs[runs.length - 1] || null;
}

function countStatuses(results) {
  return results.reduce((counts, result) => {
    const status = result.status || 'needs_review';
    if (status === 'pass') counts.pass += 1;
    else if (status === 'fail') counts.fail += 1;
    else counts.needs_review += 1;
    return counts;
  }, { pass: 0, fail: 0, needs_review: 0 });
}

function printResultGroup(label, results) {
  if (results.length === 0) return;

  console.log(`${label}:`);
  for (const result of results) {
    console.log(`- ${result.id}`);
    if (result.notes) console.log(`  Reason: ${result.notes}`);
  }
  console.log('');
}

function renderReport(payload) {
  const counts = countStatuses(payload.results);
  const lines = [
    '# Drill Report',
    '',
    `Run: ${payload.run_id}`,
    `Ran at: ${payload.ran_at}`,
    '',
    `Total: ${payload.results.length}`,
    `Passed: ${counts.pass}`,
    `Failed: ${counts.fail}`,
    `Needs Review: ${counts.needs_review}`,
    '',
  ];

  appendReportGroup(lines, 'Failed', payload.results.filter(result => result.status === 'fail'));
  appendReportGroup(lines, 'Needs Review', payload.results.filter(result => result.status === 'needs_review'));
  appendReportGroup(lines, 'Passed', payload.results.filter(result => result.status === 'pass'));

  return `${lines.join('\n')}\n`;
}

function appendReportGroup(lines, label, results) {
  if (results.length === 0) return;

  lines.push(`## ${label}`);
  lines.push('');

  for (const result of results) {
    lines.push(`- ${result.id}`);
    lines.push(`  - Reason: ${result.notes}`);
    if (result.judge) lines.push(`  - Judge: ${result.judge}`);
    if (typeof result.confidence === 'number') lines.push(`  - Confidence: ${result.confidence}`);
    if (result.matched_fail_if?.length) {
      lines.push(`  - Matched fail_if: ${result.matched_fail_if.join(' | ')}`);
    }
    if (result.unmatched_expected?.length) {
      lines.push(`  - Missing expected: ${result.unmatched_expected.join(' | ')}`);
    }
  }

  lines.push('');
}

function formatRunId(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function findDrill(id) {
  const item = loadDrills().find(drillCase => drillCase.id === id);
  if (!item) {
    throw new Error(`Unknown drill: ${id}`);
  }
  return item;
}

function loadDrills() {
  const casesDir = getDrillCasesDir();
  if (!existsSync(casesDir)) return [];

  return readdirSync(casesDir)
    .filter(name => name.endsWith('.yaml') || name.endsWith('.yml'))
    .sort()
    .map(name => parseDrill(join(casesDir, name)));
}

function getDrillCasesDir() {
  const localCasesDir = join(getConfig().root, DRILL_ROOT, 'cases');
  if (existsSync(localCasesDir)) return localCasesDir;

  return join(COMMAND_DIR, '..', '..', DRILL_ROOT, 'cases');
}

function parseDrill(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');
  const id = readScalar(lines, 'id');
  const prompt = unquote(readScalar(lines, 'prompt'));
  const description = unquote(readScalar(lines, 'description')) || prompt;

  return {
    id,
    description,
    prompt,
    raw,
    setupLines: readBlock(lines, 'setup'),
    expected: readList(lines, 'expected'),
    failIf: readList(lines, 'fail_if'),
  };
}

function readScalar(lines, key) {
  const prefix = `${key}:`;
  const line = lines.find(item => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : '';
}

function readBlock(lines, key) {
  const block = readRawBlock(lines, key);
  return block
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^-\s*/, ''));
}

function readList(lines, key) {
  return readRawBlock(lines, key)
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => unquote(line.replace(/^-\s*/, '')));
}

function readRawBlock(lines, key) {
  const start = lines.findIndex(line => line === `${key}:`);
  if (start === -1) return [];

  const block = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[a-zA-Z_][a-zA-Z0-9_]*:/.test(line)) break;
    block.push(line);
  }
  return block;
}

function unquote(value) {
  return value.replace(/^"(.*)"$/, '$1');
}

function requireId(action, id) {
  if (!id) {
    console.error(`Usage: nexus drill ${action} <id>`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Usage: nexus drill <list|show|run|report> [id]

Commands:
  nexus drill list
  nexus drill show wrong-repo-push
  nexus drill run
  nexus drill run wrong-repo-push
  nexus drill run wrong-repo-push --input judge-results.json
  nexus drill report
`);
}
