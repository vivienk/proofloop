# ProofLoop

Autonomous business investigation engine for founders. It locates the failing
process behind a business symptom, proposes a bounded reversible intervention,
verifies the outcome, and learns. Credibility is the product: every rule below
protects the claim that ProofLoop only concludes what evidence supports.

## Architecture

- Backend: FastAPI in `main.py`, Google ADK agents in `proofloop/`
  (`agent.py` diagnosis, `context_agent.py` business context, `chat_agent.py`
  investigation chat). Typed contracts live in `*schemas.py`. Deployed on Render.
- Frontend: Next.js 16 + React 19 in `app/`. Deployed on Vercel.
- Persistence: Firestore when `PROOFLOOP_PERSISTENCE_MODE=firestore`, otherwise
  in-process dicts that vanish on restart.
- Auth: Firebase Google sign-in for personal workspaces. The Northstar demo
  workspace is public.
- `PROOFLOOP_EXECUTION_MODE=compact` (hosted) runs the whole investigation as
  ONE schema-constrained model call. `sequential` runs the six-agent pipeline.
  Don't build per-stage progress for compact mode; those stages don't exist
  server-side.

## Commands

- Frontend: `npm ci`, `npm run dev`, `npx tsc --noEmit`
- Backend: `uvicorn main:app --port 8080 --env-file .env`
- Tests: `python -m pytest tests` (Gemini is scripted; no API key needed)
- `npm run lint` currently fails: there is no `eslint.config.*` file.
- `next build` downloads Inter from Google Fonts and fails offline.

## Non-negotiable product rules

1. Python recomputes every gate outside the model: problem gate, unit
   RED/GREEN, independent-source count, risk gate, and citation validity.
   Never trust a model-reported status, count, or evidence ID.
2. A supported root cause needs at least 2 independent sources, 3 to 5
   competing hypotheses, and the product/customer/growth/operations units.
3. Founder statements (`source: founder_statement`, IDs `founder-*`) are leads.
   They never count as independent corroboration.
4. Use evidence-state labels (observed, plausible, supported, disproved,
   intervention_validated). Never confidence percentages.
5. Chat and explanations never mutate a decision. Only a re-run changes it.
6. Interventions require human approval. Learned rules follow the two-layer
   contract in "Business memory" below.
7. Never imply Gemini ran, data is live, or an action happened when it didn't.
   Label demo data as demo. No fake acknowledgements or dead buttons.
8. Uploads: discard file bytes after bounded extraction; store only typed
   claims, provenance, and confirmations.
9. Run-scoped endpoints authorize with the run's `access` and
   `owner_user_id` fields. Never trust a client-supplied user id.

## Business memory: propose freely, promote with confirmation

ProofLoop's learned rules mirror Claude Code's two memory layers. Persistent
business memory is not built yet; build it to this contract.

- **The agent writes proposals freely, like `MEMORY.md`.** Whenever an
  evaluated outcome, a founder correction, or a repeated pattern supports a
  lesson, the agent may record a proposal without asking. Each proposal stores
  the lesson, when it applies, the run and evidence IDs behind it, and status
  `proposed`. Founders can see proposals, but proposals never influence an
  investigation.
- **Promotion into a standard needs founder confirmation, like `CLAUDE.md`.**
  A proposal becomes a standard only when the founder confirms it. Only
  confirmed standards reach the splitter as prior constraints. The agent never
  promotes, edits, or deletes a standard on its own.

Standards are scoped to one workspace. They reorder investigation units but
never skip a required domain. Founders can reject a proposal or delete a
standard, and deleting removes its content rather than marking it inactive.

## Known gaps (don't describe these as working)

- `/v1/interventions/{run_id}/approve` and `/evaluate` have no auth check.
- `/evaluate` replays static demo numbers; it is not a real cohort analysis.
- Chat on runs created before access metadata existed returns 409.

## Frontend conventions

- Global DOM scripts (`client-enhancements.tsx`,
  `workspace-session-enhancements.tsx`, `source-library-enhancements.tsx`)
  mutate every `.chat-bubble`, `.chat-stream`, and `.assistant-tabs` on the
  page. New UI must use its own class names.
- Style with the theme tokens in `globals.css` (`--ink`, `--surface`, `--line`,
  `--primary`, `--muted-ink`, `--green`, `--coral`) so dark mode works.
- `API_URL` defaults to the production Render URL when
  `NEXT_PUBLIC_PROOFLOOP_API_URL` is unset.

## Models

- Default `gemini-3.5-flash-lite`; chat can override with
  `PROOFLOOP_CHAT_MODEL`. Gemini 1.x is shut down and Gemini 2.5 shuts down
  October 16, 2026, so never downgrade to those.
- Run `python -m pytest tests` and the evals in `evals/` before changing a
  model or prompt.

## Workflow

- For any new model-powered feature, follow `.claude/skills/gated-agent-feature`.
- Secrets stay in `.env`, Render, or Vercel. Never commit them.
