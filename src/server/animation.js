import { clamp } from './color.js';

export function evaluateAnimation(animation, elapsedSeconds) {
  if (!Array.isArray(animation) || animation.length === 0) {
    return { on: true, level: 1 };
  }

  const steps = animation.filter((step) => Number(step.duration) > 0);
  if (steps.length === 0) {
    return { on: true, level: 1 };
  }

  const totalDuration = steps.reduce((sum, step) => sum + Number(step.duration), 0);
  let cursor = ((elapsedSeconds % totalDuration) + totalDuration) % totalDuration;
  let index = 0;

  for (; index < steps.length; index += 1) {
    if (cursor < steps[index].duration) break;
    cursor -= steps[index].duration;
  }

  const current = steps[index] ?? steps[0];
  const previous = steps[(index - 1 + steps.length) % steps.length];
  const fade = Math.max(0, Number(current.fade ?? 0));
  const target = current.on === false ? 0 : 1;
  const prior = previous.on === false ? 0 : 1;

  if (fade <= 0 || cursor >= fade || prior === target) {
    return { on: target > 0, level: target };
  }

  const progress = clamp(cursor / fade);
  const level = prior + (target - prior) * progress;
  return { on: level > 0.001, level };
}
