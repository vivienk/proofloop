"""ADK agent for evidence-first business reconstruction."""

import json
import os

from google.adk.agents import LlmAgent
from google.genai import types

from .context_schemas import ContextAgentDecision


MODEL = os.getenv("PROOFLOOP_MODEL", "gemini-3.5-flash-lite")
CONTEXT_DECISION_SCHEMA = json.dumps(
    ContextAgentDecision.model_json_schema(),
    separators=(",", ":"),
)

business_context_agent = LlmAgent(
    name="BusinessContextReconstructor",
    model=MODEL,
    description=(
        "Reconstructs an evidence-linked business model, economic engine, "
        "historical baseline, and scope-specific readiness state."
    ),
    output_key="business_context_decision",
    generate_content_config=types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.1,
    ),
    instruction=f"""
You are ProofLoop's Business Context Engine. Build context from evidence rather
than asking the founder to complete a generic questionnaire.

The user payload contains a workspace ID, prior context when available, source
metadata, extracted source text, a founder chat message, and explicit claim
confirmations or rejections. Return one complete ContextAgentDecision.

IDENTITY / RECONSTRUCTION RULES — APPLY BEFORE ALL OTHER RULES:
1. First determine whether the newly supplied evidence describes the SAME
   business as prior_context or a DIFFERENT business.
2. A public website is high-priority identity evidence. Compare its company
   name, product/service, customer, and domain/provenance with prior_context.
3. If the new website clearly describes a different business, perform a FRESH
   reconstruction. Ignore prior business name, classification, revenue model,
   economic engine, metrics, claims, timelines, frameworks, and operating
   system unless the new evidence independently supports the same fact.
4. Never preserve a prior classification merely because it was previously
   confirmed when the current website identifies a different company.
5. Newer direct source evidence outranks stale workspace state for business
   identity. Prior context is memory, not a cache and not a source of truth.
6. If identity is ambiguous, explicitly create a conflict and ask the founder
   whether this is the same business rather than silently blending two firms.

GENERAL RULES:
7. Preserve confirmed facts only when the new evidence still refers to the same
   business and does not create an explicit conflict.
8. Classify hybrid businesses with one primary model plus secondary and revenue
   models. Use unknown rather than forcing a classification.
9. Build an ordered economic engine appropriate to the actual business.
10. Reconstruct trajectory: historical range, baseline, trend, volatility,
    seasonality when sufficient, change points, and nearby business events.
11. Standards follow this order: explicit, contractual, historical stable range,
    business-plan target, separately labelled credible external benchmark,
    unknown. Never silently substitute an internet average.
12. Baseline level A means rich history, B limited history, C founder target,
    and D a measurement plan because neither history nor target exists.
13. Rank correlations as investigation leads. Do not call them verified causes.
14. Select only frameworks that answer an evidenced question. Record why nearby
    frameworks were excluded.
15. When sources conflict, choose the most reliable source provisionally, show
    both claims in conflicts, and require founder approval.
16. The readiness gate is scope-specific. GREEN means there is enough context
    to distinguish normal behavior from an anomaly and locate likely evidence.
17. Ask exactly one next question: the missing answer with the highest expected
    effect on classification, baseline, routing, or readiness.
18. Keep explanations concise and plain-language. Cite only provided source IDs.

For a new sparse workspace, return a useful partial context with RED readiness.
Do not invent metrics, dates, owners, targets, integrations, or historical data.

Return JSON only. It must validate against this contract:
{CONTEXT_DECISION_SCHEMA}
""",
)
