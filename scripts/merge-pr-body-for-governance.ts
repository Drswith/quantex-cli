import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

const appendixPath = '.github/pr-body-governance-appendix.md'

function mergePrBodyForGovernance(prBody: string): string {
  if (!existsSync(appendixPath)) return prBody

  const appendix = readFileSync(appendixPath, 'utf8').trimEnd()
  if (!appendix) return prBody

  const trimmedPr = prBody.trimEnd()
  return trimmedPr ? `${trimmedPr}\n\n${appendix}\n` : `${appendix}\n`
}

export { mergePrBodyForGovernance }

if (import.meta.main) {
  const outputPath = process.argv[2]
  if (!outputPath) {
    console.error('Usage: bun run scripts/merge-pr-body-for-governance.ts <output-file>')
    process.exit(1)
  }

  const merged = mergePrBodyForGovernance(process.env.PR_BODY || '')
  writeFileSync(outputPath, merged, 'utf8')
}
