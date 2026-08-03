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

## 3. Validation and delivery

- [x] 3.1 Run CLI, desktop, OpenSpec, lint, formatting, typecheck, build, binary, and release-artifact validation.
- [x] 3.2 Commit, push, open the implementation PR, and report merge, release, and archive-closure status.
