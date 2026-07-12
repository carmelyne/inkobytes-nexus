# Nexus Dogfooding Issues

Friction observed by agents using Nexus (`@inkobytes/nexus` v1.3.0) in real project
work. Logged from the Mooncrafting sessions, 2026-07-02, by @claude.

## 1. `--model` warning printed on every claim

**Severity:** low (noise) · **Command:** `nexus claim`

Every claim prints:

```
[WARN] Claim has no model metadata. Add `--model <name>` when available.
```

Three claims in a row = three identical warnings. Agents can't easily know their own
model name in every harness, and repeated unactionable warnings train agents to skim
past warnings entirely — the opposite of what a coordination tool wants.

**Suggested fix:** auto-detect from env when the harness exposes it, read a per-agent
default from config once, or warn once per session instead of once per claim.

## 2. No read-only claim mode

**Severity:** medium (unnecessary contention) · **Command:** `nexus claim`

The protocol requires claiming docs before reading them, but the only claim type is a
full exclusive lock ("clear to modify"). Reading a shared planning doc is as
contentious as editing it: two agents can't even read the same file at the same time.

**Suggested fix:** `nexus claim --read <path>` as a shared, non-exclusive lease.
Multiple readers coexist; a writer claim waits for/reports readers. The freshness
receipt already covers the staleness half of this — only the lock semantics need the
read/write split.

## 3. No batch claim

**Severity:** low (ergonomics) · **Command:** `nexus claim`

A task usually touches a small set of files with one shared intent, but claims must be
issued one command per path (chained with `&&`).

**Suggested fix:** `nexus claim <p1> <p2> <p3> @agent "intent"` — one command, one
intent, N receipts, atomic (all-or-nothing so a partial failure doesn't leave a
half-claimed task).

## 4. Sample queue tasks look executable

**Severity:** medium (safety) · **Files:** `_NEXUS_QUEUE.md`

The scaffolded Hello World tasks ship marked `Status: Ready`, `Review: approved`,
`Approved by: human`, `Auto-flow: yes`. An agent running `nexus next` in good faith
could start building `src/hello.js` inside a three.js game project.

**Suggested fix:** mark scaffold tasks distinctly (e.g. `Status: Sample`), have
`nexus doctor` flag sample tasks once real commits exist, or have `nexus init` ask
whether to include them.

## 5. `release --help` parsed as a file path

**Severity:** low (papercut) · **Command:** `nexus release`

`nexus release --help` fails with `fatal: pathspec '--help' did not match any files` —
the flag falls through to git as a path argument. Any subcommand that takes paths
likely has the same issue.

**Suggested fix:** intercept `-h`/`--help` before argument parsing on all subcommands
and print per-command usage.

---

Second batch backfilled 2026-07-12 by @claude, mined from session memories and
`_NEXUS_STANDUP.md` (2026-07-02 → 2026-07-10). Still against v1.3.0.

## 6. `release` sweeps unrelated uncommitted changes into the commit

**Severity:** high (data integrity) · **Command:** `nexus release`

`nexus release <path>` commits ANY uncommitted working-tree changes in that file, not
just the releasing agent's work. It swept @codex's finish_line export and @claude's
V-key lines into unrelated commits twice (2026-07-06). Agents now defensively check
`git status` before claiming a dirty file, which is tribal knowledge, not tooling.

**Suggested fix:** at claim time, snapshot the blob hash (already in the freshness
receipt); at release time, if the file's pre-claim content differed from HEAD, warn and
require `--include-preexisting` or stage only the claimed agent's delta. At minimum,
print a loud diffstat of what is about to be committed.

## 7. False "HEAD changed" warnings on same-agent sequential releases

**Severity:** low (noise) · **Command:** `nexus release`

Releasing several files in a row as the same agent triggers "HEAD changed" warnings —
each release moves HEAD, and the next release treats that as foreign movement
(2026-07-02). Cry-wolf warnings erode trust in the real ones.

**Suggested fix:** track the agent's own release commits in the session and exclude
them from the HEAD-movement check.

## 8. `next` suggests stale or already-completed tasks

**Severity:** medium (misdirection) · **Command:** `nexus next`

`nexus next @codex` repeatedly suggested tasks that were already done; agents learned
to verify every suggestion against the queue and standup manually (2026-07-04), which
defeats the point of the command.

**Suggested fix:** cross-check candidate tasks against done receipts / lane files
before suggesting; if state is ambiguous, say so instead of suggesting confidently.

## 9. Standup timestamp format rejects one-digit hours

**Severity:** low (papercut) · **Files:** `_NEXUS_STANDUP.md`

The standup entry format requires `YYYY-MM-DD HH:MM AM/PM @agent [STATUS]:` with a
two-digit hour; `7:05 PM` style entries fail validation. Agents keep relearning this.

**Suggested fix:** accept one-digit hours on parse (normalize on write), or have the
error message show a corrected version of the rejected line.

## 10. Locks don't bind the write path — stomps still happen

**Severity:** high (coordination integrity) · **Root of:** issues 6, 12, 13

A terrain.js lane race stomped a finished fix when an agent wrote from cached content
*after* its lock closed (2026-07-04). The claim is advisory: nothing connects holding
the lock to being allowed to write. The workaround was legislating "hold the claim for
the entire edit-to-release window" via standup — social enforcement of what the tool
should guarantee.

**Suggested fix:** make the claim own the write path where hooks allow — e.g. a
pre-write hook that rejects edits to a path whose lock belongs to another agent or to
no one, and rejects writes whose base blob predates the current claim.

## 11. `next --take` returns standby on genuinely ready tasks

**Severity:** medium (misdirection) · **Command:** `nexus next --take`

`nexus next --take` returned standby while a Ready task sat in the queue; @codex had
to bypass the command and release manually (2026-07-06). Together with issue 8, the
queue reader misjudges state in both directions.

**Suggested fix:** when returning standby, print *why* each candidate task was skipped
(blocked-by, claimed, auto-flow, review state) so a false standby is diagnosable.

## 12. Stale claims linger with no expiry or escalation

**Severity:** medium (throughput) · **Command:** `nexus claim` / `nexus status`

A landmarks.js claim sat stale for 2h+ and the only remedy was another agent pinging
the owner in standup (2026-07-07). Nothing expires, escalates, or even surfaces the
staleness to other agents until they go looking.

**Suggested fix:** claims carry a soft TTL; `nexus status` and `nexus doctor` flag
overdue locks prominently; optionally auto-release after TTL when the working tree
shows no progress on the path (the progress-aware staleness work is the right base).

## 13. No cheap way to verify another agent's receipt

**Severity:** medium (trust) · **Command:** none exists

An agent was falsely suspected of a fabricated done-receipt because there was no cheap
way to check whether the claimed work had actually landed (fleet-tint, 2026-07-04 —
the work was real; the re-tint hook just never fired). Trust disputes get settled by
reading diffs manually.

**Suggested fix:** `nexus verify <task-id>` — resolve the receipt's commit(s), show
diffstat + touched paths against the task's stated scope, and flag receipts whose
commits don't exist or don't touch the claimed files.

## 14. Coordination files grow without bound

**Severity:** medium (token cost) · **Files:** `_NEXUS_REPORT.md`, `_NEXUS_QUEUE.md`

`_NEXUS_REPORT.md` is at 10,231 lines and `_NEXUS_QUEUE.md` at 1,317. Every agent
orientation read gets more expensive forever, and the report has also sat with
uncommitted local modifications for days without anything noticing.

**Suggested fix:** rotation/archiving (`nexus report rotate` → monthly archive files),
done-task archival out of the live queue, and a doctor check for oversized or dirty
coordination files.

## 15. Session orientation ritual is heavy

**Severity:** medium (token cost, agent UX) · **Files:** protocol docs

Every session start reads constitution + queue + standup + USER.md + continuity +
memories, mostly unchanged since the agent's last session. That is a large fixed token
tax per session multiplied across every agent, every day.

**Suggested fix:** `nexus brief @agent` — diff-aware orientation that prints only what
changed since the agent's last checkout (new standup entries, queue changes, new
decisions), with pointers into the full files for anything unfamiliar.

## 16. The unclaimed-read boundary is fuzzy

**Severity:** low (cognitive tax) · **Files:** protocol docs

"Claim before reading anything outside the startup/orientation set" forces a
micro-decision on every single file read: is this orientation or not? The rule exists
to serve freshness, but freshness is already solved by blob receipts, not locks.

**Suggested fix:** make reads free (or shared leases per issue 2) and reserve claims
for writes; define the orientation set as an explicit machine-readable list if a read
boundary must exist at all.

---

Third batch, logged live 2026-07-12 by @claude while dogfooding in the nexus repo
itself (v1.3.0 + in-flight fixes).

## 17. Repo-global verify gate blocks unrelated releases

**Severity:** medium (parallel throughput) · **Command:** `nexus release`

The release verify gate runs the repo-wide `verifyCommand` (e.g. `npm test`), but
releases are file-scoped. While one agent legitimately has a red in-flight test in the
working tree, every *other* agent's release is refused — even for files with no
relationship to the failing test. Observed 2026-07-12: @claude's `_NEXUS_QUEUE.md`
receipt release was blocked for the duration of @codex's mid-implementation red
`test/trash.test.js`. The blocked agent's only options are waiting or `--no-verify`
(gated by autonomy), both wrong-shaped for "someone else's WIP is red."

**Suggested fix:** distinguish "verify failed because of the released path" from
"verify failed elsewhere." Options: per-path or per-scope verify commands; running
verify against committed state plus only the released path (worktree or stash-others)
so foreign WIP can't fail it; or at minimum a refusal message naming the failing test
files so the agent can see the failure is foreign and coordinate instead of retrying
blind.

## What worked well

- **Freshness receipts on claim** — the git blob hash instantly tells an agent whether
  its cached read is still current. Genuinely great; this is the feature the read-only
  claim (issue 2) should lean on.
- **Release = unlock + commit + log** as one atomic step keeps checkpoints honest.
- **`nexus status` surfacing unowned generated artifacts** caught real Godot-era
  leftovers (`assets/generated/`, `docs/mooncrafting.jpeg`) that needed an owner
  decision.
