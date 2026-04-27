# Session: 2026-04-23 Project Memory Bootstrap

> Superseded note: The `autonomy/` task queue created in this session was migrated into `openspec/changes/archive/` on 2026-04-27.

## Context

The project had accumulated several useful markdown documents from human plus agent discussions, but they were scattered across the repository root and mixed together design notes, backlogs, and troubleshooting knowledge. The goal of the session was to choose a better structure that supports future agent-led iteration.

## Decisions

- The repository will use a repo-native project memory system instead of relying on a single external memory tool.
- OpenSpec-compatible artifacts will be used for behavior contracts and non-trivial change proposals.
- ADRs will capture durable design and scope decisions.
- Runbooks and postmortems will hold reusable operational knowledge and failure analysis.
- Session summaries will store discussion outcomes rather than full transcripts.
- Agent-executable work initially moved toward explicit task contracts in `autonomy/tasks/` backed by `autonomy/queue.md`; this was later superseded by the OpenSpec-led workflow.

## Open Questions

- Which existing legacy design document should be converted into the first full OpenSpec source-of-truth spec?
- When the troubleshooting reference is migrated, should the skill reference become a thin pointer or a synced copy?

## Follow-up

- Added the initial project memory structure under `docs/`, `autonomy/`, and `openspec/`.
- Recorded the policy decision in `docs/adr/0001-agent-native-project-memory.md`.
- Seeded the autonomy queue with the first three migration tasks; the completed task history now lives in OpenSpec archive history.
