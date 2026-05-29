# Recipe: Data Mutation

Use when touching persisted data, fixtures, uploads, app caches, migrations, or ambiguous terms such as table, row, header, column, clean up, reset, remove, old, stale, or unused.

## Do

1. Treat persisted data as state, not ordinary code.
2. State the target environment and data store.
3. State affected tables, files, records, rows, or columns.
4. State the exact command, migration, script, or code path.
5. State expected effect and rollback plan.
6. Wait for explicit operation-level approval before mutation.

## Hard Rules

- Do not write, delete, reset, reseed, migrate, or alter data without operation-level approval.
- Clarify presentation-layer wording before touching schema or records.
- Never rewrite historical records just to make current code cleaner.
