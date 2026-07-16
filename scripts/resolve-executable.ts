import { existsSync } from 'node:fs'
import { delimiter, extname, join } from 'node:path'
import process from 'node:process'

export interface ResolveExecutableOptions {
  path?: string
  pathExt?: string
  platform?: NodeJS.Platform
}

export function resolveExecutableFromPath(command: string, options: ResolveExecutableOptions = {}): string {
  const searchPath = options.path ?? process.env.PATH ?? ''
  const extensions = executableExtensions(
    command,
    options.platform ?? process.platform,
    options.pathExt ?? process.env.PATHEXT,
  )

  for (const directory of searchPath.split(delimiter)) {
    for (const extension of extensions) {
      const candidate = join(directory, `${command}${extension}`)
      if (existsSync(candidate)) return candidate
    }
  }

  throw new Error(`Unable to resolve ${command} from PATH.`)
}

function executableExtensions(command: string, platform: NodeJS.Platform, pathExt?: string): string[] {
  if (platform !== 'win32' || extname(command) !== '') return ['']
  return ['', ...(pathExt ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)]
}
