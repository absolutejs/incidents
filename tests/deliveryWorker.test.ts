import { describe, expect, test } from "bun:test";
import {
  createIncidentDeliveryWorker,
  type LeasedDelivery,
  type LeasedDeliveryStore,
} from "../src";

type Payload = { message: string };

const delivery = (attempt = 1): LeasedDelivery<Payload> => ({
  attempt,
  id: "delivery-1",
  idempotencyKey: "incident-1:owner:opened",
  payload: { message: "Incident opened" },
});

describe("incident delivery worker", () => {
  test("prepares, claims, and completes leased work", async () => {
    const pending = [delivery()];
    const completed: string[] = [];
    let preparations = 0;
    const store: LeasedDeliveryStore<Payload> = {
      claim: async () => pending.splice(0),
      complete: async (item) => {
        completed.push(item.id);
      },
      fail: async () => undefined,
    };
    const worker = createIncidentDeliveryWorker({
      deliver: async () => undefined,
      prepare: async () => {
        preparations += 1;
      },
      store,
    });

    expect(await worker.runOnce()).toBe(1);
    expect(completed).toEqual(["delivery-1"]);
    expect(preparations).toBe(1);
    expect(worker.metrics()).toMatchObject({
      claimed: 1,
      completed: 1,
      failed: 0,
      preparations: 1,
      runs: 1,
    });
    await worker.dispose();
  });

  test("returns failed work with bounded retry timing", async () => {
    let currentTime = 10_000;
    let failure:
      | Parameters<LeasedDeliveryStore<Payload>["fail"]>[0]
      | undefined;
    const pending = [delivery(3)];
    const store: LeasedDeliveryStore<Payload> = {
      claim: async () => pending.splice(0),
      complete: async () => undefined,
      fail: async (value) => {
        failure = value;
      },
    };
    const worker = createIncidentDeliveryWorker({
      backoff: () => 4_000,
      deliver: async () => {
        throw new Error("Provider unavailable");
      },
      now: () => currentTime,
      store,
    });

    expect(await worker.runOnce()).toBe(1);
    expect(failure).toMatchObject({
      error: "Provider unavailable",
      failedAt: currentTime,
      nextAttemptAt: 14_000,
    });
    expect(worker.metrics()).toMatchObject({ failed: 1 });
    currentTime += 1;
    await worker.dispose();
  });

  test("does not retry completed work when an observer hook fails", async () => {
    let failures = 0;
    const pending = [delivery()];
    const store: LeasedDeliveryStore<Payload> = {
      claim: async () => pending.splice(0),
      complete: async () => undefined,
      fail: async () => {
        failures += 1;
      },
    };
    const worker = createIncidentDeliveryWorker({
      deliver: async () => undefined,
      onComplete: async () => {
        throw new Error("Audit unavailable");
      },
      onError: async () => undefined,
      store,
    });

    expect(await worker.runOnce()).toBe(1);
    expect(failures).toBe(0);
    expect(worker.metrics()).toMatchObject({ completed: 1, failed: 0 });
    await worker.dispose();
  });

  test("single-flights overlapping runs and honors drain", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = [delivery()];
    const store: LeasedDeliveryStore<Payload> = {
      claim: async () => pending.splice(0),
      complete: async () => undefined,
      fail: async () => undefined,
    };
    const worker = createIncidentDeliveryWorker({
      deliver: async () => gate,
      store,
    });
    const first = worker.runOnce();
    await Promise.resolve();
    expect(await worker.runOnce()).toBe(0);
    release?.();
    expect(await first).toBe(1);
    worker.drain();
    expect(await worker.runOnce()).toBe(0);
    await worker.dispose();
  });
});
