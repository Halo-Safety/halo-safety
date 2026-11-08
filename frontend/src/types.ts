export interface SensorEvent {
  id?: number;
  worker_id: string;
  machine_id: string;
  rssi?: number | null;
  event_type?: string;
  event?: string;
  timestamp?: string;
}

export interface BackendStatus {
  dashboard?: string;
  machine?: string;
}

export const eventType = (event: SensorEvent): string =>
  event.event_type ?? event.event ?? 'UNKNOWN';
