import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { RemediationStore } from '../core/remediation-store.service';
import { Finding, FindingAction } from '../core/remediation.model';
import { acceptanceSigned, fmtDate, full } from '../core/remediation.util';

/** Register of every Accept action: what was accepted, who signed, and when it is reviewed again. */
@Component({
  selector: 'app-register-page',
  imports: [RouterLink, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register-page.html',
})
export class RegisterPage {
  private readonly store = inject(RemediationStore);
  protected readonly fmtDate = fmtDate;
  protected readonly full = full;

  protected readonly rows = computed(() => {
    const asOf = this.store.data()?.vocab.asOf ?? '';
    const list: { finding: Finding; action: FindingAction }[] = [];
    for (const finding of this.store.findings()) {
      for (const action of finding.actions.filter((a) => a.lever === 'accept')) list.push({ finding, action });
    }
    return list
      .sort((x, y) => (x.action.reviewBy ?? '').localeCompare(y.action.reviewBy ?? ''))
      .map(({ finding, action }) => ({
        finding,
        action,
        records: action.scopeSegments.reduce((sum, k) => sum + (finding.segments[k] || 0), 0),
        signed: acceptanceSigned(finding, action),
        due: !!action.reviewBy && action.reviewBy < asOf,
      }));
  });
}
