import { toJSONSchema, z } from 'zod'

const nonEmptyStringSchema = z.string().min(1)
const commandSchema = z.array(nonEmptyStringSchema).min(1)

export const platformSchema = z.enum(['windows', 'macos', 'linux'])
export const managedInstallTypeSchema = z.enum(['bun', 'npm', 'brew', 'cargo', 'pip', 'uv', 'winget'])
export const packageTargetKindSchema = z.enum(['package', 'cask', 'id'])

const baseInstallMethodSchema = {
  packageInstallArgs: z.array(nonEmptyStringSchema).min(1).optional(),
  packageName: nonEmptyStringSchema.optional(),
  packageTargetKind: packageTargetKindSchema.optional(),
}

export const managedInstallMethodSchema = z
  .object({
    ...baseInstallMethodSchema,
    type: managedInstallTypeSchema,
  })
  .strict()

export const scriptInstallMethodSchema = z
  .object({
    ...baseInstallMethodSchema,
    command: nonEmptyStringSchema,
    type: z.literal('script'),
  })
  .strict()

export const binaryInstallMethodSchema = z
  .object({
    ...baseInstallMethodSchema,
    command: nonEmptyStringSchema,
    type: z.literal('binary'),
  })
  .strict()

export const installMethodSchema = z.discriminatedUnion('type', [
  managedInstallMethodSchema,
  scriptInstallMethodSchema,
  binaryInstallMethodSchema,
])

export const agentPackageMetadataSchema = z
  .object({
    cargo: nonEmptyStringSchema.optional(),
    npm: nonEmptyStringSchema.optional(),
    pip: nonEmptyStringSchema.optional(),
    uv: nonEmptyStringSchema.optional(),
  })
  .strict()
  .refine(packages => Object.values(packages).some(Boolean), {
    message: 'packages must include at least one package identifier',
  })

export const agentSelfUpdateSchema = z
  .object({
    command: commandSchema,
    fallbackCommands: z.array(commandSchema).min(1).optional(),
    versionAfter: z.enum(['same-process', 'respawn']).optional(),
  })
  .strict()

export const agentVersionProbeSchema = z
  .object({
    command: commandSchema.optional(),
  })
  .strict()
  .refine(probe => probe.command !== undefined, {
    message: 'versionProbe must include a serializable command',
  })

export const agentPlatformsSchema = z
  .object({
    linux: z.array(installMethodSchema).min(1).optional(),
    macos: z.array(installMethodSchema).min(1).optional(),
    windows: z.array(installMethodSchema).min(1).optional(),
  })
  .strict()
  .refine(platforms => Object.values(platforms).some(Boolean), {
    message: 'platforms must include at least one supported platform',
  })

export const agentCatalogEntrySchema = z
  .object({
    binaryName: nonEmptyStringSchema,
    displayName: nonEmptyStringSchema,
    homepage: z.url().startsWith('https://'),
    lookupAliases: z.array(nonEmptyStringSchema).min(1).optional(),
    name: nonEmptyStringSchema.regex(/^[a-z0-9][a-z0-9-]*$/),
    packages: agentPackageMetadataSchema.optional(),
    platforms: agentPlatformsSchema,
    selfUpdate: agentSelfUpdateSchema.optional(),
    versionProbe: agentVersionProbeSchema.optional(),
  })
  .strict()

export const agentCatalogSchema = z.array(agentCatalogEntrySchema).min(1)

export type AgentCatalogEntry = z.infer<typeof agentCatalogEntrySchema>
export type AgentCatalogData = z.infer<typeof agentCatalogSchema>

export const agentCatalogJsonSchema = {
  ...toJSONSchema(agentCatalogSchema),
  $id: 'https://github.com/Drswith/quantex-cli/schemas/agent-catalog.schema.json',
  title: 'Quantex Supported Agent Catalog',
}
