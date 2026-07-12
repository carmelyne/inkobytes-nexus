# Claim Semantics Rework: Free Reads, Read Leases, Batch Claim

Design doc for `claim-semantics-design` (dogfooding issues 2, 3, 16). Design only —
no code or protocol-text changes ship with this doc. Implementation is a separate
task gated on human approval of this design.

## The question

Should reads take locks at all?

The current protocol says "claim before reading anything outside the
startup/orientation set." That rule exists to guarantee *freshness* — an agent must
not act on stale cached content. But freshness is already solved by a different,
cheaper mechanism: the claim-time freshness receipt (git blob hash) proves content
identity without any locking. Meanwhile the lock itself buys *exclusivity*, which
reads don't need: two agents reading the same planning doc cannot corrupt anything.

The read-claim rule therefore charges an exclusivity price for a freshness product.
The observed costs (issues 2 and 16):

- Two agents cannot read the same shared doc concurrently — artificial contention.
- Every file read requires a micro-decision: "is this orientation or not?" — a
  cognitive tax with no payoff, and the boundary keeps needing clarification
  (the 2026-06-11 @codex hotfix relaxing agent-local reads is this rule leaking).

## Recommendation

**R1. Make reads free. Reserve claims for writes.**

- Reading any file never requires a lock.
- The freshness obligation moves to where it belongs: *before acting on file
  content* (editing, judging state, reporting), verify freshness — either read from
  disk fresh, or compare a blob hash via the existing receipt machinery. A new
  `nexus fresh <path>` (receipt without lock) makes this a one-command habit and
  gives read-only workflows the same blob proof writers get at claim time.
- Claims keep their exact current meaning for writes: atomic lock boundary,
  freshness receipt, `dirty-at-claim` sweep guard, release = unlock + commit + log.

This dissolves issue 16 entirely (no read boundary means no boundary decision) and
resolves issue 2's contention without new lock machinery. It also matches how the
fleet already behaves in practice: hooks and agents have repeatedly special-cased
"read-only inspection should not take a lock."

**R2. Do not build shared read leases (`claim --read`) now.**

A reader/writer lease system (N readers coexist, writer waits or is reported) is
the classic answer, but here it buys little and costs real complexity:

- The failure read leases prevent — "writer commits while someone is mid-read" —
  is already detected cheaply: the reader's next freshness check shows a moved
  blob, and the reader re-reads. Detection-and-retry is enough for doc reads;
  nothing irreversible happens between read and re-read.
- Lease bookkeeping multiplies lock states (reader count, lease expiry, writer
  queueing) across `status`, `doctor`, `clean --stale`, progress-aware staleness,
  and the dashboard — every consumer of lock semantics grows cases.
- The one scenario with a real coordination need — "I am building an analysis on
  this file; please don't move it for an hour" — is rare and is served today by a
  normal (exclusive) claim with an honest intent string, at the cost of blocking
  other readers for that window. Acceptable for how rare it is.

If post-rework dogfooding shows writers repeatedly yanking files out from under
active readers, revisit leases then, with data. The receipt machinery R1 adds is
the foundation a lease system would sit on anyway; nothing is foreclosed.

**R3. Ship batch claim (issue 3) as part of the same release.**

`nexus claim <p1> <p2> ... @agent "intent"` — one command, one shared intent, N
receipts. Semantics:

- **Atomic all-or-nothing.** Acquire in a canonical order (sorted paths, to make
  concurrent batch claims deadlock-free); on any failure, release everything
  acquired so far and report which path blocked and who holds it. No half-claimed
  task states.
- One freshness receipt (and one `dirty-at-claim` snapshot) per path, printed in
  claim order.
- Release stays per-path and unchanged: work reaches checkpoints file by file, and
  per-path release is what keeps claims short-lived. A batch *claim* with
  incremental *release* is the shape real tasks already have.
- Parsing note: everything before the first `@handle` argument is a path. The
  existing single-path form is the N=1 case; no flag needed.

## Protocol-text changes (exact diffs, for review)

`_NEXUS_CONSTITUTION.md` §7 Execution Loop, step 2 — replace:

> Claim before reading or editing shared project files

with:

> Read freely; claim before editing shared project files. Before acting on file
> content, verify freshness — `nexus fresh <path>` or a fresh read. Claim all paths
> a task will edit in one batch claim when they share an intent.

§9 Current File State — replace the claim-before-read sentences:

> - If you read a shared file before claiming it, treat that read as stale after
>   claim succeeds.

stays, and add:

> - Reads never require a claim. Freshness, not locking, is the read obligation:
>   a blob hash that matches your last read proves currency; anything else means
>   re-read.

`.claude/CLAUDE.md` / generated agent guides — delete the orientation-set
carve-out paragraphs ("Unclaimed orientation reads are limited to…", "Claim before
reading implementation files…"); they exist only to soften the rule this design
removes. The Start Here list remains as a reading *recommendation*, not a lock
boundary.

Hook updates: any PreToolUse hooks that block unclaimed *reads* are retired; hooks
that guard unclaimed *writes* (write-path-lock-binding) are unaffected and become
the real enforcement surface.

## Migration

1. Ship `nexus fresh <path>` and batch claim first — both are additive and useful
   under the old rule.
2. Update generated protocol text (constitution, agent guides, bundled skill) in
   one release; `nexus doctor --fix` already knows how to update managed protocol
   blocks after human approval, so existing repos migrate through the normal
   doctor flow.
3. Existing locks, receipts, lanes, and queues are untouched — no state migration.
   The change is entirely in what the protocol *requires*, which only gets looser;
   old agents that keep claiming before reads violate nothing.

## Tradeoffs accepted

- A writer can commit while another agent is mid-read; the reader finds out at
  their next freshness check rather than being serialized behind a lease. Accepted:
  reads are re-runnable, and detection is one blob compare.
- Intent visibility shrinks: today a read-claim tells other agents "someone is
  looking at this." Accepted: standup exists for announcing investigations, and
  lock-as-presence was always a side effect, not a contract.
- Batch claim's all-or-nothing can livelock two agents wanting overlapping sets.
  Sorted acquisition order plus fail-fast-with-owner-report keeps this diagnosable;
  retry is the caller's choice.

## Out of scope

- Reader/writer leases (revisit only with post-rework contention data).
- Write-path enforcement (separate task: write-path-lock-binding).
- Any change to release semantics, the verify gate, or the sweep guard.
