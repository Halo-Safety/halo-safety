from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO
from threading import Thread

from database import (
    initialize_database,
    get_events,
    add_event
)

from serial_reader import start_serial_reader
app = Flask(__name__)
app.config["SECRET_KEY"] = "halo_demo_key"
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route("/")
def home():
    return render_template("index.html")
@app.route("/api/events")
def events():
    return jsonify(get_events())
@app.route("/api/status")
def status():
    return jsonify({"dashboard": "online", "machine": "connected"})
@app.route("/api/demo-alert", methods=["POST"])
def demo_alert():
    data = {
        "event": "PROXIMITY_ALERT",
        "worker_id": "WORKER_01",
        "machine_id": "MACHINE_01",
        "rssi": -55
    }
    add_event(
        data["worker_id"], data["machine_id"], data["rssi"], data["event"])
    socketio.emit("new_alert", data)
    return jsonify({"success": True, "message": "Demo alert generated"})

def main():
    initialize_database()
    # Change COM3 to the actual ESP32 serial port.
    Thread(target=start_serial_reader, args=(socketio, "COM3"), daemon=True).start()

    socketio.run(app, host="127.0.0.1", port=5000, debug=False)

if __name__ == "__main__":
    main()