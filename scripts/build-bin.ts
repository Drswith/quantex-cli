import process from 'node:process'

const targets = [
  { target: 'bun-linux-x64-modern' as const, outfile: 'dist/bin/quantex-linux-x64' },
  { target: 'bun-linux-arm64' as const, outfile: 'dist/bin/quantex-linux-arm64' },
  { target: 'bun-darwin-arm64' as const, outfile: 'dist/bin/quantex-darwin-arm64' },
  { target: 'bun-darwin-x64' as const, outfile: 'dist/bin/quantex-darwin-x64' },
  { target: 'bun-windows-x64-modern' as const, outfile: 'dist/bin/quantex-windows-x64' },
  { target: 'bun-windows-arm64' as const, outfile: 'dist/bin/quantex-windows-arm64' },
]

async function buildBin(): Promise<void> {
  const filter = process.argv[2]
  const filtered = filter
    ? targets.filter(t => t.target.includes(filter))
    : targets

  if (filtered.length === 0) {
    console.error('No matching targets')
    process.exit(1)
  }

  console.log(`Building ${filtered.length} targets...\n`)

  for (const { target, outfile } of filtered) {
    console.log(`Building ${target}...`)
    const result = await Bun.build({
      entrypoints: ['./src/cli.ts'],
      compile: { target, outfile },
      minify: true,
    })

    if (!result.success) {
      console.error(`  ❌ ${target} failed:`)
      for (const log of result.logs)
        console.error(`    ${log}`)
    }
    else {
      console.log(`  ✅ ${outfile}`)
    }
  }
}

buildBin()
