import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Skeleton } from '../../../../ui/skeleton/skeleton';

/** Loading placeholder shaped like the data product grid: a title line, a summary line and a grid of card boxes. */
@Component({
  selector: 'app-loading-skeleton',
  imports: [Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loading-skeleton.html',
})
export class LoadingSkeleton {
  protected readonly cards = Array.from({ length: 8 }, (_, i) => i);
}
