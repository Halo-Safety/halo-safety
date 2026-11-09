import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, ClipboardCheck, RadioTower, Truck, UserRoundCheck } from 'lucide-react';
import { demoCases, demoVehicles, mergeDemoCases, type DemoCase } from './demoSafetyData';
import { listSafetyOrganizations, loadSafetyData, type SafetyCase, type CorrectiveAction, type Vehicle } from './safetyApi';
import './DemoBusinessOverview.css';
import { getSelectedSafetyOrg } from './safetyOrgPreference';

export type LiveOverviewStats = {
  totalSignals: number;
  activeWarnings: number;
  todaySignals: number;
  machinesObserved: number;
  historyCount: number;
  online: boolean;
  error: string | null;
  chart: { key: string; label: string; count: number }[];
};

type Props = {
  isDemoAccount: boolean;
  sessionCases: DemoCase[];
  onOpenCase: (id: string) => void;
  live: LiveOverviewStats;
};

type ViewCase = {
  id: string;
  title: string;
  vehicleId: string | null;
  zone: string;
  status: string;
  severity: string;
  classification: string;
};
type ViewAction = { id: string; caseId: string; title: string; owner: string; due: string | null; status: string };
type ViewVehicle = { id: string; name: string; tag: string; site: string; cases: number; reviewed: number };
type OrganizationSnapshot = { name: string; cases: SafetyCase[]; actions: CorrectiveAction[]; vehicles: Vehicle[] };

const needsReview = (record: ViewCase) => ['Needs review', 'Investigating', 'needs_review', 'investigating'].includes(record.status);
const reviewed = (record: ViewCase) => record.classification === 'Reviewed near miss' || record.classification === 'reviewed_near_miss';
const pendingAction = (action: ViewAction) => action.status !== 'Completed' && action.status !== 'completed';
const priority = (severity: string) => ({ critical: 4, high: 3, medium: 2, low: 1 })[severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low'] || 0;
const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, match => match.toUpperCase());

export default function DemoBusinessOverview({ isDemoAccount, sessionCases, onOpenCase, live }: Props) {
  const [organization, setOrganization] = useState<OrganizationSnapshot | null>(null);
  const [orgLoading, setOrgLoading] = useState(!isDemoAccount);
  const [orgError, setOrgError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoAccount) return;
    let cancelled = false;
    void (async () => {
      try {
        const available = await listSafetyOrganizations();
        const preferred = getSelectedSafetyOrg();
        const first = available.find(org => org.id === preferred) || available[0];
        if (!first) {
          if (!cancelled) setOrgError('No organization membership found.');
          return;
        }
        const snapshot = await loadSafetyData(first.id);
        if (!cancelled) setOrganization({ name: first.name, ...snapshot });
      } catch (error) {
        if (!cancelled) setOrgError(error instanceof Error ? error.message : 'Unable to load organization summary.');
      } finally {
        if (!cancelled) setOrgLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isDemoAccount]);

  const demo = mergeDemoCases(sessionCases, demoCases);
  const cases: ViewCase[] = isDemoAccount
    ? demo.map(record => ({
      id: record.id, title: record.title, vehicleId: record.vehicleId, zone: record.zone,
      status: record.status, severity: record.potentialSeverity, classification: record.classification,
    }))
    : (organization?.cases || []).map(record => ({
      id: record.id, title: record.title, vehicleId: record.vehicle_id, zone: record.zone,
      status: record.status, severity: record.potential_severity, classification: record.classification,
    }));
  const actions: ViewAction[] = isDemoAccount
    ? demo.flatMap(record => record.recommendedAction ? [{
      id: record.id + '-action', caseId: record.id,
      title: record.recommendedAction.title, owner: record.recommendedAction.owner,
      due: record.recommendedAction.due, status: record.recommendedAction.status,
    }] : [])
    : (organization?.actions || []).map(record => ({
      id: record.id, caseId: record.case_id, title: record.title, owner: record.owner_ref,
      due: record.due_date, status: record.status,
    }));
  const equipment: ViewVehicle[] = (isDemoAccount
    ? demoVehicles.map(item => ({ id: item.id, name: item.name, tag: item.assetTag, site: item.site }))
    : (organization?.vehicles || []).map(item => ({ id: item.id, name: item.name, tag: item.asset_tag, site: item.site }))
  ).map(item => ({
    ...item,
    cases: cases.filter(record => record.vehicleId === item.id).length,
    reviewed: cases.filter(record => record.vehicleId === item.id && reviewed(record)).length,
  })).sort((a, b) => b.cases - a.cases);
  const needingReview = cases.filter(needsReview).sort((a, b) => priority(b.severity) - priority(a.severity));
  const outstanding = actions.filter(pendingAction);
  const isWaiting = !isDemoAccount && orgLoading && !organization;
  const numberOrWaiting = (count: number) => isWaiting ? '—' : count;
  const openCase = (id: string) => onOpenCase(id);
  const maxChart = Math.max(1, ...live.chart.map(point => point.count));

  return <section className="business-overview">
    <div className="business-overview-heading">
      <div>
        <div className="panel-kicker">HALO / SAFETY OPERATIONS</div>
        <h1 className="display-heading">Safety operations at a glance</h1>
        <p>Review observations, manage corrective actions and monitor incoming sensor activity.
</p>
        {orgError && <p className="business-inline-error">Organization summary unavailable: {orgError}</p>}
      </div>
    </div>
    <div className="business-overview-kpis">
      <div className="business-kpi"><span><AlertTriangle size={15}/> Cases awaiting review</span>
        <strong>{numberOrWaiting(needingReview.length)}</strong><small>Open investigations</small></div>
      <div className="business-kpi"><span><UserRoundCheck size={15}/> Reviewed near misses</span>
        <strong>{numberOrWaiting(cases.filter(reviewed).length)}</strong><small>Human-reviewed classifications</small></div>
      <div className="business-kpi"><span><ClipboardCheck size={15}/> Outstanding actions</span>
        <strong>{numberOrWaiting(outstanding.length)}</strong><small>Open or in progress</small></div>
      <div className="business-kpi"><span><Truck size={15}/> Equipment records</span>
        <strong>{numberOrWaiting(equipment.length)}</strong><small>Linked fleet inventory</small></div>
    </div>
    <div className="business-overview-columns">
      <section className="business-panel" aria-label="Priority safety case queue">
        <div className="business-panel-head">
          <div><span className="panel-kicker">PRIORITY QUEUE</span><h2>Cases needing review</h2></div>
          <a href="#cases">View all <ArrowRight size={14}/></a>
        </div>
        <div className="business-case-queue">
          {needingReview.slice(0, 3).map(record => {
            const vehicle = equipment.find(item => item.id === record.vehicleId);
            return <button key={record.id} type="button" className="business-case-item" onClick={() => openCase(record.id)}>
              <div className="business-case-top"><span>{record.id.slice(0, 11)} · {vehicle?.tag || 'Unassigned'}</span>
                <span className={'business-status ' + (record.status.toLowerCase().includes('review') ? 'attention' : 'investigating')}>{titleCase(record.status)}</span></div>
              <strong>{record.title}</strong>
              <div className="business-case-bottom"><span>{vehicle?.name || 'Unassigned equipment'} · {record.zone}</span>
                <ArrowRight size={15}/></div>
            </button>;
          })}
          {!isWaiting && needingReview.length === 0 && <p className="business-empty">No cases currently awaiting review.</p>}
          {isWaiting && <p className="business-empty">Loading organization cases…</p>}
        </div>
      </section>
      <section className="business-panel" aria-label="Corrective action tracker">
        <div className="business-panel-head">
          <div><span className="panel-kicker">ACTION TRACKER</span><h2>Corrective actions</h2></div>
          <a href="#cases">Review <ArrowRight size={14}/></a>
        </div>
        <div className="business-action-list">
          {outstanding.slice(0, 3).map(action => <button type="button" className="business-action-item"
            key={action.id} onClick={() => openCase(action.caseId)}>
            <div className="business-action-title"><ClipboardCheck size={17}/><strong>{action.title}</strong></div>
            <div className="business-action-meta"><span>{action.owner || 'Unassigned'}</span>
              <span className={'business-status ' + (action.status.toLowerCase() === 'open' ? 'attention' : 'progress')}>{titleCase(action.status)}</span></div>
            <small>{action.caseId.slice(0, 11)} · {action.due ? 'Due ' + new Date(action.due + 'T12:00:00').toLocaleDateString() : 'No due date'}</small>
          </button>)}
          {!isWaiting && outstanding.length === 0 && <p className="business-empty">No outstanding corrective actions.</p>}
          {isWaiting && <p className="business-empty">Loading corrective actions…</p>}
        </div>
      </section>
    </div>
    <section className="business-panel business-fleet" aria-label="Equipment activity">
      <div className="business-panel-head">
        <div><span className="panel-kicker">EQUIPMENT OVERVIEW</span><h2>Equipment requiring attention</h2></div>
        <a href="#vehicles">Explore fleet <ArrowRight size={14}/></a>
      </div>
      <div className="business-fleet-list">
        {equipment.slice(0, 3).map(asset => <div className="business-fleet-item" key={asset.id}>
          <div><strong>{asset.name}</strong><small>{asset.tag} · {asset.site}</small></div>
          <span><b>{asset.cases}</b> linked cases</span><span><b>{asset.reviewed}</b> reviewed near misses</span>
        </div>)}
        {!isWaiting && equipment.length === 0 && <p className="business-empty">No equipment records yet.</p>}
      </div>
      <p>Case counts are descriptive, not a safety risk ranking; meaningful comparison needs consistent monitoring and operating exposure.</p>
    </section>
    <section className="business-panel business-live" aria-label="Live sensor activity">
      <div className="business-panel-head">
        <div><span className="panel-kicker">EVENT MONITORING</span><h2>Sensor activity</h2></div>
        <span className={'business-source-status ' + (live.online ? 'online' : '')}>
          <RadioTower size={13}/>{live.online ? 'Connected' : 'Unavailable'}</span>
      </div>
      <p className="business-live-description">Proximity alert activity and resolution history. FTM ranges are shown separately in Telemetry.
        {live.error ? ' Event service unavailable: ' + live.error : ''}</p>
      <div className="business-live-layout">
        <div className="business-live-stats">
          <a href="#history"><Activity size={15}/><span>Recorded alerts</span><strong>{live.online ? live.totalSignals : '—'}</strong></a>
          <a href="#alerts"><AlertTriangle size={15}/><span>Active warnings</span><strong>{live.online ? live.activeWarnings : '—'}</strong></a>
          <a href="#history"><RadioTower size={15}/><span>Signals today</span><strong>{live.online ? live.todaySignals : '—'}</strong></a>
          <a href="#telemetry"><Truck size={15}/><span>Machines observed</span><strong>{live.online ? live.machinesObserved : '—'}</strong></a>
        </div>
        <div className="business-live-chart">
          <span className="panel-kicker">LAST 7 DAYS · RECORDED ALERTS</span>
          <div className="business-live-bars">
            {live.chart.map(day => <div className="business-live-column" key={day.key}>
              <span>{live.online && day.count ? day.count : ''}</span>
              <div className="business-live-track"><div style={{height:(live.online ? day.count/maxChart*100 : 0) + '%'}}/></div>
              <small>{day.label}</small>
            </div>)}
          </div>
        </div>
      </div>
    </section>
    <div className="business-next">
      <div><strong>Explore how an observation becomes a reviewed case.</strong>
        <span>Generate an alert, review the observation, and assign corrective work.</span></div>
      <a href="#simulation">Open scenario simulator <ArrowRight size={16}/></a>
    </div>
  </section>;
}
