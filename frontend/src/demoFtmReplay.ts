/**
 * Temporary browser-only playback for recording the field-test walking path.
 * These are synthetic map positions (not ESP32 ranges or measured FTM results).
 * Remove this fixture after the video is recorded.
 */
export const DEMO_REPLAY_GATEWAY = '__halo_demo_route_replay__';
export const DEMO_REPLAY_INTERVAL_MS = 11_000;

type Waypoint = { targetX: number; targetY: number; errorX: number; errorY: number; phase: string };

/** Vehicle-relative metres: positive X right, positive Y forward. */
const waypoints: Waypoint[] = [
  { targetX:  0, targetY:  4, errorX:  0.95, errorY: -0.48, phase: 'Front center' },
  { targetX:  0, targetY:  4, errorX:  1.21, errorY:  0.39, phase: 'Front center · pause' },
  { targetX: -1, targetY:  4, errorX:  1.08, errorY:  0.42, phase: 'Front left' },
  { targetX: -1, targetY:  4, errorX:  0.91, errorY: -0.71, phase: 'Front left · pause' },
  { targetX:  0, targetY:  4, errorX:  1.30, errorY: -0.43, phase: 'Front center' },
  { targetX:  1, targetY:  4, errorX:  0.83, errorY:  0.79, phase: 'Front right' },
  { targetX:  1, targetY:  4, errorX:  1.19, errorY:  0.26, phase: 'Front right · pause' },
  { targetX:  1, targetY:  1, errorX:  0.72, errorY:  1.04, phase: 'Right middle' },
  { targetX:  1, targetY:  1, errorX:  1.15, errorY:  0.42, phase: 'Right middle · pause' },
  { targetX:  1, targetY: -0.5, errorX:  1.08, errorY: -0.43, phase: 'Right rear' },
  { targetX:  1, targetY: -0.5, errorX:  0.89, errorY:  0.84, phase: 'Right rear · pause' },
  { targetX:  1, targetY:  1, errorX:  1.24, errorY: -0.38, phase: 'Right middle' },
  { targetX:  1, targetY:  1, errorX:  0.98, errorY:  0.51, phase: 'Right middle · pause' },
  { targetX:  1, targetY:  4, errorX:  1.16, errorY:  0.60, phase: 'Front right · finish' },
];

export const demoReplayWaypoints = waypoints.map((p, index) => ({
  index,
  phase: p.phase,
  targetX: p.targetX,
  targetY: p.targetY,
  x: p.targetX + p.errorX,
  y: p.targetY + p.errorY,
  offset_m: Math.hypot(p.errorX, p.errorY),
}));
