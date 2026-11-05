import { REOPEN_SHARE_OF_PEAK, RULE_CHANGE_REMAINING, RUN_INTERVAL_DAYS, SOME_FIXED_REMAINING } from './remediation.constants';
import { Cause, Dataset, SimulationMode } from './remediation.model';
import { addDays, fmtDate, full, peakFailing } from './remediation.util';

/**
 * The lifecycle rules, as pure functions: each takes the dataset and returns a new one, never touching the input.
 * Every transition appends an audit entry; nothing edits or removes one. Only the (simulated) engine closes or reopens a cause.
 * `at` is passed in so the functions stay deterministic and testable.
 */

const ENGINE = 'Rule engine';
const TRUSTEE_FALLBACK = 'Data trustee';

function apply(d: Dataset, causeId: string, change: (c: Cause, draft: Dataset) => void): Dataset {
  const draft = structuredClone(d);
  const cause = draft.causes.find((c) => c.id === causeId);
  if (!cause) return d;
  change(cause, draft);
  return draft;
}

function trusteeRole(d: Dataset, c: Cause): string {
  return d.products.find((p) => p.name === c.products[0])?.trusteeRole ?? TRUSTEE_FALLBACK;
}

/** Table score = mean over its checks of (1 − failing / approxRecords); product score = mean of its tables. */
export function recomputeScores(d: Dataset): void {
  for (const t of d.tables) {
    const rules = d.rules.filter((r) => r.table === t.id);
    t.qualityScore = rules.length
      ? Math.round((1000 * rules.reduce((sum, r) => sum + (1 - Math.min(1, r.failingNow / t.approxRecords)), 0)) / rules.length) / 10
      : null;
  }
  for (const p of d.products) {
    const scores = p.tables.map((id) => d.tables.find((t) => t.id === id)?.qualityScore).filter((s): s is number => s != null);
    p.qualityScore = scores.length ? Math.round(10 * (scores.reduce((a, b) => a + b, 0) / scores.length)) / 10 : null;
  }
}

/** Push a cause's per-check counts back to the check list, then refresh the scores. */
function syncRules(c: Cause, d: Dataset): void {
  for (const cr of c.rules) {
    const rule = d.rules.find((r) => r.id === cr.id);
    if (rule) rule.failingNow = cr.failingNow;
  }
  recomputeScores(d);
}

export function nextRuleVersion(c: Cause): number {
  return Math.max(0, ...c.rules.map((r) => r.version)) + 1;
}

/* ---------- trustee ---------- */

export function sendForCorrection(d: Dataset, id: string, note: string, at: string): Dataset {
  return apply(d, id, (c, draft) => {
    c.state = 'in_progress';
    c.visibleStatus = 'waiting';
    c.audit.push({ at, by: trusteeRole(draft, c), event: 'sent', text: `Sent to ${c.fixerRole} (${c.fixerLabel})${note ? ': ' + note : ''}` });
  });
}

export function disputeRule(d: Dataset, id: string, why: string, at: string): Dataset {
  return apply(d, id, (c, draft) => {
    c.disputed = true;
    c.audit.push({ at, by: trusteeRole(draft, c), event: 'disputed', text: `Rule disputed with the Rules team: ${why}` });
  });
}

export function acceptRemaining(d: Dataset, id: string, why: string, reviewBy: string, at: string): Dataset {
  return apply(d, id, (c, draft) => {
    c.state = 'accepted';
    c.visibleStatus = 'fixed';
    c.scoreLiftIfFixed = 0;
    c.reviewBy = reviewBy;
    c.audit.push({
      at,
      by: trusteeRole(draft, c),
      event: 'accepted',
      text: `Remaining failures accepted: ${why}. Review by ${fmtDate(reviewBy)}${c.tier === 'critical' ? '. Quality approver signature pending.' : ''}`,
    });
  });
}

/* ---------- fixer ---------- */

export function markDone(d: Dataset, id: string, at: string): Dataset {
  return apply(d, id, (c) => {
    c.fixerStatus = 'awaiting_run';
    c.audit.push({
      at,
      by: c.fixerRole,
      event: 'fixer_done',
      text: `Correction made in ${c.fixerLane === 'engineering' ? 'the load' : c.sourceSystem}. Waiting for the next check to confirm.`,
    });
  });
}

export function cannotFix(d: Dataset, id: string, why: string, at: string): Dataset {
  return apply(d, id, (c) => {
    c.fixerStatus = 'wont_fix';
    c.audit.push({ at, by: c.fixerRole, event: 'wont_fix', text: `Can’t fix: ${why}` });
  });
}

/* ---------- rules team ---------- */

export function changeRule(d: Dataset, id: string, what: string, at: string): Dataset {
  return apply(d, id, (c, draft) => {
    const version = nextRuleVersion(c);
    c.disputed = false;
    for (const r of c.rules) {
      r.version += 1;
      r.failingNow = Math.round(r.failingNow * RULE_CHANGE_REMAINING);
    }
    const last = c.history[c.history.length - 1];
    c.failingNow = c.rules.reduce((sum, r) => sum + r.failingNow, 0);
    c.history.push({ run: addDays(last.run, RUN_INTERVAL_DAYS), failing: c.failingNow, ruleVersion: version });
    if (c.failingNow === 0) {
      c.state = 'closed';
      c.visibleStatus = 'fixed';
    }
    c.audit.push({ at, by: 'Rules team', event: 'rule_changed', text: `Rule changed to version ${version} after a dispute: ${what}. Counts start again from the next check.` });
    syncRules(c, draft);
  });
}

export function ruleStands(d: Dataset, id: string, at: string): Dataset {
  return apply(d, id, (c) => {
    c.disputed = false;
    c.audit.push({ at, by: 'Rules team', event: 'rule_stands', text: 'Dispute reviewed: the rule stands as written.' });
  });
}

/* ---------- engine (simulated) ---------- */

/** The next check runs: all fixed, some fixed (40% left) or nothing changed. */
export function simulateRun(d: Dataset, id: string, mode: SimulationMode): Dataset {
  return apply(d, id, (c, draft) => {
    const last = c.history[c.history.length - 1];
    const run = addDays(last.run, RUN_INTERVAL_DAYS);
    const at = `${run}T06:00:00Z`;
    const previous = c.failingNow > 0 ? c.failingNow : Math.max(1, Math.round(peakFailing(c) * REOPEN_SHARE_OF_PEAK));
    const n = mode === 'all' ? 0 : mode === 'some' ? Math.round(previous * SOME_FIXED_REMAINING) : c.failingNow > 0 ? c.failingNow : previous;

    c.history.push({ run, failing: n, ruleVersion: last.ruleVersion });
    c.failingNow = n;
    for (const r of c.rules) {
      r.failingNow = n === 0 ? 0 : Math.max(1, Math.round(r.failingNow > 0 ? r.failingNow * (n / Math.max(1, previous)) : previous / c.rules.length));
    }

    if (n === 0 && c.state !== 'accepted') {
      c.state = 'closed';
      c.visibleStatus = 'fixed';
      c.scoreLiftIfFixed = 0;
      c.audit.push({ at, by: ENGINE, event: 'closed', text: 'No records failing. Cause closed.' });
    } else if (n > 0 && (c.state === 'closed' || c.state === 'accepted')) {
      c.state = 'reopened';
      c.visibleStatus = 'needs_you';
      c.audit.push({ at, by: ENGINE, event: 'reopened', text: `${full(n)} records failing again. Cause reopened.` });
    } else {
      c.audit.push({ at, by: ENGINE, event: 'run', text: `${full(n)} records failing after run on ${fmtDate(run)}` });
      if (c.fixerStatus === 'awaiting_run') {
        c.fixerStatus = null;
        c.state = 'confirmed';
        c.visibleStatus = 'needs_you';
        c.audit.push({ at: `${run}T06:01:00Z`, by: ENGINE, event: 'back', text: 'Records still failing after the fixer marked it done. Back to the trustee.' });
      }
    }
    if (n === 0) c.fixerStatus = null;
    syncRules(c, draft);
  });
}
