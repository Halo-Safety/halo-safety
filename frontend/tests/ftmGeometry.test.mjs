import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateFtm, validateLayout, getAnchors } from '../src/ftmGeometry.ts';

const layout = {
  vehicle_id: 'vehicle', organization_id: 'organization',
  front_x_m: 0, front_y_m: 1.5,
  rear_left_x_m: -0.8, rear_left_y_m: -0.5,
  rear_right_x_m: 0.8, rear_right_y_m: -0.5,
  front_bias_m: 0, rear_left_bias_m: 0, rear_right_bias_m: 0,
  assumed_range_error_m: 0.05,
};
function rangesForPoint(position, geometry = layout) {
  const [front, left, right] = getAnchors(geometry);
  return {
    front_m: Math.hypot(position.x - front.x, position.y - front.y) + front.bias,
    rear_left_m: Math.hypot(position.x - left.x, position.y - left.y) + left.bias,
    rear_right_m: Math.hypot(position.x - right.x, position.y - right.y) + right.bias,
  };
}
test('measured non-collinear anchor geometry passes', () => {
  assert.equal(validateLayout(layout), null);
});
test('trilateration recovers a known worker location from three ranges', () => {
  const expected = { x: 0.2, y: 0.1 };
  const result = estimateFtm(layout, rangesForPoint(expected));
  assert.ok(result);
  assert.ok(Math.abs(result.x - expected.x) < 1e-8);
  assert.ok(Math.abs(result.y - expected.y) < 1e-8);
  assert.ok(result.residual_m < 1e-8);
  assert.equal(result.quality, 'self_consistent');
});
test('range bias is subtracted before trilateration', () => {
  const calibrated = { ...layout, front_bias_m: 0.3, rear_left_bias_m: 0.1 };
  const point = { x: -0.4, y: 0.5 };
  const result = estimateFtm(calibrated, rangesForPoint(point, calibrated));
  assert.ok(result);
  assert.ok(Math.abs(result.x - point.x) < 1e-8);
  assert.ok(Math.abs(result.y - point.y) < 1e-8);
});
test('collinear and duplicate anchors are rejected', () => {
  const collinear = { ...layout, front_x_m: 0, front_y_m: -0.5 };
  assert.match(validateLayout(collinear), /triangle/);
  assert.equal(estimateFtm(collinear, rangesForPoint({ x: 0, y: 1 })), null);
  const duplicated = { ...layout, rear_left_x_m: 0, rear_left_y_m: 1.5 };
  assert.match(validateLayout(duplicated), /0.1 m/);
});
test('missing, negative and non-finite ranges never produce a worker position', () => {
  assert.equal(estimateFtm(layout, { front_m: 1, rear_left_m: null, rear_right_m: 2 }), null);
  assert.equal(estimateFtm(layout, { front_m: -1, rear_left_m: 1, rear_right_m: 1 }), null);
  assert.equal(estimateFtm(layout, { front_m: NaN, rear_left_m: 1, rear_right_m: 1 }), null);
});
test('contradictory valid ranges are explicitly a rough estimate', () => {
  const result = estimateFtm(layout, { front_m: 0.05, rear_left_m: 3.5, rear_right_m: 0.01 });
  assert.ok(result);
  assert.equal(result.quality, 'rough');
  assert.ok(result.residual_m > layout.assumed_range_error_m);
});

/** Ordinary L2 residual objective, the same one used in Vlad's SciPy locator.py. */
function cost(point, ranges) {
  const anchors = getAnchors(layout);
  const values = [ranges.front_m, ranges.rear_left_m, ranges.rear_right_m];
  return anchors.reduce((sum, anchor, index) => {
    const residual = Math.hypot(point.x - anchor.x, point.y - anchor.y) - values[index];
    return sum + residual * residual;
  }, 0);
}
function linearEstimate(ranges) {
  const [p0, p1, p2] = getAnchors(layout);
  const [r0, r1, r2] = [ranges.front_m, ranges.rear_left_m, ranges.rear_right_m];
  const a = p1.x - p0.x, b = p1.y - p0.y, c = p2.x - p0.x, d = p2.y - p0.y;
  const det = a * d - b * c;
  const u = ((r0 - r1) * (r0 + r1) + a * a + b * b) / 2;
  const v = ((r0 - r2) * (r0 + r2) + c * c + d * d) / 2;
  return { x: p0.x + (d * u - b * v) / det, y: p0.y + (a * v - c * u) / det };
}

test('nonlinear result matches SciPy least_squares benchmark for noisy ranges', () => {
  // Generated independently with scipy.optimize.least_squares using multiple seeds.
  const ranges = { front_m: 1.2, rear_left_m: 1.65, rear_right_m: 1.53 };
  const result = estimateFtm(layout, ranges);
  assert.ok(result);
  assert.ok(Math.abs(result.x - 0.43029353) < 1e-4);
  assert.ok(Math.abs(result.y - 0.67979198) < 1e-4);
  assert.ok(Math.abs(cost(result, ranges) - 0.1641525048) < 1e-6);
  assert.ok(cost(result, ranges) <= cost(linearEstimate(ranges), ranges) + 1e-8);
});

test('contradictory inputs minimize true range errors rather than squared-range differences', () => {
  // An intentionally inconsistent FTM triple.
  const ranges = { front_m: 0.05, rear_left_m: 3.5, rear_right_m: 0.01 };
  const result = estimateFtm(layout, ranges);
  assert.ok(result);
  assert.ok(Math.abs(result.x - 0.92007164) < 1e-4);
  assert.ok(Math.abs(result.y - 0.89605677) < 1e-4);
  assert.equal(result.quality, 'rough');
  assert.ok(cost(result, ranges) < cost(linearEstimate(ranges), ranges));
});

test('zero FTM readings produce finite rough estimate, not NaN or fake success', () => {
  const ranges = { front_m: 0, rear_left_m: 1.2, rear_right_m: 0 };
  const result = estimateFtm(layout, ranges);
  assert.ok(result);
  assert.ok(Number.isFinite(result.x) && Number.isFinite(result.y));
  assert.ok(Number.isFinite(result.residual_m) && Number.isFinite(result.spread_m));
  assert.equal(result.quality, 'rough');
});

test('repeated calls on the same ranges are deterministic', () => {
  const ranges = { front_m: 1.2, rear_left_m: 1.65, rear_right_m: 1.53 };
  assert.deepEqual(estimateFtm(layout, ranges), estimateFtm(layout, ranges));
});
