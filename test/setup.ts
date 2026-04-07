import { readFileSync, writeFileSync } from 'node:fs'

if (!globalThis.Bun) {
  (globalThis as any).Bun = {
    spawn: (..._args: any[]) => {
      throw new Error('Bun.spawn not available in vitest')
    },
    write: async (path: string, data: any) => {
      const content = typeof data === 'string' ? data : new TextDecoder().decode(data)
      writeFileSync(path as string, content)
    },
    file: (path: string) => ({
      text: () => Promise.resolve(readFileSync(path, 'utf-8')),
      json: () => Promise.resolve(JSON.parse(readFileSync(path, 'utf-8'))),
    }),
  }
}
