import { AlertTriangle, ArrowRight, ClipboardCheck, ShieldCheck, Truck, UserRoundCheck } from 'lucide-react';
import { demoCases, demoVehicles, type DemoCase } from './demoSafetyData';
import './DemoBusinessOverview.css';

type Props = {
  sessionCases: DemoCase[];
  onOpenCase: (id: string) => void;
};

const needsAttention = (item: DemoCase) =>
  item.status === 'Needs review' || item.status === 'Investigating';
const openAction = (item: DemoCase) =>
  item.recommendedAction && item.recommendedAction.status !== 'Completed';
const statusClass = (status: string) => status === 'Needs review' ? 'attention' :
  status === 'Investigating' ? 'investigating' : 'progress';

export default function DemoBusinessOverview({ sessionCases, onOpenCase }: Props) {
  const cases = [...sessionCases, ...demoCases];
  const queue = cases.filter(needsAttention);
  const actions = cases.filter(openAction);
  const reviewed = cases.filter(item => item.classification === 'Reviewed near miss');
  const highPriority = [...queue].sort((a, b) => {
    const severity = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return severity[b.potentialSeverity] - severity[a.potentialSeverity];
  });
  const assets = demoVehicles.map(vehicle => {
    const linked = cases.filter(item => item.vehicleId === vehicle.id);
    return {
      ...vehicle,
      cases: linked.length,
      reviewed: linked.filter(item => item.classification === 'Reviewed near miss').length,
    };
  }).sort((a, b) => b.cases - a.cases);

  return <section className="business-overview">
    <div className="business-overview-heading">
      <div>
        <div className="panel-kicker">HALO / SAFETY INTELLIGENCE</div>
        <h1 className="display-heading">Safety operations at a glance</h1>
        <p>Identify recurring equipment hazards, review observations, and track corrective actions.</p>
      </div>
      <span className="business-demo-pill"><ShieldCheck size={15}/> Fictional demo</span>
    </div>
    <div className="business-demo-note">
      <ShieldCheck size={17}/>
      <span><strong>Illustrative business walkthrough.</strong> All cases, equipment, worker tags and trends below are fictional.
        Session cases created from the simulator are stored only in this browser session and never become real incidents.</span>
    </div>
    <div className="business-overview-kpis">
      <div className="business-kpi">
        <span><AlertTriangle size={15}/> Awaiting attention</span>
        <strong>{queue.length}</strong>
        <small>Candidates or investigations</small>
      </div>
      <div className="business-kpi">
        <span><UserRoundCheck size={15}/> Reviewed near misses</span>
        <strong>{reviewed.length}</strong>
        <small>Human-reviewed sample cases</small>
      </div>
      <div className="business-kpi">
        <span><ClipboardCheck size={15}/> Outstanding actions</span>
        <strong>{actions.length}</strong>
        <small>Open or in progress</small>
      </div>
      <div className="business-kpi">
        <span><Truck size={15}/> Equipment in demo</span>
        <strong>{demoVehicles.length}</strong>
        <small>Across example work sites</small>
      </div>
    </div>
    <div className="business-overview-columns">
      <section className="business-panel" aria-label="Priority safety case queue">
        <div className="business-panel-head">
          <div><span className="panel-kicker">TRIAGE / PRIORITY</span><h2>Cases needing review</h2></div>
          <a href="#cases">View all <ArrowRight size={14}/></a>
        </div>
        <div className="business-case-queue">
          {highPriority.slice(0, 3).map(item => {
            const vehicle = demoVehicles.find(asset => asset.id === item.vehicleId);
            return <button key={item.id} type="button" className="business-case-item"
              onClick={() => onOpenCase(item.id)}>
              <div className="business-case-top">
                <span>{item.id} · {vehicle?.assetTag || 'Simulation'}</span>
                <span className={'business-status ' + statusClass(item.status)}>{item.status}</span>
              </div>
              <strong>{item.title}</strong>
              <div className="business-case-bottom">
                <span>{vehicle?.name || 'Unassigned vehicle'} · {item.zone}</span>
                <ArrowRight size={15}/>
              </div>
            </button>;
          })}
        </div>
      </section>
      <section className="business-panel" aria-label="Corrective action tracker">
        <div className="business-panel-head">
          <div><span className="panel-kicker">FOLLOW-UP / OWNERSHIP</span><h2>Corrective actions</h2></div>
          <a href="#cases">Review <ArrowRight size={14}/></a>
        </div>
        <div className="business-action-list">
          {actions.slice(0, 3).map(item => <button type="button" className="business-action-item" key={item.id}
            onClick={() => onOpenCase(item.id)}>
            <div className="business-action-title"><ClipboardCheck size={17}/><strong>{item.recommendedAction!.title}</strong></div>
            <div className="business-action-meta">
              <span>{item.recommendedAction!.owner}</span>
              <span className={'business-status ' + (item.recommendedAction!.status === 'Open' ? 'attention' : 'progress')}>{item.recommendedAction!.status}</span>
            </div>
            <small>{item.id} · Due {new Date(item.recommendedAction!.due + 'T12:00:00').toLocaleDateString()}</small>
          </button>)}
        </div>
      </section>
    </div>
    <section className="business-panel business-fleet" aria-label="Equipment risk overview">
      <div className="business-panel-head">
        <div><span className="panel-kicker">FLEET / VISIBILITY</span><h2>Equipment requiring attention</h2></div>
        <a href="#vehicles">Explore fleet <ArrowRight size={14}/></a>
      </div>
      <div className="business-fleet-list">
        {assets.slice(0, 3).map(asset => <div className="business-fleet-item" key={asset.id}>
          <div><strong>{asset.name}</strong><small>{asset.assetTag} · {asset.site}</small></div>
          <span><b>{asset.cases}</b> linked cases</span>
          <span><b>{asset.reviewed}</b> reviewed near misses</span>
        </div>)}
      </div>
      <p>Sample counts show reviewed records, not a measured safety-risk ranking. Compare operations only with verified exposure and consistent detection coverage.</p>
    </section>
    <div className="business-next">
      <div><strong>See how a new safety observation enters the workflow.</strong>
        <span>Run a blind-spot scenario, then review it as a candidate case.</span></div>
      <a href="#simulation">Open scenario simulator <ArrowRight size={16}/></a>
    </div>
  </section>;
}
