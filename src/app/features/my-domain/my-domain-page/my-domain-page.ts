import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../../../ui/icon/icon';

/** Placeholder for the My Domain prototype, which is added later. */
@Component({
  selector: 'app-my-domain-page',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-domain-page.html',
  styleUrl: './my-domain-page.css',
})
export class MyDomainPage {}
