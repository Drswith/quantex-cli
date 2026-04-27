## Context

Quantex models each supported agent through a catalog entry that drives installation, inspection, update planning, and human-readable guidance. Kilo Code CLI now has stable upstream metadata: the npm package is `@kilocode/cli`, the canonical binary is `kilo`, the package also exposes `kilocode`, and the official docs publish `kilo upgrade` as the self-update command.

## Goals / Non-Goals

**Goals:**

- Add a verified Kilo catalog entry that works with the existing lifecycle architecture.
- Preserve Quantex's current catalog conventions for managed installs, lookup aliases, and self-update metadata.
- Ensure user-facing surfaces and tests recognize Kilo consistently.

**Non-Goals:**

- Implement a bespoke Kilo integration path outside the existing agent-definition model.
- Add unsupported install methods that are not yet verified in Quantex's current install abstraction.
- Change the behavior of lifecycle commands beyond making Kilo selectable as a supported agent.

## Decisions

- Model Kilo as a standard npm/bun-managed agent with `packages.npm = @kilocode/cli`.
  - Alternative considered: add binary-release install methods immediately. Rejected because npm and Bun are already verified, while binary install support would require additional platform-specific validation and user guidance.
- Use `kilo` as the canonical agent name and binary, with `kilocode` as a lookup alias.
  - Alternative considered: use `kilocode` as the primary Quantex identifier. Rejected because the upstream docs instruct users to run `kilo`, and Quantex names should match the most common executable contract.
- Record `kilo upgrade` as the self-update command.
  - Alternative considered: rely only on managed package updates. Rejected because the official CLI docs explicitly publish the built-in upgrade path, and Quantex should surface verified upstream self-update metadata when available.

## Risks / Trade-offs

- Upstream may later expand or rename install channels -> Mitigation: start from the documented npm/bun path and keep the agent definition easy to refresh.
- Adding a lookup alias could conflict with future catalog names -> Mitigation: rely on existing duplicate-identifier tests and keep the alias scoped to the published upstream binary name.
