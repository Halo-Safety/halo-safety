import test from 'node:test';
import assert from 'node:assert/strict';
import { demoCases, reviewDemoCase, mergeDemoCases } from '../src/demoSafetyData.ts';

const base = demoCases.find(item => item.id === 'HALO-1049');
if (!base) throw new Error('Example case missing');
const action = { title: 'Separate pedestrian route', owner: 'Operations manager', due: '2026-11-17', status: 'Open' };
const timestamp = '2026-11-09T13:00:00Z';

test('manager reviews candidate as a near miss and assigns an action', () => {
  const result = reviewDemoCase(base, {
    classification: 'Reviewed near miss',
    reviewNote: 'Confirmed crossing with supervisor.',
    recommendedAction: action,
  }, timestamp);
  assert.equal(result.classification, 'Reviewed near miss');
  assert.equal(result.status, 'Action assigned');
  assert.equal(result.reviewNote, 'Confirmed crossing with supervisor.');
  assert.equal(result.reviewedAt, timestamp);
  assert.equal(result.recommendedAction?.owner, 'Operations manager');
  assert.equal(base.classification, 'Candidate');
});
test('false alarm classification dismisses the observation without an action', () => {
  const result = reviewDemoCase(base, {
    classification: 'False alarm', reviewNote: 'Reflection confirmed by observation.', recommendedAction: null,
  }, timestamp);
  assert.equal(result.status, 'Dismissed');
  assert.equal(result.recommendedAction, null);
});
test('device fault remains under investigation unless action assigned', () => {
  const result = reviewDemoCase(base, {
    classification: 'Device fault', reviewNote: 'Wearable heartbeat lost.', recommendedAction: null,
  }, timestamp);
  assert.equal(result.status, 'Investigating');
});
test('unreviewed candidate remains unreviewed even with an action', () => {
  const result = reviewDemoCase(base, {
    classification: 'Candidate', reviewNote: '', recommendedAction: action,
  }, timestamp);
  assert.equal(result.status, 'Needs review');
  assert.equal(result.reviewedAt, undefined);
});
test('requires a review note for a conclusive classification', () => {
  assert.throws(() => reviewDemoCase(base, {
    classification: 'Reviewed near miss', reviewNote: '   ', recommendedAction: null,
  }, timestamp), /review note/i);
});
test('validates corrective action details', () => {
  assert.throws(() => reviewDemoCase(base, {
    classification: 'Device fault', reviewNote: 'Investigation.', recommendedAction: { ...action, owner: '' },
  }, timestamp), /Complete the action/i);
  assert.throws(() => reviewDemoCase(base, {
    classification: 'Device fault', reviewNote: 'Investigation.', recommendedAction: { ...action, due: '2026-11-xx' },
  }, timestamp), /valid due date/i);
});
test('review overrides original example without double counting', () => {
  const result = reviewDemoCase(base, {
    classification: 'Reviewed near miss', reviewNote: 'Verified during review.', recommendedAction: null,
  }, timestamp);
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
