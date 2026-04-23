# Proposed Changes

Each subdirectory in this folder should contain one proposed non-trivial change.

Recommended structure:

```text
openspec/changes/<change-name>/
├── proposal.md
├── design.md
├── tasks.md
└── specs/
    └── <domain>/
        └── spec.md
```

Keep the change self-contained. When the work is accepted and landed, merge the resulting behavior into `openspec/specs/` and move the folder to `openspec/changes/archive/`.
