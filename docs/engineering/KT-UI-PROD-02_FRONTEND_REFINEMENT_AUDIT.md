# KT-UI-PROD-02 Production Frontend Refinement Audit

Date: 2026-08-25 Asia/Shanghai

## Production findings

1. Route descriptions repeat section headings and read like operating-manual prose.
2. Collection/legal content had no route token, so it leaked into governance instead of remaining in receivables.
3. Least-privilege users fall back to an internal employee identifier when employee directory access is absent.
4. Successful form closure can hide a rejected business command; feedback needs a durable toast and field-level error contract.
5. Governance repeats capability explanations on every card and exposes counts without prioritizing actions or exceptions.
6. Dense workbenches rely on stacked paragraphs where metadata rows, status labels and progressive disclosure are more appropriate.

## Remediation order

1. Fix route leakage and shorten global route/subsection copy.
2. Establish shared status, empty-state, error, table-toolbar and action hierarchy patterns.
3. Traverse every route against its backend capability family and atomic roles.
4. Replace explanatory paragraphs with labels, tooltips or contextual help only where a decision needs explanation.
5. Verify desktop, tablet and 390px layouts, keyboard focus, loading/empty/error states and forbidden actions.
