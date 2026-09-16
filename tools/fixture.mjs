/**
 * Sample printer data for the screenshot tool.
 *
 * Shaped like a Centauri Carbon 2 (FDM, CC2 protocol, Canvas AMS fitted) as the
 * elegoo_printer integration exposes it. Entity IDs follow the integration's own
 * naming so the card's normal resolution path is exercised, not a shortcut.
 */
const DEV = "dev1";
const P = "centauri_carbon_2";
const MID = "3fa2b1c4d5";

export function buildHass(scenario, media = {}) {
  const entities = {};
  const states = {};
  const add = (eid, key, state, attributes = {}, tkey) => {
    entities[eid] = { device_id: DEV, platform: "elegoo_printer", translation_key: tkey };
    states[eid] = { entity_id: eid, state: String(state), attributes };
  };

  const printing = scenario === "printing";
  const paused = scenario === "paused";
  const active = printing || paused;

  add(`sensor.${P}_current_status`, "current_status", printing ? "printing" : "idle", {}, "current_status");
  add(`sensor.${P}_print_status`, "print_status", paused ? "paused" : printing ? "printing" : "idle", {}, "print_status");
  add(`sensor.${P}_print_error`, "print_error", "none", {}, "print_error");
  add(`sensor.${P}_file_name`, "filename", active ? "articulated-dragon_0.2mm_PLA.gcode" : "unknown");
  add(`sensor.${P}_percent_complete`, "percent_complete", active ? 63 : 0, { unit_of_measurement: "%" });
  add(`sensor.${P}_current_layer`, "current_layer", active ? 194 : 0);
  add(`sensor.${P}_total_layers`, "total_layers", active ? 308 : 0);
  add(`sensor.${P}_remaining_print_time`, "ticks_remaining", active ? 96 : 0, { unit_of_measurement: "min", device_class: "duration" });
  add(`sensor.${P}_begin_time`, "begin_time", "2026-09-16T09:12:00+00:00", { device_class: "timestamp" });
  add(`sensor.${P}_end_time`, "end_time", "2026-09-16T13:48:00+00:00", { device_class: "timestamp" });

  add(`sensor.${P}_nozzle_temperature`, "nozzle_temp", active ? "214.6" : "24.1", { unit_of_measurement: "°C" });
  add(`sensor.${P}_bed_temperature`, "bed_temp", active ? "60.0" : "23.8", { unit_of_measurement: "°C" });
  add(`sensor.${P}_box_temp`, "temp_of_box", active ? "34.2" : "23.5", { unit_of_measurement: "°C" });
  add(`sensor.${P}_model_fan_speed`, "model_fan_speed", active ? 100 : 0, { unit_of_measurement: "%" });
  add(`sensor.${P}_auxiliary_fan_speed`, "aux_fan_speed", active ? 60 : 0, { unit_of_measurement: "%" });
  add(`sensor.${P}_enclosure_fan_speed`, "box_fan_speed", 0, { unit_of_measurement: "%" });

  add(`binary_sensor.${P}_sdcp_status`, "sdcp_status", "on");
  // Real Home Assistant proxy paths, so the card's own URL handling (the
  // camera_proxy -> camera_proxy_stream swap, and the image cache key) is
  // exercised exactly as it is in production. The screenshot tool intercepts
  // these requests and serves the placeholder artwork.
  if (media.cover) {
    add(`image.${P}_cover_image`, "cover_image", "2026-09-16T09:12:00+00:00", {
      entity_picture: `/api/image_proxy/image.${P}_cover_image?token=preview`,
    });
  }
  if (media.chamber) {
    add(`camera.${P}_chamber_camera`, "chamber_camera", "idle", {
      entity_picture: `/api/camera_proxy/camera.${P}_chamber_camera?token=preview`,
    });
  }

  add(`light.${P}_chamber_light`, "second_light", "on");
  add(`select.${P}_print_speed`, "print_speed", "Balanced", { options: ["Silent", "Balanced", "Sport", "Ludicrous"] });
  add(`number.${P}_target_nozzle_temp`, "target_nozzle_temp", active ? 215 : 0, { min: 0, max: 320, step: 1 });
  add(`number.${P}_target_bed_temp`, "target_bed_temp", active ? 60 : 0, { min: 0, max: 110, step: 1 });

  add(`button.${P}_pause_print`, "pause_print", printing ? "unknown" : "unavailable");
  add(`button.${P}_resume_print`, "resume_print", paused ? "unknown" : "unavailable");
  add(`button.${P}_stop_print`, "stop_print", active ? "unknown" : "unavailable");
  add(`button.${P}_home_all`, "home_all", active ? "unavailable" : "unknown");

  add(`fan.${P}_model_fan`, "model_fan", active ? "on" : "off", { percentage: active ? 100 : 0, percentage_step: 1 });
  add(`fan.${P}_auxiliary_fan`, "auxiliary_fan", active ? "on" : "off", { percentage: active ? 60 : 0, percentage_step: 1 });
  add(`fan.${P}_enclosure_fan`, "box_fan", "off", { percentage: 0, percentage_step: 1 });

  add(`sensor.${P}_active_filament_color`, "active_filament_color", "#E5533D");
  add(`sensor.${P}_active_tray_id`, "active_tray_id", "2");
  const colors = ["#2E7D32", "#E5533D", "#1565C0", "#ECEFF1"];
  const names = ["Elegoo PLA+ Green", "Elegoo PLA+ Red", "Sunlu PETG Blue", "Elegoo PLA White"];
  const types = ["PLA", "PLA", "PETG", "PLA"];
  for (let i = 1; i <= 4; i++) {
    add(`sensor.${P}_a${i}_color`, `a${i}_color`, colors[i - 1]);
    add(`sensor.${P}_a${i}_name`, `a${i}_name`, names[i - 1]);
    add(`sensor.${P}_a${i}_attributes`, `a${i}_attributes`, types[i - 1], { brand: "Elegoo", diameter: 1.75 });
  }

  return {
    states,
    entities,
    devices: { [DEV]: { id: DEV, name: "Centauri Carbon 2", model: "Centauri Carbon 2", manufacturer: "Elegoo" } },
    locale: { language: "en" },
    // callService / callWS are attached in the browser context: functions do
    // not survive Playwright's serialisation boundary.
  };
}
