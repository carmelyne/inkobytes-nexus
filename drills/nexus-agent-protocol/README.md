# Nexus Agent Protocol Drills

Protocol drills replay known failure modes and check expected agent behavior.

Drills are scenario-based behavior checks for known agent failure modes.
They are not model benchmarks or leaderboards. They test whether an agent follows the shared-repo protocol under realistic pressure.

Use them when changing Nexus instructions, queue behavior, release behavior, or safety guardrails: known failure -> drill -> retest.

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
- `cases/fresh-file-truth.yaml`
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
