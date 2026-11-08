import os
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO
from threading import Thread

from database import (
    initialize_database,
    get_events,
    add_event
)

from serial_reader import start_serial_reader
from worker_locator import locator, poll_ftm
app = Flask(__name__)
app.register_blueprint(locator)
app.config["SECRET_KEY"] = os.getenv("HALO_SECRET_KEY", "halo_demo_key")

# Allow the Vite development server and an explicitly configured hosted React origin.
allowed_origins = [origin.strip() for origin in os.getenv(
    "HALO_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5000,http://127.0.0.1:5000"
).split(",") if origin.strip()]
CORS(app, resources={r"/api/*": {"origins": allowed_origins}})
socketio = SocketIO(app, cors_allowed_origins=allowed_origins)


def _require_text(data, field):
    value = data.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"'{field}' must be a non-empty string")
    return value


def process_device_event(data):
    event_type = _require_text(data, "event")

    if event_type in {"PROXIMITY_ALERT", "ALERT_CLEAR"}:
        worker_id = _require_text(data, "worker_id")
        machine_id = _require_text(data, "machine_id")
        rssi = data.get("rssi")
        if rssi is not None and (isinstance(rssi, bool) or not isinstance(rssi, int)):
            raise ValueError("'rssi' must be an integer")

        add_event(worker_id, machine_id, rssi, event_type)
        socketio.emit("new_alert" if event_type == "PROXIMITY_ALERT" else "alert_clear", data)
    elif event_type == "HEARTBEAT":
        if "device_id" in data:
            _require_text(data, "device_id")
            _require_text(data, "device_type")
        else:
            _require_text(data, "worker_id")
            _require_text(data, "machine_id")
    elif event_type == "DEVICE_DISCONNECT":
        _require_text(data, "device_id")
        _require_text(data, "device_type")
    else:
        raise ValueError(f"Unsupported event type: {event_type}")


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/events")
def events():
    return jsonify(get_events())


@app.route("/api/status")
def status():
    return jsonify({"dashboard": "online", "machine": "port_configured" if os.getenv("HALO_SERIAL_PORT") else "not_configured"})


@app.route("/api/demo-alert", methods=["POST"])
def demo_alert():
    data = {
        "event": "PROXIMITY_ALERT",
        "worker_id": "WORKER_01",
        "machine_id": "MACHINE_01",
        "rssi": -55
    }
    process_device_event(data)
    return jsonify({"success": True, "message": "Demo alert generated"})


@app.route("/api/device-event", methods=["POST"])
def device_event():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"success": False, "message": "Request body must be a JSON object"}), 400

    try:
        process_device_event(data)
    except ValueError as error:
        return jsonify({"success": False, "message": str(error)}), 400

    return jsonify({"success": True, "message": f"{data['event']} processed"})


def main():
    initialize_database()
    # Serial is OFF by default. To enable it later:
    #   $env:HALO_SERIAL_PORT = "COM3"
    # Do not require an ESP32 to serve the web API.
    serial_port = os.getenv("HALO_SERIAL_PORT", "").strip()
    ftm_port = os.getenv("HALO_FTM_PORT", "").strip()
    if ftm_port:
        Thread(target=poll_ftm, args=(ftm_port,), daemon=True).start()
    if serial_port and serial_port.casefold() != ftm_port.casefold():
        Thread(target=start_serial_reader, args=(socketio, serial_port), daemon=True).start()
    socketio.run(app, host="127.0.0.1", port=5000, debug=False)


if __name__ == "__main__":
    main()
