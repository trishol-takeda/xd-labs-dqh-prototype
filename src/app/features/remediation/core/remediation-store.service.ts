import { Injectable, computed, signal } from '@angular/core';
import { REMEDIATION_DATA_FILES, ROLE_LABEL, TOAST_MS } from './remediation.constants';
import { Cause, Dataset, Product, Role, ScreenState, SimulationMode, Table } from './remediation.model';
import { seedDataset } from './remediation.seed';
import * as lifecycle from './remediation.transitions';
import { compareCauses, full } from './remediation.util';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * One store for the Remediation Hub. It loads the four JSON files once, keeps the working copy in a signal and
 * hands every change to the pure functions in remediation.transitions.ts. Nothing is persisted; Reset reseeds.
 */
@Injectable({ providedIn: 'root' })
export class RemediationStore {
  private loaded: Dataset | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  readonly loadStatus = signal<LoadStatus>('idle');
  readonly data = signal<Dataset | null>(null);
  readonly role = signal<Role>('trustee');
  readonly roleLabel = computed(() => ROLE_LABEL[this.role()]);
  readonly screenState = signal<ScreenState>('normal');
  readonly toast = signal<string | null>(null);
  /** The cause on screen, if any: the controls bar shows "Simulate next check" only then. */
  readonly activeCauseId = signal<string | null>(null);

  readonly products = computed(() => this.data()?.products ?? []);
  readonly causes = computed(() => this.data()?.causes ?? []);
  readonly openCauseCount = computed(() => this.causes().filter((c) => c.visibleStatus !== 'fixed').length);

  /** The role's queue: what trustees must review, what fixers must correct, what the Rules team must answer. */
  readonly queue = computed<Cause[]>(() => {
    const role = this.role();
    const all = this.causes();
    const list =
      role === 'fixer' ? all.filter((c) => c.visibleStatus === 'waiting') : role === 'rules' ? all.filter((c) => c.disputed) : all.filter((c) => c.visibleStatus === 'needs_you');
    return [...list].sort(compareCauses);
  });

  /** The number on the queue link: fixers only count causes they have not answered yet. */
  readonly queueCount = computed(() => {
    const role = this.role();
    if (role === 'fixer') return this.causes().filter((c) => c.visibleStatus === 'waiting' && !c.fixerStatus).length;
    return this.queue().length;
  });

  async load(): Promise<void> {
    this.loadStatus.set('loading');
    try {
      const [products, tables, rules, causes] = await Promise.all([
        this.json<{ meta: Dataset['meta']; products: Dataset['products'] }>(REMEDIATION_DATA_FILES.products),
        this.json<{ tables: Dataset['tables'] }>(REMEDIATION_DATA_FILES.tables),
        this.json<{ rules: Dataset['rules'] }>(REMEDIATION_DATA_FILES.rules),
        this.json<{ causes: Dataset['causes'] }>(REMEDIATION_DATA_FILES.causes),
      ]);
      this.loaded = { meta: products.meta, products: products.products, tables: tables.tables, rules: rules.rules, causes: causes.causes };
      this.data.set(seedDataset(this.loaded));
      this.loadStatus.set('ready');
    } catch {
      this.loadStatus.set('error');
    }
  }

  /** Back to the seeded start state: same data, trustee view, normal screen. */
  reset(): void {
    if (!this.loaded) return;
    this.data.set(seedDataset(this.loaded));
    this.role.set('trustee');
    this.screenState.set('normal');
    this.showToast('Reset.');
  }

  setRole(role: Role): void {
    this.role.set(role);
    this.showToast(`Viewing as ${ROLE_LABEL[role]}.`);
  }

  /* ---------- lookups ---------- */

  product(id: string): Product | undefined {
    return this.products().find((p) => p.id === id);
  }
  productByName(name: string | undefined): Product | undefined {
    return this.products().find((p) => p.name === name);
  }
  table(id: string): Table | undefined {
    return this.data()?.tables.find((t) => t.id === id);
  }
  cause(id: string): Cause | undefined {
    return this.causes().find((c) => c.id === id);
  }

  /* ---------- actions ---------- */

  sendForCorrection(c: Cause, note: string): void {
    this.change(lifecycle.sendForCorrection(this.dataset(), c.id, note, now()), `Sent to ${c.fixerRole}.`);
  }
  dispute(c: Cause, why: string): void {
    this.change(lifecycle.disputeRule(this.dataset(), c.id, why, now()), 'Dispute sent to the Rules team.');
  }
  accept(c: Cause, why: string, reviewBy: string): void {
    this.change(lifecycle.acceptRemaining(this.dataset(), c.id, why, reviewBy, now()), 'Accepted and recorded.');
  }
  markDone(c: Cause): void {
    this.change(lifecycle.markDone(this.dataset(), c.id, now()), 'Marked as done.');
  }
  cannotFix(c: Cause, why: string): void {
    this.change(lifecycle.cannotFix(this.dataset(), c.id, why, now()), 'Sent back to the trustee.');
  }
  changeRule(c: Cause, what: string): void {
    this.change(lifecycle.changeRule(this.dataset(), c.id, what, now()), `Version ${lifecycle.nextRuleVersion(c)} published.`);
  }
  ruleStands(c: Cause): void {
    this.change(lifecycle.ruleStands(this.dataset(), c.id, now()), 'Dispute closed. The rule stands.');
  }

  /** The prototype controls' "Simulate next check", applied to the cause on screen. */
  simulate(mode: SimulationMode): void {
    const id = this.activeCauseId();
    if (!id) return;
    const next = lifecycle.simulateRun(this.dataset(), id, mode);
    const failing = next.causes.find((c) => c.id === id)?.failingNow ?? 0;
    this.change(next, mode === 'all' ? 'Next run: no failures.' : mode === 'some' ? `Next run: ${full(failing)} still failing.` : 'Next run: no change.');
  }

  showToast(text: string): void {
    this.toast.set(text);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), TOAST_MS);
  }

  private change(next: Dataset, toast: string): void {
    this.data.set(next);
    this.showToast(toast);
  }

  private dataset(): Dataset {
    const d = this.data();
    if (!d) throw new Error('Remediation data is not loaded');
    return d;
  }

  private async json<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
    return (await response.json()) as T;
  }
}

function now(): string {
  return new Date().toISOString();
}
