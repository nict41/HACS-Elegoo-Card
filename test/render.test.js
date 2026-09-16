const fs = require("fs");

// jsdom is an optional dev dependency: the resolution suite runs without it.
let JSDOM;
try {
  ({ JSDOM } = require("jsdom"));
} catch (_err) {
  console.log("SKIP render tests: jsdom not installed (run `npm install`)");
  process.exit(0);
}

const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://localhost:8123/" });
for (const k of ["window","document","HTMLElement","customElements","CustomEvent","Event","Element","navigator"]) {
  globalThis[k] = k === "window" ? dom.window : dom.window[k];
}
dom.window.loadCardHelpers = undefined;

const src = fs.readFileSync(require("path").join(__dirname, "..", "dist", "elegoo-printer-card.js"), "utf8");
dom.window.eval(src);

const P = "centauri_carbon_2", DEV = "dev1", MID = "3fa2b1c4d5";
const e = (id, attrs = {}) => ({ state: attrs.state === undefined ? "on" : attrs.state, attributes: attrs.attributes || {} });

function makeHass(scenario) {
  const entities = {}, states = {}, uniqueIds = {};
  const add = (eid, key, state, attributes = {}, tkey) => {
    entities[eid] = { device_id: DEV, platform: "elegoo_printer", translation_key: tkey };
    states[eid] = { entity_id: eid, state: String(state), attributes };
    uniqueIds[eid] = `${MID}_${key}`;
  };
  const printing = scenario === "printing";
  add(`sensor.${P}_current_status`, "current_status", printing ? "printing" : "idle", {}, "current_status");
  add(`sensor.${P}_print_status`, "print_status", scenario === "paused" ? "paused" : printing ? "printing" : "idle", {}, "print_status");
  add(`sensor.${P}_print_error`, "print_error", scenario === "error" ? "fileio" : "none", {}, "print_error");
  add(`sensor.${P}_file_name`, "filename", printing || scenario === "paused" ? "benchy_0.2mm.gcode" : "unknown");
  add(`sensor.${P}_percent_complete`, "percent_complete", printing ? 42 : 0, { unit_of_measurement: "%" });
  add(`sensor.${P}_current_layer`, "current_layer", 128);
  add(`sensor.${P}_total_layers`, "total_layers", 305);
  add(`sensor.${P}_remaining_print_time`, "ticks_remaining", 95, { unit_of_measurement: "min", device_class: "duration" });
  add(`sensor.${P}_begin_time`, "begin_time", "2026-09-16T09:30:00+00:00", { device_class: "timestamp" });
  add(`sensor.${P}_end_time`, "end_time", "2026-09-16T12:45:00+00:00", { device_class: "timestamp" });
  add(`sensor.${P}_nozzle_temperature`, "nozzle_temp", 214.8, { unit_of_measurement: "°C" });
  add(`sensor.${P}_bed_temperature`, "bed_temp", 60.1, { unit_of_measurement: "°C" });
  add(`sensor.${P}_box_temp`, "temp_of_box", 31.5, { unit_of_measurement: "°C" });
  add(`sensor.${P}_model_fan_speed`, "model_fan_speed", 100, { unit_of_measurement: "%" });
  add(`sensor.${P}_enclosure_fan_speed`, "box_fan_speed", 0, { unit_of_measurement: "%" });
  add(`sensor.${P}_print_speed`, "print_speed_pct", 100, { unit_of_measurement: "%" });
  add(`binary_sensor.${P}_sdcp_status`, "sdcp_status", scenario === "offline" ? "off" : "on");
  add(`image.${P}_cover_image`, "cover_image", "2026-09-16T09:30:00+00:00", { entity_picture: "/api/image_proxy/image.x?token=abc" });
  add(`camera.${P}_chamber_camera`, "chamber_camera", "idle", { entity_picture: "/api/camera_proxy/camera.x?token=def", access_token: "def" });
  add(`light.${P}_chamber_light`, "second_light", "on");
  add(`select.${P}_print_speed`, "print_speed", "Balanced", { options: ["Silent", "Balanced", "Sport", "Ludicrous"] });
  add(`number.${P}_target_nozzle_temp`, "target_nozzle_temp", 215, { min: 0, max: 320, step: 1 });
  add(`number.${P}_target_bed_temp`, "target_bed_temp", 60, { min: 0, max: 110, step: 1 });
  add(`button.${P}_pause_print`, "pause_print", printing ? "unknown" : "unavailable");
  add(`button.${P}_resume_print`, "resume_print", scenario === "paused" ? "unknown" : "unavailable");
  add(`button.${P}_stop_print`, "stop_print", printing || scenario === "paused" ? "unknown" : "unavailable");
  add(`button.${P}_home_all`, "home_all", "unknown");
  add(`fan.${P}_model_fan`, "model_fan", "on", { percentage: 100, percentage_step: 1 });
  add(`fan.${P}_enclosure_fan`, "box_fan", "off", { percentage: 0, percentage_step: 1 });
  add(`sensor.${P}_active_filament_color`, "active_filament_color", "#FF6600");
  add(`sensor.${P}_active_tray_id`, "active_tray_id", "2");
  const colors = ["#1B5E20", "#FF6600", "#0D47A1", "#B71C1C"];
  const names = ["Elegoo PLA Green", "Sunlu PETG Orange", "Elegoo PLA Blue", "Generic ABS Red"];
  for (let i = 1; i <= 4; i++) {
    add(`sensor.${P}_a${i}_color`, `a${i}_color`, colors[i-1]);
    add(`sensor.${P}_a${i}_name`, `a${i}_name`, names[i-1]);
    add(`sensor.${P}_a${i}_attributes`, `a${i}_attributes`, i === 2 ? "PETG" : "PLA", { brand: "Elegoo", diameter: 1.75, nozzle_temp_range: "200-230°C" });
  }
  const serviceCalls = [];
  return {
    hass: {
      states, entities,
      devices: { [DEV]: { id: DEV, name: "Centauri Carbon 2", model: "Centauri Carbon 2", manufacturer: "Elegoo" } },
      locale: { language: "en" },
      callService: (d, s, data) => { serviceCalls.push([d, s, data]); return Promise.resolve(); },
      callWS: () => Promise.reject(new Error("not admin")),
    },
    serviceCalls,
  };
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) pass++; else { fail++; console.log(`  FAIL ${name} ${extra}`); } };

// Control handlers resolve a confirmation promise before calling a service, so
// interactions settle on the microtask queue rather than synchronously.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const dialog = (card) => card.shadowRoot.querySelector(".dialog-backdrop");
const dialogOpen = (card) => { const d = dialog(card); return !!d && !d.hasAttribute("hidden"); };
const dialogText = (card) => dialog(card).querySelector(".dialog-title").textContent;
const clickDialog = (card, which) =>
  card.shadowRoot.querySelector(`[data-dialog="${which}"]`)
    .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
const click = (el) => el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, composed: true }));
const change = (el) => el.dispatchEvent(new dom.window.Event("change", { bubbles: true, composed: true }));

async function main() {

for (const scenario of ["idle", "printing", "paused", "error", "offline"]) {
  const { hass, serviceCalls } = makeHass(scenario);
  const card = dom.window.document.createElement("elegoo-printer-card");
  card.setConfig({ type: "custom:elegoo-printer-card", device_id: DEV });
  dom.window.document.body.appendChild(card);
  card.hass = hass;

  const sr = card.shadowRoot;
  const html = sr.innerHTML;
  const badge = sr.querySelector(".badge");
  console.log(`\n--- ${scenario}: badge="${badge && badge.textContent.trim()}" category="${badge && badge.getAttribute("data-category")}"`);
  ok(`${scenario}: renders ha-card`, !!sr.querySelector("ha-card"));
  ok(`${scenario}: has name`, sr.querySelector(".name").textContent === "Centauri Carbon 2");
  ok(`${scenario}: no undefined leaked`, !html.includes("undefined"), html.slice(0,200));
  ok(`${scenario}: no [object Object]`, !html.includes("[object Object]"));
  ok(`${scenario}: no NaN`, !html.includes("NaN"));

  const expected = { idle: "idle", printing: "printing", paused: "paused", error: "error", offline: "idle" }[scenario];
  ok(`${scenario}: badge category`, badge.getAttribute("data-category") === expected, `got ${badge.getAttribute("data-category")}`);
  ok(`${scenario}: connectivity dot`, sr.querySelector(".conn").getAttribute("data-online") === String(scenario !== "offline"));

  const img = sr.querySelector(".media img");
  ok(`${scenario}: media present`, !!img);
  // The camera is opt-in, so the cover image is used in every scenario and no
  // camera stream is ever opened by default.
  ok(`${scenario}: uses cover image by default`, img.src.includes("/api/image_proxy/"), img.src);
  ok(`${scenario}: no camera stream opened by default`, !sr.innerHTML.includes("camera_proxy_stream"));
  ok(`${scenario}: offers a Show camera button`, !!Array.from(sr.querySelectorAll("button")).find((b) => b.textContent.includes("Show camera")));

  if (scenario === "printing") {
    ok("printing: progress bar 42%", /width:\s*42\.0%/.test(html), html.match(/width:[^"]*/g));
    ok("printing: filename shown", html.includes("benchy_0.2mm.gcode"));
    ok("printing: layers", html.includes("Layer 128 / 305"));
    ok("printing: remaining formatted", html.includes("1h 35m remaining"), html.match(/\dh \d+m remaining/));
    ok("printing: home buttons hidden while printing", !html.includes("Home all"));
  }
  if (scenario === "idle") {
    ok("idle: home buttons shown", html.includes("Home all"));
  }

  const nozzleCell = Array.from(sr.querySelectorAll(".cell")).find((c) => c.textContent.startsWith("Nozzle"));
  ok(`${scenario}: nozzle cell shows reading + target`,
     /214\.8/.test(nozzleCell.textContent) && /\u2192\s*215/.test(nozzleCell.textContent),
     JSON.stringify(nozzleCell.textContent));
  ok(`${scenario}: speed preset select`, !!sr.querySelector('select[data-action="select-option"]'));
  ok(`${scenario}: 4 option elements`, sr.querySelectorAll("select option").length === 4);
  ok(`${scenario}: number inputs`, sr.querySelectorAll('input[data-action="set-number"]').length === 2);
  ok(`${scenario}: fan sliders`, sr.querySelectorAll('input[data-action="fan-percentage"]').length === 2);
  ok(`${scenario}: filament chips`, sr.querySelectorAll(".chip").length === 5, sr.querySelectorAll(".chip").length);
  // count on the chip elements, not the raw HTML (the <style> block also
  // contains a [data-active="true"] selector)
  const activeChips = Array.from(sr.querySelectorAll('.chip[data-active="true"]'));
  ok(`${scenario}: exactly the summary chip + slot A2 are active`, activeChips.length === 2, JSON.stringify(activeChips.map((c) => c.textContent.trim())));
  ok(`${scenario}: active chip is A2`, activeChips.some((c) => c.textContent.includes("A2")));

  // unavailable buttons must be disabled, not missing
  const pauseBtn = Array.from(sr.querySelectorAll("button")).find((b) => b.textContent.includes("Pause"));
  ok(`${scenario}: pause button present`, !!pauseBtn);
  ok(`${scenario}: pause disabled iff not printing`, pauseBtn.disabled === (scenario !== "printing"));

  // --- interactions -------------------------------------------------------
  // Print actions are confirmed by default.
  serviceCalls.length = 0;
  if (scenario === "printing") {
    click(pauseBtn);
    await flush();
    ok("printing: pause opens a confirmation", dialogOpen(card));
    ok("printing: confirmation names the action", dialogText(card) === "Pause the print?", dialogText(card));
    ok("printing: nothing called before confirming", serviceCalls.length === 0, JSON.stringify(serviceCalls));
    clickDialog(card, "cancel");
    await flush();
    ok("printing: cancel calls nothing", serviceCalls.length === 0, JSON.stringify(serviceCalls));
    ok("printing: cancel closes the dialog", !dialogOpen(card));

    click(pauseBtn);
    await flush();
    clickDialog(card, "confirm");
    await flush();
    ok("printing: confirm -> button.press",
       JSON.stringify(serviceCalls[0]) === JSON.stringify(["button","press",{entity_id:`button.${P}_pause_print`}]),
       JSON.stringify(serviceCalls));
    ok("printing: confirm closes the dialog", !dialogOpen(card));
  }

  // Unconfirmed controls fire straight away.
  serviceCalls.length = 0;
  const sel = sr.querySelector('select[data-action="select-option"]');
  sel.value = "Sport";
  change(sel);
  await flush();
  ok(`${scenario}: select -> select.select_option`, JSON.stringify(serviceCalls[0]) === JSON.stringify(["select","select_option",{entity_id:`select.${P}_print_speed`,option:"Sport"}]), JSON.stringify(serviceCalls));

  serviceCalls.length = 0;
  const num = sr.querySelector('input[data-action="set-number"]');
  num.value = "230";
  change(num);
  await flush();
  ok(`${scenario}: number -> number.set_value`, serviceCalls[0] && serviceCalls[0][1] === "set_value" && serviceCalls[0][2].value === 230, JSON.stringify(serviceCalls));

  serviceCalls.length = 0;
  const slider = sr.querySelector('input[data-action="fan-percentage"]');
  slider.value = "55";
  change(slider);
  await flush();
  ok(`${scenario}: slider -> fan.set_percentage`, serviceCalls[0] && serviceCalls[0][1] === "set_percentage" && serviceCalls[0][2].percentage === 55, JSON.stringify(serviceCalls));

  serviceCalls.length = 0;
  const lightBtn = Array.from(sr.querySelectorAll("button")).find((b) => b.textContent.includes("Chamber light"));
  click(lightBtn);
  await flush();
  ok(`${scenario}: light -> light.toggle`, serviceCalls[0] && serviceCalls[0][0] === "light" && serviceCalls[0][1] === "toggle", JSON.stringify(serviceCalls));

  // more-info event
  let moreInfo = null;
  card.addEventListener("hass-more-info", (ev) => { moreInfo = ev.detail.entityId; });
  click(sr.querySelector(".badge"));
  ok(`${scenario}: badge -> more-info`, moreInfo === `sensor.${P}_current_status`, moreInfo);

  card.remove();
}

// ---------------------------------------------------------------------------
// Degradation: a resin printer with almost nothing, and an empty device
// ---------------------------------------------------------------------------
console.log("\n--- degradation ---");
{
  const entities = {
    [`sensor.resin_current_status`]: { device_id: DEV, platform: "elegoo_printer", translation_key: "current_status" },
    [`sensor.resin_uv_led_temp`]: { device_id: DEV, platform: "elegoo_printer" },
    [`sensor.resin_vat_temp`]: { device_id: DEV, platform: "elegoo_printer" },
  };
  const states = {
    [`sensor.resin_current_status`]: { state: "idle", attributes: {} },
    [`sensor.resin_uv_led_temp`]: { state: "28.4", attributes: { unit_of_measurement: "°C" } },
    [`sensor.resin_vat_temp`]: { state: "24.1", attributes: { unit_of_measurement: "°C" } },
  };
  const hass = { states, entities, devices: { [DEV]: { name: "Mars 5 Ultra" } }, locale:{language:"en"}, callService: () => Promise.resolve(), callWS: () => Promise.reject(new Error("no")) };
  const card = dom.window.document.createElement("elegoo-printer-card");
  card.setConfig({ type: "custom:elegoo-printer-card", device_id: DEV });
  dom.window.document.body.appendChild(card);
  card.hass = hass;
  const html = card.shadowRoot.innerHTML;
  ok("resin: renders", !!card.shadowRoot.querySelector("ha-card"));
  ok("resin: media area hidden (no camera/cover)", !card.shadowRoot.querySelector(".media"));
  ok("resin: no controls section", !html.includes("Controls"));
  ok("resin: no filament section", !html.includes("Filament"));
  ok("resin: UV LED cell", html.includes("28.4"));
  ok("resin: no undefined", !html.includes("undefined"));
  card.remove();
}
{
  const hass = { states: {}, entities: {}, devices: {}, locale:{language:"en"}, callService: () => Promise.resolve(), callWS: () => Promise.reject(new Error("no")) };
  const card = dom.window.document.createElement("elegoo-printer-card");
  card.setConfig({ type: "custom:elegoo-printer-card" });
  dom.window.document.body.appendChild(card);
  card.hass = hass;
  ok("no devices: shows notice, does not throw", card.shadowRoot.innerHTML.includes("No <strong>elegoo_printer</strong>"));
  card.remove();
}
{
  // entity present but unavailable everywhere
  const entities = {}, states = {};
  for (const [eid, k] of [["sensor.p_current_status","current_status"],["camera.p_chamber_camera","chamber_camera"],["number.p_target_bed_temp","target_bed_temp"],["button.p_pause_print","pause_print"]]) {
    entities[eid] = { device_id: DEV, platform: "elegoo_printer", translation_key: k === "current_status" ? "current_status" : undefined };
    states[eid] = { state: "unavailable", attributes: {} };
  }
  const hass = { states, entities, devices: { [DEV]: { name: "Offline Printer" } }, locale:{language:"en"}, callService: () => Promise.resolve(), callWS: () => Promise.reject(new Error("no")) };
  const card = dom.window.document.createElement("elegoo-printer-card");
  card.setConfig({ type: "custom:elegoo-printer-card", device_id: DEV });
  dom.window.document.body.appendChild(card);
  card.hass = hass;
  const html = card.shadowRoot.innerHTML;
  ok("all-unavailable: renders", !!card.shadowRoot.querySelector("ha-card"));
  ok("all-unavailable: badge unknown", card.shadowRoot.querySelector(".badge").getAttribute("data-category") === "unknown");
  ok("all-unavailable: no media", !card.shadowRoot.querySelector(".media"));
  ok("all-unavailable: no number input", !card.shadowRoot.querySelector("input[data-action=set-number]"));
  ok("all-unavailable: no undefined", !html.includes("undefined"));
  card.remove();
}
// --- camera failure falls back to the cover image, then hides the area -----
{
  console.log("\n--- media fallback ---");
  const { hass } = makeHass("printing");
  const card = dom.window.document.createElement("elegoo-printer-card");
  card.setConfig({ type: "custom:elegoo-printer-card", device_id: DEV, show_camera: "always" });
  dom.window.document.body.appendChild(card);
  card.hass = hass;

  let img = card.shadowRoot.querySelector(".media img");
  ok("fallback: starts on the camera stream", img.src.includes("/api/camera_proxy_stream/"), img.src);

  // the stream fails -> fall back to a single still frame before giving up on
  // the camera (the printer caps simultaneous stream viewers, so a still can
  // succeed where the stream cannot)
  img.dispatchEvent(new dom.window.Event("error"));
  img = card.shadowRoot.querySelector(".media img");
  ok("fallback: drops to a camera still",
     !!img && img.src.includes("/api/camera_proxy/") && !img.src.includes("_stream"),
     img && img.src);

  // the still fails too -> fall back to the cover image
  img.dispatchEvent(new dom.window.Event("error"));
  img = card.shadowRoot.querySelector(".media img");
  ok("fallback: then the cover image", !!img && img.src.includes("/api/image_proxy/"), img && img.src);

  // the cover image fails too -> the media area disappears entirely
  img.dispatchEvent(new dom.window.Event("error"));
  ok("fallback: media area removed when nothing loads", !card.shadowRoot.querySelector(".media"));
  ok("fallback: card still renders", !!card.shadowRoot.querySelector("ha-card"));

  // a rotated proxy token produces a new URL, so the camera is retried
  const cam = hass.states[`camera.${P}_chamber_camera`];
  hass.states = { ...hass.states, [`camera.${P}_chamber_camera`]: { ...cam, attributes: { ...cam.attributes, entity_picture: "/api/camera_proxy/camera.x?token=rotated" } } };
  card.hass = hass;
  img = card.shadowRoot.querySelector(".media img");
  ok("fallback: retried after the token rotates", !!img && img.src.includes("token=rotated"), img && img.src);
  card.remove();
}

// ---------------------------------------------------------------------------
// Camera visibility
// ---------------------------------------------------------------------------
console.log("\n--- camera visibility ---");
{
  const mk = (config, scenario = "printing") => {
    const { hass, serviceCalls } = makeHass(scenario);
    const card = dom.window.document.createElement("elegoo-printer-card");
    card.setConfig({ type: "custom:elegoo-printer-card", device_id: DEV, ...config });
    dom.window.document.body.appendChild(card);
    card.hass = hass;
    return { card, hass, serviceCalls };
  };

  // default: never stream
  let { card } = mk({});
  ok("never: no stream while printing", !card.shadowRoot.innerHTML.includes("camera_proxy_stream"));

  // the Show camera button opens the stream on demand, and hides it again
  const showBtn = Array.from(card.shadowRoot.querySelectorAll("button")).find((b) => b.textContent.includes("Show camera"));
  click(showBtn);
  let img = card.shadowRoot.querySelector(".media img");
  ok("never: Show camera opens the stream", !!img && img.src.includes("/api/camera_proxy_stream/"), img && img.src);
  const streamEl = img;
  const hideBtn = Array.from(card.shadowRoot.querySelectorAll("button")).find((b) => b.textContent.includes("Hide camera"));
  ok("never: Hide camera button appears", !!hideBtn);
  click(hideBtn);
  ok("never: hiding closes the stream", !card.shadowRoot.innerHTML.includes("camera_proxy_stream"));
  // the detached element must have had its src cleared, or it keeps streaming
  ok("never: detached stream element had its src cleared", !streamEl.hasAttribute("src"), streamEl.getAttribute("src"));
  ok("never: falls back to the cover image", card.shadowRoot.querySelector(".media img").src.includes("/api/image_proxy/"));
  card.remove();

  // printing: auto while printing, cover image when idle
  ({ card } = mk({ show_camera: "printing" }, "printing"));
  ok("printing mode: streams while printing", card.shadowRoot.querySelector(".media img").src.includes("/api/camera_proxy_stream/"));
  ok("printing mode: no manual toggle while auto", !Array.from(card.shadowRoot.querySelectorAll("button")).some((b) => /camera/i.test(b.textContent)));
  card.remove();
  ({ card } = mk({ show_camera: "printing" }, "idle"));
  ok("printing mode: cover image when idle", card.shadowRoot.querySelector(".media img").src.includes("/api/image_proxy/"));
  card.remove();

  // always
  ({ card } = mk({ show_camera: "always" }, "idle"));
  ok("always: streams even when idle", card.shadowRoot.querySelector(".media img").src.includes("/api/camera_proxy_stream/"));
  card.remove();

  // boolean and legacy spellings
  ({ card } = mk({ show_camera: true }, "idle"));
  ok("show_camera: true == always", card.shadowRoot.querySelector(".media img").src.includes("/api/camera_proxy_stream/"));
  card.remove();
  ({ card } = mk({ show_camera: false }, "printing"));
  ok("show_camera: false == never", !card.shadowRoot.innerHTML.includes("camera_proxy_stream"));
  card.remove();
  ({ card } = mk({ camera_always: true }, "idle"));
  ok("legacy camera_always maps to always", card.shadowRoot.querySelector(".media img").src.includes("/api/camera_proxy_stream/"));
  card.remove();

  // camera_live: false uses still snapshots
  ({ card } = mk({ show_camera: "always", camera_live: false }, "printing"));
  img = card.shadowRoot.querySelector(".media img");
  ok("camera_live false: snapshot not stream", img.src.includes("/api/camera_proxy/") && !img.src.includes("_stream"), img.src);
  card.remove();

  // show_media: false wins over everything
  ({ card } = mk({ show_media: false, show_camera: "always" }, "printing"));
  ok("show_media false: no media at all", !card.shadowRoot.querySelector(".media") && !card.shadowRoot.querySelector(".media-bar"));
  card.remove();

  // a printer with no cover image and the camera off still offers the toggle
  {
    const { hass } = makeHass("printing");
    delete hass.states[`image.${P}_cover_image`];
    delete hass.entities[`image.${P}_cover_image`];
    const c = dom.window.document.createElement("elegoo-printer-card");
    c.setConfig({ type: "custom:elegoo-printer-card", device_id: DEV });
    dom.window.document.body.appendChild(c);
    c.hass = hass;
    ok("no cover: shows a Show camera bar", !!c.shadowRoot.querySelector(".media-bar"));
    ok("no cover: nothing streaming yet", !c.shadowRoot.innerHTML.includes("camera_proxy_stream"));
    click(c.shadowRoot.querySelector('[data-action="camera-toggle"]'));
    ok("no cover: toggle opens the stream", c.shadowRoot.querySelector(".media img").src.includes("/api/camera_proxy_stream/"));
    c.remove();
  }
}

// ---------------------------------------------------------------------------
// Regressions reported against a live instance
// ---------------------------------------------------------------------------
console.log("\n--- reported regressions ---");
{
  // A new print must not keep showing the previous print's thumbnail.
  //
  // HA builds an image entity's entity_picture as
  // /api/image_proxy/<id>?token=<t> and rotates that token on a 5-minute timer,
  // so it does NOT change when the image content changes. Only the entity's
  // state (image_last_updated) does.
  const { hass } = makeHass("printing");
  const card = dom.window.document.createElement("elegoo-printer-card");
  card.setConfig({ type: "custom:elegoo-printer-card", device_id: DEV });
  dom.window.document.body.appendChild(card);
  card.hass = hass;

  const first = card.shadowRoot.querySelector(".media img").src;
  ok("cover: url is cache-keyed on last-updated", first.includes("_ts="), first);

  // new print: same entity_picture (same token), new state
  const cover = hass.states[`image.${P}_cover_image`];
  hass.states = {
    ...hass.states,
    [`image.${P}_cover_image`]: { ...cover, state: "2026-09-16T15:40:00+00:00" },
  };
  card.hass = hass;
  const second = card.shadowRoot.querySelector(".media img").src;
  ok("cover: identical entity_picture still yields a new url", second !== first, `${first} -> ${second}`);
  ok("cover: new url carries the new timestamp", second.includes(encodeURIComponent("2026-09-16T15:40:00+00:00")), second);

  // an unchanged image must NOT churn the element (that would restart loading)
  const before = card.shadowRoot.querySelector(".media img");
  card.hass = { ...hass };
  ok("cover: unchanged image reuses the same element", card.shadowRoot.querySelector(".media img") === before);
  card.remove();
}

{
  // "Show camera" that fails must say so, not silently revert to the cover
  // image -- which is indistinguishable from the button doing nothing.
  const { hass } = makeHass("printing");
  hass.states[`sensor.${P}_video_stream_connected`] = { state: "2", attributes: {} };
  hass.states[`sensor.${P}_video_stream_max`] = { state: "2", attributes: {} };
  hass.entities[`sensor.${P}_video_stream_connected`] = { device_id: DEV, platform: "elegoo_printer" };
  hass.entities[`sensor.${P}_video_stream_max`] = { device_id: DEV, platform: "elegoo_printer" };

  const card = dom.window.document.createElement("elegoo-printer-card");
  card.setConfig({ type: "custom:elegoo-printer-card", device_id: DEV });
  dom.window.document.body.appendChild(card);
  card.hass = hass;

  click(card.shadowRoot.querySelector('[data-action="camera-toggle"]'));
  let img = card.shadowRoot.querySelector(".media img");
  ok("show camera: opens the stream", img.src.includes("camera_proxy_stream"), img.src);

  img.dispatchEvent(new dom.window.Event("error"));         // stream fails
  img = card.shadowRoot.querySelector(".media img");
  ok("show camera: tries a still frame", !!img && !img.src.includes("_stream"), img && img.src);

  img.dispatchEvent(new dom.window.Event("error"));         // still fails too
  ok("show camera: no silent revert to the cover image", !card.shadowRoot.querySelector(".media img"));
  const err = card.shadowRoot.querySelector(".media-error");
  ok("show camera: reports the failure", !!err);
  ok("show camera: names the stream limit",
     /2 of 2/.test(err.textContent), JSON.stringify(err && err.textContent));
  ok("show camera: offers a retry", !!card.shadowRoot.querySelector('[data-action="camera-retry"]'));
  ok("show camera: still offers Hide",
     !!Array.from(card.shadowRoot.querySelectorAll("button")).find((b) => b.textContent.includes("Hide camera")));

  // retry clears the remembered failures and tries the stream again
  click(card.shadowRoot.querySelector('[data-action="camera-retry"]'));
  img = card.shadowRoot.querySelector(".media img");
  ok("show camera: retry reopens the stream", !!img && img.src.includes("camera_proxy_stream"), img && img.src);

  // hiding after an error returns to the cover image
  img.dispatchEvent(new dom.window.Event("error"));
  img = card.shadowRoot.querySelector(".media img");
  img.dispatchEvent(new dom.window.Event("error"));
  click(Array.from(card.shadowRoot.querySelectorAll("button")).find((b) => b.textContent.includes("Hide camera")));
  ok("show camera: hiding after a failure restores the cover image",
     !!card.shadowRoot.querySelector(".media img") &&
     card.shadowRoot.querySelector(".media img").src.includes("/api/image_proxy/"));
  card.remove();
}

{
  // In an automatic mode nobody pressed anything, so a quiet fall back to the
  // cover image is still the right behaviour.
  const { hass } = makeHass("printing");
  const card = dom.window.document.createElement("elegoo-printer-card");
  card.setConfig({ type: "custom:elegoo-printer-card", device_id: DEV, show_camera: "always" });
  dom.window.document.body.appendChild(card);
  card.hass = hass;
  let img = card.shadowRoot.querySelector(".media img");
  img.dispatchEvent(new dom.window.Event("error"));
  img = card.shadowRoot.querySelector(".media img");
  img.dispatchEvent(new dom.window.Event("error"));
  ok("auto mode: falls back quietly, no error panel", !card.shadowRoot.querySelector(".media-error"));
  ok("auto mode: shows the cover image", card.shadowRoot.querySelector(".media img").src.includes("/api/image_proxy/"));
  card.remove();
}

// ---------------------------------------------------------------------------
// Confirmation dialogs
// ---------------------------------------------------------------------------
console.log("\n--- confirmations ---");
{
  const mk = (config) => {
    const { hass, serviceCalls } = makeHass("printing");
    const card = dom.window.document.createElement("elegoo-printer-card");
    card.setConfig({ type: "custom:elegoo-printer-card", device_id: DEV, ...config });
    dom.window.document.body.appendChild(card);
    card.hass = hass;
    return { card, serviceCalls };
  };
  const btn = (card, text) => Array.from(card.shadowRoot.querySelectorAll("button")).find((b) => b.textContent.includes(text));

  // stop is the dangerous one
  let { card, serviceCalls } = mk({});
  click(btn(card, "Stop"));
  await flush();
  ok("stop: confirmation opens", dialogOpen(card));
  ok("stop: wording is specific", dialogText(card) === "Stop the print?", dialogText(card));
  ok("stop: body warns it cannot be undone", /cannot be undone/i.test(card.shadowRoot.querySelector(".dialog-body").textContent));
  ok("stop: confirm button is danger-toned", card.shadowRoot.querySelector('[data-dialog="confirm"]').getAttribute("data-tone") === "danger");
  ok("stop: cancel is focused, not confirm", card.shadowRoot.activeElement === card.shadowRoot.querySelector('[data-dialog="cancel"]'));
  clickDialog(card, "confirm");
  await flush();
  ok("stop: confirm fires button.press", serviceCalls[0] && serviceCalls[0][2].entity_id === `button.${P}_stop_print`, JSON.stringify(serviceCalls));
  card.remove();

  // escape cancels
  ({ card, serviceCalls } = mk({}));
  click(btn(card, "Stop"));
  await flush();
  dialog(card).dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await flush();
  ok("escape closes the dialog", !dialogOpen(card));
  ok("escape calls nothing", serviceCalls.length === 0, JSON.stringify(serviceCalls));
  card.remove();

  // backdrop click cancels
  ({ card, serviceCalls } = mk({}));
  click(btn(card, "Stop"));
  await flush();
  dialog(card).dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await flush();
  ok("backdrop click closes the dialog", !dialogOpen(card));
  ok("backdrop click calls nothing", serviceCalls.length === 0);
  card.remove();

  // confirm_actions: false disables all prompts
  ({ card, serviceCalls } = mk({ confirm_actions: false }));
  click(btn(card, "Stop"));
  await flush();
  ok("confirm_actions false: no dialog", !dialogOpen(card));
  ok("confirm_actions false: fires immediately", serviceCalls[0] && serviceCalls[0][2].entity_id === `button.${P}_stop_print`, JSON.stringify(serviceCalls));
  card.remove();

  // confirm_actions: list confirms exactly those keys
  ({ card, serviceCalls } = mk({ confirm_actions: ["stop_print", "second_light"] }));
  click(btn(card, "Pause"));
  await flush();
  ok("list: pause is not confirmed", !dialogOpen(card));
  ok("list: pause fires immediately", serviceCalls[0] && serviceCalls[0][2].entity_id === `button.${P}_pause_print`);
  serviceCalls.length = 0;
  click(btn(card, "Chamber light"));
  await flush();
  ok("list: light is confirmed", dialogOpen(card));
  ok("list: light not called before confirming", serviceCalls.length === 0);
  clickDialog(card, "confirm");
  await flush();
  ok("list: light fires after confirming", serviceCalls[0] && serviceCalls[0][0] === "light");
  card.remove();

  // cancelling an input reverts the widget to the entity's real state
  ({ card, serviceCalls } = mk({ confirm_actions: ["print_speed", "target_nozzle_temp"] }));
  const sel = card.shadowRoot.querySelector('select[data-action="select-option"]');
  ok("revert: select starts at Balanced", sel.value === "Balanced", sel.value);
  sel.value = "Ludicrous";
  change(sel);
  await flush();
  ok("revert: select change is confirmed", dialogOpen(card));
  clickDialog(card, "cancel");
  await flush();
  ok("revert: nothing called", serviceCalls.length === 0, JSON.stringify(serviceCalls));
  ok("revert: select snapped back", card.shadowRoot.querySelector('select[data-action="select-option"]').value === "Balanced",
     card.shadowRoot.querySelector('select[data-action="select-option"]').value);

  const num = card.shadowRoot.querySelector('input[data-action="set-number"]');
  num.value = "300";
  change(num);
  await flush();
  clickDialog(card, "cancel");
  await flush();
  ok("revert: number snapped back", card.shadowRoot.querySelector('input[data-action="set-number"]').value === "215",
     card.shadowRoot.querySelector('input[data-action="set-number"]').value);
  card.remove();

  // invalid config is rejected
  {
    const c = dom.window.document.createElement("elegoo-printer-card");
    let threw = false;
    try { c.setConfig({ type: "x", show_camera: "sometimes" }); } catch (_e) { threw = true; }
    ok("rejects a bad show_camera", threw);
    threw = false;
    try { c.setConfig({ type: "x", confirm_actions: "yes" }); } catch (_e) { threw = true; }
    ok("rejects a bad confirm_actions", threw);
  }
}

// getStubConfig / customCards registration
{
  const { hass } = makeHass("idle");
  const stub = dom.window.customElements.get("elegoo-printer-card").getStubConfig(hass);
  ok("getStubConfig device", stub.device_id === DEV && stub.type === "custom:elegoo-printer-card", JSON.stringify(stub));
  ok("customCards registered", dom.window.customCards.some((c) => c.type === "elegoo-printer-card" && c.preview === true));
  ok("editor element defined", !!dom.window.customElements.get("elegoo-printer-card-editor"));
  const editor = dom.window.customElements.get("elegoo-printer-card").getConfigElement();
  ok("getConfigElement returns editor", editor.tagName.toLowerCase() === "elegoo-printer-card-editor");
}
// invalid config
{
  const card = dom.window.document.createElement("elegoo-printer-card");
  let threw = false;
  try { card.setConfig({ type: "x", entities: ["a"] }); } catch (_e) { threw = true; }
  ok("rejects array entities", threw);
}
console.log(`\n=== render: ${pass} passed, ${fail} failed ===`);
process.exitCode = fail ? 1 : 0;
}

main();
