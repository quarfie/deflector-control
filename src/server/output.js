export class DryRunOutput {
  constructor({ logEveryMs = 2000 } = {}) {
    this.lastLogAt = 0;
    this.logEveryMs = logEveryMs;
  }

  async send(frame) {
    const now = Date.now();
    if (now - this.lastLogAt >= this.logEveryMs) {
      this.lastLogAt = now;
      console.log(`[dry-run] ${frame.join(',')}`);
    }
  }
}

export class OlaOutput {
  constructor({ olaUrl, universe }) {
    this.olaUrl = olaUrl.replace(/\/$/, '');
    this.universe = universe;
  }

  async send(frame) {
    const body = new URLSearchParams({
      u: String(this.universe),
      d: frame.join(',')
    });

    const response = await fetch(`${this.olaUrl}/set_dmx`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body
    });

    if (!response.ok) {
      throw new Error(`OLA returned ${response.status}`);
    }
  }
}

export function createOutput(config) {
  return new OutputManager(config);
}

export class OutputManager {
  constructor(config) {
    this.config = config;
    this.dryRun = new DryRunOutput();
    this.mode = 'dry-run';
    this.olaUrl = process.env.OLA_URL ?? config.defaults.olaUrl;
    this.set({
      mode: process.env.DMX_OUTPUT ?? config.defaults.output ?? 'dry-run',
      olaUrl: this.olaUrl
    });
  }

  get publicState() {
    return {
      mode: this.mode,
      olaUrl: this.olaUrl,
      remoteOlaUrl: this.config.defaults.remoteOlaUrl
    };
  }

  set({ mode, olaUrl }) {
    const nextMode = mode ?? this.mode;
    if (!['dry-run', 'ola'].includes(nextMode)) {
      throw new Error(`Unknown output mode: ${nextMode}`);
    }

    this.mode = nextMode;
    if (olaUrl !== undefined) {
      this.olaUrl = String(olaUrl).replace(/\/$/, '');
    }

    this.ola = new OlaOutput({
      olaUrl: this.olaUrl,
      universe: this.config.fixtures.universe
    });
  }

  async send(frame) {
    if (this.mode === 'ola') return this.ola.send(frame);
    return this.dryRun.send(frame);
  }
}
