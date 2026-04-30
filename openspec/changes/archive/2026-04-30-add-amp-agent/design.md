## Design

Add Amp as a supported agent entry following the established catalog pattern.

### Agent definition

- File: `src/agents/definitions/amp.ts`
- Canonical name: `amp`
- Display name: `Amp`
- Homepage: `https://ampcode.com/`
- NPM package: `@sourcegraph/amp`
- Binary name: `amp`
- Self-update command: `amp update`
- Version probe command: `amp version`
- Install methods: bun and npm on all three platforms (macOS, Linux, Windows)

No Homebrew or winget install methods — Sourcegraph Amp is distributed exclusively via npm.

### Registration

- Import and add to the `agents` array in `src/agents/index.ts` (alphabetically first).
- Re-export from the same file.

### Spec update

- Add a new requirement to `openspec/specs/agent-catalog/spec.md` covering lookup, install, version probe, and update scenarios for Amp.

### README updates

- Add Amp row to the Supported Agents table in `README.md` and `README.zh-CN.md`.
- Add Amp to the intro paragraph agent list in both files.
