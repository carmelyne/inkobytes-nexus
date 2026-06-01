# Nexus Agent Protocol Drills

Protocol drills are scenario playbooks for known agent failure modes.

They are not model benchmarks or leaderboards. A drill captures a situation where an agent may get blocked, confused, or tempted to do the wrong thing, then records the expected recovery path.

Use drills as guidance when a similar situation comes up again: known failure -> expected move -> safer next action. They are also useful after changing Nexus instructions, queue behavior, release behavior, safety guardrails, or `doctor --fix` updates to existing agent files, because you can rerun the same scenarios and check whether expected behavior still holds.

## Guardrails And Drills

Guardrails are the operating rules agents must follow.
Drills are the replayable scenarios that help agents practice and retest those guardrails under realistic pressure.

When adding a new guardrail to the constitution or agent guides, add a drill when the failure mode is concrete enough to replay.

## When To Read Drills

Read drills when you hit a similar failure shape, need a recovery path, or are doing protocol, guardrail, regression, or failure-mode work.
Normal app/code work should not load drills by default.

Use drills when changing Nexus protocol files, generated agent guides, guardrails, existing-file repair behavior in `doctor --fix`, or core commands such as `drill`, `doctor`, `init`, `claim`, `release`, or `next`.
Also use them when debugging an agent failure mode or when the user asks to add/test a guardrail.

## How To Run Manually

1. Create or reset a disposable Git repo fixture.
2. Give the prompt to the agent.
3. Compare the transcript, commands, file changes, and final answer against the drill.
4. Mark pass only when all required behaviors are met and no fail condition occurs.

## Cases

Cases live in `cases/*.yaml`.

- `cases/wrong-repo-push.yaml`
- `cases/remove-agent-folders-from-git.yaml`
- `cases/claim-before-edit.yaml`
- `cases/start-does-not-replace-claim-release.yaml`
- `cases/queue-is-thin-index.yaml`
- `cases/private-path-protection.yaml`
- `cases/done-claim-adversarial.yaml`
- `cases/current-file-state.yaml`
- `cases/ghost-file-claim-loop.yaml`
- `cases/task-contract.yaml`
- `cases/removal-scope.yaml`
- `cases/data-boundary-table-header.yaml`
- `cases/data-mutation-delete-rows.yaml`
- `cases/vendor-cleanup-preserve-history.yaml`
- `cases/stale-lock-after-commit.yaml`

## Case Shape

```yaml
id:
prompt:
setup:
expected:
fail_if:
```

## Core Principle

Capture is not dispatch. Planning is not execution. A queue item is not a whole plan. A task is not done until evidence survives an adversarial pass.
