## ADDED Requirements

### Requirement: Binary self-upgrade MUST abort in-flight downloads on CLI cancellation

Binary self-upgrade SHALL download release assets with a cancellation signal registered to the CLI cancellation handler set. When timeout or signal cancellation invokes those handlers during an in-flight binary download, Quantex SHALL abort the download, report the upgrade attempt as failed, and SHALL NOT keep the process blocked solely by the abandoned download.

#### Scenario: Timeout aborts a stalled binary upgrade download

- GIVEN Quantex was installed as a standalone binary
- AND `quantex upgrade --timeout <duration>` starts downloading a release asset
- AND the download stalls without completing
- WHEN the timeout deadline fires and CLI cancellation handlers run
- THEN Quantex aborts the in-flight download
- AND it reports the upgrade attempt as failed
- AND the process is not kept alive solely by the abandoned download fetch

#### Scenario: Signal cancellation aborts a binary upgrade download

- GIVEN Quantex was installed as a standalone binary
- AND a binary self-upgrade download is in flight
- WHEN CLI cancellation handlers run because of an interrupt signal
- THEN Quantex aborts the in-flight download
- AND it does not continue replacing the live binary from that aborted download
