## 1. Runtime Contract

- [x] 1.1 Add a central Quantex agent runtime skill for Superpowers-backed sessions.
- [x] 1.2 Update `AGENTS.md`, OpenSpec docs, and collaboration docs to describe Superpowers as the cross-agent runtime and OpenSpec as the contract source of truth.

## 2. Remove Duplicated Agent Workflow Copies

- [x] 2.1 Replace per-agent OPSX skill/command copies with thin Superpowers runtime bootstrap pointers.
- [x] 2.2 Remove GitHub Copilot OPSX skill copies that duplicate the same workflow bodies.

## 3. Retire Archive Bot Orchestration

- [x] 3.1 Remove the OpenSpec archive GitHub Actions workflow.
- [x] 3.2 Remove the archive helper script that powered the bot.
- [x] 3.3 Update docs/specs so archive closure is agent-driven rather than bot-driven.

## 4. Validation And Delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run openspec:validate`, and `bun run memory:check`.
- [x] 4.2 Run `bun run test` if implementation touches executable code or workflow contract tests.
- [x] 4.3 Report validation, OpenSpec, git, commit, push, PR, release, and archive-closure state.
