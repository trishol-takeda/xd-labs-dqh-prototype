# DQ Remediation prototype (BICN-190272)

A standalone Angular prototype for the XD Labs workshop. It is the Remediation Hub of the Data Quality Hub: a trustee finds a data product, understands why records fail, confirms the cause and sends it for correction. The rule engine, not the trustee, confirms the fix. Mock DQH data only.

## Run

```
pnpm install
pnpm start          # http://localhost:4200
pnpm build          # dist/dq-remediation-prototype/browser
```

Hash routing, so deep links work on any static host.

## The model in one paragraph

Failing records are grouped into a **cause** (product, table, column, rule type, root-cause class, source system). The cause is the unit of work: 114 failing rules become 112 causes. The class comes from rule type × column class, and the channel and owner role come from the class. States are New, Confirmed, In progress, Closed and Reopened. The trustee has three actions: Send for correction, This rule is wrong, Accept remaining failures. Closing and reopening happen only when the rule engine runs, and there is no "mark as fixed". Every action is written to an append-only history.

## Screens

| Route | Screen |
|---|---|
| `/#/my-domain` | **My Domain** tab: placeholder for a second prototype |
| `/#/remediation` | **Data Remediation** tab, Remediation Hub: product strip, causes grouped by state, cause detail. Selection is in the URL: `?product=Deviations&cause=<id>` |
| `/#/remediation/flow` | Data Remediation, How it works: lifecycle, the three actions, routing table, known gaps, open questions |

`/#/` opens Data Remediation. Deep links for screen states: `/#/remediation?demo=loading`, `?demo=error`, `?demo=empty`.

Preview mode (`REMEDIATION_PREVIEW_MODE`) is on: the failure ledger does not exist, so each cause shows a "simulate the next rule run" panel and the page says so.

## Data

| File | Source |
|---|---|
| `public/data/signatures.json`, `findings.json`, `products.json` | DQH mock data, unchanged |
| `public/data/rule-catalogue.json` | Generated from `DQH_rule_categorisation.xlsx`: plain name, what a rule checks, what a failure means, rule shape, and the rule count per product (KEEP rules). Also holds a **placeholder** list of six tables without a stable key |
| `public/DQH_rule_categorisation.xlsx` | The workbook it came from |

## Code map

| Path | Contents |
|---|---|
| `src/app/core/models/remediation.model.ts` | Data shapes and derived views |
| `src/app/core/constants/remediation.constants.ts` | States, classification, routing, copy, open questions |
| `src/app/core/state/derive.ts` | Pure functions: grouping, cause views, score, engine run, seed |
| `src/app/core/state/remediation-store.service.ts` | Loads data; the three actions, confirmation and the preview-mode engine |
| `src/app/features/hub/*` | Product strip, cause list, cause detail, actions, sample records, engine preview, audit trail |
| `src/app/features/flow/*` | How it works |
| `src/takos-tokens.css` | takOS design tokens |

## Open questions

Nine questions are listed on the How it works page, each with the assumption the prototype makes. The ones that change the screens most: the state of a parked or risk-accepted cause (Q1), what moves a cause to In progress (Q2), whether Confirm is a fourth action (Q3), and e-signature for risk acceptance under 21 CFR Part 11 (Q4).

Earlier versions are backed up in `../dq-remediation-prototype-v1-backup` and `../dq-remediation-prototype-v2-backup` (the issue, root cause and verification workflow).
