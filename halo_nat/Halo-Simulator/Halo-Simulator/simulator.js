'use strict';

const get = id => document.getElementById(id);
const map = get('map');
const status = get('status');
let width = 800;
let height = 500;
let mode = 'move';
let zone = [{ x: 345, y: 250 }, { x: 455, y: 250 }, { x: 535, y: 415 }, { x: 265, y: 415 }];
let draft = [];
let scaleStart;
let distance = 0;
let worker = { x: 190, y: 240 };
let activeEvent;
let dragging = false;
let imageRequest = 0;

function points(list) {
  return list.map(point => [point.x, point.y].join(',')).join(' ');
}

function contains(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y)
        && point.x < a.x + (b.x - a.x) * (point.y - a.y) / (b.y - a.y)) inside = !inside;
  }
  return inside;
}

function updateAlert() {
  const inZone = contains(worker, zone);
  get('driver').textContent = inZone ? 'Stop. Worker in blind zone.' : 'No active warning';
  get('walker').textContent = inZone ? 'Step clear of the vehicle.' : 'No active warning';
  for (const id of ['driver', 'walker']) get(id).classList.toggle('warning', inZone);
  if (inZone && !activeEvent) {
    get('empty').hidden = true;
    const item = document.createElement('li');
    const entered = new Date().toLocaleTimeString();
    item.textContent = 'Worker entered zone at ' + entered;
    get('events').prepend(item);
    activeEvent = item;
  } else if (!inZone && activeEvent) {
    activeEvent.textContent += ' · exited at ' + new Date().toLocaleTimeString();
    activeEvent = undefined;
  }
}

function draw() {
  get('zone').setAttribute('points', points(zone));
  get('draft').setAttribute('points', points(draft));
  get('worker').setAttribute('cx', worker.x);
  get('worker').setAttribute('cy', worker.y);
  get('worker').setAttribute('r', Math.min(width, height) * 0.021);
  get('finish').disabled = mode !== 'trace' || draft.length < 3;
  updateAlert();
}

function setMode(next, message) {
  mode = next;
  dragging = false;
  if (next !== 'trace') draft = [];
  if (next !== 'scale') scaleStart = undefined;
  for (const id of ['move', 'trace', 'scale']) get(id).setAttribute('aria-pressed', id === next);
  status.textContent = message;
  draw();
}

function placeWorker(point) {
  worker = { x: Math.max(0, Math.min(width, point.x)), y: Math.max(0, Math.min(height, point.y)) };
  draw();
}

get('scale').onclick = () => {
  distance = Number(get('meters').value);
  if (!Number.isFinite(distance) || distance <= 0) {
    status.textContent = 'Enter a positive reference length in metres.';
    return;
  }
  scaleStart = undefined;
  setMode('scale', 'Click the first end of the known reference length.');
};
get('trace').onclick = () => {
  draft = [];
  setMode('trace', 'Click around the blind zone, then choose Finish zone.');
};
get('move').onclick = () => setMode('move', 'Tap or drag on the map to move the worker.');
get('finish').onclick = () => {
  const area = draft.reduce((sum, point, i) => {
    const next = draft[(i + 1) % draft.length];
    return sum + point.x * next.y - point.y * next.x;
  }, 0);
  if (Math.abs(area) < 1) {
    status.textContent = 'Trace a zone with at least three corners that enclose an area.';
    return;
  }
  zone = draft;
  setMode('move', 'Zone saved. Move the worker into the shaded area.');
};

function mapPoint(event) {
  const matrix = map.getScreenCTM();
  if (!matrix) return;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  if (point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height) return point;
}

map.onpointerdown = event => {
  const point = mapPoint(event);
  if (!point) return;
  if (mode === 'move') {
    dragging = true;
    map.setPointerCapture(event.pointerId);
    placeWorker(point);
  } else if (mode === 'trace') {
    draft.push(point);
    draw();
  } else if (!scaleStart) {
    scaleStart = point;
    status.textContent = 'Click the other end of the reference length.';
  } else {
    const pixels = Math.hypot(point.x - scaleStart.x, point.y - scaleStart.y);
    if (pixels < 1) {
      status.textContent = 'Choose a different second point.';
      return;
    }
    get('ratio').textContent = distance + ' m reference · ' + (pixels / distance).toFixed(1) + ' image pixels per metre';
    for (const [key, value] of Object.entries({ x1: scaleStart.x, y1: scaleStart.y, x2: point.x, y2: point.y })) {
      get('ruler').setAttribute(key, value);
    }
    setMode('move', 'Scale saved. Trace the blind zone or move the worker.');
  }
};
map.onpointermove = event => {
  if (!dragging) return;
  const point = mapPoint(event);
  if (point) placeWorker(point);
};
map.onlostpointercapture = () => { dragging = false; };
map.onkeydown = event => {
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (mode !== 'move' || !direction) return;
  event.preventDefault();
  const step = Math.min(width, height) / 50;
  placeWorker({ x: worker.x + step * direction[0], y: worker.y + step * direction[1] });
};

get('upload').onchange = event => {
  const file = event.target.files[0];
  const request = ++imageRequest;
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) {
    status.textContent = 'Choose a PNG, JPEG, or WebP image under 15 MB.';
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => {
    if (request === imageRequest) status.textContent = 'Could not read this image.';
  };
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => {
      if (request === imageRequest) status.textContent = 'Could not open this image.';
    };
    image.onload = () => {
      if (request !== imageRequest) return;
      width = image.naturalWidth;
      height = image.naturalHeight;
      map.setAttribute('viewBox', [0, 0, width, height].join(' '));
      get('diagram').setAttribute('href', reader.result);
      get('diagram').setAttribute('width', width);
      get('diagram').setAttribute('height', height);
      get('sample').hidden = true;
      get('sample').setAttribute('display', 'none');
      for (const key of ['x1', 'y1', 'x2', 'y2']) get('ruler').removeAttribute(key);
      get('ratio').textContent = 'Scale not set';
      zone = [];
      worker = { x: width * 0.2, y: height * 0.5 };
      activeEvent = undefined;
      get('events').replaceChildren();
      get('empty').hidden = false;
      setMode('move', 'Diagram loaded. Set its scale and trace a blind zone.');
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
};

draw();
