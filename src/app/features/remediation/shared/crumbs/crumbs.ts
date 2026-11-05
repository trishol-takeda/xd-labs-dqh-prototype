import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Crumb } from '../../core/remediation.model';

/** Breadcrumb on every screen; every crumb but the current one is a link. */
@Component({
  selector: 'app-crumbs',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './crumbs.html',
})
export class Crumbs {
  readonly crumbs = input.required<readonly Crumb[]>();
}
