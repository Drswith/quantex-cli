# Debugging `quantex upgrade`

`quantex upgrade --json` reports `data.installSource` (`binary`, `npm`, `bun`, `source`, or `unknown`), `data.channel`, `currentVersion`, `latestVersion`, and, when it cannot finish, `data.recoveryHint` with the command to run by hand.

```bash
quantex upgrade --check --json
quantex doctor --json
```

## How each install upgrades

- **Standalone binary** (`install.sh`, `install.ps1`, a downloaded release): reads `manifest.json` from the latest GitHub release (the newest prerelease on the `beta` channel), downloads this platform's archive, checks its SHA-256, swaps the executable while keeping `<executable>.bak`, and runs the new binary's `--version` before removing the backup. On Windows the swap happens right after `quantex` exits.
- **npm / Bun**: runs `npm install -g quantex-cli@<tag>` or `bun add -g quantex-cli@<tag>` (`latest`, or `beta` on the beta channel) against the registry chosen as below, then checks the installed version.
- **Source checkout** (`cargo run`, `target/debug`): not upgraded; rebuild instead.

## `doctor` issues

### `SELF_UPDATE_AVAILABLE`

A newer Quantex is available for this install's source and channel. Run `quantex upgrade`.

### `SELF_AUTO_UPDATE_UNAVAILABLE`

This install cannot upgrade itself (a source checkout, or a source Quantex could not identify). Reinstall from npm, Bun, or a release binary to get `quantex upgrade`.

### `SELF_INSTALLER_MISSING`

Quantex was installed through npm or Bun, but that package manager is no longer on `PATH`. Restore it, or reinstall Quantex from a release binary.

## `UPGRADE_FAILED`

`error.details.kind` says what failed; the binary is left as it was in every case.

| `kind` | Meaning | What to do |
|---|---|---|
| `network` | The manifest or archive could not be downloaded. | Check access to github.com and retry, or download the archive from `recoveryHint`. |
| `checksum` | The archive does not match the manifest. | Retry; a release published mid-download can cause this. Do not install the file by hand. |
| `verify` | The new binary did not report the expected version; the old one was restored. | Retry, then report it with the `--version` output. |
| `permission` | The executable's directory is not writable. | Reinstall into a directory you own (`QUANTEX_INSTALL_DIR`), or rerun with the needed rights. |
| `locked` | Another `quantex upgrade` holds `~/.quantex/locks/self-upgrade.lock`. | Wait for it to finish and retry. |
| `unsupported` | No release asset exists for this platform and channel. | Use a supported platform, or the stable channel. |

`MANUAL_ACTION_REQUIRED` (exit 8) means this install source cannot upgrade itself; `NETWORK_ERROR` (exit 6) with `status: check-unavailable` means the latest version could not be determined.

## Registry for npm and Bun installs

`quantex upgrade` installs from the first of: `QTX_SELF_UPDATE_REGISTRY`, the `selfUpdateRegistry` config value, `BUN_CONFIG_REGISTRY` / `NPM_CONFIG_REGISTRY` (Bun installs), `NPM_CONFIG_REGISTRY` / `npm_config_registry`, the nearest `bunfig.toml` (Bun installs), the nearest `.npmrc` or `~/.npmrc`, and finally `https://registry.npmjs.org`.

`MIRROR_LAG` means that registry installs an older version than npm has. Wait for the mirror, or point `selfUpdateRegistry` / `QTX_SELF_UPDATE_REGISTRY` at another registry.

`STALE_LATEST_VERSION` means the resolved latest is older than the running build, which happens on a stale cache or mirror. Quantex never downgrades; rerun with `--refresh`.

## Channels

`--channel`, then `QUANTEX_UPDATE_CHANNEL`, then the `selfUpdateChannel` config value choose `stable` or `beta`. Stable installs only ever see the latest non-prerelease GitHub release (and the npm `latest` tag). Prereleases are GitHub prereleases and use the npm `beta` tag.
