/**
 * Auto-flow task contract — shared by nexus next and nexus doctor.
 *
 * In loop mode the queue is the program: an under-specified Auto-flow task is
 * a bug and must not flow. The field list is data-driven so future Task
 * Primitives (Goal, Outcome, Constraints, Stop If, Evidence) can extend it.
 */

export const AUTOFLOW_CONTRACT = [
  { field: 'Review', needs: 'Review: approved', check: (t) => (t.review || '').toLowerCase() === 'approved' },
  { field: 'Approved by', needs: 'Approved by: human', check: (t) => /human/i.test(t.approvedBy || '') },
  { field: 'Notes', needs: 'non-empty Notes', check: (t) => Boolean((t.notes || '').trim()) },
  { field: 'Files', needs: 'non-empty Files', check: (t) => Array.isArray(t.files) && t.files.filter(Boolean).length > 0 },
  { field: 'Cost', needs: 'non-empty Cost', check: (t) => Boolean((t.cost || '').trim()) },
];

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
    }
  }

  if (current) tasks.push(current);
  return tasks;
}
