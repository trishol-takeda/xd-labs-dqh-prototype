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

Trustee → Data product → Table → Field → Check → Failing records → **Cause** → Fixer. A cause is one table × one root cause and is already computed in the data; the UI reads it and never groups or derives. The cause is the unit of work. Visible statuses are Needs you, Waiting on fixer and Fixed. The trustee can send a cause for correction, dispute the rule or accept the remaining failures; the fixer marks it done or can't fix it; the Rules team changes the rule or lets it stand. Only the (simulated) rule engine closes or reopens a cause, and there is no "mark as fixed". Every action appends to an audit history.

## Screens

| Route | Screen |
|---|---|
| `/#/my-domain` | **My Domain** tab (DAD-4278), behind the `my-domain` feature flag: set up scope, home, products, tables, dimensions, rules, failure analysis, issue. See [docs/MY_DOMAIN.md](docs/MY_DOMAIN.md) |
| `/#/remediation` | **Data Remediation** tab, Remediation Hub (screen 1: data products) |
| `/#/remediation/p/:productId` | Product: its tables |
| `/#/remediation/t/:tableId` | Table: all checks, and causes in Needs you / Waiting on fixer / Fixed |
| `/#/remediation/c/:causeId` | Cause: actions for the current role, failing checks, 10 sample records, trend, history |
| `/#/remediation/c/:causeId/records` | The first 50 failing records |
| `/#/remediation/queue` | The role's queue: Needs me (trustee), My fixes (fixer), Disputes (Rules team) |

`/#/` opens Data Remediation. Deep links for screen states: `/#/remediation?demo=loading`, `?demo=error`, `?demo=empty`.

Preview mode (`REMEDIATION_PREVIEW_MODE`) is on: the failure ledger does not exist, so each cause shows a "simulate the next rule run" panel and the page says so.

## Data

| File | Source |
|---|---|
| `public/data/remediation/{products,tables,rules,causes}.json` | Remediation Hub data from the product owner's build pack (`tmp/remediation-hub-build-pack`). Read-only: loaded once, mutated in memory, never hand-edited |

## Code map

| Path | Contents |
|---|---|
| `src/app/features/remediation/core/remediation.model.ts` | Data shapes and view models |
| `src/app/features/remediation/core/remediation.constants.ts` | Copy, status labels, roles, mock factors |
| `src/app/features/remediation/core/remediation.transitions.ts` | The lifecycle as pure functions (send, dispute, accept, fixer, rules team, simulated run, scores) |
| `src/app/features/remediation/core/remediation.seed.ts` | The workshop start state (disputed, rule-changed, fixer-done, can't-fix) |
| `src/app/features/remediation/core/remediation-store.service.ts` | One signal store: loads data, holds role and screen state, calls the transitions |
| `src/app/features/remediation/remediation-shell/` | Prototype bar, app bar, toast, and the shared stylesheet (carried over from the PO's HTML prototype; `rh-` prefixed) |
| `src/app/features/remediation/*-page/` | The five screens |
| `src/app/features/remediation/shared/` | Chip, breadcrumbs, check list, cause row, action dialog, sparkline, summary line |
| `src/takos-tokens.css` | takOS design tokens (the Remediation Hub does not use them yet) |

## Open questions

The workshop decides: technical-column causes straight to data engineering; dispute scope per table vs per product; three vs five visible statuses; fixer view in the Hub vs an external ticket; residual acceptance policy.
