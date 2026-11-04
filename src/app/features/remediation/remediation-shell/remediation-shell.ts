import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PrototypeControls } from '../../shell/prototype-controls/prototype-controls';
import { Icon } from '../../../ui/icon/icon';
import { REMEDIATION_SECTIONS } from '../remediation.constants';

/** The Data Remediation tab: its own sub-navigation, the prototype controls and the pages that belong to it. */
@Component({
  selector: 'app-remediation-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PrototypeControls, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './remediation-shell.html',
  styleUrl: './remediation-shell.css',
})
export class RemediationShell {
  protected readonly sections = REMEDIATION_SECTIONS;
}
