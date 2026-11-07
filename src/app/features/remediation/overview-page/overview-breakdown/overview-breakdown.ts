import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreakdownModel } from '../../core/remediation.overview';
import { compact, segWords, fieldSummary } from '../../core/remediation.util';
import { Spark } from '../../shared/spark/spark';

/** The detailed panels behind "Show breakdowns": by symptom, site and owner; the trend; domain → product; the largest findings. */
@Component({
  selector: 'app-overview-breakdown',
  imports: [RouterLink, Spark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview-breakdown.html',
})
export class OverviewBreakdown {
  readonly model = input.required<BreakdownModel>();
  readonly trend = input.required<readonly number[]>();

  protected readonly compact = compact;
  protected readonly segWords = segWords;
  protected readonly fieldSummary = fieldSummary;
}
