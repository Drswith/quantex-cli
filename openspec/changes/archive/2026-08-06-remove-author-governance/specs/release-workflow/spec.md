# release-workflow Delta

## REMOVED Requirements

### Requirement: Protected-branch CI MUST reject prohibited co-author trailers in new commits

**Reason**: The rule did not achieve its goal and was the largest single source of merge-blocking CI failures. Enforced since 2026-05-04, it still allowed at least nine commits carrying a real `Co-authored-by:` trailer onto `main`, because those trailers are added by GitHub at merge time — squash attribution and web-UI operations — which a check reading the pull request's branch commits cannot observe. The trailers that landed credit the maintainer's own GitHub noreply identity and the repository's release bot, not the third-party tooling the rule was written for.

**Migration**: Attribution on `main` is addressed through repository merge settings, where the trailers are actually produced. The pull-request commit shape requirements that existed only to keep GitHub from synthesizing these trailers — the bot and agent author identity rejection, and the single-commit limit for non-release pull requests — are removed with it. `Release-As` commit-footer consistency is unaffected and continues to be enforced, because release-please reads that footer from the merged commit.
