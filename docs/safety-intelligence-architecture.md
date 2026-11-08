# Halo Safety Intelligence — proposed architecture

Status: **partially implemented**. Manual vehicle, case and action persistence is in the PR; raw observations, automatic encounter generation and verified analysis remain a design proposal.

## Product goal

Answer operational questions that matter to a safety manager:
- Which vehicle and work zone repeatedly produce high-risk encounters, on which shift?
- Who operated the vehicle **at the time** of a case, and who owns or leases it?
- Which alerts represent the same encounter, which were dismissed as noise, and which have been reviewed?
- What corrective action has an accountable owner and due date?
- Did the risk rate change **per unit of operating exposure** after the action, and was detection coverage comparable?

A warning does **not** automatically become a verified near miss. An equipment fault is not a clear/safe state.

## Current implementation: persistence layer (same PR)

This proposal now has a first manually managed Supabase implementation:

- SQL migration: [supabase/migrations/20261108_safety_workflows.sql](../supabase/migrations/20261108_safety_workflows.sql)
- Frontend adapter: [frontend/src/safetyApi.ts](../frontend/src/safetyApi.ts)
- Editable organization UI: [frontend/src/SafetyRecords.tsx](../frontend/src/SafetyRecords.tsx)
- Separate original fictional walkthrough: [frontend/src/demoSafetyData.ts](../frontend/src/demoSafetyData.ts)

**Apply this migration in the existing Supabase project's SQL Editor** after the original \`supabase/schema.sql\`:

\`\`\`sql
-- Run the contents of supabase/migrations/20261108_safety_workflows.sql.
-- Do not rerun the initial schema if it has already been applied.
\`\`\`

1. The signed-in user must already have an \`organization_members\` row in an organization.
2. Members with \`admin\` or \`manager\` roles can create and edit vehicles, cases and actions. Members with \`viewer\` can only read them. New tables have organization-scoped row-level security, cross-organization foreign keys and no authenticated DELETE permissions.
3. In Halo, open **Cases** or **Vehicles**. The test login sees a toggle between the **fictional walkthrough** (unchanged, in browser memory) and **Organization records (Supabase)**. Other accounts see the organization-backed records by default.
4. Create a vehicle, create a case linked to it, assign a corrective action, then refresh or sign in again to confirm persistence. An invited user without organization membership cannot access organization records.
5. All saved rows are entered and reviewed by users. No automatic ingestion or grouping from ESP32/sensor_events has been implemented. Mark genuinely fictional manually entered records as \`is_demo=true\`. The UI includes a visible demo label.
6. Do **not** seed fictitious incidents into a production organization's real event tables; prefer a dedicated testing organization with separate users and explicit labeling.

The app will show a database schema error if the migration has not yet been applied. Production Vercel environment variables and deployed Supabase auth still need to be configured independently. **No migration is run automatically when merging this PR.**

### Implementation boundaries

This iteration has manually entered vehicle operating hours and device status, not verified telemetry. \`operator_ref\` is currently the assigned operator on the vehicle; the case separately stores \`operator_at_event\` to preserve historical context. The case's grouped \`observation_count\` is manually entered, not derived from a clustering service. There is no auto-refresh of these new management records: use the Refresh control after changes made in another session.

A future ingestion service should add immutable raw observations, encounter clustering, case evidence references and an audit trail, then connect these to the workflow tables. Any real deployment should review PII retention and organizational privacy/access policies before recording named individuals.

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

The signed-in `test@ualberta.ca` account sees **six fictional cases and five fictional vehicles** through the explicitly labeled sample-data mode. They live in `frontend/src/demoSafetyData.ts`, never in Supabase. The persistent organization-data mode offers manually managed records and editable corrective actions.

Other accounts see the real organization-data module instead of fixtures. The existing sensor-event charts and Supabase incident records remain unchanged. This is a workflow prototype with real saved records, **not** automatic safety detection or analytics; the fictional test walkthrough remains isolated.
