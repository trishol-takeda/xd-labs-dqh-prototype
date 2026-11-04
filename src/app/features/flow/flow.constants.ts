/** The rules the prototype follows, in plain words. */
export const RULES: readonly { title: string; text: string }[] = [
  {
    title: 'Work the cause, not the record',
    text: 'Thousands of failing records collapse into a few causes. You act on a cause. Records are only evidence.',
  },
  {
    title: 'The cause decides where it goes',
    text: 'The rule type and the kind of column give the cause. The cause gives the channel and owner. You never pick them.',
  },
  {
    title: 'Only the rule engine closes a cause',
    text: 'A cause closes when the next run no longer emits the records. There is no "mark as fixed" button, and the Hub never looks inside source systems.',
  },
  {
    title: 'Three actions, each with a reason',
    text: 'Send for correction, this rule is wrong, accept remaining failures. Each is written to the history with who, when and why.',
  },
  {
    title: 'Accepting a failure does not change the score',
    text: 'The quality score comes from rule pass rates. Maturity stars are a separate measurement and are not touched.',
  },
];

/** What is known to be missing today. Stated here, not hidden. */
export const BLOCKERS: readonly { title: string; text: string }[] = [
  {
    title: 'The failure ledger does not exist yet',
    text: 'Closing and reopening are simulated in Preview mode, and the screen says so.',
  },
  {
    title: 'Six tables have no stable record key',
    text: 'Their failures cannot be tracked across runs or found in the source. Which six is a placeholder in this prototype.',
  },
  {
    title: 'Two assumptions are still to validate with the Rules team',
    text: 'How score lift per cause is calculated, and which context fields the ledger will carry.',
  },
];
