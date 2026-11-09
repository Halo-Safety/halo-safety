import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, HardHat, RadioTower, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { supabase } from './supabase';
import FtmAnchorMap from './FtmAnchorMap';
import './TelemetryPage.css';

type Sample = {
  id: number;
  organization_id: string;
  gateway_id: string;
  vehicle_id: string;
  worker_ref: string;
  sample_id: string;
  measured_at: string;
  received_at: string;
  front_m: number | null;
  rear_left_m: number | null;
  rear_right_m: number | null;
  x_m: number | null;
  y_m: number | null;
  residual_m: number | null;
  spread_m: number | null;
  quality: 'ranges_only' | 'rough_estimate' | 'self_consistent' | 'partial';
  is_demo: boolean;
};
type Vehicle = { id: string; organization_id: string; asset_tag: string; name: string; site: string };

const TIMEOUT_MS = 30_000;
function ago(date: string, now: number) {
  const ms = Math.max(0, now - new Date(date).getTime());
  return ms < 60_000 ? Math.floor(ms / 1000) + ' seconds ago'
    : ms < 3_600_000 ? Math.floor(ms / 60_000) + ' minutes ago'
    : new Date(date).toLocaleString();
}
const distance = (n: number | null) => n === null ? '—' : n.toFixed(2) + ' m';
const qualityLabel = (value: Sample['quality']) => ({
  ranges_only: 'Ranges only', partial: 'Partial measurement',
  rough_estimate: 'Rough estimate', self_consistent: 'Self-consistent estimate',
})[value];

export default function TelemetryPage() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());
  const refresh = useCallback(async () => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    const [sampleResponse, vehicleResponse] = await Promise.all([
      supabase.from('ftm_measurements')
        .select('id,organization_id,gateway_id,vehicle_id,worker_ref,sample_id,measured_at,received_at,front_m,rear_left_m,rear_right_m,x_m,y_m,residual_m,spread_m,quality,is_demo')
        .order('received_at', { ascending: false }).limit(150),
      supabase.from('vehicles').select('id,organization_id,asset_tag,name,site'),
    ]);
    if (sampleResponse.error) throw Error(sampleResponse.error.message);
    if (vehicleResponse.error) throw Error(vehicleResponse.error.message);
    setSamples((sampleResponse.data || []) as Sample[]);
    setVehicles((vehicleResponse.data || []) as Vehicle[]);
    setError(null);
    setLastSync(new Date());
    setNow(Date.now());
  }, []);

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        await refresh();
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : 'Unable to fetch FTM telemetry.');
      } finally {
        if (!disposed) setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { disposed = true; clearInterval(interval); clearInterval(tick); };
  }, [refresh]);

  const vehiclesById = useMemo(() => new Map(vehicles.map(item => [item.id, item])), [vehicles]);
  const latest = useMemo(() => {
    const result = new Map<string, Sample>();
    for (const sample of samples) if (!result.has(sample.gateway_id)) result.set(sample.gateway_id, sample);
    return Array.from(result.values());
  }, [samples]);
  const current = latest.filter(item => now - new Date(item.received_at).getTime() < TIMEOUT_MS).length;

  return <section className="hardware-page">
    <div className="hardware-header">
      <div>
        <div className="hardware-kicker">SENSOR INTEGRATIONS / WI-FI FTM</div>
        <h1 className="display-heading">Telemetry</h1>
        <p>Live Wi-Fi FTM range estimates uploaded by local ESP32 gateways. Experimental measurements, not verified worker positioning; an active uplink is not a safety guarantee.</p>
      </div>
      <button type="button" className="hardware-refresh" onClick={() => {
        setLoading(true);
        void refresh().catch(e => setError(e instanceof Error ? e.message : 'Refresh failed')).finally(() => setLoading(false));
      }} disabled={loading}><RefreshCw size={15}/> Refresh</button>
    </div>
    {error && <div className="hardware-error" role="alert">{error}</div>}
    <div className="hardware-stat-grid">
      <div><span>Reporting gateways</span><strong>{current}</strong><small>Last message within 30 s</small></div>
      <div><span>Recent gateway sources</span><strong>{latest.length}</strong><small>Latest 150 records queried</small></div>
      <div><span>Measurements loaded</span><strong>{samples.length}</strong><small>Live FTM sample history</small></div>
    </div>
    
    <div className="hardware-section-title"><h2>Gateway measurements</h2><span>{lastSync ? 'Last checked ' + lastSync.toLocaleTimeString() : 'Connecting…'}</span></div>
    {latest.length === 0 && <div className="hardware-empty"><WifiOff size={28}/>
      <strong>{loading ? 'Checking for telemetry…' : 'No FTM readings yet'}</strong>
      <p>Connect the ESP32 to the local Python gateway, configure its scoped cloud token, and start the local service. A Vercel deployment does not read USB ports directly.</p>
    </div>}
    <div className="hardware-gateway-grid">
      {latest.map(sample => {
        const fresh = now - new Date(sample.received_at).getTime() < TIMEOUT_MS;
        const vehicle = vehiclesById.get(sample.vehicle_id);
        return <article className="hardware-panel" key={sample.gateway_id}>
          <div className="hardware-panel-head">
            <div><span className="hardware-kicker">{vehicle?.asset_tag || 'Unassigned vehicle'}</span><h3>{vehicle?.name || 'FTM hardware source'}</h3></div>
            <span className={'hardware-state ' + (fresh ? 'fresh' : 'stale')}>
              <span className="hardware-dot"/>{fresh ? 'Reporting' : 'Stale / unknown'}</span>
          </div>
          <div className="hardware-context"><HardHat size={15}/>{sample.worker_ref} · {vehicle?.site || 'Site not specified'}</div>
          <div className="hardware-ranges">
            <div><span>Front anchor</span><strong>{distance(sample.front_m)}</strong></div>
            <div><span>Rear left</span><strong>{distance(sample.rear_left_m)}</strong></div>
            <div><span>Rear right</span><strong>{distance(sample.rear_right_m)}</strong></div>
          </div>
          <div className="hardware-context"><Activity size={15}/>{qualityLabel(sample.quality)}</div>
          {sample.x_m !== null && sample.y_m !== null && <p className="hardware-position">Estimated position: x {distance(sample.x_m)}, y {distance(sample.y_m)}. Residual {distance(sample.residual_m)}, sensitivity {distance(sample.spread_m)}. <em>Unvalidated geometry.</em></p>}
          <div className="hardware-footer"><Clock3 size={14}/> Received {ago(sample.received_at, now)}</div>
        </article>;
      })}
    </div>
    <details className="hardware-positioning">
      <summary><span><strong>Experimental 2D positioning</strong><small>Optional: anchor geometry and worker estimates (not safety-certified)</small></span></summary>
      <FtmAnchorMap vehicles={vehicles} samples={samples} now={now}/>
    </details>
    <section className="hardware-history">
      <div className="hardware-section-title"><h2>Recent ranging samples</h2><span>Last {Math.min(25, samples.length)} of {samples.length} loaded</span></div>
      <div className="hardware-table-wrap"><table><thead><tr><th>Time received</th><th>Vehicle</th><th>Worker</th><th>Front</th><th>Rear left</th><th>Rear right</th><th>Quality</th><th>Gateway</th></tr></thead><tbody>
        {samples.slice(0, 25).map(item => <tr key={item.id}>
          <td>{new Date(item.received_at).toLocaleTimeString()}</td>
          <td>{vehiclesById.get(item.vehicle_id)?.name || item.vehicle_id.slice(0,8)}</td>
          <td>{item.worker_ref}</td><td>{distance(item.front_m)}</td><td>{distance(item.rear_left_m)}</td><td>{distance(item.rear_right_m)}</td><td>{qualityLabel(item.quality)}</td>
          <td>{item.gateway_id.slice(0, 8)}</td>
        </tr>)}
      </tbody></table></div>
    </section>
  </section>;
}
