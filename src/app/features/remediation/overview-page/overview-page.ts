import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RemediationStore } from '../core/remediation-store.service';
import { overviewModel } from '../core/remediation.overview';
import { compact, fmtDate, plural } from '../core/remediation.util';
import { CHART_HEIGHT, CHART_LABEL_ROOM, CHART_PAD, CHART_WIDTH } from './overview.constants';

/**
 * Leadership view, open to everyone: patterns, not tasks. What is wrong, where, and who is fixing it.
 * Nothing on this screen asks the viewer to act and nothing names a person.
 */
@Component({
  selector: 'app-overview-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview-page.html',
})
export class OverviewPage {
  protected readonly store = inject(RemediationStore);
  protected readonly compact = compact;
  protected readonly fmtDate = fmtDate;
  protected readonly plural = plural;
  protected readonly chartWidth = CHART_WIDTH;
  protected readonly chartHeight = CHART_HEIGHT;
  protected readonly showProvenance = signal(false);

  protected readonly model = computed(() => {
    const d = this.store.data();
    return d ? overviewModel(d) : null;
  });
  protected readonly provenance = computed(() => this.store.data()?.vocab.provenance);
  protected readonly asOf = computed(() => this.store.data()?.vocab.asOf ?? '');

  protected readonly chart = computed(() => {
    const m = this.model();
    if (!m) return { area: '', line: '', x: 0, y: 0 };
    const max = Math.max(1, ...m.trend);
    const span = Math.max(1, m.trend.length - 1);
    const points = m.trend.map((v, i): [number, number] => [(i / span) * CHART_WIDTH, CHART_HEIGHT - CHART_PAD - (v / max) * (CHART_HEIGHT - 2 * CHART_PAD - CHART_LABEL_ROOM)]);
    const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const [x, y] = points.at(-1) ?? [0, 0];
    return { line, area: `${line} L${CHART_WIDTH} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z`, x, y };
  });

  protected width(value: number, bars: readonly { value: number }[]): number {
    return (100 * value) / Math.max(1, bars[0]?.value ?? 1);
  }
}
