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
 * Nonlinear least-squares trilateration, matching the objective of
 * halo_nat/locator.py (SciPy least_squares):
 *
 *   minimize sum_i (hypot(x - anchor[i].x, y - anchor[i].y) - range[i])^2
 *
 * A damped Gauss-Newton / Levenberg-Marquardt optimizer solves the 2D
 * problem in-browser without requiring SciPy or changing the gateway.
 * The old linear solution is only an initial guess, NOT the final estimate.
 */
function squaredRangeError(
  anchors: readonly Anchor[], distances: readonly number[], x: number, y: number,
): number {
  let sum = 0;
  for (let i = 0; i < anchors.length; i++) {
    const residual = Math.hypot(x - anchors[i].x, y - anchors[i].y) - distances[i];
    sum += residual * residual;
  }
  return sum;
}

function linearInitialGuess(anchors: readonly Anchor[], distances: readonly number[]): [number, number] | null {
  const [p0, p1, p2] = anchors;
  const [r0, r1, r2] = distances;
  const a = p1.x - p0.x, b = p1.y - p0.y;
  const c = p2.x - p0.x, d = p2.y - p0.y;
  const det = a * d - b * c;
  if (Math.abs(det) < 0.01) return null;
  const u = ((r0 - r1) * (r0 + r1) + a * a + b * b) / 2;
  const v = ((r0 - r2) * (r0 + r2) + c * c + d * d) / 2;
  const x = p0.x + (d * u - b * v) / det;
  const y = p0.y + (a * v - c * u) / det;
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

function solve(anchors: readonly Anchor[], distances: readonly number[]): [number, number] | null {
  if (distances.length !== 3 || distances.some(d => !Number.isFinite(d) || d < 0)) return null;
  const centroid: [number, number] = [
    anchors.reduce((sum, a) => sum + a.x, 0) / anchors.length,
    anchors.reduce((sum, a) => sum + a.y, 0) / anchors.length,
  ];
  const linear = linearInitialGuess(anchors, distances);
  // Multiple starting points protect against a stationary or poor local minimum,
  // especially near an anchor or for contradictory FTM ranges.
  const starts: [number, number][] = [
    centroid,
    ...(linear ? [linear] : []),
    ...anchors.map(a => [a.x, a.y] as [number, number]),
  ];
  let best: [number, number] | null = null;
  let bestCost = Infinity;

  for (const [startX, startY] of starts) {
    let x = startX, y = startY;
    let cost = squaredRangeError(anchors, distances, x, y);
    if (!Number.isFinite(cost)) continue;
    let lambda = 0.01;

    for (let iteration = 0; iteration < 160; iteration++) {
      let jxx = 0, jxy = 0, jyy = 0, gx = 0, gy = 0;
      for (let i = 0; i < 3; i++) {
        const dx = x - anchors[i].x, dy = y - anchors[i].y;
        const distance = Math.hypot(dx, dy);
        const residual = distance - distances[i];
        // The derivative at distance=0 is undefined; let other anchors
        // guide this iteration instead of producing NaNs.
        const jx = distance > 1e-10 ? dx / distance : 0;
        const jy = distance > 1e-10 ? dy / distance : 0;
        jxx += jx * jx;
        jxy += jx * jy;
        jyy += jy * jy;
        gx += jx * residual;
        gy += jy * residual;
      }
      if (Math.hypot(gx, gy) < 1e-11) break;
      const a = jxx + lambda, b = jxy, d = jyy + lambda;
      const determinant = a * d - b * b;
      if (!Number.isFinite(determinant) || determinant <= 1e-20) break;
      const stepX = (d * gx - b * gy) / determinant;
      const stepY = (a * gy - b * gx) / determinant;
      const nextX = x - stepX, nextY = y - stepY;
      const nextCost = squaredRangeError(anchors, distances, nextX, nextY);

      if (Number.isFinite(nextCost) && nextCost < cost) {
        const previousCost = cost;
        x = nextX;
        y = nextY;
        cost = nextCost;
        lambda = Math.max(1e-12, lambda / 3);
        if (previousCost - nextCost < 1e-13 * Math.max(1, previousCost) &&
            Math.hypot(stepX, stepY) < 1e-7) break;
      } else {
        lambda *= 10;
        if (lambda > 1e12) break;
      }
    }

    if (cost < bestCost && Number.isFinite(x) && Number.isFinite(y)) {
      bestCost = cost;
      best = [x, y];
    }
  }
  return best;
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
