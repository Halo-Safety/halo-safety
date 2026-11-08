import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, ClipboardCheck, Database, RefreshCw, Save, ShieldCheck, Truck } from 'lucide-react';
import {
  listSafetyOrganizations, loadSafetyData, saveAction, saveCase, saveVehicle,
  type ActionInput, type CaseInput, type CorrectiveAction, type SafetyCase,
  type SafetyOrg, type Vehicle, type VehicleInput,
} from './safetyApi';
import './SafetyRecords.css';

type View = 'cases' | 'vehicles';
type FormKind = 'case' | 'vehicle' | 'action' | null;
type Filter = 'all' | 'needs_review' | 'reviewed_near_miss' | 'demo';

const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
function localDateTime(value: Date | string): string {
  const date = new Date(value);
  return [date.getFullYear(), '-', String(date.getMonth() + 1).padStart(2, '0'), '-',
    String(date.getDate()).padStart(2, '0'), 'T', String(date.getHours()).padStart(2, '0'), ':',
    String(date.getMinutes()).padStart(2, '0')].join('');
}
const blankVehicle = (): VehicleInput => ({
  asset_tag: '', name: '', vehicle_type: 'Other', ownership_kind: 'owned',
  owner_name: '', site: '', operator_ref: '', sensor_source: '',
  device_status: 'unknown', operating_hours: 0, is_demo: false,
});
const blankCase = (): CaseInput => ({
  vehicle_id: null, title: '', occurred_at: localDateTime(new Date()),
  zone: '', shift_name: '', worker_ref: '', operator_at_event: '',
  source_label: 'Manual report', observation_count: 1, classification: 'candidate',
  status: 'needs_review', potential_severity: 'medium',
  summary: '', evidence_notes: '', pattern_notes: '', is_demo: false,
});
const blankAction = (): ActionInput => ({
  title: '', owner_ref: '', due_date: null, status: 'open', verification_notes: '',
});

function Field({ label, children, wide = false }: {
  label: string; children: ReactNode; wide?: boolean;
}) {
  return <label className={'safety-form-field' + (wide ? ' wide' : '')}>
    <span>{label}</span>{children}
  </label>;
}

export default function SafetyRecords({ view }: { view: View }) {
  const [organizations, setOrganizations] = useState<SafetyOrg[]>([]);
  const loadGeneration = useRef(0);
  const [orgId, setOrgId] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [cases, setCases] = useState<SafetyCase[]>([]);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [formKind, setFormKind] = useState<FormKind>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [vehicleInput, setVehicleInput] = useState<VehicleInput>(blankVehicle);
  const [caseInput, setCaseInput] = useState<CaseInput>(blankCase);
  const [actionInput, setActionInput] = useState<ActionInput>(blankAction);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    void listSafetyOrganizations().then(orgs => {
      if (disposed) return;
      setOrganizations(orgs);
      setOrgId(current => orgs.some(org => org.id === current) ? current : orgs[0]?.id || '');
      setLoading(false);
    }).catch(issue => {
      if (disposed) return;
      setError(issue instanceof Error ? issue.message : 'Unable to load organization');
      setLoading(false);
    });
    return () => { disposed = true; };
  }, []);

  const reload = useCallback(async () => {
    if (!orgId) return;
    const generation = ++loadGeneration.current;
    setLoading(true);
    try {
      const result = await loadSafetyData(orgId);
      if (generation !== loadGeneration.current) return;
      setVehicles(result.vehicles);
      setCases(result.cases);
      setActions(result.actions);
      setError(null);
    } catch (issue) {
      if (generation !== loadGeneration.current) return;
      setError(issue instanceof Error ? issue.message : 'Unable to load records');
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void reload();
    return () => { loadGeneration.current += 1; };
  }, [reload]);
  useEffect(() => { setFormKind(null); }, [view]);
  const org = organizations.find(item => item.id === orgId);
  const canEdit = org?.role === 'admin' || org?.role === 'manager';
  const selectedVehicle = vehicles.find(item => item.id === selectedVehicleId) || vehicles[0];
  const filteredCases = useMemo(() => cases.filter(item => {
    if (filter === 'needs_review') return item.status === 'needs_review' || item.status === 'investigating';
    if (filter === 'reviewed_near_miss') return item.classification === 'reviewed_near_miss';
    if (filter === 'demo') return item.is_demo;
    return true;
  }), [cases, filter]);
  const selectedCase = filteredCases.find(item => item.id === selectedCaseId) || filteredCases[0];
  const outstanding = actions.filter(item => item.status !== 'completed');
  const overdue = outstanding.filter(item => item.due_date && item.due_date < localDateTime(new Date()).slice(0, 10));
  const verified = cases.filter(item => item.classification === 'reviewed_near_miss' && !item.is_demo).length;
  const unreviewed = cases.filter(item => item.classification === 'candidate' && !item.is_demo).length;

  function startVehicle(item?: Vehicle) {
    setFormKind('vehicle');
    setEditId(item?.id || null);
    setVehicleInput(item ? {
      asset_tag: item.asset_tag, name: item.name, vehicle_type: item.vehicle_type,
      ownership_kind: item.ownership_kind, owner_name: item.owner_name,
      site: item.site, operator_ref: item.operator_ref, sensor_source: item.sensor_source,
      device_status: item.device_status, operating_hours: item.operating_hours,
      is_demo: item.is_demo,
    } : blankVehicle());
    setNotice(null);
  }
  function startCase(item?: SafetyCase) {
    setFormKind('case');
    setEditId(item?.id || null);
    setCaseInput(item ? {
      vehicle_id: item.vehicle_id, title: item.title, occurred_at: localDateTime(item.occurred_at),
      zone: item.zone, shift_name: item.shift_name, worker_ref: item.worker_ref,
      operator_at_event: item.operator_at_event, source_label: item.source_label,
      observation_count: item.observation_count, classification: item.classification,
      status: item.status, potential_severity: item.potential_severity,
      summary: item.summary, evidence_notes: item.evidence_notes,
      pattern_notes: item.pattern_notes, is_demo: item.is_demo,
    } : blankCase());
    setNotice(null);
  }
  function startAction(item?: CorrectiveAction) {
    if (!selectedCase) return;
    setFormKind('action');
    setEditId(item?.id || null);
    setActionInput(item ? {
      title: item.title, owner_ref: item.owner_ref, due_date: item.due_date,
      status: item.status, verification_notes: item.verification_notes,
    } : blankAction());
    setNotice(null);
  }

  async function submitVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !orgId) return;
    setBusy(true);
    try {
      const saved = await saveVehicle(orgId, vehicleInput, editId || undefined);
      setSelectedVehicleId(saved.id);
      setFormKind(null);
      setNotice(editId ? 'Vehicle updated in Supabase.' : 'Vehicle saved in Supabase.');
      await reload();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to save vehicle');
    } finally { setBusy(false); }
  }

  async function submitCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !orgId) return;
    setBusy(true);
    try {
      const saved = await saveCase(orgId, {
        ...caseInput,
        occurred_at: new Date(caseInput.occurred_at).toISOString(),
      }, editId || undefined);
      setSelectedCaseId(saved.id);
      setFormKind(null);
      setNotice(editId ? 'Case updated in Supabase.' : 'Case saved in Supabase.');
      await reload();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to save case');
    } finally { setBusy(false); }
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !orgId || !selectedCase) return;
    setBusy(true);
    try {
      await saveAction(orgId, selectedCase.id, actionInput, editId || undefined);
      setFormKind(null);
      setNotice(editId ? 'Corrective action updated in Supabase.' : 'Corrective action saved in Supabase.');
      await reload();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to save action');
    } finally { setBusy(false); }
  }

  return <section className="safety-page">
    <div className="safety-page-heading">
      <div>
        <div className="safety-eyebrow">ORGANIZATION DATA / SUPABASE</div>
        <h1 className="display-heading">{view === 'vehicles' ? 'Vehicles' : 'Cases'}</h1>
        <p>{view === 'vehicles' ? 'Fleet inventory and responsible operators.' : 'Review near-miss candidates, preserve evidence and assign preventive work.'}</p>
      </div>
      <span className="safety-demo-tag"><Database size={14}/> Persistent records</span>
    </div>

    {organizations.length > 0 && <div className="safety-org-bar">
      <label>Organization
        <select value={orgId} onChange={event => {
          loadGeneration.current += 1;
          setOrgId(event.target.value);
          setFormKind(null); setSelectedCaseId(null); setSelectedVehicleId(null);
          setCases([]); setVehicles([]); setActions([]); setNotice(null);
        }}>{organizations.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
      </label>
      <span>Role: <strong>{org?.role || 'viewer'}</strong></span>
      <button type="button" disabled={loading} onClick={() => void reload()}><RefreshCw size={14}/> Refresh</button>
    </div>}

    {error && <div className="safety-error" role="alert">{error}{error.includes('relation') || error.includes('schema cache') || error.includes('Could not find the table') ? ' — Apply supabase/migrations/20261108_safety_workflows.sql in your Supabase SQL Editor.' : ''}</div>}
    {notice && <div className="safety-success" role="status">{notice}</div>}
    {!loading && organizations.length === 0 && !error && <div className="safety-no-data">
      <ShieldCheck size={29}/>
      <h2>No organization membership found</h2>
      <p>Ask an administrator to add your account to an organization. Halo does not create organizations or use a public demo-data bypass.</p>
    </div>}

    {organizations.length > 0 && <>
      <div className="safety-records-head">
        <div className="safety-record-kpis">
          {view === 'cases' ? <>
            <span><strong>{cases.length}</strong> cases</span>
            <span><strong>{unreviewed}</strong> pending review (real)</span>
            <span><strong>{verified}</strong> reviewed (real)</span>
            <span><strong>{overdue.length}</strong> overdue actions</span>
          </> : <>
            <span><strong>{vehicles.length}</strong> vehicles</span>
            <span><strong>{vehicles.filter(v => v.device_status === 'online').length}</strong> reporting online (manual status)</span>
            <span><strong>{vehicles.filter(v => v.is_demo).length}</strong> marked demo</span>
          </>}
        </div>
        {canEdit && <button className="safety-add" type="button" onClick={() => view === 'vehicles' ? startVehicle() : startCase()}>
          + New {view === 'vehicles' ? 'vehicle' : 'case'}
        </button>}
      </div>
      {view === 'cases' && <div className="safety-filter-buttons safety-cloud-filters">
        {([
          ['all','All cases'], ['needs_review','Needs review'],
          ['reviewed_near_miss','Reviewed near misses'], ['demo','Marked demo'],
        ] as [Filter,string][]).map(([value,label]) =>
          <button type="button" key={value} onClick={() => setFilter(value)}
            className={filter === value ? 'selected' : ''}>{label}</button>)}
      </div>}

      <div className="safety-case-layout">
        <div className="safety-cases">
          {loading && <div className="safety-empty">Loading organization records…</div>}
          {!loading && (view === 'vehicles' ? vehicles : filteredCases).length === 0 &&
            <div className="safety-empty">No {view === 'vehicles' ? 'vehicles' : 'cases'} in this view. {canEdit ? 'Create the first record.' : 'An organization editor can add records.'}</div>}
          {view === 'vehicles' ? vehicles.map(item => <button className={'safety-vehicle-row' + (selectedVehicle?.id === item.id ? ' selected' : '')}
            type="button" key={item.id} onClick={() => { setSelectedVehicleId(item.id); setFormKind(null); }}>
            <div className="safety-vehicle-title"><Truck size={18}/><strong>{item.name}</strong></div>
            <div className="safety-case-meta">{item.asset_tag} · {item.site || 'Site not set'}</div>
            <div className="safety-vehicle-bottom"><span>{item.owner_name || 'Owner not set'}</span><span>{item.is_demo ? 'SAMPLE' : titleCase(item.device_status)}</span></div>
          </button>) : filteredCases.map(item => <button className={'safety-case-row' + (selectedCase?.id === item.id ? ' selected' : '')}
            type="button" key={item.id} onClick={() => { setSelectedCaseId(item.id); setFormKind(null); }}>
            <div className="safety-case-top"><span>{dateLabel(item.occurred_at)} · {item.is_demo ? 'SAMPLE' : 'RECORD'}</span>
              <span className="safety-pill">{titleCase(item.status)}</span></div>
            <strong>{item.title}</strong>
            <div className="safety-case-meta">{vehicles.find(v => v.id === item.vehicle_id)?.name || 'No vehicle linked'} · {item.zone || 'Zone unspecified'}</div>
            <div className="safety-case-bottom"><span>{item.observation_count} observations · classification: {titleCase(item.classification)}</span><span className="safety-view-link">Details <ArrowRight size={14}/></span></div>
          </button>)}
        </div>
        <aside className="safety-detail">
          {formKind === 'vehicle' && <form className="safety-record-form" onSubmit={event => void submitVehicle(event)}>
            <h2>{editId ? 'Edit vehicle' : 'New vehicle'}</h2>
            <div className="safety-form-grid">
              <Field label="Asset tag"><input required maxLength={80} value={vehicleInput.asset_tag} onChange={e => setVehicleInput({...vehicleInput,asset_tag:e.target.value})}/></Field>
              <Field label="Vehicle name"><input required maxLength={160} value={vehicleInput.name} onChange={e => setVehicleInput({...vehicleInput,name:e.target.value})}/></Field>
              <Field label="Vehicle type"><input value={vehicleInput.vehicle_type} onChange={e=>setVehicleInput({...vehicleInput,vehicle_type:e.target.value})}/></Field>
              <Field label="Ownership"><select value={vehicleInput.ownership_kind} onChange={e=>setVehicleInput({...vehicleInput,ownership_kind:e.target.value as VehicleInput['ownership_kind']})}>
                {['owned','leased','rented','contractor'].map(k=><option key={k} value={k}>{titleCase(k)}</option>)}</select></Field>
              <Field label="Owner / contractor"><input value={vehicleInput.owner_name} onChange={e=>setVehicleInput({...vehicleInput,owner_name:e.target.value})}/></Field>
              <Field label="Site"><input value={vehicleInput.site} onChange={e=>setVehicleInput({...vehicleInput,site:e.target.value})}/></Field>
              <Field label="Assigned operator ref"><input value={vehicleInput.operator_ref} onChange={e=>setVehicleInput({...vehicleInput,operator_ref:e.target.value})}/></Field>
              <Field label="Device/source ID"><input value={vehicleInput.sensor_source} onChange={e=>setVehicleInput({...vehicleInput,sensor_source:e.target.value})}/></Field>
              <Field label="Device state (manual)"><select value={vehicleInput.device_status} onChange={e=>setVehicleInput({...vehicleInput,device_status:e.target.value as VehicleInput['device_status']})}>
                {['unknown','online','offline','unreliable'].map(k=><option key={k}>{k}</option>)}</select></Field>
              <Field label="Operating hours (entered)"><input type="number" min={0} step=".01" value={vehicleInput.operating_hours} onChange={e=>setVehicleInput({...vehicleInput,operating_hours:Number(e.target.value)})}/></Field>
              <label className="safety-check"><input type="checkbox" checked={vehicleInput.is_demo} onChange={e=>setVehicleInput({...vehicleInput,is_demo:e.target.checked})}/> Mark as demonstration data</label>
            </div>
            <div className="safety-form-actions"><button type="button" onClick={()=>setFormKind(null)}>Cancel</button><button className="safety-add" type="submit" disabled={busy}><Save size={15}/> {busy?'Saving…':'Save vehicle'}</button></div>
          </form>}

          {formKind === 'case' && <form className="safety-record-form" onSubmit={event => void submitCase(event)}>
            <h2>{editId ? 'Edit case' : 'New case'}</h2>
            <div className="safety-form-grid">
              <Field label="Title" wide><input required maxLength={200} value={caseInput.title} onChange={e=>setCaseInput({...caseInput,title:e.target.value})}/></Field>
              <Field label="Occurred at"><input type="datetime-local" required value={caseInput.occurred_at} onChange={e=>setCaseInput({...caseInput,occurred_at:e.target.value})}/></Field>
              <Field label="Related vehicle"><select value={caseInput.vehicle_id||''} onChange={e=>setCaseInput({...caseInput,vehicle_id:e.target.value||null})}><option value="">None / not known</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.asset_tag} · {v.name}</option>)}</select></Field>
              <Field label="Zone / location"><input value={caseInput.zone} onChange={e=>setCaseInput({...caseInput,zone:e.target.value})}/></Field>
              <Field label="Shift"><input value={caseInput.shift_name} onChange={e=>setCaseInput({...caseInput,shift_name:e.target.value})}/></Field>
              <Field label="Worker tag / reference"><input value={caseInput.worker_ref} onChange={e=>setCaseInput({...caseInput,worker_ref:e.target.value})}/></Field>
              <Field label="Operator at event"><input value={caseInput.operator_at_event} onChange={e=>setCaseInput({...caseInput,operator_at_event:e.target.value})}/></Field>
              <Field label="Evidence source"><input value={caseInput.source_label} onChange={e=>setCaseInput({...caseInput,source_label:e.target.value})}/></Field>
              <Field label="Grouped observations"><input type="number" min={1} max={1000000} value={caseInput.observation_count} onChange={e=>setCaseInput({...caseInput,observation_count:Number(e.target.value)})}/></Field>
              <Field label="Classification"><select value={caseInput.classification} onChange={e=>setCaseInput({...caseInput,classification:e.target.value as CaseInput['classification']})}>
                {['candidate','reviewed_near_miss','false_alarm','device_fault'].map(k=><option key={k} value={k}>{titleCase(k)}</option>)}</select></Field>
              <Field label="Review status"><select value={caseInput.status} onChange={e=>setCaseInput({...caseInput,status:e.target.value as CaseInput['status']})}>
                {['needs_review','investigating','action_assigned','monitoring','closed','dismissed'].map(k=><option key={k} value={k}>{titleCase(k)}</option>)}</select></Field>
              <Field label="Potential severity"><select value={caseInput.potential_severity} onChange={e=>setCaseInput({...caseInput,potential_severity:e.target.value as CaseInput['potential_severity']})}>
                {['critical','high','medium','low'].map(k=><option key={k}>{k}</option>)}</select></Field>
              <Field label="Assessment" wide><textarea rows={3} value={caseInput.summary} onChange={e=>setCaseInput({...caseInput,summary:e.target.value})}/></Field>
              <Field label="Evidence notes / source references" wide><textarea rows={3} value={caseInput.evidence_notes} onChange={e=>setCaseInput({...caseInput,evidence_notes:e.target.value})}/></Field>
              <Field label="Recurring risk pattern" wide><textarea rows={2} value={caseInput.pattern_notes} onChange={e=>setCaseInput({...caseInput,pattern_notes:e.target.value})}/></Field>
              <label className="safety-check"><input type="checkbox" checked={caseInput.is_demo} onChange={e=>setCaseInput({...caseInput,is_demo:e.target.checked})}/> Fictional / demonstration record</label>
            </div>
            <div className="safety-form-actions"><button type="button" onClick={()=>setFormKind(null)}>Cancel</button><button className="safety-add" type="submit" disabled={busy}><Save size={15}/> {busy?'Saving…':'Save case'}</button></div>
          </form>}

          {formKind === 'action' && <form className="safety-record-form" onSubmit={event => void submitAction(event)}>
            <h2>{editId?'Edit':'New'} corrective action</h2>
            <p className="safety-form-subheading">Linked to {selectedCase?.title}</p>
            <div className="safety-form-grid">
              <Field label="Action" wide><input required maxLength={240} value={actionInput.title} onChange={e=>setActionInput({...actionInput,title:e.target.value})}/></Field>
              <Field label="Responsible role / person"><input value={actionInput.owner_ref} onChange={e=>setActionInput({...actionInput,owner_ref:e.target.value})}/></Field>
              <Field label="Due date"><input type="date" value={actionInput.due_date||''} onChange={e=>setActionInput({...actionInput,due_date:e.target.value||null})}/></Field>
              <Field label="Status"><select value={actionInput.status} onChange={e=>setActionInput({...actionInput,status:e.target.value as ActionInput['status']})}>
                {['open','in_progress','completed'].map(k=><option key={k} value={k}>{titleCase(k)}</option>)}</select></Field>
              <Field label="Completion / verification notes" wide><textarea rows={3} value={actionInput.verification_notes} onChange={e=>setActionInput({...actionInput,verification_notes:e.target.value})}/></Field>
            </div>
            <div className="safety-form-actions"><button type="button" onClick={()=>setFormKind(null)}>Cancel</button><button className="safety-add" type="submit" disabled={busy}><Save size={15}/> {busy?'Saving…':'Save action'}</button></div>
          </form>}

          {!formKind && view === 'vehicles' && (selectedVehicle
            ? <>
              <div className="safety-detail-header"><span className="safety-eyebrow">{selectedVehicle.asset_tag} · {selectedVehicle.is_demo ? 'DEMO' : 'ORGANIZATION RECORD'}</span><h2>{selectedVehicle.name}</h2>
                {canEdit && <button className="safety-inline-edit" onClick={()=>startVehicle(selectedVehicle)}>Edit vehicle</button>}</div>
              <dl className="safety-facts">
                <div><dt>Vehicle type</dt><dd>{selectedVehicle.vehicle_type}</dd></div>
                <div><dt>Ownership</dt><dd>{titleCase(selectedVehicle.ownership_kind)}</dd></div>
                <div><dt>Owner / contractor</dt><dd>{selectedVehicle.owner_name||'Not provided'}</dd></div>
                <div><dt>Site</dt><dd>{selectedVehicle.site||'Not provided'}</dd></div>
                <div><dt>Assigned operator</dt><dd>{selectedVehicle.operator_ref||'Not provided'}</dd></div>
                <div><dt>Source ID</dt><dd>{selectedVehicle.sensor_source||'Not provided'}</dd></div>
                <div><dt>Device status</dt><dd>{titleCase(selectedVehicle.device_status)} (manually entered)</dd></div>
                <div><dt>Operating hours</dt><dd>{selectedVehicle.operating_hours} (entered, not verified)</dd></div>
              </dl>
              <h3>Cases associated with vehicle</h3>
              <div className="safety-linked">{cases.filter(c=>c.vehicle_id===selectedVehicle.id).map(c=>
                <a href="#cases" key={c.id} onClick={()=>setSelectedCaseId(c.id)}>{c.title}<ArrowRight size={13}/></a>)}</div>
            </> : <div className="safety-empty">Select a vehicle to see its details.</div>)}

          {!formKind && view === 'cases' && (selectedCase
            ? <>
              <div className="safety-detail-header"><span className="safety-eyebrow">{selectedCase.is_demo ? 'DEMO CASE' : 'ORGANIZATION CASE'} · {selectedCase.id.slice(0, 8)}</span><h2>{selectedCase.title}</h2>
                <div className="safety-chips"><span className="safety-pill">{titleCase(selectedCase.classification)}</span>
                  <span className="safety-pill">{titleCase(selectedCase.status)}</span>
                  <span className="safety-pill">{titleCase(selectedCase.potential_severity)} potential</span></div>
                {canEdit && <button className="safety-inline-edit" onClick={()=>startCase(selectedCase)}>Edit case</button>}</div>
              <dl className="safety-facts">
                <div><dt>Occurred</dt><dd>{dateLabel(selectedCase.occurred_at)}</dd></div>
                <div><dt>Vehicle</dt><dd>{vehicles.find(v=>v.id===selectedCase.vehicle_id)?.name||'Not linked'}</dd></div>
                <div><dt>Site / zone</dt><dd>{selectedCase.zone||'Not provided'}</dd></div>
                <div><dt>Operator then</dt><dd>{selectedCase.operator_at_event||'Unknown'}</dd></div>
                <div><dt>Worker reference</dt><dd>{selectedCase.worker_ref||'Unknown'}</dd></div>
                <div><dt>Shift</dt><dd>{selectedCase.shift_name||'Unknown'}</dd></div>
                <div><dt>Source</dt><dd>{selectedCase.source_label}</dd></div>
                <div><dt>Grouped observations</dt><dd>{selectedCase.observation_count}</dd></div>
              </dl>
              <h3>Assessment</h3><p className="safety-text">{selectedCase.summary||'No assessment yet.'}</p>
              <h3>Evidence</h3><p className="safety-text">{selectedCase.evidence_notes||'No independent evidence documented yet.'}</p>
              <h3>Pattern notes</h3><p className="safety-text">{selectedCase.pattern_notes||'No trend assessment yet.'}</p>
              <div className="safety-section-head"><h3>Corrective actions</h3>{canEdit && <button className="safety-inline-edit" onClick={()=>startAction()}>+ Add action</button>}</div>
              {actions.filter(a=>a.case_id===selectedCase.id).length===0 && <p className="safety-text">No actions assigned.</p>}
              {actions.filter(a=>a.case_id===selectedCase.id).map(action=><div className="safety-action" key={action.id}>
                <strong>{action.title}</strong>
                <div><ClipboardCheck size={15}/> {action.owner_ref||'Owner not assigned'}</div>
                <div>Due: {action.due_date||'Not set'} · {titleCase(action.status)}</div>
                {action.verification_notes && <p className="safety-text">{action.verification_notes}</p>}
                {canEdit && <button className="safety-inline-edit" onClick={()=>startAction(action)}>Edit action</button>}
              </div>)}
            </> : <div className="safety-empty">Select a case to review the details.</div>)}
        </aside>
      </div>
      <p className="safety-persistence-footnote">Data shown here are stored in Supabase for your selected organization. Records marked DEMO are fictional and must not be included in verified incident statistics. Physical sensor events are not automatically converted to cases yet.</p>
    </>}
  </section>;
}
