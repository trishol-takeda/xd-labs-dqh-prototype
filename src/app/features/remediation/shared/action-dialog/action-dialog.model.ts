/** What one action dialog shows: all copy comes from the copy deck. */
export interface ActionDialogView {
  title: string;
  /** Paragraphs under the title. */
  lines: string[];
  /** Label of the free-text field. */
  label: string;
  /** The text field must be filled before the dialog confirms. */
  required: boolean;
  confirmLabel: string;
  /** Show the "Review by" date field (accepting remaining failures). */
  withReviewBy: boolean;
}
