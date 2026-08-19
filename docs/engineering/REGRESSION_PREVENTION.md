# Regression Prevention and Business UAT Gate

This is the repository-level playbook for preventing a change from being reported as complete when it only passes a narrow unit test.

## Required evidence for data-backed dropdowns

For every dropdown whose options come from business master data, verify the complete chain:

1. The source management page and source API return a real record for the same tenant.
2. The actual test role has the required read and action permissions; test read-only and action-only combinations where both are valid.
3. The frontend loader requests the source endpoint under that role.
4. The rendered form contains an option with the expected value and human-readable label.
5. The submitted value matches the backend contract (ID versus business code).
6. A real authenticated browser smoke/UAT run opens the dropdown and completes one safe business scenario.

Testing only a formatter/helper or only `/health` and `/ready` is insufficient evidence.

## Release gate

The delivery report must separate these claims:

- code tests passed;
- CI passed;
- deployment job completed;
- health/readiness passed;
- authenticated business UAT passed.

The feature is not business-complete until the last item has evidence, including the account role, route, source record, selected option, submitted request, and observed result. If credentials or environment access are unavailable, report UAT as pending rather than inferring success from lower-level checks.

## Incident-derived rule

When a user reports that a management page has data but a dependent form is empty, compare the two permission/load paths first. Then add a regression test for the exact role combination before redeploying.
