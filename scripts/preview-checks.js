import { createApp, h, nextTick, reactive } from 'vue';
import TechBoxPreview from '../src/client/TechBoxPreview.vue';
import { preparePreviewSvg } from '../src/client/preview-svg.js';
import fixtureConfig from '../config/fixtures.json';

const results = [];
function check(condition, message) {
  if (!condition) throw new Error(message);
  results.push(`PASS: ${message}`);
}
const props = reactive({ power: false, frame: Array(512).fill(255), fixtures: structuredClone(fixtureConfig.elements) });
const boxes = ['tech-box-1', 'tech-box-2', 'emerg-stbd-thruster-control', 'tech-box-1', 'light-up-sign'];
createApp({
  render: () => boxes.map((id, index) => h(TechBoxPreview, {
    ...props, key: index, box: { id, label: id }
  }))
}).mount('#previews');

try {
  await nextTick();
  const previews = [...document.querySelectorAll('.tech-box-preview')];
  const roots = previews.map(preview => preview.firstElementChild);
  check(roots.every(root => root.localName === 'svg'), 'All artworks mount as SVG');
  const ids = [...document.querySelectorAll('#previews [id]')].map(node => node.id);
  check(new Set(ids).size === ids.length, 'IDs are unique, including duplicate box previews');
  for (const svg of roots) {
    for (const node of svg.querySelectorAll('*')) {
      for (const attribute of node.attributes) {
        for (const match of attribute.value.matchAll(/url\(#([^)]*)\)/g)) {
          check(svg.contains(document.getElementById(match[1])), 'Gradient/filter reference resolves within its own SVG');
        }
      }
    }
  }
  check(previews.every(preview => [...preview.querySelectorAll('.light')].every(light =>
    getComputedStyle(light).opacity === '0.12')), 'Power off retains the existing dim preview appearance');

  props.power = true;
  await nextTick();
  check([...document.querySelectorAll('.light')].every(light => getComputedStyle(light).opacity === '1'),
    'All light classes respond to a full frame');
  check(roots.every((root, index) => root === previews[index].firstElementChild),
    'Frame updates preserve SVG nodes');
  check(getComputedStyle(previews[0].querySelector('.light-green')).filter !== 'none', 'Live glow CSS is valid');

  // Exercise every independently addressable visible light, with other channels dark.
  const channels = [
    [0, 'green', 1], [0, 'orange', 2], [0, 'jelly', 3], [0, 'switch1', 4], [0, 'switch-bank', 5],
    [1, 'top-right-red-line', 15], [1, 'top-left-red', 16], [1, 'top-left-green', 17],
    [1, 'bottom-left-amber', 18], [1, 'bottom-left-green', 19], [1, 'bottom-right', 20]
  ];
  for (const [index, name, channel] of channels) {
    props.frame = Array(512).fill(0);
    props.frame[channel - 1] = 128;
    await nextTick();
    check([...previews[index].querySelectorAll(`.light-${name}`)].every(light =>
      Math.abs(Number(getComputedStyle(light).opacity) - 128 / 255) < 0.00001), `${name} follows channel ${channel}`);
    check([...previews[index].querySelectorAll(`.light:not(.light-${name})`)].every(light =>
      getComputedStyle(light).opacity === '0.12'), `${name} does not light unrelated shapes`);
  }
  for (const [index, name, channel, expected] of [
    [0, 'edge', 6, 'rgb(255, 0, 0)'], [1, 'edge', 12, 'rgb(0, 255, 0)'],
    [2, 'strip', 23, 'rgb(0, 0, 255)'], [2, 'strip', 24, 'rgb(217, 217, 217)'],
    [2, 'strip', 25, 'rgb(217, 217, 217)']
  ]) {
    props.frame = Array(512).fill(0);
    props.frame[channel - 1] = 255;
    await nextTick();
    check(getComputedStyle(previews[index].querySelector(`.light-${name}`)).stroke === expected,
      `${name} color follows channel ${channel}`);
  }

  const sign = previews[4];
  check(sign.querySelectorAll('.light').length === 10, 'Sign has ten physical strips in six zones');
  for (let zone = 1; zone <= 6; zone += 1) {
    const strips = [...sign.querySelectorAll(`.light-zone-${zone}`)];
    check(strips.length === (zone <= 2 ? 1 : 2), `Zone ${zone} has the correct strip count`);
    for (const [key, expected] of Object.entries({
      red: 'rgb(255, 0, 0)', green: 'rgb(0, 255, 0)', blue: 'rgb(0, 0, 255)', white: 'rgb(217, 217, 217)'
    })) {
      props.frame = Array(512).fill(0);
      props.frame[props.fixtures[`sign-zone-${zone}`].channels[key] - 1] = 255;
      await nextTick();
      check(strips.every(strip => getComputedStyle(strip).stroke === expected && getComputedStyle(strip).opacity === '1'),
        `Zone ${zone} ${key} lights all of its strips`);
      check([...sign.querySelectorAll(`.light:not(.light-zone-${zone})`)].every(strip => getComputedStyle(strip).opacity === '0.12'),
        `Zone ${zone} ${key} leaves other zones off`);
    }
  }
  props.fixtures['sign-zone-1'].channels.red = 500;
  props.frame = Array(512).fill(0);
  props.frame[499] = 255;
  await nextTick();
  check(getComputedStyle(sign.querySelector('.light-zone-1')).stroke === 'rgb(255, 0, 0)',
    'Sign preview follows a changed fixture address');
  props.fixtures['sign-zone-1'].channels.red = fixtureConfig.elements['sign-zone-1'].channels.red;

  props.frames = { 'tech-boxes': Array(512).fill(0), sign: Array(512).fill(0) };
  props.frames.sign[0] = 255;
  props.fixtures['orange-lights'].universe = 'sign';
  props.fixtures['orange-lights'].channels.level = 1;
  props.fixtures['sign-zone-1'].channels.red = 1;
  await nextTick();
  check(getComputedStyle(previews[0].querySelector('.light-orange')).opacity === '1',
    'A box can preview elements from different universes');
  check(getComputedStyle(previews[0].querySelector('.light-green')).opacity === '0.12',
    'Matching channel numbers in other universes stay isolated');
  check(getComputedStyle(sign.querySelector('.light-zone-1')).stroke === 'rgb(255, 0, 0)',
    'Sign preview reads its own universe frame');
  props.frames = {};
  await nextTick();
  check([...document.querySelectorAll('#previews .light')].every(light => getComputedStyle(light).opacity === '0.12'),
    'Missing universe frames stay dark');
  props.frames = null;
  props.fixtures = structuredClone(fixtureConfig.elements);

  const fixture = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <style>.st0 { fill: red; } #face { stroke: blue; } @media all { .st0 { opacity: 0.5; } }</style>
    <defs><linearGradient id="paint"><stop stop-color="red"/></linearGradient><clipPath id="clip"><rect width="10" height="10"/></clipPath></defs>
    <rect id="face" class="st0" width="10" height="10" clip-path="url('#clip')" style="fill: url(#paint)"/>
    <use href="#face"/><use xlink:href="#face"/>
  </svg>`;
  const fixtures = document.querySelector('#fixtures');
  fixtures.innerHTML = preparePreviewSvg(fixture, 'check-a') + preparePreviewSvg(fixture.replace('red', 'green'), 'check-b') +
    '<svg><rect class="st0" width="10" height="10"/></svg>';
  const rect = fixtures.querySelector('#preview-check-a-face');
  check(rect.getAttribute('clip-path') === 'url(#preview-check-a-clip)', 'Editor clip references are rewritten');
  check(rect.style.fill.includes('#preview-check-a-paint'), 'Editor inline gradient references are rewritten');
  check([...fixtures.querySelector('svg').querySelectorAll('use')].every(node =>
    [...node.attributes].some(attribute => attribute.localName === 'href' && attribute.value === '#preview-check-a-face')),
    'Both href and xlink:href references are rewritten');
  check(getComputedStyle(rect).stroke === 'rgb(0, 0, 255)', 'Editor ID selectors still apply');
  check(getComputedStyle(rect).opacity === '0.5', 'Nested editor CSS remains active');
  check(getComputedStyle(fixtures.lastElementChild.firstElementChild).fill === 'rgb(0, 0, 0)',
    'Editor classes do not leak outside their drawing');

  props.power = false;
  props.frame = Array(512).fill(255);
  await nextTick();
  check([...document.querySelectorAll('#previews .light')].every(light => getComputedStyle(light).opacity === '0.12'),
    'Power off clears previously illuminated previews');
  props.power = true;
  props.frame = [];
  await nextTick();
  check([...document.querySelectorAll('#previews .light')].every(light => getComputedStyle(light).opacity === '0.12'),
    'Missing frame channels default to off');
  props.frame = Array(512).fill(255);
  await nextTick();
  document.querySelector('#results').textContent = `${results.length} checks passed.\n${results.join('\n')}`;
} catch (error) {
  document.querySelector('#results').textContent = `${results.join('\n')}\nFAIL: ${error.stack}`;
  throw error;
}
