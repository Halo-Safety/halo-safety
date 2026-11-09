/**
 * Illustrative, FICTIONAL safety dataset for the invited demo account only.
 * Not Supabase data, not verified incidents, and not device telemetry.
 */
export interface DemoVehicle {
  id: string;
  name: string;
  type: string;
  assetTag: string;
  owner: string;
  site: string;
  assignedOperator: string;
  device: string;
  deviceState: 'Online' | 'Unreliable' | 'Offline';
  operatingHours: number;
}

export type CaseStatus = 'Needs review' | 'Investigating' | 'Action assigned' | 'Monitoring' | 'Closed' | 'Dismissed';
export type CaseClassification = 'Candidate' | 'Reviewed near miss' | 'False alarm' | 'Device fault';
export interface DemoAction {
  title: string;
  owner: string;
  due: string;
  status: 'Open' | 'In progress' | 'Completed';
}
export interface DemoCase {
  id: string;
  title: string;
  occurredAt: string;
  vehicleId: string;
  workerTag: string;
  operator: string;
  zone: string;
  shift: string;
  source: string;
  observations: number;
  classification: CaseClassification;
  status: CaseStatus;
  potentialSeverity: 'Critical' | 'High' | 'Medium' | 'Low';
  evidence: string[];
  assessment: string;
  /** Human review note from this browser-only demonstration. */
  reviewNote?: string;
  reviewedAt?: string;
  recommendedAction: DemoAction | null;
  pattern: string;
  impact?: { beforeAlerts: number; beforeHours: number; afterAlerts: number; afterHours: number };
}

export const demoVehicles: DemoVehicle[] = [
  { id: 'LOADER-04', name: 'Wheel Loader 04', type: 'Wheel loader', assetTag: 'WL-004', owner: 'North Site Operations (owned)', site: 'North Construction Yard', assignedOperator: 'Operator 014', device: 'ESP32-BEACON-04', deviceState: 'Online', operatingHours: 132 },
  { id: 'FORKLIFT-12', name: 'Forklift 12', type: 'Forklift', assetTag: 'FL-012', owner: 'North Site Operations (leased)', site: 'Materials Warehouse', assignedOperator: 'Operator 021', device: 'UWB-UNIT-12 (sample)', deviceState: 'Online', operatingHours: 168 },
  { id: 'EXCAVATOR-03', name: 'Excavator 03', type: 'Excavator', assetTag: 'EX-003', owner: 'Westline Earthworks (contractor)', site: 'Excavation Area', assignedOperator: 'Operator 009', device: 'Manual observations', deviceState: 'Offline', operatingHours: 94 },
  { id: 'TRUCK-07', name: 'Dump Truck 07', type: 'Dump truck', assetTag: 'DT-007', owner: 'Atlas Fleet Rentals (rental)', site: 'North Construction Yard', assignedOperator: 'Operator 031', device: 'CAM-07 (sample)', deviceState: 'Online', operatingHours: 146 },
  { id: 'SKID-02', name: 'Skid Steer 02', type: 'Skid steer', assetTag: 'SS-002', owner: 'North Site Operations (owned)', site: 'North Construction Yard', assignedOperator: 'Operator 026', device: 'ESP32-BEACON-02', deviceState: 'Unreliable', operatingHours: 76 },
];

export const demoCases: DemoCase[] = [
  {
    id: 'HALO-1049', title: 'Worker entered reversing loader blind zone',
    occurredAt: '2026-11-08T09:21:00-07:00', vehicleId: 'LOADER-04',
    workerTag: 'WORKER-018', operator: 'Operator 014', zone: 'West loading bay', shift: 'Day',
    source: 'ESP32 proximity (illustrative)', observations: 6,
    classification: 'Candidate', status: 'Needs review', potentialSeverity: 'Critical',
    evidence: ['6 proximity-trigger observations within 18 seconds', 'Alert-cleared message present', 'No independent distance verification'],
    assessment: 'Unreviewed candidate. The sensor pattern is consistent with a close approach, but does not prove that a near miss occurred.',
    recommendedAction: { title: 'Review bay layout and verify event with shift supervisor', owner: 'Site safety manager', due: '2026-11-10', status: 'Open' },
    pattern: 'Second candidate near loader operations in this zone this week (sample)',
  },
  {
    id: 'HALO-1048', title: 'Forklift–pedestrian conflict at aisle crossing',
    occurredAt: '2026-11-07T14:13:00-07:00', vehicleId: 'FORKLIFT-12',
    workerTag: 'WORKER-005', operator: 'Operator 021', zone: 'Warehouse aisle 7', shift: 'Afternoon',
    source: 'Illustrative proximity sensor + supervisor note', observations: 8,
    classification: 'Reviewed near miss', status: 'Action assigned', potentialSeverity: 'High',
    evidence: ['8 sensor observations clustered into one encounter', 'Supervisor note: worker crossed active travel lane', 'Operator and equipment assignment recorded at event time'],
    assessment: 'Sample supervisor review identifies a crossing conflict. Risk is associated with the shared pedestrian/vehicle lane, not an individual blame score.',
    recommendedAction: { title: 'Separate pedestrian route and forklift crossing', owner: 'Warehouse operations lead', due: '2026-11-12', status: 'In progress' },
    pattern: 'Recurring crossing interactions during afternoon shifts',
  },
  {
    id: 'HALO-1047', title: 'Pedestrian within excavator swing area',
    occurredAt: '2026-11-07T10:42:00-07:00', vehicleId: 'EXCAVATOR-03',
    workerTag: 'WORKER-031', operator: 'Operator 009', zone: 'Excavation south trench', shift: 'Day',
    source: 'Supervisor manual report', observations: 1,
    classification: 'Reviewed near miss', status: 'Investigating', potentialSeverity: 'Critical',
    evidence: ['One manual observation (no device measurement)', 'Work area and equipment assignment recorded'],
    assessment: 'The reported hazard is a worker entering a swing-radius area. Confirm circumstances and controls before deciding root cause.',
    recommendedAction: { title: 'Inspect exclusion-zone barriers and spotter procedure', owner: 'Project superintendent', due: '2026-11-11', status: 'Open' },
    pattern: 'No reliable trend with only one reported observation',
  },
  {
    id: 'HALO-1046', title: 'Reversing dump truck near laydown access',
    occurredAt: '2026-11-06T08:16:00-07:00', vehicleId: 'TRUCK-07',
    workerTag: 'WORKER-027', operator: 'Operator 031', zone: 'West laydown gate', shift: 'Day',
    source: 'Sample camera observation + supervisor review', observations: 4,
    classification: 'Reviewed near miss', status: 'Monitoring', potentialSeverity: 'High',
    evidence: ['4 detection records grouped into one encounter', 'Example supervisory review logged', 'Temporary pedestrian barrier marked complete'],
    assessment: 'Sample action was taken to separate vehicle reverse manoeuvres from foot traffic. Follow-up data must be normalized by vehicle activity.',
    recommendedAction: { title: 'Maintain one-way route and pedestrian barrier', owner: 'Site operations lead', due: '2026-11-06', status: 'Completed' },
    pattern: 'Illustrative before/after alert counts; insufficient for a causal safety claim',
    impact: { beforeAlerts: 12, beforeHours: 120, afterAlerts: 4, afterHours: 140 },
  },
  {
    id: 'HALO-1045', title: 'Radio reflections produced repeated proximity alarms',
    occurredAt: '2026-11-05T17:05:00-07:00', vehicleId: 'FORKLIFT-12',
    workerTag: 'WORKER-011', operator: 'Operator 019', zone: 'Warehouse rack corridor', shift: 'Evening',
    source: 'ESP32 RSSI (illustrative)', observations: 11,
    classification: 'False alarm', status: 'Dismissed', potentialSeverity: 'Low',
    evidence: ['11 rapidly oscillating RSSI threshold crossings', 'No independent crossing evidence'],
    assessment: 'Sample triage determined this was a noisy-sensor episode. Preserved in provenance but excluded from confirmed near-miss totals.',
    recommendedAction: null,
    pattern: 'Repeated sensor chatter near metal racks',
  },
  {
    id: 'HALO-1044', title: 'Wearable signal lost near skid-steer operation',
    occurredAt: '2026-11-04T11:38:00-07:00', vehicleId: 'SKID-02',
    workerTag: 'WORKER-008', operator: 'Operator 026', zone: 'North material stacks', shift: 'Day',
    source: 'Device heartbeat monitor (illustrative)', observations: 3,
    classification: 'Device fault', status: 'Needs review', potentialSeverity: 'Medium',
    evidence: ['Three missed heartbeat windows', 'No location measurement during outage'],
    assessment: 'Monitoring coverage was lost. This is an equipment-health exception, not a verified worker near miss; unknown safety state must not be shown as safe.',
    recommendedAction: { title: 'Inspect tag battery and radio coverage before next shift', owner: 'Field technician', due: '2026-11-09', status: 'Open' },
    pattern: 'Repeat communication dropouts for this sample beacon',
  },
];
/** Changes to fixed sample cases are stored as session overrides; no Supabase writes. */
export type DemoReviewInput = {
  classification: CaseClassification;
  status: CaseStatus;
  reviewNote: string;
  recommendedAction: DemoAction | null;
};

/** Statuses are separate from the outcome (classification). */
export function allowedDemoStatuses(classification: CaseClassification): CaseStatus[] {
  if (classification === 'False alarm') return ['Dismissed'];
  if (classification === 'Candidate') return ['Needs review', 'Investigating'];
  return ['Needs review', 'Investigating', 'Action assigned', 'Monitoring', 'Closed'];
}

/** A consistent, small workflow for the browser-only review form. */
export function reviewDemoCase(original: DemoCase, input: DemoReviewInput, timestamp: string): DemoCase {
  if (!allowedDemoStatuses(input.classification).includes(input.status)) {
    throw new Error('This case status is not available for the selected classification.');
  }
  const note = input.reviewNote.trim();
  if ((input.classification !== 'Candidate' || input.status !== 'Needs review') && !note) {
    throw new Error('Add a review note before progressing the case.');
  }

  const action = input.recommendedAction;
  if (input.classification === 'False alarm' && action) {
    throw new Error('Dismissed false alarms cannot have an active corrective action.');
  }
  if (action && (!action.title.trim() || !action.owner.trim() ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(action.due) ||
    Number.isNaN(new Date(action.due + 'T12:00:00').getTime()))) {
    throw new Error('Complete the action description, owner and valid due date.');
  }
  if (['Action assigned', 'Monitoring', 'Closed'].includes(input.status) && !action) {
    throw new Error('Assign a corrective action before moving this case forward.');
  }
  if (['Monitoring', 'Closed'].includes(input.status) && action?.status !== 'Completed') {
    throw new Error('Mark the corrective action as Completed before monitoring or closing the case.');
  }

  const hasReview = input.classification !== 'Candidate' || input.status !== 'Needs review';
  return {
    ...original,
    classification: input.classification,
    status: input.status,
    reviewNote: note,
    reviewedAt: hasReview ? timestamp : undefined,
    recommendedAction: action ? {
      ...action, title: action.title.trim(), owner: action.owner.trim(),
    } : null,
  };
}

export function mergeDemoCases(overrides: readonly DemoCase[], samples: readonly DemoCase[] = demoCases): DemoCase[] {
  const updated = new Set(overrides.map(item => item.id));
  return [...overrides, ...samples.filter(item => !updated.has(item.id))];
}
