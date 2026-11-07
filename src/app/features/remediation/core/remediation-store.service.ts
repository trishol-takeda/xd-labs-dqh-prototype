import { Injectable, computed, signal } from '@angular/core';
import { DEFAULT_DOMAIN, REMEDIATION_DATA_FILES, ROLE_LABEL, TOAST_MS } from './remediation.constants';
import {
  ActionInput,
  Dataset,
  Finding,
  FindingAction,
  ImpactInput,
  InvestigationInput,
  Product,
  RegistryTable,
  Role,
  ScopeInput,
  ScreenState,
  SimulationInput,
} from './remediation.model';
import { seedDataset } from './remediation.seed';
import * as lifecycle from './remediation.transitions';
import { advanceTarget, byImpact, queueList } from './remediation.util';

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
  /** The domain a trustee is "of": their landing page and queue follow it. */
  readonly myDomain = signal<string>(DEFAULT_DOMAIN);
  readonly screenState = signal<ScreenState>('normal');
  readonly toast = signal<string | null>(null);
  /** The finding on screen, if any: the prototype bar shows "Advance action" and "Simulate next check" only then. */
  readonly activeFindingId = signal<string | null>(null);

  readonly findings = computed(() => this.data()?.findings ?? []);
  readonly products = computed(() => this.data()?.registry.products ?? []);
  readonly activeFinding = computed(() => this.findings().find((f) => f.id === this.activeFindingId()));

  /** The role's queue, by impact score (never by record count). */
  readonly queue = computed<Finding[]>(() => {
    const d = this.data();
    return d ? queueList(d, this.role(), this.myDomain()).sort(byImpact) : [];
  });

  async load(): Promise<void> {
    this.loadStatus.set('loading');
    try {
      const [vocab, registry, findings, rules] = await Promise.all([
        this.json<Dataset['vocab']>(REMEDIATION_DATA_FILES.vocab),
        this.json<Dataset['registry']>(REMEDIATION_DATA_FILES.registry),
        this.json<{ findings: Dataset['findings'] }>(REMEDIATION_DATA_FILES.findings),
        this.json<{ rules: Dataset['rules'] }>(REMEDIATION_DATA_FILES.rules),
      ]);
      this.loaded = { vocab, registry, findings: findings.findings, rules: rules.rules };
      this.data.set(seedDataset(this.loaded));
      this.loadStatus.set('ready');
    } catch {
      this.loadStatus.set('error');
    }
  }

  /** Back to the seeded start state: same data, trustee of Manufacturing, normal screen. */
  reset(): void {
    if (!this.loaded) return;
    this.data.set(seedDataset(this.loaded));
    this.role.set('trustee');
    this.myDomain.set(DEFAULT_DOMAIN);
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
  table(id: string): RegistryTable | undefined {
    return this.data()?.registry.tables.find((t) => t.id === id);
  }
  finding(id: string): Finding | undefined {
    return this.findings().find((f) => f.id === id);
  }

  /* ---------- decisions ---------- */

  setScope(f: Finding, input: ScopeInput): void {
    this.change(lifecycle.setScope(this.dataset(), f.id, input, now()), 'Scope saved.');
  }
  concur(f: Finding): void {
    this.change(lifecycle.concurWithScope(this.dataset(), f.id, now()), 'Scope concurred.');
  }
  assessImpact(f: Finding, input: ImpactInput): void {
    this.change(lifecycle.assessImpact(this.dataset(), f.id, input, this.role(), now()), 'Impact recorded.');
  }
  recordRootCause(f: Finding, input: InvestigationInput): void {
    this.change(lifecycle.recordRootCause(this.dataset(), f.id, input, now()), 'Root cause recorded.');
  }
  addAction(f: Finding, input: ActionInput): void {
    this.change(lifecycle.addAction(this.dataset(), f.id, input, now()), 'Action added.');
  }
  sign(f: Finding, action: FindingAction, who: string): void {
    this.change(lifecycle.signAction(this.dataset(), f.id, action.id, who, now()), 'Signed.');
  }

  /* ---------- Rules team ---------- */

  publishCheckChange(f: Finding, what: string): void {
    const version = (f.history[f.history.length - 1].ruleVersion ?? 1) + 1;
    this.change(lifecycle.publishCheckChange(this.dataset(), f.id, what, now()), `Version ${version} published.`);
  }
  checkStands(f: Finding): void {
    this.change(lifecycle.checkStands(this.dataset(), f.id, now()), 'Check stands.');
  }

  /* ---------- prototype controls ---------- */

  /** Marks the finding's first open action live, then done. */
  advance(): void {
    const f = this.activeFinding();
    if (!f || !advanceTarget(f)) {
      this.showToast('No action to advance.');
      return;
    }
    this.change(lifecycle.advanceAction(this.dataset(), f.id, now()), 'Action advanced.');
  }

  simulate(input: SimulationInput): void {
    const id = this.activeFindingId();
    if (id) this.change(lifecycle.simulateCheck(this.dataset(), id, input), 'Next check applied.');
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
