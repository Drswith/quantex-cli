## Context

`AgentDefinition` currently drives Quantex lifecycle behavior and a small set of user-facing inspection surfaces. The removed `description` field was not used for install, update, resolve, ensure, or execution logic, but it did appear in `info` and `inspect`, which made localized prose look like part of the stable agent contract.

## Goals / Non-Goals

**Goals:**
- Keep the agent catalog focused on lifecycle metadata and stable identifiers.
- Remove a field that creates avoidable i18n and compatibility pressure without improving lifecycle behavior.
- Clarify that `info` and `inspect` should return operational metadata, not presentation copy.

**Non-Goals:**
- Redesign the full `info` or `inspect` surface.
- Add a replacement localized summary field.
- Change install, update, execution, or supported-agent semantics.

## Decisions

- Remove `description` from `AgentDefinition` instead of making it optional.
  Rationale: the field had no behavioral role, and leaving it optional would keep inviting future callers to depend on it.
- Remove `description` from `info` and `inspect` instead of substituting a new summary field.
  Rationale: Quantex already has `displayName`, `homepage`, package metadata, install methods, and lifecycle state for identification and operation.
- Add a dedicated `agent-catalog` OpenSpec capability.
  Rationale: existing specs focus on update and self-upgrade behavior, while this change defines the boundary of stable catalog metadata.

## Risks / Trade-offs

- [Breaking structured output for existing consumers] → Mitigated by recording the contract change explicitly in proposal and spec artifacts.
- [Future contributors reintroduce presentation metadata] → Mitigated by the new `agent-catalog` spec that defines lifecycle-focused boundaries.
