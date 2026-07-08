## Context

Quantex supports agents through data-driven catalog JSON entries plus generated catalog manifests. Command Code's upstream quickstart documents npm installation with `command-code@latest`, the short `cmd` executable, `cmd --version`, and `cmd update`. The published npm package also exposes `command-code`, `commandcode`, `cmd`, and `cmdc` bins that point to the same CLI entrypoint.

## Goals / Non-Goals

**Goals:**

- Add Command Code with lifecycle metadata for lookup, install, resolve/execute, version probe, and update planning.
- Keep the change within existing catalog schema and manifest generation.
- Prefer documented/upstream package facts over inferred install methods.

**Non-Goals:**

- Add new installer types.
- Add special runtime handling for Command Code.
- Broaden Quantex into workflow orchestration or session import features.

## Decisions

- Use `commandcode` as the canonical Quantex agent name because existing catalog names generally use compact product slugs for code-oriented agents.
- Use `command-code` as `binaryName`, `versionProbe`, and `selfUpdate` command because it is an official npm bin and avoids colliding with Windows `cmd.exe`.
- Preserve official short names as lookup aliases: `command-code`, `cmd`, and `cmdc`.
- Register only npm managed install methods because the upstream quickstart documents npm global installation and does not document Bun, Homebrew, winget, script, or binary installers.

## Risks / Trade-offs

- [Risk] Users may expect Quantex to launch the short `cmd` alias shown in the quickstart. -> Mitigation: keep `cmd` as a lookup alias while resolving to the safer `command-code` executable.
- [Risk] Command Code may later document additional install methods. -> Mitigation: this change is data-only and can be extended with new catalog methods without changing core installer logic.
