## Context

`README.md` is the first page most users see on npm, GitHub, and search results. It currently includes useful maintainer knowledge, but the product story is diluted by project-memory links, workflow notes, and skill-maintenance details.

## Goals / Non-Goals

**Goals:**

- Make the root README useful as a product landing page for humans evaluating or installing Quantex.
- Preserve access to deeper maintainer, OpenSpec, release, and agent-facing documentation through concise links.
- Keep examples grounded in the current command surface.

**Non-Goals:**

- Change CLI behavior, supported agents, release automation, or package metadata.
- Remove durable project-memory documents from the repository.
- Turn the README into exhaustive command reference documentation.

## Decisions

- Lead with product value and common flows instead of project process.
  - Alternative considered: keep the current README and add a new product page. Rejected because GitHub and npm already treat the root README as the default product page.
- Keep internal workflow references in a short maintainer section.
  - Alternative considered: remove all internal links. Rejected because agent collaborators still need a discoverable path to OpenSpec and docs.
- Use command examples that are stable and easy to scan.
  - Alternative considered: document every option in README. Rejected because that belongs in `quantex commands`, `quantex schema`, and deeper docs.

## Risks / Trade-offs

- Product README may become stale as commands evolve -> Mitigation: keep examples focused on stable core commands and validate links during documentation changes.
- Less process detail on the landing page may make maintainer docs less obvious -> Mitigation: include a compact maintainer and agent collaboration section near the end.
