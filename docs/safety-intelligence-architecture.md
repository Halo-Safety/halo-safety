# Halo Safety Intelligence — proposed architecture

Status: **design proposal + browser-only demonstration**, not a deployed production incident-management system.

## Product goal

Answer operational questions that matter to a safety manager:
- Which vehicle and work zone repeatedly produce high-risk encounters, on which shift?
- Who operated the vehicle **at the time** of a case, and who owns or leases it?
- Which alerts represent the same encounter, which were dismissed as noise, and which have been reviewed?
- What corrective action has an accountable owner and due date?
- Did the risk rate change **per unit of operating exposure** after the action, and was detection coverage comparable?

A warning does **not** automatically become a verified near miss. An equipment fault is not a clear/safe state.

## Proposed data flow

```text
ESP32 / UWB / camera API / manual report / CSV import
    -> authenticated ingestion and adapter per source
    -> immutable observations (source, timestamps, raw payload hash)
    -> deduplication + time/vehicle/worker clustering
    -> encounters (start, clear, duration, missing-data flags)
    -> triage queue
    -> case (candidate / reviewed near miss / false alarm / device fault)
    -> human evidence and findings
    -> corrective action (owner, due date, status, verification)
    -> normalized trend and intervention follow-up
```

### Relational model to migrate into Supabase

Every operational table has an `organization_id`, with RLS restricting the user to their organization. Do **not** rely on a browser-supplied organization ID to authorize device events.

- `sites`: company/site identifier, timezone.
- `zones`: site ID, zone name, hazard type and polygon/plan reference (if available).
- `vehicles`: asset UUID, asset tag, type, model, owner organization/contractor, ownership kind, assigned sensor IDs, active status.
- `operators`: minimal internal operator reference; avoid unnecessary personal identifiers.
- `vehicle_assignments`: asset, operator, shift, start/end timestamps. Preserve **operator-at-event** in the case snapshot, not just the current assigned operator.
- `sensor_sources`: vendor, source type, external device ID, assigned vehicle, health and last-seen.
- `raw_observations`: immutable source timestamp, receipt timestamp, source-event ID, event type, measured fields and units, raw payload or hash, quality flags. Unique key `(organization_id, sensor_source_id, external_event_id)` where provider supports IDs.
- `encounters`: clustered observations for a worker/vehicle/zone/time window, start/end, number of observations, dedupe/reason flags.
- `cases`: site, vehicle, encounter, human classification, potential severity, review status, narrative, reporter/reviewer and evidence coverage. Allow a case without a sensor encounter for manual reports.
- `case_evidence`: immutable references to observations, documents or externally stored photos, provenance and collection time.
- `corrective_actions`: case, assigned role/person, deadline, status, completion proof and verification outcome.
- `exposure_periods`: per vehicle, start/end, **measured** operating hours and device coverage/uptime; denominator source and gaps.
- `audit_log`: changes to case classification, findings and action verification, with actor and timestamp.

Use server-side ingest (Edge Function or separate service) with rate limits, device credentials, replay protection, schema validation, and explicit mapping between a trusted device and its organization. Normal users get RLS-scoped reads; manager/admin writes are subject to audit and appropriate policies.

## Analysis that is operationally useful

1. **Triage backlog:** candidate encounters awaiting review, severity and elapsed review time.
2. **Recurring hotspots:** cases by site/zone, machine, shift and time window. Show small-sample warnings.
3. **Device reliability:** hours offline, dropped heartbeats, percentage of observations rejected or dismissed as noise.
4. **Exposure-adjusted risk:** confirmed near-miss cases / 100 or 1,000 vehicle operating hours. This metric is not meaningful without trustworthy hours and comparable detection coverage.
5. **Action accountability:** open, overdue and verified-closed actions, owner and due dates.
6. **Intervention follow-up:** before/after event rates using matched time windows and operating exposure; describe confounders and avoid unearned causal claims.

Use counts labeled by classification and source. Never merge sandbox/test data into production incident statistics.

## AI assistance — later

AI can draft a case chronology, summarize the evidence, highlight conflicting observations and propose investigation questions. Require citations to stored observation IDs and human approval. It must not fabricate root causes, determine worker blame, or autonomously declare an event a confirmed near miss.

## Demo implementation in this PR

The signed-in `test@ualberta.ca` account sees **six fictional cases and five fictional vehicles** in the new Cases/Vehicles views. All sample records live in `frontend/src/demoSafetyData.ts`, never in Supabase. They cover reviewed near misses, an unreviewed candidate, a false alarm and a device outage. One sample includes before/after rates per 100 vehicle-hours to illustrate the right denominator.

Other accounts see empty module placeholders. The existing real event charts and Supabase data remain unchanged. This is a **front-end proof of concept**, not seeded cloud data; a dedicated demo organization and explicit migrations should replace the static fixtures when the data model is approved.
