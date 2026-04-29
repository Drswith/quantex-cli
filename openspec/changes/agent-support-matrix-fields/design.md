## Context

Quantex already models three related identifiers in practice:

- a canonical catalog key (`name`)
- a user-facing product name (`displayName`)
- an executable command (`binaryName`)

The current repository does not document how those fields should be presented in a reviewable support matrix, or when `name` should follow `binaryName` versus stay brand-specific.

## Goals / Non-Goals

**Goals:**

- Define a stable support-matrix schema for documentation and review.
- Reduce manual interpretation when evaluating whether a new tool should use its executable name as the canonical slug.
- Keep the decision lightweight and documentation-first for this round.

**Non-Goals:**

- No runtime code changes.
- No renaming of existing agent definitions in this change.
- No addition of new supported agents in this change.

## Decisions

- **Canonical slug remains the primary Quantex identifier**: the support matrix will treat the Quantex canonical slug as the key used by lookup, docs, and future catalog work.
- **Binary command is a first-class separate field**: the matrix will always display the upstream executable command separately from the canonical slug.
- **Default naming rule follows the executable**: when an upstream command is stable, product-specific, and suitable for user-facing identification, the canonical slug should match the executable command.
- **Generic executable exception stays branded**: when the executable name is generic, ambiguous, or likely to collide with broader terminology, Quantex should keep a branded canonical slug and expose the executable through the binary-command field and aliases.
- **Documentation page, not README table**: the full matrix belongs in `docs/agent-support-matrix.md`; the README should remain lightweight.

## Risks / Trade-offs

- [Temporary mismatch] Existing entries may not yet satisfy the new default rule. → Mitigation: this change documents the rule first and leaves implementation follow-up to later catalog changes.
- [Documentation drift] A hand-maintained matrix can drift from the catalog. → Mitigation: make the matrix explicitly reference canonical fields from `src/agents/definitions/*.ts` and keep `supported` status tied to implemented definitions.

## Migration Plan

- Add the OpenSpec delta for the naming rule and support-matrix fields.
- Add the docs page and docs index link without changing runtime surfaces.
- Leave any catalog renames or generator work for follow-up implementation changes.
