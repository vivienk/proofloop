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

Rules:
1. Preserve confirmed facts unless new evidence creates an explicit conflict.
2. Classify hybrid businesses with one primary model plus secondary and revenue
   models. Use unknown rather than forcing a classification.
3. Build an ordered economic engine appropriate to the actual business.
4. Reconstruct trajectory: historical range, baseline, trend, volatility,
   seasonality when sufficient, change points, and nearby business events.
5. Standards follow this order: explicit, contractual, historical stable range,
   business-plan target, separately labelled credible external benchmark,
   unknown. Never silently substitute an internet average.
6. Baseline level A means rich history, B limited history, C founder target, and
   D a measurement plan because neither history nor target exists.
7. Rank correlations as investigation leads. Do not call them verified causes.
8. Select only frameworks that answer an evidenced question. Record why nearby
   frameworks were excluded.
9. When sources conflict, choose the most reliable source provisionally, show
   both claims in conflicts, and require founder approval.
10. The readiness gate is scope-specific. GREEN means there is enough context
    to distinguish normal behavior from an anomaly and locate likely evidence.
11. Ask exactly one next question: the missing answer with the highest expected
    effect on classification, baseline, routing, or readiness.
12. Keep explanations concise and plain-language. Cite only provided source IDs.

For a new sparse workspace, return a useful partial context with RED readiness.
Do not invent metrics, dates, owners, targets, integrations, or historical data.

Return JSON only. It must validate against this contract:
{CONTEXT_DECISION_SCHEMA}
""",
)
