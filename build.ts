import process from 'node:process'

const targets: { entry: string, outdir: string, label: string }[] = [
  { entry: 'src/index.ts', outdir: 'dist', label: 'Library' },
  { entry: 'src/cli.ts', outdir: 'dist', label: 'CLI' },
]

async function build(): Promise<void> {
  const results = await Promise.all(
    targets.map(async ({ entry, outdir, label }) => {
      const result = await Bun.build({
        entrypoints: [entry],
        outdir,
        target: 'bun',
        format: 'esm',
        sourcemap: 'external',
        minify: false,
      })

      if (!result.success) {
        console.error(`❌ ${label} build failed:`)
        for (const log of result.logs)
          console.error(`  ${log}`)
        process.exit(1)
      }

      return { label, outputs: result.outputs }
    }),
  )

  for (const { label, outputs } of results) {
    console.error(`✅ ${label}:`)
    for (const output of outputs)
      console.error(`   ${output.path}`)
  }
}

build()
