import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/simulator/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../public/simulator/simulator.js', import.meta.url), 'utf8');

test('map and side status render above scenario controls', () => {
  assert.ok(html.indexOf('<svg id="map"') > 0);
  assert.ok(html.indexOf('<svg id="map"') < html.indexOf('<label for="upload">'));
  assert.ok(html.indexOf('aria-label="Playback"') < html.indexOf('<label for="upload">'));
  assert.ok(html.indexOf('<label for="upload">') < html.indexOf('<button id="scale">'));
  assert.ok(html.includes('<aside aria-label="Warnings and event history">'));
  assert.ok(html.includes('<p id="driver"') && html.includes('<p id="walker"'));
});

test('obsolete sidebar scale readout is gone but calibration is still functional', () => {
  assert.ok(!html.includes('id="ratio"'));
  assert.ok(!html.includes('<h2>Map scale</h2>'));
  assert.ok(!script.includes("get('ratio')"));
  assert.ok(html.includes('<button id="scale">Set scale</button>'));
  assert.ok(script.includes("get('scale').onclick"));
  assert.ok(script.includes('pixelsPerMetre = pixels / distance'));
});
