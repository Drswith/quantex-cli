import type { CommandResult } from '../output/types'
import pc from 'picocolors'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'

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
            channels: { items: { type: 'string' }, type: 'array' },
            dryRun: { type: 'boolean' },
            execInstallPolicies: { items: { type: 'string' }, type: 'array' },
            selfUpgrade: { type: 'boolean' },
            timeout: { type: 'boolean' },
          },
          required: ['channels', 'dryRun', 'execInstallPolicies', 'selfUpgrade', 'timeout'],
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
  const commands = commandName
    ? schemaCatalog.filter(schema => schema.name === commandName)
    : schemaCatalog

  if (commandName && commands.length === 0) {
    return emitCommandResult(createErrorResult<SchemaCommandData>({
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
    }), renderSchemaHuman)
  }

  return emitCommandResult(createSuccessResult<SchemaCommandData>({
    action: 'schema',
    data: {
      commands,
    },
    target: {
      kind: 'system',
      name: 'schema',
    },
  }), renderSchemaHuman)
}

function renderSchemaHuman(result: { data?: SchemaCommandData, error: { message: string } | null }): void {
  if (result.error) {
    console.log(pc.red(result.error.message))
    return
  }

  if (!result.data)
    return

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
