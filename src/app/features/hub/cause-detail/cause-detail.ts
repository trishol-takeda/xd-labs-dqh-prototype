import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BAND_MEANING, BAND_TONE, STATE_INFO } from '../../../core/constants/remediation.constants';
import { CauseView } from '../../../core/models/remediation.model';
import { compact, formatDate, full } from '../../../core/util/format';
import { Badge } from '../../../ui/badge/badge';
import { Icon } from '../../../ui/icon/icon';
import { Sparkline } from '../../../ui/sparkline/sparkline';
import { AuditTrail } from '../audit-trail/audit-trail';
import { CauseActions } from '../cause-actions/cause-actions';
import { EnginePreview } from '../engine-preview/engine-preview';
import { SampleRecords } from '../sample-records/sample-records';

/** Zone 3: everything a trustee needs to understand one cause and act on it. */
@Component({
  selector: 'app-cause-detail',
  imports: [Badge, Icon, Sparkline, CauseActions, SampleRecords, EnginePreview, AuditTrail],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cause-detail.html',
  styleUrl: './cause-detail.css',
})
export class CauseDetail {
  readonly cause = input<CauseView>();
  readonly dismiss = output();

  protected readonly stateInfo = STATE_INFO;
  protected readonly bandTone = BAND_TONE;
  protected readonly bandMeaning = BAND_MEANING;
  protected readonly compact = compact;
  protected readonly formatDate = formatDate;
  protected readonly full = full;
}
