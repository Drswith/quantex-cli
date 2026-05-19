## Context

Quantex publishes a JS CLI package whose `bin` entrypoints point to `dist/cli.mjs`, but the current source runtime still assumes Bun. The shebang uses `#!/usr/bin/env bun`, several modules call `Bun.spawn`, `Bun.file`, `Bun.write`, and `Bun.TOML.parse`, and the README explicitly warns that package-manager no-install usage still requires Bun on `PATH`.

That coupling is broader than the product needs. Bun is useful for Quantex maintainers because it powers the repository's fast build, validation, and release scripts, but npm-installed users should not inherit Bun as an extra runtime prerequisite just to execute a packaged CLI. The design therefore needs to separate the published CLI runtime boundary from the repo's maintainer toolchain boundary without breaking self-upgrade, agent lifecycle behavior, or release packaging.

## Goals / Non-Goals

**Goals:**

- Make the published CLI runtime in `src/` and `dist/` execute under supported Node.js without accessing Bun globals.
- Preserve the existing Quantex product surface, including managed self-upgrade behavior, structured output, and standalone binary releases.
- Keep Bun available for repository-local scripts, validation, and release automation where it already works well.
- Add validation that proves both package contents and Node-based CLI execution remain intact.

**Non-Goals:**

- Rewriting every maintainer-facing script under `scripts/` to stop using Bun.
- Changing agent install/update semantics or removing Bun as a supported managed install method for third-party agents.
- Reworking the standalone binary build pipeline beyond any packaging or smoke-check adjustments needed for the new runtime contract.

## Decisions

### Restrict the Node-compatibility migration to the published runtime boundary

The Node migration will apply to `src/` and the generated `dist/` outputs that ship to end users. Repository scripts under `scripts/` may stay Bun-based for now.

This yields the user-facing benefit quickly while avoiding a repo-wide runtime migration that would slow delivery and expand risk. It also matches the real boundary that matters: the files shipped in the npm package and invoked by `qtx`, `quantex`, `npx`, and `npm exec`.

Alternative considered:

- Convert the entire repository to Node-only. Rejected for this change because it adds toolchain churn without improving the shipped CLI contract.

### Replace Bun runtime APIs with narrow Node-native helpers

Runtime modules will stop calling Bun globals directly. Process execution will move to a Node `child_process.spawn` wrapper, JSON state/config persistence will use `node:fs/promises`, and stdout/stderr collection will use Node stream consumers.

This keeps the migration localized and makes the runtime contract easy to audit: user-shipped code no longer needs Bun-specific APIs.

Alternative considered:

- Keep Bun types and polyfill a `Bun` shim at runtime. Rejected because it preserves the hidden dependency and makes failures harder to reason about.

### Use a narrow bunfig registry parser instead of adding a general TOML runtime dependency

The only Bun-only parse in the shipped runtime is reading `bunfig.toml` to discover a registry for managed self-upgrade. For this change Quantex will replace `Bun.TOML.parse` with a purpose-built parser that extracts the supported `install.registry` forms Quantex actually needs.

This keeps the published package dependency-free at runtime and avoids increasing tarball size just to read one configuration field.

Alternative considered:

- Add a TOML parser dependency. Rejected for now because the needed surface is small and the extra runtime dependency would mainly pay for unused parsing features.

### Validate both package boundaries and Node execution

Package checks will continue verifying that standalone binaries stay out of the managed-install tarball, and they will also verify that the built CLI runs under Node.

This protects the two failure modes the change cares about most: shipping the wrong files and silently reintroducing Bun-only runtime code later.

Alternative considered:

- Validate only source patterns or only the shebang. Rejected because that would miss runtime regressions introduced through future refactors or build output changes.

## Risks / Trade-offs

- [Node and Bun spawn semantics differ in edge cases] -> Keep the replacement wrapper narrow and run the existing test suite plus package execution smoke checks.
- [The bunfig parser misses a valid but uncommon registry form] -> Support the currently documented forms Quantex already consumes and fall back cleanly when parsing fails.
- [Maintainers assume "Bun removed from runtime" means "Bun removed from repo"] -> Update README wording so runtime expectations and maintainer workflow expectations are clearly separated.
- [A future contributor reintroduces `Bun.*` in shipped runtime code] -> Add validation that executes the built CLI with Node and keep the new runtime contract explicit in OpenSpec.
