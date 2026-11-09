import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, BadgeCheck, Clock3, ClipboardCheck, HardHat, ShieldCheck, Truck } from 'lucide-react';
import { demoCases, demoVehicles, mergeDemoCases, type DemoCase, type DemoAction, type CaseClassification, type DemoReviewInput } from './demoSafetyData';
import './SafetyWorkspace.css';

type Props = {
  view: 'cases' | 'vehicles';
  isDemoAccount: boolean;
  sessionCases?: DemoCase[];
  preferredCaseId?: string;
  onReviewCase?: (caseId: string, input: DemoReviewInput) => void;
};
type Filter = 'All' | 'Needs attention' | 'Reviewed near miss' | 'Other signals';

const prettyDate = (value: string) => new Date(value).toLocaleString(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

function statusClass(status: string) {
  if (status === 'Needs review' || status === 'Critical' || status === 'Device fault') return 'needs-review';
  if (status === 'Dismissed' || status === 'False alarm') return 'dismissed';
  if (status === 'Closed' || status === 'Monitoring' || status === 'Completed') return 'resolved';
  return 'in-progress';
}

function ReviewEditor({ selected, sessionCase, onReviewCase }: {
  selected: DemoCase;
  sessionCase: boolean;
  onReviewCase?: (caseId: string, input: DemoReviewInput) => void;
}) {
  const [classification, setClassification] = useState<CaseClassification>(selected.classification);
  const [reviewNote, setReviewNote] = useState(selected.reviewNote || '');
  const [actionEnabled, setActionEnabled] = useState(Boolean(selected.recommendedAction));
  const [actionTitle, setActionTitle] = useState(selected.recommendedAction?.title || 'Review blind-zone layout and pedestrian routing');
  const [actionOwner, setActionOwner] = useState(selected.recommendedAction?.owner || 'Site safety manager');
  const [actionDue, setActionDue] = useState(selected.recommendedAction?.due || (() => {
    const date = new Date(); date.setDate(date.getDate() + 7);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  })());
  const [actionStatus, setActionStatus] = useState<DemoAction['status']>(selected.recommendedAction?.status || 'Open');
  const [validation, setValidation] = useState('');
  const [saved, setSaved] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onReviewCase) return;
    if (classification !== 'Candidate' && !reviewNote.trim()) {
      setValidation('Write a short review note before choosing a final classification.');
      return;
    }
    if (actionEnabled && (!actionTitle.trim() || !actionOwner.trim() || !actionDue)) {
      setValidation('Please fill in the action, responsible person and due date.');
      return;
    }
    const recommendedAction: DemoAction | null = actionEnabled
      ? { title: actionTitle.trim(), owner: actionOwner.trim(), due: actionDue, status: actionStatus }
      : null;
    try {
      onReviewCase(selected.id, { classification, reviewNote, recommendedAction });
      setValidation('');
      setSaved(true);
    } catch (error) {
      setValidation(error instanceof Error ? error.message : 'Could not update review.');
    }
  }

  const touched = () => { setSaved(false); setValidation(''); };
  return <details className="safety-review-editor" open={undefined} key={selected.id}>
    <summary><span><ClipboardCheck size={16}/> Review & corrective action</span><small>{sessionCase ? 'Review new simulated observation' : 'Edit sample case'}</small></summary>
    <form onSubmit={submit}>
      <div className="safety-review-grid">
        <label>Classification
          <select value={classification} onChange={event => { setClassification(event.target.value as CaseClassification); touched(); }}>
            <option value="Candidate">Candidate — needs review</option>
            <option value="Reviewed near miss">Reviewed near miss</option>
            <option value="False alarm">False alarm</option>
            <option value="Device fault">Device fault</option>
          </select>
        </label>
        <label className="review-wide">Review comment
          <textarea value={reviewNote} onChange={event => { setReviewNote(event.target.value); touched(); }}
            placeholder="Summarize the evidence and explain your decision…"
            rows={2} maxLength={1200} required={classification !== 'Candidate'}/>
        </label>
      </div>
      <label className="safety-review-action-toggle">
        <input type="checkbox" checked={actionEnabled} onChange={event => { setActionEnabled(event.target.checked); touched(); }}/>
        Assign or update a corrective action
      </label>
      {actionEnabled && <div className="safety-review-grid">
        <label className="review-wide">Required corrective action
          <input type="text" required maxLength={240} value={actionTitle}
            onChange={event => { setActionTitle(event.target.value); touched(); }}/>
        </label>
        <label>Responsible person / role
          <input type="text" required maxLength={120} value={actionOwner}
            onChange={event => { setActionOwner(event.target.value); touched(); }}/>
        </label>
        <label>Due date
          <input type="date" required value={actionDue}
            onChange={event => { setActionDue(event.target.value); touched(); }}/>
        </label>
        <label>Action status
          <select value={actionStatus} onChange={event => { setActionStatus(event.target.value as DemoAction['status']); touched(); }}>
            <option value="Open">Open</option><option value="In progress">In progress</option>
            <option value="Completed">Completed</option>
          </select>
        </label>
      </div>}
      {validation && <p className="safety-review-error" role="alert">{validation}</p>}
      <div className="safety-review-footer">
        <span>{saved ? 'Saved in this browser session.' : 'Sample workflow only · no Supabase write'}</span>
        <button type="submit" className="safety-review-save"><ClipboardCheck size={15}/> Save review</button>
      </div>
    </form>
  </details>;
}

function CaseDetails({ selected, onReviewCase, sessionCase }: {
  selected: DemoCase;
  onReviewCase?: (caseId: string, input: DemoReviewInput) => void;
  sessionCase?: boolean;
}) {
  const vehicle = demoVehicles.find(item => item.id === selected.vehicleId);
  const impact = selected.impact;
  const before = impact && impact.beforeHours > 0 ? (impact.beforeAlerts / impact.beforeHours * 100) : null;
  const after = impact && impact.afterHours > 0 ? (impact.afterAlerts / impact.afterHours * 100) : null;
  return <aside className="safety-detail" aria-label="Case details">
    <div className="safety-detail-header">
      <span className="safety-eyebrow">{selected.id} · {selected.classification}</span>
      <h2>{selected.title}</h2>
      <div className="safety-chips">
        <span className={'safety-pill ' + statusClass(selected.status)}>{selected.status}</span>
        <span className={'safety-pill ' + statusClass(selected.potentialSeverity)}>{selected.potentialSeverity} potential</span>
      </div>
    </div>

    <h3>Operational context</h3>
    <dl className="safety-facts">
      <div><dt>Time</dt><dd>{prettyDate(selected.occurredAt)}</dd></div>
      <div><dt>Site / zone</dt><dd>{vehicle?.site} · {selected.zone}</dd></div>
      <div><dt>Equipment</dt><dd>{vehicle?.name} ({vehicle?.assetTag})</dd></div>
      <div><dt>Fleet owner</dt><dd>{vehicle?.owner}</dd></div>
      <div><dt>Operator at event</dt><dd>{selected.operator}</dd></div>
      <div><dt>Worker tag</dt><dd>{selected.workerTag}</dd></div>
      <div><dt>Shift</dt><dd>{selected.shift}</dd></div>
      <div><dt>Source</dt><dd>{selected.source}</dd></div>
      <div><dt>Observations</dt><dd>{selected.observations} grouped into 1 case</dd></div>
    </dl>

    <h3>Evidence & provenance</h3>
    <ul className="safety-evidence">{selected.evidence.map(item => <li key={item}>{item}</li>)}</ul>
    <h3>Assessment</h3>
    <p>{selected.assessment}</p>
    <h3>Repeat-risk context</h3>
    <p>{selected.pattern}</p>

    {selected.recommendedAction && <>
      <h3>Corrective action</h3>
      <div className="safety-action">
        <strong>{selected.recommendedAction.title}</strong>
        <div><ClipboardCheck size={15} /> {selected.recommendedAction.owner}</div>
        <div><Clock3 size={15} /> Due {new Date(selected.recommendedAction.due + 'T12:00:00').toLocaleDateString()}</div>
        <span className={'safety-pill ' + statusClass(selected.recommendedAction.status)}>{selected.recommendedAction.status}</span>
      </div>
    </>}
    {selected.reviewNote && <div className="safety-reviewed-note">
      <strong>Reviewer comment</strong><p>{selected.reviewNote}</p>
      {selected.reviewedAt && <small>Reviewed {prettyDate(selected.reviewedAt)}</small>}
    </div>}
    <ReviewEditor key={selected.id} selected={selected} sessionCase={Boolean(sessionCase)} onReviewCase={onReviewCase}/>
    {impact && before !== null && after !== null && <div className="safety-impact">
      <h3>Intervention follow-up (sample)</h3>
      <div className="safety-rate-row"><span>Before</span><strong>{before.toFixed(1)} alerts / 100 vehicle-hours</strong></div>
      <div className="safety-rate-row"><span>After</span><strong>{after.toFixed(1)} alerts / 100 vehicle-hours</strong></div>
      <small>Illustrative exposure-adjusted alert rates based on {impact.beforeAlerts} alerts / {impact.beforeHours} h and {impact.afterAlerts} alerts / {impact.afterHours} h. Not injury rates or evidence of causality.</small>
    </div>}
  </aside>;
}

export default function SafetyWorkspace({ view, isDemoAccount, sessionCases = [], preferredCaseId, onReviewCase }: Props) {
  const [filter, setFilter] = useState<Filter>('All');
  const [selectedId, setSelectedId] = useState(preferredCaseId || demoCases[0].id);
  useEffect(() => { if (preferredCaseId) setSelectedId(preferredCaseId); }, [preferredCaseId]);
  const allCases = useMemo(() => mergeDemoCases(sessionCases), [sessionCases]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(demoVehicles[0].id);
  const [site, setSite] = useState('All sites');
  const selected = allCases.find(item => item.id === selectedId) || allCases[0];
  const selectedVehicle = demoVehicles.find(item => item.id === selectedVehicleId) || demoVehicles[0];
  const sites = ['All sites', ...new Set(demoVehicles.map(item => item.site))];
  const vehicleIds = new Set(demoVehicles.filter(item => site === 'All sites' || item.site === site).map(item => item.id));
  const cases = useMemo(() => allCases.filter(item => {
    if (!vehicleIds.has(item.vehicleId)) return false;
    if (filter === 'Needs attention') return ['Needs review', 'Investigating', 'Action assigned'].includes(item.status);
    if (filter === 'Reviewed near miss') return item.classification === 'Reviewed near miss';
    if (filter === 'Other signals') return item.classification === 'Device fault' || item.classification === 'False alarm';
    return true;
  }), [allCases, filter, site]);

  const needsReview = allCases.filter(item => item.status === 'Needs review' || item.status === 'Investigating').length;
  const confirmed = allCases.filter(item => item.classification === 'Reviewed near miss').length;
  const openActions = allCases.filter(item => item.recommendedAction && item.recommendedAction.status !== 'Completed').length;

  if (!isDemoAccount) return <section className="safety-page">
    <h1 className="display-heading">{view === 'cases' ? 'Cases' : 'Vehicles'}</h1>
    <div className="safety-no-data">
      <ShieldCheck size={30}/>
      <h2>No {view === 'cases' ? 'investigation cases' : 'fleet inventory'} connected</h2>
      <p>This module is being designed. Your organization's real sensor events remain available in Overview; no fictional cases have been added to your account.</p>
    </div>
  </section>;

  return <section className="safety-page">
    <div className="safety-page-heading">
      <div>
        <div className="safety-eyebrow">SAFETY INTELLIGENCE / DEMONSTRATION</div>
        <h1 className="display-heading">{view === 'cases' ? 'Cases' : 'Vehicles'}</h1>
        <p>{view === 'cases' ? 'Explore sample safety cases and track corrective actions.' : 'Explore sample equipment, operating context and linked safety cases.'}</p>
      </div>
    </div>
    <div className="safety-kpis">
      <div><span>Cases in sample</span><strong>{allCases.length}</strong><small>Includes unreviewed and invalid signals</small></div>
      <div><span>Awaiting review</span><strong>{needsReview}</strong><small>Human confirmation needed</small></div>
      <div><span>Reviewed near misses</span><strong>{confirmed}</strong><small>Sample human-reviewed classification</small></div>
      <div><span>Outstanding actions</span><strong>{openActions}</strong><small>Open or in progress</small></div>
    </div>
    {view === 'cases' ? <>
      <div className="safety-filters">
        <div className="safety-filter-buttons" role="group" aria-label="Filter cases">
          {(['All', 'Needs attention', 'Reviewed near miss', 'Other signals'] as Filter[]).map(value =>
            <button key={value} type="button" className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value}</button>
          )}
        </div>
        <label>Site <select value={site} onChange={event => setSite(event.target.value)}>{sites.map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <div className="safety-case-layout">
        <div className="safety-cases">
          {cases.length === 0 && <p className="safety-empty">No sample cases match these filters.</p>}
          {cases.map(item => {
            const asset = demoVehicles.find(vehicle => vehicle.id === item.vehicleId);
            return <button type="button" className={'safety-case-row' + (selected.id === item.id ? ' selected' : '')} key={item.id} onClick={() => setSelectedId(item.id)}>
              <div className="safety-case-top"><span>{item.id} · {prettyDate(item.occurredAt)}</span><span className={'safety-pill ' + statusClass(item.status)}>{item.status}</span></div>
              <strong>{item.title}</strong>
              <div className="safety-case-meta"><Truck size={14}/>{asset?.name} · {item.zone}</div>
              <div className="safety-case-bottom"><span>{item.observations} observations · 1 case</span><span className="safety-view-link">View details <ArrowRight size={14}/></span></div>
            </button>;
          })}
        </div>
        <CaseDetails selected={cases.find(item => item.id === selected.id) || cases[0] || selected}
          sessionCase={sessionCases.some(item => item.id === (cases.find(item => item.id === selected.id) || cases[0] || selected).id)}
          onReviewCase={onReviewCase}/>
      </div>
    </> : <>
      <div className="safety-vehicle-layout">
        <div className="safety-vehicles" aria-label="Vehicles">
          {demoVehicles.map(item => {
            const linked = allCases.filter(c => c.vehicleId === item.id);
            const verified = linked.filter(c => c.classification === 'Reviewed near miss').length;
            return <button key={item.id} type="button" className={'safety-vehicle-row' + (item.id === selectedVehicle.id ? ' selected' : '')} onClick={() => setSelectedVehicleId(item.id)}>
              <div className="safety-vehicle-title"><Truck size={19}/><strong>{item.name}</strong></div>
              <div className="safety-case-meta">{item.assetTag} · {item.site}</div>
              <div className="safety-vehicle-bottom"><span>{verified} reviewed cases</span><span>{item.operatingHours} h / sample period</span></div>
            </button>;
          })}
        </div>
        <div className="safety-detail">
          <div className="safety-detail-header"><span className="safety-eyebrow">FLEET ASSET / {selectedVehicle.assetTag}</span><h2>{selectedVehicle.name}</h2><span className={'safety-pill ' + (selectedVehicle.deviceState === 'Online' ? 'resolved' : 'needs-review')}>{selectedVehicle.deviceState}</span></div>
          <dl className="safety-facts">
            <div><dt>Equipment class</dt><dd>{selectedVehicle.type}</dd></div>
            <div><dt>Owner / rental</dt><dd>{selectedVehicle.owner}</dd></div>
            <div><dt>Assigned operator</dt><dd>{selectedVehicle.assignedOperator}</dd></div>
            <div><dt>Site</dt><dd>{selectedVehicle.site}</dd></div>
            <div><dt>Source / device</dt><dd>{selectedVehicle.device}</dd></div>
            <div><dt>Operating exposure</dt><dd>{selectedVehicle.operatingHours} sample hours</dd></div>
          </dl>
          <h3>Equipment-level signals</h3>
          {(() => {
            const linked = allCases.filter(c => c.vehicleId === selectedVehicle.id);
            const verified = linked.filter(c => c.classification === 'Reviewed near miss').length;
            const rate = selectedVehicle.operatingHours > 0 ? (verified / selectedVehicle.operatingHours * 100) : 0;
            return <><div className="safety-fleet-stats"><div><strong>{linked.length}</strong><span>Linked cases</span></div><div><strong>{verified}</strong><span>Reviewed near misses</span></div><div><strong>{rate.toFixed(2)}</strong><span>Cases per 100 operating h</span></div></div>
              <small className="safety-footnote">Illustrative sample. Valid operational comparison requires complete exposure hours, reliable detection coverage and consistent review criteria.</small>
              <div className="safety-linked">{linked.map(item => <a key={item.id} href="#cases" onClick={() => setSelectedId(item.id)}>{item.id} · {item.title} <ArrowRight size={13}/></a>)}</div>
            </>;
          })()}
        </div>
      </div>
    </>}
  </section>;
}
