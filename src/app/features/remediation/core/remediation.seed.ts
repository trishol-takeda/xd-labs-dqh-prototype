import { DEFAULT_REVIEW_BY, HUB } from './remediation.constants';
import { Dataset, Finding } from './remediation.model';

const RENEW_WHY = 'Previous acceptance reached its review date; renew it or correct the records';

/**
 * An acceptance whose review date has passed reopens its finding at Proposed: the previous actions are kept as superseded,
 * the Accept in the proposal asks for renewal, and the audit trail says why. In production this runs nightly.
 */
export function reopenForReview(f: Finding, asOf: string): void {
  const due = f.actions.find((a) => a.lever === 'accept' && a.reviewBy && a.reviewBy < asOf);
  if (!due || f.stage === 'proposed') return;
  f.stage = 'proposed';
  f.visibleStatus = 'needs_you';
  f.reviewDue = true;
  f.confirmation = null;
  f.supersededActions = [...(f.supersededActions ?? []), ...f.actions.map((a) => ({ ...a, archived: true }))];
  f.actions = [];
  f.proposal.plan = f.proposal.plan.map((a) => (a.lever === 'accept' ? { ...a, why: RENEW_WHY, reviewBy: DEFAULT_REVIEW_BY } : a));
  f.audit.push({ at: `${asOf}T06:00:00Z`, by: HUB, event: 'review_due', text: `Acceptance ${due.reference ?? ''} reached its review date (${due.reviewBy}). Finding reopened for a renewed decision.` });
}

/**
 * Start state for the workshop: the loaded data with lapsed acceptances reopened.
 * Returns a new dataset; the input is left alone, so Reset can seed the same loaded data again.
 */
export function seedDataset(source: Dataset): Dataset {
  const d = structuredClone(source);
  for (const f of d.findings) reopenForReview(f, d.vocab.asOf);
  return d;
}
