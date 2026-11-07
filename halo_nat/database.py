import sqlite3

DATABASE = "halo.db"

def initialize_database():
    """Initialize the database and create the necessary tables."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    # Create a sample table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            worker_id TEXT NOT NULL,
            machine_id TEXTNOT NULL,
            rssi INTEGER,
            event_type TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()

def add_event(worker_id, machine_id, rssi, event_type):
    """Add a new event to the database."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO events (worker_id, machine_id, rssi, event_type)
        VALUES (?, ?, ?, ?)
    ''', (worker_id, machine_id, rssi, event_type))

    conn.commit()
    conn.close()

def get_events():
    """Retrieve all events from the database."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row  # This allows us to access columns by name
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM events')
    events = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return events