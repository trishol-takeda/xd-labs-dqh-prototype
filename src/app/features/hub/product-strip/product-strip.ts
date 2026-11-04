import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ProductView } from '../../../core/models/remediation.model';

/** Zone 1: every data product with its quality score and how many causes are open. */
@Component({
  selector: 'app-product-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-strip.html',
  styleUrl: './product-strip.css',
})
export class ProductStrip {
  readonly products = input.required<ProductView[]>();
  readonly selected = input.required<string>();
  readonly select = output<string>();
}
