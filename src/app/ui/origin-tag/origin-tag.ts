import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ORIGIN_INFO } from '../../features/my-domain/core/my-domain.constants';
import { OriginKind } from '../../features/my-domain/core/my-domain.model';
import { Badge } from '../badge/badge';

/** Marks where a value comes from, so source-derived and synthetic data are never confused. */
@Component({
  selector: 'app-origin-tag',
  imports: [Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './origin-tag.html',
})
export class OriginTag {
  readonly kind = input.required<OriginKind>();
  readonly short = input(false);
  protected readonly info = computed(() => ORIGIN_INFO[this.kind()]);
  protected readonly label = computed(() => (this.short() && this.kind() === 'synthetic' ? 'Synthetic' : this.info().label));
}
