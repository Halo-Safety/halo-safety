import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedDemoStatuses, demoCases, reviewDemoCase, mergeDemoCases } from '../src/demoSafetyData.ts';

const base = demoCases.find(item => item.id === 'HALO-1049');
if (!base) throw new Error('Example case missing');
const action = { title: 'Separate pedestrian route', owner: 'Operations manager', due: '2026-11-17', status: 'Open' };
const completedAction = { ...action, status: 'Completed' };
const timestamp = '2026-11-09T13:00:00Z';
const input = (changes = {}) => ({
  classification: 'Candidate', status: 'Needs review', reviewNote: '',
  recommendedAction: null, ...changes,
});

test('new simulated candidate starts Needs review; investigation can start while unconfirmed', () => {
  const newCase = { ...base, id: 'SIM-42', recommendedAction: null };
  const unreviewed = reviewDemoCase(newCase, input(), timestamp);
  assert.equal(unreviewed.status, 'Needs review');
  assert.equal(unreviewed.reviewedAt, undefined);
  const investigating = reviewDemoCase(unreviewed, input({
    status: 'Investigating', reviewNote: 'Checking supervisor report.',
  }), timestamp);
  assert.equal(investigating.status, 'Investigating');
  assert.equal(investigating.classification, 'Candidate');
});

test('manager reviews candidate as near miss and assigns a corrective action', () => {
  const result = reviewDemoCase(base, input({
    classification: 'Reviewed near miss', status: 'Action assigned',
    reviewNote: 'Confirmed crossing with supervisor.', recommendedAction: action,
  }), timestamp);
  assert.equal(result.classification, 'Reviewed near miss');
  assert.equal(result.status, 'Action assigned');
  assert.equal(result.reviewNote, 'Confirmed crossing with supervisor.');
  assert.equal(result.reviewedAt, timestamp);
  assert.equal(result.recommendedAction?.owner, 'Operations manager');
  assert.equal(base.classification, 'Candidate');
});
test('case moves Action assigned → Monitoring → Closed after action completed', () => {
  const assigned = reviewDemoCase(base, input({
    classification: 'Reviewed near miss', status: 'Action assigned',
    reviewNote: 'Supervisor verified crossing.', recommendedAction: action,
  }), timestamp);
  const monitoring = reviewDemoCase(assigned, input({
    classification: 'Reviewed near miss', status: 'Monitoring',
    reviewNote: 'Pedestrian lane installed; checking effectiveness.',
    recommendedAction: completedAction,
  }), timestamp);
  assert.equal(monitoring.status, 'Monitoring');
  assert.equal(monitoring.recommendedAction?.status, 'Completed');
  const closed = reviewDemoCase(monitoring, input({
    classification: 'Reviewed near miss', status: 'Closed',
    reviewNote: 'Controls inspected and verified.',
    recommendedAction: completedAction,
  }), timestamp);
  assert.equal(closed.status, 'Closed');
});
test('false alarm is dismissed with review note and no corrective action', () => {
  const result = reviewDemoCase(base, input({
    classification: 'False alarm', status: 'Dismissed',
    reviewNote: 'Reflection confirmed by observation.',
  }), timestamp);
  assert.equal(result.status, 'Dismissed');
  assert.equal(result.recommendedAction, null);
});
test('device fault can be under investigation or assigned remediation', () => {
  const result = reviewDemoCase(base, input({
    classification: 'Device fault', status: 'Investigating',
    reviewNote: 'Wearable heartbeat lost.',
  }), timestamp);
  assert.equal(result.status, 'Investigating');
  const remediation = reviewDemoCase(result, input({
    classification: 'Device fault', status: 'Action assigned',
    reviewNote: 'Replace battery and verify connectivity.',
    recommendedAction: action,
  }), timestamp);
  assert.equal(remediation.status, 'Action assigned');
});
test('statuses differ from classifications and invalid combinations are rejected', () => {
  assert.deepEqual(allowedDemoStatuses('False alarm'), ['Dismissed']);
  assert.deepEqual(allowedDemoStatuses('Candidate'), ['Needs review', 'Investigating']);
  assert.ok(allowedDemoStatuses('Reviewed near miss').includes('Closed'));
  assert.throws(() => reviewDemoCase(base, input({
    classification: 'False alarm', status: 'Closed', reviewNote: 'Reflection.',
  }), timestamp), /not available/);
  assert.throws(() => reviewDemoCase(base, input({
    classification: 'Candidate', status: 'Closed', reviewNote: 'Done.',
    recommendedAction: completedAction,
  }), timestamp), /not available/);
  assert.throws(() => reviewDemoCase(base, input({
    classification: 'False alarm', status: 'Dismissed', reviewNote: 'Noise.', recommendedAction: action,
  }), timestamp), /cannot have an active corrective action/);
});
test('requires review note when starting investigation or classifying event', () => {
  assert.throws(() => reviewDemoCase(base, input({
    classification: 'Candidate', status: 'Investigating',
  }), timestamp), /review note/i);
  assert.throws(() => reviewDemoCase(base, input({
    classification: 'Reviewed near miss', status: 'Investigating',
  }), timestamp), /review note/i);
});
test('action is required for assignment and must be completed before monitoring or closure', () => {
  assert.throws(() => reviewDemoCase(base, input({
    classification: 'Reviewed near miss', status: 'Action assigned',
    reviewNote: 'Verified.',
  }), timestamp), /Assign a corrective action/i);
  for (const status of ['Monitoring','Closed']) {
    assert.throws(() => reviewDemoCase(base, input({
      classification: 'Reviewed near miss', status, reviewNote: 'Verified.',
      recommendedAction: action,
    }), timestamp), /Mark the corrective action as Completed/i);
    assert.throws(() => reviewDemoCase(base, input({
      classification: 'Reviewed near miss', status, reviewNote: 'Verified.',
    }), timestamp), /Assign a corrective action/i);
  }
});
test('validates corrective action details', () => {
  assert.throws(() => reviewDemoCase(base, input({
    classification: 'Device fault', status: 'Action assigned', reviewNote: 'Investigation.',
    recommendedAction: { ...action, owner: '' },
  }), timestamp), /Complete the action/i);
  assert.throws(() => reviewDemoCase(base, input({
    classification: 'Device fault', status: 'Action assigned', reviewNote: 'Investigation.',
    recommendedAction: { ...action, due: '2026-11-xx' },
  }), timestamp), /valid due date/i);
});
test('review overrides original sample without double counting', () => {
  const result = reviewDemoCase(base, input({
    classification: 'Reviewed near miss', status: 'Investigating',
    reviewNote: 'Verified during review.',
  }), timestamp);
  const merged = mergeDemoCases([result]);
  assert.equal(merged.length, demoCases.length);
  assert.equal(merged.filter(item => item.id === base.id).length, 1);
  assert.equal(merged.find(item => item.id === base.id)?.classification, 'Reviewed near miss');
});
test('simulator case is included exactly once in session overview', () => {
  const newCase = { ...base, id: 'SIM-42', title: 'Simulated approach' };
  const merged = mergeDemoCases([newCase]);
  assert.equal(merged.length, demoCases.length + 1);
  assert.equal(merged.filter(item => item.id === 'SIM-42').length, 1);
});
