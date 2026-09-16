"""Typed contracts for interrogating a completed investigation run."""

from typing import Literal

from pydantic import BaseModel, Field


FOUNDER_EVIDENCE_SOURCE = "founder_statement"
FOUNDER_EVIDENCE_PREFIX = "founder-"


class PendingEvidence(BaseModel):
    """A founder-asserted fact that is not yet part of any diagnostic record."""

    claim: str = Field(max_length=500, description="Neutral restatement of the founder's claim.")
    suggested_source: str = Field(
        max_length=120,
        description="Where this could be verified, e.g. 'release log' or 'Looker funnel by browser'.",
    )
    relevant_hypotheses: list[str] = Field(
        default_factory=list,
        max_length=5,
        description="Hypothesis text from the record that this claim bears on.",
    )


class InvestigationChatReply(BaseModel):
    """What the chat model returns. Python validates citations before it reaches the UI."""

    intent: Literal["explain", "challenge", "falsify", "new_evidence", "out_of_scope"]
    answer: str
    cited_evidence_ids: list[str]
    uncertainty: str = Field(
        description="What this record cannot establish for the question; empty only if fully answered."
    )
    pending_evidence: PendingEvidence | None = None
    suggested_questions: list[str] = Field(default_factory=list, max_length=3)


class InvestigationChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class FounderEvidence(BaseModel):
    """Founder-supplied lead attached to a diagnostic re-run. Never corroboration."""

    claim: str = Field(min_length=3, max_length=500)
    suggested_source: str = Field(default="", max_length=120)
