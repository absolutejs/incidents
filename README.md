# @absolutejs/incidents

Reusable incident-delivery infrastructure for AbsoluteJS control planes.
Applications retain their domain-specific incident schema and transitions;
this package owns the operational machinery that should not be rewritten:

## Delivery worker capabilities

- multi-replica lease claiming through a pluggable store;
- bounded exponential retry after provider failures;
- expired-lease recovery through the store's claim contract;
- a preparation hook for discovery, deduplication, dismissal, or escalation;
- single-flight runs, graceful drain, scheduling, and operator metrics.

## Store and idempotency contract

The store must claim atomically and return an incremented one-based attempt.
PostgreSQL adapters should use `FOR UPDATE SKIP LOCKED` and make expired leases
claimable. Delivery handlers receive a stable idempotency key and should pass it
to providers that support idempotent requests.

## Quick start

```ts
import { createIncidentDeliveryWorker } from '@absolutejs/incidents';

const worker = createIncidentDeliveryWorker({
	store: incidentDeliveryStore,
	prepare: discoverAndEscalateIncidents,
	deliver: (delivery, signal) =>
		dispatchAlert(delivery.payload, {
			idempotencyKey: delivery.idempotencyKey,
			signal
		})
});

await worker.runOnce();
worker.start();
```

## Application-owned policy

Incident state, event ledgers, acknowledgement rules, resolution authorization,
and recipient selection remain application policy. This separation lets one
worker serve email, paging, webhook, or provider-specific adapters without
forcing every product into one database schema.
