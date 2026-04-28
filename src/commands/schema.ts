import type { CommandResult } from '../output/types'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { pc } from '../utils/color'

interface JsonSchema {
  additionalProperties?: boolean
  items?: JsonSchema
  properties?: Record<string, JsonSchema>
  required?: string[]
  type: 'array' | 'boolean' | 'integer' | 'null' | 'number' | 'object' | 'string'
}

interface SchemaDocument {
  dataSchema: JsonSchema
  description: string
  envelopeSchema: JsonSchema
  name: string
  ndjsonEventSchema?: JsonSchema
}

interface SchemaCommandData {
  commands: SchemaDocument[]
}

const baseEnvelopeSchema: JsonSchema = {
  additionalProperties: false,
  properties: {
    action: { type: 'string' },
    data: { type: 'object' },
    error: {
      additionalProperties: false,
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['code', 'message'],
      type: 'object',
    },
    exitCode: { type: 'integer' },
    meta: {
      additionalProperties: false,
      properties: {
        mode: { type: 'string' },
        runId: { type: 'string' },
        schemaVersion: { type: 'string' },
        source: { type: 'string' },
        fetchedAt: { type: 'string' },
        staleAfter: { type: 'string' },
        timestamp: { type: 'string' },
        version: { type: 'string' },
      },
      required: ['mode', 'runId', 'schemaVersion', 'timestamp', 'version'],
      type: 'object',
    },
    ok: { type: 'boolean' },
    target: {
      additionalProperties: false,
      properties: {
        kind: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['kind'],
      type: 'object',
    },
    warnings: {
      items: {
        additionalProperties: false,
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['code', 'message'],
        type: 'object',
      },
      type: 'array',
    },
  },
  required: ['action', 'error', 'meta', 'ok', 'warnings'],
  type: 'object',
}

const baseNdjsonEventSchema: JsonSchema = {
  additionalProperties: false,
  properties: {
    action: { type: 'string' },
    data: { type: 'object' },
    meta: {
      additionalProperties: false,
      properties: {
        mode: { type: 'string' },
        runId: { type: 'string' },
        schemaVersion: { type: 'string' },
        source: { type: 'string' },
        fetchedAt: { type: 'string' },
        staleAfter: { type: 'string' },
        timestamp: { type: 'string' },
        version: { type: 'string' },
      },
      required: ['mode', 'runId', 'schemaVersion', 'timestamp', 'version'],
      type: 'object',
    },
    target: {
      additionalProperties: false,
      properties: {
        kind: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['kind'],
      type: 'object',
    },
    type: { type: 'string' },
  },
  required: ['action', 'meta', 'type'],
  type: 'object',
}

const schemaCatalog: SchemaDocument[] = [
  {
    dataSchema: {
      additionalProperties: false,
      properties: {
        agents: {
          items: { type: 'string' },
          type: 'array',
        },
        features: {
          additionalProperties: false,
          properties: {
            assumeYes: { type: 'boolean' },
            cacheBypass: { type: 'boolean' },
            cacheRefresh: { type: 'boolean' },
            channels: { items: { type: 'string' }, type: 'array' },
            colorModes: { items: { type: 'string' }, type: 'array' },
            dryRun: { type: 'boolean' },
            execInstallPolicies: { items: { type: 'string' }, type: 'array' },
            freshnessMetadata: { type: 'boolean' },
            idempotencyKey: { type: 'boolean' },
            logLevels: { items: { type: 'string' }, type: 'array' },
            quietLogs: { type: 'boolean' },
            selfUpgrade: { type: 'boolean' },
            timeout: { type: 'boolean' },
          },
          required: [
            'assumeYes',
            'cacheBypass',
            'cacheRefresh',
            'channels',
            'colorModes',
            'dryRun',
            'execInstallPolicies',
            'freshnessMetadata',
            'idempotencyKey',
            'logLevels',
            'quietLogs',
            'selfUpgrade',
            'timeout',
          ],
          type: 'object',
        },
        installers: { type: 'object' },
        outputModes: { items: { type: 'string' }, type: 'array' },
        platform: {
          additionalProperties: false,
          properties: {
            arch: { type: 'string' },
            os: { type: 'string' },
          },
          required: ['arch', 'os'],
          type: 'object',
        },
      },
      required: ['agents', 'features', 'installers', 'outputModes', 'platform'],
      type: 'object',
    },
    description: 'Environment and surface capabilities',
    envelopeSchema: baseEnvelopeSchema,
    name: 'capabilities',
    ndjsonEventSchema: baseNdjsonEventSchema,
  },
  {
    dataSchema: {
      additionalProperties: false,
      properties: {
        commands: {
          items: {
            additionalProperties: false,
            properties: {
              flags: { items: { type: 'string' }, type: 'array' },
              name: { type: 'string' },
              outputSchemaRef: { type: 'string' },
              stability: { type: 'string' },
              summary: { type: 'string' },
            },
            required: ['flags', 'name', 'outputSchemaRef', 'stability', 'summary'],
            type: 'object',
          },
          type: 'array',
        },
      },
      required: ['commands'],
      type: 'object',
    },
    description: 'Stable command catalog',
    envelopeSchema: baseEnvelopeSchema,
    name: 'commands',
    ndjsonEventSchema: baseNdjsonEventSchema,
  },
  {
    dataSchema: {
      additionalProperties: false,
      properties: {
        agents: {
          items: {
            additionalProperties: false,
            properties: {
              displayName: { type: 'string' },
              installedVersion: { type: 'string' },
              latestVersion: { type: 'string' },
              lifecycle: { type: 'string' },
              outdated: { type: 'boolean' },
              sourceLabel: { type: 'string' },
            },
            required: ['displayName', 'lifecycle', 'outdated', 'sourceLabel'],
            type: 'object',
          },
          type: 'array',
        },
        installers: {
          additionalProperties: false,
          properties: {
            brew: { type: 'boolean' },
            bun: { type: 'boolean' },
            npm: { type: 'boolean' },
            winget: { type: 'boolean' },
          },
          required: ['brew', 'bun', 'npm', 'winget'],
          type: 'object',
        },
        issues: {
          items: {
            additionalProperties: false,
            properties: {
              blocking: { type: 'boolean' },
              category: { type: 'string' },
              code: { type: 'string' },
              docsRef: { type: 'string' },
              message: { type: 'string' },
              severity: { type: 'string' },
              subject: {
                additionalProperties: false,
                properties: {
                  kind: { type: 'string' },
                  name: { type: 'string' },
                },
                required: ['kind'],
                type: 'object',
              },
              suggestedAction: { type: 'string' },
              suggestedCommands: {
                items: { type: 'string' },
                type: 'array',
              },
            },
            required: [
              'blocking',
              'category',
              'code',
              'message',
              'severity',
              'subject',
              'suggestedAction',
              'suggestedCommands',
            ],
            type: 'object',
          },
          type: 'array',
        },
        self: {
          additionalProperties: false,
          properties: {
            canAutoUpdate: { type: 'boolean' },
            currentVersion: { type: 'string' },
            installSource: { type: 'string' },
            latestVersion: { type: 'string' },
            outdated: { type: 'boolean' },
            recoveryHint: { type: 'string' },
          },
          required: ['canAutoUpdate', 'currentVersion', 'installSource', 'outdated'],
          type: 'object',
        },
      },
      required: ['agents', 'installers', 'issues', 'self'],
      type: 'object',
    },
    description: 'Diagnostic state and remediation guidance for the current environment',
    envelopeSchema: baseEnvelopeSchema,
    name: 'doctor',
    ndjsonEventSchema: baseNdjsonEventSchema,
  },
  {
    dataSchema: {
      additionalProperties: false,
      properties: {
        agent: {
          additionalProperties: false,
          properties: {
            binaryName: { type: 'string' },
            displayName: { type: 'string' },
            name: { type: 'string' },
          },
          required: ['name'],
          type: 'object',
        },
        execution: {
          additionalProperties: false,
          properties: {
            args: {
              items: { type: 'string' },
              type: 'array',
            },
            installGuidance: {
              additionalProperties: false,
              properties: {
                docsRef: { type: 'string' },
                installMethods: {
                  items: {
                    additionalProperties: false,
                    properties: {
                      command: { type: 'string' },
                      label: { type: 'string' },
                      type: { type: 'string' },
                    },
                    required: ['command', 'label', 'type'],
                    type: 'object',
                  },
                  type: 'array',
                },
                suggestedAction: { type: 'string' },
                suggestedEnsureCommand: { type: 'string' },
                suggestedExecCommand: { type: 'string' },
              },
              required: [
                'docsRef',
                'installMethods',
                'suggestedAction',
                'suggestedEnsureCommand',
                'suggestedExecCommand',
              ],
              type: 'object',
            },
            installPolicy: { type: 'string' },
            installed: { type: 'boolean' },
            interactive: { type: 'boolean' },
            launched: { type: 'boolean' },
          },
          required: ['args', 'installPolicy', 'installed', 'interactive', 'launched'],
          type: 'object',
        },
      },
      required: ['agent', 'execution'],
      type: 'object',
    },
    description: 'Preflight contract for managed agent execution',
    envelopeSchema: baseEnvelopeSchema,
    name: 'exec',
    ndjsonEventSchema: baseNdjsonEventSchema,
  },
  {
    dataSchema: {
      additionalProperties: false,
      properties: {
        agent: { type: 'object' },
        changed: { type: 'boolean' },
        installState: { type: 'object' },
        installed: { type: 'boolean' },
      },
      required: ['agent', 'changed', 'installed'],
      type: 'object',
    },
    description: 'Ensure result for an agent',
    envelopeSchema: baseEnvelopeSchema,
    name: 'ensure',
    ndjsonEventSchema: baseNdjsonEventSchema,
  },
  {
    dataSchema: {
      additionalProperties: false,
      properties: {
        agent: { type: 'object' },
        capabilities: { type: 'object' },
        inspection: { type: 'object' },
      },
      required: ['agent', 'capabilities', 'inspection'],
      type: 'object',
    },
    description: 'Structured inspection result for an agent',
    envelopeSchema: baseEnvelopeSchema,
    name: 'inspect',
    ndjsonEventSchema: baseNdjsonEventSchema,
  },
  {
    dataSchema: {
      additionalProperties: false,
      properties: {
        agent: { type: 'object' },
        resolution: {
          additionalProperties: false,
          properties: {
            binaryPath: { type: 'string' },
            installGuidance: {
              additionalProperties: false,
              properties: {
                docsRef: { type: 'string' },
                installMethods: {
                  items: {
                    additionalProperties: false,
                    properties: {
                      command: { type: 'string' },
                      label: { type: 'string' },
                      type: { type: 'string' },
                    },
                    required: ['command', 'label', 'type'],
                    type: 'object',
                  },
                  type: 'array',
                },
                suggestedAction: { type: 'string' },
                suggestedEnsureCommand: { type: 'string' },
              },
              required: ['docsRef', 'installMethods', 'suggestedAction', 'suggestedEnsureCommand'],
              type: 'object',
            },
            installed: { type: 'boolean' },
            installSource: { type: 'string' },
            installedVersion: { type: 'string' },
            lifecycle: { type: 'string' },
            sourceLabel: { type: 'string' },
            suggestedLaunchCommand: {
              items: { type: 'string' },
              type: 'array',
            },
          },
          required: ['binaryPath', 'installed', 'installSource', 'lifecycle', 'sourceLabel', 'suggestedLaunchCommand'],
          type: 'object',
        },
      },
      required: ['agent', 'resolution'],
      type: 'object',
    },
    description: 'Resolved executable entrypoint for an agent',
    envelopeSchema: baseEnvelopeSchema,
    name: 'resolve',
    ndjsonEventSchema: baseNdjsonEventSchema,
  },
  {
    dataSchema: {
      additionalProperties: false,
      properties: {
        commands: {
          items: {
            additionalProperties: false,
            properties: {
              dataSchema: { type: 'object' },
              description: { type: 'string' },
              envelopeSchema: { type: 'object' },
              name: { type: 'string' },
              ndjsonEventSchema: { type: 'object' },
            },
            required: ['dataSchema', 'description', 'envelopeSchema', 'name'],
            type: 'object',
          },
          type: 'array',
        },
      },
      required: ['commands'],
      type: 'object',
    },
    description: 'Structured schema catalog',
    envelopeSchema: baseEnvelopeSchema,
    name: 'schema',
    ndjsonEventSchema: baseNdjsonEventSchema,
  },
]

export async function schemaCommand(commandName?: string): Promise<CommandResult<SchemaCommandData>> {
  const commands = commandName ? schemaCatalog.filter(schema => schema.name === commandName) : schemaCatalog

  if (commandName && commands.length === 0) {
    return emitCommandResult(
      createErrorResult<SchemaCommandData>({
        action: 'schema',
        error: {
          code: 'INVALID_ARGUMENT',
          details: {
            command: commandName,
          },
          message: `Unknown schema target: ${commandName}`,
        },
        target: {
          kind: 'system',
          name: 'schema',
        },
      }),
      renderSchemaHuman,
    )
  }

  return emitCommandResult(
    createSuccessResult<SchemaCommandData>({
      action: 'schema',
      data: {
        commands,
      },
      target: {
        kind: 'system',
        name: 'schema',
      },
    }),
    renderSchemaHuman,
  )
}

function renderSchemaHuman(result: { data?: SchemaCommandData; error: { message: string } | null }): void {
  if (result.error) {
    console.log(pc.red(result.error.message))
    return
  }

  if (!result.data) return

  console.log(pc.bold('\nQuantex Schemas\n'))
  for (const schema of result.data.commands) {
    console.log(`  ${pc.cyan(schema.name)}`)
    console.log(`    ${schema.description}`)
  }
  console.log()
}

export function getSchemaCatalog(): SchemaDocument[] {
  return schemaCatalog
}
