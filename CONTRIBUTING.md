# Contributing

Thanks for taking an interest in this card.

## Getting set up

```bash
git clone https://github.com/nict41/HACS-Elegoo-Card.git
cd HACS-Elegoo-Card
npm install   # jsdom, for the render tests
npm test
```

There is **no build step**. `dist/elegoo-printer-card.js` is hand-authored plain
JavaScript and is what ships, so edit it directly and keep it dependency-free —
HACS loads it as raw JS in the browser.

## Testing your change

```bash
npm test                 # both suites
npm run test:resolution  # entity lookup, no dependencies needed
npm run test:render      # jsdom render + interaction tests
```

Please add a case to the suite for any behaviour you change. `test/render.test.js`
shows the pattern: build a mock `hass`, render the card, assert on the shadow DOM
and on the service calls each control fires.

To try it against real Home Assistant, copy `dist/elegoo-printer-card.js` into
`<config>/www/` and add it as a Lovelace resource.

## If the integration changes

The card is pinned to the `elegoo_printer` integration's entity keys, captured
from its `definitions.py`. If a new integration release adds or renames keys, the
only place that needs updating is `KEY_DEFS` at the top of
`dist/elegoo-printer-card.js`. Each entry needs:

- the integration's `key` (which is also the `unique_id` suffix),
- the entity `domain`,
- `names`: the slugified display name, when it differs from the key,
- `tkey`: the `translation_key`, if the entity has one.

Please note the integration version you checked against in your PR.

## Screenshots

README screenshots are generated from the real card, not mocked up:

```bash
npm install -D playwright
node tools/screenshot.mjs
```

## Style

- Match the surrounding code: no framework, no build tooling, no new runtime
  dependencies.
- Use Home Assistant CSS custom properties rather than fixed colours, so the card
  follows the user's theme.
- Every entity lookup must tolerate the entity being missing or `unavailable`.
