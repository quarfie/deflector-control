<script setup>
import { computed, onMounted, ref } from 'vue';
import { Power, RadioTower, RotateCcw, SlidersHorizontal } from '@lucide/vue';
import TechBoxPreview from './TechBoxPreview.vue';

const config = ref(null);
const state = ref({
  power: false,
  mode: 'normal',
  boxModes: {},
  manual: {},
  frames: {},
  elements: {},
  output: {
    mode: 'dry-run'
  }
});
const busy = ref(false);
const previewCarousel = ref(null);
const activeBoxId = ref('tech-box-1');
const brightnessDrafts = ref({});
const colorDrafts = ref({});
const activeColorElementId = ref(null);
const colorSyncs = new Map();
const activeBrightnessElementId = ref(null);
const brightnessSyncs = new Map();
let brightnessSyncVersion = 0;

const boxes = computed(() => {
  if (config.value?.boxes?.length) return config.value.boxes;
  return [{ id: 'tech-box-1', label: 'Tech Box 1' }];
});

const activeBox = computed(() => boxes.value.find((box) => box.id === activeBoxId.value) ?? boxes.value[0]);

const elementsByBox = computed(() => {
  if (!config.value) return {};
  return Object.entries(config.value.elements).reduce((grouped, [id, element]) => {
    const boxId = element.box ?? 'tech-box-1';
    grouped[boxId] ??= [];
    grouped[boxId].push({ id, ...element });
    return grouped;
  }, {});
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

async function postState(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Request failed');
  state.value = data;
  return data;
}

function manualFor(elementId) {
  return state.value.manual[elementId] ?? {};
}

function forceState(elementId) {
  const manual = manualFor(elementId);
  if (manual.forceOff) return 'off';
  if (manual.forceOn) return 'on';
  return 'auto';
}

function renderedBrightness(elementId) {
  return Math.round((manualFor(elementId).brightness ?? state.value.elements[elementId]?.brightness ?? 1) * 100);
}

function brightnessValue(elementId) {
  return brightnessDrafts.value[elementId] ?? renderedBrightness(elementId);
}

function appliedBrightness(elementId) {
  if (!state.value.power) return 0;

  const element = state.value.elements[elementId] ?? {};
  const brightness = Number(element.brightness ?? 1);
  const level = Number(element.level ?? 1);
  return Math.round(brightness * level * (element.on ? 1 : 0) * 100);
}

function percentPosition(value) {
  const percent = Math.min(100, Math.max(0, Number(value)));
  const thumbOffset = 0.5625 - percent * 0.01125;
  return `calc(${percent}% + ${thumbOffset}rem)`;
}

function startBrightnessDrag(elementId) {
  activeBrightnessElementId.value = elementId;
}

function stopBrightnessDrag(elementId) {
  if (activeBrightnessElementId.value === elementId) {
    activeBrightnessElementId.value = null;
  }
}

function clearBrightnessDraft(elementId) {
  const { [elementId]: _cleared, ...remainingDrafts } = brightnessDrafts.value;
  brightnessDrafts.value = remainingDrafts;
}

function cancelBrightnessSyncs() {
  colorDrafts.value = {};
  activeColorElementId.value = null;
  colorSyncs.clear();
  brightnessSyncVersion += 1;
  brightnessSyncs.clear();
  brightnessDrafts.value = {};
  activeBrightnessElementId.value = null;
}

function brightnessSyncFor(elementId) {
  if (!brightnessSyncs.has(elementId)) {
    brightnessSyncs.set(elementId, {
      clearAfterSync: false,
      inFlight: false,
      pending: null
    });
  }

  return brightnessSyncs.get(elementId);
}

function queueBrightnessSync(elementId, value, options = {}) {
  const sync = brightnessSyncFor(elementId);
  sync.pending = Number(value);
  sync.clearAfterSync ||= Boolean(options.clearAfterSync);
  pumpBrightnessSync(elementId, brightnessSyncVersion);
}

async function pumpBrightnessSync(elementId, version) {
  const sync = brightnessSyncFor(elementId);
  if (sync.inFlight || sync.pending === null) return;

  const brightness = sync.pending;
  sync.pending = null;
  sync.inFlight = true;

  try {
    await postState(`/api/manual/${elementId}`, { brightness: brightness / 100 });
  } catch (error) {
    console.error(error);
  } finally {
    sync.inFlight = false;

    if (version !== brightnessSyncVersion) return;

    if (sync.pending !== null) {
      pumpBrightnessSync(elementId, version);
    } else if (sync.clearAfterSync && activeBrightnessElementId.value !== elementId) {
      sync.clearAfterSync = false;
      clearBrightnessDraft(elementId);
    }
  }
}

async function setPower() {
  const nextPower = !state.value.power;
  if (!nextPower) cancelBrightnessSyncs();
  await api('/api/power', { power: nextPower });
}

async function setMode(event) {
  cancelBrightnessSyncs();
  await api('/api/mode', { mode: event.target.value });
}

const unitMode = computed(() => state.value.boxModes?.[activeBox.value.id] ?? 'global');
const globalModeLabel = computed(() => config.value?.modes.find(mode => mode.id === state.value.mode)?.label ?? state.value.mode);
const unitModeDescription = computed(() => unitMode.value === 'global'
  ? `Following global: ${globalModeLabel.value}`
  : activeBox.value.modes?.find(mode => mode.id === unitMode.value)?.description ?? 'This unit keeps its own mode when the global mode changes.');

async function setUnitMode(event) {
  cancelBrightnessSyncs();
  await api(`/api/boxes/${encodeURIComponent(activeBox.value.id)}/mode`, { mode: event.target.value });
}

const outputSelection = computed(() => state.value.output?.mode ?? 'dry-run');
const outputLabels = { 'dry-run': 'Dry Run', live: 'Live' };
const outputDetail = computed(() => outputSelection.value === 'live' ? 'Configured universes' : 'No hardware output');
const visibleUniverses = computed(() => {
  const ids = new Set(Object.values(config.value?.elements ?? {}).filter(f => f.box === activeBox.value.id).map(f => f.universe));
  return [...ids].map(id => {
    const fixtures = Object.values(config.value.elements).filter(f => f.universe === id);
    const lastChannel = Math.max(0, ...fixtures.flatMap(f => Object.values(f.channels)));
    return { id, ...config.value.universes[id], frame: (state.value.frames[id] ?? []).slice(0, lastChannel) };
  });
});

async function cycleOutput() {
  await api('/api/output', { mode: outputSelection.value === 'live' ? 'dry-run' : 'live' });
}

async function setBrightness(elementId, value) {
  const brightness = Number(value);
  brightnessDrafts.value = {
    ...brightnessDrafts.value,
    [elementId]: brightness
  };
  stopBrightnessDrag(elementId);
  queueBrightnessSync(elementId, brightness, { clearAfterSync: true });
}

function previewBrightness(elementId, value) {
  const brightness = Number(value);
  startBrightnessDrag(elementId);
  brightnessDrafts.value = {
    ...brightnessDrafts.value,
    [elementId]: brightness
  };
  queueBrightnessSync(elementId, brightness);
}

function beginColorEdit(elementId) {
  colorDrafts.value[elementId] = effectiveColor(elementId);
  activeColorElementId.value = elementId;
}

function endColorEdit(elementId) {
  if (activeColorElementId.value === elementId) activeColorElementId.value = null;
  if (!colorSyncs.get(elementId)?.inFlight) delete colorDrafts.value[elementId];
}

function setColor(elementId, value) {
  const white = effectiveColor(elementId).slice(7, 9);
  queueColor(elementId, value + white);
}

function effectiveColor(elementId) {
  return colorDrafts.value[elementId] ?? manualFor(elementId).color ?? state.value.elements[elementId]?.color ?? '#ffffff';
}

function whiteValue(elementId) {
  return Math.round(parseInt(effectiveColor(elementId).slice(7, 9) || '00', 16) / 255 * 100);
}

function setWhite(elementId, value) {
  const white = Math.round(Number(value) / 100 * 255).toString(16).padStart(2, '0');
  queueColor(elementId, effectiveColor(elementId).slice(0, 7) + white);
}

function queueColor(elementId, color) {
  colorDrafts.value[elementId] = color;
  if (!colorSyncs.has(elementId)) colorSyncs.set(elementId, { inFlight: false, pending: null });
  const sync = colorSyncs.get(elementId);
  sync.pending = color;
  pumpColor(elementId, sync);
}

async function pumpColor(elementId, sync) {
  if (sync.inFlight) return;
  sync.inFlight = true;
  try {
    // Serialize writes so a slower earlier request cannot replace the final choice.
    while (sync.pending !== null && colorSyncs.get(elementId) === sync) {
      const color = sync.pending;
      sync.pending = null;
      await postState(`/api/manual/${elementId}`, { color });
    }
  } catch (error) {
    console.error(error);
  } finally {
    sync.inFlight = false;
    if (colorSyncs.get(elementId) === sync && activeColorElementId.value !== elementId) {
      delete colorDrafts.value[elementId];
    }
  }
}

async function setForce(elementId, mode) {
  if (mode === 'auto') {
    colorSyncs.delete(elementId);
    delete colorDrafts.value[elementId];
    await api(`/api/manual/${elementId}/clear`, {});
  } else if (mode === 'on') {
    await api(`/api/manual/${elementId}`, { forceOn: true, forceOff: false });
  } else {
    await api(`/api/manual/${elementId}`, { forceOn: false, forceOff: true });
  }
}

async function clearAll() {
  cancelBrightnessSyncs();
  await api('/api/manual/clear', {});
}

async function cycleForce(elementId) {
  const next = {
    auto: 'on',
    on: 'off',
    off: 'auto'
  }[forceState(elementId)];
  await setForce(elementId, next);
}

function elementsForBox(boxId) {
  return elementsByBox.value[boxId] ?? [];
}

function setActiveBox(boxId) {
  const scrollTop = window.scrollY;
  const scrollLeft = window.scrollX;

  activeBoxId.value = boxId;
  const index = boxes.value.findIndex((box) => box.id === boxId);
  scrollCarouselTo(previewCarousel.value, index, 'smooth');

  requestAnimationFrame(() => {
    window.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'auto' });
  });
  window.setTimeout(() => {
    window.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'auto' });
  }, 50);
  window.setTimeout(() => {
    window.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'auto' });
  }, 500);
}

function cycleActiveBox() {
  const currentIndex = boxes.value.findIndex((box) => box.id === activeBox.value.id);
  const nextBox = boxes.value[(currentIndex + 1) % boxes.value.length];
  if (nextBox) setActiveBox(nextBox.id);
}

function closestBoxIndex(scroller) {
  if (!scroller) return 0;
  const center = scroller.scrollLeft + scroller.clientWidth / 2;
  let closest = { distance: Number.POSITIVE_INFINITY, index: 0 };

  Array.from(scroller.children).forEach((child, index) => {
    const childCenter = child.offsetLeft + child.clientWidth / 2;
    const distance = Math.abs(center - childCenter);
    if (distance < closest.distance) closest = { distance, index };
  });

  return closest.index;
}

function scrollCarouselTo(scroller, index, behavior = 'auto') {
  const target = scroller?.children?.[index];
  if (!target || !scroller) return;

  const targetLeft = target.offsetLeft - (scroller.clientWidth - target.clientWidth) / 2;
  scroller.scrollTo({ left: targetLeft, behavior });
}

function updateActiveBoxFromScroll(source) {
  if (!source) return;
  const index = closestBoxIndex(source);
  activeBoxId.value = boxes.value[index]?.id ?? activeBoxId.value;
}

onMounted(async () => {
  config.value = await api('/api/config');
  activeBoxId.value = boxes.value[0]?.id ?? 'tech-box-1';
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
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-[0.2em] text-cyan">Main Engineering</p>
          <h1 class="mt-1 text-2xl font-semibold">Deflector Control</h1>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button
            class="flex h-14 w-36 items-center gap-2 rounded-full border border-rail bg-panel px-3 text-left text-slate-200 transition"
            :disabled="busy"
            :title="outputSelection === 'live' ? 'Switch to dry run' : 'Switch to live output'"
            :aria-pressed="outputSelection === 'live'"
            @click="cycleOutput"
          >
            <RadioTower :size="18" class="shrink-0 text-cyan" />
            <span class="min-w-0">
              <span class="block text-sm font-medium leading-tight">{{ outputLabels[outputSelection] }}</span>
              <span class="block truncate text-[0.6rem] leading-tight text-slate-400">{{ outputDetail }}</span>
            </span>
          </button>
          <button
            class="grid h-14 w-14 place-items-center rounded-full border border-rail transition"
            :class="state.power ? 'bg-mint text-hull' : 'bg-panel text-slate-300'"
            :disabled="busy"
            title="Power"
            @click="setPower"
          >
            <Power :size="24" />
          </button>
        </div>
      </header>

      <section>
        <div
          ref="previewCarousel"
          class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1"
          @scroll.passive="updateActiveBoxFromScroll(previewCarousel)"
        >
          <div
            v-for="box in boxes"
            :key="box.id"
            class="w-full flex-none snap-center"
          >
            <TechBoxPreview :box="box" :frames="state.frames" :power="state.power" :fixtures="config?.elements ?? {}" />
          </div>
        </div>
        <div class="mt-3 flex items-center justify-center gap-2">
          <button
            v-for="box in boxes"
            :key="box.id"
            type="button"
            class="h-2.5 rounded-full transition-all"
            :class="box.id === activeBox.id ? 'w-8 bg-cyan' : 'w-2.5 bg-slate-600'"
            :aria-label="box.label"
            @click.prevent="setActiveBox(box.id)"
          />
        </div>
      </section>

      <section class="rounded-lg border border-rail bg-panel p-4">
        <div class="flex items-center justify-between gap-3">
          <label class="text-sm font-medium text-slate-300" for="mode">Global mode</label>
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
        <div class="mt-4 border-t border-rail pt-4">
          <label class="mb-2 block text-sm font-medium text-slate-300" for="unit-mode">{{ activeBox.label }} mode</label>
          <select
            id="unit-mode"
            class="w-full rounded-md border border-rail bg-hull px-3 py-2 text-base"
            :value="unitMode"
            :disabled="busy"
            @change="setUnitMode"
          >
            <option value="global">Adopt global — {{ globalModeLabel }}</option>
            <option v-for="mode in activeBox.modes ?? []" :key="mode.id" :value="mode.id">{{ mode.label }}</option>
          </select>
          <p class="mt-2 text-xs text-slate-400">{{ unitModeDescription }}</p>
        </div>
        <div v-for="universe in visibleUniverses" :key="universe.id" class="mt-4">
          <p class="mb-2 text-xs text-slate-400">{{ universe.label }} · {{ universe.olaUrl }} · Universe {{ universe.universe }}</p>
          <div class="grid grid-cols-10 gap-1">
            <div
              v-for="(value, index) in universe.frame"
              :key="index"
              class="h-10 rounded bg-hull text-center text-xs leading-10 text-slate-300"
              :style="{ opacity: Math.max(0.25, value / 255) }"
            >
              {{ index + 1 }}
            </div>
          </div>
        </div>
      </section>

      <section class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm text-slate-300">
          <SlidersHorizontal :size="18" />
          <span>Manual Overrides</span>
          <button
            type="button"
            class="rounded-full border border-rail bg-panel px-2 py-1 text-xs font-medium text-cyan transition hover:border-cyan"
            :aria-label="`Switch manual overrides to ${boxes[(boxes.findIndex((box) => box.id === activeBox.id) + 1) % boxes.length]?.label ?? 'next tech box'}`"
            @click="cycleActiveBox"
          >
            {{ activeBox.label }}
          </button>
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
          v-for="element in elementsForBox(activeBox.id)"
          :key="element.id"
          class="rounded-lg border border-rail bg-panel p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold">{{ element.label }}</h2>
            </div>
            <div class="flex items-center gap-2">
              <input
                v-if="element.type === 'rgbw' || element.type === 'rgbcw'"
                class="h-10 w-12 rounded border border-rail bg-hull"
                type="color"
                :aria-label="`${element.label} color`"
                :value="effectiveColor(element.id).slice(0, 7)"
                @pointerdown="beginColorEdit(element.id)"
                @focus="beginColorEdit(element.id)"
                @input="setColor(element.id, $event.target.value)"
                @change="setColor(element.id, $event.target.value)"
                @blur="endColorEdit(element.id)"
              />
              <span
                v-if="activeBrightnessElementId === element.id"
                class="min-w-10 text-right text-sm font-medium tabular-nums text-cyan"
              >
                {{ brightnessValue(element.id) }}%
              </span>
              <button
                class="min-w-16 rounded-md border border-rail bg-hull px-3 py-2 text-sm capitalize text-slate-200"
                :disabled="busy"
                @click="cycleForce(element.id)"
              >
                {{ forceState(element.id) }}
              </button>
            </div>
          </div>

          <label class="mt-4 block">
            <span class="relative block h-7">
              <span
                class="pointer-events-none absolute inset-x-0 top-[0.68rem] z-0 h-1 rounded-full bg-amber/20"
                aria-hidden="true"
              >
                <span
                  class="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-hull bg-amber shadow-[0_0_12px_rgba(244,166,42,0.55)]"
                  :style="{ left: percentPosition(appliedBrightness(element.id)) }"
                />
              </span>
              <input
                class="brightness-slider relative z-10 w-full"
                type="range"
                :aria-label="`${element.label} brightness`"
                min="0"
                max="100"
                :value="brightnessValue(element.id)"
                @pointerdown="startBrightnessDrag(element.id)"
                @pointerup="stopBrightnessDrag(element.id)"
                @pointercancel="stopBrightnessDrag(element.id)"
                @input="previewBrightness(element.id, $event.target.value)"
                @change="setBrightness(element.id, $event.target.value)"
                @blur="stopBrightnessDrag(element.id)"
              />
            </span>
          </label>
          <label v-if="element.box === 'light-up-sign'" class="mt-3 block text-sm text-slate-300">
            <span class="flex justify-between"><span>White</span><span>{{ whiteValue(element.id) }}%</span></span>
            <input
              class="mt-2 w-full accent-cyan"
              type="range"
              min="0"
              max="100"
              :aria-label="`${element.label} white`"
              :value="whiteValue(element.id)"
              @pointerdown="beginColorEdit(element.id)"
              @focus="beginColorEdit(element.id)"
              @input="setWhite(element.id, $event.target.value)"
              @change="setWhite(element.id, $event.target.value)"
              @pointerup="endColorEdit(element.id)"
              @pointercancel="endColorEdit(element.id)"
              @blur="endColorEdit(element.id)"
            />
          </label>
        </article>
      </section>
    </section>
  </main>
</template>
