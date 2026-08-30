# Devpost submission draft

## Project

**ProofLoop — the self-improving diagnostic team a founder does not have**

## Category

The Taskmaster

## Problem

Founders have dashboards that report what happened and AI tools that produce generic recommendations, but they often lack the strategy, analytics, and operations team required to determine what is actually wrong. Acting on the first plausible explanation wastes time, money, and customer trust.

## Solution

ProofLoop investigates a business anomaly before recommending action. It validates the signal, maps the affected system, generates competing causal hypotheses, tries to disprove its leading explanation, creates a typed Root Problem Record, proposes a reversible intervention, verifies the result, and converts validated outcomes into reusable operating rules.

## Demonstrated workflow

The demo begins with paid clicks increasing 22.4% while purchase conversion falls 24.1%. ProofLoop combines synthetic Google Ads-, Looker-, release-log-, and customer-voice-shaped evidence. It determines that acquisition remains healthy while a Mobile Safari pricing-selector failure is the leading supported cause. It requests approval for a scoped rollback, evaluates the locked metrics, measures a 16.8% relative lift, and records a verified release-quality rule.

## Technology

- Gemini 3.5 Flash-Lite
- Google ADK for Python
- Next.js 16 on Vercel
- Cloud Run
- Firestore
- FastAPI and Pydantic
- Google Ads and Looker connector scaffolding

## Four-minute demo sequence

### 0:00–0:30 — Problem

Show the anomaly and explain why metric-to-recommendation shortcuts are dangerous.

### 0:30–1:20 — Investigation

Run the diagnosis. Show signal validation, the adaptive 5W1H frame, evidence sources, alternatives, and falsification.

### 1:20–2:05 — What is actually wrong

Show the Root Problem Record. Emphasize the distinction between signal, symptom, business problem, proximate cause, and systemic cause. Point out that the status is `supported`, not intervention-validated.

### 2:05–2:45 — Guarded action

Show the targeted rollback, precommitted success metric, observation window, guardrails, stop condition, and human approval.

### 2:45–3:20 — Verification and learning

Evaluate the intervention: 41.2% control progression versus 48.1% rollback progression, a 16.8% relative lift with guardrails passing. Show the verified operating rule entering memory.

### 3:20–4:00 — Google Cloud proof and architecture

Show the Cloud Run request, deployed service URL/log, Firestore diagnostic and proof records, repository, and architecture diagram. Close with: "ProofLoop does not merely recommend what to do. It determines what problem is worth solving, proves whether the intervention worked, and makes the business smarter the next time."

## Limitations

- The hackathon incident is synthetic and privacy-safe.
- A supported causal explanation is not treated as verified until intervention results match its prediction.
- Live Google Ads and Looker access requires separately authorized credentials.
- The simulated post-intervention partition demonstrates the evaluation contract; production deployments must query the same governed metrics locked before approval.
