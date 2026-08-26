## Context

DeepSeek Harness is DeepSeek's own agent harness, built on Cordis with a plugin-first architecture. Every fact below was read from upstream on 2026-08-26:

| Fact | Source |
|---|---|
| npm package `@deepseek-ai/dsh`, `bin: { "dsh": "lib/bin.js" }`, MIT | registry metadata for `0.1.1-rc.2` |
| Node.js plus npm is the only documented way to run it | root `README.md`, "Run from `npm`" |
| `-V, --version` prints the launcher version | `apps/cli/src/args.ts`, `commander.version(version, '-V, --version', …)`; `apps/cli/reference/README.md` |
| Entry modes are `--profile`, `web`, and `plugin`; there is no update verb | `apps/cli/README.md`, "Entry modes" |
| Windows is a first-class target | `docs/subsystems/sandbox.md` names the Windows ACL restricted-token backend; `docs/subsystems/subprocess.md` describes `taskkill /T` tree termination |
| GitHub releases carry no binary assets | `releases` API: `assets: []` on `dsh-v0.1.1-rc.2` |
| 195,665 stars, 22,150 forks | repository API |

## Goals

- One catalog entry that installs, resolves, probes, and updates through a single documented source.
- No invented install route, and no reclaimed lookup name.

## Decisions

### Canonical slug is `dsh`, alias is `deepseek-harness`

`docs/agent-support-matrix.md` sets the default naming rule: use the upstream executable command when it is stable, product-specific, and suitable as a user-facing identifier. `dsh` is all three, so the exception rule for generic executables does not apply. `deepseek-harness` is the product-name variant and matches the repository name.

The bare `deepseek` name is deliberately not claimed. `agent-catalog` already requires that `deepseek` and `deepseek-tui` return no supported entry after the DeepSeek TUI was renamed to CodeWhale, and `test/agents.test.ts` asserts it. Display-name lookup normalizes the whole string, so `DeepSeek Harness` resolves only from `deepseek harness`, never from `deepseek`.

### npm only, on all three platforms

Upstream documents exactly one distribution: install Node.js, then run the npm package. There is no Homebrew formula, no winget package, no install script, and no release binary. `agent-catalog` restricts entries to `bun`, `npm`, `brew`, `winget`, `script`, and `binary`, so npm is both eligible and the only honest option.

`bun` is deliberately omitted even though it is eligible. The precedent set by the Grok entry is that Quantex does not advertise a managed install upstream does not document, and upstream names Node.js specifically. `codewhale` and `reasonix` are the existing npm-only shape this entry follows.

All three platforms carry the same candidate with the full probe set — `executable-presence`, `installed-version`, `package-presence`, `target-version` — because an npm global install supports all four.

### No self-update command

The launcher grammar has no update verb, so declaring one would send users to a command that does not exist. With no `selfUpdate`, Quantex plans updates through the recorded npm install source, which is the correct path for a package-managed agent. This mirrors the reasoning already accepted for OpenHands: absent a real self-update, do not run a command that targets a different installation than the one on disk.

### The prerelease dist-tag is accepted, not worked around

Upstream is in developer preview and `dist-tags.latest` is `0.1.1-rc.2`. Three options were considered:

1. **Wait for a stable release.** Rejected: the entry would be correct today and the agent is already the one users are asking for. Nothing in `agent-catalog` conditions membership on a stable upstream version.
2. **Pin a dist-tag other than `latest`.** Rejected: upstream's `next` tag points at the same version, so pinning adds a field with no behavioral difference and a second thing to maintain.
3. **Accept `latest` as published.** Chosen. `buildRegistryPackageVersionUrl` resolves the `latest` dist-tag without prerelease filtering, and the npm update path runs `npm install -g <pkg>@latest`, so install, target-version comparison, and update all resolve the same version a user would get by hand.

The residual risk is that a preview upstream breaks its CLI. The full agent canary covers every catalog entry with a Linux candidate and requires installed-version evidence, so breakage surfaces there as an advisory failure rather than silently.

## Risks

| Risk | Mitigation |
|---|---|
| Upstream renames the binary or package during preview | Full canary asserts `dsh --version` evidence per run |
| A user expects `qtx deepseek` to work | Unchanged and intentional; `agent-catalog` keeps that name unresolved |
| Large dependency tree makes install slow on a canary runner | Install-time only; the canary has no per-agent time budget that this violates |
