import {
  BACKLOG_REDUCED_REMAINING,
  CHECK_CHANGE_REMAINING,
  ENGINE,
  HUB,
  NEW_FAILURE_FALLBACK_DIVISOR,
  QA_ROLE,
  RULES_ROLE,
  RUN_INTERVAL_DAYS,
  SOME_NEW_REMAINING,
} from './remediation.constants';
import { ConcurInput, Dataset, Finding, FindingAction, Override, OverrideInput, PlanAction, SegmentKey, SimulationInput } from './remediation.model';
import {
  addDays,
  advanceTarget,
  fmtDate,
  full,
  inScopeKeys,
  leverPlan,
  openCheckChange,
  parkedRecords,
  planFromRootCause,
  referenceFor,
  segmentKeysFor,
  signalState,
  trusteeOf,
} from './remediation.util';

/**
 * The lifecycle rules as pure functions: each takes the dataset and returns a new one, never touching the input.
 * Every transition appends an audit entry; nothing edits or removes one. Only the (simulated) checks close or reopen a finding.
 * `at` is passed in so the functions stay deterministic and testable.
 */

function apply(d: Dataset, id: string, change: (f: Finding, draft: Dataset) => void): Dataset {
  const draft = structuredClone(d);
  const finding = draft.findings.find((f) => f.id === id);
  if (!finding) return d;
  change(finding, draft);
  return draft;
}

const segmentsOf = (f: Finding, keys: readonly SegmentKey[]): number => keys.reduce((sum, k) => sum + f.segments[k], 0);

/* ---------- the trustee's one step ---------- */

/**
 * Replaces one block of the proposal. The reason is required by the caller; the original stays on record in the override,
 * staged until the trustee confirms. Overriding the root cause re-derives the plan from `planFor`.
 */
export function overrideBlock(d: Dataset, id: string, input: OverrideInput, at: string): Dataset {
  return apply(d, id, (f, draft) => {
    if (f.stage !== 'proposed') return;
    const by = trusteeOf(draft, f);
    const p = f.proposal;
    const v = input.value;
    let from: unknown;
    let to: unknown;
    if (v.block === 'scope') {
      const keys = segmentKeysFor(draft.vocab, draft.registry.tables.find((t) => t.id === f.table));
      from = p.scope.inScope;
      to = v.inScope;
      p.scope = { ...p.scope, inScope: v.inScope, parked: keys.filter((k) => !v.inScope.includes(k)) };
    } else if (v.block === 'rootCause') {
      const label = draft.vocab.rootCauses.find((r) => r.key === v.key)?.label ?? v.key;
      from = p.rootCause.key;
      to = v.key;
      p.rootCause = { key: v.key, label, confidence: 1, summary: `Overridden by the trustee: ${label}.`, evidence: [] };
      p.plan = planFromRootCause(draft, f, v.key);
    } else {
      from = p.plan.map((a) => a.lever);
      to = v.levers;
      p.plan = v.levers.map((lever) => leverPlan(draft, f, lever, 'Chosen by the trustee'));
    }
    const staged: Override = { block: v.block, from, to, reason: input.reason, by };
    f.pendingOverrides = [...(f.pendingOverrides ?? []).filter((o) => o.block !== v.block), staged];
    f.audit.push({ at, by, event: 'override_staged', text: `Override of ${v.block === 'rootCause' ? 'root cause' : v.block === 'plan' ? 'action plan' : 'scope'}: ${input.reason}` });
  });
}

/** One click: confirms the proposal as drafted or as overridden, raises the actions in their channels, and hands it on to Quality. */
export function confirmProposal(d: Dataset, id: string, comment: string, at: string): Dataset {
  return apply(d, id, (f, draft) => {
    if (f.stage !== 'proposed') return;
    const p = f.proposal;
    const by = trusteeOf(draft, f);
    const overrides = f.pendingOverrides ?? [];
    f.confirmation = {
      by,
      at,
      overrides,
      comment,
      qaConcurred: !p.qa.concurrenceNeeded,
      qaImpact: p.qa.assessment,
      deviationRef: null,
      scope: { inScope: [...p.scope.inScope] },
    };
    f.actions = p.plan.map((a: PlanAction, i): FindingAction => ({
      ...a,
      id: `${f.id}:a${i + 1}`,
      approvals: a.approvals ?? [],
      reviewBy: a.reviewBy ?? null,
      reference: referenceFor(f.id, i, a.lever),
      effectiveDate: null,
      status: 'raised',
      trusteeSigned: false,
      qaSigned: false,
    }));
    f.stage = 'raised';
    f.visibleStatus = 'in_progress';
    f.cameBack = false;
    f.signals.backlog.inScopeRemaining = segmentsOf(f, p.scope.inScope.filter((k) => k !== 'newSinceDetection'));
    delete f.pendingOverrides;
    f.audit.push({
      at,
      by,
      event: 'confirmed',
      text: `Proposal confirmed${overrides.length ? ` with ${overrides.length} override${overrides.length === 1 ? '' : 's'}: ${overrides.map((o) => `${o.block} (${o.reason})`).join('; ')}` : ' as drafted'}${comment ? ` · ${comment}` : ''}`,
    });
    for (const a of f.actions) {
      f.audit.push({ at, by: HUB, event: 'raised', text: `${a.leverLabel} raised with ${a.ownerRole} via ${a.channel}${a.reference ? ` (${a.reference})` : ''}` });
    }
    if (p.qa.concurrenceNeeded) {
      f.audit.push({ at, by: HUB, event: 'qa_requested', text: `Sent to the Quality approver for concurrence; impact pre-assessed as ${p.qa.assessment}` });
    }
  });
}

/** The Quality approver concurs in their own lane and, where the proposal requires it, records the deviation reference. */
export function qaConcur(d: Dataset, id: string, input: ConcurInput, at: string): Dataset {
  return apply(d, id, (f) => {
    if (!f.confirmation) return;
    const deviationRef = f.proposal.qa.requiresDeviation ? input.deviationRef : null;
    f.confirmation.qaConcurred = true;
    f.confirmation.deviationRef = deviationRef;
    f.audit.push({
      at,
      by: QA_ROLE,
      event: 'qa_concurred',
      text: `Scope and plan concurred; impact ${f.proposal.qa.assessment}${deviationRef ? `; deviation ${deviationRef} raised` : ''}${input.note ? ` · ${input.note}` : ''}`,
    });
  });
}

/** An acceptance going live: the records it covers are counted as accepted and leave the in-scope backlog. */
function goLive(f: Finding, a: FindingAction, asOf: string): void {
  a.status = 'live';
  a.effectiveDate = a.effectiveDate ?? asOf;
  f.stage = 'live';
  if (!f.signals.bleedStopped.since) f.signals.bleedStopped.since = a.effectiveDate;
  if (a.lever === 'accept') {
    const covered = segmentsOf(f, a.scopeSegments);
    const coveredInScope = segmentsOf(f, a.scopeSegments.filter((k) => inScopeKeys(f).includes(k)));
    f.signals.backlog.acceptedCount += covered;
    f.signals.backlog.inScopeRemaining = Math.max(0, f.signals.backlog.inScopeRemaining - coveredInScope);
  }
}

/** Electronic signature on an acceptance. The action goes live only when every required signature is present. */
export function signAction(d: Dataset, id: string, actionId: string, who: string, at: string): Dataset {
  return apply(d, id, (f, draft) => {
    const a = f.actions.find((x) => x.id === actionId);
    if (!a) return;
    const approver = who === QA_ROLE;
    if (approver) a.qaSigned = true;
    else a.trusteeSigned = true;
    f.audit.push({ at, by: who, event: 'signed', text: `Electronic signature: ${approver ? 'approved' : 'risk accepted'} · ${a.reference || ''}` });
    if (a.status === 'raised' && a.trusteeSigned && (f.tier !== 'critical' || a.qaSigned)) goLive(f, a, draft.vocab.asOf);
  });
}

/* ---------- prototype controls: the fixers' side ---------- */

/** Moves the first raised action to live (effective today), or the first live action to done; the last one done verifies the finding. */
export function advanceAction(d: Dataset, id: string, at: string): Dataset {
  return apply(d, id, (f, draft) => {
    const a = advanceTarget(f);
    if (!a) return;
    if (a.status === 'raised') {
      goLive(f, a, draft.vocab.asOf);
      f.audit.push({ at, by: a.ownerRole, event: 'action_live', text: `${a.leverLabel} live (${a.reference || a.channel})` });
    } else {
      a.status = 'done';
      f.audit.push({ at, by: a.ownerRole, event: 'action_done', text: `${a.leverLabel} done` });
      if (f.actions.every((x) => x.status === 'done')) f.stage = 'verified';
      if (a.lever === 'fix_check') f.signals.backlog.inScopeRemaining = f.segments.inFlight;
    }
  });
}

/* ---------- Rules team ---------- */

export function publishCheckChange(d: Dataset, id: string, what: string, at: string): Dataset {
  return apply(d, id, (f) => {
    const action = openCheckChange(f);
    const last = f.history[f.history.length - 1];
    const version = (last.ruleVersion ?? 1) + 1;
    if (action) {
      action.status = 'done';
      action.outcome = 'changed';
    }
    const remaining = Math.round(f.segments.inFlight * CHECK_CHANGE_REMAINING);
    f.segments.inFlight = remaining;
    f.signals.backlog.inScopeRemaining = remaining;
    f.history.push({ run: addDays(last.run, RUN_INTERVAL_DAYS), failing: remaining + f.segments.historical, newFailing: 0, ruleVersion: version });
    f.audit.push({
      at,
      by: RULES_ROLE + (f.tier === 'critical' ? ` + ${QA_ROLE}` : ''),
      event: 'check_changed',
      text: `Check changed to version ${version}: ${what}. Counts re-baselined from ${fmtDate(addDays(last.run, RUN_INTERVAL_DAYS))}.`,
    });
  });
}

export function checkStands(d: Dataset, id: string, at: string): Dataset {
  return apply(d, id, (f) => {
    const action = openCheckChange(f);
    if (action) {
      action.status = 'done';
      action.outcome = 'stands';
    }
    f.audit.push({ at, by: RULES_ROLE, event: 'check_stands', text: 'Check reviewed: it stands as written. Scope returns to the trustee.' });
  });
}

/* ---------- the next check (simulated) ---------- */

function nextNewFailures(f: Finding, choice: SimulationInput['newFailures']): number {
  if (choice === 'none') return 0;
  const previous = f.history[f.history.length - 1].newFailing || Math.max(1, Math.round(f.segments.newSinceDetection / NEW_FAILURE_FALLBACK_DIVISOR));
  return choice === 'some' ? Math.max(1, Math.round(previous * SOME_NEW_REMAINING)) : previous;
}

/**
 * After a check: a closed finding that fails again goes back to the proposal (confirmation and actions cleared, "Came back");
 * both signals holding closes it; otherwise it stays in progress, verified once every action is done.
 */
function settle(f: Finding, newFailing: number, at: string): void {
  const { bleedOk, backlogOk } = signalState(f);
  const sg = f.signals;
  if (f.stage === 'closed' && newFailing > 0) {
    f.stage = 'proposed';
    f.confirmation = null;
    f.actions = [];
    delete f.pendingOverrides;
    f.visibleStatus = 'needs_you';
    f.cameBack = true;
    f.fixedGoingForward = false;
    f.audit.push({ at, by: ENGINE, event: 'came_back', text: `${full(newFailing)} new records failing after closure. Finding reopened.` });
    return;
  }
  if (f.stage === 'closed' || !f.actions.length) {
    f.audit.push({ at, by: ENGINE, event: 'check', text: `Check: ${full(newFailing)} new failures` });
    return;
  }
  if (bleedOk && backlogOk) {
    f.stage = 'closed';
    f.visibleStatus = 'fixed';
    f.fixedGoingForward = false;
    f.cameBack = false;
    for (const a of f.actions) a.status = 'done';
    f.audit.push({ at, by: ENGINE, event: 'closed', text: 'Both signals held. Finding closed.' });
    return;
  }
  f.visibleStatus = 'in_progress';
  f.fixedGoingForward = bleedOk && !backlogOk;
  f.audit.push({ at, by: ENGINE, event: 'check', text: `Check: ${full(newFailing)} new failures, ${full(sg.backlog.inScopeRemaining)} in scope remaining` });
}

/** Appends a weekly check, recomputes both verification signals and moves the finding on. */
export function simulateCheck(d: Dataset, id: string, input: SimulationInput): Dataset {
  return apply(d, id, (f, draft) => {
    const run = addDays(f.history[f.history.length - 1].run, RUN_INTERVAL_DAYS);
    const newFailing = nextNewFailures(f, input.newFailures);
    const sg = f.signals;
    if (input.backlog === 'cleared') sg.backlog.inScopeRemaining = 0;
    else if (input.backlog === 'reduced') sg.backlog.inScopeRemaining = Math.round(sg.backlog.inScopeRemaining * BACKLOG_REDUCED_REMAINING);

    const keys = segmentKeysFor(draft.vocab, draft.registry.tables.find((t) => t.id === f.table));
    const parked = Math.max(0, parkedRecords(f, keys) - sg.backlog.acceptedCount);
    const version = f.history[f.history.length - 1].ruleVersion;
    f.history.push({ run, failing: Math.max(0, sg.backlog.inScopeRemaining + sg.backlog.acceptedCount + parked + newFailing), newFailing, ruleVersion: version });

    if (f.actions.some((a) => a.status === 'live' || a.status === 'done')) sg.bleedStopped.cleanChecks = newFailing === 0 ? sg.bleedStopped.cleanChecks + 1 : 0;
    settle(f, newFailing, `${run}T06:00:00Z`);
  });
}
