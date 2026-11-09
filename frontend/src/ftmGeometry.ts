/** All positions are vehicle-local metres: +X right, +Y forward. */
export type FtmLayout = {
  vehicle_id: string;
  organization_id: string;
  front_x_m: number;
  front_y_m: number;
  rear_left_x_m: number;
  rear_left_y_m: number;
  rear_right_x_m: number;
  rear_right_y_m: number;
  front_bias_m: number;
  rear_left_bias_m: number;
  rear_right_bias_m: number;
  assumed_range_error_m: number;
  updated_at?: string;
};

export type Anchor = {
  key: 'front' | 'rear_left' | 'rear_right';
  name: 'HaloFront' | 'HaloRearL' | 'HaloRearR';
  x: number;
  y: number;
  bias: number;
};
export type FtmRangeSet = {
  front_m: number | null;
  rear_left_m: number | null;
  rear_right_m: number | null;
};
export type FtmEstimate = {
  x: number;
  y: number;
  residual_m: number;
  spread_m: number;
  corrected_m: [number, number, number];
  quality: 'self_consistent' | 'rough';
};

export function getAnchors(layout: FtmLayout): [Anchor, Anchor, Anchor] {
  return [
    { key: 'front', name: 'HaloFront', x: layout.front_x_m, y: layout.front_y_m, bias: layout.front_bias_m },
    { key: 'rear_left', name: 'HaloRearL', x: layout.rear_left_x_m, y: layout.rear_left_y_m, bias: layout.rear_left_bias_m },
    { key: 'rear_right', name: 'HaloRearR', x: layout.rear_right_x_m, y: layout.rear_right_y_m, bias: layout.rear_right_bias_m },
  ];
}

function detOf(a: readonly Anchor[]): number {
  return (a[1].x - a[0].x) * (a[2].y - a[0].y) -
    (a[1].y - a[0].y) * (a[2].x - a[0].x);
}

/** Require a measured non-degenerate triangle, not an assumed/default layout. */
export function validateLayout(layout: FtmLayout): string | null {
  const a = getAnchors(layout);
  for (const point of a) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) ||
      Math.abs(point.x) > 100 || Math.abs(point.y) > 100)
      return 'Each measured X/Y coordinate must be between −100 and 100 m.';
    if (!Number.isFinite(point.bias) || Math.abs(point.bias) > 10)
      return 'Each range bias must be between −10 and 10 m.';
  }
  if (!Number.isFinite(layout.assumed_range_error_m) ||
    layout.assumed_range_error_m < 0.01 || layout.assumed_range_error_m > 10)
    return 'Assumed range error must be between 0.01 and 10 m.';
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      if (Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y) < 0.1)
        return 'Place each anchor at least 0.1 m from the others.';
    }
  }
  if (Math.abs(detOf(a)) < 0.01)
    return 'Anchor positions must form a triangle, not a straight line or very narrow triangle.';
  return null;
}

/**
 * Match halo_nat/worker_locator.py: subtract squared range equations,
 * solve for XY, and report full-range residual plus worst ±error sensitivity.
 * Three ranges are not enough to guarantee reliable positioning.
 */
function solve(anchors: readonly Anchor[], distances: readonly number[]): [number, number] | null {
  const [p0, p1, p2] = anchors;
  const [r0, r1, r2] = distances;
  const a = p1.x - p0.x;
  const b = p1.y - p0.y;
  const c = p2.x - p0.x;
  const d = p2.y - p0.y;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 0.01) return null;
  const u = ((r0 - r1) * (r0 + r1) + a * a + b * b) / 2;
  const v = ((r0 - r2) * (r0 + r2) + c * c + d * d) / 2;
  const x = p0.x + (d * u - b * v) / determinant;
  const y = p0.y + (a * v - c * u) / determinant;
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

export function estimateFtm(layout: FtmLayout, ranges: FtmRangeSet): FtmEstimate | null {
  if (validateLayout(layout)) return null;
  const anchors = getAnchors(layout);
  const raw = [ranges.front_m, ranges.rear_left_m, ranges.rear_right_m];
  if (raw.some(v => v === null || !Number.isFinite(v) || v < 0 || v > 1000)) return null;
  const corrected = raw.map((v, i) => Math.max(0, v! - anchors[i].bias)) as [number, number, number];
  const solved = solve(anchors, corrected);
  if (!solved) return null;
  const [x, y] = solved;
  // A wildly ill-conditioned result is not meaningful to plot on a vehicle map.
  if (Math.abs(x) > 1000 || Math.abs(y) > 1000) return null;
  const residual = Math.max(...anchors.map((p, i) =>
    Math.abs(Math.hypot(x - p.x, y - p.y) - corrected[i])));
  let spread = 0;
  for (let mask = 0; mask < 8; mask++) {
    const perturbed = corrected.map((v, i) =>
      Math.max(0, v + (mask & (1 << i) ? 1 : -1) * layout.assumed_range_error_m));
    const alternate = solve(anchors, perturbed);
    if (!alternate) return null;
    spread = Math.max(spread, Math.hypot(alternate[0] - x, alternate[1] - y));
  }
  return {
    x, y, residual_m: residual, spread_m: spread, corrected_m: corrected,
    quality: residual <= layout.assumed_range_error_m && spread <= 0.5 ? 'self_consistent' : 'rough',
  };
}
