import type { BackendStatus, SensorEvent } from './types';

const root = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * On Vercel, when no API URL is configured, render a clearly labelled
 * browser-local demonstration rather than a broken empty dashboard.
 * Local Vite development keeps using Flask unless VITE_DEMO_MODE=true.
 */
export const isDemoMode =
  import.meta.env.VITE_DEMO_MODE === 'true' ||
  (import.meta.env.PROD && !root);

const DEMO_STORAGE_KEY = 'halo-safety-browser-demo-v1';

function createDemoEvents(): SensorEvent[] {
  const now = Date.now();
  const events: Array<[number, string, string, string, number | null]> = [
    [144, 'WORKER_03', 'FORKLIFT_01', 'PROXIMITY_ALERT', -58],
    [143.96, 'WORKER_03', 'FORKLIFT_01', 'ALERT_CLEAR', -71],
    [120, 'WORKER_01', 'FORKLIFT_02', 'PROXIMITY_ALERT', -52],
    [119.95, 'WORKER_01', 'FORKLIFT_02', 'ALERT_CLEAR', -73],
    [99, 'WORKER_04', 'LOADER_01', 'PROXIMITY_ALERT', -62],
    [98.96, 'WORKER_04', 'LOADER_01', 'ALERT_CLEAR', -77],
    [76, 'WORKER_02', 'FORKLIFT_01', 'PROXIMITY_ALERT', -49],
    [75.94, 'WORKER_02', 'FORKLIFT_01', 'ALERT_CLEAR', -70],
    [53, 'WORKER_05', 'FORKLIFT_02', 'PROXIMITY_ALERT', -55],
    [52.97, 'WORKER_05', 'FORKLIFT_02', 'ALERT_CLEAR', -72],
    [29, 'WORKER_02', 'FORKLIFT_01', 'PROXIMITY_ALERT', -51],
    [28.94, 'WORKER_02', 'FORKLIFT_01', 'ALERT_CLEAR', -74],
    [5, 'WORKER_01', 'LOADER_01', 'PROXIMITY_ALERT', -61],
    [4.95, 'WORKER_01', 'LOADER_01', 'ALERT_CLEAR', -76],
    [0.45, 'WORKER_06', 'FORKLIFT_01', 'PROXIMITY_ALERT', -48],
  ];
  return events.map(([hoursAgo, worker_id, machine_id, event_type, rssi], index) => ({
    id: index + 1,
    worker_id,
    machine_id,
    event_type,
    rssi,
    timestamp: new Date(now - hoursAgo * 3600000).toISOString(),
  }));
}

function readDemoEvents(): SensorEvent[] {
  try {
    const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed as SensorEvent[];
    }
  } catch {
    // Private browsing or disabled storage: demo still works this session.
  }
  const initial = createDemoEvents();
  writeDemoEvents(initial);
  return initial;
}

function writeDemoEvents(events: SensorEvent[]) {
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Browser storage may be disabled; nothing is sent to a server.
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(root + path, init);
  if (!response.ok) {
    throw new Error('API request failed: HTTP ' + response.status);
  }
  return (await response.json()) as T;
}

export async function getEvents(): Promise<SensorEvent[]> {
  if (isDemoMode) return readDemoEvents();
  const data = await request<unknown>('/api/events');
  if (!Array.isArray(data)) {
    throw new Error('Unexpected response from /api/events');
  }
  return data as SensorEvent[];
}

export function getStatus(): Promise<BackendStatus> {
  if (isDemoMode) return Promise.resolve({ dashboard: 'demo', machine: 'simulated' });
  return request<BackendStatus>('/api/status');
}

export async function sendDemoAlert(): Promise<{ success: boolean; message: string }> {
  if (isDemoMode) {
    const events = readDemoEvents();
    const nextId = Math.max(0, ...events.map(e => e.id ?? 0)) + 1;
    const nextWorker = String(nextId).padStart(2, '0');
    events.push({
      id: nextId,
      worker_id: 'DEMO_WORKER_' + nextWorker,
      machine_id: 'FORKLIFT_01',
      event_type: 'PROXIMITY_ALERT',
      rssi: -49,
      timestamp: new Date().toISOString(),
    });
    writeDemoEvents(events);
    return { success: true, message: 'Simulated alert added to this browser' };
  }
  return request('/api/demo-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Append verified same-origin simulator events to the browser-only demo store. */
export function appendSimulationEvent(
  event: 'PROXIMITY_ALERT' | 'ALERT_CLEAR',
  zone?: string,
): void {
  if (!isDemoMode) return;
  const existing = readDemoEvents();
  const nextId = Math.max(0, ...existing.map(item => item.id ?? 0)) + 1;
  existing.push({
    id: nextId,
    worker_id: 'SIM_WORKER_01',
    machine_id: 'SIM_LOADER_01',
    event_type: event,
    rssi: null,
    zone,
    timestamp: new Date().toISOString(),
  });
  writeDemoEvents(existing);
}
