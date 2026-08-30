# Devpost submission draft

## Project

**ProofLoop — the self-improving diagnostic team a founder does not have**

## Category

The Taskmaster

## Problem

Founders have dashboards that report what happened and AI tools that produce generic recommendations, but they often lack the strategy, analytics, and operations team required to determine what is actually wrong. Acting on the first plausible explanation wastes time, money, and customer trust.

## Solution

ProofLoop investigates a business anomaly as a graph of bounded RED/GREEN loops. It maps the failing process and standard, splits the investigation into product, customer, growth, and operations units, retries only incomplete branches, deterministically merges valid supported and rejected conclusions, passes a separate action-risk gate, verifies the intervention, and converts the outcome into a constraint for future investigations.

For reliable live judging, one hosted ADK orchestrator applies the complete
graph contract in one schema-constrained Gemini call. A deterministic Python
state controller independently enforces problem, node, evidence, and risk gates. The repository retains
the sequential six-agent workflow as an evaluation mode.

## Demonstrated workflow

The demo begins with paid clicks increasing 22.4% while purchase conversion falls 24.1%. ProofLoop combines synthetic Google Ads-, Looker-, release-, quality-control-, and customer-voice-shaped evidence. It locates the failure at checkout's pricing-selection step, identifies the missing Mobile Safari release control, and rules down acquisition quality as the primary cause. It requests approval for a scoped rollback, evaluates the locked metrics, measures a 16.8% relative lift, updates the release standard, and records a recurrence monitor.

## Technology

- Gemini 3.5 Flash-Lite
- Google ADK for Python
- Next.js 16 on Vercel
- Render Docker web service
- Firestore
- FastAPI and Pydantic
- Google Ads and Looker connector scaffolding

## Live application

- Web app: https://proofloop-flywheel.vercel.app
- Agent API: https://proofloop-agent.onrender.com

## Four-minute demo sequence

### 0:00–0:30 — Problem

Show the anomaly and explain why metric-to-recommendation shortcuts are dangerous.

### 0:30–1:20 — Investigation

Run the diagnosis. Show signal validation, the adaptive 5W1H frame, evidence sources, alternatives, and falsification.

### 1:20–2:05 — What is actually wrong

Show the live investigation graph. Emphasize that the Growth hypothesis is rejected but GREEN because the unit reached a valid conclusion. Explain that RED means the unit—not the hypothesis—is incomplete, and only that branch retries. Point out that Python—not Gemini—decides whether the evidence and risk gates passed.

### 2:05–2:45 — Guarded action

Show the targeted rollback, precommitted success metric, observation window, guardrails, stop condition, and human approval.

### 2:45–3:20 — Verification and learning

Evaluate the intervention: 41.2% control progression versus 48.1% rollback progression, a 16.8% relative lift with guardrails passing. Show the derived constraint flowing through the learning edge to reprioritize the next investigation splitter.

### 3:20–4:00 — Google Cloud proof and architecture

Show the public Render API request and logs, then show the diagnostic and proof records written into Google Cloud Firestore. Explain that Firestore is the required Google Cloud infrastructure service. Close with: "ProofLoop does not merely recommend what to do. It determines what problem is worth solving, proves whether the intervention worked, and makes the business smarter the next time."

## Limitations

- The hackathon incident is synthetic and privacy-safe.
- A supported causal explanation is not treated as verified until intervention results match its prediction.
- Live Google Ads and Looker access requires separately authorized credentials.
- The simulated post-intervention partition demonstrates the evaluation contract; production deployments must query the same governed metrics locked before approval.
