---
"@youzi9601/typed-event-bus": minor
---

refactor: redesign release pipeline with proper CI gate and idempotent state machine

- CI: consolidated test + coverage, Node 22.14, concurrency
- Version Guard: fixed $GITHUB_OUTPUT, precise tag checks, npm view fail-closed
- Release: workflow_run with exact CI commit checkout, dry-run without side effects, idempotent tag/GH Release/npm state machine, npm provenance