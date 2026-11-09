import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_REPLAY_GATEWAY, DEMO_REPLAY_INTERVAL_MS, demoReplayWaypoints } from '../src/demoFtmReplay.ts';

test('temporary map replay updates every 11 seconds and is a separate gateway option', () => {
  assert.ok(DEMO_REPLAY_GATEWAY.includes('demo'));
  assert.equal(DEMO_REPLAY_INTERVAL_MS, 11_000);
  assert.equal(demoReplayWaypoints.length, 14);
});
test('replay follows requested front-left-front-right-down-and-back path', () => {
  const p = demoReplayWaypoints.map(({ targetX, targetY }) => [targetX, targetY]);
  assert.deepEqual(p, [
    [0,4],[0,4],[-1,4],[-1,4],[0,4],[1,4],[1,4],
    [1,1],[1,1],[1,-0.5],[1,-0.5],[1,1],[1,1],[1,4],
  ]);
});
test('all replay estimates have 1–2 m synthetic position error and finite coordinates', () => {
  for (const p of demoReplayWaypoints) {
    assert.ok(p.offset_m >= 1 && p.offset_m <= 2, 'point '+p.index+' offset '+p.offset_m);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(Math.abs(Math.hypot(p.x-p.targetX, p.y-p.targetY)-p.offset_m)<1e-8);
  }
});
