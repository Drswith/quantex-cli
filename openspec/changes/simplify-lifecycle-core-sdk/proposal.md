## Why

Quantex currently provides a stable lifecycle CLI, but its implementation and package root expose overlapping catalog, package-manager, provider, reconciliation, idempotency, compatibility, and presentation layers. The resulting maintenance surface is disproportionate to the product mission and makes safe changes harder, while downstream TypeScript consumers still lack one intentionally designed SDK entry point.

This change is classified through the OpenSpec intake gate because it changes architecture boundaries, adds a public package/API, affects distribution and release behavior, and establishes a durable multi-version compatibility process. The simplification must retain the historical lifecycle safety guarantees already learned in production and must not remove a maintained v1 contract without an explicit, observable transition.

## What Changes

- Introduce one public TypeScript Core SDK package, provisionally named `@quantex/core`, in the same repository and release train as `quantex-cli`.
- Make the Core SDK the single application-facing lifecycle boundary for catalog discovery, inspection, install/ensure, update, uninstall, and agent execution; keep CLI parsing, prompts, human/structured presentation, exit mapping, and self-upgrade outside the SDK.
- Make `quantex-cli` consume the Core SDK through a thin compatibility adapter while preserving the maintained v1 command, JSON/NDJSON, state/config, standard-I/O, binary, and root-export contracts.
- Replace duplicate internal catalog/provider/package-manager projections only after equivalent Core behavior is covered by compatibility, differential, provider-conformance, state, cancellation, timeout, and platform tests.
- Preserve fail-closed source ownership, tri-state provider observations, verified postconditions, safe compensation, receipt/idempotency semantics, atomic state handling, and Windows process/self-upgrade behavior throughout migration.
- Establish a minimum four-minor compatibility runway and a time-based soak requirement before any later major release may remove deprecated v1 surfaces. Intermediate releases add or reroute behavior but do not remove maintained contracts.
- Keep one long-lived umbrella change across milestone PRs and releases; an intermediate SDK or integration merge is not archive eligibility.
- Keep remote catalogs, dynamic provider plugins, workflow orchestration, daemon mode, an MCP server, and browser-runtime support outside the mainline design.

## Capabilities

### New Capabilities

- `core-sdk`: Defines the supported TypeScript SDK package, public lifecycle client, non-interactive runtime behavior, dependency direction, and consumer contract.

### Modified Capabilities

- `compatibility-contract`: Adds the staged compatibility runway, historical safety invariants, differential migration gates, and major-version removal conditions.
- `package-distribution`: Adds a separately consumable Core SDK artifact while preserving the current CLI tarball and binary contract.
- `release-workflow`: Extends protected-branch publication and recovery semantics to the Core SDK without weakening primary CLI or GitHub Release closure.
- `product-readme`: Adds a first-class SDK consumption path while keeping CLI onboarding primary and compatibility status explicit.

## Impact

- Code: lifecycle services, production composition roots, catalog/provider/package-manager adapters, compatibility facade, CLI commands, state/runtime integration, and tests.
- Packages: repository workspace metadata, a new Core SDK package, `quantex-cli` dependency/exports, declarations, package checks, and lockfile.
- Release: release-please configuration, npm publication/recovery, provenance, and validation for two coordinated packages.
- Contracts: no immediate breaking CLI or package-root removal; new SDK API is additive. Any later removal remains a separately gated major-version action after the compatibility runway.
- Documentation: README/SDK examples, compatibility status, and a durable ADR for the two-package boundary and migration rules.
