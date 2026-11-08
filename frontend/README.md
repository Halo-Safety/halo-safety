# Halo frontend

React + Vite web application for proximity safety events, equipment activity, and scenario simulation.

## Run locally

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
# Fill in the Supabase project URL and publishable (browser-safe) key.
npm run dev
```

The app does not create fake incidents or allow bypassing sign-in.

## Auth and database

**Required:** Supabase Auth + Postgres with Row Level Security.

See [AUTH_SETUP.md](./AUTH_SETUP.md) for:
- Creating users and configuring password reset
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- SQL schema `../supabase/schema.sql`
- Organization membership and row-level access control
- Configuring the Vercel deployment

Account creation is administrator/invitation managed (no open sign-up UI). After deployment, email/password sign-in, sign-out, and password recovery use Supabase Auth. Without valid environment variables, sign-in remains unavailable.

**Data ingestion:** `sensor_events` reads are protected by Supabase RLS. Ingestion from ESP32 hardware is not implemented on Vercel yet. The old local Flask routes are not secured merely by adding this sign-in page: don't expose them publicly without server-side authorization.

## UI

A light login card sits beside the Halo brand on a turquoise-to-blue geometric SVG. The original irregular mesh is generated once at mount as inline SVG. A slow CSS transform moves the whole field, while a small subset of translucent polygons responds to pointer proximity using requestAnimationFrame only when the pointer moves. No Canvas or continuous JS render loop.

The geometric background is mounted only on the sign-in and password-recovery screens. After sign-in, the Dashboard and embedded Simulation use a fixed solid light background with no decorative animation or motion toggle. The simulator remains the teammate's original standalone iframe, and simulator animations are not stored as real safety incidents.

## Verify build

```powershell
npm run build
```


## Integrated scenario lab (browser-only)

The Simulation page now uses the same light visual system as the rest of Halo. The original worker/vehicle geometry, routes, speed controls, blind-zone editing, and warning logic remain in `public/simulator/`. The embedded iframe is kept mounted while switching between Overview and Simulation, so scenarios are not reset simply by navigating.

On a warning transition, the simulator sends a same-origin `postMessage` to the parent. The parent validates the message origin and exact iframe window, then adds one `PROXIMITY_ALERT` or `ALERT_CLEAR` to an **in-memory sandbox timeline**. A separate Simulation activity panel appears on Overview. The iframe reports its content height, removing the previous hard-coded scrolling region.

**Isolation:** sandbox events are neither written to Supabase nor counted as recorded sensor signals or active production warnings. They are cleared on browser reload and must never be presented as actual incidents. Device ingestion remains future work.
