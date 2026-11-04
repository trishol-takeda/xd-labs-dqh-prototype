import { Injectable, signal } from '@angular/core';
import { DemoState } from '../models/remediation.model';

/** Prototype-only switch: which screen state to demonstrate. */
@Injectable({ providedIn: 'root' })
export class PrototypeConfig {
  readonly demo = signal<DemoState>('none');

  constructor() {
    // Deep links for the workshop: #/?demo=loading, ?demo=error, ?demo=empty
    const params = new URLSearchParams(globalThis.location?.hash.split('?')[1] ?? '');
    const demo = params.get('demo');
    if (demo === 'loading' || demo === 'error' || demo === 'empty') this.demo.set(demo);
  }
}
