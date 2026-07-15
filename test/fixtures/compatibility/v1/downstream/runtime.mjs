import {
  createSuccessResult,
  getAgentByNameOrAlias,
  getExitCodeForResult,
  getSelfVersion,
} from 'quantex-cli'

const result = createSuccessResult({
  action: 'downstream-runtime',
  data: { compatible: true },
})

process.stdout.write(
  `${JSON.stringify({
    agent: getAgentByNameOrAlias('codex')?.name,
    exitCode: getExitCodeForResult(result),
    ok: result.ok,
    version: getSelfVersion(),
  })}\n`,
)
