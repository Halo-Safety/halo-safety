import { supabase } from './supabase';

export type OrgRole = 'admin' | 'manager' | 'viewer';

export interface SafetyOrg {
  id: string;
  name: string;
  role: OrgRole;
}

export interface Vehicle {
  id: string;
  organization_id: string;
  asset_tag: string;
  name: string;
  vehicle_type: string;
  ownership_kind: 'owned' | 'leased' | 'rented' | 'contractor';
  owner_name: string;
  site: string;
  operator_ref: string;
  sensor_source: string;
  device_status: 'online' | 'offline' | 'unreliable' | 'unknown';
  operating_hours: number;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export type CaseClassification = 'candidate' | 'reviewed_near_miss' | 'false_alarm' | 'device_fault';
export type CaseStatus = 'needs_review' | 'investigating' | 'action_assigned' | 'monitoring' | 'closed' | 'dismissed';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface SafetyCase {
  id: string;
  organization_id: string;
  vehicle_id: string | null;
  title: string;
  occurred_at: string;
  zone: string;
  shift_name: string;
  worker_ref: string;
  operator_at_event: string;
  source_label: string;
  observation_count: number;
  classification: CaseClassification;
  status: CaseStatus;
  potential_severity: Severity;
  summary: string;
  evidence_notes: string;
  pattern_notes: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CorrectiveAction {
  id: string;
  organization_id: string;
  case_id: string;
  title: string;
  owner_ref: string;
  due_date: string | null;
  status: 'open' | 'in_progress' | 'completed';
  verification_notes: string;
  created_at: string;
  updated_at: string;
}

export type VehicleInput = Pick<Vehicle, 'asset_tag' | 'name' | 'vehicle_type' | 'ownership_kind' | 'owner_name' | 'site' | 'operator_ref' | 'sensor_source' | 'device_status' | 'operating_hours' | 'is_demo'>;
export type CaseInput = Pick<SafetyCase, 'vehicle_id' | 'title' | 'occurred_at' | 'zone' | 'shift_name' | 'worker_ref' | 'operator_at_event' | 'source_label' | 'observation_count' | 'classification' | 'status' | 'potential_severity' | 'summary' | 'evidence_notes' | 'pattern_notes' | 'is_demo'>;
export type ActionInput = Pick<CorrectiveAction, 'title' | 'owner_ref' | 'due_date' | 'status' | 'verification_notes'>;

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function listSafetyOrganizations(): Promise<SafetyOrg[]> {
  const db = client();
  const { data: memberships, error: memberError } = await db
    .from('organization_members')
    .select('organization_id,role');
  if (memberError) throw new Error(memberError.message);
  if (!memberships?.length) return [];
  const ids = memberships.map(m => m.organization_id as string);
  const { data: organizations, error: orgError } = await db
    .from('organizations')
    .select('id,name')
    .in('id', ids);
  if (orgError) throw new Error(orgError.message);
  const names = new Map((organizations || []).map(org => [org.id as string, org.name as string]));
  return memberships.filter(m => names.has(m.organization_id)).map(m => ({
    id: m.organization_id as string,
    name: names.get(m.organization_id as string)!,
    role: m.role as OrgRole,
  }));
}

export async function loadSafetyData(organizationId: string) {
  const db = client();
  const [vehicles, cases, actions] = await Promise.all([
    db.from('vehicles').select('*').eq('organization_id', organizationId).order('asset_tag'),
    db.from('safety_cases').select('*').eq('organization_id', organizationId).order('occurred_at', { ascending: false }),
    db.from('corrective_actions').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
  ]);
  if (vehicles.error) throw new Error('Vehicles: ' + vehicles.error.message);
  if (cases.error) throw new Error('Cases: ' + cases.error.message);
  if (actions.error) throw new Error('Corrective actions: ' + actions.error.message);
  return {
    vehicles: (vehicles.data || []) as Vehicle[],
    cases: (cases.data || []) as SafetyCase[],
    actions: (actions.data || []) as CorrectiveAction[],
  };
}

export async function saveVehicle(organizationId: string, input: VehicleInput, id?: string): Promise<Vehicle> {
  const db = client();
  const operation = id
    ? db.from('vehicles').update(input).eq('organization_id', organizationId).eq('id', id)
    : db.from('vehicles').insert({ ...input, organization_id: organizationId });
  const { data, error } = await operation.select('*').single();
  if (error) throw new Error(error.message);
  return data as Vehicle;
}

export async function saveCase(organizationId: string, input: CaseInput, id?: string): Promise<SafetyCase> {
  const db = client();
  const operation = id
    ? db.from('safety_cases').update(input).eq('organization_id', organizationId).eq('id', id)
    : db.from('safety_cases').insert({ ...input, organization_id: organizationId });
  const { data, error } = await operation.select('*').single();
  if (error) throw new Error(error.message);
  return data as SafetyCase;
}

export async function saveAction(organizationId: string, caseId: string, input: ActionInput, id?: string): Promise<CorrectiveAction> {
  const db = client();
  const operation = id
    ? db.from('corrective_actions').update(input).eq('organization_id', organizationId).eq('case_id', caseId).eq('id', id)
    : db.from('corrective_actions').insert({ ...input, organization_id: organizationId, case_id: caseId });
  const { data, error } = await operation.select('*').single();
  if (error) throw new Error(error.message);
  return data as CorrectiveAction;
}
