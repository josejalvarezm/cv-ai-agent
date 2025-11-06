# AWS Analytics Series, Epilogue: Patterns That Survive Scale

You can outgrow free tiers, but you won’t outgrow good patterns. These are the practices that carried from a £0/month portfolio system to commercial architectures.

## What survives

- Fire‑and‑forget for non‑critical work (analytics, logging, notifications)
- Queue‑before‑DB to absorb spikes and batch writes
- Single‑table designs with composite keys + TTL cleanup
- Colocate compute with data — pick your data layer first
- Scheduled aggregation for “good enough” reporting when real‑time isn’t required

## What changes

- Real‑time dashboards → streaming/warehouse (Kinesis/Redshift, Pub/Sub/BigQuery, Event Hubs/Synapse)
- Complex ad‑hoc analysis → warehouse + BI layer (Looker, QuickSight, Power BI)
- Multi‑tenant + compliance → stronger boundaries and encryption policies
- Volume growth → cost models matter more than service names

> Where It Breaks: The £0 invariant fails at higher traffic and real‑time needs — but the topology remains.

## Reflection prompts

- What’s your design invariant (cost, latency, locality, compliance)?
- Which patterns can you keep, and where do you need new tooling?
- Are you optimising for now, or for a hypothetical future?

Thanks for reading — and for taking constraints seriously.
