## Context

Quantex uses release-please for version calculation, changelog generation, Release PRs, and GitHub Release creation. A repository-local resolver runs before release-please and currently only treats `feat`, `fix`, `perf`, and breaking markers as release-worthy. This made the supported one-shot `Release-As` footer ineffective on a neutral `chore(release)` commit and encouraged a misleading `feat(release)!` workaround.

The node release strategy also suppresses `refactor` entries by default. The historical repair corrected the resulting published notes, but it deliberately did not change future automation.

## Goals / Non-Goals

**Goals:**

- Make a valid `Release-As` footer reach release-please without misclassifying the change as a breaking feature.
- Show intentional `refactor` entries in generated stable and beta changelogs and their GitHub Release copies.
- Make source PR authors provide release-please-supported, concise user-facing release text whenever they request a release.
- Keep release-please responsible for version calculation and Release PR creation.

**Non-Goals:**

- Rewriting any existing changelog entry, tag, GitHub Release, or npm artifact.
- Adding a separate release-note service, a custom Release PR creation command, or a dynamic provider of release text.
- Treating every refactor as an automatic version bump.
- Inferring a release summary from arbitrary implementation commits.

## Decisions

### Recognize `Release-As` at the repository gate

The resolver will classify a commit containing a syntactically non-empty, case-insensitive `Release-As:` footer as release-worthy. The footer remains release-please's version instruction; the resolver only decides whether to enter Release PR mode. This removes the requirement to add `!` or a false breaking-change declaration solely as an automation trigger.

The resolver will not derive or validate the requested version itself. Release-please and the existing Release PR policy remain the source of version calculation and version admission.

### Expose refactors without promoting them

Both manifest configurations will declare the `refactor` changelog type as visible under an `Internal Improvements` section. Visibility affects presentation only; it does not make a refactor commit release-worthy or change the SemVer bump selected by release-please.

### Require a release-please commit override in release-source PRs

The existing PR body governance adds a `## Release Summary` section. A release-worthy source PR MUST place a non-empty `BEGIN_COMMIT_OVERRIDE` / `END_COMMIT_OVERRIDE` block in that section, with conventional-commit entries written for users rather than implementation mechanics. Source PRs that intentionally trigger with `Release-As` MUST also declare the same footer in this section, while the merged commit remains responsible for carrying the authoritative footer.

release-please natively consumes commit overrides on the repository's linear merge path. This avoids a second renderer or workflow: the override becomes the changelog entry, and the generated changelog remains the content copied to the GitHub Release.

### Keep generated Release PR validation narrow

Release-please generated version PRs remain exempt from source-PR summary validation and continue through the existing dedicated release-PR policy. Only ordinary source PRs create the release-note input.

## Risks / Trade-offs

- [A `Release-As` footer has a typo] -> resolver only requires a non-empty value; release-please and Release PR policy continue to reject invalid or disallowed versions.
- [A refactor becomes noisy in release notes] -> only deliberately titled `refactor:` commits appear, and a source PR must provide an intentional override when it releases.
- [PR body and merged footer diverge] -> the runbook requires the same `Release-As` value in both; release-please still reads the merged commit as authority.
- [Commit override cannot be associated with a non-linear merge] -> preserve the repository's rebase-first policy; do not use plain merge commits for release-source PRs.

## Migration Plan

1. Add regression tests for resolver classification, changelog configuration, and PR body validation.
2. Apply the minimal resolver/config/template/policy/runbook changes and run the repository validation suite.
3. Deliver one process-only PR. It MUST NOT itself be release-worthy or create a Release PR.
4. Subsequent release-source PRs use the new section and, when necessary, `Release-As`; no migration of historical notes is required.

## Open Questions

None.
