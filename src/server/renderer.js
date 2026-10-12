import { evaluateAnimation } from './animation.js';
import { clamp, parseColor, toDmxLevel } from './color.js';
import { evaluateEffect, resolveEffect } from './effects.js';

export function createInitialState(config) {
  const startedAt = Date.now();
  return {
    boxModes: Object.fromEntries(config.fixtures.boxes.map(box => [box.id, box.defaultMode ?? 'global'])),
    boxStartedAt: Object.fromEntries(config.fixtures.boxes.map(box => [box.id, startedAt])),
    power: Boolean(config.defaults.powerOnAtStartup),
    mode: config.defaults.startupMode,
    manual: {},
    startedAt
  };
}

export function findMode(config, modeId) {
  return config.modes.find((mode) => mode.id === modeId) ?? config.modes[0];
}

export function evaluateElements(config, state, nowMs = Date.now()) {
  const elementStates = {};

  for (const [elementId, fixture] of Object.entries(config.fixtures.elements)) {
    const boxMode = state.boxModes?.[fixture.box] ?? 'global';
    const followsGlobal = boxMode === 'global';
    const mode = findMode(config, followsGlobal ? state.mode : boxMode);
    const startedAt = followsGlobal ? state.startedAt : state.boxStartedAt[fixture.box];
    const elapsedSeconds = (nowMs - startedAt) / 1000;
    const base = {
      ...config.defaults.defaults,
      enabled: true,
      on: true
    };
    const modeElement = mode?.elements?.[elementId] ?? {};
    const manual = state.manual[elementId] ?? {};
    let evaluated = {
      ...base,
      ...modeElement
    };

    const effect = resolveEffect(modeElement.effect, config.effects);
    const effectState = evaluateEffect(effect, elapsedSeconds, elementId);
    const animationState = effectState ?? evaluateAnimation(modeElement.animation, elapsedSeconds);

    evaluated.on = animationState.on;
    evaluated.level = animationState.level;
    if (effectState?.color && isColorFixture(fixture)) evaluated.color = effectState.color;

    if (manual.brightness !== undefined) {
      evaluated.brightness = clamp(Number(manual.brightness));
    }

    if (manual.color && isColorFixture(fixture)) {
      evaluated.color = manual.color;
    }

    if (manual.forceOn === true) {
      evaluated.on = true;
      evaluated.level = 1;
    }

    if (manual.forceOff === true || manual.forceOn === false) {
      evaluated.on = false;
      evaluated.level = 0;
    }

    elementStates[elementId] = evaluated;
  }

  return elementStates;
}

export function renderDmxFrame(config, elementStates, power = true, universeId) {
  const frame = Array.from({ length: config.universes[universeId].channelCount }, () => 0);

  if (!power) return frame;

  for (const [elementId, fixture] of Object.entries(config.fixtures.elements)) {
    if (fixture.universe !== universeId) continue;
    const state = elementStates[elementId];
    if (!state || state.enabled === false) continue;

    if (fixture.type === 'dimmer') {
      frame[fixture.channels.level - 1] = toDmxLevel(state);
    }

    if (isColorFixture(fixture)) {
      const color = parseColor(state.color);
      const level = clamp(state.brightness) * clamp(state.level ?? 1) * (state.on ? 1 : 0);
      frame[fixture.channels.red - 1] = Math.round(color.red * level);
      frame[fixture.channels.green - 1] = Math.round(color.green * level);
      frame[fixture.channels.blue - 1] = Math.round(color.blue * level);

      const whiteLevel = Math.round(color.white * level);
      if (fixture.channels.coldWhite) frame[fixture.channels.coldWhite - 1] = whiteLevel;
      if (fixture.channels.white) frame[fixture.channels.white - 1] = whiteLevel;
    }
  }

  return frame;
}

function isColorFixture(fixture) {
  return fixture.type === 'rgbw' || fixture.type === 'rgbcw';
}

export function renderSnapshot(config, state, nowMs = Date.now()) {
  const elements = evaluateElements(config, state, nowMs);
  const frames = Object.fromEntries(Object.keys(config.universes).map(id => [
    id, renderDmxFrame(config, elements, state.power, id)
  ]));
  return { elements, frames };
}
