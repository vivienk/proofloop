"""Typed contracts shared across the ProofLoop investigation loop."""

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


class ProcessGap(BaseModel):
    """Where execution diverged from the intended operating standard."""

    process: str
    failing_step: str
    expected_standard: str
    actual_execution: str
    gap: str
    standard_evidence_id: str = Field(
        description="Evidence ID for the standard, or 'not_documented' when none exists."
    )


class FiveWhyStep(BaseModel):
    level: int = Field(ge=1, le=5)
    answer: str
    evidence_ids: list[str]


class SystemFactorFinding(BaseModel):
    domain: Literal[
        "people",
        "process",
        "technology",
        "inputs",
        "environment",
        "measurement",
        "incentives",
    ]
    finding: str
    evidence_ids: list[str]
    status: Literal["implicated", "not_implicated", "unknown"]


class OwnershipAnalysis(BaseModel):
    technical_owner: str
    operational_owner: str
    execution_owner: str
    quality_owner: str
    decision_approver: str
    accountability_gap: str


class IncentiveAnalysis(BaseModel):
    current_incentive: str
    behavioral_effect: str
    alignment_gap: str


class QualityAnalysis(BaseModel):
    escape_type: Literal["internal", "external", "not_determined"]
    detection_point: str
    control_gap: str


class HypothesisRecord(BaseModel):
    hypothesis: str
    mechanism: str
    status: Literal["plausible", "supported", "disproved"]
    supporting_evidence_ids: list[str]
    contradicting_evidence_ids: list[str]
    missing_evidence: list[str]
    discriminating_test: str


class InvestigationState(BaseModel):
    termination_state: Literal[
        "confirmed",
        "insufficient_evidence",
        "conflicting_evidence",
    ]
    independent_source_count: int = Field(ge=0)
    hypotheses_considered: int = Field(ge=0, le=5)
    proof_gate_passed: bool
    stopping_reason: str


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
    process_gap: ProcessGap
    five_whys: list[FiveWhyStep] = Field(max_length=5)
    system_factors: list[SystemFactorFinding]
    ownership: OwnershipAnalysis
    incentives: IncentiveAnalysis
    quality: QualityAnalysis
    hypotheses: list[HypothesisRecord] = Field(min_length=3, max_length=5)
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
    investigation: InvestigationState
    next_stage: Literal["gather_evidence", "request_approval", "monitor"]
    plain_language_summary: str
