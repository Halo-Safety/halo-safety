import time
import requests

API_URL = "http://127.0.0.1:5000/api/device-event"

def send_event(event_data):
    try:
        response = requests.post(API_URL, json=event_data, timeout=5)
        response.raise_for_status()
        print(f"[SENT] {event_data['event']}") 
        print(f"[RESPONSE] {response.json()}")
    except requests.RequestException as e:
        print(f"[ERROR] Could not send event: {e}")

def simulate_heartbeat():
    devices = [
        {
            "event": "HEARTBEAT", "worker_id": "WORKER_02", "machine_id": "MACHINE_01"
        },
        {
            "event": "HEARTBEAT", "device_id": "FORKLIFT_01", "device_type": "MACHINE"
        }
    ]

    for device in devices:
        send_event(device)

def simulate_approach():
    print("\nWorker approaching machine...\n")
    # Step 1: Both devices are online
    simulate_heartbeat()
    time.sleep(2)
    # Step 2: Worker enters danger zone
    alert = {
        "event": "PROXIMITY_ALERT",
        "worker_id": "WORKER_02",
        "machine_id": "FORKLIFT_01",
        "rssi": -40,
        "zone": "FRONT_RIGHT"
    }
    send_event(alert)
    time.sleep(5)

    # Step 3: Worker leaves the danger zone
    clear = {
        "event": "ALERT_CLEAR",
        "worker_id": "WORKER_02",
        "machine_id": "FORKLIFT_01",
    }

    send_event(clear)

    print("\nSimulation complete. Worker has left the danger zone.\n")

def simulate_disconnect():
    """Simulate a device disconnecting."""

    print("\nSimulating device disconnect...\n")
    send_event({
        "event": "DEVICE_DISCONNECT",
        "device_id": "FORKLIFT_01",
        "device_type": "MACHINE"
    })

if __name__ == "__main__":
    print("==== HALO HARDWARE SIMULATOR ====")
    print("1. Simulate Worker Approaching Machine")
    print("2. Simulate Device Disconnect")
    print("3. Send device heartbeats")
    print("4. Exit")

    while True:
        choice = input("Select an option (1-4): ")
        if choice == "1":
            simulate_approach()
        elif choice == "2":
            simulate_disconnect()
        elif choice == "3":
            simulate_heartbeat()
        elif choice == "4":
            print("Exiting simulator.")
            break
        else:
            print("Invalid option. Please select 1, 2, 3, or 4.")