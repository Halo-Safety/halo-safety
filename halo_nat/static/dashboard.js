const socket = io();
const eventTable = document.getElementById('event-table');
const activeAlerts = document.getElementById('active-alerts');

function addEventToTable(event) {
    const row = document.createElement('tr');
    const values = [
        event.worker_id,
        event.machine_id,
        event.rssi ?? "N/A",
        event.event,
        event.timestamp ?? new Date().toLocaleTimeString()
    ];

    values.forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
    });
    eventTable.prepend(row);
}

// Receive historical events when page loads
fetch("/api/events")
    .then(response => response.json())
    .then(events => {
        events.forEach(addEventToTable);
    });

// Listen for new events from Flask
socket.on("new_alert", event => {
    addEventToTable(event);
    activeAlerts.textContent = '${event.worker_id} detected near ${event.machine_id}';
    
});