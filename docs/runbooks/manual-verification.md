# Manual checks before a release

The contract tests compare every command with v1.13.6, but they drive fake package managers and fake agents. Before tagging, run the build on a real machine with real package managers and agents for about fifteen minutes. These checks are for macOS and Linux; on Windows, the release workflow's `verify` job and `install.ps1` cover installation.

## 1. Build a sandbox

```bash
sh scripts/release/sandbox.sh /tmp/qtx-sandbox
```

The script builds the release binary, packages it the way the release workflow does, and installs it with `install.sh` from those local assets. In the sandbox, HOME, the npm global prefix, and the Bun directory all live under `/tmp/qtx-sandbox/home`, so installs and `~/.quantex` changes stay there. If the `quantex` on your PATH is 1.x (or `QUANTEX_V1_BIN` points to one), the sandbox also gets `quantex-v1` and a `compare` script.

```bash
/tmp/qtx-sandbox/shell
```

This opens a shell inside the sandbox. Exit it to leave, and delete `/tmp/qtx-sandbox` when you are done.

## 2. In the sandbox shell

Reasonix (`reasonix`, about 20 KB, npm only) is a quick agent to install and remove.

| Check | Command | Expected |
|---|---|---|
| Version and help | `quantex --version`, `qtx --version`, `quantex --help`, `quantex install --help` | The release version; usage on stdout, exit 0 |
| Environment | `quantex doctor` | `Quantex: <version> (binary)`, npm and bun available, no issues |
| Catalog | `quantex list`, `quantex info reasonix` | Every catalog agent; Reasonix not installed, with its latest version |
| Install | `quantex install reasonix`, then `reasonix --version` | Installed through npm; `~/.quantex/state.json` records it |
| Install again | `quantex install reasonix` | "already installed" on stderr, exit 0 |
| Launch | `quantex reasonix --version`, `qtx exec reasonix -- --version` | The agent's own output and exit code |
| Launch, JSON | `quantex exec reasonix --json -- --version` | Nothing on stdout; the agent's output on stderr |
| Update | `npm i -g reasonix@<previous version>`, `quantex update reasonix --dry-run`, `quantex update reasonix`, `quantex update --all` | "Would update … old -> new", then updated, then up to date |
| Uninstall | `quantex uninstall reasonix --dry-run`, `quantex uninstall reasonix` | Dry run changes nothing; then `reasonix` is gone |
| Prompt | `quantex reasonix` while it is not installed | Asks "Would you like to install it? (Y/n)"; answering n exits 1 |
| Ctrl-C | Install an interactive agent (for example `quantex install pi`), run `quantex pi`, press Ctrl-C | The agent handles Ctrl-C, quantex exits with the agent's code, and the terminal is usable |
| Shared home | `quantex-v1 install reasonix`, `quantex list`; then `quantex uninstall reasonix`, `quantex-v1 list` | Each build sees what the other one did |
| Idempotency | `quantex install reasonix --idempotency-key k1 --json` twice, then `quantex-v1 install reasonix --idempotency-key k1 --json` | The repeats return at once without running npm; v1's reply still has the 2.x `meta.version` because it replays the 2.x record |
| Argument errors | `quantex instal reasonix; echo $?`, `quantex list --bogus --json; echo $?` | Exit 2; the second prints an `INVALID_ARGUMENT` envelope on stdout |
| Other errors | `quantex install nope --json; echo $?`, `quantex config set defaultPackageManager pnpm; echo $?` | `AGENT_NOT_FOUND` with exit 3; `INVALID_ARGUMENT` with exit 2 |
| NDJSON | `quantex list --output ndjson` | One JSON object per line, nothing else on stdout |
| Self-upgrade | `quantex upgrade --check`, `quantex upgrade --check --channel beta` | Stable: up to date with `STALE_LATEST_VERSION` while 1.13.6 is the latest stable. Beta: `check-unavailable` until a 2.x prerelease exists |

## 3. Against your real ~/.quantex

These commands only read your installed agents and the 1.x state; they do not change `state.json` or `config.json`. Back up the directory anyway:

```bash
cp -R ~/.quantex ~/.quantex.backup
```

```bash
/tmp/qtx-sandbox/compare
```

`compare` runs `list`, `doctor`, `capabilities`, `update --all --dry-run`, and `inspect`, `resolve`, and `ensure --dry-run` for every installed agent with both builds, and prints any difference in the JSON (ignoring `meta` and the two builds' own version and install source). Then launch an agent you use with the new build, for example `/tmp/qtx-sandbox/home/.local/bin/quantex claude`, and use it as usual.

Do not run `upgrade` here with the sandbox binary: it records its own install source (`binary`) in `state.json`.

## 4. After the prerelease is published

- A 1.x standalone binary on macOS or Linux: `qtx upgrade --channel beta`, then `qtx --version`.
- npm (once npm publishing is on): `npm i -g quantex-cli@beta --prefix /tmp/qtx-npm`, then `/tmp/qtx-npm/bin/quantex doctor` reports `installSource: npm`.
- Windows: rerun `install.ps1`, then `qtx --version`.
