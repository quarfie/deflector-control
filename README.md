# Deflector Control

Mobile-friendly lighting control for a Star Trek: Strange New Worlds corridor tech box. The app runs a local Node.js controller, renders Vue 3 controls for a phone browser, and sends DMX frames through OLA.

The current setup assumes:

- OLA universe: `1`
- Controlled DMX channels: `1-9`
- Raspberry Pi OLA endpoint: `http://pizero.local:9090`
- Local OLA endpoint: `http://localhost:9090`
- Safe startup output: dry run, with all lights off until power is enabled

## What It Does

- Provides a mobile web UI for power, mode selection, and manual overrides.
- Evaluates configured lighting modes from JSON.
- Supports dimmer elements and RGBW edge lights.
- Generates animated modes including normal, red alert, and damage/glitch flicker.
- Can send DMX frames to local OLA, the Pi's OLA instance, or dry-run logging.

## Project Structure

```txt
config/
  defaults.json   Runtime defaults, OLA URLs, frame rate, startup behavior
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

test/
  renderer.test.js
```

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

## Test With OLA On The Pi

If your laptop can reach the Pi on the same network, you can run the app locally and send frames to OLA on the Pi.

```sh
npm run build
npm start
```

Open the app, then choose `Pi OLA` from the Output selector. This targets:

```txt
http://pizero.local:9090
```

You can also start directly in Pi OLA mode:

```sh
npm run start:ola:pi
```

For local OLA on the same machine:

```sh
npm run start:ola:local
```

## Output Modes

The app has three output choices:

- `Dry Run`: evaluates frames but does not send DMX.
- `Local OLA`: sends frames to `http://localhost:9090/set_dmx`.
- `Pi OLA`: sends frames to `http://pizero.local:9090/set_dmx`.

The default URLs live in `config/defaults.json`.

Environment variables can override startup output:

```sh
DMX_OUTPUT=dry-run npm start
DMX_OUTPUT=ola OLA_URL=http://pizero.local:9090 npm start
PORT=3001 npm start
HOST=127.0.0.1 npm start
```

## Editing Lighting Behavior

Most creative changes should happen in JSON:

- Add or rename elements in `config/fixtures.json`.
- Change startup behavior, frame rate, or OLA URLs in `config/defaults.json`.
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
OLA_URL=http://localhost:9090
```

That means no DMX is sent at startup. To use the connected lights, open `http://pizero.local/` and choose `Local OLA` from the Output selector. Keep `powerOnAtStartup` set to `false` in `config/defaults.json` unless you intentionally want the prop to light immediately when the app starts.

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
