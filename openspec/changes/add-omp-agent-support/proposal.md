## Why

Issue #281 requests first-class Quantex lifecycle support for `oh-my-pi (omp)`. This affects supported agent catalog metadata, install/check behavior, and product-facing supported-agent documentation, so it is an OpenSpec-required change.

## What Changes

- Add an `omp` supported-agent catalog entry with verified lifecycle metadata (canonical slug, display name, homepage, executable name, install methods, package metadata, and version probe).
- Register and re-export `omp` through the generated catalog manifests and root agent exports so existing lookup/install/ensure/inspect/resolve/exec surfaces can use it.
- Extend the `agent-catalog` OpenSpec contract with an `oh-my-pi (omp)` lifecycle requirement.
- Update supported-agent documentation to include `omp` where static agent lists are maintained.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: Add `oh-my-pi (omp)` as a supported lifecycle agent with documented install and version-probe metadata.

## Impact

- `src/agents/catalog/*.json` and `src/agents/generated/*` - add and register the `omp` catalog entry
- `src/agents/index.ts` and `src/index.ts` - re-export `omp` for runtime and library consumers
- `test/agents.test.ts` and `test/index.test.ts` - coverage for `omp` registry metadata and exports
- `openspec/changes/add-omp-agent-support/specs/agent-catalog/spec.md` - add the `oh-my-pi (omp)` requirement delta
- `README.md`, `README.zh-CN.md`, and `skills/quantex-cli/references/command-recipes.md` - sync static supported-agent lists
