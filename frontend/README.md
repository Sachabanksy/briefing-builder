# Economic Briefing Builder — Frontend

SPA for creating, iterating, and browsing ministerial briefings. Built with Vite, React, TypeScript, Tailwind, and shadcn/ui.

## Getting Started

```bash
cd frontend
npm install
cp .env.local.example .env.local   # create and edit if needed
npm run dev                        # starts Vite on http://localhost:8080
```

Ensure the FastAPI backend is running on http://localhost:8000 (or whichever URL you set in `.env.local`).

### Environment variables

The app uses `VITE_API_BASE` to talk to the backend. Defaults to `http://localhost:8000`.

```
VITE_API_BASE=http://localhost:8000
```

Restart `npm run dev` if you change this value.

## Features

- **Create briefings** – use the form to pick data series, set tone/length/lookback, and submit. The backend seeds synthetic time-series data automatically if the database lacks a series.
- **Browse saved briefings** – open the “Browse Briefings” drawer (top-left). Fetches `GET /briefings`, lets you refresh the list, and loads the selected briefing (with versions, chat history, comments) so you can continue editing.
- **Chat-driven edits** – use the Chat tab to request revisions; each response creates a new version, which can be selected from the dropdown or Versions panel.
- **Annotations and comments** – add inline comments in the rendered document; view them in the Comments panel.
- **PDF export** – download the current version via the Export button (calls `/briefings/{id}/export/pdf`).

## Project structure

```
src/
  components/
    BriefingBuilder.tsx      # main shell (creation, browsing, document viewer)
    document/                # renderers (QualityBanner, SectionRenderer, etc.)
    form/                    # BriefingCreationForm
    panel/                   # Chat / Versions / Comments panels
    ui/                      # shadcn primitives
  pages/
    Index.tsx                # routes to BriefingBuilder
    NotFound.tsx
  lib/api.ts                 # wrapper around backend endpoints
  stores/briefingStore.ts    # Zustand store for app state
```

## Connecting to the backend

The frontend expects the backend’s containers running via `backend/docker-compose.yml` (which seeds synthetic data and exposes the API on port 8000). If you change ports or run locally outside Docker, update `VITE_API_BASE`.

Backend docs and API reference live in `backend/README.md` and at http://localhost:8000/docs once the server is running.
