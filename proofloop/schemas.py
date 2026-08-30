"""Typed contracts shared across the ProofLoop diagnostic workflow."""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class EvidenceState(str, Enum):
    OBSERVED = "observed"
    PLAUSIBLE = "plausible"
    SUPPORTED = "supported"
    INTERVENTION_VALIDATED = "intervention_validated"
    DISPROVED = "disproved"


class EvidenceReference(BaseModel):
    evidence_id: str
    source: str
    claim: str
    reliability: Literal["low", "medium", "high"]
    relationship: Literal["supports", "contradicts", "context"]


class RootProblemRecord(BaseModel):
    incident_id: str
    signal: str
    expected_state: str
    actual_state: str
    affected_segment: str
    business_impact: str
    problem_statement: str
    proximate_cause: str
    systemic_cause: str
    status: EvidenceState
    evidence: list[EvidenceReference]
    alternatives_considered: list[str]
    missing_evidence: list[str]
    disconfirming_test: str
    limitations: list[str] = Field(
        description="Reasons the agent must not claim more certainty than the evidence supports."
    )


class InterventionPlan(BaseModel):
    name: str
    action: str
    scope: str
    reversibility: str
    approval_required: bool
    primary_metric: str
    success_threshold: str
    guardrails: list[str]
    observation_window: str
    stop_condition: str


class DiagnosticDecision(BaseModel):
    root_problem: RootProblemRecord
    intervention: InterventionPlan
    next_stage: Literal["gather_evidence", "request_approval", "monitor"]
    plain_language_summary: str
