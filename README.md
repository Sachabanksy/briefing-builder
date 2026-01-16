## Briefing Builder

Briefing Builder is a full-stack application for drafting and iterating ministerial briefings grounded in economic time-series data. Analysts can select official data series, describe the audience/tone, and have an LLM generate a structured briefing backed by citations. All drafts are saved so teams can revisit, chat-edit, annotate, and export every version.

### Architecture

- **Backend (FastAPI + PostgreSQL)**  
  Seeds lookup metadata and synthetic time series (if real data is missing), orchestrates data-pack building, calls OpenAI to create/edit briefings, and persists versions/comments/chat history. Exposes REST endpoints under `backend/src/api.py`. Run via Docker Compose with optional `.env` overrides for `OPENAI_API_KEY`, logging, etc.

- **Frontend (Vite + React + Tailwind + shadcn/ui)**  
  Provides the briefing workspace: creation form, live document viewer, chat-driven edits, version history, comments, PDF export, and a “Browse Briefings” drawer that fetches stored briefings from the backend.

### Key Flows

1. **Create briefing** – select topic/series, set tone/length/lookback, submit. Backend builds a data pack, invokes the LLM, stores the draft, and returns the rendered model.
2. **Iterate via chat** – send instructions (e.g., “shorten intro”), backend produces a new version, and the frontend updates the viewer/version list.
3. **Annotate and export** – add inline comments, review quality banners/sections, download PDFs for circulation.
4. **Browse saved work** – open the Browse drawer to load any prior briefing, including its versions, comments, and chat threads.

See `backend/README.md` and `frontend/README.md` for setup instructions, environment variables, and development details.
