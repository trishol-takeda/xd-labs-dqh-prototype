import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RunPoint } from '../../core/models/remediation.model';
import { compact, formatDate } from '../../core/util/format';
import { SPARK_HEIGHT, SPARK_PAD, SPARK_WIDTH } from './sparkline.constants';

/** Failing records per DQ run. The last point is marked; zero is the baseline. */
@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sparkline.html',
  host: { style: 'display: block;' },
})
export class Sparkline {
  readonly runs = input.required<RunPoint[]>();

  protected readonly width = SPARK_WIDTH;
  protected readonly height = SPARK_HEIGHT;
  protected readonly pad = SPARK_PAD;

  protected readonly coords = computed(() => {
    const runs = this.runs();
    const max = Math.max(1, ...runs.map((r) => r.failing));
    const step = runs.length > 1 ? (SPARK_WIDTH - 2 * SPARK_PAD) / (runs.length - 1) : 0;
    return runs.map((r, i) => ({
      x: SPARK_PAD + i * step,
      y: SPARK_HEIGHT - SPARK_PAD - (r.failing / max) * (SPARK_HEIGHT - 2 * SPARK_PAD),
    }));
  });
  protected readonly points = computed(() => this.coords().map((c) => `${c.x},${c.y}`).join(' '));
  protected readonly last = computed(() => this.coords().at(-1) ?? { x: 0, y: SPARK_HEIGHT });
  protected readonly label = computed(() => {
    const runs = this.runs();
    if (!runs.length) return 'No runs';
    return `${runs.length} DQ runs from ${formatDate(runs[0].run)} to ${formatDate(runs.at(-1)!.run)}: ${compact(runs[0].failing)} to ${compact(runs.at(-1)!.failing)} failing records`;
  });
}
