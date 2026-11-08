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
let reportedWarningActive = false;

function notifyDashboard(active, zone) {
  if (window.parent === window) return;
  window.parent.postMessage({
    source: 'halo-simulator',
    event: active ? 'PROXIMITY_ALERT' : 'ALERT_CLEAR',
    zone: zone || null,
  }, window.location.origin);
}
const clearanceEvent = { name: 'Vehicle clearance zone' };
let clearance = 0.5;
let dragging = false;
let imageRequest = 0;
let referenceLoaded = false;
let hideReferenceAfterTrace = false;
let paths = { worker: [], vehicle: [] };
let run;
let frame;

function eventTime() {
  return run ? run.elapsed.toFixed(2) + ' s' : new Date().toLocaleTimeString();
}

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

function vehicleOutline() {
  if (vehicle.shape) return vehicle.shape;
  const scale = pixelsPerMetre || 20;
  const x = vehicle.width * scale / 2;
  const y = vehicle.length * scale / 2;
  return [{ x: -x, y: -y }, { x, y: -y }, { x, y }, { x: -x, y }];
}

function distanceToOutline(point, outline) {
  if (contains(point, outline)) return 0;
  let nearest = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const squared = dx * dx + dy * dy;
    const t = squared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared)) : 0;
    nearest = Math.min(nearest, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
  }
  return nearest;
}

function updateAlert() {
  const relativeWorker = vehicle && localPoint(worker, vehicle);
  const occupied = relativeWorker ? zones.filter(zone => contains(relativeWorker, zone.points)) : [];
  const inBlindZone = occupied.length > 0;
  const tooClose = relativeWorker
    && distanceToOutline(relativeWorker, vehicleOutline()) <= (clearance + 0.25) * (pixelsPerMetre || 20);
  if (tooClose) occupied.push(clearanceEvent);
  const warnings = [];
  if (inBlindZone) warnings.push('Worker in blind zone.');
  if (tooClose) warnings.push('Worker too close to vehicle.');
  get('driver').textContent = warnings.length ? 'Stop. ' + warnings.join(' ') : 'No active warning';
  get('walker').textContent = warnings.length ? 'Step clear of the vehicle.' : 'No active warning';
  for (const id of ['driver', 'walker']) get(id).classList.toggle('warning', warnings.length > 0);
  const warningActive = warnings.length > 0;
  if (warningActive !== reportedWarningActive) {
    reportedWarningActive = warningActive;
    notifyDashboard(warningActive, occupied[0] && occupied[0].name);
  }
  for (const [zone, item] of activeEvents) {
    if (occupied.includes(zone)) continue;
    item.textContent += ' · exited at ' + eventTime();
    activeEvents.delete(zone);
  }
  for (const zone of occupied) {
    if (activeEvents.has(zone)) continue;
    get('empty').hidden = true;
    const item = document.createElement('li');
    const entered = eventTime();
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
      if (run) return;
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
  get('shape').disabled = !vehicle && !pixelsPerMetre;
  get('vehicle-move').disabled = !vehicle;
  get('vehicle-path').disabled = !vehicle;
  get('heading').disabled = !vehicle;
  if (vehicle) {
    const scale = pixelsPerMetre || 20;
    const halfWidth = vehicle.width * scale / 2;
    const halfLength = vehicle.length * scale / 2;
    get('vehicle-pose').setAttribute('transform',
      'translate(' + vehicle.x + ' ' + vehicle.y + ') rotate(' + vehicle.heading + ')');
    const outline = points(vehicleOutline());
    get('vehicle-body').setAttribute('points', outline);
    get('vehicle-clearance').setAttribute('points', outline);
    get('vehicle-clearance').setAttribute('stroke-width', clearance * scale * 2);
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
  get('worker').setAttribute('r', (pixelsPerMetre || 20) * 0.25);
  get('finish').textContent = mode === 'shape' ? 'Finish outline' : 'Finish zone';
  get('finish').disabled = !isTracing(mode) || draft.length < 3;
  updateAlert();
}

function isTracing(value) {
  return value === 'trace' || value === 'shape';
}

function setMode(next, message) {
  if (isTracing(mode) && !isTracing(next) && hideReferenceAfterTrace) {
    setReferenceVisible(false);
    hideReferenceAfterTrace = false;
  }
  mode = next;
  dragging = false;
  if (!isTracing(next)) draft = [];
  if (next !== 'scale') scaleStart = undefined;
  if (next !== 'identify') rearPoint = undefined;
  for (const id of ['move', 'trace', 'shape', 'scale', 'identify', 'vehicle-move', 'worker-path', 'vehicle-path']) {
    get(id).setAttribute('aria-pressed', id === next);
  }
  status.textContent = message;
  draw();
}

function placeWorker(point) {
  worker = { x: Math.max(0, Math.min(width, point.x)), y: Math.max(0, Math.min(height, point.y)) };
  draw();
}

function renderPaths() {
  for (const role of ['worker', 'vehicle']) {
    const route = role === 'vehicle' ? roundedVehiclePath(paths.vehicle) : paths.worker;
    get(role + '-route').setAttribute('points', points(route));
    get('clear-' + role).disabled = paths[role].length === 0;
  }
}

function headingFor(dx, dy) {
  return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
}

function roundedVehiclePath(path) {
  if (path.length < 3) return path;
  const result = [path[0]];
  const maxTrim = 2 * (pixelsPerMetre || 20);
  for (let i = 1; i < path.length - 1; i++) {
    const before = path[i - 1];
    const corner = path[i];
    const after = path[i + 1];
    const incoming = { x: corner.x - before.x, y: corner.y - before.y };
    const outgoing = { x: after.x - corner.x, y: after.y - corner.y };
    const inLength = Math.hypot(incoming.x, incoming.y);
    const outLength = Math.hypot(outgoing.x, outgoing.y);
    const cosine = (incoming.x * outgoing.x + incoming.y * outgoing.y) / (inLength * outLength);
    if (cosine > 0.999 || cosine < -0.995 || !Number.isFinite(cosine)) {
      result.push(corner);
      continue;
    }
    const trim = Math.min(maxTrim, inLength * 0.4, outLength * 0.4);
    const entry = { x: corner.x - incoming.x * trim / inLength, y: corner.y - incoming.y * trim / inLength };
    const exit = { x: corner.x + outgoing.x * trim / outLength, y: corner.y + outgoing.y * trim / outLength };
    for (let step = 0; step <= 32; step++) {
      const t = step / 32;
      const u = 1 - t;
      result.push({
        x: u * u * entry.x + 2 * u * t * corner.x + t * t * exit.x,
        y: u * u * entry.y + 2 * u * t * corner.y + t * t * exit.y,
        heading: headingFor(
          u * (corner.x - entry.x) + t * (exit.x - corner.x),
          u * (corner.y - entry.y) + t * (exit.y - corner.y),
        ),
      });
    }
  }
  result.push(path.at(-1));
  return result;
}

for (const role of ['worker', 'vehicle']) {
  get(role + '-path').onclick = () => {
    setMode(role + '-path', 'Click successive ' + role + ' waypoints. The first leg starts at the current position.');
  };
  get('clear-' + role).onclick = () => {
    paths[role] = [];
    renderPaths();
    status.textContent = 'Path cleared. Click the map to add new waypoints in path mode.';
  };
}

function addWaypoint(role, point) {
  const path = paths[role];
  const start = role === 'worker' ? worker : vehicle;
  if (!start) return;
  const last = path.at(-1) || start;
  if (Math.hypot(point.x - last.x, point.y - last.y) < 1) return;
  if (path.length === 0) path.push({ x: start.x, y: start.y });
  path.push({ x: point.x, y: point.y });
  renderPaths();
  status.textContent = role[0].toUpperCase() + role.slice(1) + ' path has ' + (path.length - 1)
    + ' waypoint(s). Add more or choose Play.';
}

function makeTrack(path, start, speed) {
  const segments = [];
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
    length += segmentLength;
    segments.push({ from, to, length: segmentLength, end: length });
  }
  return { start: path[0] || start, segments, speed, duration: speed > 0 ? length / speed : 0 };
}

function trackPosition(track, elapsed) {
  if (!track.start || track.speed === 0 || !track.segments.length) return track.start;
  const travelled = Math.min(elapsed, track.duration) * track.speed;
  const segment = track.segments.find(item => travelled < item.end) || track.segments.at(-1);
  const fraction = Math.max(0, Math.min(1, 1 - (segment.end - travelled) / segment.length));
  const dx = segment.to.x - segment.from.x;
  const dy = segment.to.y - segment.from.y;
  const direction = headingFor(dx, dy);
  const fromHeading = segment.from.heading ?? direction;
  const toHeading = segment.to.heading ?? direction;
  const turn = (toHeading - fromHeading + 540) % 360 - 180;
  return {
    x: segment.from.x + dx * fraction,
    y: segment.from.y + dy * fraction,
    heading: (fromHeading + fraction * turn + 360) % 360,
  };
}

function renderPlayback() {
  get('setup').disabled = Boolean(run);
  get('play').disabled = Boolean(run && (run.playing || run.elapsed >= run.duration));
  get('play').textContent = run ? 'Resume' : 'Play';
  get('pause').disabled = !run?.playing;
  get('reset-run').disabled = !run;
  get('clock').textContent = (run?.elapsed || 0).toFixed(1) + ' s';
}

function applyTime() {
  const walker = trackPosition(run.worker, run.elapsed);
  const truck = trackPosition(run.vehicle, run.elapsed);
  worker = { x: walker.x, y: walker.y };
  if (vehicle && truck) Object.assign(vehicle, truck);
  updateAlert();
}

function tick(timestamp) {
  if (!run?.playing) return;
  const delta = run.lastFrame === undefined ? 0 : Math.min(0.25, (timestamp - run.lastFrame) / 1000);
  run.lastFrame = timestamp;
  const target = Math.min(run.duration, run.elapsed + delta);
  while (run.elapsed < target) {
    run.elapsed = Math.min(target, run.elapsed + 0.02);
    applyTime();
  }
  draw();
  if (run.elapsed >= run.duration) {
    run.playing = false;
    status.textContent = 'Run complete. Review the encounters or reset to run again.';
  } else {
    frame = requestAnimationFrame(tick);
  }
  renderPlayback();
}

get('play').onclick = () => {
  if (!run) {
    if (!pixelsPerMetre && !vehicle) {
      status.textContent = 'Set the diagram scale before running a path.';
      return;
    }
    const speeds = ['worker', 'vehicle'].map(role => {
      const value = get(role + '-speed').value;
      return value.trim() === '' ? NaN : Number(value);
    });
    if (!speeds.every(speed => Number.isFinite(speed) && speed >= 0 && speed <= 30)) {
      status.textContent = 'Enter a speed from 0 to 30 m/s for each participant.';
      return;
    }
    const scale = pixelsPerMetre || 20;
    const workerTrack = makeTrack(paths.worker, { ...worker }, speeds[0] * scale);
    const vehicleTrack = makeTrack(roundedVehiclePath(paths.vehicle), vehicle && { ...vehicle }, speeds[1] * scale);
    const duration = Math.max(workerTrack.duration, vehicleTrack.duration);
    if (!duration) {
      status.textContent = 'Add a path and set a positive speed for at least one participant.';
      return;
    }
    run = { worker: workerTrack, vehicle: vehicleTrack, duration, elapsed: 0,
      startWorker: { ...worker }, startVehicle: vehicle && { ...vehicle } };
    activeEvents.clear();
    get('events').replaceChildren();
    get('empty').hidden = false;
    applyTime();
  }
  run.playing = true;
  run.lastFrame = undefined;
  dragging = false;
  status.textContent = 'Running the scenario. Alerts and crossings update as both participants move.';
  renderPlayback();
  frame = requestAnimationFrame(tick);
};

get('pause').onclick = () => {
  run.playing = false;
  cancelAnimationFrame(frame);
  status.textContent = 'Paused. Resume to continue or reset to edit the scenario.';
  renderPlayback();
};

get('reset-run').onclick = () => {
  cancelAnimationFrame(frame);
  worker = run.startWorker;
  vehicle = run.startVehicle;
  run = undefined;
  activeEvents.clear();
  get('events').replaceChildren();
  get('empty').hidden = false;
  setMode('move', 'Run reset. Your paths are ready to edit or play again.');
  renderPlayback();
};

get('scale').onclick = () => {
  distance = Number(get('meters').value);
  if (!Number.isFinite(distance) || distance <= 0) {
    status.textContent = 'Enter a positive reference length in metres.';
    return;
  }
  scaleStart = undefined;
  setMode('scale', 'Click the first end of the known reference length.');
};
function startTrace(next, message) {
  draft = [];
  if (referenceLoaded && !get('reference-visible').checked) {
    hideReferenceAfterTrace = true;
    setReferenceVisible(true);
  }
  setMode(next, message);
}
get('trace').onclick = () => startTrace('trace', 'Click around the blind zone, then choose Finish zone.');
get('shape').onclick = () => startTrace('shape', 'Click around the vehicle’s outer edge, then choose Finish outline.');
get('clearance').onchange = event => {
  const raw = event.target.value.trim();
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value < 0) {
    event.target.value = clearance;
    status.textContent = 'Enter a clearance of zero or more metres.';
    return;
  }
  clearance = value;
  draw();
};
get('move').onclick = () => setMode('move', 'Tap or drag on the map to move the worker.');
get('vehicle-move').onclick = () => setMode('vehicle-move', 'Tap or drag to move the vehicle and its blind zones.');
function setReferenceVisible(visible) {
  get('reference-visible').checked = visible;
  map.setAttribute('data-reference', visible);
  get('diagram').setAttribute('visibility', visible ? 'visible' : 'hidden');
  get('ruler').setAttribute('visibility', !referenceLoaded || visible ? 'visible' : 'hidden');
}
get('reference-visible').onchange = event => {
  hideReferenceAfterTrace = false;
  setReferenceVisible(event.target.checked);
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
  if (referenceLoaded) setReferenceVisible(true);
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
    if (vehicle.shape) {
      pose.shape = vehicle.shape.map(vertex => localPoint(mapPosition(vertex, vehicle), pose));
    }
    for (const zone of zones) {
      zone.points = zone.points.map(vertex => localPoint(mapPosition(vertex, vehicle), pose));
    }
  }
  vehicle = pose;
  renderZones();
  if (referenceLoaded) setReferenceVisible(false);
  setMode('vehicle-move', 'Vehicle marked. Add blind zones, or move the vehicle on the clean map.');
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
    status.textContent = 'Trace at least three corners in order around an enclosed area.';
    return;
  }
  if (mode === 'shape') {
    const xs = draft.map(point => point.x);
    const ys = draft.map(point => point.y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const scale = pixelsPerMetre || 20;
    vehicle ??= {
      x: (left + right) / 2, y: (top + bottom) / 2, heading: 0,
    };
    vehicle.name = get('vehicle-name').value.trim() || 'Vehicle';
    vehicle.shape = draft.map(point => localPoint(point, vehicle));
    const localXs = vehicle.shape.map(point => point.x);
    const localYs = vehicle.shape.map(point => point.y);
    vehicle.width = (Math.max(...localXs) - Math.min(...localXs)) / scale;
    vehicle.length = (Math.max(...localYs) - Math.min(...localYs)) / scale;
    get('vehicle-width').value = vehicle.width.toFixed(2);
    get('vehicle-length').value = vehicle.length.toFixed(2);
    if (referenceLoaded) setReferenceVisible(false);
    setMode('move', 'Custom vehicle shape saved. Add blind zones or mark front and rear to set its heading.');
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
  if (run) return;
  const point = mapPoint(event);
  if (!point) return;
  if (mode === 'move' || mode === 'vehicle-move') {
    dragging = true;
    map.setPointerCapture(event.pointerId);
    moveSelection(point);
  } else if (mode === 'worker-path' || mode === 'vehicle-path') {
    addWaypoint(mode === 'worker-path' ? 'worker' : 'vehicle', point);
  } else if (mode === 'identify') {
    markVehicle(point);
  } else if (isTracing(mode)) {
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
    renderPaths();
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
  if (run) return;
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
      referenceLoaded = true;
      hideReferenceAfterTrace = false;
      get('reference-visible').disabled = false;
      setReferenceVisible(true);
      get('sample').hidden = true;
      get('sample').setAttribute('display', 'none');
      for (const key of ['x1', 'y1', 'x2', 'y2']) get('ruler').removeAttribute(key);
      get('ratio').textContent = 'Scale not set';
      pixelsPerMetre = undefined;
      get('grid').setAttribute('display', 'none');
      zones = [];
      paths = { worker: [], vehicle: [] };
      renderPaths();
      vehicle = undefined;
      worker = { x: width * 0.2, y: height * 0.5 };
      activeEvents.clear();
      get('events').replaceChildren();
      get('empty').hidden = false;
      renderZones();
      setMode('move', 'Diagram loaded. Set its scale, then trace the vehicle shape.');
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
};

renderZones();
renderPaths();
draw();
