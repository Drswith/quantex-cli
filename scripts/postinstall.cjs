const { existsSync } = require('node:fs')
const { resolve } = require('node:path')
const { pathToFileURL } = require('node:url')

const entryPath = resolve(__dirname, '..', 'dist', 'postinstall.mjs')

if (existsSync(entryPath)) {
  import(pathToFileURL(entryPath).href).catch(() => {})
}
