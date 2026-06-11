# Loop Progress Signals — Design Proposal

Status: proposal, design only. No enforcement until the human reviews this doc.
Task: `loop-progress-signals` | Epic: Loop readiness | Author: @claude, 2026-06-12

## Problem

Stale detection assumes dead agents go quiet. Loop agents break that assumption
in both directions:

1. **Stuck-but-alive.** A looping agent keeps its lock fresh (presence
   heartbeats, metadata touches) while making zero progress. Age-based
   staleness never fires. The lock looks healthy forever.
2. **Alive-but-slow.** A working agent holds a claim for a long, legitimate
   implementation session. Age-based staleness fires anyway. Real incident,
   2026-06-11: a 75-minute work session against the 600s `staleThreshold` got
   its `_NEXUS_QUEUE.md` lock swept mid-release chain, producing the
   `Agent: unknown` ledger entry that motivated `release-attribution-fallback`.

Age measures neither death nor progress. It measures age.

## Principle: measure the mound, not the ant

Self-reported liveness is gameable by exactly the failure mode we care about —
a stuck loop is *great* at touching files on schedule. The only trustworthy
progress signal is an observable repo-state delta attributable to the agent:
content changed, commits landed, receipts appended. Stigmergy already gives us
this for free: work leaves traces in the environment. Read the traces.

## Candidate signals evaluated

| Signal | Cost | Gameable? | Verdict |
|---|---|---|---|
| Claim metadata touch on events | ~0 | Yes — touching is what stuck loops do | Reject as primary; keep as corroboration |
| **Blob-hash movement of claimed files** | One `git hash-object` per check | No — requires actual content change | **Primary** |
| **Releases per window (report/ledger timestamps)** | One file read | No — releases pass the verify gate | **Primary** |
| Lane receipt cadence (`_NEXUS_Q_<AGENT>.md` appends) | One file read | Weakly — receipts are structured | Secondary, delegated work only |
| Standup cadence | One file read | Yes — chatter is not work | Corroboration only |
| Repeated verify failures on release | Already logged to standup | No | Distinct label: stuck-with-effort |

## Proposal

### 1. Record a claim-time blob hash in lock metadata

`nexus claim` already stores `ts`, `agent`, `intent`, `claim-head`. Add `blob`:
the `git hash-object` of the claimed file at claim time (directories: skip, or
store the file count). Zero new dependencies — the freshness receipt already
computes this hash.

### 2. Progress check = blob moved, or releases landed, or receipts appended

A lock is **progressing** when any of:

- current blob hash of the claimed path differs from the stored claim-time hash
  (work-in-progress detected, even uncommitted), or
- the agent has a release receipt in `_NEXUS_REPORT.md` newer than
  `progressWindow`, or
- the agent's lane file has receipt/note appends newer than `progressWindow`.

Config: `progressWindow` in `.nexus/config.json`, default 900s. Advisory only.

### 3. Status and doctor labels

`nexus status`, per lock:

- `active — progressing` (blob moved or recent releases)
- `active — no progress signal (Ns)` (alive by age, but no observable delta
  within `progressWindow`)
- `stale` (existing age-based label, unchanged)

`nexus doctor`, new informational entries under Locks:

- `Active lock on <path> held <N>s with no progress signal — possible stuck
  loop` with fix guidance (below).
- `Agent @x: <C> claims, 0 releases in last <W>s` — claim/release imbalance.
- `Release verify failed <N> times for <path> — agent is stuck-with-effort`
  (derived from existing standup `[BLOCKED]` lines; distinct from silent
  stuck: the agent is trying, the work is failing).

### 4. Progress-aware staleness (the fix for incident #2)

Today: `stale = age >= staleThreshold`, then auto-break on conflicting claim.
Proposed: `stale = age >= staleThreshold AND no progress signal within
progressWindow`. A lock with moving blob hashes is *working*, not stale, no
matter its age. This single change would have prevented the 2026-06-11 sweep.
(Depends on `stale-break-standup-log` for sweep visibility; complements it.)

### 5. Human playbook for `active — no progress signal`

1. Read the agent's recent standup lines — is it narrating effort?
2. Check the lane file for partial notes (delegated work).
3. If a runaway loop is suspected: `nexus halt "<reason>"` — freezes
   claim/release/next swarm-wide while you inspect.
4. Only then `nexus clean <path>` surgically. Never sweep `--stale` broadly
   while any agent is mid-session (see incident #2).

## Non-goals

- No daemon, no timers, no background watchers — checks run inside existing
  commands (`status`, `doctor`, claim-time staleness evaluation).
- No enforcement: signals label and advise; humans (or a reviewed follow-up
  task) decide consequences.
- No self-reported progress API. If an agent wants to look alive, it must
  actually change the world.

## Open questions for review

1. Should progress-aware staleness (§4) change auto-break behavior, or only
   labels, in the first shipped version? (Recommend labels + auto-break change
   together; the label without the behavior fix repeats incident #2.)
2. `progressWindow` default: 900s assumes medium-cost tasks. Per-agent or
   per-cost overrides?
3. Directory claims: blob movement is per-file; cheapest correct check is
   `git status --porcelain -- <dir>` non-empty vs claim time. Good enough?
4. Coordinates with `agent-resume-packet` (Gate G): the same involuntary
   receipts that prove progress are the ones `whereami` would replay on
   reconnect. Build the shared reader once?
