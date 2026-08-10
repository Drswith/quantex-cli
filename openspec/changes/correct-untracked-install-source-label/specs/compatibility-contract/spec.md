## ADDED Requirements

### Requirement: Free-form human-readable label prose is correctable; machine identifiers are frozen

Quantex distinguishes two kinds of value inside its v1 machine-readable payloads. A field declared as a free-form string whose contract is "human-readable description" carries prose: its wording MAY be corrected when it states something Quantex did not observe, provided the field's name, type, requiredness, and documented meaning are unchanged. A field whose value is a discriminator, enumerated identifier, or diagnostic code is a machine identifier: its value MUST NOT be renamed to track a prose correction, even when the identifier's wording becomes historical.

Correcting label prose SHALL be recorded in an approved change together with the pinned expectations it updates. A machine identifier whose name has become historical MUST be retained until a separately approved compatibility change ends its window, and its retention MUST NOT be treated as a defect merely because a related label was corrected.

#### Scenario: Correcting a human-readable label

- **GIVEN** a free-form human-readable label states a mechanism or origin Quantex did not observe
- **WHEN** an approved change corrects the label wording
- **THEN** the carrying field keeps its name, type, requiredness, and documented meaning
- **AND** the change records the correction and the pinned expectations it updates
- **AND** the correction is not treated as removing, renaming, or incompatibly reinterpreting the field

#### Scenario: A machine identifier's wording has become historical

- **GIVEN** a discriminator value, enumerated identifier, or diagnostic code contains wording that no longer describes the mechanism Quantex uses
- **WHEN** the related human-readable label is corrected
- **THEN** the identifier value is retained unchanged
- **AND** consumers keying on that identifier continue to match without a compatibility change

#### Scenario: Consumer distinguishes an untracked install

- **GIVEN** a consumer needs to detect that Quantex resolved an agent executable it does not track
- **WHEN** the consumer reads the structured resolution payload
- **THEN** the stable install-source discriminator identifies the untracked case
- **AND** the consumer does not need to string-match the human-readable source label
