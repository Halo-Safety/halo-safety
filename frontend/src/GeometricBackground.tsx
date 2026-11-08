import { useEffect, useRef } from 'react';

type Point = { x: number; y: number };
type Props = { paused: boolean };

// Real, frame-by-frame geometric animation: triangulated wireframe mesh and
// independently rotating 3D octahedra. No WebGL or third-party runtime needed.
export default function GeometricBackground({ paused }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !context) return;

    let width = 1;
    let height = 1;
    let frameId = 0;
    let lastFrame = -1000;
    let pointerX = 0;
    let pointerY = 0;
    let easedX = 0;
    let easedY = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const pointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / Math.max(1, width) - 0.5) * 38;
      pointerY = (event.clientY / Math.max(1, height) - 0.5) * 34;
    };

    const vertices: [number, number, number][] = [
      [0, -1.25, 0], [1, 0, 0], [0, 1.25, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
    ];
    const edges: [number, number][] = [
      [0, 1], [0, 3], [0, 4], [0, 5],
      [2, 1], [2, 3], [2, 4], [2, 5],
      [1, 4], [1, 5], [3, 4], [3, 5],
    ];
    const faces: [number, number, number][] = [
      [0, 1, 4], [0, 4, 3], [0, 3, 5], [0, 5, 1],
      [2, 1, 4], [2, 4, 3], [2, 3, 5], [2, 5, 1],
    ];

    function drawPolyhedron(
      centerX: number, centerY: number, radius: number,
      time: number, speed: number, color: [number, number, number],
    ) {
      if (!context) return;
      const turnY = time * speed;
      const turnX = time * speed * 0.61 + 0.42;
      const cy = Math.cos(turnY);
      const sy = Math.sin(turnY);
      const cx = Math.cos(turnX);
      const sx = Math.sin(turnX);

      const projected = vertices.map(([x, y, z]) => {
        const rx = x * cy + z * sy;
        const rz = z * cy - x * sy;
        const ry = y * cx - rz * sx;
        const zz = y * sx + rz * cx;
        const perspective = 3.65 / (3.65 + zz);
        return { x: centerX + rx * radius * perspective,
                 y: centerY + ry * radius * perspective };
      });

      context.save();
      for (const [a, b, c] of faces) {
        context.beginPath();
        context.moveTo(projected[a].x, projected[a].y);
        context.lineTo(projected[b].x, projected[b].y);
        context.lineTo(projected[c].x, projected[c].y);
        context.closePath();
        context.fillStyle = 'rgba(' + color.join(',') + ',0.017)';
        context.fill();
      }

      context.lineWidth = 1.1;
      context.strokeStyle = 'rgba(' + color.join(',') + ',0.32)';
      for (const [a, b] of edges) {
        context.beginPath();
        context.moveTo(projected[a].x, projected[a].y);
        context.lineTo(projected[b].x, projected[b].y);
        context.stroke();
      }

      for (const point of projected) {
        context.beginPath();
        context.arc(point.x, point.y, 2.1, 0, Math.PI * 2);
        context.fillStyle = 'rgba(' + color.join(',') + ',0.7)';
        context.fill();
      }
      context.restore();
    }

    function draw(ms: number) {
      if (!context) return;
      const time = ms / 1000;
      easedX += (pointerX - easedX) * (paused ? 0 : 0.045);
      easedY += (pointerY - easedY) * (paused ? 0 : 0.045);

      context.fillStyle = '#090d19';
      context.fillRect(0, 0, width, height);

      const bg = context.createRadialGradient(
        width * 0.51, height * 0.48, 0,
        width * 0.51, height * 0.48, Math.max(width, height) * 0.83,
      );
      bg.addColorStop(0, '#172039');
      bg.addColorStop(0.62, '#0d1425');
      bg.addColorStop(1, '#070a13');
      context.fillStyle = bg;
      context.fillRect(0, 0, width, height);

      // Nodes of a shifting triangular mesh, visible especially to the sides
      // of the login window. Geometry re-computes on every rendered frame.
      const spacingX = width < 700 ? 76 : 99;
      const spacingY = width < 700 ? 77 : 91;
      const columns = Math.ceil(width / spacingX) + 3;
      const rows = Math.ceil(height / spacingY) + 3;
      const mesh: Point[][] = [];
      for (let row = 0; row < rows; row++) {
        const points: Point[] = [];
        for (let col = 0; col < columns; col++) {
          const seed = row * 0.83 + col * 0.49;
          const oscillate = Math.sin(seed + time * 0.32);
          const ripple = Math.cos(col * 0.55 - row * 0.37 + time * 0.27);
          points.push({
            x: (col - 1) * spacingX + (row % 2) * (spacingX / 2)
              + oscillate * 15 + easedX * (0.25 + row / rows * 0.4),
            y: (row - 1) * spacingY + ripple * 17
              + easedY * (0.20 + col / columns * 0.5),
          });
        }
        mesh.push(points);
      }

      const line = (a: Point, b: Point, alpha: number) => {
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.strokeStyle = 'rgba(128,159,232,' + alpha.toFixed(3) + ')';
        context.lineWidth = 0.8;
        context.stroke();
      };

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const a = mesh[row][col];
          if (col + 1 < columns) line(a, mesh[row][col + 1], 0.17);
          if (row + 1 < rows) {
            line(a, mesh[row + 1][col], 0.16);
            if (col + (row % 2 ? 1 : 0) < columns) {
              line(a, mesh[row + 1][col + (row % 2 ? 1 : 0)], 0.12);
            }
          }
          const sparkle = Math.sin(time * 0.9 + row * 3.21 + col * 2.47);
          if (sparkle > 0.82) {
            context.beginPath();
            context.arc(a.x, a.y, 1.6, 0, Math.PI * 2);
            context.fillStyle = 'rgba(182,204,255,' + ((sparkle - 0.82) * 2.25).toFixed(3) + ')';
            context.fill();
          }
        }
      }

      const smallScreen = width < 740;
      drawPolyhedron(
        width * (smallScreen ? 0.05 : 0.16) + easedX * 0.4,
        height * 0.45 + easedY * 0.25,
        smallScreen ? 92 : 128,
        time, 0.19, [140, 164, 247],
      );
      drawPolyhedron(
        width * (smallScreen ? 0.94 : 0.84) - easedX * 0.3,
        height * 0.61 - easedY * 0.2,
        smallScreen ? 94 : 160,
        time + 7.2, -0.15, [112, 187, 222],
      );

      // Light overlay keeps cards readable without hiding geometry.
      const tint = context.createLinearGradient(0, 0, width, height);
      tint.addColorStop(0, 'rgba(5,8,18,0.12)');
      tint.addColorStop(0.5, 'rgba(5,8,18,0.025)');
      tint.addColorStop(1, 'rgba(5,8,18,0.13)');
      context.fillStyle = tint;
      context.fillRect(0, 0, width, height);
    }

    const loop = (now: number) => {
      if (now - lastFrame >= 32) {
        draw(now);
        lastFrame = now;
      }
      frameId = window.requestAnimationFrame(loop);
    };

    resize();
    if (paused) draw(0);
    else frameId = window.requestAnimationFrame(loop);
    window.addEventListener('resize', resize, { passive: true });
    if (!paused) window.addEventListener('pointermove', pointerMove, { passive: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', pointerMove);
    };
  }, [paused]);

  return (
    <div className="geometry-field" aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="geometry-vignette" />
    </div>
  );
}
