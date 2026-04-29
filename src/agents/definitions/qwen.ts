import type { AgentDefinition } from '../types'
import { brewInstall, bunInstall, npmInstall, scriptInstall } from '../methods'

export const qwen: AgentDefinition = {
  name: 'qwen',
  lookupAliases: ['qwen-code'],
  displayName: 'Qwen Code',
  homepage: 'https://qwenlm.github.io/qwen-code-docs/',
  packages: {
    npm: '@qwen-code/qwen-code',
  },
  binaryName: 'qwen',
  platforms: {
    windows: [
      scriptInstall(
        'curl -fsSL -o %TEMP%\\install-qwen.bat https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.bat && %TEMP%\\install-qwen.bat',
      ),
      bunInstall(),
      npmInstall(),
    ],
    macos: [
      scriptInstall(
        'curl -fsSL https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.sh | bash',
      ),
      bunInstall(),
      npmInstall(),
      brewInstall('qwen-code'),
    ],
    linux: [
      scriptInstall(
        'curl -fsSL https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.sh | bash',
      ),
      bunInstall(),
      npmInstall(),
      brewInstall('qwen-code'),
    ],
  },
}
