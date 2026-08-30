# ProofLoop

ProofLoop is an autonomous business investigation engine for founders and small teams. It locates the failing process and standard—not just the visible symptom—then proposes a bounded intervention, verifies the outcome, updates the operating standard, and monitors what was learned.

Before investigating, the v5 Business Context Engine reconstructs what the
business is, how value becomes revenue, what normal behavior looks like, and
where causal evidence lives. The founder may connect demo integrations, upload
real documents, import a public website, or answer adaptive chat questions.

Frontend: https://proofloop-flywheel.vercel.app

Agent API: https://proofloop-agent.onrender.com

## Hackathon stack

- Python 3.12
- Next.js 16 and Vercel
- Gemini 3.5 Flash-Lite (configurable to newer Gemini models)
- Google Agent Development Kit (ADK)
- FastAPI
- Render Docker web service
- Firestore
- Firebase Authentication for personal workspaces

## Business Forensics journey

```text
Evidence → History → Business model → Economic engine
→ Operations → Baselines → Scope-specific readiness
→ Diagnostic router → Investigation graph
```

The public Northstar workspace is ready without login. Personal workspaces use
Google sign-in and support PDF, CSV, XLSX, TXT, Markdown, DOCX, and PPTX uploads
up to 10 MB. Source files are retained in the founder's browser with IndexedDB;
the backend discards upload bytes after bounded extraction and stores only typed
claims, provenance, confirmations, and context in Firestore.

The evidence library is organized into Business, Revenue, Product, Growth,
Customers, and Operations. Integration cards clearly distinguish `Demo`,
`Connected`, and `Coming soon` states.

## Canonical investigation graph

```text
Problem gate → Process / standard / gap → Splitter
→ Product / Customer / Growth / Operations unit loops
→ Deterministic merge → Evidence gate → Risk gate
→ Intervention → Outcome loop → Learning edge
```

The system compares `Standard vs Evidence vs Verification` and investigates
seven possible cause domains: people, process, technology, inputs, environment,
measurement, and incentives. It also separates technical, operational,
execution, quality, and approval ownership.

Every bounded unit follows `produce → check → correct → repeat`. A GREEN unit
may support or reject its hypothesis; RED means the investigation unit itself
is incomplete. Correction edges retry only RED units. A separate learning edge
turns verified outcomes into constraints that reprioritize future splitters.

## Hosted investigation workflow

The hosted demo runs the complete investigation contract in one
schema-constrained ADK model call to reduce latency and exposure to transient
provider-capacity errors. The full sequential six-agent implementation remains available with
`PROOFLOOP_EXECUTION_MODE=sequential`.

1. Define and validate the incident with a programmatic problem gate.
2. Map the process, failing step, expected standard, actual execution, and gap.
3. Run evidence-backed 5 Whys and seven-factor systems analysis.
4. Inspect ownership, authority, incentives, and the quality escape.
5. Split the investigation into product, customer, growth, and operations units.
6. Run RED/GREEN checks and retry only failed units.
7. Deterministically merge valid supported and rejected conclusions.
8. Define the smallest consequential and controllable root problem.
9. Pass a separate blast-radius and reversibility risk gate.
10. Lock a reversible intervention and verification contract.

Python recomputes the proof gate outside Gemini. The agent advances only when a
supported cause has at least two independent sources, credible alternatives were
considered, and human approval is required. Otherwise it terminates as
`insufficient_evidence` or `conflicting_evidence` with a named next test.

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
NEXT_PUBLIC_FIREBASE_API_KEY=your-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-web-app-id
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
PROOFLOOP_MODEL=gemini-3.5-flash-lite
PROOFLOOP_EXECUTION_MODE=compact
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
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-web-app-id
```

In Firebase Console, enable **Authentication → Sign-in method → Google** and
add `proofloop-flywheel.vercel.app` to Authentication's authorized domains.
Firebase's public web configuration is safe in `NEXT_PUBLIC_*`; the service
account JSON remains private on Render.

Every push to `main` triggers a new Vercel production build and a Render backend deployment. The frontend and agent remain separately addressable while sharing the same repository.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Runtime, model, and mode check |
| `GET` | `/v1/model` | Publish the decision loop, limits, and typed JSON schemas |
| `GET` | `/v1/business-context/demo` | Return the public Northstar Business Context Graph |
| `GET` | `/v1/business-contexts/{workspace_id}` | Load an authenticated personal context |
| `POST` | `/v1/business-contexts/reconstruct` | Extract evidence and run the Gemini/ADK context reconstruction |
| `POST` | `/v1/business-contexts/{workspace_id}/confirm` | Confirm or reject material claims and conflicts |
| `POST` | `/v1/diagnose` | Run the complete ADK diagnostic proof gate |
| `POST` | `/v1/interventions/{run_id}/approve` | Record scoped human authorization |
| `POST` | `/v1/interventions/{run_id}/evaluate` | Evaluate the locked intervention contract |

The web app binds the returned `DiagnosticDecision` directly into the evidence ledger, process/standard/gap model, system factors, competing hypotheses, intervention contract, evaluation, updated standard, and learned rule. UI state advances only after the corresponding API request succeeds.

## Safety principles

- The initial signal is never labeled as the root problem.
- A cause remains a hypothesis until the intervention produces its predicted result.
- Unsupported standards, owners, incentives, and causal links are marked unknown.
- Evidence-state labels replace ungrounded numerical confidence scores.
- Gemini cannot bypass deterministic Python problem, node, evidence, or risk gates.
- Material claims cite evidence IDs.
- External, financial, destructive, or irreversible actions require human approval.
- Interventions define success metrics, guardrails, observation windows, and stop conditions before execution.
- Credentials never enter model prompts or repository state.
- Personal context endpoints require a verified Firebase ID token.
- Public URL imports accept only final public HTTPS pages and block private, loopback, link-local, reserved, and oversized responses.
- Uploaded source bytes are discarded after extraction; original-file retention is browser-local.
- Correlations are displayed as Gemini-ranked investigation leads, never verified causes.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the system design and [SUBMISSION.md](SUBMISSION.md) for the Devpost draft and demo sequence.
