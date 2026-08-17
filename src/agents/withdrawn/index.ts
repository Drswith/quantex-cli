import type { AgentDefinition } from '../types'
import { toAgentDefinition } from '../catalog'
import { catalogSourceSchema } from '../schema'
import deepcodeEntry from './deepcode.json'
import genieEntry from './genie.json'
import jcodeEntry from './jcode.json'
import vtcodeEntry from './vtcode.json'

// Agents withdrawn from the supported catalog that remain importable from the package
// root because they were part of the v1 export snapshot. These are frozen definitions,
// not catalog members: they are absent from getAllAgents, agent lookup, and every
// lifecycle command. They exist so a downstream `import { vtcode } from 'quantex-cli'`
// keeps compiling, and they are removed in a future major together with the rest of the
// v1 export surface.
//
// Deliberately documented with line comments instead of a JSDoc block: tsdown emits
// JSDoc into dist/index.d.mts, and that file is pinned by exact bytes and sha256 in
// test/fixtures/compatibility/v1/root-declaration.json.
const [deepcodeParsed, genieParsed, jcodeParsed, vtcodeParsed] = catalogSourceSchema.parse([
  deepcodeEntry,
  genieEntry,
  jcodeEntry,
  vtcodeEntry,
])

export const deepcode: AgentDefinition = toAgentDefinition(deepcodeParsed!)
export const genie: AgentDefinition = toAgentDefinition(genieParsed!)
export const jcode: AgentDefinition = toAgentDefinition(jcodeParsed!)
export const vtcode: AgentDefinition = toAgentDefinition(vtcodeParsed!)

export const withdrawnAgentNames = Object.freeze(['deepcode', 'genie', 'jcode', 'vtcode'] as const)
