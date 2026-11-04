import { PROTOTYPE_TODAY } from '../constants/remediation.constants';

/** The prototype's current moment: the fixed demo date with the real time of day. */
export function now(): string {
  return `${PROTOTYPE_TODAY}T${new Date().toISOString().slice(11, 19)}Z`;
}
