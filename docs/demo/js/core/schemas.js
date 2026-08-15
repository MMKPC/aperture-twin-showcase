/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// core/schemas.js — canonical Wind Turbine twin object + SCADA event validator
// Schema based on the Kelmarsh open SCADA dataset (Zenodo 5841834):
// 10-min-interval wind turbine telemetry fields for IEC 61400-compliant DTs.

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowISO() { return new Date().toISOString(); }

// Asset profile — the Kelmarsh-1 turbine (Senvion MM92, 2.05 MW)
// commissioned 2016, 45m blades, 78.5m hub height.
export function makeTwin({
  asset_id = 'KWF-01',
  manufacturer = 'Senvion',
  model = 'MM92',
  rated_power_kw = 2050,
  hub_height_m = 78.5,
  rotor_diameter_m = 92.5,
  commissioning_date = '2016-09-01',
  location = 'Kelmarsh, UK',
} = {}) {
  return {
    twin_id: uuid(),
    entity_type: 'wind_turbine',
    profile: {
      asset_id,
      manufacturer,
      model,
      rated_power_kw,
      hub_height_m,
      rotor_diameter_m,
      commissioning_date,
      location,
      cut_in_ms: 3,
      rated_ms: 12,
      cut_out_ms: 25,
    },
    state: {
      // Environmental
      wind_speed_ms: 0,
      wind_direction_deg: 180,
      ambient_temp_c: 12,
      // Electrical
      power_kw: 0,
      grid_voltage_v: 690,
      grid_frequency_hz: 50.0,
      // Mechanical
      rotor_rpm: 0,
      generator_rpm: 0,
      gearbox_oil_temp_c: 45,
      generator_bearing_temp_c: 50,
      vibration_proxy: 0.05,
      // Control
      pitch_angle_deg: 0,
      yaw_angle_deg: 180,
      nacelle_direction_deg: 180,
      operational_state: 'Stopped',
    },
    actuator: {
      pitch_cmd_deg: 0,
      yaw_cmd_deg: 180,
      alarm_state: 'clear',
      latched_faults: [],
    },
    predictions: {
      power_prediction_kw: 0,
      gearbox_temp_forecast_10min_c: 45,
      operational_state_predicted: 'Stopped',
      anomaly_score: 0,
      top_contributors: [],
      fault_hypothesis: null,
      routing_path: [],
      explanation: 'Awaiting first SCADA sample.',
    },
    simulation: { active_branch: 'baseline', branches: [] },
    timestamps: { created_at: nowISO(), updated_at: nowISO() },
  };
}

// Event factory — for SCADA samples the payload conforms to the schema below.
export function makeEvent({
  twin_id,
  source = 'scada',
  event_type = 'scada_sample',
  payload = {},
  confidence = 1.0,
} = {}) {
  return {
    event_id: uuid(),
    twin_id,
    source,
    event_type,
    payload,
    confidence,
    ts: nowISO(),
  };
}

// Numeric SCADA fields — also the set of keys accepted by state_update payloads.
export const SCADA_NUMERIC_FIELDS = new Set([
  'wind_speed_ms', 'wind_direction_deg', 'ambient_temp_c',
  'power_kw', 'grid_voltage_v', 'grid_frequency_hz',
  'rotor_rpm', 'generator_rpm',
  'gearbox_oil_temp_c', 'generator_bearing_temp_c', 'vibration_proxy',
  'pitch_angle_deg', 'yaw_angle_deg', 'nacelle_direction_deg',
]);

export const VALID_OP_STATES = new Set([
  'Running', 'Stopped', 'Faulted', 'MaintenanceStop', 'DeRated',
]);

const VALID_SOURCES = new Set(['scada', 'sensor', 'api', 'manual', 'file', 'sim', 'actuator']);

export function validateEvent(ev) {
  const errors = [];
  if (!ev || typeof ev !== 'object') { errors.push('event is not an object'); return { ok: false, errors }; }
  if (!ev.event_id) errors.push('missing event_id');
  if (!ev.twin_id) errors.push('missing twin_id');
  if (!VALID_SOURCES.has(ev.source)) errors.push(`unknown source "${ev.source}"`);
  if (typeof ev.confidence !== 'number' || ev.confidence < 0 || ev.confidence > 1) {
    errors.push('confidence must be in [0,1]');
  }
  if (ev.event_type === 'scada_sample' || ev.event_type === 'state_update') {
    if (!ev.payload || typeof ev.payload !== 'object') {
      errors.push('sample requires payload object');
    } else {
      for (const [k, v] of Object.entries(ev.payload)) {
        if (k === 'operational_state') {
          if (!VALID_OP_STATES.has(v)) errors.push(`invalid operational_state "${v}"`);
        } else if (!SCADA_NUMERIC_FIELDS.has(k)) {
          errors.push(`unknown field "${k}"`);
        } else if (typeof v !== 'number' || !Number.isFinite(v)) {
          errors.push(`field "${k}" must be a finite number`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
