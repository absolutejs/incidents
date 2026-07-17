import type { BackoffStrategy, WakeSchedulerMetrics } from "@absolutejs/queue";

export type IncidentActor = {
  id: string;
  type: string;
};

export type IncidentSeverity = "critical" | "info" | "warning";

export type IncidentStatus = "acknowledged" | "open" | "resolved";

export type IncidentTransition =
  | "acknowledged"
  | "escalated"
  | "observed"
  | "opened"
  | "resolved";

export type LeasedDelivery<TPayload> = {
  attempt: number;
  id: string;
  idempotencyKey: string;
  payload: TPayload;
};

export type DeliveryClaimOptions = {
  leaseMs: number;
  limit: number;
  now: number;
};

export type DeliveryFailure<TPayload> = {
  delivery: LeasedDelivery<TPayload>;
  error: string;
  failedAt: number;
  nextAttemptAt: number;
};

export type LeasedDeliveryStore<TPayload> = {
  claim: (
    options: DeliveryClaimOptions,
  ) => Promise<Array<LeasedDelivery<TPayload>>>;
  complete: (
    delivery: LeasedDelivery<TPayload>,
    completedAt: number,
  ) => Promise<void>;
  fail: (failure: DeliveryFailure<TPayload>) => Promise<void>;
};

export type IncidentDeliveryWorkerMetrics = {
  active: number;
  claimed: number;
  completed: number;
  draining: boolean;
  failed: number;
  lastRunMs: number;
  preparations: number;
  runs: number;
  scheduler: WakeSchedulerMetrics;
};

export type CreateIncidentDeliveryWorkerOptions<TPayload> = {
  backoff?: BackoffStrategy;
  claimLimit?: number;
  deliver: (
    delivery: LeasedDelivery<TPayload>,
    signal: AbortSignal,
  ) => Promise<void>;
  leaseMs?: number;
  maxErrorLength?: number;
  now?: () => number;
  onComplete?: (delivery: LeasedDelivery<TPayload>) => Promise<void> | void;
  onError?: (
    error: unknown,
    delivery?: LeasedDelivery<TPayload>,
  ) => Promise<void> | void;
  onFailed?: (
    delivery: LeasedDelivery<TPayload>,
    error: string,
    nextAttemptAt: number,
  ) => Promise<void> | void;
  pollIntervalMs?: number;
  prepare?: () => Promise<void>;
  store: LeasedDeliveryStore<TPayload>;
  tenant?: string;
};

export type IncidentDeliveryWorker = {
  dispose: () => Promise<void>;
  drain: () => void;
  metrics: () => IncidentDeliveryWorkerMetrics;
  runOnce: () => Promise<number>;
  start: () => void;
};
