## Context

`pull_request_target` workflows use the default-branch workflow definition but historically ran with a mix of trusted and untrusted inputs. Importing executable validation from `github.event.pull_request.head.sha` lets the PR author control what `validateReleasePrPolicy` does.

## Decision

Use `actions/checkout` with `ref: ${{ github.event.pull_request.base.sha }}` so `GITHUB_WORKSPACE` contains the tree at the tip of the protected base branch for that PR event. The GitHub API calls already use `baseBranch` and PR file lists from the API; only the local module import must not come from the head commit.

## Non-Goals

- Rewriting validation as pure inline YAML
- Changing release-please branch naming or automerge permissions
