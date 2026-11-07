import { BACKLOG_REDUCED_REMAINING, CHECK_CHANGE_REMAINING, ENGINE, NEW_FAILURE_FALLBACK_DIVISOR, QA_ROLE, RULES_ROLE, RUN_INTERVAL_DAYS, SOME_NEW_REMAINING } from './remediation.constants';
import { ActionInput, Dataset, Finding, ImpactInput, InvestigationInput, Role, ScopeInput, SimulationInput } from './remediation.model';
import { addDays, advanceTarget, channelFor, fmtDate, full, openCheckChange, segmentKeysFor, signalState, trusteeOf } from './remediation.util';

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

/* ---------- the trustee's four decisions ---------- */

export function setScope(d: Dataset, id: string, input: ScopeInput, at: string): Dataset {
  return apply(d, id, (f, draft) => {
    const keys = segmentKeysFor(draft.vocab, draft.registry.tables.find((t) => t.id === f.table));
    const by = trusteeOf(draft, f);
    f.decisions.scope = {
      inScope: input.inScope,
      parked: keys.filter((k) => !input.inScope.includes(k)),
      reason: input.reason,
      by,
      qaConcurrence: f.tier === 'critical',
      concurred: false,
      at,
    };
    f.state = 'scoped';
    f.signals.backlog.inScopeRemaining = input.inScope.filter((k) => k !== 'newSinceDetection').reduce((sum, k) => sum + f.segments[k], 0);
    f.audit.push({ at, by, event: 'scoped', text: `Scope set: ${input.reason}` });
  });
}

export function concurWithScope(d: Dataset, id: string, at: string): Dataset {
  return apply(d, id, (f) => {
    if (f.decisions.scope) f.decisions.scope.concurred = true;
    f.audit.push({ at, by: QA_ROLE, event: 'scope_concurred', text: 'Scope concurred' });
  });
}

export function assessImpact(d: Dataset, id: string, input: ImpactInput, role: Role, at: string): Dataset {
  return apply(d, id, (f, draft) => {
    const critical = f.tier === 'critical';
    const by = role === 'qa' ? QA_ROLE : trusteeOf(draft, f);
    const deviationRef = critical && input.assessment !== 'none' ? input.deviationRef : null;
    f.decisions.impact = { assessment: input.assessment, note: input.note, deviationRef, by };
    f.audit.push({ at, by, event: 'impact', text: `Impact ${input.assessment}${deviationRef ? `; deviation ${deviationRef}` : ''}: ${input.note}` });
  });
}

export function recordRootCause(d: Dataset, id: string, input: InvestigationInput, at: string): Dataset {
  return apply(d, id, (f, draft) => {
    const by = trusteeOf(draft, f);
    f.decisions.investigation = { rootCauses: input.rootCauses, note: input.note, otherSitesChecked: input.otherSitesChecked, by, at };
    f.state = 'investigated';
    const labels = input.rootCauses.map((k) => draft.vocab.rootCauses.find((r) => r.key === k)?.label ?? k).join(', ');
    f.audit.push({ at, by, event: 'investigated', text: `Root cause: ${labels} · ${input.note}` });
  });
}

/** Plan one action. An acceptance stays open until every required signature is present; other levers go live with a date. */
export function addAction(d: Dataset, id: string, input: ActionInput, at: string): Dataset {
  return apply(d, id, (f, draft) => {
    const lever = draft.vocab.levers[input.lever];
    const route = channelFor(draft.registry, f.sourceSystem, input.lever, f.site);
    const accept = input.lever === 'accept';
    const live = !accept && !!input.effectiveDate;
    f.actions.push({
      id: `${f.id}:a${f.actions.length + 1}`,
      lever: input.lever,
      leverLabel: lever.label,
      ownerRole: route.owner,
      channel: route.channel,
      reference: input.reference,
      effectiveDate: input.effectiveDate,
      status: live ? 'live' : 'open',
      interimControl: input.interimControl,
      scopeSegments: input.covers,
      approvals: accept ? (f.tier === 'critical' ? ['Data trustee', QA_ROLE] : ['Data trustee']) : [],
      reviewBy: input.reviewBy,
      trusteeSigned: false,
      qaSigned: false,
    });
    if (accept) {
      const covered = input.covers.reduce((sum, k) => sum + f.segments[k], 0);
      const coveredInScope = input.covers.filter((k) => f.decisions.scope?.inScope.includes(k)).reduce((sum, k) => sum + f.segments[k], 0);
      f.signals.backlog.acceptedCount += covered;
      f.signals.backlog.inScopeRemaining = Math.max(0, f.signals.backlog.inScopeRemaining - coveredInScope);
    }
    f.state = 'actions_open';
    f.visibleStatus = 'in_progress';
    if (live && !f.signals.bleedStopped.since) f.signals.bleedStopped.since = input.effectiveDate;
    f.audit.push({ at, by: trusteeOf(draft, f), event: 'action_added', text: `Action: ${lever.label} via ${route.channel}${input.reference ? ` (${input.reference})` : ''}` });
  });
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
    if (a.trusteeSigned && (f.tier !== 'critical' || a.qaSigned)) {
      a.status = 'live';
      a.effectiveDate = a.effectiveDate ?? draft.vocab.asOf;
    }
  });
}

/* ---------- prototype controls: the fixers' side ---------- */

/** Moves the first open action to live (effective today), or the first live action to done. */
export function advanceAction(d: Dataset, id: string, at: string): Dataset {
  return apply(d, id, (f, draft) => {
    const a = advanceTarget(f);
    if (!a) return;
    if (a.status === 'open') {
      a.status = 'live';
      a.effectiveDate = a.effectiveDate ?? draft.vocab.asOf;
      if (!f.signals.bleedStopped.since) f.signals.bleedStopped.since = a.effectiveDate;
      f.audit.push({ at, by: a.ownerRole, event: 'action_live', text: `${a.leverLabel} live (${a.reference || a.channel})` });
    } else {
      a.status = 'done';
      f.audit.push({ at, by: a.ownerRole, event: 'action_done', text: `${a.leverLabel} done` });
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

/** After a check: closed when both signals hold, back to the trustee if a closed finding fails again, otherwise verifying. */
function settle(f: Finding, newFailing: number, at: string): void {
  const { bleedOk, backlogOk } = signalState(f);
  const sg = f.signals;
  if (f.visibleStatus === 'fixed' && newFailing > 0) {
    f.state = 'scoped';
    f.visibleStatus = 'needs_you';
    f.cameBack = true;
    f.fixedGoingForward = false;
    f.audit.push({ at, by: ENGINE, event: 'came_back', text: `${full(newFailing)} new records failing after closure. Finding reopened.` });
    return;
  }
  if (f.visibleStatus === 'fixed' || !f.actions.length) {
    f.audit.push({ at, by: ENGINE, event: 'check', text: `Check: ${full(newFailing)} new failures` });
    return;
  }
  if (bleedOk && backlogOk) {
    f.state = 'closed';
    f.visibleStatus = 'fixed';
    f.fixedGoingForward = false;
    f.cameBack = false;
    f.audit.push({ at, by: ENGINE, event: 'closed', text: 'Both signals held. Finding closed.' });
    return;
  }
  f.state = 'verifying';
  f.visibleStatus = 'in_progress';
  f.fixedGoingForward = bleedOk && !backlogOk;
  f.audit.push({ at, by: ENGINE, event: 'check', text: `Check: ${full(newFailing)} new failures, ${full(sg.backlog.inScopeRemaining)} in scope remaining` });
}

/** Appends a weekly check, recomputes both verification signals and moves the finding on. */
export function simulateCheck(d: Dataset, id: string, input: SimulationInput): Dataset {
  return apply(d, id, (f) => {
    const run = addDays(f.history[f.history.length - 1].run, RUN_INTERVAL_DAYS);
    const newFailing = nextNewFailures(f, input.newFailures);
    const sg = f.signals;
    if (input.backlog === 'cleared') sg.backlog.inScopeRemaining = 0;
    else if (input.backlog === 'reduced') sg.backlog.inScopeRemaining = Math.round(sg.backlog.inScopeRemaining * BACKLOG_REDUCED_REMAINING);

    const parked = f.decisions.scope ? f.decisions.scope.parked.reduce((sum, k) => sum + f.segments[k], 0) - sg.backlog.acceptedCount : 0;
    const version = f.history[f.history.length - 1].ruleVersion;
    f.history.push({ run, failing: Math.max(0, sg.backlog.inScopeRemaining + sg.backlog.acceptedCount + parked + newFailing), newFailing, ruleVersion: version });

    if (f.actions.some((a) => a.status !== 'open')) sg.bleedStopped.cleanChecks = newFailing === 0 ? sg.bleedStopped.cleanChecks + 1 : 0;
    settle(f, newFailing, `${run}T06:00:00Z`);
  });
}
