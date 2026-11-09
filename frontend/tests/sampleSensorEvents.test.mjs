import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleSensorEvents } from '../src/sampleSensorEvents.ts';

test('five labeled fictional events illustrate three active warnings and a resolved encounter', () => {
  assert.equal(sampleSensorEvents.length, 5);
  assert.equal(new Set(sampleSensorEvents.map(event => event.id)).size, 5);
  assert.ok(sampleSensorEvents.every(event => event.id < 0));
  assert.ok(sampleSensorEvents.every(event =>
    event.worker_id && event.machine_id && event.timestamp && Number.isFinite(new Date(event.timestamp).getTime())
    && ['PROXIMITY_ALERT', 'ALERT_CLEAR'].includes(event.event_type)));
  const active = new Map();
  for (const event of [...sampleSensorEvents].reverse()) {
    const pair = event.worker_id + ':' + event.machine_id;
    if (event.event_type === 'PROXIMITY_ALERT') active.set(pair, event);
    if (event.event_type === 'ALERT_CLEAR') active.delete(pair);
  }
  assert.equal(active.size, 3);
  assert.ok(!active.has('WORKER-031:EXCAVATOR-03'));
  assert.equal(sampleSensorEvents.filter(event => event.event_type === 'ALERT_CLEAR').length, 1);
});
