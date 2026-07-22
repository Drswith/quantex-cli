# ADR 0007: Extract a Minimal Core SDK With Staged Compatibility

- Status: Accepted
- Date: 2026-07-22

## Context

ADR 0006 established the correct safety model for Quantex lifecycle work: observe live state, plan or decide, execute, verify the postcondition, and persist verified evidence behind a compatibility shell. The delivered implementation retained the v1 product contracts and fixed important provider, state, cancellation, and recovery behavior.

The resulting source now has overlapping catalog projections, a legacy package-manager facade, typed provider adapters, a generic lifecycle plan model, command-owned application flow, and a broad 117-export root compatibility surface. That is too much internal and public surface for a tool whose main job is managing coding-agent CLI lifecycles. At the same time, downstream TypeScript applications have no intentionally small SDK package.

State schema version 2 rejects unknown future versions and current normalizers discard unknown installed-agent and receipt fields. Therefore an apparently additive state migration during 1.x would make temporary downgrade unsafe.

## Decision

Quantex will keep the root `quantex-cli` package and add exactly one separately consumable Core SDK package, provisionally `@quantex/core`, in the same repository and release train.

- Core exposes one instance factory, `createQuantex`, and only lifecycle methods that have completed their compatibility and safety gates.
- The first stable SDK surface is read-only: `list` and `inspect`. Install, ensure, update, uninstall, and run are added as verified vertical slices in later compatible minors.
- Core is non-interactive and re-entrant. It does not import CLI commands, presenters, mutable CLI context, self-upgrade, release artifacts, or raw state/provider infrastructure into its public API.
- The root package keeps the maintained v1 package, binary, command, JSON/NDJSON, exit, standard-I/O, state/config, and root-export contracts.
- During 1.x, CLI source consumes the Core boundary while npm and standalone binary artifacts inline it. Existing CLI installation and self-upgrade do not acquire a runtime dependency on a second registry package.
- Core retains typed provider observation and the sequence observe, decide, execute, verify, record, and scoped compensate. It may remove unused generic DAG concepts and duplicate boolean/package-manager facades only after equivalent contracts cover the replacement.
- State remains schema version 2 for the entire 1.x transition. New policy is derived from existing records plus live evidence rather than new persisted fields or an authoritative sidecar.
- A lifecycle invocation selects legacy or Core before work begins. It never shadow-runs mutations and never falls back to the other engine after a side effect starts.
- CLI request-key replay remains a compatibility decorator; Core ensure remains semantically idempotent through observation and verification.
- Core and CLI publish on one version train and one repository tag. Core is published and verified first, followed by CLI and binary artifacts, with idempotent recovery for partial publication. Releases from before the Core manifest existed remain CLI-only.
- Because npm requires a package to exist before trusted publishing can be configured, the first Core package is bootstrapped once by an authorized maintainer with 2FA; automated publication remains fail-closed until the package exists and `release.yml` trust is confirmed.

The compatibility runway is at least four stable minor stages:

- 1.2 publishes the read-only SDK while CLI mutations remain legacy-default.
- 1.3 permits mutation families only on beta or explicit whole-invocation opt-in after differential and provider conformance gates.
- 1.4 may make Core stable-default after cross-platform, state, package, sandbox, cancellation, and fault gates; legacy remains a pre-invocation escape route.
- 1.5 keeps Core default for a second stable minor and freezes the legacy engine while documenting deprecations and practicing rollback.

Breaking removal requires a separate major-version deprecation decision after both two Core-default stable minors and at least 90 days from stable-default enablement. The later gate controls.

The active `simplify-lifecycle-core-sdk` OpenSpec change is the detailed source of truth and remains open across milestone releases.

## Consequences

- TypeScript consumers receive a small package instead of inheriting the CLI compatibility surface.
- The transition temporarily adds a package and compatibility adapters before it deletes legacy layers; every migrated path needs a named deletion checkpoint.
- Provider-specific observation, Windows behavior, atomic state, exact ownership, cancellation cleanup, postcondition verification, and scoped compensation remain required even when their implementation looks more complex than command generation.
- State evolution that cannot round-trip through the preceding supported 1.x release is deferred to a separate major-version design.
- Release automation must validate two package manifests, publish Core before CLI, and recover either missing artifact without coordinating the external `quantex` alias repository.
- The provisional npm namespace must be owned, the first package must be bootstrapped by an authorized 2FA maintainer, and trusted publishing must then be configured before automated Core releases are enabled.

## Alternatives Considered

### Re-export the current `quantex-cli` root as an SDK

Rejected because it would expose command handlers, mutable CLI context, raw state mutators, package-manager helpers, self-upgrade, and release utilities as the new public architecture.

### Move the root CLI into a full monorepo package layout

Rejected because it would disturb npm publication, standalone binaries, self-upgrade, release-please, and root declaration fixtures without improving the SDK boundary.

### Split Core into domain, provider, catalog, and runtime packages

Rejected because separately versioning internal seams would add more release and compatibility overhead than the product requires.

### Replace provider drivers with declarative command recipes

Rejected because reliable `present`, `absent`, and `unknown` observation, not argv generation, is the ownership and recovery boundary. Previous placeholder probes caused successful operations to be rolled back and ghost state to remain unsafe.

### Publish all lifecycle methods as unsupported placeholders

Rejected because an empty method still freezes a public contract. Compatible minor releases can add each method after its behavior is proven.
