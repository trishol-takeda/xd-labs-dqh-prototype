import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../../core/remediation.model';
import { Chip } from '../chip/chip';
import { OpenCount } from '../open-count/open-count';

export interface ProductCard {
  product: Product;
  open: number;
  pastTarget: number;
  inScopeScore: number;
}

/** Product cards: tier, name, domain, quality score and in-scope score, open findings and how many are past target. */
@Component({
  selector: 'app-product-grid',
  imports: [RouterLink, Chip, OpenCount],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-grid.html',
})
export class ProductGrid {
  readonly cards = input.required<readonly ProductCard[]>();
}
