import serial
import json
from database import add_event

def start_serial_reader(socketio, port, baudrate=115200):
    connection = serial.Serial(
        port,
        baudrate,
        timeout=1
    )

    print(f"Connected to ESP32 on {port}")
    while True:
        try:
            line = connection.readline().decode("utf-8").strip()
            if not line:
                continue
            data = json.loads(line)

            if data.get("event") == "PROXIMITY_ALERT":
                add_event(
                    data["worker_id"],
                    data["machine_id"],
                    data.get("rssi"),
                    data["event"]
                )

                socketio.emit("new_alert", data)

        except json.JSONDecodeError:
            print("Received invalid JSON data")
        except Exception as error:
            print(f"Serial error: {error}")
            break