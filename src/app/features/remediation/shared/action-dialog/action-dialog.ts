import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { RECORDS_SAMPLE_SIZE } from '../../core/remediation.constants';
import { Cause, DialogKind, DialogResult, Table } from '../../core/remediation.model';
import { defaultReviewBy, plural } from '../../core/remediation.util';
import { nextRuleVersion } from '../../core/remediation.transitions';
import { ActionDialogView } from './action-dialog.model';

/** One modal for the five actions (send, dispute, accept, can't fix, change the rule), built on the native <dialog>. */
@Component({
  selector: 'app-action-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './action-dialog.html',
})
export class ActionDialog {
  readonly kind = input.required<DialogKind>();
  readonly cause = input.required<Cause>();
  readonly table = input<Table | undefined>(undefined);

  readonly confirmed = output<DialogResult>();
  readonly closed = output<void>();

  protected readonly text = signal('');
  /** Starts at the default review date (6 months for GxP critical, otherwise 12) and follows the cause. */
  protected readonly reviewBy = linkedSignal(() => defaultReviewBy(this.cause().tier, new Date()));
  protected readonly missing = signal(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');

  protected readonly view = computed<ActionDialogView>(() => {
    const c = this.cause();
    switch (this.kind()) {
      case 'send':
        return {
          title: 'Send for correction',
          lines: [`Goes to: ${c.fixerRole} (${c.fixerLabel}). Includes the ${RECORDS_SAMPLE_SIZE} sample records.`],
          label: 'Note to the fixer (optional)',
          required: false,
          confirmLabel: 'Send',
          withReviewBy: false,
        };
      case 'dispute': {
        const others = (this.table()?.products ?? []).filter((p) => p !== c.products[0]);
        return {
          title: 'Dispute the rule',
          lines: [
            'This goes to the Rules team. The cause is parked until they answer.',
            ...(others.length ? [`${others.join(', ')} uses this table too and will see the dispute.`] : []),
          ],
          label: 'Why the rule is wrong (required)',
          required: true,
          confirmLabel: 'Send dispute',
          withReviewBy: false,
        };
      }
      case 'accept':
        return {
          title: 'Accept remaining failures',
          lines: ['Recorded in the decision log. The quality score does not change.', ...(c.tier === 'critical' ? ['A Quality approver will also sign this.'] : [])],
          label: 'Reason (required)',
          required: true,
          confirmLabel: 'Accept',
          withReviewBy: true,
        };
      case 'wont':
        return {
          title: 'Can’t fix',
          lines: ['Goes back to the trustee, who can accept the remaining failures or dispute the rule.'],
          label: 'Why it can’t be fixed (required)',
          required: true,
          confirmLabel: 'Send back',
          withReviewBy: false,
        };
      case 'ruleChange': {
        const v = nextRuleVersion(c);
        const n = c.rules.length;
        return {
          title: 'Change the rule',
          lines: [`Creates version ${v} of the ${n} ${plural(n, 'check')} in this cause. Counts start again from the next check; earlier checks stay in the history as they were.`],
          label: 'What changed (required)',
          required: true,
          confirmLabel: `Publish version ${v}`,
          withReviewBy: false,
        };
      }
    }
  });

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected confirm(): void {
    if (this.view().required && !this.text().trim()) {
      this.missing.set(true);
      this.field().nativeElement.focus();
      return;
    }
    this.confirmed.emit({ text: this.text().trim(), reviewBy: this.view().withReviewBy ? this.reviewBy() : undefined });
    this.dialog().nativeElement.close();
  }

  protected cancel(): void {
    this.dialog().nativeElement.close();
  }
}
