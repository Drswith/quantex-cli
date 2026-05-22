import { writeFile } from 'node:fs/promises'
import { agentCatalogJsonSchema } from '../src/agents/schema'

const schemaPath = new URL('../src/agents/catalog.schema.json', import.meta.url)

await writeFile(schemaPath, `${JSON.stringify(agentCatalogJsonSchema, null, 2)}\n`)
