## MODIFIED Requirements

### Requirement: Timeout handling MUST preserve terminal failure codes

When a mutating command's primary work returns `ok: false` with a concrete error code, Quantex SHALL return that failure even if the timeout deadline has fired, unless the command was interrupted before producing a terminal result.

#### Scenario: Install failure after deadline is not reported as timeout

- GIVEN a mutating install command is invoked with `--timeout`
- AND the primary install work returns `ok: false` with error code `INSTALL_FAILED`
- AND the timeout deadline fires while the result is being finalized
- WHEN the runtime finalizes the command result
- THEN Quantex returns `INSTALL_FAILED`
- AND it does not substitute `TIMEOUT`
