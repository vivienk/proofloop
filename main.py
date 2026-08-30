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
from proofloop.schemas import DiagnosticDecision, RootProblemRecord


APP_NAME = "proofloop"
MODEL_VERSION = "proofloop-root-problem-v2"
DEFAULT_ALLOWED_ORIGINS = (
    "http://localhost:3000,https://proofloop-flywheel.vercel.app"
)
AGENT_STAGES = [
    "signal_validation",
    "systems_investigation",
    "hypothesis_generation",
    "falsification",
    "root_problem_definition",
    "intervention_planning",
]
session_service = InMemorySessionService()
EXECUTION_MODE = os.getenv("PROOFLOOP_EXECUTION_MODE", "sequential").strip().lower()
selected_agent = compact_agent if EXECUTION_MODE == "compact" else root_agent
runner = Runner(
    app_name=APP_NAME,
    agent=selected_agent,
    session_service=session_service,
)

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


@app.get("/")
async def service_index() -> dict[str, Any]:
    return {
        "service": "ProofLoop Agent API",
        "status": "ok",
        "model_version": MODEL_VERSION,
        "endpoints": ["/health", "/v1/model", "/v1/diagnose"],
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
        "model": os.getenv("PROOFLOOP_MODEL", "gemini-3.6-flash"),
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
        "model": os.getenv("PROOFLOOP_MODEL", "gemini-3.6-flash"),
        "execution_mode": EXECUTION_MODE,
        "stages": AGENT_STAGES,
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
        decision = json.loads(final_text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="Agent decision was not valid JSON.") from exc

    envelope = {
        "run_id": session_id,
        "incident_id": request.incident_id,
        "status": "awaiting_approval",
        "created_at": datetime.now(UTC).isoformat(),
        "model_version": MODEL_VERSION,
        "execution_mode": EXECUTION_MODE,
        "agent_stages": AGENT_STAGES,
        "decision": decision,
    }
    await _persist("diagnostic_runs", session_id, envelope)
    return envelope


@app.post("/v1/interventions/{run_id}/approve")
async def approve_intervention(run_id: str, request: ApprovalRequest) -> dict[str, Any]:
    if not request.scope_acknowledged:
        raise HTTPException(status_code=400, detail="Intervention scope must be acknowledged.")
    payload = {
        "run_id": run_id,
        "status": "monitoring",
        "approved_by": request.approved_by,
        "approved_at": datetime.now(UTC).isoformat(),
        "idempotency_key": f"approve:{run_id}",
    }
    await _persist("interventions", run_id, payload)
    return payload


@app.post("/v1/interventions/{run_id}/evaluate")
async def evaluate_intervention(run_id: str) -> dict[str, Any]:
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
    }
    await _persist("proof_records", run_id, payload)
    return payload
