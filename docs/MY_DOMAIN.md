# My Domain prototype (DAD-4278)

Clickable My Domain experience for the XD Labs workshop. Figma is the source of truth for the two designed screens; `public/rule_repo_sample.xlsx` is the source of truth for rule metadata. Everything else is labelled synthetic or provisional on screen.

## Run

```
pnpm install
pnpm start                    # http://localhost:4200/#/my-domain
pnpm test                     # util specs
pnpm build
```

Regenerate the data after editing the workbook (needs any installed `xlsx` package):

```
XLSX_MODULE=<path to node_modules/xlsx> node scripts/build-my-domain-data.cjs
```

## Journey

`Set up My Domain → Home → Data products → Overview → Tables | Dimensions | Rules → Table / Dimension / Rule details → Failure analysis → Issue`

| Route (hash) | Screen |
|---|---|
| `/my-domain/setup` | Figma "Set up My Domain": domain cards, products by sub-domain, selection panel |
| `/my-domain/home` | Figma "Welcome": scope chips, score tiles, rules table |
| `/my-domain/products` | Data product selection: search, filter, sort |
| `/my-domain/products/:id` (+ `/tables`, `/dimensions`, `/rules`) | Product overview and tabs |
| `/my-domain/products/:id/tables/:table` | Columns and rules of a table (`?col=` filters) |
| `/my-domain/products/:id/dimensions/:dimension` | Rules of a dimension |
| `/my-domain/products/:id/rules/:ruleId` | Rule details, SQL, latest run, failure analysis |
| `/my-domain/issues/:id` | Mock issue |

Rules table state is in the URL (`q`, `dim`, `tbl`, `col`, `st`, `act`, `fail`, `sort`, `dir`, `page`, `size`), so links share views and Back/Forward work. The chosen scope is remembered in `localStorage`; **Reset demo data** clears it.

Demo states: use the Screen state chips (Loading, Error, Empty). Domain cards show no-access (Engineering) and empty (Manufacturing). Quality shows partial data. The Plant table is stale. Inactive rules show "Not run".

## Feature flag

`my-domain` (`src/app/core/feature-flags`). Off: the tab is hidden and every `/my-domain` route redirects to Data Remediation (route guard). Toggle in the header, or deep link `#/my-domain?ff=my-domain:off`.

## Architecture

- `features/my-domain/core/my-domain-api.ts`: `MyDomainApi` abstract class. `MockMyDomainApi` reads the JSON files; provide an HTTP class in `app.config.ts` to go live. No component changes.
- `my-domain-store.service.ts`: signals, scope persistence, computed views. `my-domain.util.ts`: pure filter/sort/page/score helpers (spec'd).
- Shared UI added to `src/app/ui`: breadcrumbs, state-panel, origin-tag, pagination.

## Data: what is real and what is not

| Dataset | Origin | Contents |
|---|---|---|
| `public/data/my-domain/rule-repository.json` | **Workbook** | 100 rules, 3 tables, 96 table-column pairs: ID, name, description, priority, dimension, table, column, source, active flag, definition-updated date, SQL |
| `public/data/my-domain/domain-catalogue.json` | **Figma / provisional** | Domains, sub-domains, Quality products (from Figma); Material Master and Transportation (from the workbook, mapping provisional); trustee, owner, steward, classification (demo) |
| `public/data/my-domain/demo-execution.json` | **Synthetic** | Per-rule checks, failed, score; 14 failing demo rules with samples, trend, root cause, issue; product, table and dimension scores; row counts; refresh times; 10 mock issues |

Cleaning applied to the workbook: 120 rows became 100 rules. 20 rows held wrapped lines of SQL for rules SC.TP.928 and SC.TP.927 and were stitched back. The text "null" is read as missing. 58 rules have no name; the UI shows the description in italics (never an invented name). Nothing else is generated.

Scores use a stated demo method (record-weighted pass rate over active rules). Nothing computes a production score.

Mapping check: Material Master = `ref_materialmstr_erp_glbl` and `ref_materialmstr_plant_erp_glbl` (source PRDCLNT100 / ERP, 38 rules). Transportation = `gmsgq_txn_sapbw_e2e_shipment_glbl` (source Supply Chain / Transport Operations, 62 rules). The workbook never names "Master Data Management" or the product names, so both mappings stay **provisional**.

## Kept separate on purpose

Active (rule switched on) vs execution result; priority ("1 - Critical", all 100 rules) vs failure severity; definition-updated date vs execution date; product lifecycle vs quality score; likely vs confirmed root cause ("Not yet identified." when unknown).

## Open items

1. The workbook covers only Supply Chain. Quality products (from Figma) have no rules, so they show a partial-data state. Quality's 72% / 86% in the Figma mock are not reproduced.
2. Figma shows Quality pre-selected. The prototype suggests Supply Chain because it is the only domain with rule data.
3. No column metadata beyond column names with rules (no types, descriptions, null rates).
4. Figma has no frames for tables, dimensions, rules, rule details, failure analysis or issues. They extend the existing design language and need design review.
5. Figma "Show/Hide Column" and the gear are implemented as column toggles and a page-size menu.
6. Priority has only one value in the data, so priority filtering is not offered.
7. Real execution results, the failure ledger and issue source are needed to replace the synthetic file.
8. No design-ui-ux TDD was prepared or approved; this is a prototype in a standalone repo.

## Workshop walkthrough (about 6 minutes)

1. **Set up** (`/my-domain`): trustee products pre-ticked, Supply Chain suggested. Click Engineering (no access) and Manufacturing (empty), then back to Supply Chain, Save.
2. **Home**: scope chips, synthetic scores, 14 failing rules. Turn off Failing only, search "weight", sort by Dimension, page, press Back.
3. **Transportation**: overview (stale or failing callouts, provisional mapping), then Tables, a table's columns, Dimensions, Completeness.
4. **Rule**: open a failing rule. Definition and SQL are from the workbook; run results, samples, trend and root cause are synthetic. Note "Not confirmed" vs "Not yet identified."
5. **Issue**: open the related issue. "Start remediation" is disabled and labelled a future capability (DAD-4277).
6. **States and flag**: Loading, Error, Empty chips; toggle the `my-domain` flag and show the tab disappearing; Reset demo data.
