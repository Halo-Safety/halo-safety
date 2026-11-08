'use strict';

const get = id => document.getElementById(id);
const map = get('map');
const status = get('status');
let width = 800;
let height = 500;
let mode = 'move';
let vehicle = { x: 400, y: 165, heading: 0, name: 'Demo loader', length: 8.5, width: 6 };
let zones = [{ name: 'Rear blind zone', points: [
  { x: -55, y: 85 }, { x: 55, y: 85 }, { x: 135, y: 250 }, { x: -135, y: 250 },
] }];
let draft = [];
let rearPoint;
let scaleStart;
let distance = 0;
let pixelsPerMetre;
let worker = { x: 190, y: 240 };
const activeEvents = new Map();
let dragging = false;
let imageRequest = 0;

function points(list) {
  return list.map(point => [point.x, point.y].join(',')).join(' ');
}

function rotate(point, heading) {
  const radians = heading * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

function localPoint(point, pose) {
  return rotate({ x: point.x - pose.x, y: point.y - pose.y }, -pose.heading);
}

function mapPosition(point, pose) {
  const rotated = rotate(point, pose.heading);
  return { x: rotated.x + pose.x, y: rotated.y + pose.y };
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
  const relativeWorker = vehicle && localPoint(worker, vehicle);
  const occupied = relativeWorker ? zones.filter(zone => contains(relativeWorker, zone.points)) : [];
  const inZone = occupied.length > 0;
  get('driver').textContent = inZone ? 'Stop. Worker in blind zone.' : 'No active warning';
  get('walker').textContent = inZone ? 'Step clear of the vehicle.' : 'No active warning';
  for (const id of ['driver', 'walker']) get(id).classList.toggle('warning', inZone);
  for (const [zone, item] of activeEvents) {
    if (occupied.includes(zone)) continue;
    item.textContent += ' · exited at ' + new Date().toLocaleTimeString();
    activeEvents.delete(zone);
  }
  for (const zone of occupied) {
    if (activeEvents.has(zone)) continue;
    get('empty').hidden = true;
    const item = document.createElement('li');
    const entered = new Date().toLocaleTimeString();
    item.textContent = 'Entered ' + zone.name + ' at ' + entered;
    get('events').prepend(item);
    activeEvents.set(zone, item);
  }
}

function renderZones() {
  get('zones').replaceChildren();
  get('zone-list').replaceChildren();
  for (const zone of zones) {
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', points(zone.points));
    polygon.setAttribute('vector-effect', 'non-scaling-stroke');
    get('zones').append(polygon);
    const item = document.createElement('li');
    item.textContent = zone.name;
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', 'Remove ' + zone.name);
    remove.onclick = () => {
      zones = zones.filter(saved => saved !== zone);
      renderZones();
      draw();
    };
    item.append(' ', remove);
    get('zone-list').append(item);
  }
}

function draw() {
  get('vehicle-pose').setAttribute('visibility', vehicle ? 'visible' : 'hidden');
  get('trace').disabled = !vehicle;
  get('vehicle-move').disabled = !vehicle;
  get('heading').disabled = !vehicle;
  if (vehicle) {
    const scale = pixelsPerMetre || 20;
    const halfWidth = vehicle.width * scale / 2;
    const halfLength = vehicle.length * scale / 2;
    get('vehicle-pose').setAttribute('transform',
      'translate(' + vehicle.x + ' ' + vehicle.y + ') rotate(' + vehicle.heading + ')');
    for (const [key, value] of Object.entries({
      x: -halfWidth, y: -halfLength, width: halfWidth * 2, height: halfLength * 2,
      rx: Math.min(halfWidth, halfLength) * 0.12,
    })) get('vehicle-body').setAttribute(key, value);
    get('vehicle-front').setAttribute('points', points([
      { x: 0, y: -halfLength * 0.87 }, { x: halfWidth * 0.45, y: -halfLength * 0.53 },
      { x: -halfWidth * 0.45, y: -halfLength * 0.53 },
    ]));
    get('vehicle-label').textContent = vehicle.name;
    get('vehicle-label').setAttribute('font-size',
      Math.min(halfLength * 0.24, halfWidth * 2.6 / vehicle.name.length));
    get('heading').value = Math.round(vehicle.heading) % 360;
    get('heading-value').textContent = get('heading').value + '°';
  }
  get('draft').setAttribute('points', points(draft));
  get('worker').setAttribute('cx', worker.x);
  get('worker').setAttribute('cy', worker.y);
  get('worker').setAttribute('r', pixelsPerMetre ? pixelsPerMetre * 0.25 : Math.min(width, height) * 0.021);
  get('finish').disabled = mode !== 'trace' || draft.length < 3;
  updateAlert();
}

function setMode(next, message) {
  mode = next;
  dragging = false;
  if (next !== 'trace') draft = [];
  if (next !== 'scale') scaleStart = undefined;
  if (next !== 'identify') rearPoint = undefined;
  for (const id of ['move', 'trace', 'scale', 'identify', 'vehicle-move']) {
    get(id).setAttribute('aria-pressed', id === next);
  }
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
get('vehicle-move').onclick = () => setMode('vehicle-move', 'Tap or drag to move the vehicle and its blind zones.');
get('reference-visible').onchange = event => {
  get('diagram').setAttribute('visibility', event.target.checked ? 'visible' : 'hidden');
  get('ruler').setAttribute('visibility', event.target.checked ? 'visible' : 'hidden');
};
get('heading').oninput = event => {
  if (!vehicle) return;
  vehicle.heading = Number(event.target.value);
  draw();
};
get('identify').onclick = () => {
  if (!vehicle && !pixelsPerMetre) {
    status.textContent = 'Set the diagram scale before marking the vehicle.';
    return;
  }
  rearPoint = undefined;
  setMode('identify', 'Click the centre of the vehicle’s rear edge.');
};

function markVehicle(point) {
  if (!rearPoint) {
    rearPoint = point;
    status.textContent = 'Click the centre of the vehicle’s front edge.';
    return;
  }
  const name = get('vehicle-name').value.trim();
  const length = Number(get('vehicle-length').value);
  const bodyWidth = Number(get('vehicle-width').value);
  const dx = point.x - rearPoint.x;
  const dy = point.y - rearPoint.y;
  if (!name || !Number.isFinite(length) || length <= 0
      || !Number.isFinite(bodyWidth) || bodyWidth <= 0 || Math.hypot(dx, dy) < 1) {
    status.textContent = 'Enter a vehicle name and positive dimensions, then pick a distinct front point.';
    return;
  }
  const pose = {
    x: (point.x + rearPoint.x) / 2,
    y: (point.y + rearPoint.y) / 2,
    heading: (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360,
    name, length, width: bodyWidth,
  };
  if (vehicle) {
    for (const zone of zones) {
      zone.points = zone.points.map(vertex => localPoint(mapPosition(vertex, vehicle), pose));
    }
  }
  vehicle = pose;
  renderZones();
  setMode('vehicle-move', 'Vehicle marked. Add zones or move the vehicle. Hide the reference to see it on its own.');
}

function moveSelection(point) {
  if (mode === 'vehicle-move' && vehicle) {
    vehicle.x = Math.max(0, Math.min(width, point.x));
    vehicle.y = Math.max(0, Math.min(height, point.y));
    draw();
  } else {
    placeWorker(point);
  }
}
get('finish').onclick = () => {
  const area = draft.reduce((sum, point, i) => {
    const next = draft[(i + 1) % draft.length];
    return sum + point.x * next.y - point.y * next.x;
  }, 0);
  if (Math.abs(area) < 1) {
    status.textContent = 'Trace a zone with at least three corners that enclose an area.';
    return;
  }
  let number = zones.length + 1;
  while (zones.some(zone => zone.name === 'Blind zone ' + number)) number++;
  zones.push({ name: 'Blind zone ' + number, points: draft.map(point => localPoint(point, vehicle)) });
  renderZones();
  setMode('move', 'Zone saved. Add another blind zone or move the worker.');
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
  if (mode === 'move' || mode === 'vehicle-move') {
    dragging = true;
    map.setPointerCapture(event.pointerId);
    moveSelection(point);
  } else if (mode === 'identify') {
    markVehicle(point);
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
    pixelsPerMetre = pixels / distance;
    const gridMetres = Math.max(1, Math.ceil(Math.max(width, height) / pixelsPerMetre / 80));
    const spacing = pixelsPerMetre * gridMetres;
    get('meter-grid').setAttribute('width', spacing);
    get('meter-grid').setAttribute('height', spacing);
    get('grid-line').setAttribute('d', 'M ' + spacing + ' 0 H 0 V ' + spacing);
    get('grid').removeAttribute('display');
    get('ratio').textContent = (width / pixelsPerMetre).toFixed(2) + ' × '
      + (height / pixelsPerMetre).toFixed(2) + ' m diagram · ' + gridMetres + ' m grid squares';
    for (const [key, value] of Object.entries({ x1: scaleStart.x, y1: scaleStart.y, x2: point.x, y2: point.y })) {
      get('ruler').setAttribute(key, value);
    }
    setMode('move', 'Scale saved. Trace the blind zone or move the worker.');
  }
};
map.onpointermove = event => {
  if (!dragging) return;
  const point = mapPoint(event);
  if (point) moveSelection(point);
};
map.onlostpointercapture = () => { dragging = false; };
map.onkeydown = event => {
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (!['move', 'vehicle-move'].includes(mode) || !direction) return;
  event.preventDefault();
  const step = pixelsPerMetre ? pixelsPerMetre * 0.25 : Math.min(width, height) / 50;
  const target = mode === 'vehicle-move' ? vehicle : worker;
  moveSelection({ x: target.x + step * direction[0], y: target.y + step * direction[1] });
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
      get('reference-visible').checked = true;
      get('reference-visible').onchange({ target: get('reference-visible') });
      get('sample').hidden = true;
      get('sample').setAttribute('display', 'none');
      for (const key of ['x1', 'y1', 'x2', 'y2']) get('ruler').removeAttribute(key);
      get('ratio').textContent = 'Scale not set';
      pixelsPerMetre = undefined;
      get('grid').setAttribute('display', 'none');
      zones = [];
      vehicle = undefined;
      worker = { x: width * 0.2, y: height * 0.5 };
      activeEvents.clear();
      get('events').replaceChildren();
      get('empty').hidden = false;
      renderZones();
      setMode('move', 'Diagram loaded. Set its scale and trace a blind zone.');
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
};

renderZones();
draw();
