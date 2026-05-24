# Nexit: Agent-Native Version Control and Hive Growth

## Summary

Nexit is the next layer of thinking around Nexus: agent-native version control shaped around zones, finished work, inspection, publish, recall, and hive growth.

For now, Git stays underneath Nexus as the reliable commit and storage substrate. The current Nexus workflow does not change:

```text
nexus claim -> work -> nexus release -> Git commit -> batch PR when ready
```

Nexit starts by naming and organizing what the swarm already does so Pong does not have to carry the whole project map alone.

## Why Git Stays Underneath For Now

Git is annoying, but it is stable. It already gives the project durable commits, diffs, recovery, and remote publishing. Nexit should not replace that until it can protect work at least as well.

The first Nexit layer should work beside Git:

- Nexus still commits through Git on release.
- Nexit language describes the work in agent-native terms.
- Future Nexit checkpoints can shadow Git commits before becoming independent storage.

The rule is simple: do not remove Git until Nexit has proven it can recover and protect project work.

## What Nexus Already Proved

Nexus already proved that agents can work safely on the same repo when the workflow is bounded:

```text
Queue -> claim -> work -> release -> next Queue
```

Claims prevent collisions. Releases create finished chunks. The Queue keeps agents from free-roaming. Doctor checks repo health. This already works, so Nexit should extend it rather than disrupt it.

## Zones As Warehouse And Factory Work Surfaces

Agents are more like workers in a warehouse or factory than people typing in one shared document.

Many workers can build the same car, fulfill the same order, or tend the same hive. They cannot occupy the exact same work surface at the exact same time.

For Nexit, this becomes the working law:

```text
Agents can work on the same project, feature, or batch.
Agents should not mutate the same exact work surface at the same time.
```

Same-surface concurrent editing is not the goal. Parallelism happens through zones.

Examples:

- Claude works in the MCP zone.
- Codex works in the CLI zone.
- Gemini works in the docs zone.
- Each agent can contribute to the same larger batch without stepping on the same files.

## Inko Tags As Zone Truth

Zones should start as Inko tags, not as a new database or copied task metadata.

The flow is:

```text
docs/plan -> Inko -> Task Plan -> Nexus Queue -> claim/work/release -> Hive
```

Tags live on the Inko. Everything downstream references the Inko.

This means:

- Inko owns tags such as `zone:cli`, `zone:mcp`, `zone:frontend`, or `zone:agent-protocol`.
- Task Plans linked to the Inko read the Inko tags.
- Queue items linked to the Task Plan or Inko read the same tags.
- Hive views read the tags through the source links.

No copied tags. No task-level tag overrides. If the zone is wrong, update the Inko tags.

## Queue As Executable Dispatch

The Nexus Queue is the execution mouth of the planning system.

Plans should not dump directly into the Queue. They should flow through the Inkobytes planning brain:

```text
docs/plan
  -> Inko
    -> Task Plan
      -> Nexus Queue
```

The Queue answers:

- What is ready?
- Who can safely take it?
- Which files or directories need claims?
- What dependencies or blockers exist?
- Is the task safe for auto-flow?

The Queue stays practical and executable. The Inko and Task Plan preserve the why.

## Hive Growth Map

The Nexus Hive should show project growth as an organism, not as static contribution squares.

Squares show activity. The Hive should show life:

- which zones are active
- which zones are quiet
- which zones are blocked
- which agents are tending which areas
- where work is growing
- where dependencies connect zones
- where inspection or recall is needed

Hex zones can grow over time. A zone can sprout sub-areas when repeated work accumulates there, but that growth should come from existing Inko tags and work history, not from hidden automatic taxonomy.

The goal is for Pong to see the living project map without manually remembering every active project, agent, and work surface.

## Checkpoint, Inspection, Publish, Recall

Nexit should use manufacturing language instead of Git language.

- `checkpoint` = finished station work from an agent
- `batch` = collected checkpoints ready for review
- `inspection` = PR equivalent, where a batch is reviewed and tested
- `publish` = move an accepted batch into the stable public state
- `recall` = pull back bad work without pretending history did not happen

`recall` replaces rollback as the preferred concept.

Recall is honest:

- The work happened.
- The record remains.
- The checkpoint or batch is marked recalled.
- A correction is created or applied.

Nexit should not pretend time reverses. It should preserve the history and guide the repair.

## Serious Version-Control Path

Nexit can become real version control only if it earns trust gradually.

Suggested path:

1. **Git-backed Nexus**
   - Current workflow.
   - `nexus release` commits to Git.

2. **Nexit checkpoint shadow**
   - On release, also record Nexit checkpoint metadata beside the Git commit.
   - Store agent, zone tags, source Inko/Task Plan, touched files, and validation notes.

3. **Nexit restore**
   - Prove Nexit can restore files from its own checkpoint data.
   - Git remains the safety net.

4. **Nexit recall**
   - Recall a checkpoint or batch.
   - If later work overlaps, stop and send it to inspection instead of guessing.

5. **Nexit publish**
   - Treat accepted batches as the public/stable state.
   - Git can still mirror this until Nexit storage is mature.

6. **Nexit native sync**
   - Only after local recovery and recall are trustworthy should Nexit explore replacing Git remote behavior.

## Open Questions

- What exact data should a Nexit checkpoint store first?
- Should checkpoint storage live under `.nexit/`, `.nexus/`, or another project-owned folder?
- What is the minimum useful Hive map generated from Inko zone tags?
- How should inspection map to the current PR workflow while Git still stays underneath?
- What makes a recall safe enough to apply automatically?
- How should Nexit represent the public stable state before Git is removed?
