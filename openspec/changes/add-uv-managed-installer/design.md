## Context

Quantex already has a managed installer abstraction for agent lifecycle package managers such as Bun, npm, Homebrew, Cargo, pip, and winget. uv tool installs currently sit outside that abstraction even though several supported Python-based agent CLIs document `uv tool install` as a first-class installation path.

OpenHands CLI, Mistral Vibe, and Kimi CLI all have current upstream documentation for uv tool installation. uv itself exposes stable `uv tool install`, `uv tool upgrade`, `uv tool uninstall`, and `uv tool list` surfaces. This makes uv a good fit for the existing managed installer interface without adding a Python environment manager to Quantex.

## Goals / Non-Goals

**Goals:**

- Model uv tool installs as managed agent lifecycle methods.
- Preserve package-specific uv options such as `--python 3.12`, `--python 3.13`, and `--no-cache` in install/update guidance and recorded state.
- Include uv availability in capabilities, doctor, and doctor schema output.
- Migrate verified uv agent definitions from unmanaged binary hints to managed uv methods.

**Non-Goals:**

- Do not manage Python virtual environments, Python installation policy, pyenv/asdf, or arbitrary `uv run` workflows.
- Do not add Quantex self-upgrade through uv.
- Do not make uv a selectable `defaultPackageManager`; uv is only used when an agent definition or recorded state explicitly identifies uv.
- Do not replace pip support; pip and uv remain distinct managed installer surfaces.

## Decisions

### 1. Model uv as a managed install type

Add `uv` to `ManagedInstallType` and installer capabilities with install, update, uninstall, and no latest-version lookup. uv's lifecycle maps directly to `uv tool install`, `uv tool upgrade`, and `uv tool uninstall`, while latest version discovery remains out of scope until there is a stable package registry lookup path already used by Quantex.

Alternative considered: keep uv as `binaryInstall(...)` plus self-update commands. That preserves command text but prevents state recording, batch grouping, diagnostics, and structured lifecycle behavior, so it does not satisfy the issue.

### 2. Keep package metadata installer-specific

Add optional `packages.uv` metadata and a `uvToolInstall(packageName?: string, packageInstallArgs?: string[])` helper. `getManagedPackageName` resolves uv from method-level `packageName` first and `packages.uv` second. It MUST NOT fall back to npm or pip metadata.

This matches the existing Cargo and pip separation and avoids accidentally running `uv tool install` against a different package ecosystem name.

### 3. Preserve uv package install args in state and batch updates

Reuse the existing `packageInstallArgs` field. For uv, those args are appended after the package name when rendering and executing:

- install: `uv tool install <package> ...args`
- update: `uv tool upgrade <package> ...args`
- uninstall: `uv tool uninstall <package>`

This supports currently documented commands such as `uv tool install openhands --python 3.12` and update commands with cache or Python flags. Recorded args are included in the managed package dedupe key so distinct uv tool specs do not collapse incorrectly during grouped updates.

### 4. Add best-effort uv installed-version inspection

uv can list installed tools through `uv tool list`, but the output is human-readable rather than a documented JSON contract. The initial parser only accepts the stable-looking first line shape `<package> v<version>` and returns `undefined` for unrecognized output. This gives Quantex useful inspection when reliable without making lifecycle correctness depend on a brittle parser.

### 5. Keep platform support on agent definitions

uv availability is global installer capability; actual agent support remains platform-specific. OpenHands remains macOS/Linux only because upstream CLI docs route Windows users through WSL. Mistral Vibe keeps Windows uv/pip methods while retaining macOS/Linux shell installers. Kimi CLI gains uv tool install only on macOS/Linux because upstream currently documents only those platforms.

## Risks / Trade-offs

- uv tool list format changes -> parser returns `undefined` unless the expected line shape is present; version probes can still use agent binaries.
- Some uv tool install options may be order-sensitive for future uv versions -> Quantex records explicit args and appends them consistently, matching existing OpenHands guidance and uv's accepted option model.
- uv can manage Python downloads and tool environments internally -> Quantex treats that as uv-owned behavior and only invokes the lifecycle commands.

## Migration Plan

1. Add the uv managed installer, helper, command rendering, availability output, and schema wiring.
2. Migrate OpenHands CLI, Mistral Vibe, and Kimi CLI uv install methods where upstream docs verify support.
3. Add focused unit coverage for uv installer commands, package metadata resolution, catalog definitions, update planning, diagnostics, and schema output.
4. Validate through OpenSpec status/validation plus lint, format check, typecheck, and tests.
