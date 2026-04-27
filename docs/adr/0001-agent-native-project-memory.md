# ADR 0001: Adopt a Repo-Native Project Memory System

- Status: Superseded
- Date: 2026-04-23
- Superseded by: OpenSpec-led workflow simplification on 2026-04-27

## Context

Quantex is being discussed and implemented primarily through human plus agent collaboration. The repository accumulated useful markdown documents, but they were created as one-off artifacts in the root directory and mixed together several different concerns:

- ongoing discussion summaries
- product and architecture decisions
- implementation backlogs
- troubleshooting knowledge

This makes it harder for future agents to identify the canonical artifact, and it blocks the project from evolving toward safe autonomous iteration.

## Decision

Quantex adopts a repo-native project memory system with explicit layers:

- `openspec/` for behavior contracts and proposed changes
- `docs/adr/` for durable architecture and scope decisions
- `docs/runbooks/` for operational knowledge and recovery procedures
- `docs/postmortems/` for incident and failure analysis
- `docs/sessions/` for concise discussion summaries
- GitHub issues for agent-executable work
- `openspec/changes/archive/` for migrated historical task contracts

Legacy root markdown files remain as transitional references, but new knowledge should be written into the new structure first.

## Consequences

- Future agents have a clearer source of truth.
- Discussion output is promoted into durable artifacts instead of staying as loose notes.
- The project gains a change contract that is suitable for autonomous iteration.
- Root-level markdown sprawl should stop growing.
- There is short-term duplication risk while legacy files are being migrated.

## Alternatives Considered

- Keep using ad hoc root markdown files.
- Use only memory/session tooling outside the repository.
- Use a single documentation bucket without separating specs, decisions, and tasks.

## Follow-up

- Preserve migrated backlog task history under `openspec/changes/archive/`.
- Establish current OpenSpec source-of-truth specs for major product areas.
- Promote durable guidance from legacy scope documents into additional ADRs.
- Migrate troubleshooting guidance into `docs/runbooks/`.
