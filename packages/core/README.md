# quantex-core

`quantex-core` is Quantex's non-interactive TypeScript SDK. It is independently versioned and published to npm after clean Node.js, Bun, and TypeScript NodeNext consumer validation. `quantex-cli` releases do not depend on Core publication.

The 1.2 surface established `createQuantex`, `list`, and `inspect`. The 1.3 integration surface adds gated `install` and `ensure` methods:

```ts
import { createQuantex } from 'quantex-core'

const quantex = createQuantex()
const agents = await quantex.list()
const codex = await quantex.inspect('codex')
const preview = await quantex.ensure('codex', { mode: 'preview' })

if (codex.ok) {
  console.log(codex.value.status)
}

if (preview.ok && preview.value.mode === 'preview') {
  console.log(preview.value.decision, preview.value.wouldChange)
}
```

The package is ESM-only and supports Node.js 20 or newer. Bun can consume the same ESM entry point. Core returns typed results and does not prompt, print, call `process.exit`, or own CLI exit-code policy. `install` and `ensure` default to apply mode; pass `{ mode: 'preview' }` for a side-effect-free decision. PATH-only external agents are preserved rather than adopted, and failures expose stable phase and side-effect details without provider internals. Prompts, human and JSON/NDJSON presentation, command-line execution, and Quantex self-upgrade remain responsibilities of `qtx` / `quantex`.

The SDK does not publish `update`, `uninstall`, `run`, or `doctor`. In the 1.12 CLI slices, mutation commands execute through in-repo Core engines, CLI `inspect` / `info` / `resolve` / `list` observe through in-repo Core read ports, CLI `exec` / shortcut launch through an in-repo Core execution engine, and CLI `doctor` diagnoses through an in-repo Core diagnosis engine, while those unpublished methods remain absent from this package's public method surface. State schema version 2 remains frozen throughout 1.x. Engine selection occurs before each invocation, with no fallback after mutation side effects begin; install/ensure rollback continues to use the whole-invocation legacy route.

See the [Quantex repository](https://github.com/Drswith/quantex-cli) for current API documentation and compatibility status.
