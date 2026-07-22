# @quantex/core

`@quantex/core` is the provisional package name for Quantex's non-interactive TypeScript SDK. It is currently an integration-branch preview: the package has not been published, and npm namespace ownership and trusted-publisher setup are not yet confirmed.

The following command is the planned public installation path after the first 1.2 Core release. It is not expected to work today.

```bash
# Available after the first published 1.2 Core release
npm install @quantex/core
```

The first 1.2 surface is read-only and exposes only `createQuantex`, `list`, and `inspect`:

```ts
import { createQuantex } from '@quantex/core'

const quantex = createQuantex()
const agents = await quantex.list()
const codex = await quantex.inspect('codex')

if (codex.ok) {
  console.log(codex.value.status)
}
```

The package is ESM-only and supports Node.js 20 or newer. Bun can consume the same ESM entry point. Core returns typed results and does not prompt, print, call `process.exit`, or own CLI exit-code policy. Prompts, human and JSON/NDJSON presentation, command-line execution, Quantex self-upgrade, and current mutation commands remain responsibilities of `qtx` / `quantex`.

The SDK does not yet publish `install`, `ensure`, `update`, `uninstall`, or `run`. CLI mutations remain on the maintained legacy engine while the 1.2-1.5 compatibility stages are completed. State schema version 2 remains frozen throughout 1.x. Engine selection occurs before each invocation, with no fallback after mutation side effects begin; after Core routing is promoted, rollback uses the whole-invocation legacy route preserved through 1.5.

See the [Quantex repository](https://github.com/Drswith/quantex-cli) for current API documentation and compatibility status.
