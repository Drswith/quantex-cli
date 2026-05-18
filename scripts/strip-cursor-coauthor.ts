import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

const cursorCoAuthorPattern = /^Co-authored-by:\s*Cursor(?: Agent)? <cursoragent@cursor\.com>\s*$/i
const cursorMadeWithPattern = /^Made-with:\s*Cursor\s*$/i

export function stripCursorAttributionTrailers(message: string): string {
  const lines = message.split('\n')
  const filteredLines = lines.filter(line => {
    const trimmedLine = line.trim()
    return !cursorCoAuthorPattern.test(trimmedLine) && !cursorMadeWithPattern.test(trimmedLine)
  })

  return filteredLines.join('\n')
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
