import { brewProviderAdapter } from './adapters/brew'
import { bunProviderAdapter } from './adapters/bun'
import { cargoProviderAdapter } from './adapters/cargo'
import { denoProviderAdapter } from './adapters/deno'
import { binaryProviderAdapter, scriptProviderAdapter } from './adapters/install-effect'
import { miseProviderAdapter } from './adapters/mise'
import { npmProviderAdapter } from './adapters/npm'
import { pipProviderAdapter } from './adapters/pip'
import { uvProviderAdapter } from './adapters/uv'
import { wingetProviderAdapter } from './adapters/winget'
import { defineFirstPartyProviderRegistry } from './registry'

export const firstPartyProviderRegistry = defineFirstPartyProviderRegistry({
  binary: binaryProviderAdapter,
  brew: brewProviderAdapter,
  bun: bunProviderAdapter,
  cargo: cargoProviderAdapter,
  deno: denoProviderAdapter,
  mise: miseProviderAdapter,
  npm: npmProviderAdapter,
  pip: pipProviderAdapter,
  script: scriptProviderAdapter,
  uv: uvProviderAdapter,
  winget: wingetProviderAdapter,
})
