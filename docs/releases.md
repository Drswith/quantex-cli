# Releases

Quantex releases are prepared by release-please Release PRs.

The repository now keeps a source-controlled [CHANGELOG.md](../CHANGELOG.md). A Release PR updates that changelog together with `.release-please-manifest.json`, `package.json`, `packages/core/package.json`, the root's exact `@quantex/core` development dependency, and `src/generated/build-meta.ts` before publication.

Published release pages and attached binaries live in [GitHub Releases](https://github.com/Drswith/quantex-cli/releases).

## Coordinated CLI and Core publication

Starting with the first Core-era release, one version and repository tag coordinate two npm packages. Release automation validates both tarballs, publishes or verifies Core first, publishes or verifies `quantex-cli` second, and uploads standalone binaries only after both npm versions are visible. Registry errors other than a conclusive 404 stop publication. Releases whose source predates `packages/core/package.json` remain CLI-only and are never backfilled with Core.

`@quantex/core` is still a provisional, unpublished name. Do not enable its release gate until an authenticated maintainer has confirmed control of the `@quantex` scope.

## One-time Core bootstrap

npm requires a package to exist before its trusted publisher can be configured. The first Core release therefore stops before publishing either repository-owned npm package and requires this one-time operator sequence:

1. Check out the exact release commit and rerun `bun install --frozen-lockfile`, `bun run build:core`, and `bun run package:check:core`.
2. Pack `packages/core` and publish that validated first version with an authorized npm maintainer account and 2FA using public access and the release channel's npm tag.
3. Configure `release.yml` as the package's GitHub Actions trusted publisher for `Drswith/quantex-cli`, with `npm publish` permission.
4. Set the repository variable `CORE_NPM_TRUSTED_PUBLISHING_READY=true` only after the trust configuration is complete.
5. Rerun the Release workflow. It verifies the existing Core version, publishes the still-missing CLI version, verifies both, and then closes the binary artifacts.

Do not use the readiness variable to claim ownership or bypass the first publication. If package identity, registry state, or trusted publishing is uncertain, leave the gate disabled and resolve it before retrying.
