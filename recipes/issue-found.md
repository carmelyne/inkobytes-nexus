# Recipe: Issue Found

Use when you discover a bug, mismatch, suspicious behavior, broken test, inconsistent state, or unexpected output.

## Do

1. Stop unrelated work.
2. Summarize the issue in one sentence.
3. Classify it as bug, regression, missing requirement, unclear behavior, security risk, dependency/config issue, or architecture mismatch.
4. Provide evidence: file path, line/function/component, failing test, log, or output.
5. Identify likely cause.
6. Propose the smallest safe fix.
7. Decide whether to patch now, ask first, or investigate.

## Output

```text
ISSUE FOUND:
- Summary:
- Type:
- Evidence:
- Likely cause:
- Affected files:
- Risk:
- Recommended action:
- Action level:
```

## Hard Rules

- Do not widen scope.
- Do not patch unrelated files.
- Ask before changing public API, data, auth, billing, migrations, or UX behavior.
