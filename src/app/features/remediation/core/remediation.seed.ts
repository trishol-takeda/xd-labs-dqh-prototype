import { Dataset } from './remediation.model';

/** The cause that opens the demo as disputed. */
const DISPUTED_CAUSE_ID = 'txn_deviation_event_trkw_glbl:source_not_captured';
/** The table whose first open cause shows a rule change (version 2) in its history. */
const RULE_CHANGED_TABLE = 'gmsgq_txn_sapbw_e2e_shipment_glbl';
/** Share of the failing counts that remain after the seeded rule change. */
const SEEDED_RULE_CHANGE_REMAINING = 0.35;
const SEEDED_RULE_CHANGE_FROM_RUN = 6;

/**
 * Start state for the workshop: one disputed cause, one with a version-2 history, one the fixer has marked done and one the fixer won't fix.
 * Returns a new dataset; the input is left alone, so Reset can seed the same loaded data again.
 */
export function seedDataset(source: Dataset): Dataset {
  const d = structuredClone(source);

  const disputed = d.causes.find((c) => c.id === DISPUTED_CAUSE_ID) ?? d.causes.find((c) => c.visibleStatus === 'needs_you');
  if (disputed) {
    disputed.disputed = true;
    disputed.audit.push({
      at: '2026-10-20T10:02:00Z',
      by: 'Quality data trustee',
      event: 'disputed',
      text: 'Rule disputed with the Rules team: these fields are optional for minor deviations, the check should only apply to major ones',
    });
  }

  const changed = d.causes.find((c) => c.table === RULE_CHANGED_TABLE && c.visibleStatus === 'needs_you');
  if (changed) {
    changed.history.forEach((h, i) => {
      if (i >= SEEDED_RULE_CHANGE_FROM_RUN) {
        h.ruleVersion = 2;
        h.failing = Math.round(h.failing * SEEDED_RULE_CHANGE_REMAINING);
      }
    });
    changed.failingNow = changed.history[changed.history.length - 1].failing;
    for (const r of changed.rules) {
      r.version = 2;
      r.failingNow = Math.round(r.failingNow * SEEDED_RULE_CHANGE_REMAINING);
    }
    changed.audit.splice(1, 0, {
      at: `${changed.history[SEEDED_RULE_CHANGE_FROM_RUN].run}T08:30:00Z`,
      by: 'Rules team',
      event: 'rule_changed',
      text: 'Rule changed to version 2 after a dispute: placeholder value “-” no longer counted as filled. Counts re-baselined from this run.',
    });
  }

  const inProgress = d.causes.filter((c) => c.state === 'in_progress');
  if (inProgress[0]) inProgress[0].fixerStatus = 'awaiting_run';
  if (inProgress[1]) {
    inProgress[1].fixerStatus = 'wont_fix';
    inProgress[1].audit.push({
      at: '2026-10-22T14:00:00Z',
      by: inProgress[1].fixerRole,
      event: 'wont_fix',
      text: `Can’t fix: records older than 2019 are archived and read-only in ${inProgress[1].sourceSystem}`,
    });
  }

  return d;
}
