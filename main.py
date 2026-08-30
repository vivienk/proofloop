"""FastAPI entrypoint for the ProofLoop agent service."""

from __future__ import annotations

import base64
import json
import os
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from google.genai import errors as genai_errors
from pydantic import BaseModel, Field

from proofloop.agent import compact_agent, root_agent
from proofloop.connectors import load_business_evidence
from proofloop.schemas import DiagnosticDecision, EvidenceState, RootProblemRecord


APP_NAME = "proofloop"
MODEL_VERSION = "proofloop-investigation-graph-v4"
DEFAULT_ALLOWED_ORIGINS = (
    "http://localhost:3000,https://proofloop-flywheel.vercel.app"
)
AGENT_STAGES = [
    "problem_definition_gate",
    "map_process_standard_gap",
    "split_bounded_units",
    "run_red_green_unit_loops",
    "deterministic_merge",
    "root_problem_definition",
    "root_cause_evidence_gate",
    "action_risk_gate",
    "intervention_planning",
]
DECISION_LOOP = AGENT_STAGES + [
    "human_approval",
    "outcome_loop",
    "standardize",
    "learning_edge",
    "monitor",
]
INVESTIGATION_LIMITS = {
    "max_rounds": 4,
    "max_tool_calls": 20,
    "max_hypotheses": 5,
    "max_unit_attempts": 4,
    "minimum_independent_sources": 2,
}
session_service = InMemorySessionService()
EXECUTION_MODE = os.getenv("PROOFLOOP_EXECUTION_MODE", "sequential").strip().lower()
selected_agent = compact_agent if EXECUTION_MODE == "compact" else root_agent
runner = Runner(
    app_name=APP_NAME,
    agent=selected_agent,
    session_service=session_service,
)
runtime_diagnostic_runs: dict[str, dict[str, Any]] = {}
runtime_interventions: dict[str, dict[str, Any]] = {}

app = FastAPI(
    title="ProofLoop Agent API",
    version="0.1.0",
    description="Evidence-backed business diagnosis powered by Gemini and ADK.",
)
configured_origins = os.getenv("ALLOWED_ORIGINS") or DEFAULT_ALLOWED_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in configured_origins.split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


class DiagnoseRequest(BaseModel):
    incident_id: str = "PL-0047"
    concern: str = Field(
        default="Paid traffic is rising while purchases are falling.",
        max_length=1000,
    )
    user_id: str = "demo-founder"


class ApprovalRequest(BaseModel):
    approved_by: str
    scope_acknowledged: bool


def _firestore_client():
    configured_persistence = os.getenv("PROOFLOOP_PERSISTENCE_MODE")
    if configured_persistence:
        persistence_mode = configured_persistence.strip().lower()
    else:
        legacy_demo_mode = os.getenv("PROOFLOOP_DEMO_MODE", "true").lower() == "true"
        persistence_mode = "none" if legacy_demo_mode else "firestore"

    if persistence_mode != "firestore":
        return None
    from google.cloud import firestore
    from google.oauth2 import service_account

    credentials = None
    encoded_credentials = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON_B64")
    if encoded_credentials:
        try:
            service_account_info = json.loads(
                base64.b64decode(encoded_credentials).decode("utf-8")
            )
            credentials = service_account.Credentials.from_service_account_info(
                service_account_info
            )
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RuntimeError(
                "GOOGLE_SERVICE_ACCOUNT_JSON_B64 is not a valid base64-encoded "
                "Google service-account JSON document."
            ) from exc

    return firestore.AsyncClient(
        project=os.getenv("GOOGLE_CLOUD_PROJECT"),
        credentials=credentials,
    )


async def _persist(collection: str, document_id: str, payload: dict[str, Any]) -> None:
    client = _firestore_client()
    if client is None:
        return
    await client.collection(collection).document(document_id).set(payload, merge=True)


async def _load_record(collection: str, document_id: str) -> dict[str, Any] | None:
    client = _firestore_client()
    if client is None:
        return None
    snapshot = await client.collection(collection).document(document_id).get()
    return snapshot.to_dict() if snapshot.exists else None


def _enforce_proof_gate(
    decision: DiagnosticDecision,
) -> tuple[DiagnosticDecision, bool]:
    """Recompute node, evidence, and risk gates outside the LLM."""

    root_problem = decision.root_problem
    known_evidence_ids = {item.evidence_id for item in root_problem.evidence}
    problem_gate = decision.problem_gate
    problem_failures: list[str] = []
    if not problem_gate.metric.strip():
        problem_failures.append("metric")
    if not problem_gate.timeframe.strip():
        problem_failures.append("timeframe")
    if not problem_gate.affected_population.strip():
        problem_failures.append("affected_population")
    if not problem_gate.source_evidence_ids:
        problem_failures.append("source")
    elif not set(problem_gate.source_evidence_ids).issubset(known_evidence_ids):
        problem_failures.append("source_reference")
    if not problem_gate.anomaly_reproducible:
        problem_failures.append("anomaly_reproducible")
    computed_delta = problem_gate.observed_value - problem_gate.expected_value
    if abs(computed_delta - problem_gate.delta) > 0.0001:
        problem_failures.append("delta")
    problem_gate.failed_checks = problem_failures
    problem_gate.status = "red" if problem_failures else "green"

    required_domains = {"product", "customer", "growth", "operations"}
    returned_domains = {unit.domain for unit in decision.investigation_graph.units}
    failed_unit_ids: list[str] = []
    for unit in decision.investigation_graph.units:
        unit_is_green = all(
            [
                bool(unit.id.strip()),
                bool(unit.hypothesis.strip()),
                bool(unit.finding.strip()),
                bool(unit.evidence_ids),
                set(unit.evidence_ids).issubset(known_evidence_ids),
                unit.verdict in {"supported", "rejected"},
                not unit.blocking_missing_evidence,
                unit.attempts <= INVESTIGATION_LIMITS["max_unit_attempts"],
            ]
        )
        unit.status = "green" if unit_is_green else "red"
        if not unit_is_green:
            failed_unit_ids.append(unit.id)
            if not unit.correction_request.strip():
                unit.correction_request = (
                    "Collect only the blocking evidence required for this unit."
                )
        else:
            unit.correction_request = ""

    if returned_domains != required_domains:
        failed_unit_ids.append("splitter_domain_coverage")

    independent_sources = len({item.source for item in root_problem.evidence})
    hypothesis_count = len(root_problem.hypotheses)
    alternatives_competed = hypothesis_count >= 3
    supported_hypothesis = any(
        hypothesis.status == "supported" for hypothesis in root_problem.hypotheses
    )
    evidence_gate_passed = all(
        [
            problem_gate.status == "green",
            not failed_unit_ids,
            root_problem.status == EvidenceState.SUPPORTED,
            independent_sources >= INVESTIGATION_LIMITS["minimum_independent_sources"],
            alternatives_competed,
            supported_hypothesis,
        ]
    )

    root_cause_gate = decision.investigation_graph.root_cause_gate
    root_cause_gate.status = "green" if evidence_gate_passed else "red"
    root_cause_gate.failed_unit_ids = failed_unit_ids
    root_cause_gate.independent_source_count = independent_sources
    root_cause_gate.reason = (
        "All required investigation units reached valid conclusions and the "
        "supported cause has independent evidence."
        if evidence_gate_passed
        else "Only the failed RED units may be corrected before synthesis resumes."
    )

    risk_gate = decision.risk_gate
    if risk_gate.risk_level == "high" or risk_gate.blast_radius == "hard_to_reverse":
        safe_execution_modes = {"human_approval"}
    elif risk_gate.risk_level == "medium" or risk_gate.blast_radius == "wide":
        safe_execution_modes = {"guarded", "human_approval"}
    else:
        safe_execution_modes = {"auto_test", "guarded", "human_approval"}
    risk_gate_passed = risk_gate.execution_mode in safe_execution_modes
    if risk_gate.execution_mode == "human_approval":
        risk_gate_passed = risk_gate_passed and decision.intervention.approval_required
    risk_gate.status = "green" if risk_gate_passed else "red"
    risk_gate.reason = (
        "Execution control matches blast radius and reversibility."
        if risk_gate_passed
        else "Execution control is weaker than the assessed action risk."
    )

    proof_gate_passed = evidence_gate_passed and risk_gate_passed

    decision.investigation.independent_source_count = independent_sources
    decision.investigation.hypotheses_considered = hypothesis_count
    decision.investigation.proof_gate_passed = proof_gate_passed
    if proof_gate_passed:
        decision.investigation.termination_state = "confirmed"
        decision.next_stage = "request_approval"
        decision.investigation.stopping_reason = (
            "Problem, node, evidence, and risk gates are GREEN."
        )
    else:
        decision.next_stage = "gather_evidence"
        if decision.investigation.termination_state != "conflicting_evidence":
            decision.investigation.termination_state = "insufficient_evidence"
        decision.investigation.stopping_reason = (
            "One or more deterministic RED gates must be corrected before action."
        )
    return decision, proof_gate_passed


@app.get("/")
async def service_index() -> dict[str, Any]:
    return {
        "service": "ProofLoop Agent API",
        "status": "ok",
        "model_version": MODEL_VERSION,
        "endpoints": [
            "/health",
            "/v1/model",
            "/v1/diagnose",
            "/v1/interventions/{run_id}/approve",
            "/v1/interventions/{run_id}/evaluate",
        ],
        "web_app": "https://proofloop-flywheel.vercel.app",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    configured_data_mode = os.getenv("PROOFLOOP_DATA_MODE")
    if configured_data_mode:
        data_mode = configured_data_mode.strip().lower()
    else:
        legacy_demo_mode = os.getenv("PROOFLOOP_DEMO_MODE", "true").lower() == "true"
        data_mode = "demo" if legacy_demo_mode else "live"

    configured_persistence = os.getenv("PROOFLOOP_PERSISTENCE_MODE")
    if configured_persistence:
        persistence_mode = configured_persistence.strip().lower()
    else:
        legacy_demo_mode = os.getenv("PROOFLOOP_DEMO_MODE", "true").lower() == "true"
        persistence_mode = "none" if legacy_demo_mode else "firestore"

    return {
        "status": "ok",
        "model": os.getenv("PROOFLOOP_MODEL", "gemini-3.5-flash-lite"),
        "mode": data_mode,
        "persistence": persistence_mode,
        "execution_mode": EXECUTION_MODE,
    }


@app.get("/v1/model")
async def structured_model() -> dict[str, Any]:
    """Publish the agent's auditable reasoning contract for the web app."""
    return {
        "model_version": MODEL_VERSION,
        "agent_framework": "Google ADK",
        "model": os.getenv("PROOFLOOP_MODEL", "gemini-3.5-flash-lite"),
        "execution_mode": EXECUTION_MODE,
        "stages": AGENT_STAGES,
        "decision_loop": DECISION_LOOP,
        "investigation_limits": INVESTIGATION_LIMITS,
        "root_problem_schema": RootProblemRecord.model_json_schema(),
        "decision_schema": DiagnosticDecision.model_json_schema(),
    }


@app.post("/v1/diagnose")
async def diagnose(request: DiagnoseRequest) -> dict[str, Any]:
    session_id = f"{request.incident_id.lower()}-{uuid.uuid4().hex[:8]}"
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=request.user_id,
        session_id=session_id,
    )
    diagnostic_payload: dict[str, Any] = {
        "incident_id": request.incident_id,
        "concern": request.concern,
        "instruction": "Run the complete diagnostic proof gate.",
    }
    if EXECUTION_MODE == "compact":
        diagnostic_payload["evidence"] = load_business_evidence(request.incident_id)

    message = types.Content(
        role="user",
        parts=[
            types.Part(
                text=json.dumps(diagnostic_payload)
            )
        ],
    )

    final_text = ""
    try:
        async for event in runner.run_async(
            user_id=request.user_id,
            session_id=session_id,
            new_message=message,
        ):
            if event.is_final_response() and event.content and event.content.parts:
                final_text = event.content.parts[0].text or ""
    except genai_errors.APIError as exc:
        retryable = exc.code in {429, 500, 502, 503, 504}
        raise HTTPException(
            status_code=503 if retryable else 502,
            detail={
                "code": "gemini_temporarily_unavailable" if retryable else "gemini_request_failed",
                "message": (
                    "Gemini could not complete the diagnostic. Retry later."
                    if retryable
                    else "Gemini rejected the diagnostic request."
                ),
                "provider_status": exc.status,
            },
        ) from exc

    if not final_text:
        raise HTTPException(status_code=502, detail="Agent produced no final decision.")

    try:
        raw_decision = json.loads(final_text)
        typed_decision = DiagnosticDecision.model_validate(raw_decision)
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Agent decision did not satisfy the structured investigation contract.",
        ) from exc

    typed_decision, proof_gate_passed = _enforce_proof_gate(typed_decision)
    decision = typed_decision.model_dump(mode="json")

    envelope = {
        "run_id": session_id,
        "incident_id": request.incident_id,
        "status": "awaiting_approval" if proof_gate_passed else "needs_evidence",
        "created_at": datetime.now(UTC).isoformat(),
        "model_version": MODEL_VERSION,
        "execution_mode": EXECUTION_MODE,
        "agent_stages": AGENT_STAGES,
        "investigation_limits": INVESTIGATION_LIMITS,
        "decision": decision,
    }
    runtime_diagnostic_runs[session_id] = envelope
    await _persist("diagnostic_runs", session_id, envelope)
    return envelope


@app.post("/v1/interventions/{run_id}/approve")
async def approve_intervention(run_id: str, request: ApprovalRequest) -> dict[str, Any]:
    if not request.scope_acknowledged:
        raise HTTPException(status_code=400, detail="Intervention scope must be acknowledged.")
    diagnostic_run = runtime_diagnostic_runs.get(run_id)
    if diagnostic_run is None:
        diagnostic_run = await _load_record("diagnostic_runs", run_id)
    if diagnostic_run is None:
        raise HTTPException(status_code=404, detail="Diagnostic run was not found.")
    if diagnostic_run.get("status") != "awaiting_approval":
        raise HTTPException(
            status_code=409,
            detail="This investigation has not passed the proof gate.",
        )
    payload = {
        "run_id": run_id,
        "status": "monitoring",
        "approved_by": request.approved_by,
        "approved_at": datetime.now(UTC).isoformat(),
        "idempotency_key": f"approve:{run_id}",
    }
    runtime_interventions[run_id] = payload
    await _persist("interventions", run_id, payload)
    return payload


@app.post("/v1/interventions/{run_id}/evaluate")
async def evaluate_intervention(run_id: str) -> dict[str, Any]:
    intervention = runtime_interventions.get(run_id)
    if intervention is None:
        intervention = await _load_record("interventions", run_id)
    if intervention is None or intervention.get("status") != "monitoring":
        raise HTTPException(
            status_code=409,
            detail="The intervention must be approved before evaluation.",
        )
    # The hackathon demo replays a privacy-safe post-intervention data partition.
    # Live mode should query the same governed metrics and comparison cohort that
    # were locked before approval.
    payload = {
        "run_id": run_id,
        "status": "intervention_validated",
        "evaluated_at": datetime.now(UTC).isoformat(),
        "outcome": {
            "control_progression": 0.412,
            "rollback_progression": 0.481,
            "relative_lift": 0.168,
            "sample_size": 1284,
            "guardrails_passed": True,
        },
        "learned_rule": (
            "Revenue-critical interface releases must pass mobile Safari "
            "regression checks before full rollout."
        ),
        "standardization": {
            "standard_updated": "Revenue-critical frontend release checklist",
            "accountable_owner": "Technical owner",
            "new_control": "Required mobile Safari regression test before rollout",
            "monitoring_rule": "Alert when segment conversion deviates more than 10% from baseline",
            "recurrence_status": "monitoring",
        },
        "learning_edge": {
            "lesson": "Platform-specific conversion failures immediately after a release should be investigated as release escapes before acquisition degradation.",
            "derived_constraint": "When a browser-specific revenue anomaly begins within two hours of a release, inspect release and compatibility evidence first.",
            "applies_when": "A revenue-critical funnel drops in one browser or platform shortly after deployment.",
            "future_splitter_effect": "Prioritize product and operations units before expanding growth investigation.",
        },
    }
    await _persist("proof_records", run_id, payload)
    return payload
