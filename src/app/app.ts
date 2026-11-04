import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FeatureFlags } from './core/feature-flags/feature-flags.service';
import { RemediationStore } from './core/state/remediation-store.service';
import { MyDomainStore } from './features/my-domain/core/my-domain-store.service';
import { Icon } from './ui/icon/icon';
import { TABS } from './app.constants';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly store = inject(RemediationStore);
  protected readonly flags = inject(FeatureFlags);
  private readonly myDomain = inject(MyDomainStore);

  protected readonly tabs = computed(() => TABS.filter((t) => !t.flag || this.flags.isEnabled(t.flag)));

  protected readonly userName = this.myDomain.userName;
  protected readonly initials = computed(() =>
    this.userName().split(/s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join(''),
  );
}
