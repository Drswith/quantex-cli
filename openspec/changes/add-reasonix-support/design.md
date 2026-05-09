## Context

Reasonix is the current upstream product name, but the public GitHub repository is still `esengine/DeepSeek-Reasonix`, and the package metadata points at `esengine/reasonix`, which redirects to that repository. Upstream documentation currently verifies four lifecycle facts that matter to Quantex:

- the npm package name is `reasonix`
- the executable name is `reasonix`
- the CLI supports `--version` through Commander
- the documented self-update entrypoint is `reasonix update`

Quantex already represents agent support as lifecycle-focused catalog metadata without provider-specific code paths. Reasonix should fit that model without adding new installer types or execution semantics.

## Goals / Non-Goals

**Goals:**

- Add Reasonix as a supported Quantex lifecycle agent with verified upstream metadata.
- Keep the catalog minimal and aligned to documented upstream install and update behavior.
- Preserve discoverability for users who know the project by its repository name as well as its current product name.

**Non-Goals:**

- Add Reasonix-specific runtime integrations, prompts, or config handling.
- Model `npx reasonix code` as a special install strategy distinct from Quantex's managed-install surface.
- Add Bun, Homebrew, or script installers that upstream does not currently document as a supported packaged path.

## Decisions

### 1. Use `reasonix` as the canonical slug, binary, and npm package identifier

Upstream package metadata, the documented CLI commands, and the visible product branding all use `reasonix`. Quantex should therefore expose `reasonix` as the canonical agent name and executable target instead of carrying forward the older repository name as the primary identifier.

### 2. Accept `deepseek-reasonix` as a lookup alias

The GitHub repository and website path still use `DeepSeek-Reasonix`, and the user requested support via that repository URL. Quantex should accept `deepseek-reasonix` as a lookup alias so users can resolve the agent by either the current product name or the repository-derived name without changing the canonical slug.

### 3. Expose npm managed install on all platforms

Upstream documents `npx reasonix code` as the recommended first-run path and `reasonix update` as the path that installs the global binary for daily use. Quantex's install surface is about durable installed CLIs on `PATH`, so the closest verified lifecycle mapping is the npm-managed global install method on Windows, macOS, and Linux.

### 4. Probe and update via the root `reasonix` dispatcher

The CLI source wires Commander `.version(VERSION)` on the root program and defines an `update` subcommand on the same dispatcher. Quantex should therefore use `reasonix --version` for version probes and `reasonix update` for self-update planning.

## Risks / Trade-offs

- [Upstream still prefers `npx` for first-time use] -> Keep Quantex scoped to durable installed CLI management and document only the managed install path in the catalog.
- [Repository naming may change again] -> Use `reasonix` as canonical and keep the repository-derived alias limited to lookup convenience.
- [Reasonix may add more install channels later] -> Start with the verified npm path and extend in a future OpenSpec change if upstream documents new supported installers.
