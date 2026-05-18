import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

const cursorCoAuthorPattern = /^Co-authored-by:\s*Cursor(?: Agent)? <cursoragent@cursor\.com>\s*$/i
const cursorMadeWithPattern = /^Made-with:\s*Cursor\s*$/i

/** Lines Git commonly treats as trailers (suffix walk only; avoids stripping body examples). */
const gitTrailerLinePattern =
  /^(?:Co-authored-by|Signed-off-by|Acked-by|Reviewed-by|Tested-by|Cc|Made-with|Change-Id)\s*:/i

function isGitTrailerLine(line: string): boolean {
  return gitTrailerLinePattern.test(line.trim())
}

export function stripCursorAttributionTrailers(message: string): string {
  const lines = message.split('\n')
  let i = lines.length - 1
  while (i >= 0 && lines[i].trim() === '') {
    i--
  }
  if (i < 0) {
    return message
  }
  if (!isGitTrailerLine(lines[i])) {
    return message
  }

  const trailerEnd = lines.length
  let trailerStart = i
  while (--i >= 0) {
    const line = lines[i]
    if (line.trim() === '') {
      trailerStart = i
      continue
    }
    if (isGitTrailerLine(line)) {
      trailerStart = i
      continue
    }
    break
  }

  const head = lines.slice(0, trailerStart)
  const trailerZone = lines.slice(trailerStart, trailerEnd)
  const filteredZone = trailerZone.filter(line => {
    const trimmedLine = line.trim()
    if (trimmedLine === '') {
      return true
    }
    return !cursorCoAuthorPattern.test(trimmedLine) && !cursorMadeWithPattern.test(trimmedLine)
  })

  return [...head, ...filteredZone].join('\n')
}

if (import.meta.main) {
  const messageFilePath = process.argv[2]

  if (!messageFilePath) {
    console.error('Expected the commit message file path as the first argument.')
    process.exit(1)
  }

  const originalMessage = readFileSync(messageFilePath, 'utf8')
  const sanitizedMessage = stripCursorAttributionTrailers(originalMessage)

  if (sanitizedMessage !== originalMessage) {
    writeFileSync(messageFilePath, sanitizedMessage, 'utf8')
    console.log('Removed Cursor attribution trailer from commit message.')
  }
}
