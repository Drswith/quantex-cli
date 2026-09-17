import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

export interface StateHostPorts {
  configDir(): string
}

function defaultConfigDir(): string {
  return join(process.env.HOME || process.env.USERPROFILE || homedir(), '.quantex')
}

const defaultPorts: StateHostPorts = {
  configDir: defaultConfigDir,
}

let currentPorts: StateHostPorts = defaultPorts

export function setStateHostPorts(ports: StateHostPorts): void {
  currentPorts = ports
}

export function resetStateHostPorts(): void {
  currentPorts = defaultPorts
}

export function getStateHostPorts(): StateHostPorts {
  return currentPorts
}
