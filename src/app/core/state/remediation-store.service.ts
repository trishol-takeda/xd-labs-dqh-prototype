import { Injectable, computed, signal } from '@angular/core';
import { DATA_FILES, TRUSTEE } from '../constants/remediation.constants';
import {
  ActionResult,
  AuditEntry,
  AuditKind,
  Catalogue,
  CauseView,
  CauseWorkflow,
  EngineOutcome,
  Finding,
  LoadStatus,
  Signature,
} from '../models/remediation.model';
import { now } from '../util/clock';
import { full } from '../util/format';
import {
  BaseCause,
  applyEngineRun,
  buildCause,
  buildProducts,
  compareCauses,
  groupSignatures,
  nextRequestNumber,
  recordsFor,
  requestRef,
  seedWorkflows,
} from './derive';
import { PrototypeConfig } from './prototype-config.service';

export interface Toast {
  kind: 'success' | 'error';
  text: string;
}

const TOAST_MS = 5000;

/** Loads the DQH data and the rule catalogue, derives causes, and records what the trustee does. Nothing is persisted. */
@Injectable({ providedIn: 'root' })
export class RemediationStore {
  readonly status = signal<LoadStatus>('loading');
  readonly toast = signal<Toast | null>(null);

  private readonly signatures = signal<Signature[]>([]);
  private readonly findings = signal<Finding[]>([]);
  private readonly catalogue = signal<Catalogue | null>(null);
  private readonly workflows = signal<Record<string, CauseWorkflow>>({});
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly bases = computed<BaseCause[]>(() => {
    const catalogue = this.catalogue();
    return catalogue ? groupSignatures(this.signatures(), catalogue) : [];
  });

  /** Every cause, in the order a trustee should work them. */
  readonly causes = computed<CauseView[]>(() => {
    const catalogue = this.catalogue();
    const workflows = this.workflows();
    if (!catalogue) return [];
    return this.bases()
      .filter((b) => workflows[b.id])
      .map((b) => buildCause(b, workflows[b.id], catalogue))
      .sort(compareCauses);
  });

  readonly products = computed(() => {
    const catalogue = this.catalogue();
    return catalogue ? buildProducts(this.causes(), catalogue) : [];
  });

  /** Tables the ledger cannot track across runs (known blocker). */
  readonly tablesWithoutKey = computed(() => this.catalogue()?.tablesWithoutStableKey.tables ?? []);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.status.set('loading');
    try {
      const [signatures, findings, catalogue] = await Promise.all([
        this.fetchJson<Signature[]>(DATA_FILES.signatures),
        this.fetchJson<Finding[]>(DATA_FILES.findings),
        this.fetchJson<Catalogue>(DATA_FILES.catalogue),
      ]);
      this.signatures.set(signatures);
      this.findings.set(findings);
      this.catalogue.set(catalogue);
      this.workflows.set(seedWorkflows(groupSignatures(signatures, catalogue), catalogue));
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  cause(id: string | undefined): CauseView | undefined {
    return id ? this.causes().find((c) => c.id === id) : undefined;
  }

  records(cause: CauseView): Finding[] {
    return recordsFor(cause, this.findings());
  }

  // ---- What the trustee can do ---------------------------------------------

  /** The human confirmation of the classification. Q3: not one of the three actions. */
  confirm(id: string): ActionResult {
    const cause = this.cause(id);
    if (!cause || cause.state !== 'New') return this.fail('Only a new cause can be confirmed.');
    this.patch(id, (wf) => ({ ...wf, state: 'Confirmed' }), {
      kind: 'confirmed',
      text: `Cause confirmed: ${cause.rootCause}`,
      why: cause.why,
    });
    return this.ok('Cause confirmed.');
  }

  sendForCorrection(id: string, note: string): ActionResult {
    const cause = this.actionable(id);
    if (typeof cause === 'string') return this.fail(cause);
    if (!note.trim()) return this.fail('Tell the owner what to correct.');
    const ref = requestRef(nextRequestNumber(this.workflows()));
    this.patch(id, (wf) => ({ ...wf, state: 'In progress' }), {
      kind: 'sent',
      text: `Request ${ref} sent to ${cause.ownerRole} (${cause.channel})`,
      why: note.trim(),
    });
    return this.ok(`Request ${ref} recorded and sent to ${cause.ownerRole}.`);
  }

  challengeRule(id: string, reason: string): ActionResult {
    const cause = this.actionable(id);
    if (typeof cause === 'string') return this.fail(cause);
    if (!reason.trim()) return this.fail('Say why the rule is wrong.');
    this.patch(id, (wf) => ({ ...wf, disposition: 'Parked' }), {
      kind: 'challenged',
      text: 'Rule challenged with the Rules team. The cause is parked',
      why: reason.trim(),
    });
    return this.ok('Challenge recorded and sent to the Rules team. The cause is parked.');
  }

  acceptRemaining(id: string, reason: string): ActionResult {
    const cause = this.actionable(id);
    if (typeof cause === 'string') return this.fail(cause);
    if (!reason.trim()) return this.fail('Say why these failures can stay.');
    this.patch(id, (wf) => ({ ...wf, disposition: 'Risk accepted' }), {
      kind: 'accepted',
      text: 'Remaining failures accepted. Recorded in the decision log',
      why: reason.trim(),
    });
    return this.ok('Risk acceptance recorded in the decision log. The quality score does not change.');
  }

  // ---- Preview mode ----------------------------------------------------------

  /** Stands in for the rule engine until the failure ledger exists. Closing and reopening happen here, never by a trustee. */
  simulateRun(id: string, outcome: EngineOutcome): ActionResult {
    const cause = this.cause(id);
    const wf = this.workflows()[id];
    if (!cause || !wf) return this.fail('Cause not found.');
    if (!cause.hasStableKey) return this.fail('This table has no stable record key, so a fix cannot be confirmed.');
    if (cause.state === 'Closed' && outcome !== 'again') return this.fail('A closed cause can only fail again.');
    if (cause.state !== 'Closed' && outcome === 'again') return this.fail('Only a closed cause can fail again.');
    const step = applyEngineRun(cause, wf, outcome);
    this.workflows.update((all) => ({ ...all, [id]: step.workflow }));
    const now = step.workflow.state;
    if (now === cause.state) return this.ok(`Next run: ${full(step.failing)} records still failing.`);
    return this.ok(`Next run: ${full(step.failing)} records failing. The cause is now ${now}.`);
  }

  reset(): void {
    this.workflows.set(seedWorkflows(this.bases(), this.catalogue() as Catalogue));
    this.notify('success', 'Demo data reset.');
  }

  dismissToast(): void {
    clearTimeout(this.toastTimer);
    this.toast.set(null);
  }

  // ---- Internals ---------------------------------------------------------------

  /** The three actions are open to any cause that has been confirmed and is not closed. */
  private actionable(id: string): CauseView | string {
    const cause = this.cause(id);
    if (!cause) return 'Cause not found.';
    if (cause.state === 'New') return 'Confirm the cause first.';
    if (cause.state === 'Closed') return 'This cause is closed. The rule engine closes it, so there is nothing to send.';
    return cause;
  }

  private patch(id: string, change: (wf: CauseWorkflow) => CauseWorkflow, entry: { kind: AuditKind; text: string; why?: string }): void {
    const audit: AuditEntry = { at: now(), by: TRUSTEE, ...entry };
    this.workflows.update((all) => {
      const next = change(all[id]);
      return { ...all, [id]: { ...next, audit: [...next.audit, audit] } };
    });
  }

  private ok(text: string): ActionResult {
    this.notify('success', text);
    return { ok: true, message: text };
  }

  private fail(text: string): ActionResult {
    this.notify('error', text);
    return { ok: false, message: text };
  }

  private notify(kind: Toast['kind'], text: string): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ kind, text });
    this.toastTimer = setTimeout(() => this.toast.set(null), TOAST_MS);
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return (await response.json()) as T;
  }
}
