/**
 * Elegoo Printer Card
 * A standalone Lovelace card for printers exposed by the "elegoo_printer"
 * HACS integration (https://github.com/danielcherubini/elegoo-homeassistant).
 *
 * Dependency-free vanilla custom element: HACS loads frontend plugins as raw
 * JS in the browser, so this file is shipped as-authored with no build step
 * and no runtime imports.
 *
 * @license MIT
 */

const CARD_VERSION = "1.1.2";

/* ===========================================================================
 * ENTITY RESOLUTION TABLE
 * ---------------------------------------------------------------------------
 * Built and verified against elegoo_printer integration v2.12.2
 * (custom_components/elegoo_printer/definitions.py + coordinator.py).
 *
 * If that integration adds, removes or renames entity keys, THIS TABLE is the
 * thing that needs updating -- nothing else in the card hardcodes entity names.
 *
 * How the integration names things (v2.12.2):
 *   - Entities are per-device with has_entity_name = True, so entity_ids are
 *     derived from the user's chosen printer name. Never match on a full
 *     entity_id.
 *   - coordinator.generate_unique_id(key) returns f"{machine_id}_{key}", so an
 *     entity's registry unique_id always ends with "_" + key. That is the
 *     primary, most reliable signal.
 *   - A handful of sensors carry a translation_key (current_status,
 *     print_status, print_error, error_status_reason).
 *   - The visible entity name often does NOT slugify back to the key
 *     (key "nozzle_temp" is named "Nozzle Temperature", key "temp_of_box" is
 *     named "Box Temp", key "box_fan" is named "Enclosure Fan", ...), which is
 *     why `names` below lists the name-derived slugs explicitly. These are only
 *     used as a fallback, because config/entity_registry/list -- the only way
 *     to read unique_id from the frontend -- requires an admin user.
 *
 * Not every key exists for every printer: the integration ships different sets
 * for resin vs FDM and for V1/MQTT vs V3/SDCP vs CC2 hardware. Every lookup
 * here must therefore tolerate a missing entity.
 * ======================================================================== */

const KEY_DEFS = {
  // --- status / progress (sensor) -----------------------------------------
  current_status: { domain: "sensor", tkey: "current_status", names: ["current_status"] },
  print_status: { domain: "sensor", tkey: "print_status", names: ["print_status"] },
  print_error: { domain: "sensor", tkey: "print_error", names: ["print_error"] },
  current_print_error_status_reason: {
    domain: "sensor",
    tkey: "error_status_reason",
    names: ["print_error_reason", "error_status_reason"],
  },
  filename: { domain: "sensor", names: ["file_name"] },
  percent_complete: { domain: "sensor", names: ["percent_complete"] },
  current_layer: { domain: "sensor", names: ["current_layer"] },
  total_layers: { domain: "sensor", names: ["total_layers"] },
  remaining_layers: { domain: "sensor", names: ["remaining_layers"] },
  current_ticks: { domain: "sensor", names: ["current_print_time"] },
  total_ticks: { domain: "sensor", names: ["total_print_time"] },
  ticks_remaining: { domain: "sensor", names: ["remaining_print_time"] },
  begin_time: { domain: "sensor", names: ["begin_time"] },
  end_time: { domain: "sensor", names: ["end_time"] },

  // --- temperatures (sensor) ----------------------------------------------
  nozzle_temp: { domain: "sensor", names: ["nozzle_temperature"] },
  bed_temp: { domain: "sensor", names: ["bed_temperature"] },
  temp_of_box: { domain: "sensor", names: ["box_temp"] },
  temp_of_uvled: { domain: "sensor", names: ["uv_led_temp"] },
  vat_temp: { domain: "sensor", names: ["vat_temp"] },
  vat_temp_target: { domain: "sensor", names: ["target_vat_temp"] },

  // --- fan speed readouts (sensor) ----------------------------------------
  model_fan_speed: { domain: "sensor", names: ["model_fan_speed"] },
  aux_fan_speed: { domain: "sensor", names: ["auxiliary_fan_speed"] },
  box_fan_speed: { domain: "sensor", names: ["enclosure_fan_speed"] },
  // NOTE: the *sensor* is key "print_speed_pct" but is named "Print Speed",
  // colliding with the select's slug. Domain scoping keeps them apart.
  print_speed_pct: { domain: "sensor", names: ["print_speed"] },

  // --- filament / Canvas AMS (sensor, CC2 only) ---------------------------
  active_filament_color: { domain: "sensor", names: ["active_filament_color"] },
  active_tray_id: { domain: "sensor", names: ["active_tray_id"] },

  // --- video stream capacity (sensor, V3 only, diagnostic) ----------------
  video_stream_connected: { domain: "sensor", names: ["video_stream_connected"] },
  video_stream_max: { domain: "sensor", names: ["video_stream_max"] },

  // --- connectivity (binary_sensor) ---------------------------------------
  sdcp_status: { domain: "binary_sensor", names: ["sdcp_status"] },
  ams_connected: { domain: "binary_sensor", names: ["canvas_connected"] },

  // --- media ---------------------------------------------------------------
  cover_image: { domain: "image", names: ["cover_image"] },
  chamber_camera: { domain: "camera", names: ["chamber_camera"] },

  // --- controls ------------------------------------------------------------
  second_light: { domain: "light", names: ["chamber_light"] },
  print_speed: { domain: "select", names: ["print_speed"] },
  target_nozzle_temp: { domain: "number", names: ["target_nozzle_temp"] },
  target_bed_temp: { domain: "number", names: ["target_bed_temp"] },
  pause_print: { domain: "button", names: ["pause_print"] },
  resume_print: { domain: "button", names: ["resume_print"] },
  stop_print: { domain: "button", names: ["stop_print"] },
  home_all: { domain: "button", names: ["home_all"] },
  home_x: { domain: "button", names: ["home_x"] },
  home_y: { domain: "button", names: ["home_y"] },
  home_z: { domain: "button", names: ["home_z"] },
  model_fan: { domain: "fan", names: ["model_fan"] },
  auxiliary_fan: { domain: "fan", names: ["auxiliary_fan"] },
  box_fan: { domain: "fan", names: ["enclosure_fan"] },
};

// Canvas/AMS slots a1..a4 are generated the same way for every slot.
for (let i = 1; i <= 4; i++) {
  KEY_DEFS["a" + i + "_color"] = { domain: "sensor", names: ["a" + i + "_color"] };
  KEY_DEFS["a" + i + "_name"] = { domain: "sensor", names: ["a" + i + "_name"] };
  KEY_DEFS["a" + i + "_attributes"] = { domain: "sensor", names: ["a" + i + "_attributes"] };
}

const INTEGRATION_DOMAIN = "elegoo_printer";
const UNAVAILABLE_STATES = new Set(["unavailable", "unknown", "none", "None", ""]);

/* ===========================================================================
 * Small helpers
 * ======================================================================== */

/** True when the entity is absent or has no usable state. */
function isUsable(stateObj) {
  return !!stateObj && !UNAVAILABLE_STATES.has(stateObj.state);
}

/** Numeric value of an entity state, or null if it is not a finite number. */
function numState(stateObj) {
  if (!isUsable(stateObj)) return null;
  const n = Number(stateObj.state);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convert a duration entity to seconds.
 *
 * The integration declares the *_ticks sensors with a native unit of
 * milliseconds and a suggested unit of minutes, and sensor.py notes FDM
 * printers may report seconds -- so the displayed unit genuinely varies.
 * Read it at runtime rather than assuming.
 */
function durationSeconds(stateObj) {
  const value = numState(stateObj);
  if (value === null) return null;
  const unit = (stateObj.attributes && stateObj.attributes.unit_of_measurement) || "s";
  switch (String(unit).toLowerCase()) {
    case "ms":
      return value / 1000;
    case "min":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return value;
  }
}

/** "2h 15m" / "15m" / "45s" */
function formatDuration(totalSeconds) {
  if (totalSeconds === null || totalSeconds < 0) return null;
  const secs = Math.round(totalSeconds);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return h + "h " + m + "m";
  if (m > 0) return m + "m";
  return secs + "s";
}

/** Locale-aware short time for the timestamp sensors. */
function formatTimestamp(stateObj, hass) {
  if (!isUsable(stateObj)) return null;
  const date = new Date(stateObj.state);
  if (Number.isNaN(date.getTime())) return null;
  const locale = (hass && hass.locale && hass.locale.language) || undefined;
  const sameDay = date.toDateString() === new Date().toDateString();
  try {
    return date.toLocaleString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      ...(sameDay ? {} : { month: "short", day: "numeric" }),
    });
  } catch (_err) {
    return date.toLocaleString();
  }
}

/** Escape text before it goes into an innerHTML template. */
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/** "file_transferring" -> "File Transferring" (fallback when no translation). */
function prettify(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Localised state text, using HA's own translations when available so enum
 * sensors read the same as they do elsewhere in the UI.
 */
function localizeState(hass, stateObj) {
  if (!isUsable(stateObj)) return null;
  try {
    if (hass && typeof hass.formatEntityState === "function") {
      const formatted = hass.formatEntityState(stateObj);
      if (formatted) return formatted;
    }
  } catch (_err) {
    /* fall through to the plain prettifier */
  }
  return prettify(stateObj.state);
}

/**
 * Append a cache-busting key to a media URL.
 *
 * An image entity's `entity_picture` is only `/api/image_proxy/<id>?token=<t>`,
 * and Home Assistant rotates that token on a fixed 5-minute timer
 * (TOKEN_CHANGE_INTERVAL) -- it does NOT change when the underlying image does.
 * The entity's *state* is `image_last_updated`, which does. Without this, a new
 * print reuses the previous print's URL and the browser serves the stale
 * cached thumbnail.
 */
function withCacheKey(url, key) {
  if (!url || !key) return url;
  // Only Home Assistant's own proxy paths are safe to add a parameter to. An
  // entity may carry an absolute or data: URL instead (entity_picture can be
  // set to anything), where an extra query parameter would corrupt a data URI
  // or invalidate a pre-signed URL.
  if (url.charAt(0) !== "/") return url;
  return url + (url.indexOf("?") >= 0 ? "&" : "?") + "_ts=" + encodeURIComponent(key);
}

/** A colour string that is safe to drop into a style attribute. */
function safeColor(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  // HA sentinels reach here as plain strings and would otherwise be mistaken
  // for CSS named colours by the check further down.
  if (UNAVAILABLE_STATES.has(value) || UNAVAILABLE_STATES.has(value.toLowerCase())) return null;
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return value;
  if (/^[0-9a-f]{6}$/i.test(value)) return "#" + value;
  if (/^(?:rgb|hsl)a?\([0-9.,%\s/-]+\)$/i.test(value)) return value;
  if (/^[a-z]{3,20}$/i.test(value)) return value.toLowerCase();
  return null;
}

/* ===========================================================================
 * Entity resolution
 * ---------------------------------------------------------------------------
 * Given a device_id, work out which entity_id backs each integration key.
 *
 * Signals, strongest first:
 *   1. registry unique_id -- always f"{machine_id}_{key}" (needs admin to read)
 *   2. translation_key    -- set on the enum sensors
 *   3. entity_id object_id suffix matching the key itself
 *   4. entity_id object_id suffix matching a known name-derived slug
 *
 * Every candidate is scoped to the target device first, so this never
 * string-matches a full entity_id and never assumes the printer's name.
 * ======================================================================== */

const SCORE_UNIQUE_ID = 400;
const SCORE_TRANSLATION_KEY = 300;
// Key matches and name-slug matches share a tier deliberately: the longest
// matched token wins. "<printer>_target_vat_temp" ends with "_vat_temp", so if
// a bare key match outranked a name match, key "vat_temp" would steal the
// entity that really belongs to "vat_temp_target".
const SCORE_OBJECT_ID_KEY = 200;
const SCORE_OBJECT_ID_NAME = 200;

/** Does `haystack` end on the token `needle` at an underscore boundary? */
function endsWithToken(haystack, needle) {
  if (!haystack || !needle) return false;
  if (haystack === needle) return true;
  return haystack.length > needle.length && haystack.endsWith("_" + needle);
}

/**
 * Decide which key a single registry entry represents.
 * Returns { key, score } or null.
 */
function matchEntry(domain, objectId, uniqueId, translationKey) {
  let best = null;
  const consider = (key, score, tokenLength) => {
    if (
      !best ||
      score > best.score ||
      (score === best.score && tokenLength > best.tokenLength)
    ) {
      best = { key, score, tokenLength };
    }
  };

  for (const key of Object.keys(KEY_DEFS)) {
    const def = KEY_DEFS[key];
    // Domain scoping is what keeps sensor "print_speed_pct" (named
    // "Print Speed") from stealing the select "print_speed", and keeps
    // number "target_bed_temp" from colliding with sensor "bed_temp".
    if (def.domain !== domain) continue;

    if (uniqueId && endsWithToken(uniqueId, key)) {
      consider(key, SCORE_UNIQUE_ID, key.length);
      continue;
    }
    if (translationKey && def.tkey && translationKey === def.tkey) {
      consider(key, SCORE_TRANSLATION_KEY, key.length);
      continue;
    }
    if (endsWithToken(objectId, key)) {
      consider(key, SCORE_OBJECT_ID_KEY, key.length);
      continue;
    }
    for (const alias of def.names || []) {
      if (endsWithToken(objectId, alias)) {
        consider(key, SCORE_OBJECT_ID_NAME, alias.length);
      }
    }
  }
  return best;
}

/**
 * Resolve every known key for a device.
 *
 * @param {object} hass
 * @param {string} deviceId
 * @param {object} uniqueIds  entity_id -> unique_id (may be empty)
 * @param {object} overrides  key -> entity_id, from the card config
 * @returns {object} key -> entity_id
 */
function resolveEntities(hass, deviceId, uniqueIds, overrides) {
  const claimed = Object.create(null); // key -> { entityId, score, tokenLength }
  const registry = (hass && hass.entities) || {};

  for (const entityId of Object.keys(registry)) {
    const entry = registry[entityId];
    if (!entry || entry.device_id !== deviceId) continue;
    // `platform` is present on the display registry; when it is there, use it
    // so a user's template sensor attached to the same device cannot win.
    if (entry.platform && entry.platform !== INTEGRATION_DOMAIN) continue;

    const dot = entityId.indexOf(".");
    if (dot < 0) continue;
    const domain = entityId.slice(0, dot);
    const objectId = entityId.slice(dot + 1);

    const match = matchEntry(domain, objectId, uniqueIds[entityId], entry.translation_key);
    if (!match) continue;

    const prev = claimed[match.key];
    if (
      !prev ||
      match.score > prev.score ||
      (match.score === prev.score && match.tokenLength > prev.tokenLength)
    ) {
      claimed[match.key] = { entityId, score: match.score, tokenLength: match.tokenLength };
    }
  }

  const resolved = Object.create(null);
  for (const key of Object.keys(claimed)) resolved[key] = claimed[key].entityId;

  // Explicit per-entity overrides always win, so advanced users can remap
  // anything this heuristic gets wrong (or point at a future/renamed key).
  if (overrides) {
    for (const key of Object.keys(overrides)) {
      const value = overrides[key];
      if (typeof value === "string" && value.includes(".")) resolved[key] = value;
    }
  }
  return resolved;
}

/** All device_ids that have at least one elegoo_printer entity. */
function findPrinterDevices(hass) {
  const seen = new Set();
  const registry = (hass && hass.entities) || {};
  for (const entityId of Object.keys(registry)) {
    const entry = registry[entityId];
    if (entry && entry.platform === INTEGRATION_DOMAIN && entry.device_id) {
      seen.add(entry.device_id);
    }
  }
  return Array.from(seen);
}

/**
 * Fetch entity_id -> unique_id from the entity registry.
 * Requires an admin user; non-admins simply fall back to the slug heuristics.
 */
async function fetchUniqueIds(hass) {
  const map = Object.create(null);
  if (!hass || typeof hass.callWS !== "function") return map;
  const entries = await hass.callWS({ type: "config/entity_registry/list" });
  if (!Array.isArray(entries)) return map;
  for (const entry of entries) {
    if (entry && entry.entity_id && entry.unique_id) map[entry.entity_id] = entry.unique_id;
  }
  return map;
}

/* ===========================================================================
 * Status interpretation
 * ---------------------------------------------------------------------------
 * `current_status` (SDCP machine status) has no "paused" member -- pause,
 * completion and error live in `print_status`. The badge therefore consults
 * both, preferring whichever carries the more specific information.
 * ======================================================================== */

const PRINT_STATUS_PRINTING = new Set([
  "printing",
  "printing_recovery",
  "print_started",
  "resuming",
  "lifting",
  "dropping",
  "preheating",
  "auto_feeding",
  "loading",
]);
const PRINT_STATUS_PAUSED = new Set(["paused", "pausing", "filament_unload_paused"]);
const PRINT_STATUS_ERROR = new Set(["error", "filament_unload_abnormal"]);
const PRINT_STATUS_COMPLETE = new Set(["complete"]);
const CURRENT_STATUS_BUSY = new Set([
  "file_transferring",
  "exposure_testing",
  "devices_testing",
  "leveling",
  "input_shaping",
  "homing",
  "loading_unloading",
  "pid_tuning",
  "recovery",
  "stopping",
]);
const NO_ERROR_STATES = new Set(["none", "ok", "unknown", "unavailable"]);

/**
 * @returns {{category: string, label: string|null, printing: boolean}}
 *   category is one of: printing | paused | error | complete | idle | busy | unknown
 */
function deriveStatus(hass, entities) {
  const printStatus = hass.states[entities.print_status];
  const currentStatus = hass.states[entities.current_status];
  const printError = hass.states[entities.print_error];

  const ps = isUsable(printStatus) ? String(printStatus.state) : null;
  const cs = isUsable(currentStatus) ? String(currentStatus.state) : null;
  const hasError =
    isUsable(printError) && !NO_ERROR_STATES.has(String(printError.state).toLowerCase());

  let category = "unknown";
  let label = null;

  if (hasError) {
    category = "error";
    label = localizeState(hass, printError);
  } else if (ps && PRINT_STATUS_ERROR.has(ps)) {
    category = "error";
    label = localizeState(hass, printStatus);
  } else if (ps && PRINT_STATUS_PAUSED.has(ps)) {
    category = "paused";
    label = localizeState(hass, printStatus);
  } else if (ps && PRINT_STATUS_COMPLETE.has(ps)) {
    category = "complete";
    label = localizeState(hass, printStatus);
  } else if (cs === "printing" || (ps && PRINT_STATUS_PRINTING.has(ps))) {
    category = "printing";
    label = localizeState(hass, currentStatus) || localizeState(hass, printStatus);
  } else if (cs && CURRENT_STATUS_BUSY.has(cs)) {
    category = "busy";
    label = localizeState(hass, currentStatus);
  } else if (cs === "idle" || ps === "idle") {
    category = "idle";
    label = localizeState(hass, currentStatus) || localizeState(hass, printStatus);
  } else if (cs || ps) {
    category = "busy";
    label = localizeState(hass, currentStatus) || localizeState(hass, printStatus);
  }

  return { category, label, printing: category === "printing" };
}

/* ===========================================================================
 * Styles
 * ======================================================================== */

const CARD_STYLES = `
  :host { display: block; }
  ha-card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .content { padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 14px; }
  .section { display: flex; flex-direction: column; gap: 8px; }

  /* --- header ------------------------------------------------------------ */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px 2px;
  }
  .title { min-width: 0; }
  .name {
    font-size: 1.15rem;
    font-weight: 500;
    color: var(--primary-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .subtitle {
    font-size: 0.8rem;
    color: var(--secondary-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 14px;
    font-size: 0.78rem;
    font-weight: 500;
    line-height: 1.4;
    white-space: nowrap;
    color: var(--text-primary-color, #fff);
    background: var(--status-color);
    cursor: pointer;
  }
  .badge[data-category="idle"] {
    --status-color: var(--secondary-text-color, #727272);
  }
  .badge[data-category="printing"] {
    --status-color: var(--info-color, #039be5);
  }
  .badge[data-category="busy"] {
    --status-color: var(--state-icon-color, #44739e);
  }
  .badge[data-category="paused"] { --status-color: var(--warning-color, #ffa726); }
  .badge[data-category="error"] { --status-color: var(--error-color, #db4437); }
  .badge[data-category="complete"] { --status-color: var(--success-color, #43a047); }
  .badge[data-category="unknown"] {
    --status-color: var(--disabled-text-color, #9e9e9e);
  }
  .badge .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }
  .badge[data-category="printing"] .dot { animation: pulse 1.8s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

  .conn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    cursor: pointer;
  }
  .conn[data-online="true"] { background: var(--success-color, #43a047); }
  .conn[data-online="false"] { background: var(--error-color, #db4437); }

  /* --- media ------------------------------------------------------------- */
  .media {
    position: relative;
    width: 100%;
    background: var(--secondary-background-color);
    line-height: 0;
  }
  .media img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 340px;
    object-fit: contain;
    cursor: pointer;
  }
  .media-label {
    position: absolute;
    left: 8px;
    bottom: 8px;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.7rem;
    line-height: 1.6;
    color: #fff;
    background: rgba(0, 0, 0, 0.55);
  }

  /* --- progress ---------------------------------------------------------- */
  .filename {
    font-size: 0.9rem;
    color: var(--primary-text-color);
    word-break: break-word;
  }
  .bar {
    position: relative;
    height: 8px;
    border-radius: 4px;
    background: var(--divider-color, rgba(127, 127, 127, 0.3));
    overflow: hidden;
  }
  .bar > span {
    display: block;
    height: 100%;
    border-radius: 4px;
    background: var(--primary-color, #03a9f4);
    transition: width 0.4s ease;
  }
  .progress-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 12px;
    font-size: 0.8rem;
    color: var(--secondary-text-color);
  }

  /* --- detail grid ------------------------------------------------------- */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 10px;
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--secondary-background-color);
    cursor: pointer;
  }
  .cell-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--secondary-text-color);
  }
  .cell-value {
    font-size: 0.98rem;
    color: var(--primary-text-color);
  }
  .cell-target {
    display: block;
    margin-top: 1px;
    font-size: 0.8rem;
    color: var(--secondary-text-color);
  }

  /* --- filament ---------------------------------------------------------- */
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 5px;
    border-radius: 14px;
    font-size: 0.78rem;
    color: var(--primary-text-color);
    background: var(--secondary-background-color);
    cursor: pointer;
  }
  .chip[data-active="true"] {
    outline: 2px solid var(--primary-color, #03a9f4);
    outline-offset: -2px;
  }
  .swatch {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.4));
    background: var(--swatch-color, transparent);
  }
  .chip-sub { color: var(--secondary-text-color); }
  .chip-lead {
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--secondary-text-color);
  }

  /* --- controls ---------------------------------------------------------- */
  .label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--secondary-text-color);
  }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  button.btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border: none;
    border-radius: 18px;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--primary-text-color);
    background: var(--secondary-background-color);
    cursor: pointer;
  }
  button.btn:hover:not(:disabled) { filter: brightness(1.12); }
  button.btn:disabled { opacity: 0.55; cursor: not-allowed; }
  button.btn:disabled[data-tone] {
    color: var(--disabled-text-color, #bdbdbd);
    background: var(--secondary-background-color);
  }
  button.btn svg { width: 18px; height: 18px; fill: currentColor; }
  button.btn[data-tone="primary"] {
    color: var(--text-primary-color, #fff);
    background: var(--primary-color);
  }
  button.btn[data-tone="danger"] {
    color: var(--text-primary-color, #fff);
    background: var(--error-color, #db4437);
  }
  button.btn[data-on="true"] {
    color: var(--text-primary-color, #fff);
    background: var(--primary-color, #03a9f4);
  }

  .control {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1 1 100%;
    min-width: 0;
  }
  .control > .label { flex: 0 0 auto; min-width: 58px; }
  select {
    flex: 1 1 auto;
    min-width: 0;
  }
  input[type="number"] {
    flex: 0 0 auto;
    width: 88px;
  }
  select, input[type="number"] {
    padding: 6px 8px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.4));
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.85rem;
    color: var(--primary-text-color);
    background: var(--card-background-color, var(--ha-card-background));
  }
  input[type="range"] { flex: 1 1 auto; min-width: 0; accent-color: var(--primary-color); }
  .pct { flex: 0 0 auto; width: 36px; text-align: right;
         font-size: 0.8rem; color: var(--secondary-text-color); }

  .notice {
    padding: 16px;
    color: var(--secondary-text-color);
    font-size: 0.9rem;
  }
  .notice strong { color: var(--primary-text-color); }
  hr.sep { border: none; border-top: 1px solid var(--divider-color, rgba(127,127,127,0.2)); margin: 0; }

  /* --- camera toggle ------------------------------------------------------ */
  .media-actions { position: absolute; right: 8px; bottom: 8px; }
  .media-bar { display: flex; justify-content: center; padding: 10px 16px 0; }
  .media-error {
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin: 12px 16px 0;
    padding: 14px;
    border-radius: 10px;
    text-align: center;
    background: var(--secondary-background-color);
  }
  .media-error-title {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--primary-text-color);
  }
  .media-error-body {
    font-size: 0.8rem;
    line-height: 1.45;
    color: var(--secondary-text-color);
  }
  .media-error-actions { display: flex; gap: 8px; margin-top: 4px; }
  button.btn.btn--sm {
    padding: 4px 10px;
    font-size: 0.74rem;
    border-radius: 12px;
    background: var(--secondary-background-color);
  }
  .media-actions button.btn.btn--sm {
    color: #fff;
    background: rgba(0, 0, 0, 0.55);
  }

  /* --- confirmation dialog ------------------------------------------------ */
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.45);
  }
  .dialog-backdrop[hidden] { display: none; }
  .dialog {
    width: 100%;
    max-width: 320px;
    padding: 18px;
    border-radius: 14px;
    background: var(--ha-card-background, var(--card-background-color, #fff));
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }
  .dialog-title {
    margin: 0 0 8px;
    font-size: 1.05rem;
    font-weight: 500;
    color: var(--primary-text-color);
  }
  .dialog-body {
    margin: 0 0 16px;
    font-size: 0.86rem;
    line-height: 1.45;
    color: var(--secondary-text-color);
  }
  .dialog-body[hidden] { display: none; }
  .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .dialog-actions button.btn:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  @media (max-width: 420px) {
    .grid { grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); }
    .control { flex-basis: 100%; }
  }
`;

const ICONS = {
  pause: "M14,19H18V5H14M6,19H10V5H6V19Z",
  play: "M8,5.14V19.14L19,12.14L8,5.14Z",
  stop: "M18,18H6V6H18V18Z",
};

function svgIcon(name) {
  const path = ICONS[name];
  if (!path) return "";
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"></path></svg>';
}

/* ===========================================================================
 * The card
 * ======================================================================== */

const DEFAULTS = {
  show_media: true,
  show_progress: true,
  show_details: true,
  show_filament: true,
  show_controls: true,
  // The camera is opt-in: a visible chamber camera streams continuously for as
  // long as the card is on screen, so it is never shown unless asked for.
  show_camera: "never",
  camera_live: true,
  confirm_actions: true,
};

const CAMERA_MODES = ["never", "printing", "always"];

/**
 * Actions confirmed by default: everything that can wreck a running print.
 * Fans, the chamber light and the temperature/speed inputs are left alone
 * because they are either harmless or already deliberate, but any key may be
 * added via `confirm_actions`.
 */
const DEFAULT_CONFIRM_KEYS = [
  "pause_print",
  "resume_print",
  "stop_print",
  "home_all",
  "home_x",
  "home_y",
  "home_z",
];

const CONFIRM_PROMPTS = {
  stop_print: {
    title: "Stop the print?",
    body: "The current print will be cancelled. This cannot be undone.",
    confirm: "Stop print",
    tone: "danger",
  },
  pause_print: {
    title: "Pause the print?",
    body: "The printer will pause at the current layer.",
    confirm: "Pause",
  },
  resume_print: {
    title: "Resume the print?",
    body: "The printer will carry on from where it paused.",
    confirm: "Resume",
  },
  home_all: {
    title: "Home all axes?",
    body: "Homing moves the toolhead. Running it during a print will ruin the print.",
    confirm: "Home all",
    tone: "danger",
  },
  second_light: { title: "Toggle the chamber light?", body: "", confirm: "Toggle" },
  print_speed: {
    title: "Change the print speed?",
    body: "The new speed preset is applied immediately.",
    confirm: "Change speed",
  },
  target_nozzle_temp: {
    title: "Change the nozzle target?",
    body: "The printer will start heating or cooling to the new target straight away.",
    confirm: "Set target",
  },
  target_bed_temp: {
    title: "Change the bed target?",
    body: "The printer will start heating or cooling to the new target straight away.",
    confirm: "Set target",
  },
};

for (const axis of ["x", "y", "z"]) {
  CONFIRM_PROMPTS["home_" + axis] = {
    title: "Home the " + axis.toUpperCase() + " axis?",
    body: "Homing moves the toolhead. Running it during a print will ruin the print.",
    confirm: "Home " + axis.toUpperCase(),
    tone: "danger",
  };
}

/** Prompt copy for a key, with a usable fallback for anything not listed. */
function confirmPrompt(key) {
  return (
    CONFIRM_PROMPTS[key] || {
      title: "Confirm " + prettify(key).toLowerCase() + "?",
      body: "This changes a setting on the printer.",
      confirm: "Confirm",
    }
  );
}

class ElegooPrinterCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { ...DEFAULTS };
    this._hass = null;
    this._entities = Object.create(null);
    this._uniqueIds = Object.create(null);
    this._uniqueIdsRequested = false;
    this._fingerprint = null;
    this._resolutionKey = null;
    this._mediaKey = null;
    this._mediaEl = null;
    this._mediaSlotState = null;
    this._bodyDirty = false;
    this._mediaFailed = Object.create(null);
    this._cameraRevealed = false;
    this._confirmKeys = new Set(DEFAULT_CONFIRM_KEYS);
    this._dialog = null;
    this._dialogResolve = null;
    this._built = false;
  }

  /* --- lifecycle -------------------------------------------------------- */

  setConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Invalid configuration");
    }
    if (config.entities !== undefined) {
      if (typeof config.entities !== "object" || Array.isArray(config.entities)) {
        throw new Error(
          "`entities` must be a map of integration key to entity_id, e.g. " +
            "{ nozzle_temp: sensor.my_printer_nozzle_temperature }"
        );
      }
    }
    const merged = { ...DEFAULTS, ...config };

    // `camera_always` was the pre-release spelling of `show_camera: always`.
    if (config.camera_always === true && config.show_camera === undefined) {
      merged.show_camera = "always";
    }
    // Booleans are accepted as a convenience for the three-way camera mode.
    if (merged.show_camera === true) merged.show_camera = "always";
    if (merged.show_camera === false) merged.show_camera = "never";
    if (!CAMERA_MODES.includes(merged.show_camera)) {
      throw new Error(
        "`show_camera` must be one of " + CAMERA_MODES.join(", ") + " (or true/false)"
      );
    }

    if (
      typeof merged.confirm_actions !== "boolean" &&
      !Array.isArray(merged.confirm_actions)
    ) {
      throw new Error(
        "`confirm_actions` must be true, false, or a list of action keys such as " +
          "[stop_print, pause_print]"
      );
    }

    this._config = merged;
    this._confirmKeys =
      merged.confirm_actions === false
        ? null
        : new Set(
            Array.isArray(merged.confirm_actions)
              ? merged.confirm_actions
              : DEFAULT_CONFIRM_KEYS
          );
    this._fingerprint = null;
    this._resolutionKey = null;
    this._mediaFailed = Object.create(null);
    this._cameraRevealed = false;
    this._mediaSlotState = null;
    this._releaseMedia();
    if (this._hass) this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    this._ensureShell();
    if (this._hass) this._update();
  }

  getCardSize() {
    let size = 3;
    if (this._config.show_media && (this._entities.chamber_camera || this._entities.cover_image)) {
      size += 4;
    }
    if (this._config.show_controls) size += 2;
    return size;
  }

  /* --- editor / picker support ------------------------------------------ */

  static getConfigElement() {
    return document.createElement("elegoo-printer-card-editor");
  }

  static getStubConfig(hass) {
    const devices = findPrinterDevices(hass);
    return { type: "custom:elegoo-printer-card", device_id: devices[0] || "" };
  }

  /* --- update pipeline --------------------------------------------------- */

  /**
   * Build the card's permanent skeleton.
   *
   * Header, media and body are separate persistent nodes, and a re-render only
   * replaces the contents of the header and body. The media element is never
   * detached: removing a streaming <img> from the document aborts its load, and
   * this card re-renders every few seconds during a print as the temperatures
   * and layer counter tick over.
   */
  _ensureShell() {
    if (this._built) return;
    const style = document.createElement("style");
    style.textContent = CARD_STYLES;
    this.shadowRoot.appendChild(style);

    this._root = document.createElement("ha-card");
    this._headerEl = document.createElement("div");
    this._mediaSlot = document.createElement("div");
    this._bodyEl = document.createElement("div");
    this._root.appendChild(this._headerEl);
    this._root.appendChild(this._mediaSlot);
    this._root.appendChild(this._bodyEl);
    this.shadowRoot.appendChild(this._root);

    this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
    this.shadowRoot.addEventListener("change", (ev) => this._onChange(ev));
    // Body updates are held back while a control has focus, so apply whatever
    // was skipped once focus leaves it.
    this.shadowRoot.addEventListener("focusout", () => {
      if (!this._bodyDirty) return;
      // During focusout the outgoing element can still be the active element,
      // and focus may be moving to another control in the body. Let it settle,
      // then re-check rather than deciding here.
      setTimeout(() => {
        if (!this._bodyDirty || this._bodyHasFocus()) return;
        this._bodyDirty = false;
        this._fingerprint = null;
        this._update();
      }, 0);
    });
    this._built = true;
  }

  /**
   * True while the user is typing in, or dragging, a control in the body.
   *
   * Replacing the body's markup underneath them drops focus and the caret, and
   * closes an open dropdown. Buttons are excluded: they keep focus after a
   * click, which would otherwise stall updates indefinitely.
   */
  _bodyHasFocus() {
    const active = this.shadowRoot.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    if (tag !== "INPUT" && tag !== "SELECT") return false;
    return this._bodyEl.contains(active);
  }

  _resolveDeviceId() {
    if (this._config.device_id) return this._config.device_id;
    // Convenience for the card picker preview and single-printer setups.
    const devices = findPrinterDevices(this._hass);
    return devices.length === 1 ? devices[0] : null;
  }

  _update() {
    if (!this._hass) return;
    this._ensureShell();

    // unique_id is only readable via the entity registry websocket command,
    // which needs an admin user. Try once; fall back silently if refused.
    if (!this._uniqueIdsRequested) {
      this._uniqueIdsRequested = true;
      fetchUniqueIds(this._hass)
        .then((map) => {
          if (!Object.keys(map).length) return;
          this._uniqueIds = map;
          this._resolutionKey = null;
          this._fingerprint = null;
          this._update();
        })
        .catch(() => {
          /* non-admin user: slug heuristics remain in force */
        });
    }

    const deviceId = this._resolveDeviceId();
    if (!deviceId) {
      this._renderNotice(
        findPrinterDevices(this._hass).length
          ? "Select a printer in the card options."
          : "No <strong>elegoo_printer</strong> devices were found in this Home Assistant instance."
      );
      return;
    }

    // Re-resolving walks the whole entity registry, so only redo it when
    // something that feeds it actually changed.
    const resolutionKey = [
      deviceId,
      this._hass.entities,
      this._uniqueIds,
      this._config.entities,
    ];
    if (
      !this._resolutionKey ||
      this._resolutionKey.some((value, index) => value !== resolutionKey[index])
    ) {
      this._resolutionKey = resolutionKey;
      this._entities = resolveEntities(
        this._hass,
        deviceId,
        this._uniqueIds,
        this._config.entities
      );
      this._fingerprint = null;
    }

    const fingerprint = this._fingerprintOf(deviceId);
    if (fingerprint === this._fingerprint) return;
    this._fingerprint = fingerprint;
    this._render(deviceId);
  }

  _fingerprintOf(deviceId) {
    const hass = this._hass;
    const parts = [deviceId, this._config.show_camera, String(this._cameraRevealed)];
    const device = (hass.devices || {})[deviceId];
    if (device) parts.push((device.name_by_user || device.name || "") + "|" + (device.model || ""));
    for (const key of Object.keys(this._entities).sort()) {
      const stateObj = hass.states[this._entities[key]];
      if (!stateObj) {
        parts.push(key + ":∅");
        continue;
      }
      const a = stateObj.attributes || {};
      parts.push(
        key +
          ":" +
          stateObj.state +
          "|" + (a.unit_of_measurement || "") +
          "|" + (a.entity_picture || "") +
          "|" + (a.percentage === undefined ? "" : a.percentage) +
          "|" + (Array.isArray(a.options) ? a.options.join(",") : "") +
          "|" + (a.min === undefined ? "" : a.min) +
          "|" + (a.max === undefined ? "" : a.max) +
          "|" + (a.step === undefined ? "" : a.step)
      );
    }
    return parts.join(";");
  }

  _renderNotice(html) {
    this._releaseMedia();
    this._mediaSlotState = null;
    this._headerEl.innerHTML = "";
    this._mediaSlot.innerHTML = "";
    this._bodyEl.innerHTML = '<div class="notice">' + html + "</div>";
  }

  /* --- state accessors --------------------------------------------------- */

  /** State object for an integration key, or undefined. */
  _st(key) {
    const entityId = this._entities[key];
    return entityId ? this._hass.states[entityId] : undefined;
  }

  /** True when the key resolves to an entity that currently has a usable state. */
  _has(key) {
    return isUsable(this._st(key));
  }

  /** Formatted display value for a key (uses HA's own formatting). */
  _display(key) {
    const stateObj = this._st(key);
    if (!isUsable(stateObj)) return null;
    try {
      if (typeof this._hass.formatEntityState === "function") {
        const formatted = this._hass.formatEntityState(stateObj);
        if (formatted) return formatted;
      }
    } catch (_err) {
      /* fall through */
    }
    const unit = stateObj.attributes && stateObj.attributes.unit_of_measurement;
    return unit ? stateObj.state + " " + unit : stateObj.state;
  }

  /* --- rendering --------------------------------------------------------- */

  _render(deviceId) {
    const status = deriveStatus(this._hass, this._entities);
    const media = this._config.show_media
      ? this._mediaState(status)
      : { target: null, cameraToggle: null, cameraError: false };

    this._headerEl.innerHTML = this._renderHeader(deviceId, status);
    this._updateMediaSlot(media);

    const body = [];
    if (this._config.show_progress) body.push(this._renderProgress(status));
    if (this._config.show_details) body.push(this._renderDetails());
    if (this._config.show_filament) body.push(this._renderFilament());
    if (this._config.show_controls) body.push(this._renderControls(status));

    const filled = body.filter(Boolean);
    const html = filled.length ? '<div class="content">' + filled.join("") + "</div>" : "";

    if (this._bodyHasFocus()) {
      // Re-apply once the control is released rather than yanking it away.
      this._bodyDirty = true;
      return;
    }
    this._bodyDirty = false;
    if (this._bodyEl.innerHTML !== html) this._bodyEl.innerHTML = html;
  }

  _renderHeader(deviceId, status) {
    const device = (this._hass.devices || {})[deviceId] || {};
    const name =
      this._config.name || device.name_by_user || device.name || "Elegoo Printer";
    // Many printers are named after their model, which would just repeat the
    // title, so the subtitle is dropped when it says nothing new.
    const candidate = this._config.name
      ? device.name_by_user || device.name || ""
      : device.model || "";
    const subtitle =
      candidate && candidate.toLowerCase() !== name.toLowerCase() ? candidate : "";

    let connectivity = "";
    const sdcp = this._st("sdcp_status");
    if (sdcp) {
      const online = sdcp.state === "on";
      const known = sdcp.state === "on" || sdcp.state === "off";
      const title = !known
        ? "Printer connection state unknown"
        : online
          ? "Printer local API connected"
          : "Printer local API disconnected";
      connectivity =
        '<span class="conn" data-online="' +
        (known ? String(online) : "false") +
        '" title="' + esc(title) + '"' +
        ' data-action="more-info" data-entity="' + esc(this._entities.sdcp_status) + '"></span>';
    }

    const badgeEntity =
      this._entities.current_status || this._entities.print_status || "";
    const badge =
      '<span class="badge" data-category="' + status.category + '"' +
      (badgeEntity ? ' data-action="more-info" data-entity="' + esc(badgeEntity) + '"' : "") +
      '><span class="dot"></span>' + esc(status.label || "Unknown") + "</span>";

    return (
      '<div class="header"><div class="title"><div class="name">' + esc(name) + "</div>" +
      (subtitle ? '<div class="subtitle">' + esc(subtitle) + "</div>" : "") +
      '</div><div class="header-right">' + connectivity + badge + "</div></div>"
    );
  }

  /* --- media ------------------------------------------------------------- */

  _mediaState(status) {
    const camera = this._st("chamber_camera");
    const cover = this._st("cover_image");
    const cameraPicture =
      isUsable(camera) && camera.attributes ? camera.attributes.entity_picture : null;
    const coverPicture =
      isUsable(cover) && cover.attributes ? cover.attributes.entity_picture : null;

    // Camera sources, best first. The printer only allows a limited number of
    // simultaneous video viewers, so the MJPEG stream can fail while a single
    // still frame still succeeds -- try the stream, then fall back to a still
    // rather than giving up on the camera entirely.
    const cameraSources = [];
    if (cameraPicture) {
      const streamSrc = cameraPicture.replace(
        "/api/camera_proxy/",
        "/api/camera_proxy_stream/"
      );
      if (this._config.camera_live && streamSrc !== cameraPicture) {
        cameraSources.push({
          kind: "camera",
          entity: this._entities.chamber_camera,
          label: "Chamber camera",
          src: streamSrc,
        });
      }
      cameraSources.push({
        kind: "camera",
        entity: this._entities.chamber_camera,
        label: this._config.camera_live ? "Chamber camera (still)" : "Chamber camera",
        src: cameraPicture,
      });
    }

    const coverTarget = coverPicture
      ? {
          kind: "image",
          entity: this._entities.cover_image,
          label: "Current job",
          // Keyed on the entity's state (image_last_updated) so a new print's
          // thumbnail actually replaces the previous one -- see withCacheKey.
          src: withCacheKey(coverPicture, cover.state),
        }
      : null;

    const mode = this._config.show_camera;
    const autoCamera = mode === "always" || (mode === "printing" && status.printing);
    // With the camera off, it is left out of the candidate list entirely, so no
    // <img> is ever created for it and nothing streams.
    const wantCamera = cameraSources.length > 0 && (autoCamera || this._cameraRevealed);

    // Failures are remembered per source URL rather than per entity: the proxy
    // token rotates periodically, so a camera that comes back is retried on the
    // next token instead of staying hidden until the dashboard is reloaded.
    let target = null;
    let cameraError = false;
    if (wantCamera) {
      target = cameraSources.find((source) => !this._mediaFailed[source.src]) || null;
      // Silently swapping in the cover image after someone presses "Show
      // camera" looks exactly like the button doing nothing, so an explicit
      // request that fails reports the failure instead.
      cameraError = !target && this._cameraRevealed;
    }
    if (!target && !cameraError && coverTarget && !this._mediaFailed[coverTarget.src]) {
      target = coverTarget;
    }

    const showingCamera = !!target && target.kind === "camera";
    return {
      target,
      cameraError,
      // Only offer the manual toggle when the camera is not already being
      // shown automatically.
      cameraToggle: cameraSources.length && !autoCamera
        ? showingCamera || cameraError
          ? "hide"
          : "show"
        : null,
    };
  }

  /** Explains a failed camera request instead of quietly reverting. */
  _cameraErrorDetail() {
    const connected = numState(this._st("video_stream_connected"));
    const max = numState(this._st("video_stream_max"));
    const atCapacity = connected !== null && max !== null && max > 0 && connected >= max;
    return atCapacity
      ? "The printer is already serving " + connected + " of " + max +
        " allowed video streams. Close another viewer and try again."
      : "The printer did not return a video stream. It may be busy, off, or " +
        "still starting up.";
  }

  _renderCameraError(cameraToggle) {
    const detail = this._cameraErrorDetail();
    return (
      '<div class="media-bar media-error">' +
      '<div class="media-error-title">Camera unavailable</div>' +
      '<div class="media-error-body">' + esc(detail) + "</div>" +
      '<div class="media-error-actions">' +
      '<button class="btn btn--sm" type="button" data-action="camera-retry">Try again</button>' +
      (cameraToggle === "hide" ? this._cameraToggleButton("hide") : "") +
      "</div></div>"
    );
  }

  _cameraToggleButton(mode) {
    return (
      '<button class="btn btn--sm" type="button" data-action="camera-toggle">' +
      (mode === "show" ? "Show camera" : "Hide camera") +
      "</button>"
    );
  }

  /**
   * Drop the media element and clear its src.
   *
   * Removing a streaming <img> from the DOM does not reliably close the
   * underlying MJPEG connection, so the src is cleared explicitly. That is the
   * whole point of the camera being opt-in.
   */
  _releaseMedia() {
    if (this._mediaEl) {
      this._mediaEl.removeAttribute("src");
      if (typeof this._mediaEl.remove === "function") this._mediaEl.remove();
    }
    this._mediaEl = null;
    this._mediaKey = null;
  }

  /**
   * Identity of the media area's contents. While this is unchanged the slot is
   * left completely alone, so a running stream survives unrelated updates.
   */
  _mediaSlotKey(media) {
    if (media.target) {
      return ["t", media.target.kind, media.target.entity, media.target.src,
              media.cameraToggle || ""].join("|");
    }
    if (media.cameraError) {
      return ["e", media.cameraToggle || "", this._cameraErrorDetail()].join("|");
    }
    return ["n", media.cameraToggle || ""].join("|");
  }

  _updateMediaSlot(media) {
    const key = this._mediaSlotKey(media);
    if (key === this._mediaSlotState) return;
    this._mediaSlotState = key;

    if (!media.target) {
      this._releaseMedia();
      this._mediaSlot.innerHTML = media.cameraError
        ? this._renderCameraError(media.cameraToggle)
        : media.cameraToggle === "show"
          ? '<div class="media-bar">' + this._cameraToggleButton("show") + "</div>"
          : "";
      return;
    }

    const target = media.target;
    this._mediaSlot.innerHTML =
      '<div class="media">' +
      '<span class="media-label">' + esc(target.label) + "</span>" +
      (media.cameraToggle
        ? '<div class="media-actions">' + this._cameraToggleButton(media.cameraToggle) + "</div>"
        : "") +
      "</div>";
    const holder = this._mediaSlot.firstElementChild;

    const elementKey = target.kind + "|" + target.entity + "|" + target.src;
    if (this._mediaKey !== elementKey || !this._mediaEl) {
      this._releaseMedia();
      const img = document.createElement("img");
      img.alt = target.label;
      img.setAttribute("data-action", "more-info");
      img.setAttribute("data-entity", target.entity);
      img.addEventListener("error", () => {
        // A camera that is offline, a stream the printer will not open, or a
        // job with no thumbnail yet: fall through to the next source rather
        // than leaving a broken image in the card.
        this._mediaFailed[target.src] = true;
        this._releaseMedia();
        this._mediaSlotState = null;
        this._fingerprint = null;
        this._update();
      });
      img.src = target.src;
      this._mediaEl = img;
      this._mediaKey = elementKey;
    }
    holder.insertBefore(this._mediaEl, holder.firstChild);
  }

  /* --- progress ---------------------------------------------------------- */

  _renderProgress(status) {
    const rows = [];
    const percent = numState(this._st("percent_complete"));
    const filename = this._has("filename") ? this._st("filename").state : null;

    if (filename) rows.push('<div class="filename">' + esc(filename) + "</div>");
    if (percent !== null) {
      const clamped = Math.max(0, Math.min(100, percent));
      rows.push('<div class="bar"><span style="width:' + clamped.toFixed(1) + '%"></span></div>');
    }

    const left = [];
    const right = [];
    if (percent !== null) left.push(esc(Math.round(percent) + "%"));

    const current = numState(this._st("current_layer"));
    const total = numState(this._st("total_layers"));
    if (current !== null && total !== null && total > 0) {
      left.push(esc("Layer " + current + " / " + total));
    } else if (current !== null) {
      left.push(esc("Layer " + current));
    }

    const remaining = formatDuration(durationSeconds(this._st("ticks_remaining")));
    if (remaining) right.push(esc(remaining + " remaining"));

    const times = [];
    const begin = formatTimestamp(this._st("begin_time"), this._hass);
    const end = formatTimestamp(this._st("end_time"), this._hass);
    if (begin) times.push(esc("Started " + begin));
    if (end) times.push(esc("ETA " + end));

    if (left.length || right.length) {
      rows.push(
        '<div class="progress-meta"><span>' + left.join(" &middot; ") +
        "</span><span>" + right.join(" &middot; ") + "</span></div>"
      );
    }
    if (times.length) {
      rows.push('<div class="progress-meta"><span>' + times.join(" &middot; ") + "</span></div>");
    }

    if (!rows.length) return "";
    // Suppress an all-zero progress block when the printer is plainly idle.
    if (status.category === "idle" && !filename && !percent) return "";
    return '<div class="section">' + rows.join("") + "</div>";
  }

  /* --- detail grid -------------------------------------------------------- */

  _cell(label, value, entityId) {
    return (
      '<div class="cell"' +
      (entityId ? ' data-action="more-info" data-entity="' + esc(entityId) + '"' : "") +
      '><span class="cell-label">' + esc(label) + '</span>' +
      '<span class="cell-value">' + value + "</span></div>"
    );
  }

  /** Temperature cell, appending "→ target" only when the target exists. */
  _tempCell(label, sensorKey, targetKey) {
    if (!this._has(sensorKey)) return "";
    const value = esc(this._display(sensorKey));
    let target = "";
    if (targetKey && this._has(targetKey)) {
      const wanted = numState(this._st(targetKey));
      if (wanted !== null && wanted > 0) {
        const unit = (this._st(sensorKey).attributes || {}).unit_of_measurement || "";
        // A separate line, so a long reading plus target never wraps mid-value.
        target =
          '<span class="cell-target">&rarr; ' +
          esc(Math.round(wanted)) +
          (unit ? " " + esc(unit) : "&deg;") +
          "</span>";
      }
    }
    return this._cell(label, value + target, this._entities[sensorKey]);
  }

  _renderDetails() {
    const cells = [];

    // FDM temperatures
    cells.push(this._tempCell("Nozzle", "nozzle_temp", "target_nozzle_temp"));
    cells.push(this._tempCell("Bed", "bed_temp", "target_bed_temp"));
    cells.push(this._tempCell("Enclosure", "temp_of_box", null));
    // Resin temperatures
    cells.push(this._tempCell("UV LED", "temp_of_uvled", null));
    cells.push(this._tempCell("Vat", "vat_temp", "vat_temp_target"));

    // Print speed: prefer the select's current preset, fall back to the %.
    if (this._has("print_speed")) {
      cells.push(
        this._cell("Speed", esc(this._display("print_speed")), this._entities.print_speed)
      );
    } else if (this._has("print_speed_pct")) {
      cells.push(
        this._cell("Speed", esc(this._display("print_speed_pct")), this._entities.print_speed_pct)
      );
    }

    const fanSpeeds = [
      ["Model fan", "model_fan_speed"],
      ["Aux fan", "aux_fan_speed"],
      ["Enclosure fan", "box_fan_speed"],
    ];
    for (const [label, key] of fanSpeeds) {
      if (this._has(key)) {
        cells.push(this._cell(label, esc(this._display(key)), this._entities[key]));
      }
    }

    const filled = cells.filter(Boolean);
    if (!filled.length) return "";
    return '<div class="grid">' + filled.join("") + "</div>";
  }

  /* --- filament / Canvas AMS ---------------------------------------------- */

  /**
   * Which A-slot is loaded.
   *
   * active_tray_id is the raw AMS TrayId string (the integration only filters
   * out CC1's "-1" idle marker), so it is not guaranteed to be a 1-4 slot
   * number. Use it when it plainly is one, otherwise fall back to matching the
   * active colour against the slot colours.
   */
  _activeSlot(activeColor) {
    const trayState = this._st("active_tray_id");
    if (isUsable(trayState)) {
      const parsed = parseInt(trayState.state, 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 4) return parsed;
    }
    if (activeColor) {
      const wanted = activeColor.toLowerCase();
      for (let i = 1; i <= 4; i++) {
        const slotColor = this._has("a" + i + "_color")
          ? safeColor(this._st("a" + i + "_color").state)
          : null;
        if (slotColor && slotColor.toLowerCase() === wanted) return i;
      }
    }
    return null;
  }

  _renderFilament() {
    const activeState = this._st("active_filament_color");
    const activeColor = isUsable(activeState) ? safeColor(activeState.state) : null;
    const activeSlot = this._activeSlot(activeColor);

    const parts = [];

    if (activeColor || activeSlot !== null) {
      const attrs = (activeState && activeState.attributes) || {};
      const detail =
        attrs.filament_name || attrs.name || attrs.type || attrs.filament_type || null;
      const slotName =
        activeSlot !== null && this._has("a" + activeSlot + "_name")
          ? this._st("a" + activeSlot + "_name").state
          : null;
      const trayLabel =
        slotName ||
        detail ||
        (activeSlot !== null
          ? "Slot A" + activeSlot
          : this._has("active_tray_id")
            ? "Tray " + this._st("active_tray_id").state
            : "Loaded");
      parts.push(
        '<div class="chips"><span class="chip" data-active="true"' +
          (this._entities.active_filament_color
            ? ' data-action="more-info" data-entity="' +
              esc(this._entities.active_filament_color) + '"'
            : "") +
          '><span class="swatch" style="--swatch-color:' +
          esc(activeColor || "transparent") +
          '"></span><span class="chip-lead">Loaded</span> ' + esc(trayLabel) +
          (activeSlot !== null && slotName ? ' <span class="chip-sub">A' + activeSlot + "</span>" : "") +
          "</span></div>"
      );
    }

    const slotChips = [];
    for (let i = 1; i <= 4; i++) {
      const colorKey = "a" + i + "_color";
      const nameKey = "a" + i + "_name";
      const typeKey = "a" + i + "_attributes";
      if (!this._has(colorKey) && !this._has(nameKey)) continue;

      const color = this._has(colorKey) ? safeColor(this._st(colorKey).state) : null;
      const name = this._has(nameKey) ? this._st(nameKey).state : null;
      const type = this._has(typeKey) ? this._st(typeKey).state : null;
      if (!color && !name && !type) continue;

      const entityId = this._entities[nameKey] || this._entities[typeKey] || this._entities[colorKey];
      slotChips.push(
        '<span class="chip" data-active="' + (activeSlot === i) + '"' +
        (entityId ? ' data-action="more-info" data-entity="' + esc(entityId) + '"' : "") +
        '><span class="swatch" style="--swatch-color:' + esc(color || "transparent") + '"></span>' +
        "A" + i + ' <span class="chip-sub">' + esc(name || type || "empty") + "</span></span>"
      );
    }
    if (slotChips.length) {
      parts.push('<div class="chips">' + slotChips.join("") + "</div>");
    }

    if (!parts.length) return "";
    return '<div class="section"><span class="label">Filament</span>' + parts.join("") + "</div>";
  }

  /* --- controls ------------------------------------------------------------ */

  _actionButton(key, label, icon, tone) {
    const stateObj = this._st(key);
    // The integration gates each button server-side via available_fn, so an
    // unavailable button simply means "not valid right now" -- disable it
    // rather than second-guessing why.
    if (!stateObj) return "";
    const disabled = stateObj.state === "unavailable";
    return (
      '<button class="btn" type="button"' +
      (tone ? ' data-tone="' + tone + '"' : "") +
      (disabled ? " disabled" : "") +
      ' data-action="press" data-key="' + esc(key) + '"' +
      ' data-entity="' + esc(this._entities[key]) + '">' +
      svgIcon(icon) + "<span>" + esc(label) + "</span></button>"
    );
  }

  _renderControls(status) {
    const groups = [];

    // --- job control ------------------------------------------------------
    const jobButtons = [
      this._actionButton("pause_print", "Pause", "pause", null),
      this._actionButton("resume_print", "Resume", "play", "primary"),
      this._actionButton("stop_print", "Stop", "stop", "danger"),
    ].filter(Boolean);

    const homeButtons = [
      this._actionButton("home_all", "Home all", null, null),
      this._actionButton("home_x", "Home X", null, null),
      this._actionButton("home_y", "Home Y", null, null),
      this._actionButton("home_z", "Home Z", null, null),
    ].filter(Boolean);

    if (jobButtons.length) groups.push('<div class="row">' + jobButtons.join("") + "</div>");

    // --- light ------------------------------------------------------------
    const lightRow = [];
    const light = this._st("second_light");
    if (light && light.state !== "unavailable") {
      lightRow.push(
        '<button class="btn" type="button" data-on="' + (light.state === "on") + '"' +
        ' data-action="light-toggle" data-key="second_light"' +
        ' data-entity="' + esc(this._entities.second_light) + '">' +
        "<span>Chamber light</span></button>"
      );
    }

    // --- fans -------------------------------------------------------------
    const fanRows = [];
    const fans = [
      ["model_fan", "Model"],
      ["auxiliary_fan", "Aux"],
      ["box_fan", "Enclosure"],
    ];
    for (const [key, label] of fans) {
      const fan = this._st(key);
      if (!fan || fan.state === "unavailable") continue;
      const entityId = esc(this._entities[key]);
      const on = fan.state === "on";
      const percentage = fan.attributes && typeof fan.attributes.percentage === "number"
        ? Math.round(fan.attributes.percentage)
        : on ? 100 : 0;
      const supportsSpeed =
        fan.attributes && fan.attributes.percentage_step !== undefined;
      fanRows.push(
        '<div class="control">' +
        '<button class="btn" type="button" data-on="' + on + '"' +
        ' data-action="fan-toggle" data-key="' + esc(key) + '"' +
        ' data-entity="' + entityId + '"><span>' + esc(label) + "</span></button>" +
        (supportsSpeed
          ? '<input type="range" min="0" max="100" step="1" value="' + percentage + '"' +
            ' aria-label="' + esc(label + " fan speed") + '"' +
            ' data-action="fan-percentage" data-key="' + esc(key) + '"' +
            ' data-entity="' + entityId + '">' +
            '<span class="pct">' + percentage + "%</span>"
          : "") +
        "</div>"
      );
    }

    if (lightRow.length || fanRows.length) {
      groups.push('<div class="row">' + lightRow.join("") + fanRows.join("") + "</div>");
    }

    // --- speed preset + target temperatures --------------------------------
    const inputs = [];
    const speed = this._st("print_speed");
    if (speed && speed.state !== "unavailable") {
      const options = (speed.attributes && speed.attributes.options) || [];
      if (options.length) {
        const opts = options
          .map((option) =>
            '<option value="' + esc(option) + '"' +
            (option === speed.state ? " selected" : "") + ">" + esc(prettify(option)) + "</option>"
          )
          .join("");
        inputs.push(
          '<div class="control"><span class="label">Speed</span>' +
          '<select data-action="select-option" data-key="print_speed" data-entity="' +
          esc(this._entities.print_speed) + '">' + opts + "</select></div>"
        );
      }
    }

    for (const [key, label] of [["target_nozzle_temp", "Nozzle"], ["target_bed_temp", "Bed"]]) {
      const target = this._st(key);
      if (!target || target.state === "unavailable") continue;
      const a = target.attributes || {};
      const value = numState(target);
      inputs.push(
        '<div class="control"><span class="label">' + esc(label) + "</span>" +
        '<input type="number" data-action="set-number" data-key="' + esc(key) + '"' +
        ' data-entity="' + esc(this._entities[key]) + '"' +
        (a.min === undefined ? "" : ' min="' + esc(a.min) + '"') +
        (a.max === undefined ? "" : ' max="' + esc(a.max) + '"') +
        ' step="' + esc(a.step === undefined ? 1 : a.step) + '"' +
        ' aria-label="' + esc("Target " + label.toLowerCase() + " temperature") + '"' +
        ' value="' + (value === null ? "" : esc(value)) + '"></div>'
      );
    }

    if (inputs.length) groups.push('<div class="row">' + inputs.join("") + "</div>");
    if (homeButtons.length && status.category !== "printing") {
      groups.push('<div class="row">' + homeButtons.join("") + "</div>");
    }

    if (!groups.length) return "";
    return '<div class="section"><span class="label">Controls</span>' + groups.join("") + "</div>";
  }

  /* --- events --------------------------------------------------------------- */

  _call(domain, service, data) {
    if (!this._hass || typeof this._hass.callService !== "function") return;
    this._hass.callService(domain, service, data).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("elegoo-printer-card: " + domain + "." + service + " failed", err);
    });
  }

  _moreInfo(entityId) {
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      })
    );
  }

  /* --- confirmation ---------------------------------------------------- */

  _ensureDialog() {
    if (this._dialog) return;
    const backdrop = document.createElement("div");
    backdrop.className = "dialog-backdrop";
    backdrop.setAttribute("hidden", "");
    backdrop.innerHTML =
      '<div class="dialog" role="alertdialog" aria-modal="true"' +
      ' aria-labelledby="dialog-title" aria-describedby="dialog-body">' +
      '<h2 class="dialog-title" id="dialog-title"></h2>' +
      '<p class="dialog-body" id="dialog-body"></p>' +
      '<div class="dialog-actions">' +
      '<button class="btn" type="button" data-dialog="cancel">Cancel</button>' +
      '<button class="btn" type="button" data-dialog="confirm"></button>' +
      "</div></div>";

    backdrop.addEventListener("click", (ev) => {
      const button = ev.target.closest ? ev.target.closest("[data-dialog]") : null;
      if (button) {
        this._closeDialog(button.getAttribute("data-dialog") === "confirm");
        return;
      }
      // A click on the backdrop itself, outside the dialog, cancels.
      if (ev.target === backdrop) this._closeDialog(false);
    });
    backdrop.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        this._closeDialog(false);
      }
    });

    this.shadowRoot.appendChild(backdrop);
    this._dialog = backdrop;
  }

  _closeDialog(result) {
    if (!this._dialog) return;
    this._dialog.setAttribute("hidden", "");
    const resolve = this._dialogResolve;
    this._dialogResolve = null;
    if (resolve) resolve(result);
  }

  /** Resolves true when the action may proceed. */
  _confirm(key) {
    if (!key || !this._confirmKeys || !this._confirmKeys.has(key)) {
      return Promise.resolve(true);
    }
    const prompt = confirmPrompt(key);
    return new Promise((resolve) => {
      // A second prompt while one is open cancels the first rather than
      // orphaning its promise.
      this._closeDialog(false);
      this._ensureDialog();
      const dialog = this._dialog;
      dialog.querySelector(".dialog-title").textContent = prompt.title;
      const body = dialog.querySelector(".dialog-body");
      body.textContent = prompt.body || "";
      body.hidden = !prompt.body;
      const confirmButton = dialog.querySelector('[data-dialog="confirm"]');
      confirmButton.textContent = prompt.confirm;
      confirmButton.setAttribute("data-tone", prompt.tone === "danger" ? "danger" : "primary");
      this._dialogResolve = resolve;
      dialog.removeAttribute("hidden");
      // Focus Cancel, so a stray Enter or Space dismisses rather than confirms.
      const cancelButton = dialog.querySelector('[data-dialog="cancel"]');
      if (typeof cancelButton.focus === "function") cancelButton.focus();
    });
  }

  _confirmThen(key, run, onCancel) {
    this._confirm(key).then((confirmed) => {
      if (confirmed) run();
      else if (onCancel) onCancel();
    });
  }

  /* --- events ------------------------------------------------------------ */

  _onClick(ev) {
    const target = ev.composedPath().find(
      (node) => node instanceof Element && node.hasAttribute && node.hasAttribute("data-action")
    );
    if (!target) return;
    const action = target.getAttribute("data-action");

    if (action === "camera-toggle") {
      this._cameraRevealed = !this._cameraRevealed;
      if (!this._cameraRevealed) this._releaseMedia();
      // Forget past failures so re-showing actually retries.
      this._mediaFailed = Object.create(null);
      this._mediaSlotState = null;
      this._fingerprint = null;
      this._update();
      return;
    }

    if (action === "camera-retry") {
      this._mediaFailed = Object.create(null);
      this._mediaSlotState = null;
      this._cameraRevealed = true;
      this._fingerprint = null;
      this._update();
      return;
    }

    const entityId = target.getAttribute("data-entity");
    if (!entityId) return;
    const key = target.getAttribute("data-key");

    switch (action) {
      case "press":
        if (!target.disabled) {
          this._confirmThen(key, () => this._call("button", "press", { entity_id: entityId }));
        }
        break;
      case "light-toggle":
        this._confirmThen(key, () => this._call("light", "toggle", { entity_id: entityId }));
        break;
      case "fan-toggle":
        this._confirmThen(key, () => this._call("fan", "toggle", { entity_id: entityId }));
        break;
      case "more-info":
        this._moreInfo(entityId);
        break;
      default:
        break;
    }
  }

  _onChange(ev) {
    const target = ev.target;
    if (!(target instanceof Element) || !target.hasAttribute("data-action")) return;
    const action = target.getAttribute("data-action");
    const entityId = target.getAttribute("data-entity");
    if (!entityId) return;
    const key = target.getAttribute("data-key");
    // Cancelling has to put the widget back: re-rendering restores it from the
    // entity's actual state.
    const revert = () => {
      this._fingerprint = null;
      this._update();
    };

    switch (action) {
      case "select-option": {
        const option = target.value;
        this._confirmThen(
          key,
          () => this._call("select", "select_option", { entity_id: entityId, option }),
          revert
        );
        break;
      }
      case "fan-percentage": {
        const percentage = Number(target.value);
        this._confirmThen(
          key,
          () => this._call("fan", "set_percentage", { entity_id: entityId, percentage }),
          revert
        );
        break;
      }
      case "set-number": {
        const value = Number(target.value);
        if (!Number.isFinite(value)) break;
        this._confirmThen(
          key,
          () => this._call("number", "set_value", { entity_id: entityId, value }),
          revert
        );
        break;
      }
      default:
        break;
    }
  }
}

/* ===========================================================================
 * Visual editor
 * ======================================================================== */

const EDITOR_SCHEMA = [
  { name: "device_id", required: true, selector: { device: { integration: INTEGRATION_DOMAIN } } },
  { name: "name", selector: { text: {} } },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "show_media", selector: { boolean: {} } },
      { name: "show_progress", selector: { boolean: {} } },
      { name: "show_details", selector: { boolean: {} } },
      { name: "show_filament", selector: { boolean: {} } },
      { name: "show_controls", selector: { boolean: {} } },
      { name: "confirm_actions", selector: { boolean: {} } },
    ],
  },
  {
    name: "show_camera",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "never", label: "Only when I press Show camera" },
          { value: "printing", label: "Automatically while printing" },
          { value: "always", label: "Always" },
        ],
      },
    },
  },
  { name: "camera_live", selector: { boolean: {} } },
];

const EDITOR_LABELS = {
  device_id: "Printer",
  name: "Name (optional)",
  show_media: "Show media",
  show_progress: "Show progress",
  show_details: "Show details",
  show_filament: "Show filament",
  show_controls: "Show controls",
  confirm_actions: "Confirm print actions",
  show_camera: "Chamber camera",
  camera_live: "Live stream (instead of periodic snapshots)",
};

class ElegooPrinterCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._form = null;
    this._loading = false;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    this._render();
  }

  /**
   * ha-form lives in a lazily loaded frontend chunk. Instantiating a built-in
   * card editor is the usual way to force that chunk to load before we try to
   * use it.
   */
  async _ensureHaForm() {
    if (this._loading || customElements.get("ha-form")) return;
    this._loading = true;
    try {
      const helpers = await window.loadCardHelpers();
      const card = await helpers.createCardElement({ type: "entities", entities: [] });
      if (card && card.constructor && card.constructor.getConfigElement) {
        await card.constructor.getConfigElement();
      }
    } catch (_err) {
      /* fall through to whenDefined below */
    }
    try {
      await customElements.whenDefined("ha-form");
    } catch (_err) {
      /* ignore */
    }
    this._loading = false;
    this._render();
  }

  _render() {
    if (!this._hass) return;
    if (!customElements.get("ha-form")) {
      if (!this.shadowRoot.firstChild) {
        this.shadowRoot.innerHTML =
          '<div style="padding:16px;color:var(--secondary-text-color)">Loading editor&hellip;</div>';
      }
      this._ensureHaForm();
      return;
    }
    if (!this._form) {
      this.shadowRoot.innerHTML = "";
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (schema) => EDITOR_LABELS[schema.name] || schema.name;
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        this._valueChanged(ev.detail.value);
      });
      this.shadowRoot.appendChild(this._form);
    }
    this._form.hass = this._hass;
    // A per-action list is YAML-only; show it as "on" and leave it untouched.
    const data = { ...DEFAULTS, ...this._config };
    if (Array.isArray(data.confirm_actions)) data.confirm_actions = true;
    this._form.schema = EDITOR_SCHEMA;
    this._form.data = data;
  }

  _valueChanged(value) {
    const config = { ...this._config, ...value };
    // Never flatten a YAML-authored confirm_actions list into a bare `true`.
    if (Array.isArray(this._config.confirm_actions) && value.confirm_actions === true) {
      config.confirm_actions = this._config.confirm_actions;
    }
    delete config.camera_always;
    if (!config.name) delete config.name;
    // Keep the YAML tidy: drop toggles that match the default.
    for (const key of Object.keys(DEFAULTS)) {
      if (config[key] === DEFAULTS[key]) delete config[key];
    }
    config.type = this._config.type || "custom:elegoo-printer-card";
    this._config = config;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true,
      })
    );
  }
}

/* ===========================================================================
 * Registration
 * ======================================================================== */

if (!customElements.get("elegoo-printer-card")) {
  customElements.define("elegoo-printer-card", ElegooPrinterCard);
}
if (!customElements.get("elegoo-printer-card-editor")) {
  customElements.define("elegoo-printer-card-editor", ElegooPrinterCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "elegoo-printer-card")) {
  window.customCards.push({
    type: "elegoo-printer-card",
    name: "Elegoo Printer Card",
    description:
      "Status, progress, camera and controls for a printer from the elegoo_printer integration.",
    preview: true,
    documentationURL: "https://github.com/nict41/hacs-elegoo-card",
  });
}

// eslint-disable-next-line no-console
console.info(
  "%c ELEGOO-PRINTER-CARD %c " + CARD_VERSION + " ",
  "color:#fff;background:#03a9f4;font-weight:700",
  "color:#03a9f4;background:#fff;font-weight:700"
);
