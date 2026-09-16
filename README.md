<p align="center">
  <img src="https://raw.githubusercontent.com/nict41/HACS-Elegoo-Card/main/assets/banner.png" alt="Elegoo Printer Card" width="820">
</p>

<p align="center">
  <a href="https://github.com/hacs/integration"><img src="https://img.shields.io/badge/HACS-Custom-41BDF5.svg" alt="HACS custom repository"></a>
  <a href="https://github.com/nict41/HACS-Elegoo-Card/releases"><img src="https://img.shields.io/github/v/release/nict41/HACS-Elegoo-Card" alt="Latest release"></a>
  <a href="https://github.com/nict41/HACS-Elegoo-Card/actions/workflows/validate.yml"><img src="https://github.com/nict41/HACS-Elegoo-Card/actions/workflows/validate.yml/badge.svg" alt="Validate"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/nict41/HACS-Elegoo-Card" alt="MIT licence"></a>
</p>

A Lovelace card for 3D printers exposed by the
[**elegoo_printer**][integration] Home Assistant integration — status, camera,
print progress, filament slots and controls in a single card.

> This repository is a **frontend plugin only**. It does not contain, bundle or
> replace the integration. Install [danielcherubini/elegoo-homeassistant][integration]
> first; this card just renders the entities that integration creates.

<p align="center">
  <img src="https://raw.githubusercontent.com/nict41/HACS-Elegoo-Card/main/docs/images/card-printing-dark.png" alt="The card while printing, dark theme" width="340">
  <img src="https://raw.githubusercontent.com/nict41/HACS-Elegoo-Card/main/docs/images/card-idle-light.png" alt="The card while idle, light theme" width="340">
</p>

<p align="center">
  <em>Printing (dark theme) and idle (light theme). Sample data; the media area
  shows placeholder artwork rather than a real camera feed.</em>
</p>

---

## Features

- **Status header** — printer name plus a colour-coded badge (idle / printing /
  paused / error / complete) and a connectivity dot driven by `sdcp_status`.
- **Media** — the job's cover image, plus the chamber camera on demand. The
  camera is **off by default** so nothing streams unless you ask for it; a
  *Show camera* button reveals it, and hiding it tears the stream back down.
  The whole area disappears if the printer has neither entity.
- **Progress** — progress bar, filename, layer counter, `Xh Ym remaining`,
  start time and ETA.
- **Details** — nozzle / bed / enclosure / UV-LED / vat temperatures with their
  targets, current print speed and fan speeds.
- **Filament** — the active filament colour, plus a swatch + name chip for each
  populated Canvas (AMS) slot A1–A4, with the loaded slot highlighted.
- **Controls** — pause / resume / stop, homing, speed preset dropdown, fan
  toggles and speed sliders, chamber light, and nozzle/bed target temperature
  inputs.
- **Confirmation before anything destructive** — pause, resume, stop and homing
  ask first, so a misplaced tap cannot ruin a 14-hour print. Configurable, and
  any other control can be added to the list.
- **Works on any printer variant.** Resin and FDM, V1/MQTT, V3/SDCP and CC2 all
  expose different subsets of entities. Every row and control only renders if
  its entity actually exists and is available — nothing is assumed.
- **Theme-aware** — built entirely on Home Assistant's CSS custom properties, so
  it follows your light/dark theme.
- **No dependencies.** One ~59 KB plain-JavaScript file. Nothing to build.

## Installation

### HACS (recommended)

The card is not yet in the HACS default store, so add it as a custom repository:

1. Open **HACS**.
2. Menu (⋮ top-right) → **Custom repositories**.
3. Repository: `https://github.com/nict41/HACS-Elegoo-Card` — Type: **Dashboard**.
4. **Add**, then find **Elegoo Printer Card** in the list and **Download**.
5. Reload your browser (Ctrl/Cmd + Shift + R).

HACS registers the Lovelace resource for you. If it does not, add it manually as
described below.

### Manual

1. Download `elegoo-printer-card.js` from the [latest release][release-url].
2. Copy it to `<config>/www/community/hacs-elegoo-card/elegoo-printer-card.js`.
3. Add the resource — **Settings → Dashboards → ⋮ → Resources → Add resource**:
   - URL: `/local/community/hacs-elegoo-card/elegoo-printer-card.js`
   - Type: **JavaScript module**
4. Reload your browser (Ctrl/Cmd + Shift + R).

## Usage

Add **Elegoo Printer Card** from the dashboard's **Add Card** picker and choose
your printer — that is all most setups need. The visual editor has a device
picker plus toggles for each section.

### Minimal YAML

```yaml
type: custom:elegoo-printer-card
device_id: 1f9a0c3b7d2e4f5a6b8c9d0e1f2a3b4c
```

You can find the `device_id` in the URL of the device's page under
**Settings → Devices & services → Elegoo Printer**.

### All options

| Option          | Type    | Default             | Description                                                              |
| --------------- | ------- | ------------------- | ------------------------------------------------------------------------ |
| `device_id`     | string  | auto                | The printer's device. If omitted and you have exactly one Elegoo printer, it is detected automatically. |
| `name`          | string  | device name         | Override the title.                                                      |
| `show_media`    | boolean | `true`              | Show the cover image / camera area.                                      |
| `show_progress` | boolean | `true`              | Show the progress bar and job details.                                   |
| `show_details`  | boolean | `true`              | Show the temperature / speed / fan grid.                                 |
| `show_filament` | boolean | `true`              | Show the filament and Canvas slot chips.                                 |
| `show_controls` | boolean | `true`              | Show the controls section.                                               |
| `show_camera`   | string  | `never`             | When to show the chamber camera: `never`, `printing` or `always`. See below. |
| `camera_live`   | boolean | `true`              | Use the live MJPEG stream. Set `false` for lighter periodic snapshots.    |
| `confirm_actions` | boolean or list | `true`    | Confirm before print-affecting actions. See below.                       |
| `entities`      | map     | –                   | Per-entity overrides — see below.                                        |

### The camera

A visible camera streams for as long as the card is on screen, which is a real
cost on a dashboard you leave open. So it is off by default:

```yaml
show_camera: never      # default — a "Show camera" button reveals it on demand
show_camera: printing   # stream automatically while printing, cover image otherwise
show_camera: always     # always prefer the camera over the cover image
```

With `never`, pressing *Show camera* starts the stream and *Hide camera* stops
it — the card clears the image source, so the connection really does close
rather than carrying on in the background.

`camera_live: false` swaps the MJPEG stream for periodic still snapshots, which
is lighter again.

### Confirmations

By default the card asks before anything that could wreck a running print:
`pause_print`, `resume_print`, `stop_print` and the four homing buttons. Cancel
is focused when the dialog opens, so a stray Enter dismisses it.

```yaml
confirm_actions: false                        # never ask
confirm_actions: [stop_print]                 # only ask before stopping
confirm_actions: [stop_print, target_nozzle_temp, print_speed]
```

Any key from the table below can be listed, including the fans, the chamber
light and the speed and temperature inputs. Cancelling an input puts it back to
the printer's actual value.

### Fully specified example

```yaml
type: custom:elegoo-printer-card
device_id: 1f9a0c3b7d2e4f5a6b8c9d0e1f2a3b4c
name: Workshop Centauri
show_camera: printing
confirm_actions: [stop_print]
show_filament: false
```

### Overriding individual entities

The card works out which entity backs each integration key by itself. If you
have renamed something, or a future integration release moves a key, you can
pin any of them explicitly. Keys not listed are still resolved automatically.

```yaml
type: custom:elegoo-printer-card
device_id: 1f9a0c3b7d2e4f5a6b8c9d0e1f2a3b4c
entities:
  nozzle_temp: sensor.my_printer_hotend
  chamber_camera: camera.workshop_cam
```

The key names are the integration's own keys — see the table below.

## How entities are found

Entities from this integration are per-device with `has_entity_name`, so their
entity IDs depend on the name **you** gave the printer during setup. The card
therefore never matches on a hardcoded entity ID. It scopes every lookup to the
configured device and identifies each entity by, in order of preference:

1. its registry **`unique_id`**, which the integration builds as
   `f"{machine_id}_{key}"` — rename-proof, but readable only by admin users;
2. its **`translation_key`**, set on the enum sensors;
3. its **entity ID suffix**, matched against the key and against the key's known
   display-name slug (the two often differ — key `nozzle_temp` is named
   "Nozzle Temperature", key `box_fan` is named "Enclosure Fan").

Matches are scoped by domain and resolved longest-token-first, so near-collisions
like `sensor.*_bed_temperature` vs `number.*_target_bed_temp`, and
`sensor.*_print_speed` vs `select.*_print_speed`, land on the right entity.

If you are signed in as a non-admin user, step 1 is unavailable and the card
falls back to steps 2–3. Both paths are covered by the test suite.

### Recognised keys

Built against **elegoo_printer v2.12.2**. Not every printer exposes every key.

| Area          | Keys                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Status        | `current_status`, `print_status`, `print_error`, `current_print_error_status_reason`                                          |
| Job           | `filename`, `percent_complete`, `current_layer`, `total_layers`, `remaining_layers`, `current_ticks`, `total_ticks`, `ticks_remaining`, `begin_time`, `end_time` |
| Temperatures  | `nozzle_temp`, `bed_temp`, `temp_of_box`, `temp_of_uvled`, `vat_temp`, `vat_temp_target`                                      |
| Fans / speed  | `model_fan_speed`, `aux_fan_speed`, `box_fan_speed`, `print_speed_pct`                                                        |
| Connectivity  | `sdcp_status`, `ams_connected`, `video_stream_connected`, `video_stream_max`                                                                                                |
| Media         | `cover_image`, `chamber_camera`                                                                                               |
| Filament      | `active_filament_color`, `active_tray_id`, `a1..a4_color`, `a1..a4_name`, `a1..a4_attributes`                                  |
| Controls      | `second_light`, `print_speed`, `target_nozzle_temp`, `target_bed_temp`, `pause_print`, `resume_print`, `stop_print`, `home_all`, `home_x`, `home_y`, `home_z`, `model_fan`, `auxiliary_fan`, `box_fan` |

## Troubleshooting

**"No elegoo_printer devices were found"** — the integration is not installed or
has no configured printers. Check **Settings → Devices & services**.

**A row or control is missing.** That entity does not exist for your printer
model, or it is currently `unavailable`. The pause/resume/stop buttons are gated
by the integration itself; the card disables them rather than guessing when they
apply. Resin printers have no nozzle/bed, V1/MQTT printers have no homing
buttons, and the Canvas slots only exist on CC2 printers with an AMS.

**Pressing *Show camera* reports "Camera unavailable".** The printer allows
only a limited number of simultaneous video viewers. If the card says it is
serving *n of n* streams, close another viewer (the Elegoo app, a browser tab,
another dashboard) and press *Try again*. The card tries the live stream first
and falls back to a single still frame before reporting failure.

**There is no camera.** That is the default — set `show_camera` to `printing`
or `always`, or press *Show camera* on the card.

**The camera area disappeared.** The card hides the media area if the image
fails to load, so an offline camera does not leave a broken image behind. It
retries when the proxy token next rotates.

**Something resolved to the wrong entity.** Pin it with an `entities` override
and please [open an issue][issues] so the lookup table can be fixed.

## Development

```bash
npm install   # only needed for the jsdom-based render tests
npm test
```

`dist/elegoo-printer-card.js` is hand-authored and shipped as-is — there is no
build step, so edit it directly. `test/resolution.test.js` runs without any
dependencies and covers the entity lookup against a simulated registry for both
admin and non-admin users; `test/render.test.js` renders the card in jsdom
across idle / printing / paused / error / offline / resin / all-unavailable
scenarios and asserts the service calls each control fires.

If a future integration release renames or adds entity keys, the one place to
update is `KEY_DEFS` at the top of `dist/elegoo-printer-card.js`. See
[CONTRIBUTING.md](CONTRIBUTING.md).

The README screenshots are generated from the real card rather than mocked up:

```bash
npm install -D playwright
npm run screenshots
```

## Screenshots

| Printing (dark) | Idle (light) | Confirmation |
| --- | --- | --- |
| <img src="https://raw.githubusercontent.com/nict41/HACS-Elegoo-Card/main/docs/images/card-printing-dark.png" alt="Printing, dark theme" width="230"> | <img src="https://raw.githubusercontent.com/nict41/HACS-Elegoo-Card/main/docs/images/card-idle-light.png" alt="Idle, light theme" width="230"> | <img src="https://raw.githubusercontent.com/nict41/HACS-Elegoo-Card/main/docs/images/card-confirm-dark.png" alt="Stop confirmation dialog" width="230"> |

## Credits

- [danielcherubini/elegoo-homeassistant][integration] — the integration that
  makes all of this possible.

This card is an independent community project. It is not affiliated with,
endorsed by, or supported by Elegoo or by the integration's authors. "Elegoo" is
a trademark of its owner and is used here only to say what the card works with.
The logo and artwork in this repository are original to this project.

## License

[MIT](LICENSE)

[integration]: https://github.com/danielcherubini/elegoo-homeassistant
[issues]: https://github.com/nict41/HACS-Elegoo-Card/issues
[release-url]: https://github.com/nict41/HACS-Elegoo-Card/releases
