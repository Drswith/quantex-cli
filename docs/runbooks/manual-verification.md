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

MiMoCode (`mimo`, `@mimo-ai/cli`, about 20 KB) is a quick agent to install and remove. Its install script comes before npm in the catalog, so make npm the default package manager first.

| Check | Command | Expected |
|---|---|---|
| Version and help | `quantex --version`, `qtx --version`, `quantex --help`, `quantex install --help` | The release version; usage on stdout, exit 0 |
| Environment | `quantex doctor` | `Quantex: <version> (binary)`, bun and npm the only installers listed, both available, no issues |
| Config | `quantex config set defaultPackageManager npm`, `quantex config` | Set; the full configuration is printed |
| Catalog | `quantex list`, `quantex info mimo` | Every catalog agent; MiMoCode not installed, with its latest version and npm listed first |
| Install | `quantex install mimo`, then `mimo --version` | Installed through npm; `~/.quantex/state.json` records it |
| Install again | `quantex install mimo` | "already installed" on stderr, exit 0 |
| Launch | `quantex mimo --version`, `qtx exec mimo -- --version` | The agent's own output and exit code |
| Launch, JSON | `quantex exec mimo --json -- --version` | Nothing on stdout; the agent's output on stderr |
| Update | `npm i -g @mimo-ai/cli@<previous version>`, `quantex update mimo --dry-run`, `quantex update mimo`, `quantex update --all` | "Would update … old -> new", then updated, then up to date |
| Uninstall | `quantex uninstall mimo --dry-run`, `quantex uninstall mimo` | Dry run changes nothing; then `mimo` is gone |
| Prompt | `quantex mimo` while it is not installed | Asks "Would you like to install it? (Y/n)"; answering n exits 1 |
| Ctrl-C | Install an interactive agent (for example `quantex install pi`), run `quantex pi`, press Ctrl-C | The agent handles Ctrl-C, quantex exits with the agent's code, and the terminal is usable |
| From 1.x | `quantex-v1 install mimo`, then `quantex info mimo`, `quantex update mimo --dry-run`, `quantex uninstall mimo` | 2.x manages what 1.x installed: managed via npm, then removed, and `lifecycleReceipts` in `state.json` is empty |
| Aliases | `quantex ensure mimo --json`, `quantex inspect mimo --json` | `action` is `install` and `info` |
| Argument errors | `quantex instal mimo; echo $?`, `quantex list --bogus --json; echo $?` | Exit 2; the second prints an `INVALID_ARGUMENT` envelope on stdout |
| Other errors | `quantex install nope --json; echo $?`, `quantex config set defaultPackageManager mise; echo $?` | `AGENT_NOT_FOUND` with exit 3; `INVALID_ARGUMENT` with exit 2 |
| Removed surface | `quantex list --output json; echo $?`, `quantex list --no-cache --json; echo $?`, `quantex capabilities --json; echo $?`, `quantex config set networkRetries 3; echo $?` | Each exits 2 with `INVALID_ARGUMENT` |
| Self-upgrade | `quantex upgrade --check`, `quantex upgrade --check --channel beta` | Stable: up to date with `STALE_LATEST_VERSION` while 1.13.6 is the latest stable. Beta: `check-unavailable` until a 2.x prerelease exists |

## 3. Against your real ~/.quantex

These commands only read your installed agents and the 1.x state; they do not change `state.json` or `config.json`. Back up the directory anyway:

```bash
cp -R ~/.quantex ~/.quantex.backup
```

```bash
/tmp/qtx-sandbox/compare
```

`compare` runs `update --all --dry-run`, and `resolve` and `install --dry-run` for every installed agent with both builds, and prints any difference in the JSON (ignoring `meta` and `action`). Catalog-wide commands (`list`, `doctor`) and `info` differ from 1.x on purpose since 2.0.0-beta.2, because agents and install routes were removed, so check those by reading them; an agent 2.x no longer supports shows up as a difference. Then launch an agent you use with the new build, for example `/tmp/qtx-sandbox/home/.local/bin/quantex claude`, and use it as usual.

Do not run `upgrade` here with the sandbox binary: it records its own install source (`binary`) in `state.json`.

## 4. After the prerelease is published

- A 1.x standalone binary on macOS or Linux: `qtx upgrade --channel beta`, then `qtx --version`.
- npm (once npm publishing is on): `npm i -g quantex-cli@beta --prefix /tmp/qtx-npm`, then `/tmp/qtx-npm/bin/quantex doctor` reports `installSource: npm`.
- Windows: rerun `install.ps1`, then `qtx --version`.
