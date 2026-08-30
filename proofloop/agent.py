"""Google ADK workflow for evidence-backed business diagnosis."""

import os

from google.adk.agents import LlmAgent, SequentialAgent

from .connectors import load_business_evidence
from .schemas import DiagnosticDecision, RootProblemRecord


MODEL = os.getenv("PROOFLOOP_MODEL", "gemini-3.6-flash")

signal_validator = LlmAgent(
    name="SignalValidator",
    model=MODEL,
    description="Determines whether the observed business change is real.",
    tools=[load_business_evidence],
    output_key="signal_validation",
    instruction="""
You are ProofLoop's signal validation specialist.

1. Call load_business_evidence for the incident in the user's request.
2. Validate metric definition, instrumentation continuity, sample size,
   seasonality, attribution window, and data freshness.
3. Separate observations from interpretations.
4. If the signal may be a data-quality issue, say so and stop causal claims.

Return compact JSON with: incident_id, signal_valid, observed_gap,
affected_scope, business_impact, checks, evidence_ids, and limitations.
Never invent a missing fact.
""",
)

systems_investigator = LlmAgent(
    name="SystemsInvestigator",
    model=MODEL,
    description="Maps evidence across the business system and 5W1H.",
    output_key="systems_map",
    instruction="""
Use the original evidence and {signal_validation}.

Build an adaptive 5W1H problem frame:
- what expected outcome differs from reality
- who or which segment is affected
- where in the journey or operating system it appears
- when it began and what changed nearby
- how large the consequence is
- why it deserves action now

Map evidence across market, acquisition, frontstage customer experience,
backstage process, resources, tools, economics, and external dependencies.
The location of the symptom may differ from the location of the cause.

Return JSON containing the problem frame, system map, evidence ledger,
unknowns, and the highest-information next question.
""",
)

hypothesis_builder = LlmAgent(
    name="HypothesisBuilder",
    model=MODEL,
    description="Generates competing causal mechanisms.",
    output_key="candidate_hypotheses",
    instruction="""
Use {signal_validation} and {systems_map}.

Generate 3 to 5 materially different causal hypotheses. For each include:
mechanism, predicted observations if true, predicted observations if false,
supporting evidence IDs, contradictory evidence IDs, missing evidence,
controllability, business impact, and the most discriminating test.

Do not collapse correlation into causation. Evidence may weaken an alternative
without ruling it out. Do not use numerical confidence unless it is derived
from an explicit statistical calculation.
Return JSON only.
""",
)

falsifier = LlmAgent(
    name="FalsificationAgent",
    model=MODEL,
    description="Tries to disprove the leading diagnosis.",
    output_key="falsification_review",
    instruction="""
Red-team {candidate_hypotheses} against {signal_validation} and {systems_map}.

Act as a skeptical investigator. Search for:
- contradictory observations
- alternative explanations
- common-cause confounders
- measurement or attribution errors
- post-hoc reasoning
- a cheaper test that separates the leading candidates

Rank hypotheses as observed, plausible, supported, or disproved. A cause cannot
be intervention_validated before an intervention produces the predicted result.
Return JSON only.
""",
)

root_problem_definer = LlmAgent(
    name="RootProblemDefiner",
    model=MODEL,
    description="Defines the smallest consequential and controllable problem.",
    output_key="root_problem_record",
    output_schema=RootProblemRecord,
    instruction="""
Create the RootProblemRecord using {signal_validation}, {systems_map},
{candidate_hypotheses}, and {falsification_review}.

The root problem is the smallest consequential and controllable condition that
explains the observed gap and whose correction should materially improve the
outcome without creating a worse tradeoff.

Keep distinct:
signal, symptom, business problem, proximate cause, and systemic cause.
Status may be supported but never intervention_validated at this stage.
Every material claim must cite evidence IDs. Include what could prove the
diagnosis wrong and all important limitations. Do not infer a specific software
mechanism, organizational failure, or systemic cause unless direct evidence
supports it; describe the observable failure and mark deeper mechanisms as
unverified when necessary.
""",
)

intervention_planner = LlmAgent(
    name="InterventionPlanner",
    model=MODEL,
    description="Designs a reversible test and its verification contract.",
    output_schema=DiagnosticDecision,
    instruction="""
Use {root_problem_record} and the preceding evidence.

Design one smallest reversible intervention that can test the leading mechanism.
Define scope, primary metric, success threshold, observation window, guardrails,
and automatic stop condition before action. High-risk, external, financial,
destructive, or irreversible actions always require human approval.

Set next_stage to:
- gather_evidence if the proof gate is not met
- request_approval if the test is ready but needs human authorization
- monitor only if an already-approved test is running

Return a complete DiagnosticDecision. Never claim the intervention succeeded.
The plain-language summary must say the cause is supported but unverified until
the intervention matches its predicted result; never say diagnostic proof is
complete before evaluation.
""",
)

root_agent = SequentialAgent(
    name="ProofLoopDiagnosticWorkflow",
    description=(
        "Detects a business problem, investigates evidence, falsifies competing "
        "causes, defines the actual root problem, and plans a bounded test."
    ),
    sub_agents=[
        signal_validator,
        systems_investigator,
        hypothesis_builder,
        falsifier,
        root_problem_definer,
        intervention_planner,
    ],
)
