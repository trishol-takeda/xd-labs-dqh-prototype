import { Injectable, signal } from '@angular/core';
import { FEATURE_FLAG_DEFAULTS, FEATURE_FLAG_STORAGE_KEY, FeatureFlagName } from './feature-flags.constants';

type FlagMap = Record<FeatureFlagName, boolean>;

function read(): FlagMap {
  const flags = { ...FEATURE_FLAG_DEFAULTS };
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(FEATURE_FLAG_STORAGE_KEY) ?? '{}') as Partial<FlagMap>;
    (Object.keys(flags) as FeatureFlagName[]).forEach((k) => {
      const value = stored[k];
      if (typeof value === 'boolean') flags[k] = value;
    });
  } catch {
    // Unreadable storage: keep the defaults.
  }
  // Deep link for the workshop: #/my-domain?ff=my-domain:off (comma separated, on|off)
  const ff = new URLSearchParams(globalThis.location?.hash.split('?')[1] ?? '').get('ff');
  ff?.split(',').forEach((pair) => {
    const [name, value] = pair.split(':');
    if (name in flags && (value === 'on' || value === 'off')) flags[name as FeatureFlagName] = value === 'on';
  });
  return flags;
}

/** Feature flags for the prototype. A real application replaces this with the platform's flag service. */
@Injectable({ providedIn: 'root' })
export class FeatureFlags {
  private readonly flags = signal<FlagMap>(read());

  isEnabled(name: FeatureFlagName): boolean {
    return this.flags()[name];
  }

  set(name: FeatureFlagName, enabled: boolean): void {
    this.flags.update((f) => ({ ...f, [name]: enabled }));
    try {
      globalThis.localStorage?.setItem(FEATURE_FLAG_STORAGE_KEY, JSON.stringify(this.flags()));
    } catch {
      // Storage may be blocked; the flag still holds for this session.
    }
  }
}
