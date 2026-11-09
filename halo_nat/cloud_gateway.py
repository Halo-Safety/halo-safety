"""Optional local USB/FTM -> Supabase Edge Function bridge.

Runs on the computer connected to the worker ESP32. It cannot assign its
own organization or machine ID; the server binds every gateway token to a
specific organization, vehicle and worker tag. Never store service_role here.
"""
import json
import logging
import math
import os
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests

from worker_locator import ANCHORS, estimate, get_uplink_snapshot

log = logging.getLogger("halo.ftm_uplink")


def _parse_geometry(value):
    if not value:
        return None
    try:
        points = json.loads(value)
        if len(points) != 3:
            raise ValueError("Expected three anchors.")
        parsed = [(float(p[0]), float(p[1])) for p in points]
        if any(len(p) != 2 or any(not math.isfinite(v) or abs(v) > 100 for v in p)
               for p in parsed):
            raise ValueError("Coordinates must be finite X/Y pairs in metres.")
        return parsed
    except (ValueError, TypeError, IndexError) as exc:
        raise ValueError("Invalid HALO_FTM_ANCHORS_JSON. Use [[x,y],[x,y],[x,y]].") from exc


def _range(raw):
    if raw is None:
        return None
    if isinstance(raw, bool) or not isinstance(raw, (float, int)) or not math.isfinite(raw):
        return None
    return round(float(raw), 3) if 0 <= raw <= 1000 else None


def build_payload(snapshot, positions=None, error_m=0.3):
    """Turn the existing serial poll into a single record; no fake measurements."""
    ranges = snapshot.get("ranges")
    if not isinstance(ranges, dict):
        return None
    values = [_range(ranges.get(key)) for key in ANCHORS]
    if all(v is None for v in values):
        return None
    payload = {
        "sample_id": str(uuid.uuid4()),
        "measured_at": datetime.now(timezone.utc).isoformat(),
        "front_m": values[0],
        "rear_left_m": values[1],
        "rear_right_m": values[2],
    }
    if positions is not None and all(v is not None for v in values):
        try:
            result = estimate(positions, values, error_m)
            if all(math.isfinite(result[key]) for key in ("x", "y", "residual", "spread")):
                payload.update(
                    x_m=round(result["x"], 3),
                    y_m=round(result["y"], 3),
                    residual_m=round(result["residual"], 3),
                    spread_m=round(result["spread"], 3),
                    reliable=bool(result["reliable"]),
                )
        except (ValueError, OverflowError, ZeroDivisionError):
            # Keep the raw ranges; an unstable geometry must not generate a
            # made-up position or prevent telemetry from reaching the cloud.
            log.warning("Cannot estimate position from configured anchors.")
    return payload


def _endpoint(base):
    parsed = urlparse(base.strip())
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("HALO_SUPABASE_URL must be an HTTPS project URL.")
    return parsed.scheme + "://" + parsed.netloc + "/functions/v1/ingest-ftm"


def run_cloud_gateway():
    base = os.getenv("HALO_SUPABASE_URL", "").strip()
    token = os.getenv("HALO_GATEWAY_TOKEN", "").strip()
    if not base or not token:
        log.info("Cloud upload disabled. Set HALO_SUPABASE_URL and HALO_GATEWAY_TOKEN.")
        return
    try:
        endpoint = _endpoint(base)
        geometry = _parse_geometry(os.getenv("HALO_FTM_ANCHORS_JSON", ""))
        error_m = float(os.getenv("HALO_FTM_RANGE_ERROR_M", "0.3"))
        if not math.isfinite(error_m) or not 0.001 <= error_m <= 10:
            raise ValueError("HALO_FTM_RANGE_ERROR_M must be between 0.001 and 10.")
    except ValueError as exc:
        log.error("Cloud configuration invalid: %s", exc)
        return

    log.info("FTM cloud uplink enabled (no secret shown in logs).")
    seen_at = None
    session = requests.Session()
    while True:
        snapshot = get_uplink_snapshot()
        measured_at = snapshot.get("time")
        if measured_at is None or measured_at == seen_at:
            time.sleep(0.5)
            continue
        seen_at = measured_at
        if time.monotonic() - measured_at > 30:
            continue
        payload = build_payload(snapshot, geometry, error_m)
        if payload is None:
            continue

        # Best-effort live telemetry: at most three retries, capped per poll.
        # No indefinite blocking of serial collection and no unsafe storage
        # of credentials or queued measurements on disk.
        for attempt in range(3):
            try:
                response = session.post(
                    endpoint,
                    json=payload,
                    headers={"x-halo-gateway-key": token},
                    timeout=5,
                )
                if response.status_code in (200, 202):
                    log.info("FTM measurement uploaded.")
                    break
                if response.status_code in (400, 401, 403):
                    log.error("FTM upload rejected (%s). Verify gateway provisioning.", response.status_code)
                    break
                log.warning("FTM cloud status %s; retrying.", response.status_code)
            except requests.RequestException:
                log.warning("FTM cloud unavailable; retrying.")
            if attempt < 2:
                time.sleep(1 + attempt)
        else:
            log.warning("Dropped one FTM sample after retries.")
