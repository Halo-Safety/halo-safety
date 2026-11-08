import { supabase } from './supabase';
import type { SensorEvent } from './types';

/**
 * All production events are read directly from Supabase with a user's JWT.
 * Row Level Security filters the data to their organization memberships.
 * No synthetic seed data and no unauthenticated Flask fallback.
 */
export async function getEvents(): Promise<SensorEvent[]> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase
    .from('sensor_events')
    .select('id,worker_id,machine_id,event_type,rssi,timestamp')
    .order('timestamp', { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return (data || []) as SensorEvent[];
}
