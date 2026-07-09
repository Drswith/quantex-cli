## Context

`getAdoptableExistingInstallMethod()` infers Bun and mise managed sources from distinctive global path segments. npm inference currently matches any path containing `/node_modules/.bin/` or `/node_modules/`, which includes project-local installs that are not Quantex-managed global npm installs.

## Goals / Non-Goals

- Goals: only adopt npm when the binary path identifies a global npm layout; keep project-local installs untracked when the source is ambiguous.
- Non-Goals: manage project-local npm installs; add new install methods; change self-upgrade npm detection for Quantex itself.

## Decisions

- Reject paths containing `/node_modules/.bin/` for npm inference because that layout is the project-local npm bin convention.
- Allow npm inference only for known global npm layouts such as `/lib/node_modules/`, nvm/fnm/volta version-manager lib trees, and Windows `%AppData%/npm/`.
- Keep Bun and mise inference unchanged.

## Risks / Trade-offs

- Some uncommon global npm prefixes may remain untracked -> acceptable; ambiguous installs should stay untracked rather than corrupt state.
