export class DryRunOutput {
  constructor({ logEveryMs = 2000 } = {}) {
    this.lastLogAt = 0;
    this.logEveryMs = logEveryMs;
  }

  async send(frames) {
    const now = Date.now();
    if (now - this.lastLogAt >= this.logEveryMs) {
      this.lastLogAt = now;
      for (const [id, frame] of Object.entries(frames)) console.log(`[dry-run:${id}] ${frame.join(',')}`);
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
      body,
      signal: AbortSignal.timeout(1000)
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
    this.dryRun = new DryRunOutput();
    this.mode = 'dry-run';
    this.targets = Object.fromEntries(Object.entries(config.universes).map(([id, universe]) => {
      // Dispatch by transport type here when additional adapters are implemented.
      if (universe.type !== 'ola') throw new Error(`Unsupported universe type: ${universe.type}`);
      return [id, { adapter: new OlaOutput(universe), pending: false }];
    }));
    this.set({ mode: process.env.DMX_OUTPUT ?? config.defaults.output ?? 'dry-run' });
  }

  get publicState() {
    return { mode: this.mode };
  }

  set({ mode, olaUrl }) {
    if (olaUrl !== undefined) throw new Error('Configure destinations in config/universes.json');
    const nextMode = mode ?? this.mode;
    if (!['dry-run', 'live'].includes(nextMode)) throw new Error(`Unknown output mode: ${nextMode}`);
    this.mode = nextMode;
  }

  async send(frames) {
    if (this.mode === 'dry-run') return this.dryRun.send(frames);
    const results = await Promise.allSettled(Object.entries(this.targets).map(async ([id, target]) => {
      // A slow host must not queue frames or block healthy universes.
      if (target.pending) return;
      target.pending = true;
      try {
        await target.adapter.send(frames[id]);
      } catch (error) {
        throw new Error(`${id}: ${error.message}`);
      } finally {
        target.pending = false;
      }
    }));
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) throw new Error(failures.map(result => result.reason.message).join('; '));
  }
}
