import { Band, CauseState, ColumnClass, Channel, EngineOutcome, OwnerRole, RootCauseClass } from '../models/remediation.model';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

export const DATA_FILES = {
  signatures: 'data/signatures.json',
  findings: 'data/findings.json',
  catalogue: 'data/rule-catalogue.json',
} as const;

/** The failure ledger does not exist yet, so engine verification is simulated and the UI says so. */
export const REMEDIATION_PREVIEW_MODE = true;

/** Fixed demo date so seeded history stays stable. */
export const PROTOTYPE_TODAY = '2026-10-15';

export const TRUSTEE = 'Lynn Horton';
export const ENGINE = 'Rule engine';
export const SAMPLE_SIZE = 10;

// ---- States ---------------------------------------------------------------

/** Lifecycle order. Closed is last and collapsed by default. */
export const STATE_ORDER: readonly CauseState[] = ['New', 'Confirmed', 'In progress', 'Reopened', 'Closed'];

export const STATE_INFO: Readonly<Record<CauseState, { tone: Tone; icon: string; meaning: string; next: string }>> = {
  New: {
    tone: 'info',
    icon: 'flag',
    meaning: 'The failures were detected and grouped into this cause. Nobody has looked at it yet.',
    next: 'Read why it is failing and confirm the cause.',
  },
  Confirmed: {
    tone: 'accent',
    icon: 'check',
    meaning: 'A trustee confirmed what is causing the failures.',
    next: 'Send it for correction, challenge the rule, or accept the remaining failures.',
  },
  'In progress': {
    tone: 'warning',
    icon: 'clock',
    meaning: 'A correction was requested and the owner is working on it.',
    next: 'Wait for the next rule run. The system closes the cause when the records stop failing.',
  },
  Reopened: {
    tone: 'danger',
    icon: 'refresh',
    meaning: 'The cause was closed, then the same failures came back in a later run.',
    next: 'Review it again and send it for correction.',
  },
  Closed: {
    tone: 'success',
    icon: 'lock',
    meaning: 'The rule engine no longer emits these records. Only the engine can close a cause.',
    next: 'Nothing to do. If it fails again it reopens by itself.',
  },
};

// ---- Criticality ----------------------------------------------------------

export const BANDS: readonly Band[] = ['P1', 'P2', 'P3', 'P4'];
export const BAND_TONE: Readonly<Record<Band, Tone>> = { P1: 'danger', P2: 'warning', P3: 'info', P4: 'neutral' };
export const BAND_MEANING: Readonly<Record<Band, string>> = {
  P1: 'Highest GxP criticality',
  P2: 'High GxP criticality',
  P3: 'Medium GxP criticality',
  P4: 'Lower GxP criticality',
};

// ---- Classification (deterministic) ----------------------------------------

/** Rule shape, in the workbook's words, to a plain sentence. */
export const SHAPE_IN_PLAIN_WORDS: Readonly<Record<string, string>> = {
  'Presence (not null / not blank)': 'a value must be filled in',
  'Presence (no placeholder value)': 'a value must not be a placeholder such as "TBD"',
  'Allowed values': 'a value must be one of an agreed list',
  'Numeric bound': 'a number must stay within a range',
  'Format pattern': 'a value must follow an agreed format',
  'Reference lookup': 'a value must exist in a reference list',
  'Date logic': 'dates must be in a sensible order',
  'Conditional dependency': 'one field must agree with another',
  Uniqueness: 'a value must not be repeated',
};

/** Rule shape × column class → root-cause class. Never chosen by the trustee. */
export function classify(shape: string, columnClass: ColumnClass): RootCauseClass {
  if (columnClass === 'technical') return 'Pipeline defect';
  if (shape.startsWith('Presence')) return 'Source not captured';
  if (shape === 'Reference lookup') return 'Missing master record';
  if (shape === 'Date logic' || shape === 'Conditional dependency') return 'Process sequencing';
  return 'Source value invalid';
}

/** Root-cause class → channel and owner role. The channel is always derived from the cause. */
export const CLASS_ROUTING: Readonly<Record<RootCauseClass, { channel: Channel; ownerRole: OwnerRole }>> = {
  'Source not captured': { channel: 'Fix at source', ownerRole: 'Source-system owner' },
  'Source value invalid': { channel: 'Fix at source', ownerRole: 'Source-system owner' },
  'Process sequencing': { channel: 'Fix at source', ownerRole: 'Business process owner' },
  'Missing master record': { channel: 'Master data', ownerRole: 'MDM' },
  'Pipeline defect': { channel: 'Data engineering', ownerRole: 'DE' },
  'Rule defect': { channel: 'Rule catalogue', ownerRole: 'Rules team' },
};

/** The reason shown to the trustee. {system} is replaced by the source system. */
export const CLASS_WHY: Readonly<Record<RootCauseClass, string>> = {
  'Source not captured': 'The value is required but empty. This kind of gap usually means it was never entered in {system}.',
  'Source value invalid': 'The value is there but outside what is allowed. It was most likely entered wrongly in {system}.',
  'Process sequencing': 'Two fields or dates disagree. The business steps probably happen in a different order than the rule expects.',
  'Missing master record': 'The value points to a master record that does not exist, so the master data needs to be completed.',
  'Pipeline defect': 'A technical field that the load should always fill is empty. The load logic is the likely culprit.',
  'Rule defect': 'The rule itself may be wrong, so the failures may not be real data problems.',
};

// ---- Preview mode: what the next engine run could do ---------------------

export const ENGINE_OUTCOMES: Readonly<Record<EngineOutcome, { label: string; detail: string; remaining: number }>> = {
  cleared: { label: 'All records fixed', detail: 'The next run emits none of these records.', remaining: 0 },
  partly: { label: 'Some records fixed', detail: 'The next run emits about 40% of them.', remaining: 0.4 },
  same: { label: 'Nothing changed', detail: 'The next run emits the same records.', remaining: 1 },
  again: { label: 'Fails again after closing', detail: 'A closed cause fails again, at a smaller volume.', remaining: 0.15 },
};

// ---- Copy for the three actions -----------------------------------------

export const ACTION_COPY = {
  send: {
    label: 'Send for correction',
    help: 'Routes this cause and its evidence to the owner of the channel. The request is recorded.',
    reason: 'What should the owner know? (required)',
  },
  challenge: {
    label: 'This rule is wrong',
    help: 'Challenges the rule with the Rules team. The cause is parked, not closed.',
    reason: 'Why is the rule wrong? (required)',
  },
  accept: {
    label: 'Accept remaining failures',
    help: 'Records a risk acceptance in the decision log. It does not change the quality score.',
    reason: 'Why can these failures stay? (required)',
  },
} as const;

// ---- Open questions ------------------------------------------------------

export interface OpenQuestion {
  id: string;
  question: string;
  assumption: string;
  where: string;
}

/** Named, not decided. Each one is the team's call. */
export const OPEN_QUESTIONS: readonly OpenQuestion[] = [
  {
    id: 'Q1',
    question: 'Which state is a cause in after "This rule is wrong" or "Accept remaining failures"? Only the engine can close it and no other states exist.',
    assumption: 'The state stays as it was and a Parked or Risk accepted flag is added.',
    where: 'Cause list, cause detail',
  },
  {
    id: 'Q2',
    question: 'What moves a cause from Confirmed to In progress?',
    assumption: 'Recording a request with "Send for correction".',
    where: 'Cause detail',
  },
  {
    id: 'Q3',
    question: 'Is "Confirm" a fourth trustee action, or only the step that sets the Confirmed state?',
    assumption: 'A confirmation step before the three actions, not a fourth action.',
    where: 'Cause detail',
  },
  {
    id: 'Q4',
    question: 'Does accepting a risk need an electronic signature or a second approver for 21 CFR Part 11?',
    assumption: 'A reason and an audit entry only. No signature and no approver.',
    where: 'Accept remaining failures',
  },
  {
    id: 'Q5',
    question: 'How is the request delivered, and how does the Hub learn that the owner has acted?',
    assumption: 'The Hub only records the request. It learns about progress from the next rule run.',
    where: 'Send for correction',
  },
  {
    id: 'Q6',
    question: 'If a rule gets a new version, is it the same cause or a new one?',
    assumption: 'The same cause. The version is not part of the cause key.',
    where: 'Reopening',
  },
  {
    id: 'Q7',
    question: 'How is score lift per cause calculated?',
    assumption: 'The points the product score would gain if this cause stopped failing, from the pass rate of each rule.',
    where: 'Cause detail, product strip',
  },
  {
    id: 'Q8',
    question: 'Which context fields will the failure ledger carry?',
    assumption: 'The source keys of the failing records and the run history. Nothing else.',
    where: 'Sample records',
  },
  {
    id: 'Q9',
    question: 'What differs between "Send for correction" and "This rule is wrong" on a cause classed as Rule defect?',
    assumption: 'Not modelled: Rule defect appears only after a challenge and its channel is the Rule catalogue.',
    where: 'Cause detail',
  },
];

// ---- Lifecycle strip on the How it works page ----------------------------

export const LIFECYCLE: readonly { state: CauseState; by: string; text: string }[] = [
  { state: 'New', by: 'The rule engine', text: 'Failing records are grouped into a cause.' },
  { state: 'Confirmed', by: 'You', text: 'You confirm what is causing it.' },
  { state: 'In progress', by: 'You', text: 'You send it for correction. The request is recorded.' },
  { state: 'Closed', by: 'The rule engine', text: 'The next run no longer emits the records.' },
  { state: 'Reopened', by: 'The rule engine', text: 'The same cause fails again after closing.' },
];
