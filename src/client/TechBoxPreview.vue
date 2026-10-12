<script setup>
import { computed, useId } from 'vue';
import techBox1 from './artwork/tech-box-1.svg?raw';
import techBox2 from './artwork/tech-box-2.svg?raw';
import thrusterControl from './artwork/emerg-stbd-thruster-control.svg?raw';
import lightUpSign from './artwork/light-up-sign.svg?raw';
import { preparePreviewSvg } from './preview-svg.js';
import './preview-lighting.css';

const props = defineProps({
  fixtures: {
    type: Object,
    default: () => ({})
  },
  frames: {
    type: Object,
    default: null
  },
  frame: {
    type: Array,
    default: () => []
  },
  power: {
    type: Boolean,
    default: false
  },
  box: {
    type: Object,
    default: () => ({ id: 'tech-box-1', label: 'Tech Box 1' })
  }
});

const channelMap = computed(() => {
  if (props.box.id === 'light-up-sign') return {};
  if (props.box.id === 'emerg-stbd-thruster-control') {
    return {
      stripRed: ["emerg-stbd-thruster-lower-strip", "red"],
      stripGreen: ["emerg-stbd-thruster-lower-strip", "green"],
      stripBlue: ["emerg-stbd-thruster-lower-strip", "blue"],
      stripColdWhite: ["emerg-stbd-thruster-lower-strip", "coldWhite"],
      stripWhite: ["emerg-stbd-thruster-lower-strip", "white"]
    };
  }

  if (props.box.id === 'tech-box-2') {
    return {
      edgeRed: ["tech-box-2-edge-lights", "red"],
      edgeGreen: ["tech-box-2-edge-lights", "green"],
      edgeBlue: ["tech-box-2-edge-lights", "blue"],
      edgeWhite: ["tech-box-2-edge-lights", "white"],
      topRightRedLine: ["tech-box-2-top-right-red-line", "level"],
      topLeftRed: ["tech-box-2-top-left-red-lights", "level"],
      topLeftGreen: ["tech-box-2-top-left-green-light", "level"],
      bottomLeftAmber: ["tech-box-2-bottom-left-amber-lights", "level"],
      bottomLeftGreen: ["tech-box-2-bottom-left-green-light", "level"],
      bottomRight: ["tech-box-2-bottom-right-lights", "level"]
    };
  }

  return {
    green: ["green-lights", "level"],
    orange: ["orange-lights", "level"],
    jelly: ["jelly-bean-buttons", "level"],
    switch1: ["switch-1", "level"],
    switchBank: ["switch-bank", "level"],
    edgeRed: ["edge-lights", "red"],
    edgeGreen: ["edge-lights", "green"],
    edgeBlue: ["edge-lights", "blue"],
    edgeWhite: ["edge-lights", "white"]
  };
});

function channel(elementId, key) {
  const fixture = props.fixtures[elementId];
  const frame = props.frames ? props.frames[fixture?.universe] ?? [] : props.frame;
  return props.power ? (frame[(fixture?.channels?.[key] ?? 0) - 1] ?? 0) / 255 : 0;
}

const levels = computed(() =>
  Object.fromEntries(
    Object.entries(channelMap.value).map(([key, [elementId, component]]) => [key, channel(elementId, component)])
  )
);

function level(key) {
  return levels.value[key] ?? 0;
}

const edgeColor = computed(() => {
  const white = level('edgeWhite') || Math.max(level('stripColdWhite'), level('stripWhite'));
  const red = Math.round((level('edgeRed') + level('stripRed') + white * 0.85) * 255);
  const green = Math.round((level('edgeGreen') + level('stripGreen') + white * 0.85) * 255);
  const blue = Math.round((level('edgeBlue') + level('stripBlue') + white * 0.85) * 255);
  return `rgb(${Math.min(255, red)}, ${Math.min(255, green)}, ${Math.min(255, blue)})`;
});

const edgeLevel = computed(() =>
  Math.max(
    level('edgeRed'),
    level('edgeGreen'),
    level('edgeBlue'),
    level('edgeWhite'),
    level('stripRed'),
    level('stripGreen'),
    level('stripBlue'),
    level('stripColdWhite'),
    level('stripWhite')
  )
);

const stripColor = computed(() => {
  const white = Math.max(level('stripColdWhite'), level('stripWhite'));
  const red = Math.round((level('stripRed') + white * 0.85) * 255);
  const green = Math.round((level('stripGreen') + white * 0.85) * 255);
  const blue = Math.round((level('stripBlue') + white * 0.85) * 255);
  return `rgb(${Math.min(255, red)}, ${Math.min(255, green)}, ${Math.min(255, blue)})`;
});

const stripLevel = computed(() =>
  Math.max(level('stripRed'), level('stripGreen'), level('stripBlue'), level('stripColdWhite'), level('stripWhite'))
);

// Artwork is prepared only when the selected box changes, never per DMX frame.
const previewId = useId();
const artwork = computed(() => {
  const source = props.box.id === 'light-up-sign' ? lightUpSign
    : props.box.id === 'emerg-stbd-thruster-control'
    ? thrusterControl
    : props.box.id === 'tech-box-2' ? techBox2 : techBox1;
  return preparePreviewSvg(source, previewId);
});

const lightingVariables = computed(() => {
  if (props.box.id === 'light-up-sign') {
    const variables = {};
    for (let zone = 1; zone <= 6; zone += 1) {
      // Follow fixture configuration so changing the DMX address also updates the preview.
      const [red, green, blue, white] = ['red', 'green', 'blue', 'white'].map(key => channel(`sign-zone-${zone}`, key));
      const color = [red, green, blue].map(value => Math.min(255, Math.round((value + white * 0.85) * 255)));
      variables[`--zone-${zone}-color`] = `rgb(${color.join(', ')})`;
      variables[`--zone-${zone}-level`] = Math.max(red, green, blue, white);
    }
    return variables;
  }
  const variables = Object.fromEntries(Object.entries(levels.value).map(([key, value]) => [
    '--' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase()) + '-level', value
  ]));
  return {
    ...variables,
    '--edge-color': edgeColor.value,
    '--edge-level': edgeLevel.value,
    '--strip-color': stripColor.value,
    '--strip-level': stripLevel.value
  };
});
</script>

<template>
  <section class="overflow-hidden rounded-lg border border-rail bg-panel">
    <!-- Only trusted, repository-owned SVG artwork is inserted here. -->
    <div
      class="tech-box-preview"
      role="img"
      :aria-label="`${box.label} lighting simulator`"
      :style="lightingVariables"
      v-html="artwork"
    />
  </section>
</template>
