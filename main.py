"""FastAPI entrypoint for the ProofLoop agent service."""

from __future__ import annotations

import base64
import asyncio
import json
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import File, Form, Header, HTTPException, UploadFile
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from google.genai import errors as genai_errors
from pydantic import BaseModel, Field

from proofloop.agent import compact_agent, root_agent
from proofloop.connectors import load_business_evidence
from proofloop.context_agent import business_context_agent
from proofloop.context_schemas import (
    BusinessContextRecord,
    ContextAgentDecision,
    ContextConfirmationRequest,
    ContextEvidenceSource,
    ReadinessArea,
)
from proofloop.ingestion import (
    EvidenceExtractionError,
    extract_public_url,
    extract_uploaded_file,
)
from proofloop.schemas import DiagnosticDecision, EvidenceState, RootProblemRecord


APP_NAME = "proofloop"
MODEL_VERSION = "proofloop-investigation-graph-v4"
CONTEXT_MODEL_VERSION = "proofloop-business-context-v5"
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
context_runner = Runner(
    app_name=APP_NAME,
    agent=business_context_agent,
    session_service=session_service,
)
runtime_diagnostic_runs: dict[str, dict[str, Any]] = {}
runtime_interventions: dict[str, dict[str, Any]] = {}
runtime_business_contexts: dict[str, dict[str, Any]] = {}
DEMO_CONTEXT_PATH = Path(__file__).resolve().parent / "data" / "business-context-northstar.json"

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
    workspace_id: str | None = Field(default=None, max_length=120)


class ApprovalRequest(BaseModel):
    approved_by: str
    scope_acknowledged: bool


def _service_account_info() -> dict[str, Any] | None:
    encoded_credentials = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON_B64")
    if not encoded_credentials:
        return None
    try:
        return json.loads(base64.b64decode(encoded_credentials).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError(
            "GOOGLE_SERVICE_ACCOUNT_JSON_B64 is not a valid base64-encoded "
            "Google service-account JSON document."
        ) from exc


def _firebase_app():
    """Initialize Firebase Admin from the same private service identity as Firestore."""

    import firebase_admin
    from firebase_admin import credentials

    try:
        return firebase_admin.get_app()
    except ValueError:
        service_account_info = _service_account_info()
        credential = (
            credentials.Certificate(service_account_info)
            if service_account_info
            else credentials.ApplicationDefault()
        )
        return firebase_admin.initialize_app(
            credential,
            {"projectId": os.getenv("GOOGLE_CLOUD_PROJECT")},
        )


async def _require_personal_user(authorization: str | None) -> dict[str, Any]:
    """Verify the Firebase ID token used for a personal business workspace."""

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Google sign-in is required for a personal business workspace.",
        )
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="The sign-in token is missing.")
    try:
        from firebase_admin import auth as firebase_auth

        return await asyncio.to_thread(
            firebase_auth.verify_id_token,
            token,
            app=_firebase_app(),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail="The Google sign-in session is invalid or expired.",
        ) from exc


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
    service_account_info = _service_account_info()
    if service_account_info:
        credentials = service_account.Credentials.from_service_account_info(
            service_account_info
        )

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

    if not required_domains.issubset(returned_domains):
        failed_unit_ids.append("splitter_domain_coverage")
    if len(returned_domains) != len(decision.investigation_graph.units):
        failed_unit_ids.append("splitter_duplicate_domain")

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


def _demo_business_context() -> BusinessContextRecord:
    return BusinessContextRecord.model_validate_json(
        DEMO_CONTEXT_PATH.read_text(encoding="utf-8")
    )


def _infer_evidence_domain(name: str) -> str:
    lowered = name.lower()
    domain_keywords = {
        "revenue": ["stripe", "shopify", "amazon", "gumroad", "quickbooks", "bank", "sales", "revenue", "invoice"],
        "product": ["posthog", "ga4", "mixpanel", "amplitude", "app", "product", "usage", "analytics"],
        "growth": ["ads", "campaign", "search console", "newsletter", "email", "seo", "traffic"],
        "customers": ["salesforce", "hubspot", "support", "review", "survey", "nps", "interview", "customer"],
        "operations": ["notion", "linear", "github", "project", "fulfillment", "inventory", "contractor", "workflow"],
    }
    for domain, keywords in domain_keywords.items():
        if any(keyword in lowered for keyword in keywords):
            return domain
    return "business"


def _enforce_context_readiness(context: BusinessContextRecord) -> BusinessContextRecord:
    """Recompute the Business Context Gate from typed, inspectable facts."""

    checks = {
        "identity": all(
            [
                bool(context.business_name.strip()),
                bool(context.value_proposition.strip()),
                bool(context.primary_customer.strip()),
                context.classification.founder_confirmed,
                not any(
                    claim.confirmation_status in {"pending", "conflicted"}
                    for claim in context.claims
                ),
            ]
        ),
        "economic_engine": len(context.economic_engine) >= 3,
        "operating_system": bool(context.operating_system),
        "metrics": bool(context.metrics),
        "history": any(metric.observations for metric in context.metrics)
        or bool(context.timeline_events),
        "dependencies": bool(context.external_dependencies)
        or any(area.dependencies for area in context.operating_system),
    }
    existing = {area.area: area for area in context.readiness.areas}
    missing_copy = {
        "identity": "Business model, value proposition, or primary customer",
        "economic_engine": "A complete customer-to-revenue value path",
        "operating_system": "The systems and processes behind the value path",
        "metrics": "At least one important metric, target, or measurement plan",
        "history": "Historical observations or a declared measurement period",
        "dependencies": "Major platforms, suppliers, or external dependencies",
    }
    for area_name, passed in checks.items():
        area = existing.get(area_name)
        if area is None:
            area = ReadinessArea(
                area=area_name,
                status="green" if passed else "red",
                reason="Deterministic Business Context Gate check.",
                missing_evidence=[],
            )
            context.readiness.areas.append(area)
        area.status = "green" if passed else "red"
        if not passed:
            area.missing_evidence = [missing_copy[area_name]]
            area.reason = f"Missing: {missing_copy[area_name]}."

    score = round(sum(1 for passed in checks.values() if passed) / len(checks) * 100)
    required_for_any_diagnosis = all(
        [checks["identity"], checks["economic_engine"], checks["metrics"]]
    )
    context.readiness.score = score
    context.readiness.status = "green" if required_for_any_diagnosis else "red"
    if not required_for_any_diagnosis and not context.readiness.next_best_question.strip():
        first_missing = next(name for name, passed in checks.items() if not passed)
        context.readiness.next_best_question = (
            f"What can you share about {missing_copy[first_missing].lower()}?"
        )
    return context


async def _run_context_reconstruction(
    *,
    workspace_id: str,
    user_id: str,
    prior_context: dict[str, Any] | None,
    source_metadata: list[dict[str, Any]],
    extracted_evidence: list[dict[str, Any]],
    founder_message: str,
    confirmed_claim_ids: list[str] | None = None,
    rejected_claim_ids: list[str] | None = None,
) -> ContextAgentDecision:
    session_id = f"context-{workspace_id[:30]}-{uuid.uuid4().hex[:8]}"
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    payload = {
        "workspace_id": workspace_id,
        "prior_context": prior_context,
        "source_metadata": source_metadata,
        "extracted_evidence": extracted_evidence,
        "founder_message": founder_message,
        "confirmed_claim_ids": confirmed_claim_ids or [],
        "rejected_claim_ids": rejected_claim_ids or [],
        "instruction": "Reconstruct or update the Business Context Graph and ask one next-best question.",
    }
    message = types.Content(
        role="user",
        parts=[types.Part(text=json.dumps(payload))],
    )
    final_text = ""
    async for event in context_runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=message,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            final_text = event.content.parts[0].text or ""
    if not final_text:
        raise HTTPException(status_code=502, detail="Context agent produced no reconstruction.")
    try:
        decision = ContextAgentDecision.model_validate_json(final_text)
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Context reconstruction did not satisfy the typed Business Context contract.",
        ) from exc
    decision.context.workspace_id = workspace_id
    decision.context = _enforce_context_readiness(decision.context)
    return decision


@app.get("/")
async def service_index() -> dict[str, Any]:
    return {
        "service": "ProofLoop Agent API",
        "status": "ok",
        "model_version": MODEL_VERSION,
        "endpoints": [
            "/health",
            "/v1/model",
            "/v1/business-context/demo",
            "/v1/business-contexts/reconstruct",
            "/v1/business-contexts/{workspace_id}",
            "/v1/business-contexts/{workspace_id}/confirm",
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
        "context_model_version": CONTEXT_MODEL_VERSION,
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
        "business_context_model_version": CONTEXT_MODEL_VERSION,
        "business_context_schema": BusinessContextRecord.model_json_schema(),
    }


@app.get("/v1/business-context/demo")
async def demo_business_context() -> dict[str, Any]:
    """Return the prepared Northstar workspace without requiring sign-in."""

    return {
        "model_version": CONTEXT_MODEL_VERSION,
        "mode": "privacy_safe_demo",
        "context": _demo_business_context().model_dump(mode="json"),
        "assistant_message": (
            "Northstar Studio is ready for growth, product, customer, and "
            "operations investigations. Cash-flow analysis remains blocked."
        ),
        "next_question": _demo_business_context().readiness.next_best_question,
    }


@app.get("/v1/business-contexts/{workspace_id}")
async def get_business_context(
    workspace_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    user = await _require_personal_user(authorization)
    record = runtime_business_contexts.get(workspace_id)
    if record is None:
        record = await _load_record("business_contexts", workspace_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Business workspace was not found.")
    if record.get("owner_user_id") != user.get("uid"):
        raise HTTPException(status_code=403, detail="This workspace belongs to another user.")
    return record


@app.post("/v1/business-contexts/reconstruct")
async def reconstruct_business_context(
    workspace_id: str = Form(..., min_length=3, max_length=120),
    message: str = Form(default="", max_length=4000),
    urls_json: str = Form(default="[]"),
    confirmed_claim_ids_json: str = Form(default="[]"),
    rejected_claim_ids_json: str = Form(default="[]"),
    files: list[UploadFile] | None = File(default=None),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """Extract evidence, update context with Gemini/ADK, and persist typed facts."""

    user = await _require_personal_user(authorization)
    try:
        urls = json.loads(urls_json)
        confirmed_claim_ids = json.loads(confirmed_claim_ids_json)
        rejected_claim_ids = json.loads(rejected_claim_ids_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Context form JSON is invalid.") from exc
    if not isinstance(urls, list) or len(urls) > 5:
        raise HTTPException(status_code=400, detail="Provide no more than five website URLs per update.")
    if not all(isinstance(item, str) for item in urls):
        raise HTTPException(status_code=400, detail="Every website URL must be text.")

    existing = runtime_business_contexts.get(workspace_id)
    if existing is None:
        existing = await _load_record("business_contexts", workspace_id)
    if existing and existing.get("owner_user_id") != user.get("uid"):
        raise HTTPException(status_code=403, detail="This workspace belongs to another user.")

    extracted_evidence: list[dict[str, Any]] = []
    source_metadata: list[dict[str, Any]] = []
    if len(files or []) > 8:
        raise HTTPException(status_code=400, detail="Provide no more than eight files per context update.")
    try:
        for upload in files or []:
            content = await upload.read()
            await upload.close()
            extracted = extract_uploaded_file(upload.filename or "upload", content)
            source_id = f"upload-{uuid.uuid4().hex[:10]}"
            domain = _infer_evidence_domain(extracted["name"])
            extracted_evidence.append(
                {"source_id": source_id, "domain": domain, **extracted}
            )
            source_metadata.append(
                {
                    "source_id": source_id,
                    "name": extracted["name"],
                    "domain": domain,
                    "source_type": "upload",
                    "status": "processed",
                    "provenance": "Founder upload",
                    "coverage": "Derived from uploaded document",
                    "freshness": "Uploaded now",
                    "permission": "uploaded",
                }
            )
        for url in urls:
            extracted = await extract_public_url(url)
            source_id = f"web-{uuid.uuid4().hex[:10]}"
            domain = _infer_evidence_domain(f"{extracted['name']} {url}")
            extracted_evidence.append(
                {"source_id": source_id, "domain": domain, **extracted}
            )
            source_metadata.append(
                {
                    "source_id": source_id,
                    "name": extracted["name"],
                    "domain": domain,
                    "source_type": "website",
                    "status": "processed",
                    "provenance": url,
                    "coverage": "Public page content",
                    "freshness": "Imported now",
                    "permission": "read_only",
                }
            )
    except EvidenceExtractionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not message.strip() and not extracted_evidence and not confirmed_claim_ids and not rejected_claim_ids:
        raise HTTPException(
            status_code=400,
            detail="Add a message, upload, website, or claim decision before reconstructing context.",
        )

    if message.strip():
        source_id = f"founder-{uuid.uuid4().hex[:10]}"
        source_metadata.append(
            {
                "source_id": source_id,
                "name": "Founder conversation",
                "domain": "business",
                "source_type": "founder_chat",
                "status": "processed",
                "provenance": "Authenticated founder response",
                "coverage": "Current onboarding question",
                "freshness": "Provided now",
                "permission": "founder_provided",
            }
        )
        extracted_evidence.append(
            {
                "source_id": source_id,
                "domain": "business",
                "name": "Founder conversation",
                "text": message.strip(),
            }
        )

    prior_context = existing.get("context") if existing else None
    try:
        decision = await _run_context_reconstruction(
            workspace_id=workspace_id,
            user_id=user["uid"],
            prior_context=prior_context,
            source_metadata=source_metadata,
            extracted_evidence=extracted_evidence,
            founder_message=message.strip(),
            confirmed_claim_ids=confirmed_claim_ids,
            rejected_claim_ids=rejected_claim_ids,
        )
    except genai_errors.APIError as exc:
        retryable = exc.code in {429, 500, 502, 503, 504}
        raise HTTPException(
            status_code=503 if retryable else 502,
            detail={
                "code": "gemini_temporarily_unavailable" if retryable else "context_reconstruction_failed",
                "message": "Gemini could not reconstruct the business context. Retry later.",
                "provider_status": exc.status,
            },
        ) from exc

    context_source_ids = {source.source_id for source in decision.context.evidence_sources}
    for source in source_metadata:
        if source["source_id"] not in context_source_ids:
            decision.context.evidence_sources.append(
                ContextEvidenceSource.model_validate(source)
            )

    now = datetime.now(UTC).isoformat()
    version = int(existing.get("version", 0)) + 1 if existing else 1
    record = {
        "workspace_id": workspace_id,
        "owner_user_id": user["uid"],
        "owner_email": user.get("email"),
        "version": version,
        "model_version": CONTEXT_MODEL_VERSION,
        "created_at": existing.get("created_at", now) if existing else now,
        "updated_at": now,
        "context": decision.context.model_dump(mode="json"),
        "assistant_message": decision.assistant_message,
        "next_question": decision.next_question,
        "material_inferences": decision.material_inferences,
        "pending_confirmation_claim_ids": decision.pending_confirmation_claim_ids,
        "original_storage": "browser_only",
    }
    runtime_business_contexts[workspace_id] = record
    await _persist("business_contexts", workspace_id, record)
    await _persist(
        "context_messages",
        f"{workspace_id}-{uuid.uuid4().hex[:10]}",
        {
            "workspace_id": workspace_id,
            "owner_user_id": user["uid"],
            "message": message.strip(),
            "assistant_message": decision.assistant_message,
            "created_at": now,
        },
    )
    for source in source_metadata:
        await _persist(
            "evidence_sources",
            source["source_id"],
            {**source, "workspace_id": workspace_id, "owner_user_id": user["uid"]},
        )
    return record


@app.post("/v1/business-contexts/{workspace_id}/confirm")
async def confirm_context_claims(
    workspace_id: str,
    request: ContextConfirmationRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    user = await _require_personal_user(authorization)
    record = runtime_business_contexts.get(workspace_id)
    if record is None:
        record = await _load_record("business_contexts", workspace_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Business workspace was not found.")
    if record.get("owner_user_id") != user.get("uid"):
        raise HTTPException(status_code=403, detail="This workspace belongs to another user.")

    context = BusinessContextRecord.model_validate(record["context"])
    confirmed = set(request.confirmed_claim_ids)
    rejected = set(request.rejected_claim_ids)
    for claim in context.claims:
        if claim.claim_id in confirmed:
            claim.confirmation_status = "confirmed"
        elif claim.claim_id in rejected:
            claim.confirmation_status = "rejected"
    approved_conflicts = set(request.approved_conflict_ids)
    context.conflicts = [
        conflict
        for conflict in context.conflicts
        if conflict.conflict_id not in approved_conflicts
    ]
    context.classification.founder_confirmed = all(
        claim.confirmation_status != "pending" for claim in context.claims
    )
    context = _enforce_context_readiness(context)
    record["context"] = context.model_dump(mode="json")
    record["updated_at"] = datetime.now(UTC).isoformat()
    record["pending_confirmation_claim_ids"] = [
        claim.claim_id
        for claim in context.claims
        if claim.confirmation_status == "pending"
    ]
    runtime_business_contexts[workspace_id] = record
    await _persist("business_contexts", workspace_id, record)
    return record


@app.post("/v1/diagnose")
async def diagnose(
    request: DiagnoseRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    context_record: dict[str, Any] | None = None
    runtime_user_id = request.user_id
    if request.workspace_id:
        user = await _require_personal_user(authorization)
        runtime_user_id = user["uid"]
        context_record = runtime_business_contexts.get(request.workspace_id)
        if context_record is None:
            context_record = await _load_record("business_contexts", request.workspace_id)
        if context_record is None:
            raise HTTPException(status_code=404, detail="Business workspace was not found.")
        if context_record.get("owner_user_id") != user.get("uid"):
            raise HTTPException(status_code=403, detail="This workspace belongs to another user.")

    session_id = f"{request.incident_id.lower()}-{uuid.uuid4().hex[:8]}"
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=runtime_user_id,
        session_id=session_id,
    )
    context_snapshot = BusinessContextRecord.model_validate(
        context_record["context"] if context_record else _demo_business_context()
    )
    diagnostic_payload: dict[str, Any] = {
        "incident_id": request.incident_id,
        "concern": request.concern,
        "business_context_version": (
            context_record.get("version") if context_record else "northstar-demo-v1"
        ),
        "business_context": {
            "classification": context_snapshot.classification.model_dump(mode="json"),
            "economic_engine": [stage.model_dump(mode="json") for stage in context_snapshot.economic_engine],
            "operating_system": [area.model_dump(mode="json") for area in context_snapshot.operating_system],
            "external_dependencies": context_snapshot.external_dependencies,
            "metrics": [
                {
                    "metric_id": metric.metric_id,
                    "label": metric.label,
                    "current_value": metric.current_value,
                    "expected_low": metric.expected_low,
                    "expected_high": metric.expected_high,
                    "standard_type": metric.standard_type,
                    "trend": metric.trend,
                    "source_ids": metric.source_ids,
                }
                for metric in context_snapshot.metrics
            ],
            "timeline_events": [event.model_dump(mode="json") for event in context_snapshot.timeline_events],
            "selected_frameworks": [framework.model_dump(mode="json") for framework in context_snapshot.selected_frameworks],
            "readiness": context_snapshot.readiness.model_dump(mode="json"),
        },
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
            user_id=runtime_user_id,
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
