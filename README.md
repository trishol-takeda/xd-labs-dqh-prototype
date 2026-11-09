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

Trustee → Data product → Table → Field → Check → Failing records → **Finding** → Decisions → Actions → Verification. A finding is one table × symptom × site and is already computed in the data. Its failing records are split into four population segments (new since detection, open, recent, historical); the headline is the segments, never the total. The system drafts a proposal (scope, root cause with evidence, action plan, Quality pre-assessment); the trustee confirms it in one click or overrides a block with a reason, and the Quality approver concurs in their own lane. Seven stages: Detected → Proposed → Confirmed → Raised → Live → Verified → Closed. Actions are routed to an owner group at a site; electronic signatures are required on acceptances. Two signals decide closure (bleed stopped, backlog cleared or accepted) and only the simulated checks close or reopen a finding. Four roles: Data trustee, Quality approver, Rules team, Leadership. Every decision appends to an audit history.

## Screens

| Route | Screen |
|---|---|
| `/#/my-domain` | **My Domain** tab (DAD-4278), behind the `my-domain` feature flag: set up scope, home, products, tables, dimensions, rules, failure analysis, issue. See [docs/MY_DOMAIN.md](docs/MY_DOMAIN.md) |
| `/#/remediation` | **Data Remediation** tab: role landing (a trustee gets *Start here* and their own products) |
| `/#/remediation/all` | All products |
| `/#/remediation/overview` | Overview (leadership): headline, three numbers, trend, where to look first, domains, breakdowns |
| `/#/remediation/p/:productId` | Product: its tables (a single-table product opens its table) |
| `/#/remediation/t/:tableId` | Table: all checks, findings in Needs you / In progress / Fixed by impact score |
| `/#/remediation/f/:findingId` | Finding: journey, proposal card (confirm or override), segments, failing fields, actions, signals, history |
| `/#/remediation/f/:findingId/records` | The first 50 failing records |
| `/#/remediation/f/:findingId/export` | Inspection export (plain text) |
| `/#/remediation/queue` | The role's queue: Needs me, Scope & impact, Check changes |
| `/#/remediation/register` | Acceptances register |

`/#/` opens Data Remediation. The grey prototype bar switches the screen state, the role, the trustee's domain, advances an action and simulates the next check on a finding screen, and resets the seeded data.

## Data

| File | Source |
|---|---|
| `public/data/remediation/{vocab,registry,findings,rules}.json` | Remediation Hub build pack v3 (`tmp/remediation-hub-build-pack-v3`). Read-only: loaded once, mutated in memory, never hand-edited |

## Code map

| Path | Contents |
|---|---|
| `src/app/features/remediation/core/remediation.model.ts` | Data shapes, transition inputs and view models |
| `src/app/features/remediation/core/remediation.constants.ts` | Copy, roles, status labels, mock factors |
| `src/app/features/remediation/core/remediation.util.ts` | Pure selectors: badges, journey, verdict, routing, export text |
| `src/app/features/remediation/core/remediation.overview.ts` | Pure selectors behind the Overview |
| `src/app/features/remediation/core/remediation.transitions.ts` | The lifecycle as pure functions (proposal override and confirm, Quality concurrence, actions, signatures, Rules team, simulated check) |
| `src/app/features/remediation/core/remediation-store.service.ts` | One signal store: loads data, holds role, domain and screen state, calls the transitions |
| `src/app/features/remediation/remediation-shell/` | Prototype bar, role-aware nav, toast, shared stylesheet (takOS tokens, `rh-` prefixed) |
| `src/app/features/remediation/*-page/` | The screens |
| `src/app/features/remediation/dialogs/` | Scope, impact, root cause, action, signature and changed-check dialogs |
| `src/app/features/remediation/shared/` | Chip, breadcrumbs, check list, finding row, journey strip, segment tiles, record grid, modal, product grid |
| `src/takos-tokens.css` | takOS design tokens |

## Open questions

The workshop decides: site in the finding key; QA concurrence at scope; in-scope vs whole-population score (both are shown); fixer interaction through external tickets with status read back.
