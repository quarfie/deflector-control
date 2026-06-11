import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function readJson(relativePath) {
  const content = await readFile(path.join(rootDir, relativePath), 'utf8');
  return JSON.parse(content);
}

export async function loadConfig() {
  const [fixtures, defaults, effects, modes] = await Promise.all([
    readJson('config/fixtures.json'),
    readJson('config/defaults.json'),
    readJson('config/effects.json'),
    readJson('config/modes.json')
  ]);

  return {
    fixtures,
    defaults,
    effects,
    modes: modes.modes
  };
}

export function getClientConfig(config) {
  return {
    universe: config.fixtures.universe,
    channelCount: config.fixtures.channelCount,
    elements: config.fixtures.elements,
    modes: config.modes.map(({ id, label }) => ({ id, label })),
    frameRate: config.defaults.frameRate,
    output: config.defaults.output,
    olaUrl: config.defaults.olaUrl,
    remoteOlaUrl: config.defaults.remoteOlaUrl
  };
}
