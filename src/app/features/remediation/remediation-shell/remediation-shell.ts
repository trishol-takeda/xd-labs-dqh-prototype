import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Icon } from '../../../ui/icon/icon';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { RemediationStore } from '../core/remediation-store.service';
import { APP_NAME, BACKLOG_OPTIONS, NEW_FAILURE_OPTIONS, QUEUE_LABEL, ROLE_OPTIONS, SCREEN_STATES, TRUSTEE_DOMAINS } from '../core/remediation.constants';
import { BacklogChoice, NewFailuresChoice, Role } from '../core/remediation.model';
import { LoadingSkeleton } from '../shared/loading-skeleton/loading-skeleton';

type Section = 'overview' | 'queue' | 'register' | 'products';

function sectionOf(url: string): Section {
  const path = url.split(/[?#]/)[0];
  if (path.startsWith('/remediation/overview')) return 'overview';
  if (path.startsWith('/remediation/queue')) return 'queue';
  if (path.startsWith('/remediation/register')) return 'register';
  return 'products';
}

/**
 * The Data Remediation tab: prototype controls bar, app bar with the role's navigation, the page outlet and the toast.
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
  protected readonly domains = TRUSTEE_DOMAINS;
  protected readonly screenStates = SCREEN_STATES;
  protected readonly newFailureOptions = NEW_FAILURE_OPTIONS;
  protected readonly backlogOptions = BACKLOG_OPTIONS;

  protected readonly simNew = signal<NewFailuresChoice>('none');
  protected readonly simBacklog = signal<BacklogChoice>('same');

  protected readonly section = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => sectionOf(e.urlAfterRedirects)),
    ),
    { initialValue: sectionOf(this.router.url) },
  );
  protected readonly queueLabel = computed(() => QUEUE_LABEL[this.store.role()]);

  ngOnInit(): void {
    if (this.store.loadStatus() === 'idle') void this.store.load();
  }

  protected setRole(role: Role): void {
    this.store.setRole(role);
    if (role === 'leader') void this.router.navigateByUrl('/remediation/overview');
    else if (this.section() === 'overview' || this.section() === 'queue') void this.router.navigateByUrl('/remediation');
  }

  protected setDomain(event: Event): void {
    this.store.myDomain.set((event.target as HTMLSelectElement).value);
  }

  protected setSimNew(event: Event): void {
    this.simNew.set((event.target as HTMLSelectElement).value as NewFailuresChoice);
  }

  protected setSimBacklog(event: Event): void {
    this.simBacklog.set((event.target as HTMLSelectElement).value as BacklogChoice);
  }

  protected simulate(): void {
    this.store.simulate({ newFailures: this.simNew(), backlog: this.simBacklog() });
  }

  protected reset(): void {
    this.store.reset();
    this.simNew.set('none');
    this.simBacklog.set('same');
    void this.router.navigateByUrl('/remediation');
  }

  protected retry(): void {
    if (this.store.loadStatus() === 'error') void this.store.load();
    this.store.screenState.set('normal');
  }
}
