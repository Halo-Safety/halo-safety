# Halo — ESP32 FTM to Supabase to Dashboard

The **local gateway** is `halo_nat/app.py` plus `halo_nat/worker_locator.py`.
It runs on **any** computer connected to the *worker* ESP32 via USB.
`halo_nat/cloud_gateway.py` sends new FTM ranges to a dedicated Supabase
Edge Function. Vercel does not connect to USB devices.

```
3 FTM anchors on vehicle ))) worker ESP32 --USB--> laptop (Python)
  --HTTPS + scoped gateway token--> Supabase ingest-ftm Edge Function
  --> organization-protected ftm_measurements table
  --> halo-safety.vercel.app/#hardware
```

## Setup on the laptop attached to the worker ESP32

1. Flash the ESP-IDF role firmware as described in
   [ftm_example_official/README.md](../ftm_example_official/README.md).
   Confirm `scan` and `ftm -I -s HaloFront` (and each rear anchor) work
   on the worker ESP32 over serial.
2. Install Python packages from `halo_nat/requirements.txt`.
3. Ask the Halo administrator for a **gateway-only token** associated with
   the correct organization, vehicle and worker. Do not use a browser
   publishable key, a Supabase database password, or a service-role key.
4. In Windows PowerShell (replace the placeholders):

```powershell
cd halo_nat
python -m pip install -r requirements.txt
$env:HALO_FTM_PORT = "COM3" # COM port of WORKER ESP32, not vehicle anchor
$env:HALO_SUPABASE_URL = "https://cvbwqlguuxygwwgktvdp.supabase.co"
$env:HALO_GATEWAY_TOKEN = "<private gateway-only token supplied separately>"
python app.py
```

5. Open `http://127.0.0.1:5000/locator` to see local readings and
   [Halo Hardware](https://halo-safety.vercel.app/#hardware) (after login)
   to see cloud readings. The Hardware tab polls every five seconds; an
   upload within the past 30 seconds is marked "Reporting". A stale
   record is not proof that a worker is safe or that a device is healthy.

**Optional, experimental position estimates:** Only after measuring the
three antennas' physical XY positions **in metres**, relative to the same
vehicle reference frame, set:

```powershell
$env:HALO_FTM_ANCHORS_JSON = '[[0,1.5],[-0.8,-0.5],[0.8,-0.5]]'
$env:HALO_FTM_RANGE_ERROR_M = "0.3"
```

These coordinates are just a **format example, not measurements of your
machine**. If this setting is absent, the gateway uploads **raw ranges only**
and the browser does not invent a position. Even when the fit appears
self-consistent it is **not a validated accuracy guarantee**.

## Shared 2D map and antenna layout

The **Hardware** tab now includes a live vehicle-relative 2D map. An
organization `admin` or `manager` can select a vehicle, enter the
**measured** coordinates of `HaloFront`, `HaloRearL`, and `HaloRearR`
in **metres**, and save them to `public.ftm_anchor_layouts`. A `viewer`
may view the layout, but cannot edit it. Layouts are persisted **per
vehicle** (never per browser) and protected by organization RLS.

Choose a physical reference point on the vehicle for (0,0).
Positive X points right; positive Y points forward. The positions of all
three antennas must be measured **from that same reference point**. The
three anchors must form a non-collinear triangle; positions are never
made up by the app. The map renders anchor dots even when there are no
live samples. A worker estimate requires valid FTM distances to **all
three** anchors.

The site subtracts the optional per-anchor `bias` in metres and
calculates a 2D position from the three corrected distances using the
same linearized trilateration algorithm as the local Flask locator.
The displayed residual measures the inconsistency of the three ranges;
the ±range sensitivity uses an **assumed** error for a rough geometry
test, **not** a measured confidence interval. Rough/unstable estimates
are marked as such. Readings older than 30 seconds are explicitly
marked stale. Nothing in this visualization is safety-certified.

**No laptop geometry configuration is required for the cloud map.**
The gateway continues uploading raw ranges, and the React map derives
the position from the Supabase-stored layout. The optional
`HALO_FTM_ANCHORS_JSON` environment variable still controls **local
Python-generated** coordinates only; it does not synchronize the local
Flask page's coordinates with the saved cloud layout.

The layout schema is installed using
`supabase/migrations/20261109_ftm_anchor_layouts.sql`. Its permissions
are `SELECT` for organization members and `INSERT/UPDATE` for admins
and managers. No browser writes to raw FTM measurement tables.
Changing a vehicle layout only changes how stored ranges are
visualized; it never modifies recorded samples or creates incident cases.

## API and data isolation

- The local sender posts JSON measurements to
  `/functions/v1/ingest-ftm` with `x-halo-gateway-key`.
- The Edge Function authenticates a SHA-256 hash of the high-entropy token
  stored server-side in `ftm_gateways`. Organization, vehicle and worker
  are assigned by the server, never trusted from the laptop payload.
- The `ftm_measurements` table allows organization members to SELECT
  with RLS. Browsers have **no direct INSERT/UPDATE/DELETE** permission.
- Every sample has a unique UUID. Retries are idempotent. The endpoint
  limits uploads to 60 per minute per gateway. Old/stale samples are not
  treated as live. Access can be revoked by setting `enabled=false`.
- Measurements are **not** inserted into `sensor_events` or `safety_cases`.
  The existing incident dashboard and corrective action counts remain
  separate until detection and human review logic is implemented.
- Data is collected when the gateway PC, serial hardware and internet
  are online. There is no offline queue and no automatic incident creation.
- This first release stores experimental samples without automated
  retention. Before continuous production use, implement retention limits,
  audit trails, validated calibration and device-health monitoring.

## Administrator provisioning

1. Apply `supabase/migrations/20261108_ftm_uplink.sql`.
2. Create a **high-entropy random 32+ byte token** using a secure random
   generator and compute its lowercase SHA-256 hex digest.
3. Insert a row into `public.ftm_gateways` with its
   `organization_id`, `vehicle_id`, `worker_ref`,
   `token_sha256`, and `is_demo` values. Only the **hash** is stored
   in the database; the plain token must be passed to the gateway operator
   over a private channel.
4. Deploy `supabase/functions/ingest-ftm/index.ts` as
   `ingest-ftm` with `verify_jwt = false` because the function itself
   authenticates the gateway token before allowing data access.
5. On revocation, rotate the gateway token or set `enabled=false`.
   Never commit plaintext tokens or local environment values to GitHub.

### Quick sanity checks

A POST without the gateway header must return HTTP **401**. With the
authorized gateway key and a valid, fresh payload, the response should be
HTTP **202**. A repeated UUID should not create a second reading. Other
organization users must not see the samples due to RLS.

Payload example (values **illustrative**):

```json
{
  "sample_id": "31573e8f-7680-431e-8eca-a474567a91a5",
  "measured_at": "2026-11-08T23:00:00Z",
  "front_m": 2.2,
  "rear_left_m": 2.5,
  "rear_right_m": 2.8
}
```

For a real POST, `measured_at` must be no more than five minutes from the
server time. This example timestamp will become invalid.
