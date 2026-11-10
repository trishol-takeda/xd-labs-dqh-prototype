import {
  BACKLOG_REDUCED_REMAINING,
  GLOBAL_SITE,
  REPLAN_WHY,
  CHECK_CHANGE_REMAINING,
  ENGINE,
  HUB,
  NEW_FAILURE_FALLBACK_DIVISOR,
  QA_ROLE,
  RULES_ROLE,
  RUN_INTERVAL_DAYS,
  SOME_NEW_REMAINING,
} from './remediation.constants';
import { ConcurInput, ConfirmInput, Dataset, Finding, FindingAction, Override, OverrideInput, PlanAction, SegmentKey, SimulationInput } from './remediation.model';
import {
  acceptOnly,
  addDays,
  advanceTarget,
  declineTarget,
  declinedAction,
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
      p.rootCause = { key: v.key, label, strength: 'trustee', signalsFired: 0, signalsTotal: 0, narration: null, rule: 'Set by the trustee; see the override reason' };
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

/** Switches one proposed action on or off. Unticked actions stay visible but are left out of the confirmation. */
export function setPlanInclude(d: Dataset, id: string, index: number, include: boolean): Dataset {
  return apply(d, id, (f) => {
    const a = f.proposal.plan[index];
    if (f.stage === 'proposed' && a) a.include = include;
  });
}

function sentenceOverrides(overrides: readonly Override[]): string {
  if (!overrides.length) return ' as drafted';
  const plural = overrides.length === 1 ? '' : 's';
  return ` with ${overrides.length} override${plural}: ${overrides.map((o) => `${o.block} (${o.reason})`).join('; ')}`;
}

function raiseText(a: FindingAction): string {
  return `${a.leverLabel} raised with ${a.ownerRole} via ${a.channel}${a.reference ? ` (${a.reference})` : ''}`;
}

/**
 * Confirms one finding: the ticked actions are created and sent to their owners. On GxP critical data the confirmation is signed;
 * an Accept-only plan is held for the Quality approver and nothing is raised until they concur.
 */
function confirmOne(f: Finding, draft: Dataset, input: Pick<ConfirmInput, 'comment' | 'signed'>, at: string, together?: string): void {
  const p = f.proposal;
  const by = trusteeOf(draft, f);
  const overrides = f.pendingOverrides ?? [];
  const held = acceptOnly(f);
  const ticked = p.plan.filter((a) => a.include !== false);
  f.confirmation = {
    by,
    at,
    overrides,
    comment: input.comment,
    qaConcurred: !p.qa.concurrenceNeeded,
    qaImpact: p.qa.assessment,
    deviationRef: null,
    scope: { inScope: [...p.scope.inScope] },
    ...(held ? { heldForQa: true } : {}),
  };
  f.actions = ticked.map((a: PlanAction, i): FindingAction => ({
    ...a,
    id: `${f.id}:a${i + 1}`,
    approvals: a.approvals ?? [],
    reviewBy: a.reviewBy ?? null,
    sentAt: at.slice(0, 10),
    reference: referenceFor(f.id, i, a.lever),
    effectiveDate: null,
    status: held ? 'proposed' : 'raised',
    trusteeSigned: false,
    qaSigned: false,
  }));
  f.stage = held ? 'confirmed' : 'raised';
  f.visibleStatus = 'in_progress';
  f.cameBack = false;
  f.reviewDue = false;
  f.signals.backlog.inScopeRemaining = segmentsOf(f, p.scope.inScope.filter((k) => k !== 'newSinceDetection'));
  delete f.pendingOverrides;
  const signed = input.signed ? ' (electronic signature: confirmed scope, root cause and plan)' : '';
  const hold = held ? ' — Accept is the only action: held for Quality concurrence before raising' : '';
  const note = [input.comment, together].filter(Boolean).join(' · ');
  f.audit.push({
    at,
    by,
    event: input.signed ? 'confirmed_signed' : 'confirmed',
    text: `Proposal confirmed${signed}${hold}${sentenceOverrides(overrides)}${note ? ` · ${note}` : ''}`,
  });
  if (!held) for (const a of f.actions) f.audit.push({ at, by: HUB, event: 'raised', text: raiseText(a) });
  if (p.qa.concurrenceNeeded) f.audit.push({ at, by: HUB, event: 'qa_requested', text: `Sent to the Quality approver for concurrence; impact pre-assessed as ${p.qa.assessment}` });
}

/** One click: confirms the proposal (and, if asked, the same plan at the other sites), raises the ticked actions with their owners. */
export function confirmProposal(d: Dataset, id: string, input: ConfirmInput, at: string): Dataset {
  return apply(d, id, (f, draft) => {
    if (f.stage !== 'proposed') return;
    confirmOne(f, draft, input, at);
    for (const siblingId of input.alsoSiteIds) {
      const sibling = draft.findings.find((x) => x.id === siblingId);
      if (!sibling || sibling.stage !== 'proposed') continue;
      sibling.proposal.plan.forEach((a, i) => (a.include = f.proposal.plan[i]?.include !== false));
      confirmOne(sibling, draft, { comment: input.comment, signed: input.signed }, at, `confirmed together with ${f.site}`);
    }
  });
}

/** The Quality approver concurs in their own lane and, where the proposal requires it, records the deviation reference. A held plan is raised now. */
export function qaConcur(d: Dataset, id: string, input: ConcurInput, at: string): Dataset {
  return apply(d, id, (f) => {
    if (!f.confirmation) return;
    const deviationRef = f.proposal.qa.requiresDeviation ? input.deviationRef : null;
    f.confirmation.qaConcurred = true;
    f.confirmation.deviationRef = deviationRef;
    if (f.confirmation.heldForQa) {
      for (const a of f.actions) {
        a.status = 'raised';
        a.sentAt = at.slice(0, 10);
        f.audit.push({ at, by: HUB, event: 'raised', text: raiseText(a) });
      }
      f.stage = 'raised';
      f.confirmation.heldForQa = false;
    }
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

/* ---------- prototype controls: the owners' side ---------- */

/**
 * Moves the next action on: sent → accepted by the owner → live (effective today) → done.
 * An Accept cannot leave "sent" until it is signed; the last action done verifies the finding.
 */
export function advanceAction(d: Dataset, id: string, at: string): Dataset {
  return apply(d, id, (f, draft) => {
    const a = advanceTarget(f);
    if (!a) return;
    if (a.status === 'raised') {
      a.status = 'accepted';
      f.audit.push({ at, by: a.ownerRole, event: 'action_accepted', text: `${a.leverLabel} accepted by the owner${a.reference ? ` (${a.reference})` : ''}` });
    } else if (a.status === 'accepted') {
      goLive(f, a, draft.vocab.asOf);
      f.audit.push({ at, by: a.ownerRole, event: 'live', text: `${a.leverLabel} live (${a.reference || a.channel})` });
    } else {
      a.status = 'done';
      f.audit.push({ at, by: a.ownerRole, event: 'action_done', text: `${a.leverLabel} done` });
      if (f.actions.every((x) => x.status === 'done')) f.stage = 'verified';
      if (a.lever === 'fix_check') f.signals.backlog.inScopeRemaining = f.segments.inFlight;
    }
  });
}

/** The owner declines: the finding goes back to the trustee, with the reason, until it is re-planned. */
export function declineAction(d: Dataset, id: string, reason: string, at: string): Dataset {
  return apply(d, id, (f) => {
    const a = declineTarget(f);
    if (!a) return;
    a.status = 'declined';
    a.declineReason = reason;
    f.stage = 'confirmed';
    f.visibleStatus = 'needs_you';
    f.audit.push({ at, by: a.ownerRole, event: 'action_declined', text: `${a.leverLabel} declined: ${reason}` });
  });
}

/** Re-plan after a decline: the proposal reopens with the declined action re-routed to the global owner and the others unticked. Nothing is removed. */
export function replan(d: Dataset, id: string, at: string): Dataset {
  return apply(d, id, (f, draft) => {
    const declined = declinedAction(f);
    if (!declined) return;
    f.supersededActions = [...(f.supersededActions ?? []), ...f.actions.map((a) => ({ ...a, archived: true }))];
    f.actions = [];
    f.proposal.plan = f.proposal.plan.map((a) =>
      a.lever === declined.lever
        ? { ...a, include: true, ownerRole: a.ownerRole.replace(` · ${f.site}`, ` · ${GLOBAL_SITE}`), why: REPLAN_WHY }
        : { ...a, include: false },
    );
    f.confirmation = null;
    f.stage = 'proposed';
    f.visibleStatus = 'needs_you';
    f.audit.push({ at, by: trusteeOf(draft, f), event: 'replan', text: `Re-planning after decline of ${declined.leverLabel}` });
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
