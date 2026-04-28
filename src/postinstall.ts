import process from 'node:process'
import { persistDetectedPackageManagerInstallSource } from './self/install-state'

void runPostinstall()

async function runPostinstall(): Promise<void> {
  try {
    await persistDetectedPackageManagerInstallSource(process.env)
  } catch {}
}
