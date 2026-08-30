# ProofLoop architecture

```mermaid
flowchart TD
    A["Vercel Next.js interface"] --> B["Cloud Run FastAPI"]
    C["Google Ads + Looker-shaped evidence"] --> D["Python evidence connectors"]
    D --> E["Google ADK diagnostic workflow"]
    B --> E
    E --> F["Gemini 3.5 Flash-Lite"]
    F --> G["Typed Root Problem Record"]
    G --> H["Human approval gate"]
    H --> I["Intervention evaluation"]
    I --> J["Firestore proof ledger"]
    E -. "Hosted on" .-> B
```

## Responsibilities

| Layer | Responsibility |
|---|---|
| Next.js on Vercel | Presents the six-stage diagnostic workbench and calls the Cloud Run API |
| FastAPI | Validates requests and exposes diagnosis, approval, and evaluation endpoints |
| ADK | Sequences six specialized diagnostic agents and preserves session state |
| Gemini | Synthesizes evidence, competes hypotheses, falsifies explanations, and produces typed decisions |
| Connectors | Load source-labelled evidence without exposing credentials to prompts |
| Pydantic schemas | Enforce Root Problem Record and intervention contracts |
| Firestore | Persists diagnostic runs, approvals, proof records, and learned rules |
| Cloud Run | Hosts the Python API with a dedicated service identity |

## Proof gate

```mermaid
flowchart TD
    A["Observed signal"] --> B{"Signal valid?"}
    B -- "No" --> C["Repair data or gather evidence"]
    B -- "Yes" --> D["Competing hypotheses"]
    D --> E["Falsification review"]
    E --> F{"Cause supported?"}
    F -- "No" --> C
    F -- "Yes" --> G["Bounded intervention"]
    G --> H["Human approval"]
    H --> I["Measure predicted outcome"]
    I --> J{"Prediction matched?"}
    J -- "No" --> D
    J -- "Yes" --> K["Verified operating rule"]
```

## Data boundaries

- Demo mode loads only `data/incident-pl0047.json`.
- Live connector secrets are read from runtime environment variables.
- Source rows remain outside persistent ADK instructions unless explicitly selected as evidence.
- Every evidence-backed conclusion carries source IDs and reliability labels.
- Firestore writes use the Cloud Run service account rather than embedded credentials.

## Failure handling

- Gemini capacity errors are returned as retryable API responses rather than fabricated diagnoses.
- Missing or malformed final JSON fails closed.
- Intervention approval requires explicit scope acknowledgement.
- Approval records include idempotency keys.
- Evaluation metrics and stop conditions are locked before intervention execution.
