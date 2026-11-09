import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2,
  Clock3, Database, HardHat, RefreshCw, Route, ShieldCheck, Wifi, WifiOff, LogOut, ClipboardCheck, Truck, RadioTower, ArrowRight,
} from 'lucide-react';
import { getEvents } from './api';
import { eventType, type SensorEvent } from './types';
import SafetyModule from './SafetyModule';
import TelemetryPage from './TelemetryPage';
import DemoBusinessOverview from './DemoBusinessOverview';
import { demoVehicles, type DemoCase } from './demoSafetyData';

const POLL_INTERVAL_MS = 3000;

function eventDate(value?: string): Date | null {
  if (!value) return null;
  const normalized = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)
    ? value.replace(' ', 'T') + 'Z'
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function formatTime(value?: string): string {
  const date = eventDate(value);
  return date ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

function sortedEvents(events: SensorEvent[]): SensorEvent[] {
  return [...events].sort((a, b) => {
    const ta = eventDate(a.timestamp)?.getTime() ?? 0;
    const tb = eventDate(b.timestamp)?.getTime() ?? 0;
    return tb - ta || (b.id ?? 0) - (a.id ?? 0);
  });
}

function getActiveEvents(events: SensorEvent[]): SensorEvent[] {
  const active = new Map<string, SensorEvent>();
  // Consume oldest first so ALERT_CLEAR correctly closes prior proximity alerts.
  for (const event of [...sortedEvents(events)].reverse()) {
    const key = event.worker_id + ':' + event.machine_id;
    if (eventType(event) === 'PROXIMITY_ALERT') active.set(key, event);
    if (eventType(event) === 'ALERT_CLEAR') active.delete(key);
  }
  return [...active.values()].sort((a, b) =>
    (eventDate(b.timestamp)?.getTime() ?? 0) - (eventDate(a.timestamp)?.getTime() ?? 0));
}

function recentChart(events: SensorEvent[]) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index));
    return { key: dateKey(date), label: date.toLocaleDateString(undefined, { weekday: 'short' }), count: 0 };
  });
  const byDay = new Map(days.map((day) => [day.key, day]));
  for (const event of events) {
    if (eventType(event) !== 'PROXIMITY_ALERT') continue;
    const date = eventDate(event.timestamp);
    if (!date) continue;
    const day = byDay.get(dateKey(date));
    if (day) day.count += 1;
  }
  return days;
}

function EventBadge({ type }: { type: string }) {
  const clear = type === 'ALERT_CLEAR';
  const alert = type === 'PROXIMITY_ALERT';
  return (
    <span className={'event-badge ' + (alert ? 'is-alert' : clear ? 'is-clear' : 'is-muted')}>
      <span className="badge-dot" />
      {alert ? 'Proximity alert' : clear ? 'Alert cleared' : type.replaceAll('_', ' ').toLowerCase()}
    </span>
  );
}

type SimulationEvent = {
  id: number;
  event: 'PROXIMITY_ALERT' | 'ALERT_CLEAR';
  zone: string | null;
  timestamp: string;
};

type AppProps = {
  onExit: () => Promise<void>;
  userEmail: string;
};

export default function App({ onExit, userEmail }: AppProps) {
  const [events, setEvents] = useState<SensorEvent[]>([]);
  const [apiOnline, setApiOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState(() => window.location.hash.replace(/^#/, '') || 'overview');
  const simulationView = view === 'simulation';
  const caseView = view === 'cases';
  const alertsView = view === 'alerts';
  const historyView = view === 'history';
  const vehicleView = view === 'vehicles';
  // Keep old #hardware bookmarks working, but show the clearer Telemetry name.
  const telemetryView = view === 'telemetry' || view === 'hardware';
  const overviewView = !simulationView && !caseView && !vehicleView && !telemetryView && !alertsView && !historyView;
  const isTestAccount = userEmail.trim().toLowerCase() === 'test@ualberta.ca';
  const [overviewMode, setOverviewMode] = useState<'business' | 'live'>(isTestAccount ? 'business' : 'live');
  // Video walkthrough cases never touch Supabase; refresh resets this sandbox.
  const [sessionCases, setSessionCases] = useState<DemoCase[]>([]);
  const [preferredDemoCaseId, setPreferredDemoCaseId] = useState<string | undefined>();
  const simulatorFrame = useRef<HTMLIFrameElement>(null);
  const eventSequence = useRef(0);
  const [simulationEvents, setSimulationEvents] = useState<SimulationEvent[]>([]);
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulatorHeight, setSimulatorHeight] = useState(1030);

  useEffect(() => {
    const onHashChange = () => { setView(window.location.hash.replace(/^#/, '') || 'overview'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Only accept messages from our own same-origin simulation frame.
  // These events stay in React memory, never in production sensor_events.
  useEffect(() => {
    const onSimulatorMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== simulatorFrame.current?.contentWindow) return;
      const data: unknown = event.data;
      if (!data || typeof data !== 'object') return;
      const message = data as { source?: unknown; kind?: unknown; height?: unknown; event?: unknown; zone?: unknown };
      if (message.source !== 'halo-simulator') return;
      if (message.kind === 'resize') {
        if (typeof message.height === 'number' && Number.isFinite(message.height)) {
          setSimulatorHeight(Math.max(600, Math.min(2500, Math.ceil(message.height))));
        }
        return;
      }
      if (message.kind !== 'event' || (message.event !== 'PROXIMITY_ALERT' && message.event !== 'ALERT_CLEAR')) return;
      const type: SimulationEvent['event'] = message.event as SimulationEvent['event'];
      setSimulationActive(type === 'PROXIMITY_ALERT');
      const zone = typeof message.zone === 'string' ? message.zone.slice(0, 120) : null;
      setSimulationEvents(previous => [{
        id: ++eventSequence.current,
        event: type,
        zone,
        timestamp: new Date().toISOString(),
      }, ...previous].slice(0, 100));
    };
    window.addEventListener('message', onSimulatorMessage);
    return () => window.removeEventListener('message', onSimulatorMessage);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const history = await getEvents();
      setEvents(history);
      setApiOnline(true);
      setError(null);
      setLastUpdate(new Date());
    } catch (issue) {
      setApiOnline(false);
      setError(issue instanceof Error ? issue.message : 'Backend unavailable');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const ordered = useMemo(() => sortedEvents(events), [events]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'alerts' | 'cleared'>('all');
  const [historySearch, setHistorySearch] = useState('');
  const filteredHistory = useMemo(() => ordered.filter(item => {
    const type = eventType(item);
    if (historyFilter === 'alerts' && type !== 'PROXIMITY_ALERT') return false;
    if (historyFilter === 'cleared' && type !== 'ALERT_CLEAR') return false;
    const q = historySearch.trim().toLowerCase();
    return !q || [item.worker_id, item.machine_id, type, item.zone || ''].some(value => value.toLowerCase().includes(q));
  }), [ordered, historyFilter, historySearch]);
  const active = useMemo(() => getActiveEvents(events), [events]);
  const chart = useMemo(() => recentChart(events), [events]);
  const maxCount = Math.max(1, ...chart.map((day) => day.count));
  const totalAlerts = events.filter((event) => eventType(event) === 'PROXIMITY_ALERT').length;
  const today = dateKey(new Date());
  const todayAlerts = events.filter((event) =>
    eventType(event) === 'PROXIMITY_ALERT' && eventDate(event.timestamp) &&
    dateKey(eventDate(event.timestamp)!) === today).length;
  const machines = new Set(events.map((event) => event.machine_id).filter(Boolean)).size;
  const simulatedAlerts = simulationEvents.filter(event => event.event === 'PROXIMITY_ALERT').length;
  const latestSimulationAlert = simulationEvents.find(event => event.event === 'PROXIMITY_ALERT');
  const openDemoCase = (caseId: string) => {
    setPreferredDemoCaseId(caseId);
    window.location.hash = '#cases';
  };
  const reviewSimulationAlert = (observation: SimulationEvent) => {
    if (!isTestAccount || observation.event !== 'PROXIMITY_ALERT') return;
    const id = 'SIM-' + observation.id;
    const vehicle = demoVehicles[0];
    const zone = observation.zone || 'Vehicle approach zone';
    const candidate: DemoCase = {
      id,
      title: 'Simulated worker approach in ' + zone,
      occurredAt: observation.timestamp,
      vehicleId: vehicle.id,
      workerTag: 'WORKER-DEMO',
      operator: vehicle.assignedOperator,
      zone,
      shift: 'Simulation',
      source: 'Browser scenario simulator (demo only)',
      observations: 1,
      classification: 'Candidate',
      status: 'Needs review',
      potentialSeverity: 'High',
      evidence: [
        'Browser simulator emitted a proximity alert during a sample scenario.',
        'This candidate was not generated by a physical sensor.',
        'No real-world distance or incident has been independently verified.',
      ],
      assessment: 'Simulated warning recorded for demonstration. A real case would require supervisor confirmation and supporting evidence.',
      recommendedAction: null,
      pattern: 'One simulated encounter; no repeat-risk pattern can be inferred.',
    };
    setSessionCases(previous => previous.some(item => item.id === id) ? previous : [candidate, ...previous]);
    openDemoCase(id);
  };
  const assignDemoAction = (caseId: string) => {
    const due = new Date();
    due.setDate(due.getDate() + 7);
    setSessionCases(previous => previous.map(item => item.id === caseId ? {
      ...item,
      status: 'Action assigned',
      recommendedAction: {
        title: 'Review blind-zone layout and pedestrian routing',
        owner: 'Site safety manager (demo)',
        due: due.toISOString().slice(0, 10),
        status: 'Open',
      },
    } : item));
  };


  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Halo dashboard">
          <span className="brand-symbol"><ShieldCheck size={23} strokeWidth={1.65} /></span>
          <span><strong>halo<span className="brand-period">.</span></strong></span>
        </a>
        <div className="navigation-label">WORKSPACE</div>
        <nav className="nav-links" aria-label="Main navigation">
          <a className={"nav-link" + (overviewView ? " selected" : "")} href="#overview"><BarChart3 size={18} /> Overview</a>
          <a className={'nav-link' + (alertsView ? ' selected' : '')} href="#alerts"><AlertTriangle size={18} /> Active alerts <span className="nav-count">{active.length}</span></a>
          <a className={'nav-link' + (historyView ? ' selected' : '')} href="#history"><Database size={18} /> Event history</a>
          <a className={'nav-link' + (caseView ? ' selected' : '')} href="#cases"><ClipboardCheck size={18}/> Cases</a>
          <a className={'nav-link' + (vehicleView ? ' selected' : '')} href="#vehicles"><Truck size={18}/> Vehicles</a>
          <a className={'nav-link' + (telemetryView ? ' selected' : '')} href="#telemetry"><RadioTower size={18}/> Telemetry</a>
          <a className={'nav-link' + (simulationView ? ' selected' : '')} href="#simulation"><Route size={18} /> Simulation {simulatedAlerts > 0 && <span className="nav-count">{simulatedAlerts}</span>}</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="signed-in-user" title={userEmail}>{userEmail}</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>HALO</span><span className="breadcrumb-separator">/</span><strong>{simulationView ? 'Scenario lab' : caseView ? 'Cases' : vehicleView ? 'Vehicles' : telemetryView ? 'Telemetry' : alertsView ? 'Active alerts' : historyView ? 'Event history' : 'Overview'}</strong></div>
          <div className="topbar-right">
            <span
              className={'api-pill ' + (apiOnline ? 'online' : 'offline')}
              title="Cloud status reflects the Supabase event query, not ESP32 device connectivity."
              aria-label={apiOnline ? 'Cloud connected' : 'Cloud unavailable'}
            >
              {apiOnline ? <Wifi size={15}/> : <WifiOff size={15}/>}
              {apiOnline ? 'Cloud connected' : 'Cloud unavailable'}
            </span>
            <button type="button" className="icon-button" onClick={() => { setRefreshing(true); void refresh(); }} title="Refresh data" aria-label="Refresh data" disabled={refreshing}>
              <RefreshCw className={refreshing ? 'spin' : ''} size={18}/>
            </button>
            <button type="button" className="workspace-exit-button" onClick={() => { void onExit().catch(e => setError(e instanceof Error ? e.message : 'Could not sign out')); }} title="Sign out">
              <LogOut size={15}/><span>Sign out</span>
            </button>
          </div>
        </header>

        <div className="page-content">
          {(caseView || vehicleView) && <SafetyModule view={vehicleView ? 'vehicles' : 'cases'} isDemoAccount={isTestAccount} sessionCases={sessionCases} preferredCaseId={preferredDemoCaseId} onAddDemoAction={assignDemoAction}/>}
          {telemetryView && <TelemetryPage/>}
          <section className="simulator-page" aria-labelledby="simulation-heading" hidden={!simulationView}>
            <div className="simulation-heading">
              <div>
                <div className="panel-kicker">SCENARIO LAB / SANDBOX</div>
                <h1 id="simulation-heading" className="display-heading">Simulation</h1>
                <p className="simulator-intro">Plan routes, explore blind zones and see how warnings appear in Halo. This is a simulation; no real incidents are recorded.</p>
              </div>

            </div>

            <div className="simulation-stats" aria-label="This session's simulation results">
              <div><span>Simulated alerts</span><strong>{simulatedAlerts}</strong></div>
              <div><span>Current state</span><strong className={simulationActive ? 'danger-text' : ''}>{simulationActive ? 'Warning' : 'Clear'}</strong></div>
              <div><span>Events in session</span><strong>{simulationEvents.length}</strong></div>
            </div>
            {isTestAccount && latestSimulationAlert && <div className="simulation-quick-case">
              <div><AlertTriangle size={17}/>
                <span><strong>Scenario warning captured</strong> · {latestSimulationAlert.zone || 'Vehicle proximity zone'}
                  <small>Example observation — not a verified incident</small></span></div>
              <button type="button" onClick={() => reviewSimulationAlert(latestSimulationAlert)}>
                {sessionCases.some(item => item.id === 'SIM-' + latestSimulationAlert.id) ? 'Open sample case' : 'Review as sample case'}
                <ArrowRight size={15}/>
              </button>
            </div>}


            <div className="simulator-surface">
              <iframe
                ref={simulatorFrame}
                title="Halo blind spot scenario simulator"
                className="simulator-frame"
                src="/simulator/index.html"
                style={{ height: simulatorHeight + 'px' }}
                onLoad={() => setSimulationActive(false)}
                loading="eager"
              />
            </div>
            <section className="panel simulation-timeline" aria-label="Simulated event timeline">
              <div className="panel-header">
                <div><div className="panel-kicker">LOCAL SESSION / TEST EVENTS</div><h2>Simulation activity</h2></div>
                <span className="subtle-tag">Not real incidents</span>
              </div>
              {simulationEvents.length === 0
                ? <p className="simulation-empty">Move the worker into a blind zone or run a route to create a simulated alert.</p>
                : <div className="simulation-event-list">
                    {simulationEvents.slice(0, 8).map(item => (
                      <div className="simulation-event-row" key={item.id}>
                        <EventBadge type={item.event} />
                        <span>{item.zone || 'Vehicle safety zone'}</span>
                        <time>{formatTime(item.timestamp)}</time>
                        {isTestAccount && item.event === 'PROXIMITY_ALERT' &&
                          <button type="button" className="simulation-case-link" onClick={() => reviewSimulationAlert(item)}>
                            {sessionCases.some(c => c.id === 'SIM-' + item.id) ? 'Open sample case' : 'Review as sample case'} <ArrowRight size={14}/>
                          </button>}
                      </div>
                    ))}
                  </div>}
            </section>
          </section>
          {overviewView && <>
            {isTestAccount && <div className="overview-mode-switch" role="group" aria-label="Overview data mode">
              <button type="button" className={overviewMode === 'business' ? 'active' : ''} onClick={() => setOverviewMode('business')}>Business demo</button>
              <button type="button" className={overviewMode === 'live' ? 'active' : ''} onClick={() => setOverviewMode('live')}>Live sensor overview</button>
              <span>Fictional demo figures never count as live events.</span>
            </div>}
            {isTestAccount && overviewMode === 'business'
              ? <DemoBusinessOverview sessionCases={sessionCases} onOpenCase={openDemoCase}/>
              : <>
                <div className="page-heading">
                  <div><div className="panel-kicker">MONITORING / SUMMARY</div><h1 className="display-heading">Overview</h1>
                    <p>Snapshot of recorded proximity signals. Open Active alerts or Event history for details.</p></div>
                </div>
                {error && <div className="error-banner" role="alert"><AlertTriangle size={18}/><span>Unable to load events: {error}</span></div>}
          <section className="metrics" aria-label="Event statistics">
            <div className="metric-card">
              <div className="metric-label">Recorded signals <Activity size={18}/></div>
              <div className="metric-value">{totalAlerts}</div>
              <div className="metric-desc">Recorded sensor triggers</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Active warnings <AlertTriangle size={18}/></div>
              <div className="metric-value danger-text">{active.length}</div>
              <div className="metric-desc">Uncleared worker–machine pairs</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Signals today <Clock3 size={18}/></div>
              <div className="metric-value">{todayAlerts}</div>
              <div className="metric-desc">Based on local calendar day</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Machines observed <HardHat size={18}/></div>
              <div className="metric-value">{machines}</div>
              <div className="metric-desc">Unique reported machine IDs</div>
            </div>
          </section>
                <div className="overview-trend-grid">
            <section className="panel trend-panel">
              <div className="panel-header">
                <div><div className="panel-kicker">TRENDS / 7 DAYS</div><h2>Signal activity</h2></div>
                <span className="subtle-tag">Last 7 days</span>
              </div>
              <div className="chart-wrap">
                <div className="chart-body">
                  {chart.map((day) => (
                    <div className="chart-column" key={day.key}>
                      <span className="chart-number">{day.count || ''}</span>
                      <div className="chart-bar-track">
                        <div className="chart-bar" style={{ height: (day.count / maxCount * 100) + '%' }} />
                      </div>
                      <span className="chart-label">{day.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel-foot"><span>Counts are raw sensor alerts, not verified incidents.</span></div>
            </section>
                  <section className="panel overview-quick-links">
                    <div className="panel-header"><div><div className="panel-kicker">MONITORING</div><h2>Explore activity</h2></div></div>
                    <a href="#alerts"><AlertTriangle size={18}/><span><strong>Active alerts</strong><small>{active.length} uncleared worker–machine pairs</small></span><ArrowRight size={15}/></a>
                    <a href="#history"><Database size={18}/><span><strong>Event history</strong><small>{events.length} recorded sensor events</small></span><ArrowRight size={15}/></a>
                    <a href="#cases"><ClipboardCheck size={18}/><span><strong>Safety cases</strong><small>Review candidate incidents and corrective actions</small></span><ArrowRight size={15}/></a>
                  </section>
                </div>
          <section className="panel sandbox-overview" aria-label="Simulation activity">
            <div className="panel-header">
              <div><div className="panel-kicker">SANDBOX / LOCAL SESSION</div><h2>Simulation activity</h2></div>
              <span className="subtle-tag">Simulated · separate from live data</span>
            </div>
            <div className="sandbox-overview-body">
              <div className="sandbox-stat"><strong>{simulatedAlerts}</strong><span>Simulated alerts</span></div>
              <div className="sandbox-stat"><strong className={simulationActive ? 'danger-text' : ''}>{simulationActive ? 'Warning' : 'Clear'}</strong><span>Current simulation state</span></div>
              <div className="sandbox-overview-latest">
                {simulationEvents.length > 0
                  ? <><EventBadge type={simulationEvents[0].event} /><span>{simulationEvents[0].zone || 'Vehicle safety zone'} · {formatTime(simulationEvents[0].timestamp)}</span></>
                  : <span>No simulation events yet. Try a worker approach scenario.</span>}
              </div>
              <a className="sandbox-open" href="#simulation">Open scenario lab →</a>
            </div>
          </section>
                <footer className="footer"><span><ShieldCheck size={15}/> Halo</span><span>{lastUpdate ? 'Last synced ' + lastUpdate.toLocaleTimeString() : 'Waiting for first sync'}</span></footer>
              </>}
          </>}
          {alertsView && <>
            <div className="page-heading">
              <div><div className="panel-kicker">MONITORING / ACTION REQUIRED</div><h1 className="display-heading">Active alerts</h1>
                <p>Uncleared worker–machine proximity warnings from the live sensor event stream.</p></div>
              <span className={'status-counter ' + (active.length ? 'warning' : '')}>{active.length} active</span>
            </div>
            <div className="monitoring-note"><ShieldCheck size={16}/> Only real `sensor_events` appear as active alerts. Simulation examples are isolated and cannot be mistaken for live warnings.</div>
            {error && <div className="error-banner" role="alert"><AlertTriangle size={18}/><span>Unable to load alerts: {error}</span></div>}
            <section className="panel monitoring-alerts">
              <div className="panel-header"><div><div className="panel-kicker">LIVE WARNINGS</div><h2>Current alerts</h2></div>
                <span className="subtle-tag">{apiOnline ? 'Cloud connected · 3 s refresh' : 'Cloud unavailable'}</span></div>
              {active.length === 0 ? <div className="empty-alerts"><div className="empty-icon"><CheckCircle2 size={28}/></div>
                <strong>{apiOnline ? 'No recorded active warnings' : 'Live alert status unavailable'}</strong>
                <p>{apiOnline ? 'No uncleared alerts have been recorded. This does not verify that the work area is safe.' : 'The event query is unavailable. A disconnected source does not mean that conditions are safe.'}</p>
              </div> : <div className="active-list">
                {active.map((item, index) => <div className="active-item" key={String(item.id ?? index)}>
                  <div className="active-icon"><AlertTriangle size={19}/></div>
                  <div><strong>{item.worker_id} near {item.machine_id}</strong>
                    <small>Triggered {formatTime(item.timestamp)}{item.zone ? ' · ' + item.zone : ''}</small></div>
                  <EventBadge type={eventType(item)}/>
                </div>)}
              </div>}
            </section>
            {isTestAccount && <section className="panel monitoring-sandbox">
              <div className="panel-header"><div><div className="panel-kicker">SANDBOX / SEPARATE FROM LIVE</div><h2>Simulation alerts</h2></div>
                <span className="subtle-tag">Demo only</span></div>
              <div className="monitoring-sandbox-content">
                <p>{simulationActive ? 'The simulator currently has a warning active.' : 'No active simulated warning.'} This is not a real sensor alert.</p>
                {latestSimulationAlert && <div className="monitoring-sandbox-latest"><span>{latestSimulationAlert.zone || 'Vehicle approach zone'} · {formatTime(latestSimulationAlert.timestamp)}</span>
                  <button type="button" onClick={() => reviewSimulationAlert(latestSimulationAlert)}>Review sample case <ArrowRight size={14}/></button></div>}
                <a href="#simulation">Open scenario simulator <ArrowRight size={14}/></a>
              </div>
            </section>}
          </>}
          {historyView && <>
            <div className="page-heading">
              <div><div className="panel-kicker">MONITORING / AUDIT TRAIL</div><h1 className="display-heading">Event history</h1>
                <p>Chronological record of live sensor events, separate from simulated scenarios and reviewed safety cases.</p></div>
              <span className="subtle-tag">{events.length} records loaded</span>
            </div>
            {error && <div className="error-banner" role="alert"><AlertTriangle size={18}/><span>Unable to load history: {error}</span></div>}
            <section className="panel history-panel">
              <div className="panel-header"><div><div className="panel-kicker">LIVE EVENT LOG</div><h2>Sensor event history</h2></div>
                <span className="subtle-tag">{filteredHistory.length} matching</span></div>
              <div className="history-toolbar">
                <label>Filter
                  <select value={historyFilter} onChange={event => setHistoryFilter(event.target.value as 'all' | 'alerts' | 'cleared')}>
                    <option value="all">All events</option><option value="alerts">Proximity alerts</option><option value="cleared">Alert clears</option>
                  </select>
                </label>
                <label>Search
                  <input type="search" placeholder="Worker, machine or type" value={historySearch} onChange={event => setHistorySearch(event.target.value)}/>
                </label>
              </div>
              <div className="table-scroller"><table>
                <thead><tr><th>Event</th><th>Worker</th><th>Machine</th><th>RSSI</th><th>Timestamp</th></tr></thead>
                <tbody>{filteredHistory.map((item,index) => <tr key={String(item.id ?? index) + ':' + String(item.timestamp ?? '')}>
                  <td><EventBadge type={eventType(item)}/></td>
                  <td className="strong-cell">{item.worker_id}</td>
                  <td>{item.machine_id}</td>
                  <td className="mono-cell">{typeof item.rssi === 'number' ? item.rssi + ' dBm' : '—'}</td>
                  <td className="date-cell">{formatTime(item.timestamp)}</td>
                </tr>)}</tbody>
              </table>
                {filteredHistory.length === 0 && <div className="empty-table">{events.length === 0 ? 'No live sensor events recorded yet.' : 'No events match the current filters.'}</div>}
              </div>
              <div className="panel-foot">These are raw triggers, not verified near misses. Up to 500 recent records are loaded.</div>
            </section>
            {isTestAccount && simulationEvents.length > 0 && <section className="panel monitoring-sandbox">
              <div className="panel-header"><div><div className="panel-kicker">SANDBOX / NOT REAL SENSOR DATA</div><h2>Simulation session history</h2></div>
                <span className="subtle-tag">{simulationEvents.length} events</span></div>
              <div className="simulation-event-list">
                {simulationEvents.slice(0, 10).map(item => <div className="simulation-event-row" key={item.id}>
                  <EventBadge type={item.event}/><span>{item.zone || 'Vehicle approach zone'}</span><time>{formatTime(item.timestamp)}</time>
                  {item.event === 'PROXIMITY_ALERT' && <button type="button" className="simulation-case-link" onClick={() => reviewSimulationAlert(item)}>Review as sample case <ArrowRight size={14}/></button>}
                </div>)}
              </div>
            </section>}
          </>}
        </div>
      </main>
    </div>
  );
}
