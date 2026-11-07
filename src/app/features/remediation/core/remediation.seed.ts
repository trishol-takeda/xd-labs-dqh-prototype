import { Dataset } from './remediation.model';

/**
 * Start state for the workshop. The data holds the scope decision of every finding that has one; findings that are already
 * past Needs you have had their scope concurred by the Quality approver, so only the ones still waiting show "pending".
 * Returns a new dataset; the input is left alone, so Reset can seed the same loaded data again.
 */
export function seedDataset(source: Dataset): Dataset {
  const d = structuredClone(source);
  for (const f of d.findings) {
    if (f.decisions.scope && f.visibleStatus !== 'needs_you') f.decisions.scope.concurred = true;
  }
  return d;
}
