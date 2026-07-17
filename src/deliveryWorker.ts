import { createWakeScheduler, exponentialBackoff } from "@absolutejs/queue";
import type {
  CreateIncidentDeliveryWorkerOptions,
  IncidentDeliveryWorker,
  LeasedDelivery,
} from "./types";

const DEFAULT_CLAIM_LIMIT = 20;
const DEFAULT_LEASE_MS = 300_000;
const DEFAULT_MAX_ERROR_LENGTH = 500;
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_RETRY_BASE_MS = 60_000;
const DEFAULT_RETRY_MAX_MS = 3_600_000;

const errorMessage = (error: unknown, maximumLength: number) =>
  (error instanceof Error ? error.message : "Unknown delivery failure").slice(
    0,
    maximumLength,
  );

export const createIncidentDeliveryWorker = <TPayload>({
  backoff = exponentialBackoff({
    baseMs: DEFAULT_RETRY_BASE_MS,
    maxMs: DEFAULT_RETRY_MAX_MS,
  }),
  claimLimit = DEFAULT_CLAIM_LIMIT,
  deliver,
  leaseMs = DEFAULT_LEASE_MS,
  maxErrorLength = DEFAULT_MAX_ERROR_LENGTH,
  now = Date.now,
  onComplete,
  onError,
  onFailed,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  prepare,
  store,
  tenant = "control-plane",
}: CreateIncidentDeliveryWorkerOptions<TPayload>): IncidentDeliveryWorker => {
  let active = 0;
  let claimed = 0;
  let completed = 0;
  let draining = false;
  let failed = 0;
  let lastRunMs = 0;
  let preparations = 0;
  let running = false;
  let runs = 0;

  const processDelivery = async (delivery: LeasedDelivery<TPayload>) => {
    active += 1;
    const controller = new AbortController();
    try {
      await deliver(delivery, controller.signal);
      await store.complete(delivery, now());
      completed += 1;
      await onComplete?.(delivery);
    } catch (error) {
      const message = errorMessage(error, maxErrorLength);
      const nextAttemptAt = now() + backoff(delivery.attempt);
      try {
        await store.fail({
          delivery,
          error: message,
          failedAt: now(),
          nextAttemptAt,
        });
        failed += 1;
        await onFailed?.(delivery, message, nextAttemptAt);
      } catch (storeError) {
        await onError?.(storeError, delivery);
      }
      await onError?.(error, delivery);
    } finally {
      active -= 1;
    }
  };

  const runOnce = async () => {
    if (running || draining) return 0;
    running = true;
    const startedAt = now();
    try {
      runs += 1;
      if (prepare) {
        await prepare();
        preparations += 1;
      }
      const deliveries = await store.claim({
        leaseMs,
        limit: claimLimit,
        now: now(),
      });
      claimed += deliveries.length;
      await Promise.all(deliveries.map(processDelivery));

      return deliveries.length;
    } catch (error) {
      await onError?.(error);

      return 0;
    } finally {
      lastRunMs = Math.max(0, now() - startedAt);
      running = false;
    }
  };

  const scheduler = createWakeScheduler({
    catchUp: "once",
    entries: [
      {
        every: pollIntervalMs,
        id: "incident-deliveries",
        tenant,
      },
    ],
    onError: (error) => {
      void onError?.(error);
    },
    tickMs: pollIntervalMs,
    wake: async () => {
      await runOnce();
    },
  });

  return {
    dispose: async () => {
      draining = true;
      scheduler.drain();
      await scheduler.stop();
    },
    drain: () => {
      draining = true;
      scheduler.drain();
    },
    metrics: () => ({
      active,
      claimed,
      completed,
      draining,
      failed,
      lastRunMs,
      preparations,
      runs,
      scheduler: scheduler.metrics(),
    }),
    runOnce,
    start: () => scheduler.start(),
  };
};
