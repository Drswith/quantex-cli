import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('CLI Core doctor diagnosis ownership', () => {
  it('routes doctor diagnosis through in-repo Core without a public SDK doctor()', async () => {
    const doctorFacade = await source('src/commands/doctor.ts')
    expect(doctorFacade).toContain("from '../services/doctor-diagnosis-production'")
    expect(doctorFacade).toContain('observeAndDiagnoseDoctorEnvironment')
    expect(doctorFacade).not.toContain('createQuantex')
    expect(doctorFacade).not.toMatch(/from ['"]quantex-core['"]/u)
    expect(doctorFacade).not.toContain('NO_MANAGED_INSTALLER')
    expect(doctorFacade).not.toContain('SELF_INSTALLER_MISSING')

    const productionBridge = await source('src/services/doctor-diagnosis-production.ts')
    expect(productionBridge).toContain("from '../core/doctor-diagnosis'")
    expect(productionBridge).toContain('diagnoseDoctorEnvironment')
    expect(productionBridge).toContain('observeProviderSnapshot')
    expect(productionBridge).toContain('inspectSelfReadOnly')
    expect(productionBridge).toContain('observeCliReadRegisteredAgents')
    expect(productionBridge).not.toContain('createQuantex')
    expect(productionBridge).not.toMatch(/from ['"]quantex-core['"]/u)

    const coreEngine = await source('src/core/doctor-diagnosis.ts')
    expect(coreEngine).toContain('diagnoseDoctorEnvironment')
    expect(coreEngine).toContain('NO_MANAGED_INSTALLER')
    expect(coreEngine).not.toContain('cli-context')
    expect(coreEngine).not.toContain("from '../self'")
    expect(coreEngine).not.toContain('createQuantex')

    const publicCore = await source('src/core/index.ts')
    expect(publicCore).not.toContain('doctor-diagnosis')
    expect(publicCore).not.toContain('diagnoseDoctorEnvironment')

    const packageEntry = await source('packages/core/src/index.ts')
    expect(packageEntry).not.toContain('doctor-diagnosis')
    expect(packageEntry).not.toContain('diagnoseDoctorEnvironment')
  })
})

async function source(path: string): Promise<string> {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
}
