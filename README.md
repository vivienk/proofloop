# ProofLoop

ProofLoop is a self-improving business diagnostic agent for founders and small teams. It turns an observed business anomaly into an evidence-backed root-problem record, proposes a bounded intervention, verifies the outcome, and stores a reusable operating rule.

## Hackathon stack

- Python 3.12
- Gemini 3.5 Flash-Lite (configurable to newer Gemini models)
- Google Agent Development Kit (ADK)
- FastAPI
- Google Cloud Run
- Firestore

## Diagnostic workflow

1. `SignalValidator` checks whether the anomaly is real.
2. `SystemsInvestigator` frames the problem using adaptive 5W1H.
3. `HypothesisBuilder` generates competing causal mechanisms.
4. `FalsificationAgent` tries to disprove the leading explanation.
5. `RootProblemDefiner` creates the typed Root Problem Record.
6. `InterventionPlanner` defines a reversible test and verification contract.

The demo incident uses synthetic, privacy-safe Google Ads-, Looker-, release-log-, and customer-voice-shaped evidence. Live connector scaffolding is isolated from model prompts and reads credentials only from environment variables.

## Run locally

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Add a Gemini API key to `.env`. Never commit that file.

```env
GOOGLE_API_KEY=your-private-key
GOOGLE_GENAI_USE_VERTEXAI=false
PROOFLOOP_MODEL=gemini-3.5-flash-lite
PROOFLOOP_DEMO_MODE=true
```

Start the API:

```bash
uvicorn main:app --host 0.0.0.0 --port 8080 --env-file .env
```

Check health:

```bash
curl http://127.0.0.1:8080/health
```

Run the full diagnosis:

```bash
curl --max-time 900 -X POST http://127.0.0.1:8080/v1/diagnose \
  -H "Content-Type: application/json" \
  -d '{
    "incident_id": "PL-0047",
    "concern": "Paid traffic increased while checkout progression declined.",
    "user_id": "demo-founder"
  }'
```

Approve and evaluate the returned run ID:

```bash
curl -X POST http://127.0.0.1:8080/v1/interventions/RUN_ID/approve \
  -H "Content-Type: application/json" \
  -d '{"approved_by":"demo-founder","scope_acknowledged":true}'

curl -X POST http://127.0.0.1:8080/v1/interventions/RUN_ID/evaluate
```

## Cloud Run deployment

Deploy from this directory after creating the Gemini secret and a service account with Secret Manager access:

```bash
gcloud run deploy proofloop-agent \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 1 \
  --set-secrets GOOGLE_API_KEY=proofloop-gemini-key:latest \
  --set-env-vars PROOFLOOP_MODEL=gemini-3.5-flash-lite,PROOFLOOP_DEMO_MODE=false
```

Cloud Run uses its service identity for Firestore. The Gemini API key stays in Secret Manager and is never exposed to the frontend.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Runtime, model, and mode check |
| `POST` | `/v1/diagnose` | Run the complete ADK diagnostic proof gate |
| `POST` | `/v1/interventions/{run_id}/approve` | Record scoped human authorization |
| `POST` | `/v1/interventions/{run_id}/evaluate` | Evaluate the locked intervention contract |

## Safety principles

- The initial signal is never labeled as the root problem.
- A cause remains a hypothesis until the intervention produces its predicted result.
- Material claims cite evidence IDs.
- External, financial, destructive, or irreversible actions require human approval.
- Interventions define success metrics, guardrails, observation windows, and stop conditions before execution.
- Credentials never enter model prompts or repository state.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the system design and [SUBMISSION.md](SUBMISSION.md) for the Devpost draft and demo sequence.
