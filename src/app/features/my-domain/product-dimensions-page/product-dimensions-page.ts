import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OriginTag } from '../../../ui/origin-tag/origin-tag';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { MyDomainStore } from '../core/my-domain-store.service';
import { scoreTone } from '../core/my-domain.util';

/** Rules grouped by data quality dimension, each with its tables and a way into its rules. */
@Component({
  selector: 'app-product-dimensions-page',
  imports: [RouterLink, OriginTag, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-dimensions-page.html',
  styleUrl: './product-dimensions-page.css',
})
export class ProductDimensionsPage {
  private readonly store = inject(MyDomainStore);
  readonly productId = input.required<string>();

  protected readonly dimensions = computed(() => this.store.dimensionsOfProduct(this.productId()));
  protected readonly method = computed(() => this.store.demo()?.scoreMethod ?? '');

  protected tone(score: number | null): string {
    return `tone-${scoreTone(score)}`;
  }
}
