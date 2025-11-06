# AWS Analytics Series, Preface: Constraints as Design Invariants

When budgets are £0/month, constraints aren’t a limitation — they’re the design invariant. This series documents how a production‑quality analytics pipeline for a CV chatbot was built under that invariant, and why the patterns generalise beyond AWS.

## What this preface sets up

- The invariant: £0/month ongoing cost, zero latency impact to the user (12ms response target)
- The approach: Pick the data layer first (DynamoDB), colocate compute (Lambda), buffer writes (SQS), schedule aggregation (EventBridge), deliver reports (SES)
- The lens: Every service must earn its place via constraint pressure (cost, latency, reliability)
- The thesis: Patterns like fire‑and‑forget, queue‑before‑DB, and single‑table design survive scale and vendor changes

```mermaid
flowchart LR
    A[Problem<br/>"We can't see what's happening"] --> B[Pattern<br/>Fire-and-forget]
    B --> C[Architecture<br/>SQS → Lambda → DynamoDB]
    C --> D[Cost Reality<br/>£0→££ as traffic grows]
    D --> E[Lessons<br/>Patterns that survive scale]

    classDef node fill:#f8fafc,stroke:#94a3b8,stroke-width:2px
    class A,B,C,D,E node;
```

## Series map

- Part 1: The Hidden Hard Part — why analytics matters more than performance metrics
- Part 2: Fire‑and‑Forget — the pattern that turns 112ms into 12ms
- Part 3: Architecture Under Constraint — from one pattern to a system
- Part 4: Cost and Scale — why the free tier is a forcing function, not a gimmick
- Epilogue: Patterns That Survive Scale — what carries over to commercial systems

> Pattern Transfer: The specific services are AWS; the patterns are cloud‑agnostic.
