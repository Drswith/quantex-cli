import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

export interface ReleaseCandidateStep {
  command: string[]
  name: string
}

export function planReleaseCandidateSteps(options: { local: boolean }): ReleaseCandidateStep[] {
  const steps: ReleaseCandidateStep[] = []

  if (!options.local) {
    steps.push({
      command: ['bun', 'run', 'ci:release-publish-contract'],
      name: 'Validate immutable release identity',
    })
  }

  steps.push(
    { command: ['bun', 'run', 'build'], name: 'Build package' },
    { command: ['bun', 'run', 'build:bin'], name: 'Build standalone binaries' },
    { command: ['bun', 'run', 'release:artifacts'], name: 'Generate release artifacts' },
    { command: ['bun', 'run', 'release:smoke'], name: 'Smoke check current platform release binary' },
    { command: ['bun', 'run', 'package:check:core'], name: 'Verify bundled Core package contents' },
    {
      command: ['bun', 'run', 'scripts/release/stage-release-candidate.ts', 'release-candidate'],
      name: 'Stage exact release candidate',
    },
  )

  return steps
}

if (import.meta.main) {
  const local = process.argv.includes('--local')
  const steps = planReleaseCandidateSteps({ local })

  for (const step of steps) {
    console.log(`\n==> ${step.name}`)
    await runChecked(step.command)
  }

  const tarball = await findCandidateTarball('release-candidate/npm')
  console.log('\n==> Verify exact candidate tarball contents')
  await runChecked(['bun', 'run', 'scripts/release/verify-package-distribution.ts', tarball])

  console.log(`\nRelease candidate pipeline completed${local ? ' (local dry-run)' : ''}.`)
}

async function findCandidateTarball(npmDir: string): Promise<string> {
  const tarballs = (await readdir(npmDir)).filter(name => name.endsWith('.tgz')).sort()
  if (tarballs.length !== 1) {
    throw new Error(`Expected exactly one candidate tarball in ${npmDir}, found ${tarballs.length}.`)
  }
  return join(npmDir, tarballs[0]!)
}

async function runChecked(command: string[]): Promise<void> {
  const child = Bun.spawn(command, {
    env: process.env,
    stderr: 'inherit',
    stdout: 'inherit',
  })
  const exitCode = await child.exited
  if (exitCode !== 0) throw new Error(`Release candidate step failed (${exitCode}): ${command.join(' ')}`)
}
