<script setup>
import { computed, onMounted, ref } from 'vue';
import { Power, RotateCcw, SlidersHorizontal } from '@lucide/vue';
import TechBoxPreview from './TechBoxPreview.vue';

const config = ref(null);
const state = ref({
  power: false,
  mode: 'normal',
  manual: {},
  frame: [],
  elements: {},
  output: {
    mode: 'dry-run',
    olaUrl: 'http://localhost:9090',
    remoteOlaUrl: 'http://pizero.local:9090'
  }
});
const busy = ref(false);

const elementEntries = computed(() => {
  if (!config.value) return [];
  return Object.entries(config.value.elements).map(([id, element]) => ({ id, ...element }));
});

async function api(path, body) {
  busy.value = true;
  try {
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Request failed');
    if (path !== '/api/config') state.value = data;
    return data;
  } finally {
    busy.value = false;
  }
}

function manualFor(elementId) {
  return state.value.manual[elementId] ?? {};
}

async function setPower() {
  await api('/api/power', { power: !state.value.power });
}

async function setMode(event) {
  await api('/api/mode', { mode: event.target.value });
}

async function setOutput(event) {
  const value = event.target.value;
  if (value === 'dry-run') {
    await api('/api/output', { mode: 'dry-run' });
  } else if (value === 'ola-local') {
    await api('/api/output', { mode: 'ola', olaUrl: config.value.olaUrl });
  } else if (value === 'ola-pi') {
    await api('/api/output', { mode: 'ola', olaUrl: config.value.remoteOlaUrl });
  }
}

const outputSelection = computed(() => {
  if (state.value.output?.mode !== 'ola') return 'dry-run';
  if (state.value.output.olaUrl === config.value?.remoteOlaUrl) return 'ola-pi';
  return 'ola-local';
});

async function setBrightness(elementId, value) {
  await api(`/api/manual/${elementId}`, { brightness: Number(value) / 100 });
}

async function setColor(elementId, value) {
  await api(`/api/manual/${elementId}`, { color: value });
}

async function setForce(elementId, mode) {
  if (mode === 'auto') {
    await api(`/api/manual/${elementId}/clear`, {});
  } else if (mode === 'on') {
    await api(`/api/manual/${elementId}`, { forceOn: true, forceOff: false });
  } else {
    await api(`/api/manual/${elementId}`, { forceOn: false, forceOff: true });
  }
}

async function clearAll() {
  await api('/api/manual/clear', {});
}

onMounted(async () => {
  config.value = await api('/api/config');
  state.value = await api('/api/state');

  const events = new EventSource('/events');
  events.onmessage = (event) => {
    state.value = JSON.parse(event.data);
  };
});
</script>

<template>
  <main class="min-h-screen bg-hull text-slate-100">
    <section class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 sm:py-8">
      <header class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-cyan">Starfleet Utility</p>
          <h1 class="mt-1 text-2xl font-semibold">Deflector Control</h1>
        </div>
        <button
          class="grid h-14 w-14 place-items-center rounded-full border border-rail transition"
          :class="state.power ? 'bg-mint text-hull' : 'bg-panel text-slate-300'"
          :disabled="busy"
          title="Power"
          @click="setPower"
        >
          <Power :size="24" />
        </button>
      </header>

      <TechBoxPreview :frame="state.frame" :power="state.power" />

      <section class="rounded-lg border border-rail bg-panel p-4">
        <div class="flex items-center justify-between gap-3">
          <label class="text-sm font-medium text-slate-300" for="output">Output</label>
          <select
            id="output"
            class="rounded-md border border-rail bg-hull px-3 py-2 text-base"
            :value="outputSelection"
            @change="setOutput"
          >
            <option value="dry-run">Dry Run</option>
            <option value="ola-local">Local OLA</option>
            <option value="ola-pi">Pi OLA</option>
          </select>
        </div>
        <p class="mt-3 truncate text-sm text-slate-400">
          {{ state.output?.mode === 'ola' ? state.output.olaUrl : 'No DMX output' }}
        </p>
      </section>

      <section class="rounded-lg border border-rail bg-panel p-4">
        <div class="flex items-center justify-between gap-3">
          <label class="text-sm font-medium text-slate-300" for="mode">Mode</label>
          <select
            id="mode"
            class="rounded-md border border-rail bg-hull px-3 py-2 text-base"
            :value="state.mode"
            @change="setMode"
          >
            <option v-for="mode in config?.modes ?? []" :key="mode.id" :value="mode.id">
              {{ mode.label }}
            </option>
          </select>
        </div>
        <div class="mt-4 grid grid-cols-10 gap-1">
          <div
            v-for="(value, index) in state.frame"
            :key="index"
            class="h-10 rounded bg-hull text-center text-xs leading-10 text-slate-300"
            :style="{ opacity: Math.max(0.25, value / 255) }"
          >
            {{ index + 1 }}
          </div>
        </div>
      </section>

      <section class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm text-slate-300">
          <SlidersHorizontal :size="18" />
          <span>Manual Overrides</span>
        </div>
        <button
          class="inline-flex items-center gap-2 rounded-md border border-rail px-3 py-2 text-sm text-slate-200"
          :disabled="busy"
          @click="clearAll"
        >
          <RotateCcw :size="16" />
          Reset
        </button>
      </section>

      <section class="grid gap-3">
        <article
          v-for="element in elementEntries"
          :key="element.id"
          class="rounded-lg border border-rail bg-panel p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold">{{ element.label }}</h2>
              <p class="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                {{ element.type }}
              </p>
            </div>
            <select
              class="rounded-md border border-rail bg-hull px-2 py-2 text-sm"
              :value="manualFor(element.id).forceOff ? 'off' : manualFor(element.id).forceOn ? 'on' : 'auto'"
              @change="setForce(element.id, $event.target.value)"
            >
              <option value="auto">Auto</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>

          <label class="mt-4 block text-sm text-slate-300">
            Brightness
            <input
              class="mt-2 w-full accent-cyan"
              type="range"
              min="0"
              max="100"
              :value="Math.round((manualFor(element.id).brightness ?? state.elements[element.id]?.brightness ?? 1) * 100)"
              @change="setBrightness(element.id, $event.target.value)"
            />
          </label>

          <label v-if="element.type === 'rgbw'" class="mt-4 flex items-center justify-between gap-3 text-sm text-slate-300">
            Color
            <input
              class="h-10 w-16 rounded border border-rail bg-hull"
              type="color"
              :value="manualFor(element.id).color ?? state.elements[element.id]?.color ?? '#ffffff'"
              @change="setColor(element.id, $event.target.value)"
            />
          </label>
        </article>
      </section>
    </section>
  </main>
</template>
