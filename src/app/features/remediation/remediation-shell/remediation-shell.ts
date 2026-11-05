import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { RemediationStore } from '../core/remediation-store.service';
import { Icon } from '../../../ui/icon/icon';
import { LoadingSkeleton } from '../shared/loading-skeleton/loading-skeleton';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { APP_NAME, ROLE_OPTIONS, ROLE_QUEUE_LABEL, SCREEN_STATES, SIMULATIONS } from '../core/remediation.constants';

const QUEUE_ROUTE = '/remediation/queue';

/**
 * The Data Remediation tab: prototype controls bar, app bar with the role's queue, the page outlet and the toast.
 * Uses ViewEncapsulation.None so the pages share the one stylesheet (every class is `rh-` prefixed and nested under `.rh`).
 */
@Component({
  selector: 'app-remediation-shell',
  imports: [RouterOutlet, RouterLink, Icon, LoadingSkeleton, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'rh' },
  templateUrl: './remediation-shell.html',
  styleUrl: './remediation-shell.css',
})
export class RemediationShell implements OnInit {
  protected readonly store = inject(RemediationStore);
  private readonly router = inject(Router);

  protected readonly appName = APP_NAME;
  protected readonly roles = ROLE_OPTIONS;
  protected readonly screenStates = SCREEN_STATES;
  protected readonly simulations = SIMULATIONS;

  protected readonly onQueue = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0].startsWith(QUEUE_ROUTE)),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0].startsWith(QUEUE_ROUTE) },
  );
  protected readonly queueLabel = computed(() => ROLE_QUEUE_LABEL[this.store.role()]);

  ngOnInit(): void {
    if (this.store.loadStatus() === 'idle') void this.store.load();
  }

  protected reset(): void {
    this.store.reset();
    void this.router.navigateByUrl('/remediation');
  }

  protected retry(): void {
    if (this.store.loadStatus() === 'error') void this.store.load();
    this.store.screenState.set('normal');
  }
}
