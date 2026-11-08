import { useEffect, useMemo, useRef } from 'react';

type Props = { paused: boolean };
type Point = { x: number; y: number };
type Facet = { id: number; points: string; center: Point; fill: string; opacity: number };

const VIEW_W = 1440;
const VIEW_H = 900;

/**
 * A distinct, gently colored irregular polygon field.
 * The base mesh is rendered once as SVG, not repainted on every frame.
 * Only nearby translucent facets rise toward the cursor (max ~38 SVG
 * transforms per pointer animation frame); no idle JavaScript animation.
 */
function buildMesh() {
  let seed = 41729;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const columns = 13;
  const rows = 9;
  const dx = VIEW_W / (columns - 1);
  const dy = VIEW_H / (rows - 1);
  const points: Point[][] = [];

  for (let row = 0; row < rows; row++) {
    const line: Point[] = [];
    for (let col = 0; col < columns; col++) {
      line.push({
        x: col * dx + (rand() - 0.5) * dx * 0.69,
        y: row * dy + (rand() - 0.5) * dy * 0.66,
      });
    }
    points.push(line);
  }

  const fills = ['#d3eadc', '#a6d6c3', '#b3cbd7', '#d8e9de', '#9ab8c8', '#a9aecf', '#8fc9c8', '#bacde2'];
  const mesh: Facet[] = [];
  const floating: Facet[] = [];

  function addTriangle(a: Point, b: Point, c: Point) {
    const index = mesh.length;
    const polygon: Facet = {
      id: index,
      points: [a, b, c].map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' '),
      center: { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 },
      fill: fills[Math.floor(rand() * fills.length)],
      opacity: 0.10 + rand() * 0.25,
    };
    mesh.push(polygon);
    if ((index + Math.floor(index / 19)) % 5 === 0) floating.push(polygon);
  }

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < columns - 1; col++) {
      const a = points[row][col];
      const b = points[row][col + 1];
      const c = points[row + 1][col];
      const d = points[row + 1][col + 1];
      if (rand() > 0.5) {
        addTriangle(a, b, c);
        addTriangle(b, d, c);
      } else {
        addTriangle(a, b, d);
        addTriangle(a, d, c);
      }
    }
  }
  return { mesh, floating };
}

export default function MeshBackground({ paused }: Props) {
  const scene = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const raised = useRef<Array<SVGPolygonElement | null>>([]);
  const data = useMemo(buildMesh, []);

  useEffect(() => {
    const layer = scene.current;
    const artwork = svg.current;
    if (!layer || !artwork) return;

    let frame = 0;
    let mouseX = 0;
    let mouseY = 0;

    const reset = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      layer.style.transform = '';
      for (const node of raised.current) {
        if (node) {
          node.style.opacity = '0';
          node.style.transform = '';
        }
      }
    };

    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      reset();
      return;
    }

    const drawHover = () => {
      frame = 0;
      const box = artwork.getBoundingClientRect();
      const scale = Math.max(box.width / VIEW_W, box.height / VIEW_H);
      const offsetX = (box.width - VIEW_W * scale) / 2;
      const offsetY = (box.height - VIEW_H * scale) / 2;
      const x = (mouseX - box.left - offsetX) / scale;
      const y = (mouseY - box.top - offsetY) / scale;

      // Whole-field parallax is tiny; the individual polygon highlights are
      // what gives the impression of facets lifting off the surface.
      const px = (mouseX / Math.max(1, window.innerWidth) - 0.5) * 12;
      const py = (mouseY / Math.max(1, window.innerHeight) - 0.5) * 12;
      layer.style.transform = 'translate3d(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px,0)';

      data.floating.forEach((facet, index) => {
        const node = raised.current[index];
        if (!node) return;
        const dx = facet.center.x - x;
        const dy = facet.center.y - y;
        const distance = Math.hypot(dx, dy);
        const strength = Math.max(0, 1 - distance / 315);
        if (strength < 0.015) {
          node.style.opacity = '0';
          node.style.transform = '';
          return;
        }

        const liftX = (dx / Math.max(50, distance)) * strength * 11;
        const liftY = (dy / Math.max(50, distance)) * strength * 11 - strength * 7;
        node.style.opacity = (strength * 0.74).toFixed(3);
        node.style.transform = 'translate3d(' + liftX.toFixed(1) + 'px,' + liftY.toFixed(1) +
          'px,0) scale(' + (1 + strength * 0.038).toFixed(3) + ')';
      });
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      mouseX = event.clientX;
      mouseY = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(drawHover);
    };
    const onOut = (event: PointerEvent) => {
      if (!event.relatedTarget) reset();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerout', onOut);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onOut);
      reset();
    };
  }, [paused, data]);

  return (
    <div className={'mesh-background' + (paused ? ' mesh-still' : '')} aria-hidden="true">
      <div className="mesh-scene" ref={scene}>
        <svg className="mesh-artwork" ref={svg}
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="halo-mesh-gradient" x1="0%" y1="0%" x2="100%" y2="90%">
              <stop offset="0%" stopColor="#b5dfcb"/>
              <stop offset="44%" stopColor="#a8ccd1"/>
              <stop offset="100%" stopColor="#a9b5d4"/>
            </linearGradient>
          </defs>
          <rect x="-90" y="-90" width="1620" height="1080" fill="url(#halo-mesh-gradient)" />
          <g className="mesh-static-facets">
            {data.mesh.map(facet => (
              <polygon key={facet.id} points={facet.points} fill={facet.fill}
                fillOpacity={facet.opacity} stroke="#567d97" strokeOpacity="0.15"
                strokeWidth="0.85" />
            ))}
          </g>
          <g className="mesh-raised-facets">
            {data.floating.map((facet, index) => (
              <polygon key={facet.id} points={facet.points} fill="#f4ffff"
                stroke="#f1faff" strokeWidth="1.3" strokeOpacity="0.7"
                ref={node => { raised.current[index] = node; }} />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
