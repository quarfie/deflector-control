import { globalModes, modesForBox } from './config.js';
import { createInitialState, renderSnapshot } from './renderer.js';

export class ControllerState {
  constructor(config) {
    this.config = config;
    this.state = createInitialState(config);
    this.latestFrames = {};
    this.latestElements = {};
  }

  get publicState() {
    return {
      power: this.state.power,
      mode: this.state.mode,
      boxModes: this.state.boxModes,
      manual: this.state.manual,
      frames: this.latestFrames,
      elements: this.latestElements
    };
  }

  setPower(power) {
    this.state.power = Boolean(power);
    if (!this.state.power) this.state.manual = {};
  }

  setMode(modeId) {
    const exists = globalModes(this.config).some((mode) => mode.id === modeId);
    if (!exists) throw new Error(`Unknown mode: ${modeId}`);
    this.state.mode = modeId;
    for (const box of this.config.fixtures.boxes) {
      if (this.state.boxModes[box.id] === 'global') this.clearBoxManual(box.id);
    }
    this.state.startedAt = Date.now();
  }

  setBoxMode(boxId, modeId) {
    if (!this.config.fixtures.boxes.some(box => box.id === boxId)) throw new Error(`Unknown unit: ${boxId}`);
    if (modeId !== 'global' && !modesForBox(this.config, boxId).some(mode => mode.id === modeId)) throw new Error(`Unknown mode for ${boxId}: ${modeId}`);
    this.state.boxModes[boxId] = modeId;
    this.state.boxStartedAt[boxId] = Date.now();
    this.clearBoxManual(boxId);
  }

  clearBoxManual(boxId) {
    for (const [id, fixture] of Object.entries(this.config.fixtures.elements)) {
      if (fixture.box === boxId) delete this.state.manual[id];
    }
  }

  setManual(elementId, patch) {
    if (!this.config.fixtures.elements[elementId]) {
      throw new Error(`Unknown element: ${elementId}`);
    }

    this.state.manual[elementId] = {
      ...(this.state.manual[elementId] ?? {}),
      ...sanitizeManualPatch(patch)
    };
  }

  clearManual(elementId) {
    if (elementId) {
      delete this.state.manual[elementId];
    } else {
      this.state.manual = {};
    }
  }

  render(nowMs = Date.now()) {
    const snapshot = renderSnapshot(this.config, this.state, nowMs);
    this.latestFrames = snapshot.frames;
    this.latestElements = snapshot.elements;
    return snapshot;
  }
}

function sanitizeManualPatch(patch) {
  const clean = {};

  if (patch.brightness !== undefined) clean.brightness = Number(patch.brightness);
  if (patch.color !== undefined) clean.color = String(patch.color);
  if (patch.forceOn !== undefined) clean.forceOn = Boolean(patch.forceOn);
  if (patch.forceOff !== undefined) clean.forceOff = Boolean(patch.forceOff);

  return clean;
}
