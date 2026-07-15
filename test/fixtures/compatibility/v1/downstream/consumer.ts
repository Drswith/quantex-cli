import type {
  AgentDefinition,
  CommandResult,
  QuantexConfig,
  QuantexState,
  SelfInspection,
  UpdatePlan,
} from 'quantex-cli'
import {
  createSuccessResult,
  createUpdatePlan,
  getAgentByNameOrAlias,
  getExitCodeForResult,
  getSelfVersion,
  loadConfig,
  loadState,
} from 'quantex-cli'

const agent: AgentDefinition | undefined = getAgentByNameOrAlias('codex')
const result: CommandResult<{ compatible: true }> = createSuccessResult({
  action: 'downstream-compile',
  data: { compatible: true },
})
const plan: UpdatePlan = createUpdatePlan([])

const configPromise: Promise<QuantexConfig> = loadConfig()
const statePromise: Promise<QuantexState> = loadState()
const inspection: SelfInspection | undefined = undefined

void agent
void configPromise
void statePromise
void inspection
void getExitCodeForResult(result)
void getSelfVersion()
void plan
