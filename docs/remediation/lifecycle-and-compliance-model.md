# Remediation Hub — End-to-End Lifecycle and Compliance Model

Nov 5, 2026 · @Rohit N

> Context document supplied by the product owner. It is the companion to the v4 build pack (`tmp/remediation-hub-build-pack-v4`). Where the build prompt is silent, this document and the storyboard decide. Sections 5, 10a and 11 were revised in November 2026 for v3/v4.

## 1. Purpose, scope and compliance position

The Remediation Hub is a controlled workflow for getting data-quality failures corrected where they originated, with the correction confirmed by the rule engine rather than asserted by a person. It records decisions; it never changes GxP data.

That sentence is the whole compliance position. The Hub is a decision and evidence system that sits beside validated source systems (SAP, LIMS, TrackWise, MES, Veeva, JDE). Every data correction happens inside the source system under that system's own change control and audit trail. The Hub holds who was asked to correct what, why, when, and what the engine saw afterwards.

| In scope | Out of scope |
| --- | --- |
| Grouping failing records into causes, deterministically | Editing, patching or overwriting any source or Databricks data |
| Routing a cause to the role that can fix it | Owning the rule catalogue or rule engine (Rules team / DG) |
| Recording confirmations, disputes, risk acceptances | Deciding what a rule should check (rule authorship) |
| Verifying closure from engine runs only | Scoring maturity (stars); the Hub touches the live quality score only |
| Immutable audit trail of every decision | Record-by-record editing of any kind |

The unit of work is the **cause**: one table × one root cause × (to be decided) one site. Records are evidence; checks explain; the cause is what moves through the lifecycle.

## 2. Governing principles applied to remediation

Seven principles decide every design question below. When two options are open, the one that keeps these intact wins.

| Principle | What it means in the Hub |
| --- | --- |
| Fix at source, never in the pipeline | Corrections are made in the system of record by its own users under its own controls. The Hub never writes to source or to Databricks tables. Pipeline defects are fixed in the load code under platform change control, not by editing data. |
| Engine closes, people don't | A cause is Fixed only when a rule run returns zero failing records. No person can mark a cause fixed. This removes the incentive to tidy up a dashboard and keeps closure evidence objective. |
| Deterministic before advisory | Root cause is derived from rule type × column class by a published decision table. Any AI explanation is advisory, labelled as such, and never the record of why a decision was made. |
| Attributable, Legible, Contemporaneous, Original, Accurate (+ Complete, Consistent, Enduring, Available) | Every action carries an authenticated user identity, a server timestamp, a reason where judgement was exercised, and is written once to an append-only log that is retained and retrievable for the record's lifetime. |
| Risk-based depth | Controls scale with the data product's GxP tier: GxP critical gets shorter targets, a second signature on acceptance and stricter verification; Business gets the lightest path. |
| Segregation of duties | The person who sends a cause for correction cannot be the person who declares the fix made for the same cause; on GxP critical data the trustee cannot accept residual risk alone. |
| Systems and causes, never people | Nothing in the Hub ranks, times or compares individuals. Ageing and volume are reported per system and per cause. |

Regulatory anchors: 21 CFR Part 11 (electronic records and signatures), EU GMP Annex 11 (computerised systems), and the data-integrity guidance that both agencies apply (ALCOA+). The Hub is a GxP-relevant computerised system because its records support decisions about GxP data; see section 11 for what that implies.

## 3. Actors and RACI

Seven roles touch a cause. Roles, not names, appear anywhere in the Hub; identities live only in the audit log.

| Role | Who (typically) | Does in the Hub |
| --- | --- | --- |
| Data trustee | Business owner of a data product (from the AIData register) | Reviews causes, confirms, sends for correction, disputes, accepts residual risk |
| Source-system owner | Business owner of SAP / LIMS / TrackWise / MES / Veeva data at a site | Corrects records in the source system; marks done or can't fix |
| Business process owner | Owner of the process that created the sequencing error | Same as source-system owner, for process_sequencing causes |
| Master data owner | MDM team | Creates or corrects master records; marks done or can't fix |
| Data engineering | PIC platform engineers | Fixes the load under platform change control; marks done or can't fix |
| Rules team (DG) | Owner of the rule catalogue and engine | Answers disputes; publishes rule versions; owns the decision table |
| Quality approver | QA representative for the site or domain | Second signature on GxP critical risk acceptances; periodic review of acceptances |
| Rule engine | System | Detects, groups, closes, reopens; the only actor that changes a cause's failing count |

| Activity | Trustee | Fixer roles | Rules team | QA approver | Platform (PIC) |
| --- | --- | --- | --- | --- | --- |
| Maintain decision table and column class | C | I | **A/R** | C | I |
| Confirm a cause | **A/R** | I | I | I | I |
| Send for correction | **A/R** | I | I | I | I |
| Correct data at source / in load | I | **A/R** | I | I | C |
| Declare correction made | I | **R** | I | I | I |
| Verify closure | I | I | I | I | **A** (engine) |
| Dispute a rule | **R** | I | **A** | I | I |
| Change a rule version | C | I | **A/R** | C | I |
| Accept residual failures (GxP relevant, Business) | **A/R** | I | I | I | I |
| Accept residual failures (GxP critical) | **R** | I | I | **A** | I |
| Review open acceptances | **R** | I | I | **A** | I |
| Operate and validate the Hub | I | I | I | C | **A/R** |

## 4. Preconditions before the lifecycle can run

The lifecycle is only as trustworthy as these nine inputs. Each has an owner and a definition of done; none is a Hub feature.

| # | Precondition | Owner | Done when |
| --- | --- | --- | --- |
| 1 | Approved, versioned rule catalogue | Rules team | Every active rule has an ID, version, plain name, what-it-checks and what-a-failure-means text; duplicates removed (7 known) |
| 2 | Column class per rule | Rules team | Every rule carries business or technical as a catalogue attribute, not a name pattern |
| 3 | Published decision table | Rules team, QA approves | Rule type × column class → root cause → fixer lane, under change control |
| 4 | Failure ledger | Rules team / engine | Per run: record_key, rule_id, rule_version, run_id, first_seen, last_seen, still_failing, failing_value; append-only |
| 5 | Source-native record keys | Data governance | Every table in scope has a key the source system recognises; six tables currently lack one |
| 6 | Site dimension on records | Data governance | Each failing record can be attributed to a site/plant, or the cause is explicitly global |
| 7 | Routing table | Data governance with site QA | Source system × site × fixer lane → owning group and notification channel |
| 8 | Trustee and QA approver register | AIData | Product → trustee role → named individuals; site → QA approver |
| 9 | Identity and access | PIC platform | SSO (Entra ID) identities; role assignment reviewed at a set cadence; no shared accounts |

Until 4 and 5 exist, the Hub can run only in preview mode with simulated verification, and every screen says so.

## 5. The lifecycle, stage by stage

Revised 9 Nov 2026 (v3). Seven stages. The system does the drafting; a person confirms once; the engine verifies and closes. A person composes nothing unless they disagree with the system, and disagreement is the audited exception.

1. **Detected (engine).** Each scheduled run evaluates every active rule version against its table and appends failing records to the ledger with run_id and rule_version. Nothing is deleted; a record that stops failing gets still_failing = false. Findings are created or updated as table × symptom × site, with the four population segments computed from the table's lifecycle and creation fields.
2. **Proposed (system, deterministic with narration).** For every new finding the system drafts: a *scope* (in-flight, recent and new records in; history parked, with the standard rationale); a *root-cause hypothesis* from the data pattern (site concentration, onset date, field co-occurrence, symptom spread, column class) with its evidence lines and a confidence; an *action plan* mapped from the hypothesis (root cause → levers → owner group and channel from the routing table, interim control where a change request is involved, acceptance of parked history with its approvers and review date); and a *Quality flag* (impact pre-assessed from tier × field criticality × parked volume, deviation required or not). A language model may phrase the hypothesis and evidence for reading; it decides nothing and is never the record of decision.
3. **Confirmed (trustee, one action).** The trustee reads the proposal and confirms it in one click, with an optional comment. Any block may be overridden before confirming: a different scope, root cause or plan, each with a mandatory reason; the original proposal is retained beside the override. On GxP critical data the Quality approver then concurs in their own lane, and where the flag requires it raises the deviation and records its reference. Impact is Quality's call, not the trustee's.
4. **Raised (Hub → channels).** On confirmation the Hub creates each action in its channel (change request, platform ticket, master data request, acceptance) and stores the reference returned. Acceptances require the trustee's electronic signature and, on GxP critical data, the Quality approver's; an acceptance is not raised until both are present.
5. **Live (owner, outside the Hub).** The owner makes the change in the source system, the load or the master data under that system's own change control; the Hub reads status from the channel and records the effective date. Where a permanent change takes months, the interim control's start date is the effective date for verification.
6. **Verified (engine only).** Two signals: no record created after the effective date fails the checks for N consecutive runs (bleed stopped), and the in-scope backlog is zero or covered by a signed acceptance. One of two shows as *Fixed going forward, backlog open*.
7. **Closed (engine).** Both signals hold → Closed, actor Rule engine. The finding stays visible with its full history and inspection export. New failures after closure reopen it automatically at *Proposed*, linked to the prior proposal and actions.

States in section 7 map as: new/scoped/investigated → Proposed; actions_open → Raised; verifying → Live or Verified; closed/accepted → Closed. Actions carry their own lifecycle: proposed → raised → live → done.

*(The original document embeds a diagram here: remediation lifecycle · 7 stages, engine-closed loop.)*

People act only in Triage, Route and Fix; the engine owns detection, grouping, verification, closure and reopening.

## 6. Exception paths

Four paths leave the main loop. Each is a recorded decision with a required reason, and none of them changes a failing count.

**Dispute the rule (trustee → Rules team).** The trustee states why the rule is wrong for this table. The cause is parked (status unchanged, Send disabled) and a dispute is opened against the rule at its current version. Dispute scope is the rule-on-table: every product built on that table sees the dispute. The Rules team either confirms the rule stands (dispute closed, cause returns to the trustee) or changes it. A rule change is a change-controlled event: new version number, impact assessment on every table using the rule, QA approval for rules on GxP critical products, and an effective-from run. Counts re-baseline from the first run on the new version; earlier runs keep the old version in the history so a trend is never silently rewritten.

**Accept remaining failures (trustee, with QA approver on GxP critical data).** Used when records will never be corrected: archived history, decommissioned systems, a legitimate business exception. Required: a reason, a review date (default 12 months, 6 for GxP critical), and on GxP critical data a second electronic signature from the QA approver. The cause moves to Accepted (shown as Fixed with an Accepted badge); the score does not change, because the data is still wrong and the score must say so. Acceptances appear on a register reviewed at the set cadence; an acceptance that passes its review date without renewal returns the cause to Needs you.

**Can't fix (fixer → trustee).** The fixer states why (no edit rights, source read-only, business rule prevents it). The cause returns to the trustee with the reason attached, who then accepts, disputes, or re-routes to a different lane if the original classification was wrong. A re-route is itself recorded with a reason.

**Reopen (engine).** A closed or accepted cause whose records fail again in a later run reopens automatically with the engine as actor. The earlier correction request and any acceptance are linked, so the trustee sees the history before deciding. Three reopenings of the same cause within a rolling 90 days raise it to the monthly system review as a recurrence.

## 7. State machine

Seven internal states, three visible statuses, and every transition names its only allowed actor. A transition not in this table is refused by the system, not by a guideline.

| From | Event | To | Allowed actor | Required fields | Visible as |
| --- | --- | --- | --- | --- | --- |
| — | Cause first detected | New | Rule engine | run_id, rule versions, count | Needs you |
| New | Confirm | Confirmed | Trustee | identity, timestamp (reason optional) | Needs you |
| New / Confirmed | Send for correction | In progress | Trustee | fixer lane (derived), routing target, note, SLA | Waiting on fixer |
| New / Confirmed / In progress | Dispute | same state + disputed flag | Trustee | reason, rule version disputed | Needs you · Disputed |
| any disputed | Rule stands | same state, flag cleared | Rules team | decision note | as before |
| any disputed | Rule changed | same state, flag cleared, new rule version | Rules team (+ QA on GxP critical) | new version, impact assessment, effective run | as before |
| In progress | Done, awaiting run | In progress + fixer_done | Fixer (not the sender) | identity, timestamp, note | Waiting on fixer · Fixer says done |
| In progress | Can't fix | Confirmed + wont_fix | Fixer | reason | Needs you · Fixer says won't fix |
| Confirmed | Re-route | Confirmed, new lane | Trustee | reason, new lane | Needs you |
| New / Confirmed | Accept residual | Accepted | Trustee; plus QA approver on GxP critical | reason, review date, e-signature(s) | Fixed · Accepted |
| In progress / Confirmed | Zero failing for N clean runs | Closed | Rule engine | run_ids | Fixed |
| In progress + fixer_done | Still failing on next run | Confirmed | Rule engine | run_id, count | Needs you |
| Closed / Accepted | Records fail again | Reopened | Rule engine | run_id, count, link to prior request | Needs you · Came back |
| Reopened | Confirm / Send / Dispute / Accept | as from Confirmed | Trustee | as above | — |
| Accepted | Review date passed, not renewed | Confirmed | System clock | — | Needs you |

N clean runs: 3 for GxP critical, 2 for GxP relevant, 1 for Business (proposed; section 10). A state change never deletes the prior state; it appends.

## 8. Audit trail and record specification

Every event writes one immutable entry. The entry is the record; the screen is a view of it.

**Every audit entry carries**

| Field | Content | Why |
| --- | --- | --- |
| event_id | System-generated, sequential | Detect gaps or tampering |
| cause_id, cause_version | The cause and its membership version at the time | A cause whose rule set changed is a different record |
| event | One of the transition names in section 7 | Legible without interpretation |
| actor_id, actor_role | Authenticated SSO identity and the role exercised | Attributable; segregation checks |
| server_timestamp | UTC, set by the server, never the client | Contemporaneous |
| reason | Free text, mandatory where section 7 says | Judgement is explained once, at the time |
| rule_versions | The versions in force for the cause's checks | Counts are only comparable within a version |
| run_id | For engine events | Ties the decision to the evidence |
| failing_count_before, failing_count_after | Snapshot | Shows what the actor saw |
| signature | Signature manifestation where required (section 9) | Part 11 §11.50 |
| prior_event_id | Hash-chained link to the previous entry on this cause | Enduring, tamper-evident |

**Retained alongside the trail**

- Correction requests: the exact sample records, note and routing target sent to the fixer.
- Dispute records: the reason, the rule text and version disputed, the Rules team's decision and its approval.
- Acceptance register: reason, review date, approvers, renewals.
- Rule catalogue versions and the decision table versions in force at each run.
- The ledger itself, append-only, with run metadata.

**Not retained in the Hub**: source-system data values beyond the failing value already in the ledger, personal information beyond the SSO identity, and any AI-generated text as a record of decision (advisory text may be logged as advisory, never as reason).

The trail is read-only to every role including administrators. Corrections to a mistaken entry are made by a new compensating entry that references the mistaken one.

## 9. Electronic signatures, access control and segregation of duties

Three actions are signed; everything else is attributed. Signing is reserved for decisions that change the compliance posture of GxP data, so that signatures stay meaningful.

| Action | Signature required | By | Manifestation |
| --- | --- | --- | --- |
| Accept residual failures, GxP critical | Yes, two | Trustee, then QA approver | Name, date-time, meaning ("risk accepted" / "approved"), linked to the acceptance record |
| Accept residual failures, GxP relevant or Business | Yes, one | Trustee | As above |
| Publish a changed rule version used on GxP critical data | Yes, two | Rules team, then QA | Linked to the rule version and impact assessment |
| Confirm, Send, Dispute, Done, Can't fix, Rule stands | No; attributed | Acting role | Identity and timestamp from SSO session |

Signature mechanics follow Part 11 Subpart C: re-authentication at the point of signing (password or MFA step-up through Entra ID), the two-component rule for the first signing in a session, signature bound to the record so it cannot be copied to another, and a visible manifestation on the record and any printout. Signatures are never delegated to the Hub itself; the Hub calls the enterprise identity provider.

**Access control**

- Roles are granted per data product (trustee), per source system and site (fixer), or globally (Rules team, QA approver, platform). Grants are reviewed quarterly and on role change; the review is itself recorded.
- No shared or service accounts can perform transitions. Engine events are signed by the engine's own system identity.
- Read access is wide (anyone in GMSGQ can see causes); write access is narrow and role-bound.

**Segregation of duties, enforced by the system**

- The identity that sent a cause cannot declare it done.
- A trustee who is also a QA approver cannot provide both signatures on one acceptance.
- A Rules team member cannot approve their own rule change on GxP critical data.
- Platform administrators cannot write audit entries or alter state; they can only operate the system.

## 10. Risk-based controls by GxP tier

One lifecycle, three depths. The tier is the data product's GxP classification from the data-product register, in the words QA already uses: **GxP critical** (supports a GxP decision or record), **GxP relevant** (used in GxP processes, not decision-bearing on its own), **Business** (no GxP bearing). A pipeline-defect cause takes the product's tier but routes to engineering without trustee triage if the workshop agrees.

| Control | GxP critical | GxP relevant | Business |
| --- | --- | --- | --- |
| Target to first trustee action | 5 working days | 15 working days | 30 working days |
| Target for fixer response (done or can't fix) | 10 working days | 25 working days | 45 working days |
| Clean runs before Closed | 3 | 2 | 1 |
| Acceptance signatures | Trustee + QA approver | Trustee | Trustee |
| Acceptance review period | 6 months | 12 months | 24 months |
| Rule change approval | Rules team + QA | Rules team | Rules team |
| Recurrence escalation | 2 reopenings in 90 days | 3 in 180 days | review only |
| Notification on new cause | Trustee, immediately | Daily digest | Weekly digest |

Targets are measured per system and per cause and reported as ageing distributions, never as a per-person league table. Missing a target does not change state; it raises the cause in the trustee's queue and in the monthly review. On screen the tier is one short label on the cause; only GxP critical is coloured, so the eye lands on what matters and nothing else competes.

All figures in this table are proposals for the workshop and QA to set; the structure (tier drives depth) is the design decision.

## 10a. Channel read-back, escalation and the other v3 controls (added 10 Nov 2026)

**Channel read-back.** Owners never open the Hub; they work in their own systems. Stages 4 and 5 are therefore driven by reading state back from each channel, not by anyone clicking in the Hub.

| Channel | Read | Maps to action status | Effective date |
| --- | --- | --- | --- |
| Change-request system (MES, LIMS, SAP, TrackWise, Veeva) | CR state, assignee, implementation date | Submitted → Sent to owner · Accepted/Approved → Accepted by owner · Implemented → Live · Closed → Done · Rejected/Cancelled → Declined (reason from the CR) | Implementation date |
| Platform ticketing (DE) | Ticket state, resolution, deploy date | Open → Sent · In progress → Accepted · Deployed → Live · Resolved → Done · Won't do → Declined | Deploy date |
| Master data request | Request state, completion date | Same pattern | Completion date |
| Hub acceptance | Signatures | Signed by all required → Live; review date passed → finding reopens | Last signature |
| Deviation (TrackWise) | Deviation state, impact conclusion | Open → badge Deviation open · Closed with no impact → the Quality flag is updated and the parked history may move to acceptance · Closed with impact → the finding cannot close until the CAPA reference is recorded | — |

Cadence: read every channel at least daily and on every scheduled check run. Conflict rule: the channel is the system of record for the action's state; the Hub never writes to a channel other than to create the request. Where the channel and the Hub disagree, the Hub shows the channel's state and records the discrepancy as an audit event for review. A reference that disappears from a channel is a discrepancy, not a closure.

**Escalation ladder.** Every action carries an accept-by and a live-by target from the tier. Days past target drive a fixed ladder, applied by the system and shown on the action: 0 days → *Due* · 3 working days → *Reminder sent* to the owner group · 7 → *Escalated to site Quality* · 15 → *On the monthly review* with the domain lead. The ladder never changes an action's status; it changes who is told. Escalations are reported per system and per cause, never per person.

**Confirmation on GxP critical data is a signed decision.** Confirming a proposal parks records, sets a root cause and raises actions; on GxP critical data this requires the same re-authentication as a signature and is recorded as *confirmed (electronic signature: confirmed scope, root cause and plan)*. On other tiers confirmation is attributed, not signed. Rationale: nothing is accepted until the acceptance itself is signed, but the confirmation is the point at which the trustee commits the finding to a path, and on critical data that commitment is the decision an inspector will ask about.

**Accept-only plans on GxP critical data are held.** If the only ticked action is Accept, the confirmation goes to the Quality approver before anything is raised; the trustee cannot accept critical data alone by unticking the corrective actions. Overrides remain recorded as the exception, with the original proposal retained.

**Acceptance review has behaviour.** When an acceptance reaches its review date the finding reopens at *Proposed* with the acceptance marked as due for renewal; the previous actions remain on the record as superseded. Nothing lapses silently.

**Declined actions stay visible.** A re-plan supersedes the declined action but never removes it from the finding's action list; it is shown struck through with the owner's reason, so the sequence *declined at the site → re-raised globally* is readable without opening the audit trail.

**Root-cause strength is evidence, not probability.** The proposal shows how many of the defined data signals fired (site concentration, field co-occurrence, onset pattern, symptom implies cause) as Strong / Moderate / Weak. No percentage is shown, because none can be justified.

## 11. Validation and change control of the Hub itself

The Hub is a GxP-relevant computerised system (its records support decisions about GxP data) and is validated as such, in a risk-based way that keeps the effort on the parts that matter.

**Classification.** GAMP 5 category 4/5: configured platform with custom code (the grouping service, state machine, audit log). The rule engine and ledger are validated separately by their owners; the Hub's validation covers the boundary (what it reads) and its own logic (how it groups, transitions, records and signs).

**Validation boundary after v3.** Inside: the grouping and segmentation logic, the proposal engine's deterministic parts (the evidence signals, the root-cause mapping, the root cause → lever mapping, the Quality flag rule), the state machine including hold-for-Quality and the escalation ladder, the channel read-back mapping, the audit trail, signatures and segregation of duties. Outside: the narration layer that phrases the proposal (its output is never the record), visual layout and copy, and preview or simulation controls, which are verified as absent in production.

**What is validated, in priority order**

1. Audit trail completeness and immutability: every transition in section 7 writes the fields in section 8; no path exists that changes state without an entry; entries cannot be edited or deleted by any role.
2. The state machine: only the allowed actor can perform each transition; refused transitions are logged.
3. Grouping determinism: the same ledger input always yields the same causes; a change to the decision table is versioned and re-baselines, never rewrites.
4. Electronic signatures: re-authentication, binding, manifestation, two-signature enforcement for GxP critical acceptances.
5. Segregation of duties rules.
6. Access control and role review.
7. Score computation agrees with the Data Quality page to the same formula.

**What is not validated as GxP**: visual layout, copy, sort order, the advisory text, and preview mode (which is excluded from production by configuration and verified as absent).

**Change control.** Changes to the decision table, routing table, tier parameters (section 10) and rule versions go through documented change control with impact assessment; they are data changes with GxP effect, not code deployments. Code changes to the Hub follow the platform's validated release process with regression on items 1 to 6. Configuration (feature flags) is version-controlled and its production state is part of the validated baseline.

**Periodic review.** Annual: audit trail sampling, access review evidence, open acceptances, decision-table currency, and any recurrence trends that suggest a rule or a classification is wrong.

## 12. Data retention, reporting and KPIs

**Retention.** Audit entries, correction requests, disputes, acceptances and the rule and decision-table versions they reference are retained for the longest retention period of any GxP record the underlying data supports (batch-record retention governs for manufacturing products), and in any case not less than the site's computerised-system record policy. The ledger is retained for the same period. Retention is enforced by the platform, not by the Hub, and deletion at end of life is itself a recorded event.

**Reporting, always per system and per cause.** The monthly review receives: open causes by product and tier, ageing distribution against the targets in section 10, causes closed by the engine, acceptances opened and due for review, disputes and rule changes, recurrences. None of these cut by person.

**KPIs that show the Hub is working**

| KPI | Definition | Why it matters |
| --- | --- | --- |
| Time to first action | Detection to first trustee transition, median per tier | Causes are being looked at |
| Closure within three runs | Share of sent causes closed by the engine within three runs of Send | Fixes are real, not declared |
| Open-cause trend | Open causes per product, month over month | The backlog is shrinking |
| Reopen rate | Reopenings per 100 closures, rolling 90 days | Fixes hold |
| Acceptance share | Accepted causes as a share of resolved, per tier | Acceptance is not becoming the easy exit |
| Dispute outcome | Disputes upheld (rule changed) vs rule stands | The catalogue is improving |
| Engineering share | Causes routed to data engineering as a share of all | How much debt was never the business's to fix |

Targets for each KPI are set after one quarter of live data; the first quarter establishes the baseline.

## 13. Open decisions for the workshop and QA

Ten decisions close this model. Each has a proposed default so the workshop can confirm rather than invent.

| # | Decision | Proposed default | Who decides |
| --- | --- | --- | --- |
| 1 | Is site part of the cause key? | Yes, where the source system is site-managed; global otherwise | Data governance + site QA |
| 2 | Do technical-column causes bypass trustee triage? | Yes: routed to data engineering on detection, trustee informed | Workshop |
| 3 | Dispute scope | Per rule-on-table, visible to every product on that table | Rules team |
| 4 | Clean runs before Closed per tier | 3 / 2 / 1 | QA |
| 5 | Which actions are signed | Acceptances and GxP critical rule changes only (section 9) | QA |
| 6 | Acceptance review periods | 6 / 12 / 24 months | QA |
| 7 | Fixer interaction: in the Hub or in the fixer's own ticketing tool with status read back | Hub for the prototype; ticketing integration assessed for production | Workshop + PIC |
| 8 | Residual threshold for Accept | No numeric threshold; any residual may be accepted with reason and signature | QA |
| 9 | Advisory AI text | Allowed, labelled, never stored as reason; off until the deterministic path is validated | Workshop |
| 10 | Validation ownership of the boundary with the engine | Rules team validates ledger production; Hub validates ledger consumption | QA + Rules team |

Decisions 1, 4, 5 and 10 change the data model or validation scope and must be taken before production design starts. The rest can be set during build.
