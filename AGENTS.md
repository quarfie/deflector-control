# AGENTS

Guidance for future coding agents working in this repository.

## Project Intent

This is a greenfield Node/Vue lighting controller for a physical Star Trek corridor tech box. Preserve the central architecture:

- JSON defines fixtures, defaults, modes, and reusable effects.
- The server owns timing, mode evaluation, manual overrides, and DMX frame rendering.
- The client is a mobile-first control surface, not the source of truth.
- OLA remains the DMX transport layer.

Prioritize safe hardware behavior. Startup should remain dark by default unless the user explicitly changes that.

## Important Commands

```sh
npm test
npm run build
npm start
npm run start:dry
npm run start:ola:local
npm run start:ola:pi
```

Use `npm test` for behavior-engine changes and `npm run build` for any client changes.

## Hardware Safety

- Default to dry-run behavior unless the user explicitly asks to send DMX.
- Do not change `powerOnAtStartup` to `true` without explicit user intent.
- Keep global power-off rendering as a zeroed DMX frame.
- Keep unspecified channels zeroed.
- Treat `pizero.local:9090` as a real hardware endpoint.

## Configuration Conventions

- `config/fixtures.json` maps named elements to DMX channels.
- `config/defaults.json` controls startup mode, output defaults, OLA URLs, and frame rate.
- `config/modes.json` contains user-facing looks and animation definitions.
- `config/effects.json` contains reusable generated effect presets.

Prefer changing JSON behavior before hard-coding special cases in JavaScript.

Use compact, JavaScript-friendly keys such as `fade`, `brightness`, `forceOn`, and `forceOff`.

## Behavior Rules

Maintain the layering model:

1. Global power
2. Active mode behavior
3. Per-element manual overrides
4. DMX safety/default output

Manual override expectations:

- Brightness overrides affect the value used when an animation/effect is on.
- Color overrides affect RGBW elements without stopping animation.
- Force on/off overrides animation for that element.
- Mode changes clear manual overrides.
- Power off clears manual overrides.

## Code Organization

- Keep animation math in `src/server/animation.js`.
- Keep generated effects in `src/server/effects.js`.
- Keep semantic state and DMX rendering in `src/server/renderer.js`.
- Keep output transport choices in `src/server/output.js`.
- Keep API and frame loop wiring in `src/server/index.js`.
- Keep UI changes mobile-first in `src/client/App.vue` and related client files.

Avoid moving timing ownership into the browser. The backend should continue to produce the authoritative DMX frame stream.

## Testing Expectations

For logic changes, add or update tests in `test/renderer.test.js`.

At minimum, preserve coverage for:

- Power off produces all zeros.
- Element states render to the expected DMX channels.
- Manual brightness preserves animation timing.
- Force on/off overrides mode behavior.
- Mode changes clear manual overrides.
- Glitch intensity changes rough on/off ratio.
- Output target switching works.

For UI changes, run `npm run build`. If a local server can be started, verify the mobile surface in a browser.

## Style Notes

- This project uses ES modules.
- Keep server runtime dependencies minimal; currently the production server uses Node built-ins.
- Keep JSON readable for hand editing.
- Avoid adding persistence, auth, or database layers unless the user asks for them.
- Prefer clear names tied to the physical prop over generic lighting jargon.
