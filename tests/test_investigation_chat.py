"""Contract tests for investigation chat. Gemini is replaced with scripted replies."""

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import main


def _decision(extra_evidence=None):
    evidence = [
        {"evidence_id": "ads-142", "source": "google_ads", "claim": "Paid clicks rose 31%.", "reliability": "high", "relationship": "context"},
        {"evidence_id": "release-184", "source": "release_log", "claim": "Checkout release shipped 09:12.", "reliability": "high", "relationship": "supports"},
        {"evidence_id": "looker-391", "source": "looker", "claim": "Safari checkout progression fell.", "reliability": "high", "relationship": "supports"},
    ] + (extra_evidence or [])
    unit = lambda domain, ids: {
        "id": f"{domain}-unit", "domain": domain, "hypothesis": f"{domain} hypothesis",
        "finding": "finding", "verdict": "supported", "evidence_ids": ids,
        "contradicting_evidence_ids": [], "blocking_missing_evidence": [], "attempts": 1,
        "status": "green", "correction_request": "",
    }
    hypothesis = lambda text, status: {
        "hypothesis": text, "mechanism": "m", "status": status,
        "supporting_evidence_ids": ["release-184"], "contradicting_evidence_ids": [],
        "missing_evidence": [], "discriminating_test": "Roll back for Safari only.",
    }
    return {
        "problem_gate": {"metric": "checkout progression", "expected_value": 0.48, "observed_value": 0.41, "delta": -0.07,
                         "timeframe": "48h", "affected_population": "mobile Safari", "source_evidence_ids": ["looker-391"],
                         "anomaly_reproducible": True, "status": "green", "failed_checks": []},
        "investigation_graph": {
            "units": [unit("product", ["release-184"]), unit("customer", ["looker-391"]),
                      unit("growth", ["ads-142"]), unit("operations", ["release-184"])],
            "root_cause_gate": {"status": "green", "failed_unit_ids": [], "independent_source_count": 3, "reason": "r"},
        },
        "root_problem": {
            "incident_id": "PL-0047", "signal": "s", "expected_state": "e", "actual_state": "a",
            "affected_segment": "mobile Safari", "business_impact": "b", "problem_statement": "p",
            "proximate_cause": "pc", "systemic_cause": "sc", "status": "supported", "evidence": evidence,
            "process_gap": {"process": "release", "failing_step": "qa", "expected_standard": "x", "actual_execution": "y",
                            "gap": "g", "standard_evidence_id": "not_documented"},
            "five_whys": [{"level": 1, "answer": "a", "evidence_ids": ["release-184"]}],
            "system_factors": [], "ownership": {"technical_owner": "t", "operational_owner": "o", "execution_owner": "e",
                                                "quality_owner": "q", "decision_approver": "d", "accountability_gap": "g"},
            "incentives": {"current_incentive": "c", "behavioral_effect": "b", "alignment_gap": "a"},
            "quality": {"escape_type": "external", "detection_point": "d", "control_gap": "c"},
            "hypotheses": [hypothesis("Release broke Safari CTA", "supported"),
                           hypothesis("Ad traffic quality fell", "disproved"),
                           hypothesis("Pricing page change", "disproved")],
            "alternatives_considered": ["ads"], "missing_evidence": [], "disconfirming_test": "t", "limitations": [],
        },
        "intervention": {"name": "n", "action": "a", "scope": "s", "reversibility": "r", "approval_required": True,
                         "primary_metric": "m", "success_threshold": "t", "guardrails": [], "observation_window": "w",
                         "stop_condition": "s"},
        "investigation": {"termination_state": "confirmed", "independent_source_count": 3, "hypotheses_considered": 3,
                          "proof_gate_passed": True, "stopping_reason": "r"},
        "risk_gate": {"risk_level": "high", "blast_radius": "contained", "consequence_if_wrong": "c",
                      "execution_mode": "human_approval", "status": "green", "reason": "r"},
        "next_stage": "request_approval",
        "plain_language_summary": "summary",
    }


def _scripted(text, captured=None):
    async def run_async(**kwargs):
        if captured is not None:
            captured.append(json.loads(kwargs["new_message"].parts[0].text))
        yield SimpleNamespace(is_final_response=lambda: True,
                              content=SimpleNamespace(parts=[SimpleNamespace(text=text)]))
    return run_async


@pytest.fixture(autouse=True)
def isolate(monkeypatch):
    monkeypatch.setenv("PROOFLOOP_PERSISTENCE_MODE", "none")
    main.runtime_diagnostic_runs.clear()
    main.runtime_investigation_chats.clear()


@pytest.fixture
def client():
    return TestClient(main.app)


def _create_demo_run(client, monkeypatch, decision=None, **body):
    monkeypatch.setattr(main.runner, "run_async", _scripted(json.dumps(decision or _decision())))
    response = client.post("/v1/diagnose", json={"incident_id": "PL-0047", **body})
    assert response.status_code == 200, response.text
    return response.json()


def test_chat_strips_invented_citations_and_drops_stray_pending_evidence(client, monkeypatch):
    run = _create_demo_run(client, monkeypatch)
    captured = []
    reply = {"intent": "explain", "answer": "Ads were ruled out.", "cited_evidence_ids": ["ads-142", "made-up-9"],
             "uncertainty": "", "suggested_questions": ["What would falsify H1?"],
             "pending_evidence": {"claim": "x", "suggested_source": "y", "relevant_hypotheses": []}}
    monkeypatch.setattr(main.chat_runner, "run_async", _scripted(json.dumps(reply), captured))

    response = client.post(f"/v1/investigations/{run['run_id']}/chat", json={"message": "Why did you rule out ads?"})
    assert response.status_code == 200, response.text
    assistant = response.json()["messages"][1]
    assert assistant["reply"]["cited_evidence_ids"] == ["ads-142"]
    assert assistant["reply"]["pending_evidence"] is None
    assert assistant["grounding"] == {"status": "partially_grounded", "rejected_evidence_ids": ["made-up-9"]}
    assert captured[0]["investigation_record"]["decision"]["root_problem"]["incident_id"] == "PL-0047"


def test_explanation_without_citations_is_ungrounded(client, monkeypatch):
    run = _create_demo_run(client, monkeypatch)
    reply = {"intent": "challenge", "answer": "Probably fine.", "cited_evidence_ids": [], "uncertainty": "u"}
    monkeypatch.setattr(main.chat_runner, "run_async", _scripted(json.dumps(reply)))
    response = client.post(f"/v1/investigations/{run['run_id']}/chat", json={"message": "I think it's ads."})
    assert response.json()["messages"][1]["grounding"]["status"] == "ungrounded"


def test_history_is_replayed_and_returned(client, monkeypatch):
    run = _create_demo_run(client, monkeypatch)
    captured = []
    reply = {"intent": "new_evidence", "answer": "Noted as a lead.", "cited_evidence_ids": [], "uncertainty": "u",
             "pending_evidence": {"claim": "Android also dipped", "suggested_source": "Looker by OS", "relevant_hypotheses": []}}
    monkeypatch.setattr(main.chat_runner, "run_async", _scripted(json.dumps(reply), captured))
    url = f"/v1/investigations/{run['run_id']}/chat"
    client.post(url, json={"message": "first"})
    client.post(url, json={"message": "Android dipped too"})
    assert [m["text"] for m in captured[1]["conversation"]] == ["first", "Noted as a lead."]
    history = client.get(url).json()
    assert len(history["messages"]) == 4
    assert history["messages"][1]["reply"]["pending_evidence"]["claim"] == "Android also dipped"


def test_message_cap(client, monkeypatch):
    run = _create_demo_run(client, monkeypatch)
    reply = {"intent": "explain", "answer": "a", "cited_evidence_ids": ["ads-142"], "uncertainty": ""}
    monkeypatch.setattr(main.chat_runner, "run_async", _scripted(json.dumps(reply)))
    monkeypatch.setattr(main, "MAX_CHAT_MESSAGES_PER_RUN", 4)
    url = f"/v1/investigations/{run['run_id']}/chat"
    assert client.post(url, json={"message": "1"}).status_code == 200
    assert client.post(url, json={"message": "2"}).status_code == 200
    assert client.post(url, json={"message": "3"}).status_code == 429


def test_owner_runs_require_matching_user(client, monkeypatch):
    main.runtime_diagnostic_runs["owned"] = {"access": "owner", "owner_user_id": "uid-a", "decision": _decision()}

    async def fake_user(authorization):
        if not authorization:
            raise main.HTTPException(status_code=401, detail="sign in")
        return {"uid": authorization.removeprefix("Bearer ")}

    monkeypatch.setattr(main, "_require_personal_user", fake_user)
    assert client.get("/v1/investigations/owned/chat").status_code == 401
    assert client.get("/v1/investigations/owned/chat", headers={"Authorization": "Bearer uid-b"}).status_code == 403
    assert client.get("/v1/investigations/owned/chat", headers={"Authorization": "Bearer uid-a"}).status_code == 200


def test_legacy_runs_without_access_metadata_are_refused(client):
    main.runtime_diagnostic_runs["legacy"] = {"decision": _decision()}
    assert client.get("/v1/investigations/legacy/chat").status_code == 409


def test_founder_statements_never_count_as_independent_sources(client, monkeypatch):
    # Only one real source plus a founder statement: the gate must stay RED.
    decision = _decision()
    decision["root_problem"]["evidence"] = [
        {"evidence_id": "release-184", "source": "release_log", "claim": "c", "reliability": "high", "relationship": "supports"},
        {"evidence_id": "founder-01", "source": "support_inbox", "claim": "Founder says Safari broke.", "reliability": "medium", "relationship": "supports"},
    ]
    for unit in decision["investigation_graph"]["units"]:
        unit["evidence_ids"] = ["release-184"]
    decision["problem_gate"]["source_evidence_ids"] = ["release-184"]
    run = _create_demo_run(client, monkeypatch, decision=decision,
                           founder_evidence=[{"claim": "Safari users emailed us", "suggested_source": "support inbox"}])
    assert run["status"] == "needs_evidence"
    assert run["decision"]["investigation"]["independent_source_count"] == 1
    assert run["founder_evidence"][0]["evidence_id"] == "founder-01"
    assert run["access"] == "public_demo"
