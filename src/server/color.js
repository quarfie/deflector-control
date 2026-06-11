export function clamp(value, min = 0, max = 1) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampByte(value) {
  return Math.round(clamp(value / 255) * 255);
}

export function parseColor(input = '#FFFFFF') {
  if (typeof input !== 'string') {
    return { red: 255, green: 255, blue: 255, white: 0 };
  }

  const normalized = input.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(normalized)) {
    return { red: 255, green: 255, blue: 255, white: 0 };
  }

  return {
    red: parseInt(normalized.slice(0, 2), 16),
    green: parseInt(normalized.slice(2, 4), 16),
    blue: parseInt(normalized.slice(4, 6), 16),
    white: normalized.length === 8 ? parseInt(normalized.slice(6, 8), 16) : 0
  };
}

export function toDmxLevel({ on, brightness = 1, level = 1 }) {
  return clampByte((on ? 255 : 0) * clamp(brightness) * clamp(level));
}
