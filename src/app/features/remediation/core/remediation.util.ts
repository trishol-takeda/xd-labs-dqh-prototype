import {
  DEFAULT_REFERENCE_PREFIX,
  DEFAULT_REVIEW_BY,
  FIELD_SUMMARY_COUNT,
  HUB_ACCEPTANCE_CHANNEL,
  LEVERS_WITHOUT_REFERENCE,
  MS_PER_DAY,
  OVERRIDE_PLAN_SEGMENTS,
  QA_ROLE,
  RECORDS_PAGE_SIZE,
  REFERENCE_BASE,
  REFERENCE_PREFIX,
  REFERENCE_SPREAD,
  TRUSTEE_FALLBACK,
} from './remediation.constants';
import {
  BadgeView,
  Check,
  CheckItem,
  Dataset,
  Finding,
  FindingAction,
  JourneyStep,
  LeverKey,
  PlanAction,
  Product,
  RecordRow,
  Registry,
  RegistryTable,
  Role,
  SegmentKey,
  Stage,
  Summary,
  Vocab,
} from './remediation.model';

/* ---------- formatting ---------- */

/** 1,234 → 1k, 2,500,000 → 2.5M. */
export function compact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}

export function full(n: number): string {
  return Number(n).toLocaleString('en-GB');
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function plural(n: number, one: string, many = one + 's'): string {
  return n === 1 ? one : many;
}

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/* ---------- lookups (pure) ---------- */

export const isOpen = (f: Finding): boolean => f.visibleStatus !== 'fixed';
export const openOf = (list: readonly Finding[]): Finding[] => list.filter(isOpen);
export const ofProduct = (d: Dataset, p: Product): Finding[] => d.findings.filter((f) => f.products.includes(p.name));
export const ofTable = (d: Dataset, tableId: string): Finding[] => d.findings.filter((f) => f.table === tableId);
export const rulesOfTable = (d: Dataset, tableId: string): Check[] => d.rules.filter((r) => r.table === tableId);
export const byImpact = (a: Finding, b: Finding): number => b.impactScore - a.impactScore;

/** Records still to be corrected: open, recent and new (historical records are excluded from every count). */
export const actionable = (f: Finding): number => f.segments.inFlight + f.segments.recentClosed + f.segments.newSinceDetection;

export function segmentKeysFor(vocab: Vocab, table: RegistryTable | undefined): SegmentKey[] {
  return vocab.segmentOrder.filter((k) => k !== 'recentClosed' || table?.kind === 'transactional');
}

export function trusteeOf(d: Dataset, f: Finding): string {
  return d.registry.products.find((p) => p.name === f.products[0])?.trusteeRole ?? TRUSTEE_FALLBACK;
}

/** Owner group and channel for an action, from the routing table (system × site × lever) or the system's default channel. */
export function channelFor(reg: Registry, system: string, lever: LeverKey, site: string): { channel: string; owner: string; notify: string } {
  const route = reg.routing.find((x) => x.system === system && x.site === site && x.lever === lever);
  if (route) return { channel: route.channel, owner: route.ownerGroup, notify: route.notify };
  const defaults = { ...reg.channels['default'], ...(reg.channels[system] ?? {}) };
  const [channel, owner] = defaults[lever] ?? ['', ''];
  return { channel, owner, notify: '' };
}

/* ---------- finding state ---------- */

/** The finding waits for the trustee to confirm the system's proposal. */
export const awaitingConfirmation = (f: Finding): boolean => f.stage === 'proposed';

/** Confirmed, but the Quality approver has not yet concurred. */
export const awaitingConcurrence = (f: Finding): boolean => !!f.confirmation && f.proposal.qa.concurrenceNeeded && !f.confirmation.qaConcurred;

/** In scope now: the confirmed scope once there is one, the proposed scope before. */
export const inScopeKeys = (f: Finding): SegmentKey[] => f.confirmation?.scope?.inScope ?? f.proposal.scope.inScope;

/** Records outside the scope in force, among the segments the table has. */
export function parkedRecords(f: Finding, keys: readonly SegmentKey[]): number {
  const inScope = inScopeKeys(f);
  return keys.filter((k) => !inScope.includes(k)).reduce((sum, k) => sum + f.segments[k], 0);
}

export const hasOpenCheckChange = (f: Finding): boolean => f.actions.some((a) => a.lever === 'fix_check' && a.status !== 'done');
export const openCheckChange = (f: Finding): FindingAction | undefined => f.actions.find((a) => a.lever === 'fix_check' && a.status !== 'done');
export const acceptAction = (f: Finding): FindingAction | undefined => f.actions.find((a) => a.lever === 'accept');

export function badges(f: Finding): BadgeView[] {
  const list: BadgeView[] = [];
  if (f.pastTarget) list.push({ kind: 'over', label: 'Past target' });
  if (f.fixedGoingForward) list.push({ kind: 'badge', label: 'Fixed going forward' });
  if (f.confirmation?.deviationRef) list.push({ kind: 'badge', label: 'Deviation open' });
  if (f.confirmation?.overrides.length) list.push({ kind: 'badge', label: 'Proposal overridden' });
  if (hasOpenCheckChange(f)) list.push({ kind: 'badge', label: 'Check disputed' });
  if (f.cameBack) list.push({ kind: 'badge', label: 'Came back' });
  if (awaitingConcurrence(f)) list.push({ kind: 'badge', label: 'QA concurrence pending' });
  return list;
}

/** The roles' work queues. Trustee: own domain, needs-you; QA: confirmed proposals awaiting concurrence; Rules: open check changes. */
export function queueList(d: Dataset, role: Role, domain: string): Finding[] {
  if (role === 'qa') return d.findings.filter(awaitingConcurrence);
  if (role === 'rules') return d.findings.filter(hasOpenCheckChange);
  return d.findings.filter((f) => f.visibleStatus === 'needs_you' && f.domain === domain);
}

export function segWords(f: Finding): string {
  const s = f.segments;
  const openWord = s.labels.inFlight === 'Active records' ? 'active' : 'open';
  return `${compact(s.newSinceDetection)} new · ${compact(s.inFlight)} ${openWord}${s.recentClosed ? ` · ${compact(s.recentClosed)} recent` : ''} · ${compact(s.historical)} historical`;
}

export function fieldSummary(f: Finding, max = FIELD_SUMMARY_COUNT): string {
  return f.fields.slice(0, max).map((x) => x.name).join(', ') + (f.fields.length > max ? ` +${f.fields.length - max} more` : '');
}

/** Score that leaves out parked records: open, recent and new records of open findings, against the product's table sizes. */
export function inScopeScore(d: Dataset, p: Product): number {
  const total = p.tables.reduce((sum, id) => sum + (d.registry.tables.find((t) => t.id === id)?.approxRecords ?? 0), 0) || 1;
  const bad = openOf(ofProduct(d, p)).reduce((sum, f) => sum + actionable(f), 0);
  return Math.max(0, Math.round(10 * (100 - (100 * bad) / total)) / 10);
}

export function summarise(rules: readonly Check[], open: number): Summary {
  const failing = rules.filter((r) => r.failingNow > 0).length;
  return { checks: rules.length, passing: rules.length - failing, failing, open };
}

/* ---------- verification ---------- */

export function signalState(f: Finding) {
  const bleedOk = f.signals.bleedStopped.cleanChecks >= f.signals.bleedStopped.required;
  const backlogOk = f.signals.backlog.inScopeRemaining === 0;
  return { bleedOk, backlogOk };
}

export function verdict(f: Finding): { kind: 'fixed' | 'partial' | ''; label: string } {
  const { bleedOk, backlogOk } = signalState(f);
  if (bleedOk && backlogOk) return { kind: 'fixed', label: 'Fixed' };
  if (bleedOk) return { kind: 'partial', label: 'Fixed going forward · backlog open' };
  return { kind: '', label: 'Not yet' };
}

/** Date of the first run measured with a changed check, or null. */
export function checkChangedOn(f: Finding): string | null {
  const i = f.history.findIndex((h, idx) => idx > 0 && (h.ruleVersion ?? 1) !== (f.history[idx - 1].ruleVersion ?? 1));
  return i > 0 ? f.history[i].run : null;
}

export function closedAt(f: Finding): string | null {
  return [...f.audit].reverse().find((a) => a.event === 'closed')?.at ?? null;
}

/** The seven-stage strip: done before the current stage, "now" on it, and all done once closed. */
export function journey(f: Finding, vocab: Vocab): JourneyStep[] {
  const c = f.confirmation;
  const sg = f.signals;
  const raised = f.actions.filter((a) => a.status !== 'proposed').length;
  const firstLive = f.actions.map((a) => a.effectiveDate).filter((x): x is string => !!x).sort()[0];
  const closed = f.stage === 'closed';
  const notes: Record<Stage, string> = {
    detected: `by the checks on ${fmtDate(f.firstSeen)}`,
    proposed: 'scope, cause, plan drafted',
    confirmed: c ? `by ${c.by} on ${fmtDate(c.at)}` : 'one click, or override',
    raised: f.actions.length ? `${raised} of ${f.actions.length} in their channels` : 'actions sent to owners',
    live: firstLive ? `since ${fmtDate(firstLive)}` : 'change in production',
    verified: `${sg.bleedStopped.cleanChecks} of ${sg.bleedStopped.required} clean checks`,
    closed: closed ? 'nothing in scope' : 'both signals hold',
  };
  const at = vocab.stages.indexOf(f.stage);
  return vocab.stages.map((key, i) => ({
    label: vocab.stageLabels[key] ?? key,
    note: notes[key],
    state: i < at || closed ? 'done' : i === at ? 'now' : 'todo',
  }));
}

/** An acceptance still waiting for signatures cannot go live. */
export const waitingForSignature = (f: Finding, a: FindingAction): boolean => a.lever === 'accept' && !(a.trusteeSigned && (f.tier !== 'critical' || a.qaSigned));

/** First raised action that can go live (unsigned acceptances are skipped), else the first live action. */
export function advanceTarget(f: Finding): FindingAction | undefined {
  return f.actions.find((a) => a.status === 'raised' && !waitingForSignature(f, a)) ?? f.actions.find((a) => a.status === 'live');
}

export function acceptanceSigned(f: Finding, a: FindingAction): { trustee: boolean; qa: boolean } {
  const effective = a.status === 'live' || a.status === 'done';
  return { trustee: !!a.trusteeSigned || effective, qa: !!a.qaSigned || effective };
}

/* ---------- proposal helpers ---------- */

/** Reference an action gets when raised in its channel. Deterministic per finding and position, so runs are repeatable. */
export function referenceFor(findingId: string, index: number, lever: LeverKey): string | null {
  if (LEVERS_WITHOUT_REFERENCE.includes(lever)) return null;
  let h = index + 1;
  for (const ch of findingId) h = (h * 31 + ch.charCodeAt(0)) % REFERENCE_SPREAD;
  return `${REFERENCE_PREFIX[lever] ?? DEFAULT_REFERENCE_PREFIX}${REFERENCE_BASE + h}`;
}

export function approversFor(f: Finding): string[] {
  return f.tier === 'critical' ? ['Data trustee', QA_ROLE] : ['Data trustee'];
}

/** A plan entry for one lever, with owner and channel from the routing table. Accept is owned by the approvers. */
export function leverPlan(d: Dataset, f: Finding, lever: LeverKey, why: string): PlanAction {
  const accept = lever === 'accept';
  const route = accept ? { owner: approversFor(f).join(' + '), channel: HUB_ACCEPTANCE_CHANNEL, notify: '' } : channelFor(d.registry, f.sourceSystem, lever, f.site);
  return {
    lever,
    leverLabel: d.vocab.levers[lever].label,
    ownerRole: route.owner,
    channel: route.channel,
    notify: route.notify,
    scopeSegments: accept ? ['historical'] : [...OVERRIDE_PLAN_SEGMENTS],
    interimControl: null,
    why,
    ...(accept ? { reviewBy: DEFAULT_REVIEW_BY, approvals: approversFor(f) } : {}),
  };
}

/** The plan that follows from a root cause: its levers in `planFor`, plus an Accept when there are historical records. */
export function planFromRootCause(d: Dataset, f: Finding, key: string): PlanAction[] {
  const levers = d.vocab.planFor[key] ?? ['stop_bleed'];
  const plan = levers.map((lever) => leverPlan(d, f, lever, 'Follows from the overridden root cause'));
  if (f.segments.historical > 0) plan.push(leverPlan(d, f, 'accept', 'Closed records will not be corrected.'));
  return plan;
}

/* ---------- view models ---------- */

export function fieldItems(f: Finding): CheckItem[] {
  return f.fields.map((x) => ({
    id: x.column,
    name: x.name,
    requirement: x.requirement,
    criticalField: x.criticality === 'critical',
    failingNow: x.failingNow,
    problem: x.problem,
    whatItChecks: x.whatItChecks,
    whatFailureMeans: x.whatFailureMeans,
  }));
}

export function checkItems(rules: readonly Check[]): CheckItem[] {
  return [...rules]
    .sort((a, b) => b.failingNow - a.failingNow)
    .map((r) => ({
      id: r.id,
      name: r.fieldName,
      requirement: r.requirement,
      criticalField: false,
      failingNow: r.failingNow,
      problem: r.problem,
      whatItChecks: r.whatItChecks,
      whatFailureMeans: r.whatFailureMeans,
    }));
}

/** Deterministic pseudo rows for the records screen: the data carries only a handful of samples per finding. */
export function recordRows(f: Finding, count = RECORDS_PAGE_SIZE): RecordRow[] {
  const segments: SegmentKey[] = ['inFlight', 'recentClosed', 'historical'];
  const rows: RecordRow[] = [];
  for (let k = 0; k < count; k++) {
    const base = f.sampleRecords[k % f.sampleRecords.length];
    const h = (k * 2654435761) % 4294967296;
    rows.push({ key: base.key.replace(/\d{2}$/, String(10 + (h % 90))), segment: segments[h % 3], failsFields: base.failsFields, values: base.values });
  }
  return rows;
}

/** The complete record of a finding as plain text, as an inspector would receive it. */
export function exportText(f: Finding, tablePlainName: string, nowIso: string): string {
  const lines: string[] = [];
  const s = f.segments;
  lines.push('REMEDIATION HUB — FINDING RECORD');
  lines.push(`Finding: ${f.id}`);
  lines.push(`Table: ${tablePlainName} (${f.table}) · Source: ${f.sourceSystem} · Site: ${f.site} · Products: ${f.products.join(', ')} · Tier: ${f.tierLabel}`);
  lines.push(`Symptom: ${f.symptomLabel} · Fields: ${f.fieldNames.join(', ')}`);
  lines.push(`Segments: new ${s.newSinceDetection} · open ${s.inFlight} · recent ${s.recentClosed} · historical ${s.historical} · total ${f.failingNow}`);
  lines.push(`Stage: ${f.stage} · First seen: ${f.firstSeen} · Age: ${f.ageWorkingDays} working days (target ${f.targetWorkingDays})`);
  const p = f.proposal;
  const c = f.confirmation;
  lines.push('', 'PROPOSAL (drafted by the system from the data)');
  lines.push(` Scope: in ${p.scope.inScope.join(', ') || '—'} · parked ${p.scope.parked.join(', ') || '—'} · ${p.scope.rationale}`);
  lines.push(` Root cause: ${p.rootCause.label} (${Math.round(p.rootCause.confidence * 100)}% confidence) · ${p.rootCause.summary}`);
  for (const e of p.rootCause.evidence) lines.push(`   - ${e}`);
  lines.push(` Quality: ${p.qa.assessment} · ${p.qa.rationale}`);
  lines.push('', 'CONFIRMATION');
  if (c) {
    lines.push(` Confirmed by ${c.by} on ${c.at}${c.comment ? ` · "${c.comment}"` : ''}`);
    for (const o of c.overrides) lines.push(`   - Override of ${o.block} by ${o.by}: ${o.reason} · original: ${JSON.stringify(o.from)}`);
    lines.push(` Quality concurrence: ${c.qaConcurred ? 'yes' : p.qa.concurrenceNeeded ? 'pending' : 'not needed'}${c.deviationRef ? ` · deviation ${c.deviationRef}` : ''}`);
  } else {
    lines.push(' Not yet confirmed');
  }
  lines.push('', 'ACTIONS');
  for (const a of f.actions) {
    const signatures = a.lever === 'accept' ? ` · signatures: trustee ${a.trusteeSigned ? 'yes' : 'no'}${f.tier === 'critical' ? `, QA ${a.qaSigned ? 'yes' : 'no'}` : ''} · review by ${a.reviewBy}` : '';
    lines.push(` - ${a.leverLabel} · ${a.ownerRole} · ${a.channel} · ${a.reference || 'no ref'} · effective ${a.effectiveDate || '—'} · ${a.status}${signatures}${a.interimControl ? ` · interim: ${a.interimControl}` : ''}`);
  }
  lines.push('', 'VERIFICATION');
  lines.push(` Bleed stopped: ${f.signals.bleedStopped.cleanChecks}/${f.signals.bleedStopped.required} since ${f.signals.bleedStopped.since || '—'}`);
  lines.push(` Backlog: ${f.signals.backlog.inScopeRemaining} in scope remaining · ${f.signals.backlog.acceptedCount} accepted`);
  lines.push('', 'CHECK HISTORY (date · failing · new · check version)');
  for (const h of f.history) lines.push(` ${h.run} · ${h.failing} · ${h.newFailing} · v${h.ruleVersion ?? 1}`);
  lines.push('', 'AUDIT TRAIL (append-only; server time UTC)');
  f.audit.forEach((a, i) => lines.push(` #${i + 1} ${a.at} · ${a.by} · ${a.event} · ${a.text}`));
  lines.push('', `Generated ${nowIso} · roles shown in place of identities`);
  return lines.join('\n');
}

export const isQaRole = (who: string): boolean => who === QA_ROLE;
