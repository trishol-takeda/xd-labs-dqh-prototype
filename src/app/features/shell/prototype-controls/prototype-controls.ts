import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DemoState } from '../../../core/models/remediation.model';
import { PrototypeConfig } from '../../../core/state/prototype-config.service';
import { RemediationStore } from '../../../core/state/remediation-store.service';
import { Icon } from '../../../ui/icon/icon';

/** Prototype-only controls: which screen state to demonstrate, and a way back to the starting data. */
@Component({
  selector: 'app-prototype-controls',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prototype-controls.html',
  styleUrl: './prototype-controls.css',
})
export class PrototypeControls {
  protected readonly config = inject(PrototypeConfig);
  protected readonly store = inject(RemediationStore);
  protected readonly demos: readonly { key: DemoState; label: string }[] = [
    { key: 'none', label: 'Normal' },
    { key: 'loading', label: 'Loading' },
    { key: 'error', label: 'Error' },
    { key: 'empty', label: 'Empty' },
  ];
}
