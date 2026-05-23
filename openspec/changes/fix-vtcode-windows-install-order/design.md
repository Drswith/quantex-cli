## Context

VTCode's catalog entry includes both Cargo and upstream script install methods. On Windows, the script currently runs first, but the latest upstream release assets still do not include the Windows zip filename that `install.ps1` constructs. That makes the first install attempt fail noisily before Quantex falls through to Cargo.

## Goals / Non-Goals

**Goals:**

- Make `qtx install vtcode` try the managed Cargo path first on Windows.
- Preserve the upstream PowerShell script as a fallback and as inspect/resolve guidance.
- Keep macOS and Linux method ordering unchanged because their native release archives exist.

**Non-Goals:**

- Do not add release-asset probing or dynamic catalog rewriting.
- Do not remove the upstream Windows script permanently.
- Do not change Cargo installer behavior or fallback execution semantics.

## Decisions

- Reorder only `src/agents/catalog/vtcode.json` for Windows. This keeps the fix local to the catalog metadata that already drives `install`, `ensure`, `inspect`, `resolve`, and structured output.
- Assert the Windows method order in `test/agents.test.ts`. The issue was caused by catalog ordering, so a catalog-level regression test is enough without mocking a full Windows install session.
- Document the order as a VTCode-specific `agent-catalog` requirement delta. This keeps the durable contract tied to the upstream packaging constraint without introducing a general installer priority rule.

## Risks / Trade-offs

- [Upstream later publishes Windows assets] -> Quantex can revisit the order with a new catalog/spec change once the native installer is verified on Windows.
- [Cargo builds remain slow] -> The first attempted method becomes more reliable but may still take time; clearer fallback/cancellation behavior is handled separately by the active managed-installer cancellation change.
