import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AuditEntry } from '../../../core/models/remediation.model';
import { formatDate } from '../../../core/util/format';

/** Append-only history of what happened to a cause: who, when and why. Entries cannot be edited or removed. */
@Component({
  selector: 'app-audit-trail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-trail.html',
})
export class AuditTrail {
  readonly entries = input.required<AuditEntry[]>();
  protected readonly formatDate = formatDate;
}
