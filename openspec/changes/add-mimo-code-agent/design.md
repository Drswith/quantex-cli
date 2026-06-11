## Context

MiMoCode's public upstream README describes it as a terminal-native AI coding assistant and documents two install paths: a one-line shell installer (`curl -fsSL https://mimo.xiaomi.com/install | bash`) and npm (`npm install -g @mimo-ai/cli`). The npm package publishes the `mimo` binary, and a temporary local install verified that `mimo --version` returns the installed version.

The installer script is a Bash script. It supports macOS and Linux directly and contains target selection for Windows builds, but upstream does not document a PowerShell installer. Quantex should avoid presenting a Bash installer as a native Windows script method when npm is already available on Windows.

## Goals / Non-Goals

**Goals:**

- Add MiMoCode as a supported lifecycle agent without changing package-manager behavior.
- Keep lookup ergonomic for users who search by `mimo`, `mimocode`, or `mimo-code`.
- Prefer upstream-documented install methods: official shell installer on macOS/Linux and npm on all platforms.
- Use `mimo --version` as the version probe.

**Non-Goals:**

- Add new package-manager install types.
- Add a Windows PowerShell script method that upstream does not document.
- Add a self-update command without upstream documentation.
- Model MiMoCode's internal memory, subagent, or workflow features as Quantex orchestration behavior.

## Decisions

### 1. Use `mimo` as the canonical agent slug

The npm package exposes the executable binary as `mimo`, and Quantex catalog slugs generally track the executable users run. The aliases `mimocode` and `mimo-code` preserve discoverability for the repository and product names.

### 2. Record `@mimo-ai/cli` as npm package metadata

The npm registry exposes `@mimo-ai/cli` with `bin.mimo = bin/mimo`. This lets Quantex render and execute npm-managed install/update/uninstall flows through the existing npm provider.

### 3. Limit script installer methods to macOS and Linux

The upstream one-line installer is a Bash command. Quantex can safely expose it for macOS and Linux, while Windows users still have a supported npm-managed method.

### 4. Do not expose a self-update command

Upstream docs currently document installation, not a dedicated `mimo update` or `mimo upgrade` command. The catalog should leave `selfUpdate` undefined so update planning uses recorded managed install sources instead of an invented command.

## Risks / Trade-offs

- [Windows script users may expect the Bash installer] -> Quantex still exposes npm on Windows, which is the upstream-documented package-manager path and works with the published Windows optional binaries.
- [MiMoCode may add a native updater later] -> future catalog updates can add `selfUpdate` after upstream documents a stable command.
- [Product naming is inconsistent between MiMo Code and MiMoCode] -> the catalog uses upstream README display spelling (`MiMoCode`) and aliases common spaced/hyphenated variants through lookup names.
