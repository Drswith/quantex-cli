## Context

Lifecycle redesign made provider observation mandatory for install verification and uninstall planning. npm, bun, mise, uv, and brew already expose presence probes. Cargo, deno, pip, and winget still hardcode `unknown` in their provider adapters, so observation always returns `indeterminate`.

## Goals / Non-Goals

**Goals**

- Confirm cargo crate, deno global binary, pip package, and winget package ID presence/absence.
- Fail closed on inconclusive probes during observation, install verification, and ghost recovery.
- Preserve existing install, update, and uninstall command behavior for these providers.
- Expose the same probes through managed-installer compatibility projections used by legacy package-manager callers.
- Attach deno binary names on provider bindings so global-install observation can resolve the installed executable.

**Non-Goals**

- Change uninstall planning policy beyond making these providers conclusive when their package managers can answer.
- Rework self-upgrade or release artifact flows.
- Broaden ManagedInstaller probe signatures to pass arbitrary options beyond current packageName/packageTargetKind.

## Decisions

- Add `probePackagePresence` and `getInstalledVersion` helpers to each package-manager module, mirroring brew/mise/npm patterns and using contextual process IO when a provider context is present.
- Cargo: parse `cargo install --list`; match the crate package name; treat a successful empty or non-matching list as `absent`.
- Deno: resolve the Deno install root (`DENO_INSTALL_ROOT` or `$HOME/.deno`) and check `bin/<binaryName>` existence; infer binary name from the package id stem when `target.binaryName` is absent.
- Pip: run `pip show <package>` through the existing pip command resolver; exit `0` is `present`, exit `1` with a not-found warning is `absent`, other failures are `unknown`.
- Winget: run `winget list --id <id> -e`; successful list output that mentions the id is `present`; explicit no-match messages are `absent`; other failures are `unknown`.
- Wire helpers into the four provider adapters and the corresponding `installers.ts` compatibility projections.
- Extend `resolveStateProviderBinding` so deno bindings always carry `binaryName` from state or the agent definition.

## Risks / Trade-offs

- [Risk] Cargo list output format varies for git/path installs. → Mitigation: match the package header line and treat unparseable successful output for a matched package as `present` without version.
- [Risk] Deno binary name may differ from package id when users override `--name`. → Mitigation: prefer `target.binaryName` / recorded state binary name; only infer from package id as fallback.
- [Risk] Winget localized stderr may differ. → Mitigation: match common English no-match phrases and fail closed to `unknown` otherwise.
- [Risk] Extra probe subprocess or filesystem check on observe/verify paths. → Mitigation: same cost model as brew/mise/npm; required for redesign observation contracts.

## Migration Plan

- Ship as a narrow behavior fix PR.
- Archive the OpenSpec change after merge and accepted delta sync.
