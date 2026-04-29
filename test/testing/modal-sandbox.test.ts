import { describe, expect, it } from 'vitest'
import {
  buildContainerSandboxInvocation,
  DEFAULT_CONTAINER_SANDBOX_IMAGE,
  DEFAULT_CONTAINER_SANDBOX_SMOKE_ARGS,
  getMissingDockerCliMessage,
} from '../../src/testing/container-sandbox'
import {
  buildModalSandboxInvocation,
  DEFAULT_MODAL_SANDBOX_IMAGE,
  DEFAULT_MODAL_SANDBOX_SMOKE_ARGS,
  getMissingModalCliMessage,
  MODAL_REMOTE_EXIT_CODE_MARKER,
  parseModalRemoteExitCode,
} from '../../src/testing/modal-sandbox'

describe('buildModalSandboxInvocation', () => {
  it('builds the default modal shell invocation', () => {
    const invocation = buildModalSandboxInvocation({
      repoRoot: '/tmp/quantex-cli',
    })

    expect(invocation.image).toBe(DEFAULT_MODAL_SANDBOX_IMAGE)
    expect(invocation.mountPath).toBe('/mnt/quantex-cli')
    expect(invocation.smokeArgs).toEqual(DEFAULT_MODAL_SANDBOX_SMOKE_ARGS)
    expect(invocation.command).toEqual([
      'modal',
      'shell',
      '--image',
      DEFAULT_MODAL_SANDBOX_IMAGE,
      '--add-local',
      '/tmp/quantex-cli',
      '--cmd',
      expect.stringContaining('/bin/bash -lc'),
    ])
    expect(invocation.remoteCommand).toContain("cp -R '/mnt/quantex-cli' /tmp/quantex-work")
    expect(invocation.remoteCommand).toContain('bun install --frozen-lockfile --ignore-scripts --no-progress')
    expect(invocation.remoteCommand).toContain('bun run scripts/lifecycle-smoke.ts')
    expect(invocation.remoteCommand).toContain(MODAL_REMOTE_EXIT_CODE_MARKER)
  })

  it('forwards explicit smoke agent arguments into the remote command', () => {
    const invocation = buildModalSandboxInvocation({
      repoRoot: '/tmp/quantex-cli',
      smokeArgs: ['pi', 'opencode'],
    })

    expect(invocation.smokeArgs).toEqual(['pi', 'opencode'])
    expect(invocation.remoteCommand).toContain("bun run scripts/lifecycle-smoke.ts 'pi' 'opencode'")
  })
})

describe('parseModalRemoteExitCode', () => {
  it('returns the last remote exit-code marker', () => {
    expect(
      parseModalRemoteExitCode(`first\n${MODAL_REMOTE_EXIT_CODE_MARKER}=1\nretry\n${MODAL_REMOTE_EXIT_CODE_MARKER}=0`),
    ).toBe(0)
  })

  it('returns undefined when the remote marker is missing', () => {
    expect(parseModalRemoteExitCode('remote command output without marker')).toBeUndefined()
  })
})

describe('getMissingModalCliMessage', () => {
  it('explains how to install and authenticate modal', () => {
    expect(getMissingModalCliMessage()).toContain('modal setup')
    expect(getMissingModalCliMessage()).toContain('pip install modal')
  })
})

describe('buildContainerSandboxInvocation', () => {
  it('builds the default docker invocation', () => {
    const invocation = buildContainerSandboxInvocation({
      repoRoot: '/tmp/quantex-cli',
    })

    expect(invocation.image).toBe(DEFAULT_CONTAINER_SANDBOX_IMAGE)
    expect(invocation.mountPath).toBe('/mnt/quantex-cli')
    expect(invocation.smokeArgs).toEqual(DEFAULT_CONTAINER_SANDBOX_SMOKE_ARGS)
    expect(invocation.command).toEqual([
      'docker',
      'run',
      '--rm',
      '--volume',
      '/tmp/quantex-cli:/mnt/quantex-cli',
      '--workdir',
      '/mnt/quantex-cli',
      '--env',
      'HOME=/tmp/quantex-home',
      '--env',
      'QTX_ISOLATION_AGENTS',
      '--env',
      'QTX_ISOLATION_SCENARIOS',
      DEFAULT_CONTAINER_SANDBOX_IMAGE,
      '/bin/bash',
      '-lc',
      expect.stringContaining('set -euo pipefail'),
    ])
  })
})

describe('getMissingDockerCliMessage', () => {
  it('explains how to install docker', () => {
    expect(getMissingDockerCliMessage()).toContain('Docker')
    expect(getMissingDockerCliMessage()).toContain('test:container')
  })
})
