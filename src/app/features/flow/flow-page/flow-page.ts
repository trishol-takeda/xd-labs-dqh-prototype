import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ACTION_COPY,
  CLASS_ROUTING,
  CLASS_WHY,
  LIFECYCLE,
  OPEN_QUESTIONS,
  STATE_INFO,
} from '../../../core/constants/remediation.constants';
import { RootCauseClass } from '../../../core/models/remediation.model';
import { Badge } from '../../../ui/badge/badge';
import { Icon } from '../../../ui/icon/icon';
import { BLOCKERS, RULES } from '../flow.constants';

/** One page: the lifecycle, the three actions, how a cause is routed, and what the team still has to decide. */
@Component({
  selector: 'app-flow-page',
  imports: [Badge, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flow-page.html',
  styleUrl: './flow-page.css',
})
export class FlowPage {
  protected readonly lifecycle = LIFECYCLE;
  protected readonly stateInfo = STATE_INFO;
  protected readonly actions = Object.values(ACTION_COPY);
  protected readonly rules = RULES;
  protected readonly blockers = BLOCKERS;
  protected readonly questions = OPEN_QUESTIONS;
  protected readonly routing = (Object.keys(CLASS_ROUTING) as RootCauseClass[]).map((cause) => ({
    cause,
    ...CLASS_ROUTING[cause],
    why: CLASS_WHY[cause].replace('{system}', 'the source system'),
  }));
}
