/**
 * Auto-flow task contract — shared by nexus next and nexus doctor.
 *
 * In loop mode the queue is the program: an under-specified Auto-flow task is
 * a bug and must not flow. The field list is data-driven so the contract can
 * grow without touching the consumers.
 */

export const AUTOFLOW_CONTRACT = [
  { field: 'Review', needs: 'Review: approved', check: (t) => (t.review || '').toLowerCase() === 'approved' },
  { field: 'Approved by', needs: 'Approved by: human', check: (t) => /human/i.test(t.approvedBy || '') },
  { field: 'Notes', needs: 'non-empty Notes', check: (t) => Boolean((t.notes || '').trim()) },
  { field: 'Files', needs: 'non-empty Files', check: (t) => Array.isArray(t.files) && t.files.filter(Boolean).length > 0 },
  { field: 'Cost', needs: 'non-empty Cost', check: (t) => Boolean((t.cost || '').trim()) },
];

/**
 * Task Primitives — the agent-native task definition fields.
 *
 * Net-new on top of the auto-flow contract: Goal, Outcome, Constraints,
 * Stop If, Evidence. Scope extends Files, Dependencies = Depends on, and
 * Gates extend Review/Approved by, so those stay on their existing fields.
 *
 * Loop principle: Outcome + Evidence + Stop If are the anti-over-looping
 * contract — they define when a loop agent is finished and when it must
 * stop for a human. Evidence is prospective at authoring time (what will
 * prove completion) and retrospective once Done (what does prove it).
 */
export const TASK_PRIMITIVES = [
  { field: 'Goal', key: 'goal', describes: 'why the task exists' },
  { field: 'Outcome', key: 'outcome', describes: 'what must be true when complete' },
  { field: 'Constraints', key: 'constraints', describes: 'what the agent must not change or assume' },
  { field: 'Stop If', key: 'stopIf', describes: 'conditions requiring human review' },
  { field: 'Evidence', key: 'evidence', describes: 'tests, logs, or reports proving completion' },
];

// Returns the primitives a parsed queue task has not declared.
export function primitiveGaps(task) {
  return TASK_PRIMITIVES.filter(({ key }) => !String(task[key] || '').trim());
}

// Returns the unmet contract entries for a parsed queue task.
export function contractViolations(task) {
  return AUTOFLOW_CONTRACT.filter(({ check }) => !check(task)).map(({ field, needs }) => ({ field, needs }));
}

// Minimal queue-section parser carrying every contract field.
// next.js keeps its richer parser (drills, affinity, scoring); doctor uses this one.
export function parseContractTasks(sectionContent) {
  const tasks = [];
  let current = null;

  for (const line of sectionContent.split('\n')) {
    const header = line.match(/^- \[[ x]\] TASK\/.+?:\s*(.+)/);
    if (header) {
      if (current) tasks.push(current);
      current = {
        title: header[1],
        done: /^- \[x\]/.test(line),
        id: '',
        status: '',
        files: [],
        cost: '',
        autoFlow: 'no',
        review: '',
        approvedBy: '',
        notes: '',
        goal: '',
        outcome: '',
        constraints: '',
        stopIf: '',
        evidence: '',
      };
      continue;
    }

    if (!current || !line.trim().startsWith('- ')) continue;
    const kv = line.trim().replace(/^-\s*/, '');
    const colonIdx = kv.indexOf(':');
    if (colonIdx === -1) continue;

    const key = kv.slice(0, colonIdx).trim().toLowerCase();
    const val = kv.slice(colonIdx + 1).trim();

    switch (key) {
      case 'id': current.id = val; break;
      case 'status': current.status = val; break;
      case 'files': current.files = val.split(',').map(s => s.trim()).filter(Boolean); break;
      case 'cost': current.cost = val; break;
      case 'auto-flow': current.autoFlow = val.toLowerCase(); break;
      case 'review': current.review = val.toLowerCase(); break;
      case 'approved by': current.approvedBy = val; break;
      case 'notes': current.notes = val; break;
      case 'goal': current.goal = val; break;
      case 'outcome': current.outcome = val; break;
      case 'constraints': current.constraints = val; break;
      case 'stop if': current.stopIf = val; break;
      case 'evidence': current.evidence = val; break;
    }
  }

  if (current) tasks.push(current);
  return tasks;
}
