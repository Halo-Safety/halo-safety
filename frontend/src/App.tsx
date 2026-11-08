import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2,
  Clock3, Database, HardHat, RefreshCw, Route, ShieldCheck, Wifi, WifiOff, Play, Pause, LogOut,
} from 'lucide-react';
import { getEvents } from './api';
import { eventType, type SensorEvent } from './types';

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

type AppProps = {
  motionEnabled: boolean;
  onMotionChange: () => void;
  onExit: () => Promise<void>;
  userEmail: string;
};

export default function App({ motionEnabled, onMotionChange, onExit, userEmail }: AppProps) {
  const [events, setEvents] = useState<SensorEvent[]>([]);
  const [apiOnline, setApiOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [simulationView, setSimulationView] = useState(() => window.location.hash === '#simulation');

  useEffect(() => {
    const onHashChange = () => setSimulationView(window.location.hash === '#simulation');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
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
  const active = useMemo(() => getActiveEvents(events), [events]);
  const chart = useMemo(() => recentChart(events), [events]);
  const maxCount = Math.max(1, ...chart.map((day) => day.count));
  const totalAlerts = events.filter((event) => eventType(event) === 'PROXIMITY_ALERT').length;
  const today = dateKey(new Date());
  const todayAlerts = events.filter((event) =>
    eventType(event) === 'PROXIMITY_ALERT' && eventDate(event.timestamp) &&
    dateKey(eventDate(event.timestamp)!) === today).length;
  const machines = new Set(events.map((event) => event.machine_id).filter(Boolean)).size;


  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Halo dashboard">
          <span className="brand-symbol"><ShieldCheck size={23} strokeWidth={1.65} /></span>
          <span><strong>halo<span className="brand-period">.</span></strong></span>
        </a>
        <div className="navigation-label">WORKSPACE</div>
        <nav className="nav-links" aria-label="Main navigation">
          <a className={"nav-link" + (!simulationView ? " selected" : "")} href="#overview"><BarChart3 size={18} /> Overview</a>
          <a className="nav-link" href="#alerts"><AlertTriangle size={18} /> Active alerts <span className="nav-count">{active.length}</span></a>
          <a className="nav-link" href="#history"><Database size={18} /> Event history</a>
          <a className={"nav-link" + (simulationView ? " selected" : "")} href="#simulation"><Route size={18} /> Simulation</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="signed-in-user" title={userEmail}>{userEmail}</div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>HALO</span><span className="breadcrumb-separator">/</span><strong>{simulationView ? "Scenario lab" : "Overview"}</strong></div>
          <div className="topbar-right">
            <span className={'api-pill ' + (apiOnline ? 'online' : 'offline')}>
              {apiOnline ? <Wifi size={15}/> : <WifiOff size={15}/>}
              {apiOnline ? 'Connected' : 'Unavailable'}
            </span>
            <button type="button" className="motion-button" aria-pressed={motionEnabled} onClick={onMotionChange} title={motionEnabled ? 'Pause background animation' : 'Resume background animation'}>
              {motionEnabled ? <Pause size={14}/> : <Play size={14}/>}
              <span>Motion {motionEnabled ? 'on' : 'off'}</span>
            </button>
            <button type="button" className="icon-button" onClick={() => { setRefreshing(true); void refresh(); }} title="Refresh data" aria-label="Refresh data" disabled={refreshing}>
              <RefreshCw className={refreshing ? 'spin' : ''} size={18}/>
            </button>
            <button type="button" className="workspace-exit-button" onClick={() => { void onExit().catch(e => setError(e instanceof Error ? e.message : 'Could not sign out')); }} title="Sign out">
              <LogOut size={15}/><span>Sign out</span>
            </button>
          </div>
        </header>

        <div className="page-content">
          {simulationView ? (
            <section className="simulator-page" aria-labelledby="simulation-heading">
              <h1 id="simulation-heading" className="display-heading">Simulation</h1>
              <p className="simulator-intro">Model worker and vehicle movement near equipment.</p>
              <div className="sample-diagrams">
                <span>Sample vehicle diagrams:</span>
                <a href="/simulator/vehicle1.png" target="_blank" rel="noreferrer">Vehicle 1</a>
                <a href="/simulator/vehicle-2.png" target="_blank" rel="noreferrer">Vehicle 2</a>
              </div>
              <iframe
                title="Halo blind spot scenario simulator"
                className="simulator-frame"
                src="/simulator/index.html"
                loading="eager"
              />
              <p className="simulator-caption">Simulation activity is not saved as a recorded incident.</p>
            </section>
          ) : (
            <>
          <div className="page-heading">
            <div><h1 className="display-heading">Overview</h1></div>
          </div>

          {error && <div className="error-banner" role="alert">
            <AlertTriangle size={20} /><span>Unable to load events: {error}</span>
          </div>}

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

          <div className="content-grid">
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

            <section className="panel alerts-panel" id="alerts">
              <div className="panel-header">
                <div><div className="panel-kicker">ATTENTION / NOW</div><h2>Active warnings</h2></div>
                <span className={'status-counter ' + (active.length ? 'warning' : '')}>{active.length} active</span>
              </div>
              {active.length === 0 ? (
                <div className="empty-alerts"><div className="empty-icon"><CheckCircle2 size={28}/></div>
                  <strong>No active alerts</strong>
                  <p>All recorded proximity alerts have been cleared, or no events have been received yet.</p>
                </div>
              ) : (
                <div className="active-list">
                  {active.slice(0, 5).map((event, index) => (
                    <div className="active-item" key={String(event.id ?? index)}>
                      <div className="active-icon"><AlertTriangle size={18}/></div>
                      <div><strong>{event.worker_id} near {event.machine_id}</strong><small>{formatTime(event.timestamp)}</small></div>
                    </div>
                  ))}
                </div>
              )}
              <div className="panel-foot">
                <span><span className="live-indicator" /> {apiOnline ? 'Refreshes every 3 seconds' : 'Connection unavailable'}</span>
              </div>
            </section>
          </div>

          <section className="panel history-panel" id="history">
            <div className="panel-header">
              <div><div className="panel-kicker">ACTIVITY LOG / RECENT</div><h2>Event history</h2></div>
              <span className="subtle-tag">{events.length} records</span>
            </div>
            <div className="table-scroller">
              <table>
                <thead><tr><th>Event</th><th>Worker</th><th>Machine</th><th>RSSI</th><th>Timestamp</th></tr></thead>
                <tbody>
                  {ordered.slice(0, 20).map((event, index) => (
                    <tr key={String(event.id ?? index) + ':' + String(event.timestamp ?? '')}>
                      <td><EventBadge type={eventType(event)}/></td>
                      <td className="strong-cell">{event.worker_id}</td>
                      <td>{event.machine_id}</td>
                      <td className="mono-cell">{typeof event.rssi === 'number' ? event.rssi + ' dBm' : '—'}</td>
                      <td className="date-cell">{formatTime(event.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ordered.length === 0 && <div className="empty-table">No recorded events yet.</div>}
            </div>
          </section>
          <footer className="footer"><span><ShieldCheck size={15}/> Halo</span><span>{lastUpdate ? 'Last synced ' + lastUpdate.toLocaleTimeString() : 'Waiting for first sync'}</span></footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
