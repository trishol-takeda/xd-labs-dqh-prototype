import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SPARK_SIZES } from './spark.constants';

/** Decorative line of failing counts over time. `full` also marks the latest point. */
@Component({
  selector: 'app-spark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './spark.html',
})
export class Spark {
  readonly values = input.required<readonly number[]>();
  readonly variant = input<'mini' | 'full'>('full');

  protected readonly size = computed(() => SPARK_SIZES[this.variant()]);
  protected readonly points = computed(() => {
    const { width, height, pad } = this.size();
    const values = this.values();
    const max = Math.max(1, ...values);
    const span = Math.max(1, values.length - 1);
    return values.map((v, i): [number, number] => [(i / span) * width, height - pad - (v / max) * (height - 2 * pad)]);
  });
  protected readonly path = computed(() =>
    this.points()
      .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(' '),
  );
  protected readonly last = computed(() => this.points().at(-1) ?? [0, 0]);
}
