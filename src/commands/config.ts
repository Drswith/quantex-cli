import type { CommandResult } from '../output/types'
import pc from 'picocolors'
import { isNpmBunUpdateStrategy, loadConfig, saveConfig } from '../config'
import { defaultConfig } from '../config/default'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'

interface ConfigCommandData {
  action: 'get' | 'list' | 'reset' | 'set'
  config?: Record<string, unknown>
  key?: string
  value?: number | string
}

export async function configCommand(action?: string, key?: string, value?: string): Promise<CommandResult<ConfigCommandData>> {
  if (!action) {
    const config = await loadConfig()
    return emitCommandResult(createSuccessResult<ConfigCommandData>({
      action: 'config',
      data: {
        action: 'list',
        config,
      },
      target: {
        kind: 'config',
      },
    }), renderConfigHuman)
  }

  switch (action) {
    case 'get': {
      if (!key) {
        return emitCommandResult(createErrorResult<ConfigCommandData>({
          action: 'config',
          error: {
            code: 'INVALID_ARGUMENT',
            message: 'Please specify a key',
          },
          target: {
            kind: 'config',
          },
        }), renderConfigHuman)
      }
      const config = await loadConfig()
      const val = config[key]
      return emitCommandResult(createSuccessResult<ConfigCommandData>({
        action: 'config',
        data: {
          action: 'get',
          key,
          value: typeof val === 'number' || typeof val === 'string' ? val : undefined,
        },
        target: {
          kind: 'config',
          name: key,
        },
      }), renderConfigHuman)
    }
    case 'set': {
      if (!key || value === undefined) {
        return emitCommandResult(createErrorResult<ConfigCommandData>({
          action: 'config',
          error: {
            code: 'INVALID_ARGUMENT',
            message: 'Please specify both key and value',
          },
          target: {
            kind: 'config',
          },
        }), renderConfigHuman)
      }
      if (key === 'defaultPackageManager' && value !== 'bun' && value !== 'npm') {
        return emitCommandResult(createErrorResult<ConfigCommandData>({
          action: 'config',
          error: {
            code: 'INVALID_ARGUMENT',
            message: 'defaultPackageManager must be bun or npm',
          },
          target: {
            kind: 'config',
            name: key,
          },
        }), renderConfigHuman)
      }
      if (key === 'npmBunUpdateStrategy' && !isNpmBunUpdateStrategy(value)) {
        return emitCommandResult(createErrorResult<ConfigCommandData>({
          action: 'config',
          error: {
            code: 'INVALID_ARGUMENT',
            message: 'npmBunUpdateStrategy must be latest-major or respect-semver',
          },
          target: {
            kind: 'config',
            name: key,
          },
        }), renderConfigHuman)
      }
      if (key === 'selfUpdateChannel' && value !== 'stable' && value !== 'beta') {
        return emitCommandResult(createErrorResult<ConfigCommandData>({
          action: 'config',
          error: {
            code: 'INVALID_ARGUMENT',
            message: 'selfUpdateChannel must be stable or beta',
          },
          target: {
            kind: 'config',
            name: key,
          },
        }), renderConfigHuman)
      }
      if (['networkRetries', 'networkTimeoutMs', 'versionCacheTtlHours'].includes(key)) {
        const parsed = Number.parseInt(value, 10)
        if (!Number.isInteger(parsed) || parsed <= 0) {
          return emitCommandResult(createErrorResult<ConfigCommandData>({
            action: 'config',
            error: {
              code: 'INVALID_ARGUMENT',
              message: `${key} must be a positive integer`,
            },
            target: {
              kind: 'config',
              name: key,
            },
          }), renderConfigHuman)
        }
        value = `${parsed}`
      }
      let existing: Record<string, unknown> = {}
      try {
        existing = await loadConfig()
      }
      catch {
      }

      existing[key] = ['networkRetries', 'networkTimeoutMs', 'versionCacheTtlHours'].includes(key)
        ? Number.parseInt(value, 10)
        : value
      await saveConfig(existing)
      return emitCommandResult(createSuccessResult<ConfigCommandData>({
        action: 'config',
        data: {
          action: 'set',
          key,
          value: existing[key] as number | string,
        },
        target: {
          kind: 'config',
          name: key,
        },
      }), renderConfigHuman)
    }
    case 'reset': {
      await saveConfig(defaultConfig)
      return emitCommandResult(createSuccessResult<ConfigCommandData>({
        action: 'config',
        data: {
          action: 'reset',
          config: defaultConfig,
        },
        target: {
          kind: 'config',
        },
      }), renderConfigHuman)
    }
    default:
      return emitCommandResult(createErrorResult<ConfigCommandData>({
        action: 'config',
        error: {
          code: 'INVALID_ARGUMENT',
          details: {
            action,
          },
          message: `Unknown action: ${action}`,
        },
        target: {
          kind: 'config',
        },
        warnings: [
          {
            code: 'AVAILABLE_ACTIONS',
            message: 'Available actions: get, set, reset',
          },
        ],
      }), renderConfigHuman)
  }
}

function renderConfigHuman(result: { data?: ConfigCommandData, error: { message: string } | null, warnings: Array<{ message: string }> }): void {
  if (result.error) {
    console.log(pc.red(result.error.message))
    for (const warning of result.warnings)
      console.log(warning.message)
    return
  }

  if (!result.data)
    return

  switch (result.data.action) {
    case 'list':
      console.log(pc.bold('\nCurrent Configuration:\n'))
      console.log(JSON.stringify(result.data.config, null, 2))
      console.log()
      break
    case 'get':
      console.log(result.data.value !== undefined ? String(result.data.value) : pc.gray('(not set)'))
      break
    case 'set':
      console.log(pc.green(`Set ${result.data.key} = ${result.data.value}`))
      break
    case 'reset':
      console.log(pc.green('Configuration reset to defaults.'))
      break
  }
}
