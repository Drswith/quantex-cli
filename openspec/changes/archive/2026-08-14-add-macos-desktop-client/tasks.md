## 1. Managed update contract

- [x] 1.1 Add the `update --all --managed` command contract, state-backed target selection, and structured managed scope.
- [x] 1.2 Add regression coverage for managed-only dry-run planning and unchanged full-batch behavior.

## 2. Desktop application

- [x] 2.1 Add the Bun workspace, Tauri macOS host, architecture-matched sidecar packaging, and desktop scripts.
- [x] 2.2 Implement native preferences, serialized background scheduling, tray/window lifecycle, notification de-duplication, and fixed CLI invocation boundary.
- [x] 2.3 Implement the React/Tailwind/shadcn/ui dashboard, confirmation flow, settings, and desktop unit tests.
- [x] 2.4 Keep per-agent dry-run diagnostics in the inventory without showing a false update-execution failure.
- [x] 2.5 Provide browser-only mock-data UI development and migrate UI styling to default shadcn/ui components and theme tokens.
- [x] 2.6 Install the Desktop UI components through the project-local official shadcn CLI and keep their generated source unmodified.
- [x] 2.7 Expand the browser mock into catalog, agent detail, lifecycle actions, diagnostics, Quantex settings, Desktop preferences, and activity surfaces using unmodified official shadcn components.
- [x] 2.8 Add typed Desktop client contracts and deterministic mock behavior for the expanded feature surface.
- [x] 2.9 Add allowlisted Rust IPC for catalog, inspect, install, ensure, update, uninstall, system-terminal execution, diagnostics, capabilities, and Quantex configuration.
- [x] 2.10 Add unit coverage for command validation, configuration serialization, lifecycle result handling, and the expanded browser client.

## 3. Validation and delivery

- [x] 3.1 Run CLI, desktop, OpenSpec, lint, formatting, typecheck, build, binary, and release-artifact validation.
- [x] 3.2 Commit, push, open the implementation PR, and report merge, release, and archive-closure status.
- [x] 3.3 Visually verify the complete browser mock at desktop dimensions and attach an up-to-date screenshot.
- [x] 3.4 Re-run repository and Desktop validation, refresh the single PR commit, push, and observe required CI.
