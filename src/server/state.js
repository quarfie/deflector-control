import { createInitialState, renderSnapshot } from './renderer.js';

export class ControllerState {
  constructor(config) {
    this.config = config;
    this.state = createInitialState(config);
    this.latestFrame = [];
    this.latestElements = {};
  }

  get publicState() {
    return {
      power: this.state.power,
      mode: this.state.mode,
      manual: this.state.manual,
      frame: this.latestFrame,
      elements: this.latestElements
    };
  }

  setPower(power) {
    this.state.power = Boolean(power);
    if (!this.state.power) this.state.manual = {};
  }

  setMode(modeId) {
    const exists = this.config.modes.some((mode) => mode.id === modeId);
    if (!exists) throw new Error(`Unknown mode: ${modeId}`);
    this.state.mode = modeId;
    this.state.manual = {};
    this.state.startedAt = Date.now();
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
    this.latestFrame = snapshot.frame;
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
