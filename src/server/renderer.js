import { evaluateAnimation } from './animation.js';
import { clamp, parseColor, toDmxLevel } from './color.js';
import { evaluateEffect, resolveEffect } from './effects.js';

export function createInitialState(config) {
  return {
    power: Boolean(config.defaults.powerOnAtStartup),
    mode: config.defaults.startupMode,
    manual: {},
    startedAt: Date.now()
  };
}

export function findMode(config, modeId) {
  return config.modes.find((mode) => mode.id === modeId) ?? config.modes[0];
}

export function evaluateElements(config, state, nowMs = Date.now()) {
  const elapsedSeconds = (nowMs - state.startedAt) / 1000;
  const mode = findMode(config, state.mode);
  const elementStates = {};

  for (const [elementId, fixture] of Object.entries(config.fixtures.elements)) {
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

    if (manual.brightness !== undefined) {
      evaluated.brightness = clamp(Number(manual.brightness));
    }

    if (manual.color && fixture.type === 'rgbw') {
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

export function renderDmxFrame(config, elementStates, power = true) {
  const frame = Array.from({ length: config.fixtures.channelCount }, () => 0);

  if (!power) return frame;

  for (const [elementId, fixture] of Object.entries(config.fixtures.elements)) {
    const state = elementStates[elementId];
    if (!state || state.enabled === false) continue;

    if (fixture.type === 'dimmer') {
      frame[fixture.channels.level - 1] = toDmxLevel(state);
    }

    if (fixture.type === 'rgbw') {
      const color = parseColor(state.color);
      const level = clamp(state.brightness) * clamp(state.level ?? 1) * (state.on ? 1 : 0);
      frame[fixture.channels.red - 1] = Math.round(color.red * level);
      frame[fixture.channels.green - 1] = Math.round(color.green * level);
      frame[fixture.channels.blue - 1] = Math.round(color.blue * level);
      frame[fixture.channels.white - 1] = Math.round(color.white * level);
    }
  }

  return frame;
}

export function renderSnapshot(config, state, nowMs = Date.now()) {
  const elements = evaluateElements(config, state, nowMs);
  const frame = renderDmxFrame(config, elements, state.power);
  return { elements, frame };
}
