import type { DoctorData, DoctorDiagnosisAgentInput } from '../core/doctor-diagnosis'
import { projectObservationToV1Inspection } from '../compatibility/agent-inspection'
import { diagnoseDoctorEnvironment } from '../core/doctor-diagnosis'
import { BUILD_PACKAGE_NAME } from '../generated/build-meta'
import { createCliOperationContext } from '../runtime/cli-operation-context'
import { getSelfUpgradeRecoveryHintForInspection, inspectSelfReadOnly } from '../self'
import { observeCliReadRegisteredAgents } from './core-read-observations'
import { observeProviderSnapshot, projectProviderSnapshotToV1Installers } from './provider-observations'

const troubleshootingDocsRef = 'docs/runbooks/quantex-troubleshooting.md'
const selfUpgradeDocsRef = 'docs/runbooks/release-and-self-upgrade-debugging.md'

/**
 * CLI→Core bridge for doctor: gather CLI-coupled observations, then synthesize
 * through the in-repo Core diagnosis engine.
 */
export async function observeAndDiagnoseDoctorEnvironment(): Promise<DoctorData> {
  const operation = createCliOperationContext()
  let providerSnapshot: Awaited<ReturnType<typeof observeProviderSnapshot>>
  let selfInspection: Awaited<ReturnType<typeof inspectSelfReadOnly>>
  let observations: Awaited<ReturnType<typeof observeCliReadRegisteredAgents>>
  try {
    ;[providerSnapshot, selfInspection, observations] = await operation.run(() =>
      Promise.all([
        observeProviderSnapshot({ context: operation.context }),
        inspectSelfReadOnly({ context: operation.context }),
        observeCliReadRegisteredAgents(operation.context),
      ]),
    )
  } finally {
    operation.dispose()
  }

  const installers = projectProviderSnapshotToV1Installers(
    providerSnapshot,
    entry => entry.availability.kind === 'success',
  )

  const agents: DoctorDiagnosisAgentInput[] = observations.map(observation => {
    const inspection = projectObservationToV1Inspection(observation)
    return {
      displayName: inspection.agent.displayName,
      homepage: inspection.agent.homepage,
      inPath: inspection.inPath,
      installedVersion: inspection.installedVersion,
      latestVersion: inspection.latestVersion,
      lifecycle: inspection.lifecycle,
      name: inspection.agent.name,
      selfUpdateCommand: inspection.agent.selfUpdate ? inspection.agent.selfUpdate.command.join(' ') : undefined,
      sourceLabel: inspection.sourceLabel,
      untracked: observation.observation.drift.kind === 'untracked',
    }
  })

  return diagnoseDoctorEnvironment({
    agents,
    docs: {
      selfUpgrade: selfUpgradeDocsRef,
      troubleshooting: troubleshootingDocsRef,
    },
    installers,
    self: {
      canAutoUpdate: selfInspection.canAutoUpdate,
      currentVersion: selfInspection.currentVersion,
      installSource: selfInspection.installSource,
      latestVersion: selfInspection.latestVersion,
      packageName: BUILD_PACKAGE_NAME,
      recommendedUpgradeCommand: selfInspection.recommendedUpgradeCommand,
      recoveryHint: getSelfUpgradeRecoveryHintForInspection(selfInspection),
      updateChannel: selfInspection.updateChannel,
    },
  })
}
