# ProofLoop

ProofLoop is a self-improving business diagnostic agent for founders and small teams. It turns an observed business anomaly into an evidence-backed root-problem record, proposes a bounded intervention, verifies the outcome, and stores a reusable operating rule.

Frontend: https://proofloop-flywheel.vercel.app

Agent API: https://proofloop-agent.onrender.com

## Hackathon stack

- Python 3.12
- Next.js 16 and Vercel
- Gemini 3.6 Flash (configurable to newer Gemini models)
- Google Agent Development Kit (ADK)
- FastAPI
- Render Docker web service
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

### Frontend

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Without `NEXT_PUBLIC_PROOFLOOP_API_URL`, the interface displays the labeled example incident but will not claim that Gemini ran or allow a simulated approval. To connect the real agent, add the public backend URL to `.env.local`:

```env
NEXT_PUBLIC_PROOFLOOP_API_URL=https://proofloop-agent.onrender.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Python agent

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
PROOFLOOP_MODEL=gemini-3.6-flash
PROOFLOOP_DEMO_MODE=true
PROOFLOOP_DATA_MODE=demo
PROOFLOOP_PERSISTENCE_MODE=none
```

Evidence selection and persistence are configured independently. For the
hosted hackathon demo, use synthetic evidence with real Firestore persistence:

```env
PROOFLOOP_DATA_MODE=demo
PROOFLOOP_PERSISTENCE_MODE=firestore
GOOGLE_CLOUD_PROJECT=your-project-id
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

## Render backend deployment

`render.yaml` deploys the existing Dockerized FastAPI/ADK service as a Render web service. Create a Render Blueprint from this repository and provide the three secret values requested during setup:

- `GOOGLE_API_KEY`: the Gemini API key
- `GOOGLE_SERVICE_ACCOUNT_JSON_B64`: a base64-encoded credential for the `proofloop-runner` service account
- `ALLOWED_ORIGINS`: `https://proofloop-flywheel.vercel.app` (already defined in `render.yaml`)

The remaining runtime values are defined in `render.yaml`. Never commit either credential. The service-account key should retain only the already-granted `roles/datastore.user` permission and should be rotated after the hackathon.

## Vercel deployment

The repository root is a standard Next.js project. Import `vivienk/proofloop` into Vercel with the Root Directory left blank and Framework Preset set to Next.js. Add these environment variables in Vercel:

```env
NEXT_PUBLIC_SITE_URL=https://proofloop-flywheel.vercel.app
NEXT_PUBLIC_PROOFLOOP_API_URL=https://proofloop-agent.onrender.com
```

Every push to `main` triggers a new Vercel production build and a Render backend deployment. The frontend and agent remain separately addressable while sharing the same repository.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Runtime, model, and mode check |
| `GET` | `/v1/model` | Publish the six-stage workflow and typed JSON schemas |
| `POST` | `/v1/diagnose` | Run the complete ADK diagnostic proof gate |
| `POST` | `/v1/interventions/{run_id}/approve` | Record scoped human authorization |
| `POST` | `/v1/interventions/{run_id}/evaluate` | Evaluate the locked intervention contract |

The web app binds the returned `DiagnosticDecision` directly into the evidence ledger, competing hypotheses, Root Problem Record, intervention contract, evaluation, and learned rule. UI state advances only after the corresponding API request succeeds.

## Safety principles

- The initial signal is never labeled as the root problem.
- A cause remains a hypothesis until the intervention produces its predicted result.
- Material claims cite evidence IDs.
- External, financial, destructive, or irreversible actions require human approval.
- Interventions define success metrics, guardrails, observation windows, and stop conditions before execution.
- Credentials never enter model prompts or repository state.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the system design and [SUBMISSION.md](SUBMISSION.md) for the Devpost draft and demo sequence.
