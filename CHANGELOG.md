# Changelog

## 0.1.3 — 2026-08-07

- Uses Queue 0.7.2 so incident delivery shares the Telemetry 0.3 runtime.

## 0.1.1

- Isolate completion, failure, and error-observer hooks so an observability
  failure never retries an already-completed provider delivery.

## 0.1.0

- Add the pluggable leased delivery worker.
- Add bounded retry timing, preparation/escalation hooks, single-flight runs,
  graceful drain, scheduler integration, and operator metrics.
- Define shared incident and delivery contracts.
