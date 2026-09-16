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
  if (scenario === "printing") {
    ok("printing: uses camera stream", img.src.includes("/api/camera_proxy_stream/"), img.src);
  } else {
    ok(`${scenario}: uses cover image`, img.src.includes("/api/image_proxy/"), img.src);
  }

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
  serviceCalls.length = 0;
  if (scenario === "printing") {
    pauseBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, composed: true }));
    ok("click pause -> button.press", JSON.stringify(serviceCalls[0]) === JSON.stringify(["button","press",{entity_id:`button.${P}_pause_print`}]), JSON.stringify(serviceCalls));
  }
  serviceCalls.length = 0;
  const sel = sr.querySelector('select[data-action="select-option"]');
  sel.value = "Sport";
  sel.dispatchEvent(new dom.window.Event("change", { bubbles: true, composed: true }));
  ok(`${scenario}: select -> select.select_option`, JSON.stringify(serviceCalls[0]) === JSON.stringify(["select","select_option",{entity_id:`select.${P}_print_speed`,option:"Sport"}]), JSON.stringify(serviceCalls));

  serviceCalls.length = 0;
  const num = sr.querySelector('input[data-action="set-number"]');
  num.value = "230";
  num.dispatchEvent(new dom.window.Event("change", { bubbles: true, composed: true }));
  ok(`${scenario}: number -> number.set_value`, serviceCalls[0] && serviceCalls[0][1] === "set_value" && serviceCalls[0][2].value === 230, JSON.stringify(serviceCalls));

  serviceCalls.length = 0;
  const slider = sr.querySelector('input[data-action="fan-percentage"]');
  slider.value = "55";
  slider.dispatchEvent(new dom.window.Event("change", { bubbles: true, composed: true }));
  ok(`${scenario}: slider -> fan.set_percentage`, serviceCalls[0] && serviceCalls[0][1] === "set_percentage" && serviceCalls[0][2].percentage === 55, JSON.stringify(serviceCalls));

  serviceCalls.length = 0;
  const lightBtn = Array.from(sr.querySelectorAll("button")).find((b) => b.textContent.includes("Chamber light"));
  lightBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, composed: true }));
  ok(`${scenario}: light -> light.toggle`, serviceCalls[0] && serviceCalls[0][0] === "light" && serviceCalls[0][1] === "toggle");

  // more-info event
  let moreInfo = null;
  card.addEventListener("hass-more-info", (ev) => { moreInfo = ev.detail.entityId; });
  sr.querySelector(".badge").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, composed: true }));
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
  card.setConfig({ type: "custom:elegoo-printer-card", device_id: DEV });
  dom.window.document.body.appendChild(card);
  card.hass = hass;

  let img = card.shadowRoot.querySelector(".media img");
  ok("fallback: starts on the camera stream", img.src.includes("/api/camera_proxy_stream/"), img.src);

  // the camera is offline -> the <img> errors
  img.dispatchEvent(new dom.window.Event("error"));
  img = card.shadowRoot.querySelector(".media img");
  ok("fallback: drops to the cover image", !!img && img.src.includes("/api/image_proxy/"), img && img.src);

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
