import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { DemoState } from '../../../core/models/remediation.model';
import { PrototypeConfig } from '../../../core/state/prototype-config.service';
import { Icon } from '../../../ui/icon/icon';
import { OriginTag } from '../../../ui/origin-tag/origin-tag';
import { StatePanel } from '../../../ui/state-panel/state-panel';
import { MyDomainStore } from '../core/my-domain-store.service';

/** The My Domain tab: prototype controls, then the page, or a loading or error panel until the data is ready. */
@Component({
  selector: 'app-my-domain-shell',
  imports: [RouterOutlet, Icon, OriginTag, StatePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-domain-shell.html',
  styleUrl: './my-domain-shell.css',
})
export class MyDomainShell {
  protected readonly store = inject(MyDomainStore);
  protected readonly config = inject(PrototypeConfig);
  private readonly router = inject(Router);

  protected readonly demos: readonly { key: DemoState; label: string }[] = [
    { key: 'none', label: 'Normal' },
    { key: 'loading', label: 'Loading' },
    { key: 'error', label: 'Error' },
    { key: 'empty', label: 'Empty' },
  ];

  protected retry(): void {
    this.config.demo.set('none');
    void this.store.load();
  }

  protected async resetDemo(): Promise<void> {
    await this.store.resetDemo();
    await this.router.navigate(['/my-domain', 'setup']);
  }
}
