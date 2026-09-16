/**
 * Render dist/elegoo-printer-card.js in Chromium against a mock `hass` and
 * capture the README screenshots.
 *
 *   node tools/screenshot.mjs
 *
 * Needs Playwright (`npm install -D playwright`). The card is loaded exactly as
 * Home Assistant loads it, so the screenshots always match the shipped code.
 * Sample data lives in tools/fixture.mjs.
 */
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (_err) {
  console.error(
    "This tool needs Playwright, which is not a project dependency.\n" +
      "  npm install -D playwright"
  );
  process.exit(1);
}
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHass } from "./fixture.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "docs/images");
mkdirSync(out, { recursive: true });

const PREVIEW_ORIGIN = "http://localhost:8123";
const png = (file) => readFileSync(resolve(root, file));

// Home Assistant's default theme variables, so the card is styled exactly as it
// is on a real dashboard.
const THEMES = {
  light: {
    "--primary-text-color": "#212121",
    "--secondary-text-color": "#727272",
    "--disabled-text-color": "#bdbdbd",
    "--text-primary-color": "#ffffff",
    "--primary-color": "#03a9f4",
    "--card-background-color": "#ffffff",
    "--ha-card-background": "#ffffff",
    "--secondary-background-color": "#e5e5e5",
    "--divider-color": "rgba(0,0,0,0.12)",
    "--state-icon-color": "#44739e",
    "--error-color": "#db4437",
    "--warning-color": "#ffa600",
    "--success-color": "#43a047",
    "--info-color": "#039be5",
    "--page-background": "#fafafa",
    "--card-shadow": "0 2px 2px 0 rgba(0,0,0,0.14), 0 1px 5px 0 rgba(0,0,0,0.12)",
  },
  dark: {
    "--primary-text-color": "#e1e1e1",
    "--secondary-text-color": "#9b9b9b",
    "--disabled-text-color": "#6f6f6f",
    "--text-primary-color": "#ffffff",
    "--primary-color": "#03a9f4",
    "--card-background-color": "#1c1c1c",
    "--ha-card-background": "#1c1c1c",
    "--secondary-background-color": "#2c2c2c",
    "--divider-color": "rgba(225,225,225,0.12)",
    "--state-icon-color": "#7a9ec2",
    "--error-color": "#ff5252",
    "--warning-color": "#ffa600",
    "--success-color": "#5cb85c",
    "--info-color": "#39a7e0",
    "--page-background": "#111111",
    "--card-shadow": "0 2px 2px 0 rgba(0,0,0,0.5)",
  },
};

const shell = (theme) => `<!doctype html><html><head><meta charset="utf-8"><style>
  ${Object.entries(THEMES[theme]).map(([k, v]) => `:root{${k}:${v}}`).join("")}
  html,body{margin:0;background:var(--page-background);
    font-family:Roboto,system-ui,-apple-system,"Segoe UI",sans-serif;
    -webkit-font-smoothing:antialiased;}
  #frame{padding:24px;width:440px;box-sizing:border-box;}
  /* ha-card is provided by Home Assistant; mirror its shape for the capture */
  ha-card{display:block;position:relative;border-radius:12px;
    background:var(--ha-card-background);box-shadow:var(--card-shadow);
    color:var(--primary-text-color);overflow:hidden;}
</style></head><body><div id="frame"></div></body></html>`;

const SHOTS = [
  { name: "card-printing-dark", theme: "dark", scenario: "printing", config: { show_camera: "always" } },
  { name: "card-idle-light", theme: "light", scenario: "idle", config: {} },
  { name: "card-confirm-dark", theme: "dark", scenario: "printing", config: {}, action: "confirm-stop" },
];

const browser = await chromium.launch();
for (const shot of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 440, height: 1200 }, deviceScaleFactor: 2 });

  // Serve the page from a real origin so the card's root-relative media URLs
  // resolve, and fulfil those requests with the placeholder artwork.
  await page.route(`${PREVIEW_ORIGIN}/`, (route) =>
    route.fulfill({ contentType: "text/html", body: shell(shot.theme) })
  );
  await page.route("**/api/image_proxy/**", (route) =>
    route.fulfill({ contentType: "image/png", body: png("tools/preview-cover.png") })
  );
  await page.route("**/api/camera_proxy_stream/**", (route) =>
    route.fulfill({ contentType: "image/png", body: png("tools/preview-chamber.png") })
  );
  await page.route("**/api/camera_proxy/**", (route) =>
    route.fulfill({ contentType: "image/png", body: png("tools/preview-chamber.png") })
  );
  await page.goto(`${PREVIEW_ORIGIN}/`);
  await page.addScriptTag({ path: resolve(root, "dist/elegoo-printer-card.js") });

  await page.evaluate(
    ({ hass, config }) => {
      hass.callService = () => Promise.resolve();
      hass.callWS = () => Promise.reject(new Error("screenshot fixture"));
      const card = document.createElement("elegoo-printer-card");
      card.setConfig({ type: "custom:elegoo-printer-card", device_id: "dev1", ...config });
      document.getElementById("frame").appendChild(card);
      card.hass = hass;
      window.__card = card;
    },
    {
      hass: buildHass(shot.scenario, { cover: true, chamber: true }),
      config: shot.config,
    }
  );

  if (shot.action === "confirm-stop") {
    await page.evaluate(() => {
      const stop = Array.from(window.__card.shadowRoot.querySelectorAll("button"))
        .find((b) => b.textContent.includes("Stop"));
      stop.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    });
    await page.waitForTimeout(120);
  }

  await page.waitForTimeout(250); // let the media images decode
  const path = resolve(out, `${shot.name}.png`);
  await page.locator("#frame").screenshot({ path });
  console.log(`wrote docs/images/${shot.name}.png`);
  await page.close();
}
await browser.close();
