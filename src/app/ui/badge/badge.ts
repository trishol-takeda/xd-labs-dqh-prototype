import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Tone } from '../../core/constants/remediation.constants';
import { Icon } from '../icon/icon';

/** A label with a tone and an icon: status is never carried by colour alone. */
@Component({
  selector: 'app-badge',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './badge.html',
})
export class Badge {
  readonly label = input.required<string>();
  readonly tone = input<Tone>('neutral');
  readonly icon = input('');
}
