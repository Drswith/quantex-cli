## Context

Issue #281 requests lifecycle support for `oh-my-pi (omp)` in Quantex. The upstream project publishes an `omp` CLI backed by the npm package `@oh-my-pi/pi-coding-agent`, with official install guidance that includes a Bun global install path and platform install scripts (`https://omp.sh/install` for macOS/Linux, `https://omp.sh/install.ps1` for Windows).

Quantex already supports this integration pattern: catalog metadata declares canonical identifiers and install methods, while existing install/ensure/inspect/resolve/list/update surfaces consume that catalog without agent-specific command logic.

## Goals / Non-Goals

**Goals:**

- Add `omp` as a supported lifecycle agent with verified metadata for discover/install/check behavior.
- Keep install metadata aligned with upstream documented entry points.
- Ensure update diagnostics remain correct for managed and unmanaged install sources.

**Non-Goals:**

- Adding workflow orchestration behavior or new lifecycle primitives.
- Inventing unsupported package-manager install/update methods that upstream does not document.
- Adding `omp`-specific runtime logic outside the catalog contract.

## Decisions

### 1. Use `omp` as both canonical slug and executable name

The upstream CLI command is `omp`, so Quantex will use `omp` as both the stable lookup slug and `binaryName`.

### 2. Model Bun as the managed install path and keep official script installers

The catalog will include:

- managed `bun` install methods on Windows/macOS/Linux, using package metadata `@oh-my-pi/pi-coding-agent`
- official script installers:
  - macOS/Linux: `curl -fsSL https://omp.sh/install | sh`
  - Windows: `irm https://omp.sh/install.ps1 | iex`

This keeps lifecycle install guidance aligned with upstream docs while preserving Quantex managed-install behavior where it is explicitly documented.

### 3. Add an explicit version probe but no self-update command

Quantex will probe `omp --version` for installed version checks. The catalog will not define a `selfUpdate` command because upstream install docs do not publish a stable dedicated `omp update` workflow; managed Bun installs still use Quantex managed update behavior.

### 4. Keep docs synchronized where static agent snapshots exist

Static supported-agent lists in the product README and user-facing Quantex skill references will include `omp` so documented catalog snapshots match runtime behavior.

## Risks / Trade-offs

- [Upstream install endpoints or packaging can change] -> Keep metadata minimal and sourced from current official install references.
- [Users may expect npm-managed install parity because the package is on npm] -> Only encode Bun-managed installation because that is the documented install path; avoid inventing unsupported paths.
- [Script-installed users may expect `qtx update omp` to run a built-in updater] -> Do not advertise a self-update command; managed Bun installs remain updateable through standard Quantex managed update flow.
