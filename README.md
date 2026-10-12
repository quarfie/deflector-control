# Deflector Control

Mobile-friendly lighting control originally created for a Star Trek: Strange New Worlds corridor tech box that I bought at auction from the set on May 30, 2026. The app runs a local Node.js controller, renders Vue 3 controls for a phone browser, and sends DMX frames through OLA.

The current setup assumes:

- OLA universe: `1` on each host (`pizero.local` for tech boxes, `pifive.local` for the sign)
- Tech box channels: `1–25` (10 unused); sign channels: `1–24` on its own universe
- Raspberry Pi OLA endpoint: `http://pizero.local:9090`
- Local OLA endpoint: `http://localhost:9090`
- Safe startup output: dry run, with all lights off until power is enabled

## What It Does

- Provides a mobile web UI for power, mode selection, and manual overrides.
- Evaluates configured lighting modes from JSON.
- Supports dimmer elements and RGBW edge lights.
- Generates animated modes including normal, red alert, and damage/glitch flicker.
- Routes elements to configured OLA universes, with a global dry-run/live switch.

## Project Structure

```txt
config/
  defaults.json   Runtime defaults, frame rate, startup behavior
  universes.json  Output types, OLA destinations, universe numbers and channel counts
  fixtures.json   DMX channel map and named lighting elements
  modes.json      Normal, red alert, damage, and other mode definitions
  effects.json    Reusable generated effect presets

src/server/
  index.js        HTTP API, static app serving, SSE updates, frame loop
  renderer.js     Semantic element state to DMX frame rendering
  animation.js    Timeline animation evaluator
  effects.js      Generated effects such as glitch and pulse
  output.js       Dry-run and OLA output adapters

src/client/
  App.vue         Mobile control UI
  artwork/        Editable SVG drawings, one per box

test/
  renderer.test.js
```

## Editing the box artwork

Open a file from `src/client/artwork/` directly in your SVG editor:

- `tech-box-1.svg`
- `tech-box-2.svg`
- `emerg-stbd-thruster-control.svg`
- `light-up-sign.svg`

These are standalone drawings: all repeated objects are real shapes, and there
is no Vue syntax in the files. Edit geometry, text, fills, strokes, and groups,
then save back to the same SVG file. Keep the `viewBox` (or adjust it deliberately
if changing the canvas). The app scales the drawing to fit the phone screen.
Save as SVG with editable vector objects; avoid export settings that rasterize,
flatten, or strip class attributes. Embed any added images instead of linking to
local files. The artwork is trusted application code, so use your own local files.

Illuminated objects carry `light`, a functional class, and an optional glow scale
class. Preserve those classes when editing or duplicating a light. For example:

```xml
<circle class="light light-green glow-scale-115"
        cx="706" cy="230" r="10" fill="#7dff45" color="#54ff1f" />
```

`fill` controls the face color; the SVG `color` attribute controls the glow color.
Both can be edited without changing Vue. `glow-scale-115` means a glow scale of
1.15; omitting a scale class uses 1. Existing scale classes are defined in
`src/client/preview-lighting.css`. Keep lighting classes on the individual light
faces, or on a group containing only the shapes that should dim together. Avoid
putting them on both a group and its children, which compounds the opacity.

| Drawing | Functional lighting classes |
| --- | --- |
| All boxes | `light-edge` |
| Tech Box 1 | `light-green`, `light-orange`, `light-jelly`, `light-switch1`, `light-switch-bank` |
| Tech Box 2 | `light-top-right-red-line`, `light-top-left-red`, `light-top-left-green`, `light-bottom-left-amber`, `light-bottom-left-green`, `light-bottom-right` |
| Thruster control | `light-strip` |
| Light-Up Sign | `light-zone-1` through `light-zone-6` |

Preserve `edge-panel` for the backing glow and `jelly-label` for the central
button lettering. Edge and strip stroke/glow colors come from the live DMX frame;
sign zone stroke/glow colors also follow their RGBW frames. Ordinary lights keep
their authored colors. The app owns opacity and glow on
marked objects and overrides editor-exported values for those properties.
Static drawing details remain editable. Standalone editor views show the base
artwork, without the app's live dimming and glow.

The Vue wrapper imports the files as text and embeds them inline. It supplies
lighting through CSS variables, without rebuilding the SVG on each frame.
Gradient, filter, clip, and use references are namespaced per preview; exported
CSS rules are scoped to their drawing. You do not need to rename these IDs
between files. Keep IDs unique within each SVG and preserve their references.

With `npm run dev`, saving an SVG updates the preview. For the normal server,
run `npm run build` and refresh the page after saving. To check the lighting
bindings and common editor exports without running a controller, open
`/test/preview.html` on the development server. It runs browser checks and shows
the drawings at a narrow mobile width. `npm test` runs the server behavior tests.

### Light-Up Sign

The sign has six RGBW fixtures. Zone 1 is the outer border, zone 2 is the inner
border, and zones 3–6 each control two curved strips together. Both paths in a
pair share the same `light-zone-N` class. The SVG also has static dark tube beds;
move those along with the light faces when changing their geometry.

| Zone | Reference photo color | DMX channels (R, G, B, W) |
| --- | --- | --- |
| 1 | Purple | 1–4 |
| 2 | Red | 5–8 |
| 3 | Green | 9–12 |
| 4 | Blue | 13–16 |
| 5 | Yellow | 17–20 |
| 6 | Light blue | 21–24 |

The photo colors identify the zones only. Normal uses dedicated white channels
steadily at 75% brightness. Red Alert chases red through zones 1–6 (0.2 seconds per zone, a 1.2-second loop);
Damage uses the reference colors with the existing glitch effect. Each zone
has independent RGB color, white level, brightness, and force on/off controls.
White adds to RGB and is scaled by the zone's brightness. Changing RGB preserves
the white level; changing white preserves RGB. The SVG preview reads its channel
assignments from `config/fixtures.json`. Restart the backend after changing that
configuration. Startup stays powered off and dry-run remains the default output.

## Install

```sh
npm install
```

Node 18 or newer is expected.

## Run Locally

Build the client:

```sh
npm run build
```

Start in safe dry-run mode:

```sh
npm run start:dry
```

Then open:

```txt
http://localhost:3000
```

## Universes and Output Modes

Configure destinations in `config/universes.json`. The initial universes are:

| ID | Type | OLA URL | OLA universe |
| --- | --- | --- | --- |
| `tech-boxes` | `ola` | `http://pizero.local:9090` | 1 |
| `sign` | `ola` | `http://pifive.local:9090` | 1 |

Every element in `config/fixtures.json` has a `universe` reference. A box may
contain elements from different universes; channels may be reused across universes.
The sign uses channels 1–24 on its own universe; tech box addresses stay unchanged. Both
universes send 512-channel frames so all unassigned channels are explicitly zero.
OLA universe numbers are local to each host, so both hosts can use universe 1.

Only the `ola` transport type is currently implemented. Future WLED, display, or
pixel adapters can dispatch using the universe `type`; unsupported types fail
validation rather than being treated as OLA. Invalid references, out-of-range
channels, duplicate channels within a universe, and duplicate destinations also
fail at startup. Restart the server after editing configuration.

The output button toggles between:

- **Dry Run**: computes previews and logs frames without sending hardware output.
- **Live**: sends each universe to its configured host, independently.

Switching to dry run stops sending new frames; hardware may retain its last look.
To leave hardware dark, turn power off while live before switching to dry run.
Startup remains dry-run with power off. Live startup is available explicitly:

```sh
npm run start:live
```

Startup overrides:

```sh
DMX_OUTPUT=dry-run npm start
DMX_OUTPUT=live npm start
PORT=3001 npm start
HOST=127.0.0.1 npm start
```

The previous `start:ola:local`, `start:ola:pi`, and global `OLA_URL` override are
replaced by universe configuration and `start:live`. To use local OLA, edit the
specific universe's `olaUrl`.

## Global and Unit Modes

The **Global mode** selector offers Normal, Red Alert, and Damage. Each physical
unit also has a mode selector underneath it; switch the preview to select a unit.
**Adopt global** follows the global selection and its animation timing. Selecting
an explicit mode keeps that unit independent, even when the global mode changes.
Returning to Adopt global immediately rejoins the global animation in sync.

Each box in `config/fixtures.json` has `defaultMode: "global"` for startup. Set
that field to a mode ID available to the box to give it an independent startup
mode. All four units currently adopt global. These selections are runtime state;
restarting restores the configured defaults. Power off keeps mode selections but
clears manual overrides and renders zero on every universe.

Modes in `config/modes.json` without a `boxes` field are available globally and
on every unit. Add `"boxes": ["light-up-sign"]` to restrict a mode to that unit's
selector. Such modes cannot be selected globally or by another unit. Unit mode
changes clear manual overrides only for that unit; global mode changes clear
overrides only for units adopting global. Independent units keep their timing.

The sign adds four animation modes:

- **Slow Breath**: all zones breathe together over 12 seconds, at 20–100% of their brightness setting.
- **Gentle Wave**: a 16-second wave travels across zones, at 25–100% brightness.
- **Quiet Shimmer**: zones drift independently over 7–13 seconds, at 40–100% brightness.
- **Spectrum Drift**: a 60-second color-wheel cycle, with adjacent zones offset by 0.035 cycles (12.6°).

The sign also offers **Red Alert B**, which builds zones on in order 6–5–4–3–2–1
and then clears them in that same order (0.2 seconds per step, 2.4-second loop).
**Red Alert C** alternates zones 1 and 2 every 0.4 seconds while zones 3–4–5–6–5–4
chase back and forth every 0.2 seconds. The inner loop takes 1.2 seconds;
both groups realign every 2.4 seconds. Both variants use
short 0.03-second fades and are available only in the sign's unit selector.

The first three animate white using pulse effects. Spectrum Drift uses a
`spectrum` effect with `period` in seconds and `phase` as a fraction of a cycle.
These modes never blink off. Base brightness remains 75%. Manual brightness
scales the animated color; a manual color overrides the spectrum for that zone
until cleared, then it rejoins the current color cycle.

The API keeps `POST /api/mode` for the global selection and adds
`POST /api/boxes/:boxId/mode` with `{ "mode": "global" }` or an available mode ID.
State includes `boxModes`; client configuration includes each box's available modes.

## Editing Lighting Behavior

Most creative changes should happen in JSON:

- Add or rename elements in `config/fixtures.json`.
- Change startup behavior or frame rate in `config/defaults.json`.
- Configure output destinations and types in `config/universes.json`.
- Adjust normal/red-alert/damage looks in `config/modes.json`.
- Tune reusable generated effects in `config/effects.json`.

Element states separate animation from output:

- `on`: whether the mode/effect says the light is active
- `brightness`: scalar brightness from `0` to `1`
- `color`: RGB/RGBW color for color-capable elements
- `effect`: generated behavior such as glitch

Manual overrides in the UI layer on top of the active mode:

- Manual brightness changes preserve animation timing.
- Manual color changes preserve animation timing.
- Manual on/off forces the element on or off until cleared.
- Changing modes clears manual overrides.

## DMX Channel Map

| Channel | Element |
| --- | --- |
| 1 | Green lights |
| 2 | Orange lights |
| 3 | Jelly bean buttons |
| 4 | Switch 1 |
| 5 | Switch bank |
| 6 | Edge red |
| 7 | Edge green |
| 8 | Edge blue |
| 9 | Edge white |
| 10 | Unused |

## Tests

```sh
npm test
```

The tests cover animation timing, DMX rendering, global power safety, manual overrides, mode-change behavior, glitch intensity, and output switching.

## Raspberry Pi Notes

OLA should already be running on the Pi with Universe 1 configured for the FTDI USB DMX interface. The app sends HTTP requests to OLA's `/set_dmx` endpoint and does not talk to the USB DMX adapter directly.

The deployment scripts assume:

- SSH target: `pi@pizero.local`
- App directory on the Pi: `/home/pi/deflector-control`
- App URL: `http://pizero.local/`
- Local OLA URL on the Pi: `http://localhost:9090`

First deploy the app from this machine:

```sh
scripts/deploy-pi.sh
```

The deploy script runs tests and `npm run build` locally, then copies the built `dist/client` output to the Pi. This avoids running Vite's native build tooling on the Pi Zero while still running the server tests on the Pi before restart.

Then install and start the boot service on the Pi:

```sh
ssh pi@pizero.local 'cd /home/pi/deflector-control && scripts/install-pi-service.sh'
```

Future changes can be deployed with the same deploy command:

```sh
scripts/deploy-pi.sh
```

The service starts automatically on boot, serves the front end and API on port `80`, and starts in dry-run mode:

```txt
PORT=80
HOST=0.0.0.0
DMX_OUTPUT=dry-run
```

That means no DMX is sent at startup. To use the connected lights, open `http://pizero.local/` and choose `Live` from the output toggle. Keep `powerOnAtStartup` set to `false` in `config/defaults.json` unless you intentionally want the prop to light immediately when the app starts.

Useful service commands:

```sh
ssh pi@pizero.local 'sudo systemctl status deflector-control.service'
ssh pi@pizero.local 'sudo journalctl -u deflector-control.service -f'
ssh pi@pizero.local 'sudo systemctl restart deflector-control.service'
```

If you need to override the SSH target or deploy directory, set environment variables before running the deploy script:

```sh
PI_TARGET=pi@raspberrypi.local PI_APP_DIR=/home/pi/deflector-control scripts/deploy-pi.sh
```
