import type { BackendStatus, SensorEvent } from './types';

const root = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(root + path, init);
  if (!response.ok) {
    throw new Error('API request failed: HTTP ' + response.status);
  }
  return (await response.json()) as T;
}

export async function getEvents(): Promise<SensorEvent[]> {
  const data = await request<unknown>('/api/events');
  if (!Array.isArray(data)) {
    throw new Error('Unexpected response from /api/events');
  }
  return data as SensorEvent[];
}

export function getStatus(): Promise<BackendStatus> {
  return request<BackendStatus>('/api/status');
}

export function sendDemoAlert(): Promise<{ success: boolean; message: string }> {
  return request('/api/demo-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}
