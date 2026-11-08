# Halo — React dashboard and Vercel deployment

Halo's React + TypeScript + Vite frontend is in `frontend/`. The original Flask backend remains under `halo_nat/`.

## Deploy a stand-alone demo to Vercel

The production build automatically enters **Demo Mode** if `VITE_API_BASE_URL` is unset. Demo Mode contains clearly labelled, simulated sample events, a 7-day chart, current simulated alerts, and an interactive **Generate demo alert** button.

Demo events live in the **visitor's own browser localStorage**. They are not shared across users, are not real sensor data, and are not stored in a production database.

1. Open [Vercel New Project](https://vercel.com/new) and import `Halo-Safety/halo-safety` from GitHub.
2. Choose **Root Directory = `frontend`**.
3. Use the **Vite** framework preset, **Build Command = `npm run build`**, **Output Directory = `dist`**.
4. **Do not set `VITE_API_BASE_URL`** until you deploy a real backend. `VITE_DEMO_MODE=true` explicitly forces demo mode if desired.
5. Deploy. Then in Vercel Project Settings → Environments → Production → Branch Tracking, set `rus1an` as the production branch if you want production to follow `rus1an` rather than the repository default `main`. Alternatively, use the branch's Preview Deployment without changing the production branch.

## Local development — no Flask, no ESP32

In PowerShell:

```powershell
cd frontend
npm install
$env:VITE_DEMO_MODE="true"
npm run dev
```

Open http://localhost:5173. To switch back to the Flask API in a new terminal, remove the demo override with `Remove-Item Env:VITE_DEMO_MODE -ErrorAction SilentlyContinue` before starting Vite.

## Local development — Flask API

In terminal 1:

```powershell
cd halo_nat
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

The server now starts **without COM3**. The serial gateway is optional:

```powershell
$env:HALO_SERIAL_PORT="COM3"
python app.py
```

In terminal 2:

```powershell
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:5000`. If `VITE_DEMO_MODE` is not set, React calls the real local Flask API.

## Cloud backend — later phase

For multi-user real incidents, deploy the authenticated Flask API separately, replace local SQLite with persistent hosted Postgres, and set `VITE_API_BASE_URL=https://your-backend.example.com` in Vercel. Configure Flask's `HALO_ALLOWED_ORIGINS` to include the Vercel site origin.

Do not expose the existing unauthenticated Flask `POST /api/demo-alert` or `POST /api/device-event` endpoints on the public internet.

A USB ESP32 connected to a team laptop (or a local Ollama server) will **not** be accessible to Vercel automatically. A local gateway can eventually forward event records to the authenticated cloud API.

## Verify build

```powershell
cd frontend
npm install
npm run build
```

The earlier Flask HTML template is preserved while the team transitions to React.
