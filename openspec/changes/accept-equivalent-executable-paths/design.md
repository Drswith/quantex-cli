## Context

Production executable inspection resolves the `PATH` entry with `realpath`, while lifecycle receipts created by earlier Quantex versions can contain the original package-manager shim path. Lifecycle observation currently compares receipt, provider, and live executable paths as raw strings, so a Bun shim and its canonical target are treated as conflicting evidence even when state and provider ownership agree.

## Goals / Non-Goals

**Goals:**

- Compare executable paths by canonical filesystem identity before declaring source drift.
- Keep genuinely different executable paths fail-closed.
- Remain compatible with existing receipt schema and previously persisted receipts.

**Non-Goals:**

- Rewriting receipt or installed-state files during read-only observation.
- Weakening provider, target, version, or executable-name conflict checks.
- Adding platform-specific symlink heuristics to update planning.

## Decisions

### Resolve paths through the observation port

The lifecycle observation boundary will receive an executable-path resolver from the production observation service. Path comparisons first accept exact string equality and otherwise compare the resolved forms. Keeping filesystem resolution behind the existing service port preserves unit-test determinism and avoids introducing Node filesystem access directly into lifecycle planning.

Alternative considered: remove receipt path comparison. Rejected because receipt paths remain useful evidence for detecting a different executable taking over the same command name.

### Resolve only for comparison

Persisted receipts remain unchanged. The resolver supplies normalized identities only while evaluating evidence, so the patch requires no state migration and read-only commands remain read-only.

Alternative considered: rewrite old receipts when observed. Rejected because observation must not mutate durable state and a partial migration would add failure modes unrelated to the requested command.

### Preserve fail-closed fallback

If resolution cannot canonicalize a path, the resolver returns the original path. Distinct unresolved strings remain conflicting evidence. Provider target, version, and executable identity comparisons are unchanged.

## Risks / Trade-offs

- [Risk] Canonicalization adds filesystem work to tracked lifecycle observations. → Resolve only the small number of paths already present in live/provider/receipt evidence and short-circuit exact matches.
- [Risk] Broken links cannot prove equivalence. → Keep the existing fail-closed conflict result when canonical identities cannot be established.

## Migration Plan

Ship as a patch release. Existing receipts need no rewrite; the next observation accepts equivalent shim and target paths immediately. Rollback restores strict string comparison without changing persisted data.

## Open Questions

None.
