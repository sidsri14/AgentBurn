# AgentBurn MVP Execution Plan

## Product Goal
Catch runaway agent behavior early by tracking **reasoning steps**, **token/cost drift**, and **loops** with minimal SDK overhead.

---

## Opinionated MVP Decisions (Do This First)

1. **Single TypeScript SDK first** (Node + Bun compatible).
2. **Fast ingestion API** that only validates + enqueues.
3. **BullMQ-based async processing** for normalization, analysis, and alert dispatch.
4. **Postgres as source of truth** with pragmatic schema.
5. **Rule-based analyzer only** (no AI model in analyzer).
6. **Kill switch** enabled by API key/user toggle.
7. **Minimal dashboard** focused on job timeline + alert visibility.

---

## End-to-End Data Flow

1. App wraps a step/call with SDK (`trackStep` / `wrap`).
2. SDK emits event via fire-and-forget POST `/ingest`.
3. API validates required fields and pushes to `agent-events` queue.
4. Event Processor persists event + updates job aggregates.
5. Analyzer evaluates loop/cost/token/stuck rules and emits alert jobs.
6. Alert Dispatcher sends email/webhook and rate-limits repeated alerts.
7. Dashboard reads from Postgres for overview, job list, and job timeline.

---

## Contract: Event Schema v1

Required fields:

- `userId: string`
- `agentId: string`
- `jobId: string`
- `stepId: string`
- `stepType: "reasoning" | "tool" | "llm" | "retry" | "other"`
- `timestamp: number` (unix ms)

Optional fields:

- `input: string`
- `output: string`
- `tokens: number`
- `costUsd: number`
- `latencyMs: number`
- `intentHash: string` (SDK generated for loop checks)
- `status: "started" | "in_progress" | "completed" | "failed"`
- `meta: Record<string, unknown>`

Design notes:

- Ingestion should reject only malformed/unsafe payloads.
- Deeper normalization belongs in workers, not API.

---

## SDK Design (TypeScript First)

### Public API

- `init({ apiKey, endpoint, flushIntervalMs })`
- `trackStep(event)`
- `wrap(jobContext, fn)`
- `setEmergencyStopHandler(handler)`

### Behavior Requirements

- Non-blocking send path (`fetch` + timeout + no throw to caller by default).
- Bounded in-memory buffer with periodic flush.
- Retry with jitter for transient 5xx/network failures.
- Idempotency key per event (`eventId`) to support safe retries.
- Optional local fallback logging for debug mode.

### Kill-Switch Behavior

If remote config says API key is paused:

- `wrap` throws deterministic `AgentBurnEmergencyStopError` before LLM/tool call.
- `trackStep` can continue in no-op mode or still report stop events.

---

## API + Queue

### API Endpoints

- `POST /ingest`
- `GET /health`
- `GET /config/:apiKey` (for SDK kill-switch polling/cache)

### Queue Topology

- `agent-events` (high volume)
- `analysis-jobs` (derived checks)
- `alerts` (notification fanout)

BullMQ defaults:

- remove completed jobs aggressively.
- retry failed jobs with capped backoff.
- dead-letter queue for poison payloads.

---

## Worker Responsibilities

### 1) Event Processor

- Validate schema version.
- Upsert agent/job records.
- Insert step row.
- Update job aggregates (`totalTokens`, `totalCostUsd`, `lastStepAt`).
- Enqueue analysis job keyed by `jobId`.

### 2) Analyzer (Rule Engine)

Rules (initial thresholds):

- **Loop warning:** same `intentHash` + `stepType` repeated >= 5 within 5 min.
- **Hard kill:** same pattern repeated >= 10 within 5 min.
- **Cost spike:** `totalCostUsd` exceeds user threshold.
- **Token anomaly:** step tokens > moving average × factor (e.g., 3x).
- **Stuck job:** no step for > 2 min while status not terminal.

Outputs:

- alert row + enqueue `alerts` job.
- optional job status update (`killed`) when hard-kill rule trips.

### 3) Alert Dispatcher

- Deduplicate same alert signature for cooldown window.
- Send email first (webhook second).
- Persist delivery outcome for audit.

---

## Postgres Schema (MVP)

Core tables:

- `users`
- `agents`
- `jobs`
- `steps`
- `alerts`
- `alert_deliveries`
- `api_keys`
- `billing_usage_daily`

Indexes:

- `steps(job_id, created_at)`
- `steps(job_id, intent_hash, step_type, created_at)`
- `jobs(user_id, status, started_at desc)`
- `alerts(user_id, created_at desc)`

---

## Dashboard Scope (Minimal)

1. **Overview**
   - active jobs
   - daily cost
   - open alerts
2. **Jobs list**
   - job ID, status, total tokens, cost
3. **Job detail timeline**
   - chronological step events
   - repeated intent grouping
   - loop warning badge + kill marker
4. **Safety controls**
   - emergency stop toggle per API key

---

## Security + Multi-Tenancy

- Every record scoped by `userId`.
- API key identifies tenant; keys hashed at rest.
- Row-level protections in API/service layer from day 1.
- Do not store raw secrets in step `input/output`.
- Add configurable PII redaction before persistence.

---

## Pricing Hooks to Build Now

Track per user daily:

- `steps_ingested`
- `tokens_observed`
- `jobs_started`
- `alerts_triggered`
- `estimated_cost_observed`

This enables usage limits, overage, and trial gating later without migration pain.

---

## 7-Day Execution Plan (Practical)

### Day 1
- SDK `wrap` + `trackStep`
- local Redis + BullMQ wiring
- `/ingest` baseline

### Day 2
- event processor + DB inserts
- loop detection v1 using `intentHash`

### Day 3
- minimal dashboard (overview + jobs + detail)

### Day 4
- emergency stop toggle + SDK config polling cache

### Day 5
- Stripe plan + usage meter capture

### Day 6
- alert email polish + onboarding docs + demo script

### Day 7
- launch checklist: reliability smoke tests, landing page, outreach

---

## Non-Negotiable Guardrails

- No heavy compute in `/ingest`.
- No analyzer calls to LLMs in MVP.
- No broad multi-language SDK before PMF.
- No “pretty graph” detours over kill-switch reliability.

