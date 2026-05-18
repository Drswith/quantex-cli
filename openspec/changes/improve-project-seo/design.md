## Context

Search discovery for a CLI package depends heavily on package registry metadata and the first visible README copy. Quantex already has accurate product documentation, but `package.json` lacks keywords and the opening copy can better include the terms users search for: AI coding assistant CLI, coding agent CLI, lifecycle management, install, inspect, update, uninstall, run, and machine-readable output.

## Decision

Make a narrow discoverability pass:

- Update `package.json` `description` and `keywords`.
- Update the README lead copy in English and Simplified Chinese.
- Add an OpenSpec product-readme requirement that keeps future metadata/readme SEO edits accurate, natural, and within product scope.

## Non-Goals

- Do not add a website, generated landing page, ad copy, or root-level marketing document.
- Do not change command behavior, supported-agent catalog data, install methods, or release metadata generation.
- Do not frame Quantex as a workflow orchestration platform.

## Risks

- Overloaded keyword lists can look spammy and reduce trust. Keep keywords relevant to Quantex's actual lifecycle surface and supported CLI category.
- README wording can drift into broader automation claims. Keep the copy tied to installation, inspection, updates, uninstall, execution, discovery, and structured output.
