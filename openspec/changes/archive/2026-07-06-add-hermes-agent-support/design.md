## Context

Hermes Agent is Nous Research's self-improving AI agent, distributed as a Python-based CLI named `hermes`. Upstream documentation identifies the native installers as the recommended end-user install path: a curl one-liner for Linux/macOS/WSL2/Termux and a PowerShell one-liner for native Windows. The same docs document `hermes update` as the self-update entrypoint ("Pull latest code and reinstall dependencies") and expose standard `--version` / `-V` version probing on the root dispatcher, alongside a `hermes version` subcommand.

Quantex already represents supported agents as lifecycle-focused catalog metadata in JSON catalog files under `src/agents/catalog/`, with a generated manifest (`src/agents/generated/`) and re-exports from `src/agents/index.ts`. Hermes fits the existing catalog shape without adding new package-manager, execution, inspection, or update-planning behavior.

## Goals / Non-Goals

**Goals:**

- Add Hermes Agent as a supported Quantex lifecycle agent with verified upstream metadata.
- Expose the official native installers as script install methods, version probing, and self-update metadata.
- Keep the implementation limited to the existing agent catalog, generated manifest, README tables, and focused test coverage.

**Non-Goals:**

- Add Hermes-specific runtime integration, prompts, provider configuration, skills, MCP, messaging gateway, or session-management behavior.
- Model `uv pip install -e ".[all,dev]"` contributor setup or the managed `~/.hermes` venv as a Quantex install method; that path is for development checkouts, not end-user installs.
- Add a pip/uv managed install method for end users; upstream does not document `pip install hermes-agent` or `uv tool install hermes-agent` as a supported end-user install path.
- Add Homebrew, Cargo, npm, or winget methods that upstream does not document.
- Model `hermes setup`, `hermes doctor`, profile management, or cron/gateway configuration beyond the base `hermes update` self-update command.

## Decisions

### 1. Use `hermes` as the canonical slug and executable

The upstream binary, documented commands, and product branding all use `hermes`. Quantex should therefore expose `hermes` as the canonical agent name and executable target.

### 2. Accept `hermes-agent` as a lookup alias

The GitHub repository and Python package are both named `hermes-agent`, and the user requested support via the repository URL `https://github.com/NousResearch/hermes-agent`. Quantex should accept `hermes-agent` as a lookup alias so users can resolve the agent by either the canonical `hermes` slug or the repository-derived name without changing the canonical slug.

### 3. Use the GitHub repository as the homepage

Upstream declares `https://hermes-agent.nousresearch.com` as its product site, but the GitHub repository at `https://github.com/NousResearch/hermes-agent` is the canonical source of install scripts, issues, and release artifacts, and matches the user-provided reference. Quantex should record the repository URL as the homepage, consistent with other source-first catalog entries such as Goose and VTCode.

### 4. Keep native installers as script install methods

The README documents native macOS/Linux and Windows installer scripts as the only end-user install paths. These are executable install guidance but not managed package-manager methods, so they should be modeled with existing `script` install entries:

- macOS/Linux: `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`
- Windows: `iex (irm https://hermes-agent.nousresearch.com/install.ps1)`

The Windows command uses the `iex (irm ...)` form documented upstream rather than the `irm ... | iex` pipe variant; both are functionally equivalent in PowerShell, and the catalog records the upstream-documented form.

### 5. Probe and update through the root dispatcher

The CLI reference documents standard `--version` / `-V` support on the root dispatcher and `hermes update` as the pull-and-reinstall self-update command. Quantex should use `hermes --version` for version probes (matching the catalog convention used by every other supported agent) and expose `hermes update` as the self-update command for installations that support Hermes's built-in updater.

## Risks / Trade-offs

- [Hermes bundles uv, Python, Node, ripgrep, ffmpeg, and a portable Git Bash via its installer] -> Keep Quantex scoped to recording the documented installer command; the installer's bundled dependencies are upstream concerns and not modeled as separate Quantex install methods.
- [No managed package-manager install is documented for end users] -> Record only script install methods; if upstream later documents a pip/uv/Homebrew path, extend the catalog in a future OpenSpec change.
- [`hermes version` subcommand also exists] -> Use `hermes --version` for catalog consistency with sibling agents; both are documented and the catalog records a single canonical probe command.
- [Native Windows install places files under `%LOCALAPPDATA%\hermes` and may trigger antivirus false positives on bundled `uv.exe`] -> Record only the install command; quarantine/whitelisting guidance is upstream documentation and not a Quantex lifecycle concern.
