## 0.1.1

- Isolate completion, failure, and error-observer hooks so an observability
  failure never retries an already-completed provider delivery.

## 0.1.0

- Add the pluggable leased delivery worker.
- Add bounded retry timing, preparation/escalation hooks, single-flight runs,
  graceful drain, scheduler integration, and operator metrics.
- Define shared incident and delivery contracts.
