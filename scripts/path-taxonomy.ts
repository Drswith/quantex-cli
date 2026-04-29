import { appendFile } from 'node:fs/promises'
import process from 'node:process'

export type ChangeScope = 'mixed' | 'process-only' | 'product-impacting' | 'unknown'

export interface ChangeScopeClassification {
  changedFiles: string[]
  processOnly: boolean
  productImpacting: boolean
  productImpactingFiles: string[]
  runTestMatrix: boolean
  scope: ChangeScope
}

export const productImpactingPrefixes = ['src/', 'scripts/', 'skills/quantex-cli/'] as const

export const productImpactingFiles = new Set([
  'package.json',
  'bun.lock',
  'install.sh',
  'install.ps1',
  'tsdown.config.ts',
])

export const processOnlyFiles = new Set([
  'release-please-config.json',
  'release-please-config.beta.json',
  '.release-please-manifest.json',
])

export const processOnlyPrefixes = ['.github/', 'docs/', 'openspec/'] as const

export function isProductImpactingPath(fileName: string): boolean {
  return productImpactingPrefixes.some(prefix => fileName.startsWith(prefix)) || productImpactingFiles.has(fileName)
}

export function isProcessOnlyPath(fileName: string): boolean {
  return processOnlyPrefixes.some(prefix => fileName.startsWith(prefix)) || processOnlyFiles.has(fileName)
}

export function classifyChangedFiles(changedFiles: string[] | null | undefined): ChangeScopeClassification {
  if (!changedFiles || changedFiles.length === 0) {
    return {
      changedFiles: changedFiles ?? [],
      processOnly: false,
      productImpacting: false,
      productImpactingFiles: [],
      runTestMatrix: true,
      scope: 'unknown',
    }
  }

  const productImpactingMatches = changedFiles.filter(isProductImpactingPath)
  const productImpacting = productImpactingMatches.length > 0
  const processOnly = changedFiles.every(isProcessOnlyPath)
  const runTestMatrix = !processOnly
  const scope = processOnly ? 'process-only' : productImpacting ? 'product-impacting' : 'mixed'

  return {
    changedFiles,
    processOnly,
    productImpacting,
    productImpactingFiles: productImpactingMatches,
    runTestMatrix,
    scope,
  }
}

if (import.meta.main) {
  const changedFiles = readChangedFilesFromEnv()
  const diffAvailable = process.env.CHANGED_FILES_AVAILABLE !== 'false'
  const classification = diffAvailable ? classifyChangedFiles(changedFiles) : classifyChangedFiles(undefined)

  await writeGithubOutputs(classification)
  console.log(JSON.stringify(classification))
}

function readChangedFilesFromEnv(): string[] | undefined {
  const rawValue = process.env.CHANGED_FILES_JSON
  if (!rawValue) return undefined

  const parsedValue = JSON.parse(rawValue)
  if (!Array.isArray(parsedValue) || parsedValue.some(value => typeof value !== 'string')) {
    throw new Error('CHANGED_FILES_JSON must be a JSON array of file paths.')
  }

  return parsedValue
}

async function writeGithubOutputs(classification: ChangeScopeClassification): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) return

  const outputLines = [
    `changed_files=${JSON.stringify(classification.changedFiles)}`,
    `process_only=${String(classification.processOnly)}`,
    `product_impacting=${String(classification.productImpacting)}`,
    `product_impacting_files=${JSON.stringify(classification.productImpactingFiles)}`,
    `run_test_matrix=${String(classification.runTestMatrix)}`,
    `scope=${classification.scope}`,
  ]

  await appendFile(outputPath, `${outputLines.join('\n')}\n`)
}
