import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAnimation } from '../src/server/animation.js';
import { evaluateEffect } from '../src/server/effects.js';
import { loadConfig } from '../src/server/config.js';
import { createInitialState, renderSnapshot } from '../src/server/renderer.js';
import { ControllerState } from '../src/server/state.js';
import { OutputManager } from '../src/server/output.js';

test('animation loops and fades between on and off steps', () => {
  const animation = [
    { on: true, duration: 1, fade: 0 },
    { on: false, duration: 1, fade: 0.5 }
  ];

  assert.deepEqual(evaluateAnimation(animation, 0.25), { on: true, level: 1 });

  const fading = evaluateAnimation(animation, 1.25);
  assert.equal(fading.on, true);
  assert.equal(fading.level, 0.5);

  assert.deepEqual(evaluateAnimation(animation, 1.75), { on: false, level: 0 });
});

test('dimmer and rgbw elements render to configured DMX channels', async () => {
  const config = await loadConfig();
  const state = createInitialState(config);
  state.power = true;
  state.startedAt = 0;

  const snapshot = renderSnapshot(config, state, 1000);

  assert.equal(snapshot.frame.length, 10);
  assert.equal(snapshot.frame[0], 255);
  assert.equal(snapshot.frame[5], 88);
  assert.equal(snapshot.frame[6], 133);
  assert.equal(snapshot.frame[7], 166);
  assert.equal(snapshot.frame[8], 0);
});

test('global power off sends a zeroed safety frame', async () => {
  const config = await loadConfig();
  const state = createInitialState(config);
  state.power = false;

  const snapshot = renderSnapshot(config, state, Date.now());

  assert.deepEqual(snapshot.frame, Array.from({ length: 10 }, () => 0));
});

test('manual brightness preserves animation timing but lowers on value', async () => {
  const config = await loadConfig();
  const state = createInitialState(config);
  state.power = true;
  state.startedAt = 0;
  state.manual['green-lights'] = { brightness: 0.25 };

  const onSnapshot = renderSnapshot(config, state, 1000);
  const offSnapshot = renderSnapshot(config, state, 6000);

  assert.equal(onSnapshot.frame[0], 64);
  assert.equal(offSnapshot.frame[0], 0);
});

test('manual force off overrides an active animation', async () => {
  const config = await loadConfig();
  const state = createInitialState(config);
  state.power = true;
  state.startedAt = 0;
  state.manual['green-lights'] = { forceOff: true };

  const snapshot = renderSnapshot(config, state, 1000);

  assert.equal(snapshot.frame[0], 0);
});

test('mode change clears manual overrides', async () => {
  const config = await loadConfig();
  const controller = new ControllerState(config);
  controller.setManual('edge-lights', { brightness: 0.25 });
  controller.setMode('damage');

  assert.deepEqual(controller.publicState.manual, {});
  assert.equal(controller.publicState.mode, 'damage');
});

test('glitch intensity changes the approximate on ratio', () => {
  const low = sampleGlitchRatio({ type: 'glitch', intensity: 1, speed: 8, cluster: 0.5 }, 'low');
  const high = sampleGlitchRatio({ type: 'glitch', intensity: 9, speed: 8, cluster: 0.5 }, 'high');

  assert.ok(low < 0.35, `expected low intensity to stay mostly off, got ${low}`);
  assert.ok(high > 0.65, `expected high intensity to stay mostly on, got ${high}`);
});

test('output manager can switch between dry-run and remote OLA', async () => {
  const config = await loadConfig();
  const output = new OutputManager(config);

  assert.equal(output.publicState.mode, 'dry-run');

  output.set({ mode: 'ola', olaUrl: 'http://pizero.local:9090' });

  assert.deepEqual(output.publicState, {
    mode: 'ola',
    olaUrl: 'http://pizero.local:9090',
    remoteOlaUrl: 'http://pizero.local:9090'
  });
});

function sampleGlitchRatio(effect, elementId) {
  let onCount = 0;
  const samples = 400;

  for (let index = 0; index < samples; index += 1) {
    const state = evaluateEffect(effect, index / 20, elementId);
    if (state.on) onCount += 1;
  }

  return onCount / samples;
}
