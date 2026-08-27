import { readFileSync } from 'node:fs'
import process from 'node:process'
// Release-please's own parser is the only authority on whether a declared version
// override will actually take effect. Regex checks over the body are heuristics; this
// runs the real code path, including the pull-request-body message replacement.
import { parseConventionalCommits } from 'release-please/build/src/commit.js'

export interface ReleaseAsVerificationInput {
  body: string
  message: string
}

export interface ReleaseAsVerification {
  /** Versions release-please would apply, in the order it found them. */
  appliedVersions: string[]
  /** Version the body asks for, if any. */
  declaredVersion: string | undefined
  /** Number of conventional commits release-please derived. Zero means the commit is dropped. */
  parsedCommitCount: number
}

const silentLogger = { debug() {}, error() {}, info() {}, trace() {}, warn() {} }

export function verifyReleaseAs(input: ReleaseAsVerificationInput): ReleaseAsVerification {
  const parsed = parseConventionalCommits(
    [
      {
        files: [],
        message: input.message,
        pullRequest: {
          baseBranchName: 'main',
          body: input.body,
          files: [],
          headBranchName: 'verification',
          labels: [],
          number: 0,
          title: 'verification',
        },
        sha: 'verification',
      },
    ],
    silentLogger,
  )

  return {
    appliedVersions: parsed
      .flatMap(commit => commit.notes)
      .filter(note => /release[- ]as/i.test(note.title))
      .map(note => note.text.trim()),
    declaredVersion: input.body.match(/^release-as:\s*v?(\d+\.\d+\.\d+)\s*$/im)?.[1],
    parsedCommitCount: parsed.length,
  }
}

export function describeVerification(result: ReleaseAsVerification): string[] {
  if (!result.declaredVersion) return []

  if (result.parsedCommitCount === 0) {
    return [
      `The body declares Release-As ${result.declaredVersion}, but release-please parses no commit at all from this pull request.`,
      'That happens when the text it parses is not a conventional commit, and the commit is then dropped from the release entirely.',
    ]
  }

  if (!result.appliedVersions.includes(result.declaredVersion)) {
    return [
      `The body declares Release-As ${result.declaredVersion}, but release-please would not apply it.`,
      'It replaces the commit message with the text inside the override block, so a footer outside that block is never parsed.',
    ]
  }

  return []
}

if (import.meta.main) {
  const bodyFile = process.argv[process.argv.indexOf('--body-file') + 1]
  if (!bodyFile || bodyFile.startsWith('--')) throw new Error('Usage: --body-file <path> [--message-file <path>]')
  const messageIndex = process.argv.indexOf('--message-file')
  const message = messageIndex === -1 ? '' : readFileSync(process.argv[messageIndex + 1]!, 'utf8')

  const result = verifyReleaseAs({ body: readFileSync(bodyFile, 'utf8'), message })
  const issues = describeVerification(result)

  if (issues.length > 0) {
    console.error('Release-As verification failed:\n')
    for (const issue of issues) console.error(`- ${issue}`)
    process.exit(1)
  }

  console.log(
    result.declaredVersion
      ? `Release-As verification passed: release-please would release ${result.declaredVersion}.`
      : 'Release-As verification skipped: the body declares no version override.',
  )
}
