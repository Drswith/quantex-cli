## Context

Quantex has a stable one-shot CLI and lifecycle locks, but no resident native
surface. The existing `update --all` invocation observes every catalog entry;
that is unsuitable for a background task because it can probe tools that the
user has never chosen to manage. Core deliberately excludes update execution
and is private, so it is not the desktop integration boundary in this change.

## Goals / Non-Goals

**Goals:**

- Provide a macOS desktop application that observes only Quantex-managed
  agents, remains resident without a WebView, and requires confirmation for
  every update.
- Keep lifecycle observation, planning, locks, execution, and receipts in the
  CLI process that already owns them.
- Ship matching arm64 and x64 CLI sidecars with an unsigned local macOS bundle.
- Cover the practical desktop feature surface: agent catalog and detail,
  install/ensure/update/uninstall, system-terminal execution, doctor,
  capabilities, Quantex configuration, desktop preferences, and recent
  operation results.
- Keep the web UI built from unmodified official shadcn components with default
  theme tokens, reserving Tailwind utilities for page layout only.

**Non-Goals:**

- Automatic agent updates, an embedded terminal or PTY, developer-facing
  `commands`/`schema` pages, Core publication or Core update APIs,
  Windows/Linux application builds, and in-app desktop updating.
- Reading or writing Quantex `state.json` from Rust or the web UI.
- Letting the bundled CLI sidecar self-upgrade independently of the signed
  desktop application that contains it.

## Decisions

- **CLI sidecar bridge:** Tauri invokes a bundled Quantex binary with fixed
  argument arrays and parses JSON/NDJSON. This preserves the CLI as the
  lifecycle authority. Embedding Bun/TypeScript in the resident process would
  increase idle resource use, while a Rust lifecycle rewrite would duplicate
  state and provider policy.
- **Allowlisted desktop workflows:** Each React action maps to a typed Rust
  command with a fixed CLI verb and argument shape. The web UI may provide an
  agent name or validated configuration value, but it cannot provide shell
  text, an executable path, or an arbitrary argument vector.
- **Configuration boundary:** Quantex configuration is read and changed only
  through the bundled CLI's structured `config` contract. Desktop preferences
  remain in the native Desktop store so the two configuration domains are
  clearly separated.
- **Agent execution:** `exec` opens the selected installed agent in the macOS
  system terminal. The desktop does not embed a terminal process or keep a PTY
  alive after its WebView closes.
- **Managed-only planning:** `update --all --managed` obtains names from the
  persisted installed-agent state and runs the existing planning path. It does
  not alter `update --all`, which retains catalog-wide behavior. `--dry-run`
  produces plans without mutation.
- **Native host ownership:** Rust owns preferences, scheduling, notifications,
  tray actions, login-item opt-in, invocation serialization, and WebView
  lifetime. React owns only presentation and invokes a narrow command set.
- **Separate preference store:** Desktop settings and notification de-dup keys
  live in Tauri app data, not Quantex state. Defaults are daily checks,
  notifications enabled, and login launch disabled. Allowed frequencies are
  six hours, daily, weekly, and disabled.
- **Background work:** A due check starts after a randomized two-to-five minute
  initial delay and uses up to thirty minutes of schedule jitter. Failed checks
  retry after 15 minutes, then one hour, then return to normal cadence. One
  host task is active at a time; manual refresh joins the active check.
- **User-visible updates:** The desktop opens confirmation before each selected
  update batch. It executes selected names serially through `update <agent>`;
  a failure is recorded and does not prevent later selected agents. Cancellation
  terminates the active child and prevents later starts.
- **Default shadcn surface:** UI primitives are installed by the workspace's
  official shadcn CLI using the repository preset and are not edited. Feature
  pages compose those defaults without custom themes, component variants,
  dimensions, colors, shadows, or radii.

## Risks / Trade-offs

- [CLI binary and desktop code drift] → build desktop sidecars from the same
  revision and include both architecture-specific names as Tauri resources.
- [A background process wakes too often] → only schedule managed targets, use
  cache-aware CLI planning, jitter, backoff, and no resident WebView.
- [Desktop bypasses lifecycle safety] → the host accepts only names returned by
  the catalog or latest snapshot, validates names again, and lets every
  mutation re-observe through the CLI.
- [A broad desktop surface becomes a generic command runner] → expose typed,
  allowlisted IPC commands instead of forwarding arbitrary CLI arguments.
- [Unsigned distribution alarms users] → document unsigned local bundles and
  gate signed/notarized release automation on supplied Apple credentials.

## Migration Plan

1. Land the new CLI option and structured contract with regression tests.
2. Land the desktop workspace, complete allowlisted feature surface, sidecar
   build path, and local unsigned bundle.
3. Add signing/notarization only in a later credential-backed release change.

Rollback is removing the desktop workspace from release automation. Existing
CLI users remain unaffected because `--managed` is opt-in and `update --all`
keeps its current target set.

## Open Questions

None for the unsigned macOS v1 implementation.
