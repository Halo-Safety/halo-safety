import type { SensorEvent } from './types';

/**
 * Purely illustrative feed for the invited test account.
 * Never written to Supabase or included in live alert counts / business KPIs.
 * Three alerts remain open; the excavator alert is followed by ALERT_CLEAR.
 */
const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

export const sampleSensorEvents: SensorEvent[] = [
  {
    id: -101, worker_id: 'WORKER-018', machine_id: 'LOADER-04',
    event_type: 'PROXIMITY_ALERT', rssi: -64, timestamp: minutesAgo(2),
    zone: 'West loading bay',
  },
  {
    id: -102, worker_id: 'WORKER-005', machine_id: 'FORKLIFT-12',
    event_type: 'PROXIMITY_ALERT', rssi: -70, timestamp: minutesAgo(5),
    zone: 'Warehouse aisle 7',
  },
  {
    id: -103, worker_id: 'WORKER-027', machine_id: 'TRUCK-07',
    event_type: 'PROXIMITY_ALERT', rssi: -68, timestamp: minutesAgo(8),
    zone: 'West laydown gate',
  },
  {
    id: -104, worker_id: 'WORKER-031', machine_id: 'EXCAVATOR-03',
    event_type: 'ALERT_CLEAR', rssi: -85, timestamp: minutesAgo(12),
    zone: 'Excavation south trench',
  },
  {
    id: -105, worker_id: 'WORKER-031', machine_id: 'EXCAVATOR-03',
    event_type: 'PROXIMITY_ALERT', rssi: -72, timestamp: minutesAgo(14),
    zone: 'Excavation south trench',
  },
];
