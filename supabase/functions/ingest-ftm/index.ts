import { createClient } from "npm:@supabase/supabase-js@2.75.0";

// External Python gateway uses a per-device random token in x-halo-gateway-key.
// The platform JWT check is disabled, but this handler MUST authenticate every
// request before touching any device data. Never use a browser publishable key
// or share the Supabase service-role key with the laptop.
const MAX_BYTES = 4096;
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function validNumber(value: unknown, min: number, max: number): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return undefined;
  return value;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function sha256(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async req => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const token = req.headers.get("x-halo-gateway-key") || "";
  if (token.length < 32 || token.length > 256 || !/^[A-Za-z0-9_-]+$/.test(token))
    return json({ error: "Unauthorized gateway" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Ingestion not configured" }, 503);
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const digest = await sha256(token);
  const { data: gateway, error: gatewayError } = await db.from("ftm_gateways")
    .select("id,organization_id,vehicle_id,worker_ref,enabled")
    .eq("token_sha256", digest).maybeSingle();
  if (gatewayError) return json({ error: "Gateway lookup unavailable" }, 503);
  if (!gateway || gateway.enabled !== true) return json({ error: "Unauthorized gateway" }, 401);

  let text = "";
  try {
    text = await req.text();
    if (text.length > MAX_BYTES) return json({ error: "Payload too large" }, 413);
  } catch { return json({ error: "Could not read payload" }, 400); }
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return json({ error: "Expected object" }, 400);
    data = parsed as Record<string, unknown>;
  } catch { return json({ error: "Invalid JSON" }, 400); }

  if (!isUuid(data.sample_id)) return json({ error: "Invalid sample_id" }, 400);
  const front = validNumber(data.front_m, 0, 1000);
  const left = validNumber(data.rear_left_m, 0, 1000);
  const right = validNumber(data.rear_right_m, 0, 1000);
  const x = validNumber(data.x_m, -1000, 1000);
  const y = validNumber(data.y_m, -1000, 1000);
  const residual = validNumber(data.residual_m, 0, 1000);
  const spread = validNumber(data.spread_m, 0, 1000);
  if ([front, left, right, x, y, residual, spread].some(value => value === undefined))
    return json({ error: "Invalid measurement" }, 400);
  if ([front, left, right].every(value => value === null))
    return json({ error: "No valid FTM ranges" }, 400);
  if ((x === null) !== (y === null))
    return json({ error: "Coordinates must be paired" }, 400);
  if ((x !== null || residual !== null || spread !== null) && [front, left, right].some(v => v === null))
    return json({ error: "Incomplete ranges for position estimate" }, 400);

  let measuredAt = new Date();
  if (typeof data.measured_at === "string") {
    const timestamp = new Date(data.measured_at);
    if (!Number.isFinite(timestamp.getTime())
      || Math.abs(Date.now() - timestamp.getTime()) > 300_000)
      return json({ error: "Measurement timestamp outside five-minute window" }, 400);
    measuredAt = timestamp;
  }
  const quality = [front, left, right].some(v => v === null)
    ? "partial" : x === null ? "ranges_only"
      : (typeof data.reliable === "boolean" && data.reliable) ? "self_consistent" : "rough_estimate";

  // Server assigns organization, vehicle and worker from the authenticated
  // gateway. No client-supplied tenant or vehicle IDs are trusted.
  const { data: already } = await db.from("ftm_measurements")
    .select("id").eq("gateway_id", gateway.id).eq("sample_id", data.sample_id).maybeSingle();
  if (already) return json({ ok: true, duplicate: true });
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error: countError } = await db.from("ftm_measurements")
    .select("id", { count: "exact", head: true })
    .eq("gateway_id", gateway.id).gte("received_at", since);
  if (countError) return json({ error: "Ingestion temporarily unavailable" }, 503);
  if ((count || 0) >= 60) return json({ error: "Gateway rate limit reached" }, 429);

  const { error } = await db.from("ftm_measurements").insert({
    organization_id: gateway.organization_id,
    gateway_id: gateway.id,
    vehicle_id: gateway.vehicle_id,
    worker_ref: gateway.worker_ref,
    sample_id: data.sample_id,
    measured_at: measuredAt.toISOString(),
    front_m: front, rear_left_m: left, rear_right_m: right,
    x_m: x, y_m: y, residual_m: residual, spread_m: spread,
    quality, is_demo: false,
  });
  if (error) {
    if (error.code === "23505") return json({ ok: true, duplicate: true });
    return json({ error: "Could not store measurement" }, 503);
  }

  await db.from("ftm_gateways").update({ last_received_at: new Date().toISOString() })
    .eq("id", gateway.id);
  return json({ ok: true, quality }, 202);
});
