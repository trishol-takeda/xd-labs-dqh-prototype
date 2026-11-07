import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RemediationStore } from '../core/remediation-store.service';
import { NEXT_LABEL } from '../core/remediation.constants';
import { breakdownModel, overviewModel } from '../core/remediation.overview';
import { compact, fmtDate, nextDecision, plural, segWords } from '../core/remediation.util';
import { OverviewBreakdown } from './overview-breakdown/overview-breakdown';
import { CHART_HEIGHT, CHART_PAD, CHART_WIDTH, CHART_LABEL_ROOM } from './overview.constants';

/** Leadership landing, open to everyone: one sentence, three numbers, one chart, five findings, four domains. */
@Component({
  selector: 'app-overview-page',
  imports: [RouterLink, OverviewBreakdown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview-page.html',
})
export class OverviewPage {
  protected readonly store = inject(RemediationStore);
  protected readonly compact = compact;
  protected readonly fmtDate = fmtDate;
  protected readonly plural = plural;
  protected readonly segWords = segWords;
  protected readonly chartWidth = CHART_WIDTH;
  protected readonly chartHeight = CHART_HEIGHT;
  protected readonly showMore = signal(false);

  protected readonly model = computed(() => {
    const d = this.store.data();
    return d ? overviewModel(d) : null;
  });
  protected readonly breakdown = computed(() => {
    const d = this.store.data();
    return d ? breakdownModel(d) : null;
  });
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

  protected readonly first = computed(() =>
    (this.model()?.top ?? []).map((f, i) => {
      const key = nextDecision(f);
      return { finding: f, rank: i + 1, next: (key ? NEXT_LABEL[key] : '') + (f.pastTarget ? ` · ${f.ageWorkingDays} d` : '') };
    }),
  );
}
