# Recipe: Removal Scope

Use when removing a dependency, service, framework, vendor, or integration.

## Do

1. Separate project-owned usage from transitive/package references.
2. Treat third-party internals, lockfiles, generated files, build output, and dependency trees as evidence to report.
3. Preserve unrelated packages even when their internals mention the target.
4. Stop if removal would delete or disable an unported feature.
5. Ask whether to port the feature first or remove it.

## Hard Rules

- Do not remove packages solely because their dependency tree mentions the target.
- Do not delete unported features just because they still depend on the target.
- Do not run broad cleanup from string matches alone.
