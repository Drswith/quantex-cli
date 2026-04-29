# Harden Agent Archive Closure

## Summary

Agent-driven OpenSpec archive closure currently relies on each agent session to choose the right archive flags and hand-write a governance-compliant PR body. This change turns those fragile steps into repository scripts so Superpowers can route agents to executable guardrails instead of prose-only instructions.

## Problem

- `openspec archive` applies spec deltas by default, but archive follow-up often happens after accepted deltas were already synced into `openspec/specs/`.
- Agents can create archive PRs with incomplete PR bodies and only discover the issue after GitHub PR Governance fails.
- The central runtime skill describes archive closure, but it does not provide a single command that handles status checks, archive state transition, validation, and PR body generation.

## Goals

- Provide a repo-native archive closure command for completed OpenSpec changes.
- Provide a local PR body policy check that mirrors PR Governance.
- Route agent runtime instructions through executable commands instead of hand-written archive/PR steps.

## Non-Goals

- Reintroduce the removed archive bot.
- Expand Quantex into a workflow orchestration platform.
- Replace OpenSpec as the source of truth for change contracts.
