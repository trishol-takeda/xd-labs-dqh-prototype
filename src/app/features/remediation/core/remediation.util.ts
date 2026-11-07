import { FIELD_SUMMARY_COUNT, JOURNEY_LABELS, MS_PER_DAY, QA_ROLE, RECORDS_PAGE_SIZE, TRUSTEE_FALLBACK } from './remediation.constants';
import {
  BadgeView,
  Check,
  CheckItem,
  Dataset,
  DecisionKey,
  Finding,
  FindingAction,
  JourneyStep,
  LeverKey,
  Product,
  RecordRow,
  Registry,
  RegistryTable,
  Role,
  SegmentKey,
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

export function nextDecision(f: Finding): DecisionKey | null {
  if (!f.decisions.scope) return 'scope';
  if (!f.decisions.impact) return 'impact';
  if (!f.decisions.investigation) return 'investigate';
  return f.actions.length === 0 ? 'actions' : null;
}

export function decisionDone(f: Finding, key: DecisionKey): boolean {
  switch (key) {
    case 'scope':
      return !!f.decisions.scope;
    case 'impact':
      return !!f.decisions.impact;
    case 'investigate':
      return !!f.decisions.investigation;
    case 'actions':
      return f.actions.length > 0;
  }
}

export function awaitingConcurrence(f: Finding): boolean {
  return !!f.decisions.scope?.qaConcurrence && !f.decisions.scope.concurred;
}

export const hasOpenCheckChange = (f: Finding): boolean => f.actions.some((a) => a.lever === 'fix_check' && a.status !== 'done');
export const openCheckChange = (f: Finding): FindingAction | undefined => f.actions.find((a) => a.lever === 'fix_check' && a.status !== 'done');
export const acceptAction = (f: Finding): FindingAction | undefined => f.actions.find((a) => a.lever === 'accept');

export function badges(f: Finding): BadgeView[] {
  const list: BadgeView[] = [];
  if (f.pastTarget) list.push({ kind: 'over', label: 'Past target' });
  if (f.fixedGoingForward) list.push({ kind: 'badge', label: 'Fixed going forward' });
  if (f.decisions.impact?.deviationRef) list.push({ kind: 'badge', label: 'Deviation open' });
  if (hasOpenCheckChange(f)) list.push({ kind: 'badge', label: 'Check disputed' });
  if (f.cameBack) list.push({ kind: 'badge', label: 'Came back' });
  if (awaitingConcurrence(f)) list.push({ kind: 'badge', label: 'QA concurrence pending' });
  return list;
}

/** The roles' work queues. Trustee: own domain, needs-you; QA: concurrence and critical impact; Rules: open check changes. */
export function queueList(d: Dataset, role: Role, domain: string): Finding[] {
  if (role === 'qa') {
    return d.findings.filter((f) => awaitingConcurrence(f) || (!!f.decisions.scope && !f.decisions.impact && f.tier === 'critical'));
  }
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

export function journey(f: Finding): JourneyStep[] {
  const d = f.decisions;
  const sg = f.signals;
  const fixed = f.visibleStatus === 'fixed';
  const done = [
    true,
    !!d.scope,
    !!d.impact,
    !!d.investigation,
    f.actions.length > 0,
    fixed || (f.actions.length > 0 && sg.bleedStopped.cleanChecks > 0),
    fixed,
  ];
  const notes = [
    `by the checks on ${fmtDate(f.firstSeen)}`,
    d.scope ? fmtDate(d.scope.at) : 'decide what can be corrected',
    d.impact ? d.impact.assessment : 'could it matter?',
    d.investigation ? fmtDate(d.investigation.at) : 'what was actually found',
    f.actions.length ? `${f.actions.length} planned` : 'who fixes what, how',
    f.actions.length ? `${sg.bleedStopped.cleanChecks} of ${sg.bleedStopped.required} clean checks` : 'the checks confirm it',
    fixed ? 'no new failures, nothing in scope' : 'both signals hold',
  ];
  const now = done.indexOf(false);
  return JOURNEY_LABELS.map((label, i) => ({ label, note: notes[i], state: done[i] ? 'done' : i === now ? 'now' : 'todo' }));
}

/** First open action that can be advanced: an acceptance still waiting for signatures is skipped. */
export function advanceTarget(f: Finding): FindingAction | undefined {
  const waitingForSignature = (a: FindingAction) => a.lever === 'accept' && !(a.trusteeSigned && (f.tier !== 'critical' || a.qaSigned));
  return f.actions.find((a) => a.status === 'open' && !waitingForSignature(a)) ?? f.actions.find((a) => a.status === 'live');
}

export function acceptanceSigned(f: Finding, a: FindingAction): { trustee: boolean; qa: boolean } {
  return { trustee: !!a.trusteeSigned || a.status !== 'open', qa: !!a.qaSigned || a.status === 'done' };
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
  const d = f.decisions;
  lines.push('REMEDIATION HUB — FINDING RECORD');
  lines.push(`Finding: ${f.id}`);
  lines.push(`Table: ${tablePlainName} (${f.table}) · Source: ${f.sourceSystem} · Site: ${f.site} · Products: ${f.products.join(', ')} · Tier: ${f.tierLabel}`);
  lines.push(`Symptom: ${f.symptomLabel} · Fields: ${f.fieldNames.join(', ')}`);
  lines.push(`Segments: new ${s.newSinceDetection} · open ${s.inFlight} · recent ${s.recentClosed} · historical ${s.historical} · total ${f.failingNow}`);
  lines.push(`State: ${f.state} · First seen: ${f.firstSeen} · Age: ${f.ageWorkingDays} working days (target ${f.targetWorkingDays})`);
  lines.push('', 'DECISIONS');
  lines.push(` Scope: ${d.scope ? JSON.stringify({ inScope: d.scope.inScope, parked: d.scope.parked, reason: d.scope.reason, by: d.scope.by, at: d.scope.at, qaConcurred: !!d.scope.concurred }) : '—'}`);
  lines.push(` Impact: ${d.impact ? JSON.stringify(d.impact) : '—'}`);
  lines.push(` Investigation: ${d.investigation ? JSON.stringify(d.investigation) : '—'}`);
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
