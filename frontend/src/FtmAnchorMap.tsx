import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Crosshair, MapPinned, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import { supabase } from './supabase';
import { listSafetyOrganizations, type SafetyOrg } from './safetyApi';
import { estimateFtm, getAnchors, validateLayout, type FtmLayout } from './ftmGeometry';
import './FtmAnchorMap.css';

type Vehicle = { id: string; organization_id: string; asset_tag: string; name: string; site: string };
type Reading = {
  gateway_id: string;
  vehicle_id: string;
  worker_ref: string;
  received_at: string;
  front_m: number | null;
  rear_left_m: number | null;
  rear_right_m: number | null;
  is_demo: boolean;
};
type Props = { vehicles: Vehicle[]; samples: Reading[]; now: number };
type NumericField = Exclude<keyof FtmLayout, 'vehicle_id' | 'organization_id' | 'updated_at'>;
type Draft = Record<NumericField, string>;

const anchorFields: { label: string; x: NumericField; y: NumericField; bias: NumericField }[] = [
  { label: 'HaloFront', x: 'front_x_m', y: 'front_y_m', bias: 'front_bias_m' },
  { label: 'HaloRearL', x: 'rear_left_x_m', y: 'rear_left_y_m', bias: 'rear_left_bias_m' },
  { label: 'HaloRearR', x: 'rear_right_x_m', y: 'rear_right_y_m', bias: 'rear_right_bias_m' },
];
const numericFields: NumericField[] = [
  'front_x_m', 'front_y_m', 'rear_left_x_m', 'rear_left_y_m',
  'rear_right_x_m', 'rear_right_y_m',
  'front_bias_m', 'rear_left_bias_m', 'rear_right_bias_m', 'assumed_range_error_m',
];
const emptyDraft = (): Draft => ({
  front_x_m: '', front_y_m: '', rear_left_x_m: '', rear_left_y_m: '',
  rear_right_x_m: '', rear_right_y_m: '',
  front_bias_m: '0', rear_left_bias_m: '0', rear_right_bias_m: '0',
  assumed_range_error_m: '0.3',
});
const toDraft = (layout?: FtmLayout): Draft => {
  if (!layout) return emptyDraft();
  const draft = emptyDraft();
  for (const key of numericFields) draft[key] = String(layout[key]);
  return draft;
};
function parseDraft(draft: Draft, vehicle: Vehicle): FtmLayout | null {
  if (numericFields.some(key => !draft[key].trim())) return null;
  const numeric = Object.fromEntries(numericFields.map(key => [key, Number(draft[key])])) as Record<NumericField, number>;
  return { vehicle_id: vehicle.id, organization_id: vehicle.organization_id, ...numeric };
}
const metres = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '—') + ' m';
const ago = (stamp: string, now: number) => {
  const seconds = Math.max(0, Math.floor((now - new Date(stamp).getTime()) / 1000));
  return seconds < 60 ? `${seconds} s ago` : `${Math.floor(seconds / 60)} min ago`;
};

type PlotPoint = { x: number; y: number };
function makeProjection(points: PlotPoint[]) {
  const W = 650, H = 420;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const scale = Math.min(560 / Math.max(2, (Math.max(...xs) - Math.min(...xs)) * 1.4),
    335 / Math.max(2, (Math.max(...ys) - Math.min(...ys)) * 1.4));
  const toX = (x: number) => 325 + (x - cx) * scale;
  const toY = (y: number) => 210 - (y - cy) * scale;
  const gridTarget = 65 / scale;
  const magnitude = Math.pow(10, Math.floor(Math.log10(gridTarget)));
  const step = [1, 2, 5, 10].find(n => n * magnitude >= gridTarget)! * magnitude;
  const minX = cx - 325 / scale, maxX = cx + 325 / scale;
  const minY = cy - 210 / scale, maxY = cy + 210 / scale;
  const xTicks: number[] = [], yTicks: number[] = [];
  for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) xTicks.push(x);
  for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) yTicks.push(y);
  return { W, H, scale, step, toX, toY, xTicks, yTicks };
}

export default function FtmAnchorMap({ vehicles, samples, now }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const [gatewayId, setGatewayId] = useState('');
  const [layouts, setLayouts] = useState<FtmLayout[]>([]);
  const [memberships, setMemberships] = useState<SafetyOrg[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [dirty, setDirty] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const [layoutResponse, orgs] = await Promise.all([
      supabase.from('ftm_anchor_layouts').select('*'),
      listSafetyOrganizations(),
    ]);
    if (layoutResponse.error) throw new Error(layoutResponse.error.message);
    setLayouts((layoutResponse.data || []) as FtmLayout[]);
    setMemberships(orgs);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void reload().catch(issue => {
      if (!cancelled) setError(issue instanceof Error ? issue.message : 'Unable to load layout.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  const selected = vehicles.find(v => v.id === selectedId) ??
    vehicles.find(v => samples.some(sample => sample.vehicle_id === v.id)) ??
    vehicles.find(v => v.asset_tag === 'FTM-LAB-01') ?? vehicles[0];
  const savedLayout = layouts.find(l => l.vehicle_id === selected?.id);
  const role = memberships.find(org => org.id === selected?.organization_id)?.role;
  const canEdit = role === 'admin' || role === 'manager';

  useEffect(() => {
    setDraft(toDraft(savedLayout));
    setDirty(false);
    setSaved(null);
  }, [selected?.id, savedLayout]);

  const vehicleSamples = samples.filter(sample => sample.vehicle_id === selected?.id);
  const gatewaySamples = vehicleSamples.filter(sample =>
    sample.gateway_id === (vehicleSamples.some(item => item.gateway_id === gatewayId) ? gatewayId : vehicleSamples[0]?.gateway_id));
  const latest = gatewaySamples[0];
  const ageMs = latest ? now - new Date(latest.received_at).getTime() : Infinity;
  const fresh = ageMs >= 0 && ageMs < 30_000;
  const candidate = selected ? parseDraft(draft, selected) : null;
  const layout = dirty ? (candidate && !validateLayout(candidate) ? candidate : null) : savedLayout;
  const layoutProblem = candidate && validateLayout(candidate);
  const anchors = layout ? getAnchors(layout) : null;
  const estimate = layout && latest ? estimateFtm(layout, latest) : null;
  // A stale or inconsistent worker estimate must not distort the vehicle map scale.
  // Keep measured anchors visible, but never plot an untrusted worker position.
  const plotEstimate = fresh && estimate?.quality === 'self_consistent'
    && estimate.spread_m <= 0.5 ? estimate : null;
  const trail = useMemo(() => {
    if (!layout || !showTrail || !latest) return [];
    const cutoff = new Date(latest.received_at).getTime() - 180_000;
    return gatewaySamples.filter(s => new Date(s.received_at).getTime() >= cutoff)
      .slice(0, 20).reverse().map(s => estimateFtm(layout, s))
      .filter(position => position?.quality === 'self_consistent' && position.spread_m <= 0.5);
  }, [layout, showTrail, latest?.received_at, gatewaySamples.map(s => s.gateway_id + s.received_at).join('|')]);
  const allPoints = anchors ? [
    ...anchors.map(a => ({ x: a.x, y: a.y })),
    ...(plotEstimate ? [{ x: plotEstimate.x, y: plotEstimate.y }] : []),
  ] : [];
  const projected = allPoints.length ? makeProjection(allPoints) : null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canEdit || !supabase) return;
    const value = parseDraft(draft, selected);
    if (!value) { setError('Enter the measured X and Y coordinates for all three ESP32 anchors.'); return; }
    const message = validateLayout(value);
    if (message) { setError(message); return; }
    setSaving(true);
    setSaved(null);
    try {
      const { data, error: writeError } = await supabase.from('ftm_anchor_layouts')
        .upsert(value, { onConflict: 'vehicle_id' }).select('*').single();
      if (writeError) throw writeError;
      setLayouts(previous => [...previous.filter(item => item.vehicle_id !== selected.id), data as FtmLayout]);
      setDirty(false);
      setError(null);
      setSaved('Anchor layout saved in Supabase for this vehicle.');
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not save anchor layout.');
    } finally { setSaving(false); }
  }

  return <section className="ftm-map-panel" aria-label="2D worker locator">
    <div className="ftm-map-heading">
      <div><div className="hardware-kicker">VEHICLE-RELATIVE POSITIONING</div><h2><MapPinned size={19}/> Live 2D worker map</h2>
        <p>Set the measured locations of the three ESP32 anchors on the vehicle. Positive X is right; positive Y is forward.</p></div>
      <button className="hardware-refresh" type="button" disabled={loading} onClick={() => {
        setLoading(true);
        void reload().catch(issue => setError(issue instanceof Error ? issue.message : 'Could not refresh geometry.'))
          .finally(() => setLoading(false));
      }}><RefreshCw size={14}/> Refresh layout</button>
    </div>
    <div className="ftm-map-controls">
      <label>Vehicle
        <select value={selected?.id || ''} onChange={event => {
          setSelectedId(event.target.value); setGatewayId(''); setSaved(null); setError(null);
        }}>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.asset_tag} · {v.name}</option>)}
        </select>
      </label>
      {vehicleSamples.length > 1 && <label>Worker / gateway
        <select value={latest?.gateway_id || ''} onChange={event => setGatewayId(event.target.value)}>
          {Array.from(new Map(vehicleSamples.map(s => [s.gateway_id, s])).values()).map(s =>
            <option key={s.gateway_id} value={s.gateway_id}>{s.worker_ref} · {s.gateway_id.slice(0, 8)}</option>)}
        </select>
      </label>}
      <label className="ftm-map-trail"><input type="checkbox" checked={showTrail} onChange={event => setShowTrail(event.target.checked)}/> Show recent estimates</label>
    </div>
    {error && <div className="hardware-error" role="alert">{error}</div>}
    {saved && <div className="ftm-map-saved" role="status">{saved}</div>}
    <div className="ftm-map-layout">
      <div className="ftm-map-visual">
        <svg viewBox="0 0 650 420" role="img" aria-label="Plan view showing measured ESP32 anchor positions and the estimated worker position">
          <rect x="0" y="0" width="650" height="420" rx="12" fill="#f4f9fb"/>
          {projected && <>
            {projected.xTicks.map(x => <g key={'x'+x}>
              <line x1={projected.toX(x)} y1="0" x2={projected.toX(x)} y2="420" stroke={Math.abs(x) < 1e-6 ? '#a5bdc9' : '#dce8ef'} strokeWidth={Math.abs(x) < 1e-6 ? 1.7 : 1}/>
              <text x={projected.toX(x)+3} y="405" fill="#8ea4b2" fontSize="10">{Number(x.toFixed(3))}</text>
            </g>)}
            {projected.yTicks.map(y => <g key={'y'+y}>
              <line x1="0" y1={projected.toY(y)} x2="650" y2={projected.toY(y)} stroke={Math.abs(y) < 1e-6 ? '#a5bdc9' : '#dce8ef'} strokeWidth={Math.abs(y) < 1e-6 ? 1.7 : 1}/>
              <text x="7" y={projected.toY(y)-4} fill="#8ea4b2" fontSize="10">{Number(y.toFixed(3))}</text>
            </g>)}
            <polygon points={anchors!.map(a => `${projected.toX(a.x)},${projected.toY(a.y)}`).join(' ')}
              fill="#d6ebf5" fillOpacity=".5" stroke="#7ea8bd" strokeWidth="2" strokeDasharray="6 6"/>
            {showTrail && trail.length > 1 && <polyline
              points={trail.map(p => `${projected.toX(p.x)},${projected.toY(p.y)}`).join(' ')}
              fill="none" stroke="#c8955b" strokeWidth="2.2" strokeDasharray="3 6" opacity=".6"/>}
            {anchors!.map(anchor => <g key={anchor.key}>
              <circle cx={projected.toX(anchor.x)} cy={projected.toY(anchor.y)} r="9"
                fill="#3c83a4" stroke="white" strokeWidth="3"/>
              <text x={projected.toX(anchor.x)} y={projected.toY(anchor.y)-17}
                textAnchor="middle" fontSize="12" fontWeight="650" fill="#345b74"
                stroke="#f4f9fb" strokeWidth="4" paintOrder="stroke">{anchor.name}</text>
              <text x={projected.toX(anchor.x)} y={projected.toY(anchor.y)+27}
                textAnchor="middle" fontSize="10" fill="#5b8397"
                stroke="#f4f9fb" strokeWidth="3" paintOrder="stroke">({anchor.x.toFixed(2)}, {anchor.y.toFixed(2)})</text>
            </g>)}
            {plotEstimate && <g>
              <circle cx={projected.toX(plotEstimate.x)} cy={projected.toY(plotEstimate.y)} r="15"
                fill="#f6a851"
                stroke="#ba722c" strokeWidth="3"
                strokeDasharray={undefined}/>
              <circle cx={projected.toX(plotEstimate.x)} cy={projected.toY(plotEstimate.y)} r="3" fill="#ba722c"/>
              <text x={projected.toX(plotEstimate.x)} y={projected.toY(plotEstimate.y)-24}
                textAnchor="middle" fontSize="13" fontWeight="700" fill="#9d5d1e"
                stroke="#f4f9fb" strokeWidth="4" paintOrder="stroke">Worker · estimate</text>
            </g>}
            <rect x="16" y="17" rx="7" width="176" height="38" fill="white" fillOpacity=".88"/>
            <line x1="28" y1="37" x2={28 + projected.step * projected.scale} y2="37" stroke="#365f78" strokeWidth="2"/>
            <text x="30" y="29" fontSize="11" fill="#365f78">Scale: {Number(projected.step.toPrecision(2))} m</text>
          </>}
          {!projected && <g>
            <line x1="325" x2="325" y1="28" y2="392" stroke="#dce8ef" strokeWidth="2" strokeDasharray="5 7"/>
            <line x1="30" x2="620" y1="210" y2="210" stroke="#dce8ef" strokeWidth="2" strokeDasharray="5 7"/>
            <text x="325" y="185" textAnchor="middle" fontSize="17" fill="#7899aa" fontWeight="650">Anchor positions not configured</text>
            <text x="325" y="216" textAnchor="middle" fontSize="12" fill="#95aaba">Enter the measured X and Y coordinates for each ESP32</text>
          </g>}
          <text x="634" y="210" fontSize="12" textAnchor="end" fill="#55778d">+X →</text>
          <text x="333" y="20" fontSize="12" textAnchor="start" fill="#55778d">+Y ↑</text>
        </svg>
        <div className="ftm-map-legend"><span><i className="ftm-legend-anchor"/> ESP32 anchor</span>
          <span><i className="ftm-legend-worker"/> Worker estimate (only when usable)</span>
          <span>{fresh ? 'Live readings' : 'Stale / no live data'}</span>
          <span>Solver: nonlinear least squares (L2)</span></div>
        {estimate && <div className={'ftm-map-quality ' + (!plotEstimate ? 'uncertain' : '')}>
          <Crosshair size={16}/>
          <span>{fresh ? 'Latest' : 'Last known'} estimate: X <strong>{metres(estimate.x)}</strong>, Y <strong>{metres(estimate.y)}</strong>.
            Residual <strong>{metres(estimate.residual_m)}</strong>; ±range sensitivity <strong>{metres(estimate.spread_m)}</strong>.
            {!fresh ? ' Stale reading — marker hidden.' : estimate.quality === 'rough' ? ' Inconsistent measurements — marker hidden.' : ' Geometrically self-consistent, but real-world accuracy is not verified.'}
          </span>
        </div>}
        {layout && !estimate && <p className="ftm-map-missing">No usable position: three valid ranges and a non-degenerate anchor layout are required.</p>}
        {latest && <p className="ftm-map-caption">Measurement from {latest.worker_ref} · received {ago(latest.received_at, now)} · gateway {latest.gateway_id.slice(0, 8)}. A stale position is not live tracking.</p>}
        {!latest && <p className="ftm-map-caption">No FTM measurements for this vehicle yet. Anchors can be configured before the gateway is connected.</p>}
      </div>
      <form className="ftm-anchor-editor" onSubmit={event => void save(event)}>
        <div className="ftm-anchor-editor-head"><h3>ESP32 anchor coordinates</h3><span>{dirty ? 'Unsaved preview' : savedLayout ? 'Saved in Supabase' : 'Not configured'}</span></div>
        <p>Measure the antenna locations relative to one origin on the machine. All values are metres. Optional bias corrects a systematic FTM range offset.</p>
        <div className="ftm-anchor-columns"><span>Anchor</span><span>X (right)</span><span>Y (forward)</span><span>Bias</span></div>
        {anchorFields.map(field => <div className="ftm-anchor-row" key={field.label}>
          <strong>{field.label}</strong>
          {([field.x, field.y, field.bias] as NumericField[]).map(key =>
            <input key={key} type="number" step="0.001"
              min={key === field.bias ? -10 : -100} max={key === field.bias ? 10 : 100}
              aria-label={field.label + ' ' + key} placeholder="—" required
              value={draft[key]} disabled={!canEdit}
              onChange={event => { setDraft(prev => ({...prev, [key]: event.target.value})); setDirty(true); setSaved(null); }}/>)}
        </div>)}
        <label className="ftm-anchor-error-field">Assumed range error (m)
          <input type="number" step="0.01" min="0.01" max="10" required
            value={draft.assumed_range_error_m} disabled={!canEdit}
            onChange={event => { setDraft(prev => ({...prev, assumed_range_error_m: event.target.value})); setDirty(true); setSaved(null); }}/>
        </label>
        <p className="ftm-anchor-hint">The error value is an unverified sensitivity assumption, not a confidence interval. Calibrate with actual tape-measured distances.</p>
        {dirty && layoutProblem && <p className="ftm-anchor-warning">{layoutProblem}</p>}
        {canEdit ? <div className="ftm-anchor-actions">
          {dirty && <button type="button" className="hardware-refresh" onClick={() => {setDraft(toDraft(savedLayout));setDirty(false);setError(null);}}>Discard</button>}
          <button type="submit" className="ftm-anchor-save" disabled={!dirty || saving || !candidate || Boolean(layoutProblem)}>
            <Save size={15}/> {saving ? 'Saving…' : 'Save layout to Supabase'}
          </button>
        </div> : <p className="ftm-anchor-hint"><ShieldAlert size={15}/> Only organization admins and managers can change this configuration.</p>}
        <div className="ftm-anchor-lab-note">Do not use these estimates to trigger physical safety interventions without validated hardware testing. Stored raw FTM readings are never modified by calibration changes.</div>
      </form>
    </div>
  </section>;
}
