import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { FileStateDocumentPersistence, LifecycleStateStore, type StateFileSystem } from './store'

const nodeStateFileSystem: StateFileSystem = {
  async makeDirectory(path) {
    await mkdir(path, { recursive: true })
  },
  async readText(path) {
    return readFile(path, 'utf8')
  },
  async remove(path) {
    await rm(path, { force: true })
  },
  async rename(from, to) {
    await rename(from, to)
  },
  async writeText(path, data) {
    await writeFile(path, data, 'utf8')
  },
}

export function getStateFilePathInConfigDir(configDir: string): string {
  return join(configDir, 'state.json')
}

export function createFileLifecycleStateStore(
  configDir: string,
  tempFileSuffix = String(process.pid),
): LifecycleStateStore {
  const stateFilePath = getStateFilePathInConfigDir(configDir)
  return new LifecycleStateStore(
    new FileStateDocumentPersistence({
      backupFilePath: `${stateFilePath}.v1.bak`,
      directoryPath: configDir,
      fileSystem: nodeStateFileSystem,
      stateFilePath,
      tempFileSuffix,
    }),
  )
}
