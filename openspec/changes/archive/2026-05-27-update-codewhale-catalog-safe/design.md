## Context

Upstream CodeWhale documents the rename from DeepSeek TUI in the current `Hmbown/CodeWhale` repository. The active lifecycle names are:

- dispatcher command: `codewhale`
- companion TUI binary: `codewhale-tui`
- npm package: `codewhale`
- Cargo dispatcher crate: `codewhale-cli`
- Cargo TUI crate: `codewhale-tui`
- self-update command: `codewhale update`
- version probe: `codewhale --version`

Quantex models one supported lifecycle agent per catalog entry. For this rename, the catalog entry should track the dispatcher command because that is the command users run and the command Quantex launches, probes, and updates.

## Decisions

### 1. Make CodeWhale the canonical catalog entry

Rename the catalog file and entry from `deepseek` to `codewhale`. Generated exports should expose `codewhale`, and the product docs should list `qtx codewhale`.

### 2. Do not keep legacy lookup aliases

The requested behavior is a hard catalog rename. Quantex will not keep `deepseek` or `deepseek-tui` as lookup aliases. Tests should assert that those names no longer resolve.

### 3. Keep install metadata aligned to upstream package names

Fresh npm installs should use `codewhale`. Cargo installs should use `codewhale-cli --locked`, matching the upstream dispatcher crate that provides the `codewhale` command. This change does not model multi-crate companion installs.

### 4. Avoid another abnormal `1.x` release path

This implementation must not change package versions, release manifests, release artifacts, release tags, or release workflows. The PR and implementation commit should avoid conventional-commit major-release markers. The PR body should declare release intent as a pre-1.0 minor user-facing catalog update rather than a major release.

Current `main` also contains release-please guardrails for pre-1.0 minor bumps and burned version `1.0.0`; this change relies on those guards but does not modify them.

## Non-Goals

- Preserve `deepseek` or `deepseek-tui` compatibility.
- Add CodeWhale-specific runtime behavior outside catalog metadata.
- Change Quantex release automation, version files, generated release metadata, or publishing workflows.
- Expand Quantex into workflow orchestration.

## Risks

- Existing users who try `qtx deepseek` will no longer resolve a supported agent. This is intentional for this change.
- A future squash title that reintroduces conventional-commit major-release markers could again request a major release. PR title and body should make the intended pre-1.0 minor release explicit.
