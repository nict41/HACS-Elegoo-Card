# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-09-16

First release.

### Added

- Lovelace card for printers exposed by the `elegoo_printer` integration,
  verified against integration v2.12.2.
- Device-scoped entity resolution by registry `unique_id`, `translation_key` and
  entity-ID suffix, with per-entity `entities:` overrides.
- Status header with a colour-coded badge and `sdcp_status` connectivity dot.
- Cover image and chamber camera media area, progress, temperature/speed/fan
  details, Canvas AMS filament slots, and printer controls.
- Confirmation dialogs for actions that can ruin a print, configurable through
  `confirm_actions`.
- Opt-in chamber camera (`show_camera`), off by default so nothing streams
  unless asked for.
- Visual editor with a device picker, `getStubConfig`, and card-picker
  registration.
- Test suite covering entity resolution and jsdom rendering.

[Unreleased]: https://github.com/nict41/HACS-Elegoo-Card/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/nict41/HACS-Elegoo-Card/releases/tag/v1.0.0
