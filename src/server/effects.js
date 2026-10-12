import { clamp } from './color.js';

function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomUnit(seed) {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return ((value >>> 0) % 100000) / 100000;
}

export function resolveEffect(effect, effects) {
  if (!effect) return null;
  if (typeof effect === 'string') return effects[effect] ?? null;
  return effect;
}

export function evaluateEffect(effect, elapsedSeconds, elementId) {
  if (!effect) return null;
  if (effect.type === 'spectrum') return evaluateSpectrum(effect, elapsedSeconds);
  if (effect.type === 'pulse') return evaluatePulse(effect, elapsedSeconds);
  if (effect.type === 'glitch') return evaluateGlitch(effect, elapsedSeconds, elementId);
  return null;
}

function evaluatePulse(effect, elapsedSeconds) {
  const period = Math.max(0.1, Number(effect.period ?? 3));
  const min = clamp(Number(effect.min ?? 0.2));
  const max = clamp(Number(effect.max ?? 1));
  const phase = (Math.sin((elapsedSeconds / period + Number(effect.phase ?? 0)) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
  return { on: true, level: min + (max - min) * phase };
}

function evaluateGlitch(effect, elapsedSeconds, elementId) {
  const intensity = clamp(Number(effect.intensity ?? 5), 1, 10);
  const speed = Math.max(0.25, Number(effect.speed ?? 6));
  const cluster = clamp(Number(effect.cluster ?? 0.6));
  const fade = Math.max(0, Number(effect.fade ?? 0));
  const tick = Math.floor(elapsedSeconds * speed);
  const local = elapsedSeconds * speed - tick;
  const seedBase = hashString(`${elementId}:${tick}`);
  const previousSeed = hashString(`${elementId}:${tick - 1}`);
  const previousOn = randomUnit(previousSeed) < intensity / 10;
  const clusteredChance = previousOn ? clamp(intensity / 10 + cluster * 0.3) : clamp(intensity / 10 - cluster * 0.25);
  const isOn = randomUnit(seedBase) < clusteredChance;
  const target = isOn ? 1 : 0;
  const prior = previousOn ? 1 : 0;

  if (fade <= 0 || local > fade * speed || prior === target) {
    return { on: isOn, level: target };
  }

  const progress = clamp(local / (fade * speed));
  const level = prior + (target - prior) * progress;
  return { on: level > 0.001, level };
}

// Hue traverses RGB continuously; phase is measured in fractions of a cycle.
function evaluateSpectrum(effect, elapsedSeconds) {
  const period = Math.max(0.1, Number(effect.period ?? 60));
  const hue = ((elapsedSeconds / period + Number(effect.phase ?? 0)) % 1 + 1) % 1;
  const sector = hue * 6;
  const rising = sector % 1;
  const falling = 1 - rising;
  const rgb = [
    [1, rising, 0], [falling, 1, 0], [0, 1, rising],
    [0, falling, 1], [rising, 0, 1], [1, 0, falling]
  ][Math.floor(sector)];
  const color = '#' + rgb.map(value => Math.round(value * 255).toString(16).padStart(2, '0')).join('');
  return { on: true, level: 1, color };
}
