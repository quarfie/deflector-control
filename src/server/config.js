import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function readJson(relativePath) {
  const content = await readFile(path.join(rootDir, relativePath), 'utf8');
  return JSON.parse(content);
}

export async function loadConfig() {
  const [fixtures, defaults, effects, modes, universes] = await Promise.all([
    readJson('config/fixtures.json'),
    readJson('config/defaults.json'),
    readJson('config/effects.json'),
    readJson('config/modes.json'),
    readJson('config/universes.json')
  ]);

  const config = {
    universes,
    fixtures,
    defaults,
    effects,
    modes: modes.modes
  };
  validateConfig(config);
  return config;
}

export function getClientConfig(config) {
  return {
    universes: config.universes,
    boxes: (config.fixtures.boxes ?? []).map(box => ({
      ...box,
      modes: modesForBox(config, box.id).map(({ id, label, description }) => ({ id, label, description }))
    })),
    elements: config.fixtures.elements,
    modes: globalModes(config).map(({ id, label }) => ({ id, label })),
    frameRate: config.defaults.frameRate,
    output: config.defaults.output
  };
}

// Fail at startup rather than silently routing fixtures to the wrong hardware.
export function validateConfig(config) {
  if (!config.universes || !Object.keys(config.universes).length) throw new Error('Configure at least one universe');
  const destinations = new Set();
  for (const [id, universe] of Object.entries(config.universes)) {
    if (universe.type !== 'ola') throw new Error(`Unsupported universe type for ${id}: ${universe.type}`);
    const url = new URL(universe.olaUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Invalid OLA URL for ${id}`);
    if (!Number.isInteger(universe.universe) || universe.universe < 0) throw new Error(`Invalid OLA universe for ${id}`);
    if (!Number.isInteger(universe.channelCount) || universe.channelCount < 1 || universe.channelCount > 512) throw new Error(`Invalid channel count for ${id}`);
    const destination = `${url.href.replace(/\/$/, '')}/${universe.universe}`;
    if (destinations.has(destination)) throw new Error(`Duplicate OLA destination: ${id}`);
    destinations.add(destination);
  }
  const boxes = config.fixtures.boxes ?? [];
  const boxIds = new Set(boxes.map(box => box.id));
  if (boxIds.size !== boxes.length) throw new Error('Duplicate unit ID');
  const modeIds = new Set();
  for (const mode of config.modes) {
    if (!mode.id || mode.id === 'global' || modeIds.has(mode.id)) throw new Error(`Invalid or duplicate mode ID: ${mode.id}`);
    modeIds.add(mode.id);
    if (mode.boxes !== undefined && (!Array.isArray(mode.boxes) || !mode.boxes.length || mode.boxes.some(id => !boxIds.has(id)))) throw new Error(`Invalid units for mode: ${mode.id}`);
    for (const id of Object.keys(mode.elements ?? {})) {
      const fixture = config.fixtures.elements[id];
      if (!fixture || (mode.boxes && !mode.boxes.includes(fixture.box))) throw new Error(`Invalid element ${id} in mode ${mode.id}`);
    }
  }
  if (!globalModes(config).some(mode => mode.id === config.defaults.startupMode)) throw new Error('Invalid global startup mode');
  for (const box of boxes) {
    if (box.defaultMode !== undefined && box.defaultMode !== 'global' && !modesForBox(config, box.id).some(mode => mode.id === box.defaultMode)) throw new Error(`Invalid default mode for ${box.id}`);
  }
  const assigned = new Set();
  for (const [id, fixture] of Object.entries(config.fixtures.elements)) {
    if (!boxIds.has(fixture.box)) throw new Error(`Unknown unit for ${id}: ${fixture.box}`);
    const universe = config.universes[fixture.universe];
    if (!universe) throw new Error(`Unknown universe for ${id}: ${fixture.universe}`);
    const required = { dimmer: ['level'], rgbw: ['red', 'green', 'blue', 'white'], rgbcw: ['red', 'green', 'blue', 'coldWhite', 'white'] }[fixture.type];
    if (!required || required.some(key => fixture.channels?.[key] === undefined)) throw new Error(`Invalid fixture channels for ${id}`);
    for (const channel of Object.values(fixture.channels)) {
      if (!Number.isInteger(channel) || channel < 1 || channel > universe.channelCount) throw new Error(`Invalid channel for ${id}: ${channel}`);
      const key = `${fixture.universe}/${channel}`;
      if (assigned.has(key)) throw new Error(`Duplicate channel: ${key}`);
      assigned.add(key);
    }
  }
}

export function globalModes(config) {
  return config.modes.filter(mode => mode.boxes === undefined);
}

export function modesForBox(config, boxId) {
  return config.modes.filter(mode => mode.boxes === undefined || mode.boxes.includes(boxId));
}
