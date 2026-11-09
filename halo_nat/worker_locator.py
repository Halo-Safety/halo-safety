import math
import re
import time
from itertools import product
from threading import Lock

import serial
from flask import Blueprint, jsonify, render_template, request

locator = Blueprint("locator", __name__)
ANCHORS = ("HaloFront", "HaloRearL", "HaloRearR")
_distance = re.compile(rb"Estimated Distance\s*-\s*(\d+(?:\.\d+)?)\s+meters")
_lock = Lock()
_snapshot = {"status": "No worker serial port configured.", "ranges": None, "time": None}


def publish(status, ranges=None, measured_at=None):
    with _lock:
        _snapshot.update(status=status, ranges=ranges, time=measured_at)


def get_uplink_snapshot():
    """Return an atomic view of the latest ranging result for the cloud thread."""
    with _lock:
        return _snapshot.copy()


def read_prompt(port, timeout):
    deadline = time.monotonic() + timeout
    output = bytearray()
    while time.monotonic() < deadline:
        output.extend(port.read(min(4096, port.in_waiting or 1)))
        if b"ftm>" in output:
            return bytes(output)
        if len(output) > 65536:
            break
    raise TimeoutError("No FTM prompt from worker. Check its firmware and port.")


def open_worker_port(port_name):
    """Configure DTR/RTS before opening the ESP32 serial port.

    A Serial(port=None) instance must be opened before entering its context
    manager: Serial.__enter__ opens it immediately and otherwise raises when
    port is still None.
    """
    port = serial.Serial(baudrate=115200, timeout=0.25, write_timeout=2, port=None)
    port.port = port_name
    port.dtr = False
    port.rts = False
    port.open()
    return port


def poll_ftm(port_name):
    while True:
        try:
            publish(f"Connecting to {port_name}…")
            with open_worker_port(port_name) as port:
                port.reset_input_buffer()
                port.write(b"\r")
                read_prompt(port, 10)
                while True:
                    started = time.monotonic()
                    ranges = {}
                    for anchor in ANCHORS:
                        port.write(f"ftm -I -s {anchor}\r".encode("ascii"))
                        response = read_prompt(port, 15)
                        match = _distance.search(response)
                        ranges[anchor] = float(match[1]) if match else None
                    publish(f"Worker connected on {port_name}", ranges, started)
        except (serial.SerialException, OSError, TimeoutError) as error:
            publish(str(error))
            time.sleep(2)


def trilaterate(positions, ranges):
    (x0, y0), (x1, y1), (x2, y2) = positions
    r0, r1, r2 = ranges
    a, b, c, d = x1 - x0, y1 - y0, x2 - x0, y2 - y0
    determinant = a * d - b * c
    scale = max(math.hypot(a, b), math.hypot(c, d))
    if not scale or abs(determinant) < 1e-6 * scale**2:
        raise ValueError("Place three distinct anchors in a triangle.")
    u = ((r0 - r1) * (r0 + r1) + a*a + b*b) / 2
    v = ((r0 - r2) * (r0 + r2) + c*c + d*d) / 2
    return x0 + (d*u - b*v) / determinant, y0 + (a*v - c*u) / determinant


def estimate(positions, ranges, error):
    x, y = trilaterate(positions, ranges)
    residual = max(abs(math.hypot(x-ax, y-ay) - distance)
                   for (ax, ay), distance in zip(positions, ranges))
    # Stress-test the geometry with plausible simultaneous range errors.
    # This is a sensitivity check, not a statistical confidence interval.
    spread = 0.0
    for signs in product((-1, 1), repeat=3):
        shifted = [max(0, distance + sign*error) for distance, sign in zip(ranges, signs)]
        px, py = trilaterate(positions, shifted)
        spread = max(spread, math.hypot(px-x, py-y))
    return {"x": x, "y": y, "residual": residual, "spread": spread,
            "reliable": residual <= error and spread <= 0.5}


def number(value, minimum, maximum):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not minimum <= value <= maximum:
        raise ValueError("Enter finite distances and coordinates within the displayed limits.")
    return float(value)


@locator.get("/locator")
def locator_page():
    return render_template("locator.html", anchors=ANCHORS)


@locator.get("/api/locator/ranges")
def locator_ranges():
    with _lock:
        snapshot = _snapshot.copy()
    age = time.monotonic() - snapshot["time"] if snapshot["time"] is not None else None
    snapshot["age_seconds"] = age
    if age is not None and age > 30:
        snapshot.update(ranges=None, status="Waiting for a fresh set of ranges.")
    snapshot.pop("time")
    return jsonify(snapshot)


@locator.post("/api/locator/estimate")
def locator_estimate():
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict) or not isinstance(data.get("anchors"), list) or len(data["anchors"]) != 3:
            raise ValueError("Three anchors are required.")
        positions = []
        ranges = []
        for anchor in data["anchors"]:
            positions.append((number(anchor["x"], -100, 100), number(anchor["y"], -100, 100)))
            raw = number(anchor["range"], 0, 1000)
            bias = number(anchor["bias"], -100, 100)
            ranges.append(number(raw - bias, 0, 1100))
        return jsonify(estimate(positions, ranges, number(data.get("error"), 0.001, 10)))
    except (KeyError, TypeError, ValueError) as error:
        return jsonify(error=str(error)), 400
