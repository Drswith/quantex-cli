import { toJSONSchema, z } from 'zod'

const nonEmptyStringSchema = z.string().min(1)
const commandSchema = z.array(nonEmptyStringSchema).min(1)

export const platformSchema = z.enum(['windows', 'macos', 'linux'])
export const managedInstallTypeSchema = z.enum(['bun', 'npm', 'brew', 'cargo', 'deno', 'mise', 'pip', 'uv', 'winget'])
export const packageTargetKindSchema = z.enum(['package', 'cask', 'id'])

const baseInstallMethodSchema = {
  binaryName: nonEmptyStringSchema.optional(),
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

const providerProbeSchema = z.enum(['executable-presence', 'installed-version', 'package-presence', 'target-version'])
const providerProbesSchema = z
  .array(providerProbeSchema)
  .min(1)
  .refine(probes => new Set(probes).size === probes.length, { message: 'candidate probes must be unique' })
  .optional()
const executableEffectSchema = z
  .object({
    command: commandSchema,
    kind: z.literal('executable'),
  })
  .strict()
const shellScriptEffectSchema = z
  .object({
    command: nonEmptyStringSchema,
    kind: z.literal('shell-script'),
  })
  .strict()
const executionEffectSchema = z.discriminatedUnion('kind', [executableEffectSchema, shellScriptEffectSchema])

function providerTargetSchema<Kind extends 'binary' | 'cask' | 'formula' | 'id' | 'package' | 'script' | 'tool'>(
  kind: Kind,
  options: { effect?: boolean } = {},
) {
  return z
    .object({
      arguments: z.array(nonEmptyStringSchema).min(1).optional(),
      binaryName: nonEmptyStringSchema.optional(),
      ...(options.effect ? { effect: executionEffectSchema } : {}),
      id: nonEmptyStringSchema,
      kind: z.literal(kind),
    })
    .strict()
}

function normalizedCandidate<Provider extends string, TargetSchema extends z.ZodType>(
  provider: Provider,
  target: TargetSchema,
) {
  return z
    .object({
      legacy: z
        .object({
          packageNameInMethod: z.literal(true).optional(),
        })
        .strict()
        .optional(),
      probes: providerProbesSchema,
      provider: z.literal(provider),
      target,
    })
    .strict()
}

export const normalizedInstallCandidateSchema = z.discriminatedUnion('provider', [
  normalizedCandidate('bun', providerTargetSchema('package')),
  normalizedCandidate('npm', providerTargetSchema('package')),
  normalizedCandidate('brew', z.union([providerTargetSchema('formula'), providerTargetSchema('cask')])),
  normalizedCandidate('cargo', providerTargetSchema('package')),
  normalizedCandidate('deno', providerTargetSchema('tool')),
  normalizedCandidate('mise', providerTargetSchema('tool')),
  normalizedCandidate('pip', providerTargetSchema('package')),
  normalizedCandidate('uv', providerTargetSchema('tool')),
  normalizedCandidate('winget', providerTargetSchema('id')),
  normalizedCandidate('script', providerTargetSchema('script', { effect: true })),
  normalizedCandidate('binary', providerTargetSchema('binary', { effect: true })),
])

export const catalogSourceInstallCandidateSchema = z.union([installMethodSchema, normalizedInstallCandidateSchema])

const catalogSourcePlatformsSchema = z
  .object({
    linux: z.array(catalogSourceInstallCandidateSchema).min(1).optional(),
    macos: z.array(catalogSourceInstallCandidateSchema).min(1).optional(),
    windows: z.array(catalogSourceInstallCandidateSchema).min(1).optional(),
  })
  .strict()
  .refine(platforms => Object.values(platforms).some(Boolean), {
    message: 'platforms must include at least one supported platform',
  })

export const agentPackageMetadataSchema = z
  .object({
    cargo: nonEmptyStringSchema.optional(),
    deno: nonEmptyStringSchema.optional(),
    mise: nonEmptyStringSchema.optional(),
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

export const catalogSourceEntrySchema = agentCatalogEntrySchema
  .extend({ platforms: catalogSourcePlatformsSchema })
  .strict()
export const catalogSourceSchema = z.array(catalogSourceEntrySchema).min(1)

export const agentCatalogSchema = z.array(agentCatalogEntrySchema).min(1)

export type AgentCatalogEntry = z.infer<typeof agentCatalogEntrySchema>
export type AgentCatalogData = z.infer<typeof agentCatalogSchema>
export type CatalogSourceEntry = z.infer<typeof catalogSourceEntrySchema>
export type NormalizedInstallCandidate = z.infer<typeof normalizedInstallCandidateSchema>

export const agentCatalogJsonSchema = {
  ...toJSONSchema(agentCatalogSchema),
  $id: 'https://github.com/Drswith/quantex-cli/schemas/agent-catalog.schema.json',
  title: 'Quantex Supported Agent Catalog',
}
