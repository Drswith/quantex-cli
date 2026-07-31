## 1. Self-upgrade behavior

- [x] 1.1 Make explicit self-upgrade observation refresh version metadata before availability planning.
- [x] 1.2 Add regression coverage for a valid cached version that is older than the freshly resolved version.

## 2. Validation and delivery

- [x] 2.1 Run self-upgrade tests and required repository validation.
- [x] 2.2 Validate the OpenSpec change, commit, push, and create the implementation PR.

## 3. Package compatibility repair

- [x] 3.1 Keep the explicit self-upgrade cache override out of the maintained v1 root declaration contract.
- [x] 3.2 Re-run package-distribution validation and the affected self-upgrade regression coverage.
