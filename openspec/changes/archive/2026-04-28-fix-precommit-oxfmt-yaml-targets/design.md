## Context

Quantex uses `simple-git-hooks` and `lint-staged` to run `oxfmt` and `oxlint --fix` on staged files before each commit. The current glob includes YAML, but the installed `oxfmt` invocation fails on `.openspec.yaml`, which blocks commit closure for valid OpenSpec archive changes.

## Goals / Non-Goals

**Goals:**

- Make pre-commit formatting succeed for normal OpenSpec archive commits.
- Keep formatter and linter enforcement in place for supported staged source files.

**Non-Goals:**

- Do not replace `oxfmt` or `oxlint`.
- Do not broaden formatter coverage to file types the current formatter/runtime combination does not support.

## Decisions

- Remove YAML from the `lint-staged` formatter glob so the hook only targets staged file types that `oxfmt` can handle reliably in this repository.
- Keep JSON and source-file formatting intact so the pre-commit contract remains strong for supported file types.
- Record the narrower pre-commit target rule in the code-quality-tooling spec.

## Risks / Trade-offs

- YAML files will no longer be auto-formatted by the pre-commit hook, but that is preferable to blocking every commit that archives an OpenSpec change.
