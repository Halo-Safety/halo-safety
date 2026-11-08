# Halo React frontend

A React + TypeScript + Vite dashboard consuming the existing Flask HTTP endpoints.

## Local development

In terminal 1:

```bash
cd halo_nat
python -m venv .venv
# Activate the environment (Windows: .venv\Scripts\activate)
pip install -r requirements.txt
python app.py
```

In terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to http://127.0.0.1:5000, so local development needs no extra CORS setup.

The React app uses `GET /api/events` and `GET /api/status` and polls every 3 seconds. The existing Flask page continues working on port 5000. The `POST /api/demo-alert` button is disabled by default. For a **local-only** demo, set `VITE_ENABLE_DEMO=true` in `frontend/.env.local` and restart Vite.

## Deploy to Vercel

1. Import GitHub repository `Halo-Safety/halo-safety`.
2. Set **Root Directory** to `frontend` (not `halo_nat`).
3. Framework: **Vite**. Build command: `npm run build`; output: `dist`.
4. Set `VITE_API_BASE_URL=https://YOUR-DEPLOYED-FLASK-BACKEND`.
5. Deploy.

**Important:** Vercel will deploy only the React UI. The Flask backend must run on an independently reachable HTTPS service for live data. A Flask server or Ollama running at `localhost` on a team laptop is not reachable by Vercel visitors.

For a browser frontend on another origin, set `HALO_ALLOWED_ORIGINS=https://YOUR-VERCEL-DOMAIN` on the Flask service (comma-separated list supported), and install `halo_nat/requirements.txt`. Do **not** put private API tokens in any `VITE_...` variables because Vite embeds them in public browser JavaScript.

The current Flask app uses SQLite and a local COM3 serial reader. Keep the serial reader on the local device/gateway, POST events to a remotely hosted authenticated API, and migrate SQLite to persistent PostgreSQL before relying on cloud storage. The existing `/api/demo-alert` and `/api/device-event` endpoints are not authenticated; protect them before exposing the backend publicly. The frontend currently counts proximity sensor alerts, not confirmed near-miss incidents.

## Build verification

```bash
cd frontend
npm install
npm run build
```

The older Flask template (`halo_nat/templates/index.html`) was intentionally left untouched so the old local demo remains available while the team reviews the migration.
