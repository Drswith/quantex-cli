import { setStateHostPorts, type StateHostPorts } from '../../packages/core/src/state/host'
import { getConfigDir } from '../config'

export const cliStateHostPorts: StateHostPorts = {
  configDir: () => getConfigDir(),
}

export function bindCliStateHost(): void {
  setStateHostPorts(cliStateHostPorts)
}
