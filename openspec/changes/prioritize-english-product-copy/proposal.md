## Why

The default repository landing page and npm package metadata still present Quantex in Chinese first, which makes the project less approachable for international users. We need the primary product surface to lead with English while keeping Simplified Chinese available as an explicit alternate entry point.

## What Changes

- Change the `package.json` description to English product copy.
- Make the root `README.md` the primary English product README.
- Move the Simplified Chinese product README to a dedicated root entry point with visible language-switch links.
- Update repo-native documentation pointers and checks that currently assume `README.en.md` is the English product page.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `product-readme`: README language-entry requirements change so the default product landing page is English-first and Simplified Chinese remains available through a dedicated alternate page.
- `project-memory`: Root markdown allowlist and contributor pointers change to recognize the dedicated Simplified Chinese README entry point.

## Impact

- Affected files: `package.json`, `README.md`, new localized README entrypoint(s), `AGENTS.md`, `scripts/check-project-memory.ts`, and OpenSpec spec artifacts.
- No CLI behavior, schema, or release automation changes.
