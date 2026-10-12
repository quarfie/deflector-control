import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAnimation } from '../src/server/animation.js';
import { evaluateEffect } from '../src/server/effects.js';
import { loadConfig, validateConfig } from '../src/server/config.js';
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

test('dimmer, rgbw, and rgbcw elements render to configured DMX channels', async () => {
  const config = await loadConfig();
  const state = createInitialState(config);
  state.power = true;
  state.startedAt = 0;

  const snapshot = renderSnapshot(config, state, 1000);

  assert.equal(snapshot.frames['tech-boxes'].length, 512);
  assert.equal(snapshot.frames['tech-boxes'][0], 255);
  assert.equal(snapshot.frames['tech-boxes'][5], 88);
  assert.equal(snapshot.frames['tech-boxes'][6], 133);
  assert.equal(snapshot.frames['tech-boxes'][7], 166);
  assert.equal(snapshot.frames['tech-boxes'][8], 0);
  assert.equal(snapshot.frames['tech-boxes'][10], 88);
  assert.equal(snapshot.frames['tech-boxes'][11], 133);
  assert.equal(snapshot.frames['tech-boxes'][12], 166);
  assert.equal(snapshot.frames['tech-boxes'][13], 0);
  assert.equal(snapshot.frames['tech-boxes'][14], 191);
  assert.equal(snapshot.frames['tech-boxes'][20], 0);
  assert.equal(snapshot.frames['tech-boxes'][21], 0);
  assert.equal(snapshot.frames['tech-boxes'][22], 0);
  assert.equal(snapshot.frames['tech-boxes'][23], 166);
  assert.equal(snapshot.frames['tech-boxes'][24], 166);
});

test('rgbcw strip accepts manual color overrides', async () => {
  const config = await loadConfig();
  const state = createInitialState(config);
  state.power = true;
  state.startedAt = 0;
  state.manual['emerg-stbd-thruster-lower-strip'] = { color: '#FF2200' };

  const snapshot = renderSnapshot(config, state, 1000);

  assert.equal(snapshot.frames['tech-boxes'][20], 166);
  assert.equal(snapshot.frames['tech-boxes'][21], 22);
  assert.equal(snapshot.frames['tech-boxes'][22], 0);
  assert.equal(snapshot.frames['tech-boxes'][23], 0);
  assert.equal(snapshot.frames['tech-boxes'][24], 0);
});

test('global power off sends a zeroed safety frame', async () => {
  const config = await loadConfig();
  const state = createInitialState(config);
  state.power = false;

  const snapshot = renderSnapshot(config, state, Date.now());

  assert.deepEqual(snapshot.frames['tech-boxes'], Array.from({ length: 512 }, () => 0));
});

test('sign zones occupy distinct RGBW channels 1–24 and render white in Normal mode', async () => {
  const config = await loadConfig();
  const state = createInitialState(config);
  state.power = true;
  const snapshot = renderSnapshot(config, state, state.startedAt + 1000);
  const assigned = Object.values(config.fixtures.elements).flatMap(fixture => Object.values(fixture.channels).map(channel => `${fixture.universe}/${channel}`));
  assert.equal(new Set(assigned).size, assigned.length);
  assert.equal(snapshot.frames['tech-boxes'][9], 0, 'Unassigned tech-box channel 10 stays dark');
  for (let zone = 1; zone <= 6; zone += 1) {
    const start = (zone - 1) * 4;
    const fixture = config.fixtures.elements[`sign-zone-${zone}`];
    assert.equal(fixture.type, 'rgbw');
    assert.equal(fixture.box, 'light-up-sign');
    assert.deepEqual(fixture.channels, { red: start + 1, green: start + 2, blue: start + 3, white: start + 4 });
    assert.deepEqual(snapshot.frames.sign.slice(start, start + 4), [0, 0, 0, 191]);
  }
});

test('sign leaves all channels above 24 dark', async () => {
  const config = await loadConfig();
  const controller = new ControllerState(config);
  controller.setPower(true);
  for (const mode of config.modes) {
    controller.setBoxMode('light-up-sign', mode.id);
    assert.ok(controller.render().frames.sign.slice(24).every(value => value === 0));
  }
});

test('each sign zone independently supports white, brightness, force on/off, and animation', async () => {
  const config = await loadConfig();
  for (let zone = 1; zone <= 6; zone += 1) {
    const state = createInitialState(config);
    state.power = true;
    state.startedAt = 0;
    state.mode = 'red-alert';
    const id = `sign-zone-${zone}`;
    const start = (zone - 1) * 4;
    state.manual[id] = { color: '#804020FF', brightness: 0.5 };
    const onTime = (zone - 1) * 200 + 100;
    const offTime = onTime + 200;
    const on = renderSnapshot(config, state, onTime).frames.sign;
    const off = renderSnapshot(config, state, offTime).frames.sign;
    assert.deepEqual(on.slice(start, start + 4), [64, 32, 16, 128]);
    assert.deepEqual(off.slice(start, start + 4), [0, 0, 0, 0]);
    for (let other = 1; other <= 6; other += 1) {
      if (other === zone) continue;
      const otherStart = (other - 1) * 4;
      assert.deepEqual(on.slice(otherStart, otherStart + 4), [0, 0, 0, 0]);
    }
    state.manual[id].forceOn = true;
    assert.deepEqual(renderSnapshot(config, state, offTime).frames.sign.slice(start, start + 4), [64, 32, 16, 128]);
    state.manual[id].forceOff = true;
    assert.deepEqual(renderSnapshot(config, state, onTime).frames.sign.slice(start, start + 4), [0, 0, 0, 0]);
    state.power = false;
    assert.ok(renderSnapshot(config, state, onTime).frames.sign.every(value => value === 0));
  }
});

test('every mode includes all sign zones and state changes clear their overrides', async () => {
  const config = await loadConfig();
  for (const mode of config.modes) {
    for (let zone = 1; zone <= 6; zone += 1) assert.ok(mode.elements[`sign-zone-${zone}`]);
  }
  const controller = new ControllerState(config);
  controller.setManual('sign-zone-6', { color: '#000000FF' });
  controller.setMode('damage');
  assert.deepEqual(controller.publicState.manual, {});
  controller.setManual('sign-zone-1', { forceOn: true });
  controller.setPower(false);
  assert.deepEqual(controller.publicState.manual, {});
  controller.render();
  assert.ok(Object.values(controller.publicState.frames).every(frame => frame.every(value => value === 0)));
});

test('manual brightness preserves animation timing but lowers on value', async () => {
  const config = await loadConfig();
  const state = createInitialState(config);
  state.power = true;
  state.startedAt = 0;
  state.manual['green-lights'] = { brightness: 0.25 };

  const onSnapshot = renderSnapshot(config, state, 1000);
  const offSnapshot = renderSnapshot(config, state, 6000);

  assert.equal(onSnapshot.frames['tech-boxes'][0], 64);
  assert.equal(offSnapshot.frames['tech-boxes'][0], 0);
});

test('manual force off overrides an active animation', async () => {
  const config = await loadConfig();
  const state = createInitialState(config);
  state.power = true;
  state.startedAt = 0;
  state.manual['green-lights'] = { forceOff: true };

  const snapshot = renderSnapshot(config, state, 1000);

  assert.equal(snapshot.frames['tech-boxes'][0], 0);
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

test('output switches between dry-run and live and routes each universe to its configured host', async (t) => {
  const config = await loadConfig();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, universe: options.body.get('u'), data: options.body.get('d') });
    return { ok: true };
  });
  const output = new OutputManager(config);
  output.dryRun.send = async () => {};
  const controller = new ControllerState(config);
  controller.setPower(true);
  const { frames } = controller.render();
  assert.equal(output.publicState.mode, 'dry-run');
  await output.send(frames);
  assert.equal(calls.length, 0);
  output.set({ mode: 'live' });
  await output.send(frames);
  assert.deepEqual(calls, [
    { url: 'http://pizero.local:9090/set_dmx', universe: '1', data: frames['tech-boxes'].join(',') },
    { url: 'http://pifive.local:9090/set_dmx', universe: '1', data: frames.sign.join(',') }
  ]);
  output.set({ mode: 'dry-run' });
  await output.send(frames);
  assert.equal(calls.length, 2);
  assert.throws(() => output.set({ mode: 'ola' }), /Unknown output mode/);
  assert.throws(() => output.set({ mode: 'live', olaUrl: 'http://other' }), /Configure destinations/);
  assert.equal(output.publicState.mode, 'dry-run');
});

test('universes isolate overlapping addresses and allow mixed universes per physical box', async () => {
  const config = await loadConfig();
  // Free sign channel 1 to test moving an element across universes.
  config.fixtures.elements['sign-zone-1'].channels = { red: 26, green: 27, blue: 28, white: 29 };
  // Move a tech-box element to the sign universe at an address used on tech-boxes.
  config.fixtures.elements['orange-lights'].universe = 'sign';
  config.fixtures.elements['orange-lights'].channels.level = 1;
  validateConfig(config);
  const controller = new ControllerState(config);
  controller.setPower(true);
  controller.setManual('green-lights', { forceOn: true, brightness: 0.25 });
  controller.setManual('orange-lights', { forceOn: true, brightness: 0.5 });
  let { frames } = controller.render();
  assert.equal(frames['tech-boxes'][0], 64);
  assert.equal(frames.sign[0], 128);
  assert.equal(frames['tech-boxes'][1], 0);
  assert.ok(frames['tech-boxes'].slice(25).every(value => value === 0));
  assert.ok(frames.sign.slice(29).every(value => value === 0));
  controller.setPower(false);
  ({ frames } = controller.render());
  for (const frame of Object.values(frames)) assert.deepEqual(frame, Array(512).fill(0));
});

test('configuration rejects unknown types, missing universes, invalid and duplicate addresses', async () => {
  const original = await loadConfig();
  for (const mutate of [
    c => { c.universes.sign.type = 'wled'; },
    c => { c.fixtures.elements['sign-zone-1'].universe = 'missing'; },
    c => { c.fixtures.elements['sign-zone-1'].channels.red = 513; },
    c => { c.fixtures.elements['sign-zone-1'].channels.red = 0; },
    c => { c.fixtures.elements['sign-zone-1'].channels.red = 5; },
    c => { c.universes.sign.olaUrl = c.universes['tech-boxes'].olaUrl; },
    c => { c.universes.sign.universe = -1; },
    c => { c.universes.sign.channelCount = 513; }
  ]) {
    const config = structuredClone(original);
    mutate(config);
    assert.throws(() => validateConfig(config));
  }
});

test('a failed universe does not stop another universe', async (t) => {
  const config = await loadConfig();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url);
    return { ok: url.includes('pifive'), status: 503 };
  });
  const output = new OutputManager(config);
  output.set({ mode: 'live' });
  await assert.rejects(output.send(new ControllerState(config).render().frames), /tech-boxes: OLA returned 503/);
  assert.equal(calls.length, 2);
});

test('a slow universe skips overlapping sends while the healthy universe continues', async (t) => {
  const config = await loadConfig();
  let release;
  let healthyCalls = 0;
  let slowCalls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('pizero')) {
      slowCalls++;
      await new Promise(resolve => { release = resolve; });
    } else healthyCalls++;
    return { ok: true };
  });
  const output = new OutputManager(config);
  output.set({ mode: 'live' });
  const frames = new ControllerState(config).render().frames;
  const pending = output.send(frames);
  await new Promise(resolve => setImmediate(resolve));
  await output.send(frames);
  assert.equal(slowCalls, 1);
  assert.equal(healthyCalls, 2);
  release();
  await pending;
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

test('unit startup modes default to global and can select a configured unit mode', async () => {
  const config = await loadConfig();
  let controller = new ControllerState(config);
  assert.ok(Object.values(controller.publicState.boxModes).every(mode => mode === 'global'));
  config.fixtures.boxes.find(box => box.id === 'light-up-sign').defaultMode = 'sign-breath';
  validateConfig(config);
  controller = new ControllerState(config);
  assert.equal(controller.publicState.boxModes['light-up-sign'], 'sign-breath');
  assert.equal(controller.publicState.power, false);
  assert.ok(Object.values(controller.render().frames).every(frame => frame.every(value => value === 0)));
});

test('global changes preserve independent unit modes, timing, and manual overrides', async (t) => {
  const config = await loadConfig();
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const controller = new ControllerState(config);
  controller.setPower(true);
  controller.setBoxMode('light-up-sign', 'sign-breath');
  controller.setManual('sign-zone-1', { brightness: 0.5, color: '#FF0000' });
  controller.setManual('green-lights', { brightness: 0.25 });
  now = 4000;
  const before = controller.render(now);
  controller.setMode('red-alert');
  const after = controller.render(now);
  assert.deepEqual(after.frames.sign, before.frames.sign);
  assert.deepEqual(controller.publicState.manual['sign-zone-1'], { brightness: 0.5, color: '#FF0000' });
  assert.equal(controller.publicState.manual['green-lights'], undefined);
  assert.equal(after.elements['edge-lights'].color, '#FF2200');
  assert.equal(controller.state.boxStartedAt['light-up-sign'], 1000);
  controller.setPower(false);
  assert.equal(controller.publicState.boxModes['light-up-sign'], 'sign-breath');
  assert.deepEqual(controller.publicState.manual, {});
  assert.ok(Object.values(controller.render().frames).every(frame => frame.every(value => value === 0)));
});

test('unit changes clear only that unit overrides and adopting global rejoins its timing', async (t) => {
  const config = await loadConfig();
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  const controller = new ControllerState(config);
  controller.setPower(true);
  controller.setMode('red-alert');
  controller.setManual('green-lights', { forceOn: true });
  controller.setManual('sign-zone-1', { forceOff: true });
  now = 200;
  controller.setBoxMode('light-up-sign', 'normal');
  assert.deepEqual(controller.publicState.manual, { 'green-lights': { forceOn: true } });
  assert.equal(controller.render().elements['sign-zone-1'].color, '#000000FF');
  now = 700;
  controller.setBoxMode('light-up-sign', 'global');
  const snapshot = controller.render();
  assert.equal(snapshot.elements['sign-zone-1'].color, '#FF2200');
  assert.deepEqual(snapshot.frames.sign.slice(0, 4), Array(4).fill(0));
  assert.deepEqual(snapshot.frames.sign.slice(12, 16), [230, 31, 0, 0]);
  assert.equal(snapshot.elements['sign-zone-1'].level, snapshot.elements['edge-lights'].level);
});

test('mode selection and configuration enforce global and unit scope', async () => {
  const config = await loadConfig();
  const controller = new ControllerState(config);
  for (const change of [
    () => controller.setMode('sign-wave'),
    () => controller.setBoxMode('tech-box-1', 'sign-wave'),
    () => controller.setBoxMode('missing', 'normal'),
    () => controller.setBoxMode('light-up-sign', 'missing')
  ]) assert.throws(change);
  assert.equal(controller.publicState.mode, 'normal');
  assert.ok(Object.values(controller.publicState.boxModes).every(mode => mode === 'global'));
  for (const mutate of [
    c => { c.defaults.startupMode = 'sign-wave'; },
    c => { c.fixtures.boxes[0].defaultMode = 'sign-wave'; },
    c => { c.modes.at(-1).boxes = ['missing']; },
    c => { c.modes.at(-1).elements['green-lights'] = {}; },
    c => { c.modes.at(-1).id = 'normal'; }
  ]) {
    const copy = structuredClone(config);
    mutate(copy);
    assert.throws(() => validateConfig(copy));
  }
});

test('client exposes sign-only modes only on the sign', async () => {
  const { getClientConfig } = await import('../src/server/config.js');
  const client = getClientConfig(await loadConfig());
  assert.deepEqual(client.modes.map(mode => mode.id), ['normal', 'red-alert', 'damage']);
  assert.equal(client.boxes.find(box => box.id === 'light-up-sign').modes.length, 9);
  assert.ok(client.boxes.filter(box => box.id !== 'light-up-sign').every(box => box.modes.length === 3));
});

test('sign animation modes remain subtle, retain colors, and honor manual controls', async () => {
  const config = await loadConfig();
  const normal = config.modes.find(mode => mode.id === 'normal');
  for (const modeId of ['sign-breath', 'sign-wave', 'sign-shimmer']) {
    const controller = new ControllerState(config);
    controller.setPower(true);
    controller.setBoxMode('light-up-sign', modeId);
    const start = controller.state.boxStartedAt['light-up-sign'];
    const levels = [];
    for (let second = 0; second < 32; second += 0.25) {
      const { elements } = controller.render(start + second * 1000);
      levels.push(elements['sign-zone-1'].level);
      for (let zone = 1; zone <= 6; zone++) {
        const id = `sign-zone-${zone}`;
        assert.equal(elements[id].color, normal.elements[id].color);
        assert.ok(elements[id].on && elements[id].level >= 0.2 && elements[id].level <= 1);
      }
    }
    assert.ok(Math.max(...levels) - Math.min(...levels) > 0.55);
    assert.ok(levels.slice(1).every((value, i) => Math.abs(value - levels[i]) < 0.08));
    const before = controller.render(start + 3000).elements['sign-zone-1'];
    controller.setManual('sign-zone-1', { brightness: 0.25, color: '#123456' });
    const after = controller.render(start + 3000).elements['sign-zone-1'];
    assert.equal(after.level, before.level);
    assert.equal(after.brightness, 0.25);
    assert.equal(after.color, '#123456');
    controller.setManual('sign-zone-1', { forceOn: true });
    assert.equal(controller.render(start).elements['sign-zone-1'].level, 1);
    controller.setManual('sign-zone-1', { forceOff: true });
    assert.deepEqual(controller.render(start).frames.sign.slice(0, 4), [0, 0, 0, 0]);
  }
});

test('pulse phase offsets are periodic and keep existing pulse behavior by default', () => {
  const effect = { type: 'pulse', period: 12, min: 0.7, max: 1 };
  assert.equal(evaluateEffect(effect, 0, 'zone').level, 0.7);
  assert.equal(evaluateEffect(effect, 6, 'zone').level, 1);
  assert.equal(evaluateEffect({ ...effect, phase: 0.5 }, 0, 'zone').level, 1);
  assert.equal(evaluateEffect({ ...effect, phase: 0.5 }, 12, 'zone').level, 1);
});

test('spectrum traverses the full color wheel, loops smoothly, and offsets zones', () => {
  const effect = { type: 'spectrum', period: 60 };
  const colors = ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'];
  for (let i = 0; i < colors.length; i++) assert.equal(evaluateEffect(effect, i * 10).color, colors[i]);
  assert.deepEqual(evaluateEffect(effect, 0), evaluateEffect(effect, 60));
  assert.equal(evaluateEffect({ ...effect, phase: 1 / 6 }, 0).color, '#ffff00');
  assert.equal(evaluateEffect(effect, -10).color, '#ff00ff');
  assert.equal(evaluateEffect(effect, 59.999).color, '#ff0000');
});

test('sign spectrum renders independent colors and respects manual overrides and power', async () => {
  const config = await loadConfig();
  const controller = new ControllerState(config);
  controller.setPower(true);
  controller.setBoxMode('light-up-sign', 'sign-spectrum');
  const start = controller.state.boxStartedAt['light-up-sign'];
  const first = controller.render(start);
  assert.equal(new Set(Array.from({ length: 6 }, (_, i) => first.elements[`sign-zone-${i + 1}`].color)).size, 6);
  assert.deepEqual(first.frames.sign.slice(0, 4), [191, 0, 0, 0]);
  assert.notDeepEqual(controller.render(start + 15000).frames.sign, first.frames.sign);
  assert.deepEqual(controller.render(start + 60000).frames.sign, first.frames.sign);
  controller.setManual('sign-zone-1', { brightness: 0.5 });
  assert.deepEqual(controller.render(start + 20000).frames.sign.slice(0, 4), [0, 128, 0, 0]);
  controller.setManual('sign-zone-1', { color: '#000000FF' });
  assert.deepEqual(controller.render(start + 30000).frames.sign.slice(0, 4), [0, 0, 0, 128]);
  controller.clearManual('sign-zone-1');
  assert.deepEqual(controller.render(start + 30000).frames.sign.slice(0, 4), [0, 191, 191, 0]);
  controller.setManual('sign-zone-1', { forceOff: true });
  assert.deepEqual(controller.render(start).frames.sign.slice(0, 4), [0, 0, 0, 0]);
  controller.setPower(false);
  assert.ok(Object.values(controller.render(start).frames).every(frame => frame.every(value => value === 0)));
  assert.throws(() => controller.setMode('sign-spectrum'));
  assert.throws(() => controller.setBoxMode('tech-box-1', 'sign-spectrum'));
});


test('Red Alert chases sign zones 1 through 6 and repeats without changing tech boxes', async () => {
  const config = await loadConfig();
  const state = createInitialState(config);
  state.power = true;
  state.mode = 'red-alert';
  state.startedAt = 0;
  for (let step = 0; step < 12; step++) {
    const { frames } = renderSnapshot(config, state, step * 200 + 100);
    for (let zone = 0; zone < 6; zone++) {
      assert.deepEqual(frames.sign.slice(zone * 4, 4 + zone * 4),
        zone === step % 6 ? [230, 31, 0, 0] : [0, 0, 0, 0]);
    }
  }
  assert.deepEqual(renderSnapshot(config, state, 200).frames['tech-boxes'].slice(5, 9), [230, 31, 0, 0]);
  assert.deepEqual(renderSnapshot(config, state, 700).frames['tech-boxes'].slice(5, 9), [0, 0, 0, 0]);
});

test('white channel overrides save in Auto, On, and Off states and preserve RGB', async () => {
  const config = await loadConfig();
  for (const force of [{}, { forceOn: true, forceOff: false }, { forceOn: false, forceOff: true }]) {
    const controller = new ControllerState(config);
    controller.setPower(true);
    controller.setManual('sign-zone-1', force);
    controller.setManual('sign-zone-1', { color: '#12345640' });
    const snapshot = controller.render();
    assert.equal(controller.publicState.manual['sign-zone-1'].color, '#12345640');
    assert.deepEqual(snapshot.frames.sign.slice(0, 4), force.forceOff ? [0, 0, 0, 0] : [14, 39, 65, 48]);
  }
});


test('Red Alert B builds 6 to 1, then clears 6 to 1, over repeated cycles', async () => {
  const config = await loadConfig();
  const controller = new ControllerState(config);
  controller.setPower(true);
  controller.setBoxMode('light-up-sign', 'red-alert-b');
  const start = controller.state.boxStartedAt['light-up-sign'];
  const expected = [[6], [5,6], [4,5,6], [3,4,5,6], [2,3,4,5,6], [1,2,3,4,5,6],
    [1,2,3,4,5], [1,2,3,4], [1,2,3], [1,2], [1], []];
  for (let step = 0; step < 24; step++) {
    const { frames } = controller.render(start + step * 200 + 100);
    for (let zone = 1; zone <= 6; zone++) {
      assert.deepEqual(frames.sign.slice((zone-1)*4, 4 + (zone-1)*4),
        expected[step % 12].includes(zone) ? [230,31,0,0] : [0,0,0,0]);
    }
  }
});

test('Red Alert C keeps outer alternation while the inner chase bounces at twice the step rate', async () => {
  const config = await loadConfig();
  const controller = new ControllerState(config);
  controller.setPower(true);
  controller.setBoxMode('light-up-sign', 'red-alert-c');
  const start = controller.state.boxStartedAt['light-up-sign'];
  const innerSequence = [3,4,5,6,5,4];
  for (let step = 0; step < 24; step++) {
    const expected = [Math.floor(step / 2) % 2 + 1, innerSequence[step % 6]];
    const { frames } = controller.render(start + step * 200 + 100);
    for (let zone = 1; zone <= 6; zone++) {
      assert.deepEqual(frames.sign.slice((zone-1)*4, 4 + (zone-1)*4),
        expected.includes(zone) ? [230,31,0,0] : [0,0,0,0]);
    }
  }
  for (const mode of ['red-alert-b', 'red-alert-c']) {
    assert.throws(() => controller.setMode(mode));
    assert.throws(() => controller.setBoxMode('tech-box-1', mode));
    controller.setBoxMode('light-up-sign', mode);
    controller.setPower(false);
    assert.ok(Object.values(controller.render().frames).every(frame => frame.every(value => value === 0)));
  }
});
