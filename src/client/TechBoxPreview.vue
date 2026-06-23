<script setup>
import { computed } from 'vue';

const props = defineProps({
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
  if (props.box.id === 'tech-box-2') {
    return {
      edgeRed: 11,
      edgeGreen: 12,
      edgeBlue: 13,
      edgeWhite: 14,
      topRightRedLine: 15,
      topLeftRed: 16,
      topLeftGreen: 17,
      bottomLeftAmber: 18,
      bottomLeftGreen: 19,
      bottomRight: 20
    };
  }

  return {
    green: 1,
    orange: 2,
    jelly: 3,
    switch1: 4,
    switchBank: 5,
    edgeRed: 6,
    edgeGreen: 7,
    edgeBlue: 8,
    edgeWhite: 9
  };
});

function channel(index) {
  return props.power ? (props.frame[index - 1] ?? 0) / 255 : 0;
}

function glowStyle(color, level, scale = 1) {
  const opacity = Math.max(0.12, level);
  const blur = Math.round(8 + level * 26 * scale);
  return {
    opacity,
    filter: `drop-shadow(0 0 ${blur}px ${color}) drop-shadow(0 0 ${Math.round(blur / 2)}px ${color})`
  };
}

const levels = computed(() =>
  Object.fromEntries(
    Object.entries(channelMap.value).map(([key, index]) => [key, channel(index)])
  )
);

const edgeColor = computed(() => {
  const red = Math.round((levels.value.edgeRed + levels.value.edgeWhite * 0.85) * 255);
  const green = Math.round((levels.value.edgeGreen + levels.value.edgeWhite * 0.85) * 255);
  const blue = Math.round((levels.value.edgeBlue + levels.value.edgeWhite * 0.85) * 255);
  return `rgb(${Math.min(255, red)}, ${Math.min(255, green)}, ${Math.min(255, blue)})`;
});

const edgeLevel = computed(() =>
  Math.max(levels.value.edgeRed, levels.value.edgeGreen, levels.value.edgeBlue, levels.value.edgeWhite)
);

const svgIds = computed(() => {
  const suffix = props.box.id.replaceAll('-', '_');
  return {
    hexPattern: `hexPattern_${suffix}`,
    panelSheen: `panelSheen_${suffix}`,
    buttonFace: `buttonFace_${suffix}`,
    softShadow: `softShadow_${suffix}`
  };
});

const topGreenLights = [
  { x: 706, y: 230 },
  { x: 706, y: 294 },
  { x: 706, y: 358 },
  { x: 706, y: 422 }
];

const topOrangeLights = [
  { x: 768, y: 230 },
  { x: 768, y: 294 },
  { x: 768, y: 358 },
  { x: 768, y: 422 }
];

const jellyButtons = [
  { x: 474, y: 890, color: '#ffd54a' },
  { x: 522, y: 890, color: '#ffd54a' },
  { x: 570, y: 890, color: '#ffd54a' },
  { x: 618, y: 890, color: '#00a8ff' },
  { x: 666, y: 890, color: '#00a8ff' },
  { x: 714, y: 890, color: '#ffd54a' },
  { x: 762, y: 890, color: '#ffd54a' }
];

const railSwitches = [
  { x: 182, color: '#ff7a22', level: 'switch1' },
  { x: 338, color: '#ff1828', level: 'switchBank' },
  { x: 494, color: '#ff1828', level: 'switchBank' },
  { x: 650, color: '#ff1828', level: 'switchBank' }
];

</script>

<template>
  <section class="overflow-hidden rounded-lg border border-rail bg-panel">
    <svg
      class="block h-auto w-full"
      viewBox="0 0 920 1120"
      role="img"
      :aria-label="`${box.label} lighting simulator`"
    >
      <defs>
        <pattern :id="svgIds.hexPattern" width="24" height="21" patternUnits="userSpaceOnUse">
          <path
            d="M6 1.5h12l6 9-6 9H6l-6-9z"
            fill="none"
            stroke="#cdd2d8"
            stroke-opacity="0.36"
            stroke-width="1.5"
          />
        </pattern>
        <linearGradient :id="svgIds.panelSheen" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#4a5052" />
          <stop offset="1" stop-color="#252b2d" />
        </linearGradient>
        <radialGradient :id="svgIds.buttonFace" cx="50%" cy="42%" r="58%">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.95" />
          <stop offset="0.55" stop-color="#ffe875" />
          <stop offset="1" stop-color="#806c22" />
        </radialGradient>
        <filter :id="svgIds.softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#06090b" flood-opacity="0.45" />
        </filter>
      </defs>

      <rect width="920" height="1120" fill="#ced0ca" />
      <rect x="42" y="34" width="836" height="1052" rx="4" fill="#ece7df" />
      <rect
        x="66"
        y="56"
        width="788"
        height="1004"
        rx="2"
        fill="#6a6471"
        :style="{
          opacity: 0.9,
          filter: `drop-shadow(0 0 ${16 + edgeLevel * 36}px ${edgeColor})`
        }"
      />
      <rect x="72" y="62" width="776" height="992" :fill="`url(#${svgIds.hexPattern})`" opacity="0.95" />

      <rect
        x="56"
        y="44"
        width="808"
        height="1036"
        rx="4"
        fill="none"
        stroke-width="18"
        :stroke="edgeColor"
        :opacity="0.16 + edgeLevel * 0.64"
        :style="glowStyle(edgeColor, edgeLevel, 1.25)"
      />
      <rect x="64" y="54" width="792" height="1016" fill="none" stroke="#f6efff" stroke-opacity="0.45" stroke-width="4" />

      <g v-if="box.id !== 'tech-box-2'">
        <path
          d="M148 90h650v392h-674V102q0-12 24-12z"
          :fill="`url(#${svgIds.panelSheen})`"
          stroke="#1c2125"
          stroke-width="7"
          :filter="`url(#${svgIds.softShadow})`"
        />
        <path d="M324 94v132l310 148v100" fill="none" stroke="#171b1f" stroke-width="7" />
        <path d="M332 94v124l310 148v108" fill="none" stroke="#4c5355" stroke-width="2" opacity="0.75" />
        <rect x="150" y="104" width="158" height="364" fill="#31383b" opacity="0.95" />

        <circle cx="355" cy="140" r="19" fill="#090b0d" />
        <circle cx="355" cy="140" r="13" fill="#b6afa1" stroke="#1a1c1f" stroke-width="3" />
        <path d="M355 127v26M342 140h26M346 131l18 18M364 131l-18 18" stroke="#52575b" stroke-width="2" />
        <circle cx="355" cy="196" r="19" fill="#090b0d" />
        <circle cx="355" cy="196" r="13" fill="#b6afa1" stroke="#1a1c1f" stroke-width="3" />
        <path d="M355 183v26M342 196h26M346 187l18 18M364 187l-18 18" stroke="#52575b" stroke-width="2" />
        <text x="406" y="147" fill="#a8aba8" font-size="18" font-weight="700" opacity="0.65">A-37</text>
        <text x="406" y="204" fill="#a8aba8" font-size="18" font-weight="700" opacity="0.65">X-65</text>

        <text x="712" y="122" fill="#111518" font-size="18" font-weight="800" transform="rotate(90 712 122)">S1-064</text>
        <text x="774" y="122" fill="#111518" font-size="18" font-weight="800" transform="rotate(90 774 122)">S1-309</text>
        <circle
          v-for="point in topGreenLights"
          :key="`green-${point.y}`"
          :cx="point.x"
          :cy="point.y"
          r="10"
          fill="#7dff45"
          stroke="#cbff8f"
          stroke-width="2"
          :style="glowStyle('#54ff1f', levels.green, 1.15)"
        />
        <circle
          v-for="point in topOrangeLights"
          :key="`orange-${point.y}`"
          :cx="point.x"
          :cy="point.y"
          r="11"
          fill="#ff9f1a"
          stroke="#ffd35a"
          stroke-width="2"
          :style="glowStyle('#ff7200', levels.orange, 1.15)"
        />
        <rect x="728" y="482" width="70" height="26" rx="8" fill="#07080a" opacity="0.9" />

        <rect
          x="124"
          y="580"
          width="674"
          height="366"
          :fill="`url(#${svgIds.panelSheen})`"
          stroke="#1c2125"
          stroke-width="7"
          :filter="`url(#${svgIds.softShadow})`"
        />
        <path d="M380 946V782l134-160h284" fill="none" stroke="#20262a" stroke-width="8" />
        <path d="M386 946V786l134-156h278" fill="none" stroke="#555b5e" stroke-width="2" opacity="0.55" />

        <path d="M162 852h66v70h-66zM162 852l24-22h42" fill="none" stroke="#91958f" stroke-width="2" opacity="0.7" />
        <text x="182" y="873" fill="#c4c6bf" font-size="22" font-weight="800" opacity="0.75">1K</text>
        <text x="174" y="903" fill="#c4c6bf" font-size="14" font-weight="800" opacity="0.65">R-806-3</text>

        <circle cx="706" cy="714" r="70" fill="#090a0c" stroke="#202427" stroke-width="5" />
        <circle cx="706" cy="714" r="45" fill="#1a1514" stroke="#36383a" stroke-width="8" />
        <g opacity="0.7" transform="translate(706 714)">
          <path
            v-for="index in 16"
            :key="index"
            d="M-4 -64h8l6 30h-20z"
            fill="#07080a"
            :transform="`rotate(${index * 22.5})`"
          />
        </g>
        <circle
          cx="706"
          cy="714"
          r="29"
          fill="#ffb044"
          stroke="#ffc37a"
          stroke-width="7"
          :style="glowStyle('#ff9a38', levels.jelly, 0.8)"
        />
        <text
          x="706"
          y="726"
          text-anchor="middle"
          fill="#6f5a32"
          font-size="34"
          font-weight="900"
          :opacity="0.35 + levels.jelly * 0.65"
        >
          C
        </text>

        <g v-for="button in jellyButtons" :key="`${button.x}-${button.color}`">
          <circle
            :cx="button.x"
            :cy="button.y"
            r="12"
            :fill="button.color"
            :style="glowStyle(button.color, levels.jelly, 0.8)"
          />
        </g>
        <text x="498" y="926" fill="#d7cfb4" font-size="22" font-weight="900">4054 MS</text>
        <text x="636" y="926" fill="#d7cfb4" font-size="22" font-weight="900">4056-TC</text>

        <path
          d="M124 952h674l-14 50H138z"
          fill="#15131b"
          stroke="#08090c"
          stroke-width="4"
        />
        <g v-for="item in railSwitches" :key="item.x">
          <rect :x="item.x" y="970" width="27" height="18" rx="2" :fill="item.color" :style="glowStyle(item.color, levels[item.level], 0.7)" />
          <circle :cx="item.x + 52" cy="979" r="9" fill="#0a90d4" opacity="0.85" />
          <rect :x="item.x + 74" y="968" width="58" height="7" rx="2" fill="#050608" />
          <rect :x="item.x + 74" y="985" width="58" height="7" rx="2" fill="#050608" />
        </g>

        <rect x="126" y="92" width="690" height="390" fill="none" stroke="#687079" stroke-width="3" opacity="0.5" />
        <rect x="123" y="580" width="676" height="368" fill="none" stroke="#687079" stroke-width="3" opacity="0.45" />
      </g>

      <g v-else transform="translate(920 0) rotate(90)">
        <g transform="translate(60 75) scale(0.78)">
        <rect
          x="112"
          y="70"
          width="430"
          height="350"
          rx="4"
          fill="#e7e0d3"
          stroke="#b9b2a5"
          stroke-width="5"
          :filter="`url(#${svgIds.softShadow})`"
        />
        <path d="M132 418h410V246H390L220 418" fill="#ddd7cc" stroke="#aaa497" stroke-width="4" />
        <path d="M220 418L392 250h150" fill="none" stroke="#8d8d88" stroke-width="4" opacity="0.7" />
        <rect
          x="222"
          y="150"
          width="16"
          height="176"
          rx="6"
          fill="#ff1c2e"
          :style="glowStyle('#ff1c2e', levels.topRightRedLine, 1.1)"
        />
        <circle cx="156" cy="358" r="5" fill="#51ff45" :style="glowStyle('#51ff45', levels.topLeftGreen, 0.4)" />
        <rect x="420" y="304" width="46" height="10" rx="5" fill="#aca79d" />

        <g transform="translate(150 500)" opacity="0.88">
          <rect x="0" y="0" width="330" height="20" rx="4" fill="#08090b" />
          <g v-for="index in 5" :key="index" :transform="`translate(${(index - 1) * 64}, -48)`">
            <rect x="0" y="16" width="42" height="54" rx="7" fill="#050607" stroke="#1b1d20" stroke-width="5" />
            <circle cx="21" cy="22" r="7" fill="#111418" />
            <path d="M6 46h30M8 58h26" stroke="#15191d" stroke-width="5" />
          </g>
        </g>

        <rect
          x="650"
          y="70"
          width="430"
          height="430"
          rx="4"
          fill="#e9e2d5"
          stroke="#b9b2a5"
          stroke-width="5"
          :filter="`url(#${svgIds.softShadow})`"
        />
        <rect x="716" y="132" width="126" height="90" rx="3" fill="#050608" />
        <circle cx="738" cy="156" r="16" fill="#ffdf42" :style="glowStyle('#ffdf42', levels.bottomRight, 0.85)" />
        <circle cx="738" cy="202" r="16" fill="#ffdf42" :style="glowStyle('#ffdf42', levels.bottomRight, 0.85)" />
        <rect
          x="792"
          y="140"
          width="58"
          height="28"
          rx="3"
          fill="#00aaff"
          :style="glowStyle('#00aaff', levels.bottomRight, 0.85)"
        />
        <rect
          x="794"
          y="186"
          width="58"
          height="38"
          rx="3"
          fill="#ff1c2e"
          :style="glowStyle('#ff1c2e', levels.bottomRight, 0.85)"
        />
        <g :style="glowStyle('#ff1c2e', levels.bottomRight, 0.65)">
          <circle cx="804" cy="205" r="3" fill="#ffd35a" />
          <circle cx="818" cy="205" r="3" fill="#ffd35a" />
          <circle cx="832" cy="205" r="3" fill="#ffd35a" />
        </g>
        <g transform="translate(690 402)">
          <rect x="0" y="0" width="18" height="70" fill="#d9d3c8" stroke="#c8c0b4" stroke-width="2" />
          <rect x="32" y="-5" width="18" height="75" fill="#d9d3c8" stroke="#c8c0b4" stroke-width="2" />
          <rect x="64" y="-9" width="18" height="79" fill="#d9d3c8" stroke="#c8c0b4" stroke-width="2" />
        </g>

        <g transform="translate(112 520)">
          <rect x="0" y="0" width="500" height="102" rx="3" fill="#e4ddd1" stroke="#b9b2a5" stroke-width="5" />
          <rect x="28" y="18" width="210" height="66" fill="#d3ccc0" stroke="#c0b8aa" stroke-width="3" />
          <circle cx="76" cy="51" r="12" fill="#ff1c2e" :style="glowStyle('#ff1c2e', levels.topLeftRed, 0.9)" />
          <circle cx="142" cy="51" r="12" fill="#51ff45" :style="glowStyle('#51ff45', levels.topLeftGreen, 0.9)" />
          <circle cx="208" cy="51" r="12" fill="#ff1c2e" :style="glowStyle('#ff1c2e', levels.topLeftRed, 0.9)" />
          <rect x="0" y="102" width="500" height="126" fill="#e5ded2" stroke="#b9b2a5" stroke-width="4" />
          <rect x="0" y="220" width="500" height="246" fill="#e9e2d5" stroke="#b9b2a5" stroke-width="5" />
        </g>

        <g transform="translate(650 520)">
          <rect x="0" y="0" width="500" height="102" rx="3" fill="#e4ddd1" stroke="#b9b2a5" stroke-width="5" />
          <rect x="28" y="18" width="210" height="66" fill="#d3ccc0" stroke="#c0b8aa" stroke-width="3" />
          <circle cx="76" cy="51" r="12" fill="#51ff45" :style="glowStyle('#51ff45', levels.bottomLeftGreen, 0.85)" />
          <circle cx="142" cy="51" r="12" fill="#ff9f1a" :style="glowStyle('#ff9f1a', levels.bottomLeftAmber, 0.85)" />
          <circle cx="208" cy="51" r="12" fill="#ff9f1a" :style="glowStyle('#ff9f1a', levels.bottomLeftAmber, 0.85)" />
          <rect x="0" y="102" width="500" height="126" fill="#e5ded2" stroke="#b9b2a5" stroke-width="4" />
          <rect x="0" y="220" width="500" height="246" fill="#e9e2d5" stroke="#b9b2a5" stroke-width="5" />
        </g>
        </g>
      </g>
    </svg>
  </section>
</template>
