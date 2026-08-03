## 1. Release Seal Contract

- [x] 1.1 Configure the established GitHub Actions bot identity before annotated release-tag creation.
- [x] 1.2 Add a regression assertion for identity values and ordering.
- [x] 1.3 Provide explicit repository context to the checkout-free publication job.
- [x] 1.4 Add a regression assertion that publication retains both explicit repository context and no checkout.

## 2. Validation and Delivery

- [x] 2.1 Run focused tests and the required lint, format, typecheck, test, and OpenSpec validation commands.
- [ ] 2.2 Commit, push, merge the fix PR, regenerate the 1.8.0 Release PR, and complete release publication verification.
