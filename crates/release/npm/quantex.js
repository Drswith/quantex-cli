#!/usr/bin/env node
// Runs the native quantex binary from the platform package npm installed alongside
// this one (an optional dependency selected by `os` and `cpu`).
'use strict'

const { spawn } = require('node:child_process')

const key = `${process.platform}-${process.arch}`
const executable = process.platform === 'win32' ? 'quantex.exe' : 'quantex'
const platformPackage = `quantex-cli-${key}`

let binary
try {
  binary = require.resolve(`${platformPackage}/bin/${executable}`)
} catch {
  process.stderr.write(
    `quantex-cli: no native binary for ${key}; the optional dependency ${platformPackage} is not installed.\n` +
      'Reinstall without --omit=optional / --no-optional, or install the standalone binary:\n' +
      'https://github.com/Drswith/quantex-cli#install\n',
  )
  process.exit(1)
}

const child = spawn(binary, process.argv.slice(2), { stdio: 'inherit' })

// The terminal already delivers Ctrl-C to the whole foreground process group, so
// SIGINT is only kept from ending this launcher early. Signals aimed at the launcher
// alone are passed on.
process.on('SIGINT', () => {})
for (const signal of ['SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    child.kill(signal)
  })
}

child.on('error', error => {
  process.stderr.write(`quantex-cli: failed to start ${binary}: ${error.message}\n`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.removeAllListeners(signal)
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
