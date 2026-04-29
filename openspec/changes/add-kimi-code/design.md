## Design

### Agent definition

Kimi Code CLI is a Python-based terminal agent distributed via:

1. **Official install scripts** — `curl -LsSf https://code.kimi.com/install.sh | bash` (macOS/Linux) and `irm https://code.kimi.com/install.ps1 | iex` (Windows). These install `uv` if missing, then `uv tool install kimi-cli`.
2. **Homebrew** — formula `kimi-cli` on homebrew-core (Python virtualenv build).
3. **PyPI** — package `kimi-cli`, installable via `uv tool install --python 3.13 kimi-cli`.

Kimi Code CLI does **not** have an npm package, so bun/npm managed install methods are not applicable.

### Install method priority

- **macOS / Linux**: script install (official curl) → Homebrew formula
- **Windows**: script install (PowerShell)

### Self-update

The recommended update command is `uv tool upgrade kimi-cli --no-cache`, matching the official docs. Homebrew users would use `brew upgrade kimi-cli` as a fallback.

### Version probe

`kimi --version` prints the version string. No custom parser needed.

### Lookup aliases

`kimi-code` and `kimi-cli` as aliases to help users who might search by either the product name or the package name.
