# Nexus Agent Protocol Drills

Drills are preventive scenario guides for known agent failure modes.

Each drill captures a situation where an agent is likely to make a bad move, then records the expected behavior before the agent acts. Nexus can surface drill summaries near risky commands, queue work, or guardrail changes so agents get the right move in context without loading every drill.

Use drills when an agent is about to do work that resembles a known failure mode, or when changing Nexus instructions, queue behavior, release behavior, or safety guardrails and you need to confirm the same failure mode is still covered.

## Guardrails And Drills

Guardrails are the operating rules agents must follow.
Drills are the preventive scenarios that help agents recognize and avoid known bad moves before acting.

When adding a new guardrail to the constitution or agent guides, add a drill when the failure mode is concrete enough to replay.

## When To Read Drills

Read drills when a task resembles a known failure shape, when Nexus surfaces a related drill, or when you are doing protocol, guardrail, regression, or failure-mode work.
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
