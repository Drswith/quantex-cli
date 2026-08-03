## MODIFIED Requirements

### Requirement: Release Workflow Is Explicit and Idempotent

Release preparation, release sealing, and release publication SHALL be separate explicit workflows. Preparation SHALL operate only on allowlisted protected branches, sealing SHALL select only the exact current protected-branch head with successful push CI, and publication SHALL operate only on the immutable version tag for that validated commit. Every retry SHALL preserve the same tag, commit, version, channel, and candidate bytes.

#### Scenario: maintainer prepares a release

- **WHEN** a maintainer dispatches release preparation for `main` or `beta`
- **THEN** the preparation workflow MUST invoke release-please in Release PR mode
- **AND** it MUST skip tag, GitHub Release, npm, and standalone-asset publication

#### Scenario: maintainer seals a successful release commit

- **WHEN** the current protected-branch head has successful push CI
- **AND** its title, root package version, branch channel, and proposed tag agree
- **THEN** the sealing workflow MUST create or verify that immutable tag at the exact head SHA
- **AND** it MUST explicitly dispatch publication at that tag

#### Scenario: protected-branch head is not releasable

- **WHEN** the current protected-branch head lacks successful push CI or does not satisfy the release commit contract
- **THEN** sealing MUST fail before creating a tag or dispatching publication

#### Scenario: maintainer retries a partial release

- **WHEN** a tag already identifies a validated release commit and one or more publication surfaces are incomplete
- **THEN** publication MUST reconcile the same tag, candidate artifact, draft or published GitHub Release, assets, and npm version
- **AND** it MUST NOT infer or select a different commit from newer branch history

#### Scenario: existing tag points elsewhere

- **WHEN** sealing expects a version tag that already points to another SHA
- **THEN** sealing MUST fail closed
- **AND** it MUST NOT move or replace the existing tag

## ADDED Requirements

### Requirement: Release Candidate Bytes MUST Be Built Once and Promoted

The publication workflow SHALL build and validate one release-candidate artifact from the exact version tag. The mutation job SHALL consume the npm tarball, standalone binaries, checksums, manifest, and release notes from that artifact without checking out source or rebuilding them.

#### Scenario: candidate passes validation

- **WHEN** the tagged candidate passes repository, package, binary, and release-artifact validation
- **THEN** the workflow MUST upload one candidate artifact containing every file required for publication
- **AND** the mutation job MUST download and publish those exact files

#### Scenario: candidate validation fails

- **WHEN** any candidate validation or packaging step fails
- **THEN** publication MUST stop before creating or modifying a GitHub Release or npm version

### Requirement: Publication MUST Stage and Verify Recoverable State

Publication SHALL create or recover a draft GitHub Release, reconcile and verify expected assets, publish or verify the exact npm tarball, verify registry closure, and publish the GitHub Release only after those checks pass.

#### Scenario: new release is published

- **WHEN** neither the GitHub Release nor npm version exists
- **THEN** publication MUST stage and verify the GitHub Release assets before npm publication
- **AND** it MUST publish the exact candidate tarball
- **AND** it MUST verify the npm version before making the GitHub Release public

#### Scenario: npm version already exists

- **WHEN** the exact npm version already exists during a retry
- **THEN** publication MUST verify that its registry integrity matches the candidate tarball
- **AND** it MUST fail closed on a mismatch

#### Scenario: draft release already exists

- **WHEN** a retry finds a draft GitHub Release for the exact tag
- **THEN** publication MUST reconcile and verify its expected assets
- **AND** it MUST reuse that release instead of creating a duplicate

#### Scenario: published release is incomplete

- **WHEN** a retry finds a published GitHub Release whose expected assets are incomplete
- **THEN** publication MUST reconcile and verify the missing or stale assets against the same candidate
- **AND** it MUST NOT create a second release or move the tag
