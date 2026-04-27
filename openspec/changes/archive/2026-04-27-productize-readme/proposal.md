## Why

The root README currently reads more like a mixed project-memory index than a product README. New users should be able to quickly understand what Quantex does, install it, run common commands, and find deeper maintainer/process docs only when needed.

## What Changes

- Reframe `README.md` around the product: value proposition, installation, quick start, command overview, supported agents, automation-friendly usage, release links, and contribution pointers.
- Add a complete English README companion and language switch links at the top of both README files.
- Add product-facing badges, including GitHub star count, CI status, release status, npm version/downloads, bundle size, and license.
- Move project memory, OpenSpec, skill, and internal workflow material out of the primary reading path and into short “for maintainers / agents” links.
- Keep product claims aligned with the current CLI command surface and supported agent catalog.
- Do not change runtime behavior, package metadata, dependencies, or release automation.

## Capabilities

### New Capabilities

- `product-readme`: Defines the contract for the repository root README as the canonical product landing page.

### Modified Capabilities

- None.

## Impact

- Affected files: `README.md`, `README.en.md`, `scripts/check-project-memory.ts`, `openspec/changes/productize-readme/*`.
- No CLI API, package artifact, dependency, or release-flow impact.
