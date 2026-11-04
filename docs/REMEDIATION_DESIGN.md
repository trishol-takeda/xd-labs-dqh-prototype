# Remediation Hub: design notes (BICN-190272)

Discovery only. No production build and no feature-flag promotion.

## 1. Decisions taken as given

- Navigation follows the hierarchy: data product, tables, rules, records. Action follows the cause.
- A cause is (product, table, column, rule type, root-cause class, source system).
- The class comes from rule type × column class. The channel and owner role come from the class. A trustee never picks them.
- Classification is deterministic. Any AI is advisory only. This prototype has none.
- States: New → Confirmed → In progress → Closed, plus Reopened.
- Three trustee actions only. Closure is by the rule engine only. No "mark as fixed" and no records grid as the main surface.
- Copy is by system and cause, never by person. History is append-only.

## 2. How the workbook is used

`DQH_rule_categorisation.xlsx` gives, for each rule: plain name, what it checks, what a failure means, rule shape, and which table belongs to which product. All 114 failing rules in the mock data are KEEP rules in the workbook. The prototype uses the plain text as trustee-facing copy, the shape for classification, and the number of KEEP rules per product as the denominator of the quality score.

Rule shape × column class gives the same class the mock data already carried for all 114 rules, so the derivation is consistent with the data.

| Shape | Business column | Technical column |
|---|---|---|
| Presence (filled in, no placeholder) | Source not captured | Pipeline defect |
| Allowed values, numeric bound, format | Source value invalid | Pipeline defect |
| Date logic, conditional dependency | Process sequencing | Pipeline defect |
| Reference lookup | Missing master record | Pipeline defect |

Rule defect appears only through a challenge. It is not derived from a shape.

## 3. What the prototype does

| Zone | Content |
|---|---|
| Product strip | 11 products with a quality score and the number of open causes |
| Cause list | Grouped by state, most critical GxP band first, then by records failing. No owner names |
| Cause detail | What the rule checks, when it fails, probable cause and why, channel and owner role, counts per run, score lift, the three actions, sample records, history |

Seeded data: 31 New, 19 Confirmed, 27 In progress, 15 Reopened and 20 Closed. Twenty causes are closed because their latest DQH run emits no records. One cause is parked and two have accepted risk. Twenty-six causes sit on tables without a stable key.

Score: 100 minus the share of failing records, summed per rule, divided by the product's rule count. A risk acceptance does not change it. Score lift per cause is the same arithmetic if the cause stopped failing.

## 4. Blockers stated, not solved

1. The failure ledger does not exist. Preview mode simulates the next rule run and says so.
2. Six tables have no stable record key. The workbook does not say which, so the six in `rule-catalogue.json` are a placeholder. Their causes show no sample, cannot be simulated and carry a warning.
3. Score lift calculation and the ledger's context fields are still to validate with the Rules team.

## 5. Open questions

Q1 to Q9 are on the How it works page with the assumption made. They are the team's decisions, not mine.

## 6. Exit gate

Three trustees, unaided: find a product, understand an issue, confirm, send for correction, see the request recorded. In the prototype: choose a product, open a New cause, Confirm this cause, Send for correction with a reason, and read the recorded request under "What you can do" and in History.
