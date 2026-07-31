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

The SDK does not yet publish `update`, `uninstall`, or `run`. Stable CLI mutations remain on the maintained legacy engine while the 1.2-1.5 compatibility stages are completed. State schema version 2 remains frozen throughout 1.x. Engine selection occurs before each invocation, with no fallback after mutation side effects begin; after Core routing is promoted, rollback uses the whole-invocation legacy route preserved through 1.5.

See the [Quantex repository](https://github.com/Drswith/quantex-cli) for current API documentation and compatibility status.
