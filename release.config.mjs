export default {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/npm',
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'bun run build && bun run build:bin && bun run release:artifacts && bun run release:smoke',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          { path: 'dist/bin/*' },
        ],
        successComment: false,
        failComment: false,
        releasedLabels: false,
      },
    ],
  ],
}
