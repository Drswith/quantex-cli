# ADR 0010: Separate Bun toolchain from product runtime

- Status: Accepted
- Date: 2026-08-11

## Context

Quantex uses Bun for several valid but distinct purposes: dependency installation and repository tasks, standalone executable compilation, an external agent package provider, and a persisted self-install source. The published JavaScript CLI is nevertheless a Node 20 application, while standalone binaries embed their own runtime.

Application child-process code previously detected `globalThis.Bun.spawn` and selected it when available. Vitest compensated by installing a fake process-wide Bun object, so provider tests depended on the contributor toolchain rather than the distribution contract. The same `bun` label therefore described repository policy, product evidence, and an in-process implementation choice.

## Decision

- Bun remains the pinned repository package manager and task runner.
- Bun remains the compiler for standalone release executables where its compile capability is required.
- Bun remains a first-party external agent provider and self-install source. Provider operations invoke the `bun` executable through the common process boundary.
- Application source under `src/**` does not depend on the process-wide Bun global. Generic child creation uses the existing Node-compatible `cross-spawn` dependency for both the Node package and standalone binaries.
- Repository scripts may use Bun-native APIs. Such use does not establish a product runtime dependency.
- Vitest does not install a fake Bun global. Tests replace cross-spawn or inject runtime ports; explicit Bun fixture programs remain valid when Bun behavior is the subject of the test.

## Consequences

- The JavaScript package, Core SDK, and standalone executable share one application process model.
- Provider identity and self-install evidence remain stable without being confused with the repository package manager.
- Process tests become explicit and no longer mutate global runtime state.
- Read-only smoke preloads must guard both Bun-native repository-script spawning and Node-compatible application spawning.
- `cross-spawn` becomes the single ordinary application launcher, so its cross-platform behavior remains part of the build and test matrix.

## Alternatives Considered

- Keep an opportunistic Bun spawn fast path behind a dedicated runtime adapter. This retained two implementations without a demonstrated product requirement.
- Inject a child-process implementation through every package-manager function. This expanded dependency plumbing even though the shared `spawnCommand` boundary already exists.
- Replace the repository toolchain or remove the Bun provider. Neither addresses the coupling problem, and both remove useful supported capabilities.

## Follow-up

- Maintain the `runtime-boundaries` OpenSpec capability.
- Keep an architecture test that rejects in-process Bun global references under `src/**`.
- Re-evaluate generic Bun APIs in repository-only scripts separately when a concrete portability or testability problem justifies it.
