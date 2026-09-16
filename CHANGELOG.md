# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.2] - 2026-09-16

### Fixed

- The card rebuilt its entire DOM on every state change, which during a print
  is every few seconds as temperatures and the layer counter tick over. That
  detached and re-attached the media element — aborting a chamber camera's
  MJPEG stream each time and repeatedly reopening connections against the
  printer's limited number of simultaneous stream viewers — and dropped focus
  from any control in use, closing an open speed dropdown and clearing the
  caret in a target temperature box. The header, media and body are now
  separate persistent nodes; the media area is only touched when the media
  itself changes, and body updates are held back while a control has focus and
  applied once it is released.
- The image cache key added in 1.1.1 was applied to any URL. It is now limited
  to Home Assistant's own proxy paths, since an extra query parameter corrupts
  a `data:` URI and can invalidate a pre-signed URL.

## [1.1.1] - 2026-09-16

### Fixed

- The cover image kept showing the previous print. Home Assistant builds an
  image entity's `entity_picture` as `/api/image_proxy/<id>?token=<t>` and
  rotates that token on a fixed 5-minute timer, so the URL does not change when
  a new thumbnail arrives — only the entity's state (`image_last_updated`) does.
  The browser therefore served the stale cached image. Media URLs are now keyed
  on that state.
- Pressing *Show camera* appeared to do nothing when the stream could not be
  opened: the card quietly fell back to the cover image. An explicitly
  requested camera that fails now reports the failure, and says so when the
  printer is already at its simultaneous video-stream limit.

### Added

- If the MJPEG stream cannot be opened, the card falls back to a single still
  frame before giving up on the camera — the printer caps simultaneous stream
  viewers, so a still can succeed where the stream cannot.
- A *Try again* button on the camera error, and `video_stream_connected` /
  `video_stream_max` added to the recognised entity keys.

## [1.1.0] - 2026-09-16

First tagged release.

### Added

- Lovelace card for printers exposed by the `elegoo_printer` integration,
  verified against integration v2.12.2.
- Device-scoped entity resolution by registry `unique_id`, `translation_key` and
  entity-ID suffix, with per-entity `entities:` overrides.
- Status header with a colour-coded badge and `sdcp_status` connectivity dot.
- Cover image media area, progress, temperature/speed/fan details, Canvas AMS
  filament slots, and printer controls.
- Confirmation dialogs before actions that can ruin a print — pause, resume,
  stop and homing by default — configurable through `confirm_actions`.
- Opt-in chamber camera via `show_camera` (`never` / `printing` / `always`),
  off by default so nothing streams unless asked for, with a *Show camera*
  button and an explicit stream teardown when hidden.
- Visual editor with a device picker, `getStubConfig`, and card-picker
  registration.
- Test suite covering entity resolution and jsdom rendering, and a Playwright
  tool that regenerates the README screenshots from the shipped card.

[Unreleased]: https://github.com/nict41/HACS-Elegoo-Card/compare/v1.1.2...HEAD
[1.1.2]: https://github.com/nict41/HACS-Elegoo-Card/releases/tag/v1.1.2
[1.1.1]: https://github.com/nict41/HACS-Elegoo-Card/releases/tag/v1.1.1
[1.1.0]: https://github.com/nict41/HACS-Elegoo-Card/releases/tag/v1.1.0
