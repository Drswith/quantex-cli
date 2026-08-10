import { join } from 'node:path'

/**
 * Inputs for the known-directory computation. Passing these explicitly keeps the
 * module free of process globals so the Core observation registry can reuse the
 * exact directory list through its own injected dependencies instead of carrying
 * a second copy of the rule.
 */
export interface ExecutableSearchInputs {
  readonly env: Readonly<NodeJS.ProcessEnv>
  readonly homeDir: string
  readonly platform: NodeJS.Platform
}

const WINDOWS_DEFAULT_EXTENSIONS = ['.exe', '.cmd', '.bat', '.com']

/**
 * Directories that upstream agent installers create and then append to a shell
 * profile. A freshly-installed agent lives here while the running process still
 * carries the pre-install PATH.
 */
export function getKnownAgentInstallDirectories(inputs: ExecutableSearchInputs): string[] {
  const { env, homeDir, platform } = inputs
  const bunRoot = env.BUN_INSTALL?.trim() || join(homeDir, '.bun')
  const cargoRoot = env.CARGO_HOME?.trim() || join(homeDir, '.cargo')
  const denoRoot = env.DENO_INSTALL_ROOT?.trim() || join(homeDir, '.deno')

  const directories =
    platform === 'win32'
      ? [
          join(bunRoot, 'bin'),
          join(cargoRoot, 'bin'),
          join(denoRoot, 'bin'),
          ...(env.APPDATA?.trim() ? [join(env.APPDATA.trim(), 'npm')] : []),
          ...(env.LOCALAPPDATA?.trim() ? [join(env.LOCALAPPDATA.trim(), 'Programs')] : []),
        ]
      : [
          join(homeDir, '.local', 'bin'),
          join(homeDir, 'bin'),
          join(bunRoot, 'bin'),
          join(cargoRoot, 'bin'),
          join(denoRoot, 'bin'),
          join(homeDir, '.npm-global', 'bin'),
        ]

  return [...new Set(directories.filter(Boolean))]
}

/**
 * Candidate file names for one binary. POSIX uses the bare name; Windows appends
 * each executable extension so `agy` can resolve `agy.exe`.
 */
export function getExecutableCandidateNames(binaryName: string, inputs: ExecutableSearchInputs): string[] {
  if (inputs.platform !== 'win32') return [binaryName]

  const configured = inputs.env.PATHEXT?.split(';')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)
  const extensions = configured?.length ? configured : WINDOWS_DEFAULT_EXTENSIONS
  return [binaryName, ...extensions.map(extension => `${binaryName}${extension}`)]
}
