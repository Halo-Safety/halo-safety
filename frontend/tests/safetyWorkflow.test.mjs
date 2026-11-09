import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCaseWorkflow, validateActionUpdate } from '../src/safetyWorkflow.ts';

test('candidate, investigation, assignment, monitoring and closure follow action state', () => {
  assert.equal(validateCaseWorkflow('candidate', 'needs_review', []), null);
  assert.equal(validateCaseWorkflow('candidate', 'investigating', []), null);
  assert.equal(validateCaseWorkflow('reviewed_near_miss', 'investigating', []), null);
  assert.match(validateCaseWorkflow('candidate', 'action_assigned', ['open']), /Classify/);
  assert.match(validateCaseWorkflow('reviewed_near_miss', 'action_assigned', []), /Create/);
  assert.equal(validateCaseWorkflow('reviewed_near_miss', 'action_assigned', ['open']), null);
  assert.match(validateCaseWorkflow('reviewed_near_miss', 'monitoring', ['in_progress']), /Complete/);
  assert.match(validateCaseWorkflow('device_fault', 'closed', ['completed', 'open']), /Complete/);
  assert.equal(validateCaseWorkflow('reviewed_near_miss', 'monitoring', ['completed']), null);
  assert.equal(validateCaseWorkflow('reviewed_near_miss', 'closed', ['completed']), null);
});
test('false alarms must be dismissed and outstanding actions cannot be ignored', () => {
  assert.equal(validateCaseWorkflow('false_alarm', 'dismissed', []), null);
  assert.match(validateCaseWorkflow('false_alarm', 'investigating', []), /Dismissed/);
  assert.match(validateCaseWorkflow('false_alarm', 'dismissed', ['open']), /Complete/);
  assert.match(validateCaseWorkflow('device_fault', 'dismissed', []), /reserved/);
});
test('closed or monitoring cases cannot receive unfinished work without reopening', () => {
  assert.match(validateActionUpdate('reviewed_near_miss', 'closed', 'open'), /Reopen/);
  assert.match(validateActionUpdate('device_fault', 'monitoring', 'in_progress'), /Reopen/);
  assert.equal(validateActionUpdate('reviewed_near_miss', 'investigating', 'open'), null);
  assert.equal(validateActionUpdate('reviewed_near_miss', 'closed', 'completed'), null);
  assert.match(validateActionUpdate('false_alarm', 'dismissed', 'completed'), /Dismissed/);
});
