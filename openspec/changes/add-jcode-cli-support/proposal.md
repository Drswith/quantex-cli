## Why

`jcode` is a separate upstream coding-agent CLI with official install scripts, a documented Homebrew tap, and active GitHub releases. Quantex should support it as its own lifecycle agent so users can install, inspect, resolve, and run `jcode` through the same stable catalog used for other supported CLIs.

This request requires OpenSpec because it adds supported agent catalog metadata and updates product-facing supported-agent documentation.

## What Changes

- Add a supported `jcode` catalog entry with verified install methods, version probing, and homepage metadata from the official upstream repository.
- Register the new agent in the runtime registry and root exports.
- Add test coverage for `jcode` lookup, install metadata, and version probing.
- Update supported-agent documentation to list `jcode` in the user-facing support matrix.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-catalog`: add `jcode` as a supported lifecycle agent with official install methods and version-probe metadata

## Impact

- `src/agents/definitions/jcode.ts` - new `jcode` lifecycle metadata definition
- `src/agents/index.ts` and `src/index.ts` - register and re-export `jcode`
- `test/agents.test.ts` and `test/index.test.ts` - cover `jcode` lookup and metadata
- `README.md` and `README.zh-CN.md` - add `jcode` to supported-agent tables
- `openspec/changes/add-jcode-cli-support/specs/agent-catalog/spec.md` - record the catalog contract delta
