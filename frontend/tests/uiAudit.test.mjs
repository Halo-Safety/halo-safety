import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  'src/App.tsx',
  'src/DemoBusinessOverview.tsx',
  'src/SafetyWorkspace.tsx',
  'src/SafetyRecords.tsx',
  'src/TelemetryPage.tsx',
  'src/FtmAnchorMap.tsx',
  'public/simulator/index.html',
  'public/simulator/simulator.js',
];
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('the walkthrough has no conspicuous example, fictional, or sample badges', () => {
  const forbidden = [
    'SAMPLE CASES', 'SAMPLE ACTIONS', 'SAMPLE FLEET', 'Sample investigations',
    'Edit sample case', 'Cases in sample', 'No sample cases', 'sample period',
    'sample hours', 'Sample workflow only', 'fictional examples',
    'Example alerts', 'Sample diagram loaded', 'Open sample case',
    'Review as sample case', 'Illustrative sample', 'SANDBOX /',
    'TEST DATA', 'TEST DEVICE', 'DEMO CASE', 'marked demo',
  ];
  for (const path of files) {
    const source = read(path);
    for (const label of forbidden) assert.ok(!source.includes(label), path + ': ' + label);
  }
});

test('monitoring cards, sidebar and event history share the same source per account', () => {
  const source = read('src/App.tsx');
  assert.ok(source.includes('isTestAccount ? sampleSensorEvents : events'));
  assert.ok(source.includes('getActiveEvents(displayedEvents)'));
  assert.ok(source.includes('sortedEvents(displayedEvents)'));
  assert.ok(source.includes('recentChart(displayedEvents)'));
  assert.ok(source.includes('displayedEvents.length'));
  assert.ok(!source.includes('getActiveEvents(events)'));
  assert.ok(!source.includes('sample-inline-label'));
});

test('temporary FTM replay is absent from app and map', () => {
  for (const path of ['src/App.tsx','src/FtmAnchorMap.tsx','src/TelemetryPage.tsx']) {
    assert.ok(!read(path).includes('demoFtmReplay'));
    assert.ok(!read(path).includes('enableDemoReplay'));
  }
});
