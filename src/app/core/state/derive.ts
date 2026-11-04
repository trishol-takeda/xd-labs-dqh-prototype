import {
  BANDS,
  CLASS_ROUTING,
  CLASS_WHY,
  ENGINE,
  ENGINE_OUTCOMES,
  SHAPE_IN_PLAIN_WORDS,
  STATE_ORDER,
  TRUSTEE,
  classify,
} from '../constants/remediation.constants';
import {
  AuditEntry,
  Catalogue,
  CauseRule,
  CauseState,
  CauseView,
  CauseWorkflow,
  EngineOutcome,
  Finding,
  ProductView,
  RootCauseClass,
  RunPoint,
  Signature,
} from '../models/remediation.model';
import { full } from '../util/format';

const FALLBACK_SHAPE = 'Presence (not null / not blank)';

export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function addDays(date: string, days: number, hour = 9): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00:00Z`;
}

/** The raw grouping: signatures that share product, table, column, rule type, root-cause class and source system. */
export interface BaseCause {
  id: string;
  shape: string;
  rootCause: RootCauseClass;
  signatures: Signature[];
}

export function groupSignatures(signatures: readonly Signature[], catalogue: Catalogue): BaseCause[] {
  const groups = new Map<string, BaseCause>();
  for (const sig of signatures) {
    const shape = catalogue.rules[sig.ruleId]?.shape ?? FALLBACK_SHAPE;
    const rootCause = classify(shape, sig.columnClass);
    const id = slug([sig.product, sig.table, sig.column, shape, rootCause, sig.sourceSystem].join(' '));
    const group = groups.get(id) ?? { id, shape, rootCause, signatures: [] };
    group.signatures.push(sig);
    groups.set(id, group);
  }
  return [...groups.values()];
}

function sumRuns(signatures: readonly Signature[]): RunPoint[] {
  const first = signatures[0];
  return first.runs.map((r, i) => ({ run: r.run, failing: signatures.reduce((sum, s) => sum + (s.runs[i]?.failing ?? 0), 0) }));
}

const bandIndex = (b: string) => BANDS.indexOf(b as (typeof BANDS)[number]);

/** Fraction of its records a rule fails: what the cause costs the quality score, as a share of one rule. */
function scoreLoss(rules: readonly CauseRule[]): number {
  return rules.reduce((sum, r) => sum + (r.recordCount ? r.failingNow / r.recordCount : 0), 0);
}

export function buildCause(base: BaseCause, wf: CauseWorkflow, catalogue: Catalogue): CauseView {
  const sigs = [...base.signatures].sort((a, b) => b.failingRecords - a.failingRecords);
  const lead = sigs[0];
  const leadRule = catalogue.rules[lead.ruleId];
  const baseRuns = sumRuns(sigs);
  const runs = [...baseRuns, ...wf.extraRuns];
  const baseLast = baseRuns.at(-1)?.failing ?? 0;
  const failingNow = runs.at(-1)?.failing ?? 0;
  const ratio = baseLast ? failingNow / baseLast : 0;
  const rules: CauseRule[] = sigs.map((s) => ({
    ruleId: s.ruleId,
    plainName: catalogue.rules[s.ruleId]?.plainName ?? s.ruleId,
    recordCount: s.recordCount,
    failingNow: Math.round((s.runs.at(-1)?.failing ?? 0) * ratio),
  }));
  const routing = CLASS_ROUTING[base.rootCause];
  const totalRules = catalogue.products[lead.product]?.totalRules ?? 1;

  return {
    id: base.id,
    product: lead.product,
    domain: lead.domain,
    table: lead.table,
    column: lead.column,
    sourceSystem: lead.sourceSystem,
    title: leadRule?.plainName ?? lead.ruleId,
    shape: base.shape,
    shapeInPlainWords: SHAPE_IN_PLAIN_WORDS[base.shape] ?? 'a value must follow the rule',
    columnClass: lead.columnClass,
    rootCause: base.rootCause,
    channel: routing.channel,
    ownerRole: routing.ownerRole,
    why: CLASS_WHY[base.rootCause].replace('{system}', lead.sourceSystem),
    whatItChecks: leadRule?.whatItChecks ?? '',
    failureMeans: leadRule?.failureMeans ?? '',
    band: sigs.map((s) => s.band).sort((a, b) => bandIndex(a) - bandIndex(b))[0],
    rules,
    runs,
    detected: baseRuns[0]?.failing ?? failingNow,
    failingNow,
    firstSeen: sigs.map((s) => s.firstSeen).sort()[0],
    lastSeen: runs.at(-1)?.run ?? lead.lastSeen,
    state: wf.state,
    disposition: wf.disposition,
    scoreLift: (100 * scoreLoss(rules)) / totalRules,
    hasStableKey: !catalogue.tablesWithoutStableKey.tables.includes(lead.table),
    audit: [...wf.audit].sort((a, b) => b.at.localeCompare(a.at)),
  };
}

/** By GxP criticality band, then by how many records fail. */
export function compareCauses(a: CauseView, b: CauseView): number {
  return bandIndex(a.band) - bandIndex(b.band) || b.failingNow - a.failingNow || a.id.localeCompare(b.id);
}

export function buildProducts(causes: readonly CauseView[], catalogue: Catalogue): ProductView[] {
  const names = [...new Set(causes.map((c) => c.product))];
  return names
    .map((name) => {
      const mine = causes.filter((c) => c.product === name);
      const totalRules = catalogue.products[name]?.totalRules ?? 1;
      const byState = Object.fromEntries(STATE_ORDER.map((s) => [s, mine.filter((c) => c.state === s).length])) as Record<CauseState, number>;
      const loss = mine.reduce((sum, c) => sum + scoreLoss(c.rules), 0);
      return {
        name,
        domain: mine[0].domain,
        score: Math.max(0, 100 - (100 * loss) / totalRules),
        totalRules,
        open: mine.filter((c) => c.state !== 'Closed').length,
        total: mine.length,
        byState,
      };
    })
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
}

/** Records for a cause: deterministic per cause, so the sample does not change between visits. */
export function recordsFor(cause: CauseView, findings: readonly Finding[]): Finding[] {
  if (!cause.hasStableKey) return [];
  const rows = findings.filter((f) => f.table === cause.table && f.number_checks_failed > 0);
  if (!rows.length) return [];
  const offset = [...cause.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % rows.length;
  return [...rows.slice(offset), ...rows.slice(0, offset)];
}

// ---- Engine --------------------------------------------------------------

export interface EngineStep {
  workflow: CauseWorkflow;
  failing: number;
}

/** What the next rule run would do. Closing and reopening are the engine's alone. */
export function applyEngineRun(cause: CauseView, wf: CauseWorkflow, outcome: EngineOutcome): EngineStep {
  const next = ENGINE_OUTCOMES[outcome];
  const failing = outcome === 'again' ? Math.max(1, Math.round(cause.detected * next.remaining)) : Math.round(cause.failingNow * next.remaining);
  const run = addDays(cause.lastSeen, 1).slice(0, 10);
  const entries: AuditEntry[] = [
    {
      at: addDays(run, 0, 18),
      by: ENGINE,
      kind: 'engine-run',
      text: `Run of ${run}: ${full(failing)} of ${full(cause.failingNow)} records still failing`,
    },
  ];
  let state = wf.state;
  if (failing === 0) {
    state = 'Closed';
    entries.push({ at: addDays(run, 0, 19), by: ENGINE, kind: 'engine-closed', text: 'The run no longer emits these records. The cause closed' });
  } else if (wf.state === 'Closed') {
    state = 'Reopened';
    entries.push({ at: addDays(run, 0, 19), by: ENGINE, kind: 'engine-reopened', text: 'The same cause failed again after closing. The cause reopened' });
  }
  return {
    failing,
    workflow: { ...wf, state, extraRuns: [...wf.extraRuns, { run, failing }], audit: [...wf.audit, ...entries] },
  };
}

// ---- Seed ----------------------------------------------------------------

const RAW_STATE: Readonly<Record<string, CauseState>> = {
  Triage: 'New',
  'Root cause confirmed': 'Confirmed',
  'In remediation': 'In progress',
  Verification: 'In progress',
  Reopened: 'Reopened',
};

export function requestRef(n: number): string {
  return `REQ-${String(n).padStart(4, '0')}`;
}

/** Starting point for the demo: a spread of every state, with history that matches it. */
export function seedWorkflows(bases: readonly BaseCause[], catalogue: Catalogue): Record<string, CauseWorkflow> {
  const out: Record<string, CauseWorkflow> = {};
  const views = new Map<string, CauseView>();
  const blank = (id: string): CauseWorkflow => ({ state: 'New', extraRuns: [], audit: [] });
  const sorted = [...bases].sort((a, b) => a.id.localeCompare(b.id));
  for (const base of sorted) {
    const lead = [...base.signatures].sort((a, b) => b.failingRecords - a.failingRecords)[0];
    out[base.id] = { ...blank(base.id), state: RAW_STATE[lead.state] ?? 'New' };
    views.set(base.id, buildCause(base, out[base.id], catalogue));
  }

  // A cause whose latest run emits nothing was closed by the engine, whatever the DQH data called it.
  for (const c of views.values()) {
    if (c.failingNow === 0) out[c.id].state = 'Closed';
  }

  const open = (state: CauseState) => [...views.values()].filter((c) => out[c.id].state === state);
  const parked = open('Confirmed')[0];
  const accepted = [open('Confirmed')[1], open('In progress')[0]].filter(Boolean);
  if (parked) out[parked.id].disposition = 'Parked';
  accepted.forEach((c) => (out[c.id].disposition = 'Risk accepted'));

  let ref = 0;
  for (const base of sorted) {
    const wf = out[base.id];
    const c = views.get(base.id) as CauseView;
    const day = (n: number, hour = 9) => addDays(c.firstSeen, n, hour);
    const audit: AuditEntry[] = [
      { at: day(0, 6), by: ENGINE, kind: 'detected', text: `Cause detected: ${full(c.detected)} records failing on ${c.table}` },
    ];
    const reached = (s: CauseState) => STATE_ORDER.indexOf(wf.state) >= STATE_ORDER.indexOf(s);
    const sent = wf.state === 'In progress' || wf.state === 'Reopened' || wf.state === 'Closed';
    if (reached('Confirmed') || wf.state === 'Reopened') {
      audit.push({ at: day(1), by: TRUSTEE, kind: 'confirmed', text: `Cause confirmed: ${c.rootCause}`, why: 'Matches what the rule checks.' });
    }
    if (sent) {
      ref += 1;
      audit.push({
        at: day(2),
        by: TRUSTEE,
        kind: 'sent',
        text: `Request ${requestRef(ref)} sent to ${c.ownerRole} (${c.channel})`,
        why: `Please correct "${c.column}" in ${c.sourceSystem}. About ${full(c.detected)} records are affected.`,
      });
    }
    if (wf.state === 'Reopened') {
      audit.push({ at: day(4, 18), by: ENGINE, kind: 'engine-closed', text: 'The run no longer emitted these records. The cause closed' });
      audit.push({ at: addDays(c.lastSeen, 0, 18), by: ENGINE, kind: 'engine-reopened', text: 'The same cause failed again after closing. The cause reopened' });
    }
    if (wf.state === 'Closed') {
      const closedRun = c.runs.find((r, i) => r.failing === 0 && i > 0 && c.runs[i - 1].failing > 0)?.run ?? c.lastSeen;
      audit.push({
        at: addDays(closedRun, 0, 18),
        by: ENGINE,
        kind: 'engine-closed',
        text: `The run of ${closedRun} no longer emits these records. The cause closed`,
      });
    }
    if (wf.disposition === 'Parked') {
      audit.push({
        at: day(3),
        by: TRUSTEE,
        kind: 'challenged',
        text: 'Rule challenged with the Rules team. The cause is parked',
        why: 'The allowed list in the rule looks out of date for this source system.',
      });
    }
    if (wf.disposition === 'Risk accepted') {
      audit.push({
        at: day(3),
        by: TRUSTEE,
        kind: 'accepted',
        text: 'Remaining failures accepted. Recorded in the decision log',
        why: 'Legacy records from before the field was mandatory. Not used in any GxP decision.',
      });
    }
    wf.audit = audit;
  }
  return out;
}

export function nextRequestNumber(workflows: Readonly<Record<string, CauseWorkflow>>): number {
  const count = Object.values(workflows).reduce((sum, wf) => sum + wf.audit.filter((a) => a.kind === 'sent').length, 0);
  return count + 1;
}
