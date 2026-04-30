# Design: Add CodeBuddy agent support

## Approach

Add a new agent definition file that follows the existing lifecycle-focused catalog pattern used by `qoder.ts`, `forgecode.ts`, and `kiro.ts`. CodeBuddy exposes a stable executable name (`codebuddy`), an npm package (`@tencent-ai/codebuddy-code`), an official Homebrew tap formula, official native install scripts, a version command, and a built-in update command, so no new catalog shape or installer abstraction is needed.

Use `codebuddy` as the canonical Quantex slug because it matches the upstream executable and is product-specific. Add `codebuddy-code` as a lookup alias so users can also resolve the product/package spelling shown in upstream package-manager docs.

## Install methods

| Platform | Method | Command |
|---|---|---|
| macOS | bun | `bun add -g @tencent-ai/codebuddy-code` |
| macOS | npm | `npm install -g @tencent-ai/codebuddy-code` |
| macOS | script | `curl -fsSL https://www.codebuddy.cn/cli/install.sh \| bash` |
| macOS | brew | `brew install Tencent-CodeBuddy/tap/codebuddy-code` |
| Linux | bun | `bun add -g @tencent-ai/codebuddy-code` |
| Linux | npm | `npm install -g @tencent-ai/codebuddy-code` |
| Linux | script | `curl -fsSL https://www.codebuddy.cn/cli/install.sh \| bash` |
| Linux | brew | `brew install Tencent-CodeBuddy/tap/codebuddy-code` |
| Windows | bun | `bun add -g @tencent-ai/codebuddy-code` |
| Windows | npm | `npm install -g @tencent-ai/codebuddy-code` |
| Windows | script | `irm https://www.codebuddy.cn/cli/install.ps1 \| iex` |

The native script channel is documented upstream as a beta install path, but it is still an official installation method and works with the documented `codebuddy update` lifecycle.

## Version probe

`codebuddy --version` — documented upstream as the verification command after installation.

## Self-update

`codebuddy update` — documented upstream as the built-in command that detects the existing install method and updates accordingly.

## Files changed

- `src/agents/definitions/codebuddy.ts` — new file
- `src/agents/index.ts` — register import, array entry, and re-export
- `src/index.ts` — re-export CodeBuddy from the package root
- `test/agents.test.ts` — add registry, install-method, version-probe, and alias coverage
- `test/index.test.ts` — add root-export and lookup coverage
- `openspec/specs/agent-catalog/spec.md` — add CodeBuddy requirement section
- `README.md`, `README.zh-CN.md` — add CodeBuddy to static supported-agent tables
