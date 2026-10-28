# Releasing quantex

Releases are built and published by [`.github/workflows/release.yml`](../../.github/workflows/release.yml) when a `v*` tag is pushed. The workflow file name matters: npm trusted publishing for `quantex-cli` is bound to `Drswith/quantex-cli` and `release.yml`.

## Cutting a release

1. Set `version` in the root `Cargo.toml` (`[workspace.package]`) to the release version and run `cargo build` so `Cargo.lock` follows. A version with a `-` (for example `2.0.0-alpha.1`) is a prerelease.
2. Add a `## [<version>]` section to `CHANGELOG.md`. The workflow uses it as the release notes.
3. Merge, then tag the merge commit and push the tag:

   ```bash
   git tag v2.0.0-alpha.1
   ```

   ```bash
   git push origin v2.0.0-alpha.1
   ```

The workflow refuses a tag that does not match the workspace version.

## What the workflow does

| Job | Work |
|---|---|
| `prepare` | Checks the tag against the workspace version; decides prerelease and the npm dist-tag (`next` for prereleases, `latest` otherwise). |
| `build` | Builds five targets: `x86_64` / `aarch64` Linux (static musl), `aarch64` / `x86_64` macOS, `x86_64` Windows (static CRT). Native targets run `--version` and `commands --json`. |
| `package` | `quantex-release package` writes one archive per binary, `SHA256SUMS.txt`, and `manifest.json` in the v1.13.6 format. `quantex-release npm` writes the npm packages, which are then packed. |
| `verify` | On Linux, macOS, and Windows: `install.sh` / `install.ps1` install the release from a local server; the npm tarballs install into a temporary prefix and report `installSource: npm`; on Linux and macOS a real v1.13.6 binary upgrades itself to the release ([`scripts/release/v1-upgrade-check.sh`](../../scripts/release/v1-upgrade-check.sh)). |
| `publish` | Creates the GitHub release with the seven assets (prereleases are marked prerelease and never "latest"), then publishes the platform packages and finally `quantex-cli`. Already-published versions are skipped, so a failed run can be re-run with `workflow_dispatch` and the tag. |

Pushes and pull requests that touch the pipeline (`release.yml`, `crates/release`, `scripts/release`, the install scripts) run every job except `publish`.

## Release assets

v1 installs upgrade by downloading `https://github.com/Drswith/quantex-cli/releases/latest/download/<asset>`, so these names and formats are fixed:

- `quantex-darwin-arm64.tar.gz`, `quantex-darwin-x64.tar.gz`, `quantex-linux-arm64.tar.gz`, `quantex-linux-x64.tar.gz`: a gzip-compressed ustar archive holding exactly one regular file, named like the archive without `.tar.gz`.
- `quantex-windows-x64.exe.zip`: a zip holding exactly `quantex-windows-x64.exe`, stored or deflated, without data descriptors.
- `SHA256SUMS.txt`: `<sha256>  <archive>` per line, sorted by name.
- `manifest.json`: `{ assets: [{ arch, checksum, downloadUrl, name, platform, size }], channel, version }`, with Node platform names (`darwin`, `linux`, `win32`).

The beta channel in v1 picks the newest GitHub prerelease, so v1 installs set to `beta` are offered Rust prereleases; stable installs are not.

On Windows, v1.13.x downloads and unpacks the release but never replaces itself: the PowerShell helper that should swap the executable after v1 exits is ended together with v1, even between two v1 releases. The `verify` job therefore checks that v1 unpacks the Windows release, and Rust's own delayed replacement is covered by `tests/contract/tests/upgrade_windows.rs`. Windows users on a 1.x standalone binary move to 2.x by rerunning `install.ps1`.

## npm packages

- `quantex-cli`: `bin/quantex.js` (both `quantex` and `qtx`) runs the binary from the matching platform package. It is listed in `optionalDependencies` at the same version.
- `quantex-cli-darwin-arm64`, `quantex-cli-darwin-x64`, `quantex-cli-linux-arm64`, `quantex-cli-linux-x64`, `quantex-cli-win32-x64`: `bin/quantex[.exe]`, selected by `os` and `cpu`.

A binary under `node_modules/quantex-cli*` reports `installSource: npm` and upgrades with `npm install -g quantex-cli@<tag>`.

### One-time setup for the platform packages

npm trusted publishing can only be configured for a package that already exists, and the five platform packages are new. Before the first release, either:

- add a repository secret `NPM_TOKEN` holding a granular npm token allowed to publish new packages (the workflow passes it as `NODE_AUTH_TOKEN`), or
- publish each platform package once by hand, then configure trusted publishing for it (repository `Drswith/quantex-cli`, workflow `release.yml`).

After every platform package has trusted publishing configured, `NPM_TOKEN` can be removed. If a platform package fails to publish, the workflow stops before publishing `quantex-cli`, so no release points at missing binaries.

## Checking a release locally

```bash
cargo build --release -p quantex
```

Copy `target/release/quantex` into a directory as the binary for this platform (for example `quantex-darwin-arm64`), add placeholder files for the other four names, then:

```bash
cargo run -p quantex-release -- package --version <version> --binaries <dir> --out <assets>
```

```bash
sh scripts/release/v1-upgrade-check.sh <assets> <path-to-v1.13.6-binary> <version>
```
