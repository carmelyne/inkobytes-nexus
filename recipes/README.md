# Nexus Recipes

Recipes are local situation handlers. Load one when a matching event happens; do not load every recipe during normal startup.

Use the constitution for always-on rules, recipes for procedural response, and drills for regression scenarios.

## Recipes Vs Skills

Recipes are local situation handlers. Use them when a repo event occurs, such as finding an issue, hitting a failing test, touching persisted data, or becoming blocked.

Skills are broader capability modules. Use them when the task needs a domain workflow, external tool, or specialized technique.

If both apply, use the skill for domain technique and the recipe for decision flow.

## Router

The canonical recipe router lives in `_NEXUS_CONSTITUTION.md`.
This folder only stores the handler files that router points to.
