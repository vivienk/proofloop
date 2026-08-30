"""Typed contracts for ProofLoop's Business Context Engine."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


EvidenceDomain = Literal[
    "business",
    "revenue",
    "product",
    "growth",
    "customers",
    "operations",
]


class ContextEvidenceSource(BaseModel):
    source_id: str
    name: str
    domain: EvidenceDomain
    source_type: Literal["integration", "upload", "website", "founder_chat"]
    status: Literal["demo", "connected", "coming_soon", "processed"]
    provenance: str
    coverage: str
    freshness: str
    permission: Literal["read_only", "uploaded", "founder_provided"]


class ContextClaim(BaseModel):
    claim_id: str
    domain: EvidenceDomain
    claim: str
    source_ids: list[str]
    source_locator: str
    reliability: Literal["low", "medium", "high"]
    confirmation_status: Literal["pending", "confirmed", "rejected", "conflicted"]


class BusinessClassification(BaseModel):
    primary_model: Literal[
        "creator_economy",
        "knowledge_business",
        "digital_product",
        "solo_ecommerce",
        "micro_saas",
        "unknown",
    ]
    secondary_models: list[str]
    revenue_models: list[str]
    stage: Literal[
        "pre_revenue",
        "early_revenue",
        "growing",
        "established",
        "unknown",
    ]
    evidence_ids: list[str]
    founder_confirmed: bool


class EconomicEngineStage(BaseModel):
    order: int = Field(ge=1, le=20)
    name: str
    description: str
    metric_ids: list[str]


class OperatingArea(BaseModel):
    area: Literal[
        "acquisition",
        "product",
        "revenue",
        "customer",
        "delivery",
        "operations",
    ]
    systems: list[str]
    process_summary: str
    dependencies: list[str]
    evidence_ids: list[str]


class MetricObservation(BaseModel):
    period: str
    value: float


class MetricBaseline(BaseModel):
    metric_id: str
    label: str
    unit: str
    current_value: float
    expected_low: float | None
    expected_high: float | None
    standard_type: Literal[
        "explicit",
        "contractual",
        "historical",
        "business_plan",
        "external_benchmark",
        "unknown",
    ]
    standard_basis: str
    evidence_strength: Literal["low", "medium", "high", "unknown"]
    baseline_level: Literal["A", "B", "C", "D"]
    trend: Literal["up", "down", "flat", "volatile", "unknown"]
    volatility: str
    seasonality: str
    observations: list[MetricObservation]
    source_ids: list[str]


class TimelineEvent(BaseModel):
    event_id: str
    date: str
    event_type: Literal[
        "release",
        "pricing",
        "campaign",
        "supplier",
        "platform",
        "customer",
        "external",
        "intervention",
    ]
    title: str
    description: str
    evidence_ids: list[str]
    before_after: str
    ranked_investigation_leads: list[str]


class FrameworkSelection(BaseModel):
    framework: str
    purpose: str
    trigger_evidence_ids: list[str]
    excluded_alternatives: list[str]


class ReadinessArea(BaseModel):
    area: Literal[
        "identity",
        "economic_engine",
        "operating_system",
        "metrics",
        "history",
        "dependencies",
    ]
    status: Literal["red", "green"]
    reason: str
    missing_evidence: list[str]


class BusinessReadiness(BaseModel):
    status: Literal["red", "green"]
    score: int = Field(ge=0, le=100)
    ready_scopes: list[str]
    blocked_scopes: list[str]
    areas: list[ReadinessArea]
    next_best_question: str
    reason: str


class ContextConflict(BaseModel):
    conflict_id: str
    topic: str
    preferred_claim: str
    preferred_source_ids: list[str]
    alternative_claim: str
    alternative_source_ids: list[str]
    selection_reason: str
    founder_approval_required: bool = True


class BusinessContextRecord(BaseModel):
    workspace_id: str
    business_name: str
    value_proposition: str
    primary_customer: str
    current_objective: str
    classification: BusinessClassification
    economic_engine: list[EconomicEngineStage]
    operating_system: list[OperatingArea]
    external_dependencies: list[str]
    evidence_sources: list[ContextEvidenceSource]
    claims: list[ContextClaim]
    metrics: list[MetricBaseline]
    timeline_events: list[TimelineEvent]
    selected_frameworks: list[FrameworkSelection]
    readiness: BusinessReadiness
    conflicts: list[ContextConflict]
    limitations: list[str]


class ContextAgentDecision(BaseModel):
    context: BusinessContextRecord
    assistant_message: str
    material_inferences: list[str]
    pending_confirmation_claim_ids: list[str]
    next_question: str


class ContextChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    confirmed_claim_ids: list[str] = Field(default_factory=list)
    rejected_claim_ids: list[str] = Field(default_factory=list)


class ContextConfirmationRequest(BaseModel):
    confirmed_claim_ids: list[str] = Field(default_factory=list)
    rejected_claim_ids: list[str] = Field(default_factory=list)
    approved_conflict_ids: list[str] = Field(default_factory=list)

