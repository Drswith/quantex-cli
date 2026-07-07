## Context

OpenClaw is an open-source AI agent runtime distributed as a CLI named `openclaw`. The upstream install documentation (https://docs.openclaw.ai/install) identifies two end-user install paths:

1. A recommended hosted installer script that detects the OS, installs Node if needed, installs OpenClaw, and launches onboarding:
   - macOS/Linux/WSL2: `curl -fsSL https://openclaw.ai/install.sh | bash`
   - Windows (PowerShell): `iwr -useb https://openclaw.ai/install.ps1 | iex`
2. npm/pnpm/bun global installs for users who already manage Node:
   - `npm install -g openclaw@latest`
   - `pnpm add -g openclaw@latest`
   - `bun add -g openclaw@latest`

The same docs document `openclaw update --channel stable|dev` as the self-update entrypoint for switching between package and git installs, and `openclaw --version` as the standard version probe on the root dispatcher. The canonical source repository is `https://github.com/openclaw/openclaw`.

Quantex already represents supported agents as lifecycle-focused catalog metadata in JSON catalog files under `src/agents/catalog/`, with a generated manifest (`src/agents/generated/`) and re-exports from `src/agents/index.ts` and `src/index.ts`. OpenClaw fits the existing catalog shape without adding new package-manager, execution, inspection, or update-planning behavior.

## Goals / Non-Goals

**Goals:**

- Add OpenClaw as a supported Quantex lifecycle agent with verified upstream metadata.
- Expose the official native installers as script install methods, the documented npm and bun managed install methods, version probing, and self-update metadata.
- Keep the implementation limited to the existing agent catalog, generated manifest, README tables, and focused test coverage.

**Non-Goals:**

- Add OpenClaw-specific runtime integration, Gateway configuration, ClawHub, MCP, daemon management, onboarding flows, or session-management behavior.
- Model `pnpm add -g openclaw` as a managed install method; the catalog has no `pnpm` managed install type and pnpm installs the same `openclaw` npm package already covered by the npm method.
- Model from-source (`git clone` + `pnpm build`), Docker, Podman, Nix, Ansible, or Bun-experimental container builds as Quantex install methods; those are contributor/hosting paths, not end-user lifecycle installs.
- Add Homebrew, Cargo, pip, uv, or winget methods that upstream does not document for end users.
- Model `openclaw doctor`, `openclaw gateway status`, `openclaw onboard --install-daemon`, LaunchAgent/systemd service install, or channel switching flags beyond the base `openclaw update` self-update command.

## Decisions

### 1. Use `openclaw` as the canonical slug and executable

The upstream binary, npm package, documented commands, and product branding all use `openclaw`. Quantex should therefore expose `openclaw` as the canonical agent name and executable target. No lookup alias is needed because the repository, package, and binary all share the name, consistent with source-first entries such as OpenCode and OpenHands that have no aliases.

### 2. Use the GitHub repository as the homepage

The docs are hosted at `https://docs.openclaw.ai`, but the GitHub repository at `https://github.com/openclaw/openclaw` is the canonical source of install scripts, issues, and release artifacts. Quantex should record the repository URL as the homepage, consistent with other source-first catalog entries such as Goose, VTCode, and Hermes.

### 3. Record script, npm, and bun install methods

Unlike Hermes (whose upstream documents only native installers), OpenClaw's install docs explicitly document npm, pnpm, and bun global installs alongside the recommended installer script. Quantex should record the documented managed methods it supports — npm and bun — on all platforms, plus the native installer scripts:

- macOS/Linux: `curl -fsSL https://openclaw.ai/install.sh | bash`
- Windows: `iwr -useb https://openclaw.ai/install.ps1 | iex`

The Windows command uses the `iwr -useb ... | iex` form documented upstream. pnpm is omitted because the catalog has no `pnpm` managed install type and it installs the same `openclaw` npm package already represented by the npm method. This follows the precedent of OpenCode and Crush, which record npm and bun managed methods when upstream documents them.

### 4. Record `openclaw` as npm package metadata

The docs document `npm install -g openclaw@latest` and `bun add -g openclaw@latest`, so the npm package name is `openclaw`. Quantex should record `packages.npm = "openclaw"`; the bun managed method installs the same npm package and needs no separate package field, consistent with OpenCode and Crush.

### 5. Probe and update through the root dispatcher

The install docs document `openclaw --version` for install verification and `openclaw update --channel stable|dev` for self-update across package and git installs. Quantex should use `openclaw --version` for version probes (matching the catalog convention used by every other supported agent) and expose `openclaw update` as the self-update command for installations that support OpenClaw's built-in updater.

## Risks / Trade-offs

- [The hosted installer bundles Node and launches onboarding] -> Keep Quantex scoped to recording the documented installer command; Node bundling and onboarding are upstream post-install behavior and not modeled as separate Quantex install methods.
- [npm/bun global installs require the user to manage Node themselves] -> Record both the installer script (recommended, self-contained) and npm/bun (for users who manage Node) so `quantex install openclaw` and `quantex update --all` can use the recorded install source; the recorded `openclaw update` self-update command covers all install methods.
- [`openclaw update --channel <channel>` exists for channel switching] -> Use the base `openclaw update` for catalog consistency with sibling agents; channel selection is an upstream concern and not modeled as a separate self-update command.
- [Containers (Docker, Podman, Nix, Ansible) are documented] -> Do not model container hosting as lifecycle install methods; they target deployment environments, not end-user CLI installs.
