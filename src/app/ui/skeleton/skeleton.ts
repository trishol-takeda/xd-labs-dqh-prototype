import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'rectangle' | 'text' | 'circle';
export type SkeletonSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * Loading placeholder that follows the takOS skeleton: tokenised surface, radius and height,
 * with a shimmer that stops under prefers-reduced-motion.
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.css',
  host: { '[style.display]': "'block'", '[style.width]': 'hostWidth()', '[style.max-width]': "'100%'" },
})
export class Skeleton {
  readonly variant = input<SkeletonVariant>('rectangle');
  readonly size = input<SkeletonSize>('md');
  /** Any CSS width, e.g. "60%" or "8rem". Defaults to the full width of the container (a circle sizes by height). */
  readonly width = input<string>();
  readonly animated = input(true);

  protected readonly hostWidth = computed(() => (this.variant() === 'circle' ? `var(--skeleton-size-${this.size()}-height)` : this.width()));
  protected readonly classes = computed(() => `shape-${this.variant()} size-${this.size()}`);
}
