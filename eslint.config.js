// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    markdown: false,
    ignores: [
      'README.md',
    ],
  },
  {
    files: ['src/commands/**', 'src/cli.ts'],
    rules: {
      'no-console': 'off',
    },
  },
)
