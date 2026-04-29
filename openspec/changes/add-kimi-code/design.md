## Design

### Agent definition

Kimi Code CLI is a Python-based terminal agent distributed via:

1. **Official install scripts** — `curl -LsSf https://code.kimi.com/install.sh | bash` (macOS/Linux) and `irm https://code.kimi.com/install.ps1 | iex` (Windows). These install `uv` if missing, then `uv tool install kimi-cli`.
2. **PyPI** — package `kimi-cli`, installable via `uv tool install --python 3.13 kimi-cli`.

Kimi Code CLI does **not** have an npm package, so bun/npm managed install methods are not applicable.

A community-maintained Homebrew formula (`kimi-cli`) exists in homebrew-core but is not documented by Moonshot AI and lags behind the official release (1.30.0 vs 1.40.0 at time of writing). It is not included as a supported install method.

### Install method priority

- **macOS / Linux**: script install (official curl) only
- **Windows**: script install (PowerShell) only

### Self-update

The recommended update command is `uv tool upgrade kimi-cli --no-cache`, matching the official docs.

### Version probe

`kimi --version` prints the version string. No custom parser needed.

### Lookup aliases

`kimi-code` and `kimi-cli` as aliases to help users who might search by either the product name or the package name.
