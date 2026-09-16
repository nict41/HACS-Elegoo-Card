// Rasterise an SVG to PNG with the pre-installed Chromium.
//   node tools/render-svg.mjs <input.svg> <output.png> <width> <height>
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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [input, output, width = "256", height = "256"] = process.argv.slice(2);
const svg = readFileSync(resolve(input), "utf8");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: 2,
});
await page.setContent(
  `<html><body style="margin:0;background:transparent">${svg
    .replace(/width="\d+"/, `width="${width}"`)
    .replace(/height="\d+"/, `height="${height}"`)}</body></html>`
);
await page.locator("svg").screenshot({ path: resolve(output), omitBackground: true });
await browser.close();
console.log(`wrote ${output}`);
