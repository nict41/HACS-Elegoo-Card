const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "dist", "elegoo-printer-card.js"), "utf8");

// Minimal DOM stubs so the module body evaluates in Node.
globalThis.HTMLElement = class { attachShadow(){ return {appendChild(){}, addEventListener(){}}; } };
globalThis.customElements = { get: () => undefined, define: () => {}, whenDefined: () => Promise.resolve() };
globalThis.document = { createElement: () => ({ setAttribute(){}, addEventListener(){} }) };
globalThis.window = globalThis;
globalThis.CustomEvent = class {};

const api = new Function(src + "\nreturn { resolveEntities, deriveStatus, durationSeconds, formatDuration, matchEntry, findPrinterDevices, safeColor, withCacheKey, KEY_DEFS };")();

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = got === want;
  if (ok) pass++; else { fail++; console.log(`  FAIL ${name}\n    got:  ${got}\n    want: ${want}`); }
};

// ---------------------------------------------------------------------------
// A realistic CC2 FDM printer named "Centauri Carbon 2", machine id 3fa2b1c4d5
// ---------------------------------------------------------------------------
const DEV = "dev_printer_1";
const P = "centauri_carbon_2";
const MID = "3fa2b1c4d5";

// [entity_id, integration key, translation_key]
const FIXTURE = [
  [`sensor.${P}_current_status`, "current_status", "current_status"],
  [`sensor.${P}_print_status`, "print_status", "print_status"],
  [`sensor.${P}_print_error`, "print_error", "print_error"],
  [`sensor.${P}_print_error_reason`, "current_print_error_status_reason", "error_status_reason"],
  [`sensor.${P}_file_name`, "filename", null],
  [`sensor.${P}_percent_complete`, "percent_complete", null],
  [`sensor.${P}_current_layer`, "current_layer", null],
  [`sensor.${P}_total_layers`, "total_layers", null],
  [`sensor.${P}_remaining_layers`, "remaining_layers", null],
  [`sensor.${P}_remaining_print_time`, "ticks_remaining", null],
  [`sensor.${P}_current_print_time`, "current_ticks", null],
  [`sensor.${P}_total_print_time`, "total_ticks", null],
  [`sensor.${P}_begin_time`, "begin_time", null],
  [`sensor.${P}_end_time`, "end_time", null],
  [`sensor.${P}_nozzle_temperature`, "nozzle_temp", null],
  [`sensor.${P}_bed_temperature`, "bed_temp", null],
  [`sensor.${P}_box_temp`, "temp_of_box", null],
  [`sensor.${P}_model_fan_speed`, "model_fan_speed", null],
  [`sensor.${P}_auxiliary_fan_speed`, "aux_fan_speed", null],
  [`sensor.${P}_enclosure_fan_speed`, "box_fan_speed", null],
  [`sensor.${P}_print_speed`, "print_speed_pct", null],          // collides with the select
  [`sensor.${P}_active_filament_color`, "active_filament_color", null],
  [`sensor.${P}_active_tray_id`, "active_tray_id", null],
  [`binary_sensor.${P}_sdcp_status`, "sdcp_status", null],
  [`binary_sensor.${P}_canvas_connected`, "ams_connected", null],
  [`image.${P}_cover_image`, "cover_image", null],
  [`camera.${P}_chamber_camera`, "chamber_camera", null],
  [`light.${P}_chamber_light`, "second_light", null],
  [`select.${P}_print_speed`, "print_speed", null],              // collides with the sensor
  [`number.${P}_target_nozzle_temp`, "target_nozzle_temp", null],
  [`number.${P}_target_bed_temp`, "target_bed_temp", null],      // collides with bed_temp
  [`button.${P}_pause_print`, "pause_print", null],
  [`button.${P}_resume_print`, "resume_print", null],
  [`button.${P}_stop_print`, "stop_print", null],
  [`button.${P}_home_all`, "home_all", null],
  [`button.${P}_home_x`, "home_x", null],
  [`button.${P}_home_y`, "home_y", null],
  [`button.${P}_home_z`, "home_z", null],
  [`fan.${P}_model_fan`, "model_fan", null],
  [`fan.${P}_auxiliary_fan`, "auxiliary_fan", null],
  [`fan.${P}_enclosure_fan`, "box_fan", null],
];
for (let i = 1; i <= 4; i++) {
  FIXTURE.push([`sensor.${P}_a${i}_color`, `a${i}_color`, null]);
  FIXTURE.push([`sensor.${P}_a${i}_name`, `a${i}_name`, null]);
  FIXTURE.push([`sensor.${P}_a${i}_attributes`, `a${i}_attributes`, null]);
}
// Resin-only keys, on a second hypothetical printer, to prove vat_temp vs
// vat_temp_target and temp_of_uvled vs temp_of_uvled_max resolve correctly.
const RESIN = [
  [`sensor.${P}_vat_temp`, "vat_temp", null],
  [`sensor.${P}_target_vat_temp`, "vat_temp_target", null],
  [`sensor.${P}_uv_led_temp`, "temp_of_uvled", null],
];
// Entities the integration also ships that the card has no key for; these must
// never be claimed by a neighbouring key.
const DISTRACTORS = [
  `sensor.${P}_uv_led_temp_max`, `sensor.${P}_remaining_memory`, `sensor.${P}_ip_address`,
  `sensor.${P}_task_id`, `sensor.${P}_current_x`, `sensor.${P}_current_z`,
  `sensor.${P}_z_offset`, `sensor.${P}_total_extrusion`, `sensor.${P}_a1_grams`,
  `sensor.${P}_total_filament_used`, `binary_sensor.${P}_firmware_update_available`,
  `sensor.${P}_release_film`, `sensor.${P}_usb_disk_status`,
];

function buildHass(withUniqueIds) {
  const entities = {};
  const uniqueIds = {};
  for (const [eid, key] of [...FIXTURE, ...RESIN]) {
    const tkey = ([...FIXTURE, ...RESIN].find((r) => r[0] === eid) || [])[2];
    entities[eid] = { device_id: DEV, platform: "elegoo_printer", translation_key: tkey || undefined };
    if (withUniqueIds) uniqueIds[eid] = `${MID}_${key}`;
  }
  for (const eid of DISTRACTORS) {
    entities[eid] = { device_id: DEV, platform: "elegoo_printer" };
    if (withUniqueIds) {
      const objectId = eid.slice(eid.indexOf(".") + 1).replace(`${P}_`, "");
      const map = { uv_led_temp_max: "temp_of_uvled_max", ip_address: "mainboard_ip" };
      uniqueIds[eid] = `${MID}_${map[objectId] || objectId}`;
    }
  }
  // A user's own template sensor attached to the same device must be ignored.
  entities[`sensor.${P}_my_custom_nozzle_temperature`] = { device_id: DEV, platform: "template" };
  // Another device's entities must never leak in.
  entities["sensor.other_printer_nozzle_temperature"] = { device_id: "dev_other", platform: "elegoo_printer" };
  return { entities, uniqueIds };
}

for (const mode of ["admin (unique_id)", "non-admin (slug fallback)"]) {
  const withUid = mode.startsWith("admin");
  console.log(`\n=== resolution: ${mode} ===`);
  const { entities, uniqueIds } = buildHass(withUid);
  const resolved = api.resolveEntities({ entities }, DEV, uniqueIds, undefined);
  for (const [eid, key] of [...FIXTURE, ...RESIN]) eq(`${key} -> ${eid}`, resolved[key], eid);
  // distractors claimed nothing they shouldn't have
  const claimedIds = new Set(Object.values(resolved));
  for (const eid of DISTRACTORS) eq(`distractor unclaimed: ${eid}`, claimedIds.has(eid), false);
  eq("template sensor ignored", claimedIds.has(`sensor.${P}_my_custom_nozzle_temperature`), false);
  eq("other device ignored", claimedIds.has("sensor.other_printer_nozzle_temperature"), false);
}

// --- config overrides -------------------------------------------------------
{
  const { entities, uniqueIds } = buildHass(true);
  const r = api.resolveEntities({ entities }, DEV, uniqueIds, { nozzle_temp: "sensor.remapped" });
  eq("override wins", r.nozzle_temp, "sensor.remapped");
  eq("override leaves others", r.bed_temp, `sensor.${P}_bed_temperature`);
}

// --- a printer whose *name* contains a key token ----------------------------
{
  const entities = {
    "sensor.bed_temp_printer_nozzle_temperature": { device_id: DEV, platform: "elegoo_printer" },
    "sensor.bed_temp_printer_bed_temperature": { device_id: DEV, platform: "elegoo_printer" },
  };
  const r = api.resolveEntities({ entities }, DEV, {}, undefined);
  eq("name-contains-token: nozzle", r.nozzle_temp, "sensor.bed_temp_printer_nozzle_temperature");
  eq("name-contains-token: bed", r.bed_temp, "sensor.bed_temp_printer_bed_temperature");
}

// --- missing entities are simply absent -------------------------------------
{
  const entities = { [`sensor.${P}_current_status`]: { device_id: DEV, platform: "elegoo_printer", translation_key: "current_status" } };
  const r = api.resolveEntities({ entities }, DEV, {}, undefined);
  eq("sparse device resolves what exists", r.current_status, `sensor.${P}_current_status`);
  eq("sparse device: absent key is undefined", r.nozzle_temp, undefined);
  eq("sparse device: key count", Object.keys(r).length, 1);
}

// --- device discovery --------------------------------------------------------
{
  const { entities } = buildHass(false);
  // the fixture deliberately includes a second elegoo_printer device
  eq("findPrinterDevices", api.findPrinterDevices({ entities }).sort().join(","), "dev_other,dev_printer_1");
}

// ===========================================================================
// Status derivation
// ===========================================================================
console.log("\n=== status derivation ===");
function st(map) {
  const states = {};
  const ents = {};
  for (const [key, state] of Object.entries(map)) {
    const eid = "sensor.p_" + key;
    ents[key] = eid;
    states[eid] = { state, attributes: {} };
  }
  return { hass: { states }, ents };
}
function cat(map) {
  const { hass, ents } = st(map);
  return api.deriveStatus(hass, ents).category;
}
eq("idle", cat({ current_status: "idle", print_status: "idle", print_error: "none" }), "idle");
eq("printing", cat({ current_status: "printing", print_status: "printing", print_error: "none" }), "printing");
// paused lives only in print_status -- current_status has no such member
eq("paused via print_status", cat({ current_status: "printing", print_status: "paused", print_error: "none" }), "paused");
eq("pausing", cat({ current_status: "printing", print_status: "pausing" }), "paused");
eq("filament_unload_paused", cat({ print_status: "filament_unload_paused" }), "paused");
eq("error via print_status", cat({ current_status: "printing", print_status: "error" }), "error");
eq("error via print_error", cat({ current_status: "printing", print_status: "printing", print_error: "fileio" }), "error");
eq("print_error=none is not an error", cat({ current_status: "idle", print_error: "none" }), "idle");
eq("print_error=ok is not an error", cat({ current_status: "idle", print_error: "ok" }), "idle");
eq("complete", cat({ current_status: "idle", print_status: "complete" }), "complete");
eq("busy: leveling", cat({ current_status: "leveling" }), "busy");
eq("busy: file_transferring", cat({ current_status: "file_transferring" }), "busy");
eq("printing inferred from print_status only", cat({ print_status: "printing" }), "printing");
eq("no entities at all", cat({}), "unknown");
eq("all unavailable", cat({ current_status: "unavailable", print_status: "unavailable" }), "unknown");
eq("resin has no print_status", cat({ current_status: "exposure_testing" }), "busy");

// ===========================================================================
// Duration handling -- the *_ticks sensors are ms native / minutes suggested,
// and sensor.py notes FDM printers may report seconds.
// ===========================================================================
console.log("\n=== durations ===");
const dur = (state, unit) => api.durationSeconds({ state, attributes: { unit_of_measurement: unit } });
eq("minutes (suggested unit)", dur("90", "min"), 5400);
eq("milliseconds (native unit)", dur("5400000", "ms"), 5400);
eq("seconds", dur("5400", "s"), 5400);
eq("hours", dur("1.5", "h"), 5400);
eq("unavailable -> null", api.durationSeconds({ state: "unavailable", attributes: {} }), null);
eq("missing entity -> null", api.durationSeconds(undefined), null);
eq("format 5400s", api.formatDuration(5400), "1h 30m");
eq("format 900s", api.formatDuration(900), "15m");
eq("format 45s", api.formatDuration(45), "45s");
eq("format null", api.formatDuration(null), null);

console.log("\n=== cache keys ===");
eq("HA proxy path gets a key", api.withCacheKey("/api/image_proxy/image.x?token=a", "T1"), "/api/image_proxy/image.x?token=a&_ts=T1");
eq("path without a query", api.withCacheKey("/api/image_proxy/image.x", "T1"), "/api/image_proxy/image.x?_ts=T1");
eq("timestamp is encoded", api.withCacheKey("/a", "2026-09-16T15:40:00+00:00"), "/a?_ts=2026-09-16T15%3A40%3A00%2B00%3A00");
// an extra parameter would corrupt a data URI or break a pre-signed URL
eq("data: URI untouched", api.withCacheKey("data:image/png;base64,AAAA", "T1"), "data:image/png;base64,AAAA");
eq("absolute URL untouched", api.withCacheKey("https://cdn.example/x.png?sig=abc", "T1"), "https://cdn.example/x.png?sig=abc");
eq("no key -> unchanged", api.withCacheKey("/a", null), "/a");

console.log("\n=== colour sanitising ===");
eq("hex passthrough", api.safeColor("#FF8800"), "#FF8800");
eq("bare hex gets #", api.safeColor("FF8800"), "#FF8800");
eq("named colour", api.safeColor("Red"), "red");
eq("style injection rejected", api.safeColor("red;background:url(x)"), null);
eq("empty rejected", api.safeColor(""), null);
eq("unknown state rejected", api.safeColor("unknown"), null);

console.log(`\n--- resolution: ${pass} passed, ${fail} failed ---`);
process.exitCode = fail ? 1 : 0;
