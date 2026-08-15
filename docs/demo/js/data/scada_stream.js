/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// data/scada_stream.js — synthetic SCADA generator for the Wind Turbine DT.
// Emits realistic 10-minute-interval records compressed to 1 record/second
// for demo realism. Daily/diurnal wind pattern + IEC 61400-12 power curve.
// Fault modes are injectable via setFault(name).

const RATED_KW = 2050;
const CUT_IN = 3;
const CUT_OUT = 25;
const RATED_WIND = 12;

// IEC 61400-12-style power curve: zero below cut-in, cubic region up to
// rated wind speed, flat at rated power, zero above cut-out.
export function powerCurve(v) {
  if (v < CUT_IN) return 0;
  if (v >= RATED_WIND && v < CUT_OUT) return RATED_KW;
  if (v >= CUT_OUT) return 0;
  const t = (v - CUT_IN) / (RATED_WIND - CUT_IN);
  return RATED_KW * Math.pow(t, 2.6);
}

// Faults we can inject.  Each fault is applied to the generated payload.
const FAULT_MODES = {
  normal: null,
  gearbox_overheat: (p, ctx) => {
    // gearbox_oil_temp_c drifts up ~0.5°C per sample
    ctx.gearboxDrift = (ctx.gearboxDrift || 0) + 0.5;
    p.gearbox_oil_temp_c += ctx.gearboxDrift;
    if (p.gearbox_oil_temp_c > 95) p.operational_state = 'Faulted';
  },
  pitch_stuck: (p, ctx) => {
    // Pitch actuator frozen at whatever it was when the fault triggered.
    if (ctx.stuckPitch == null) ctx.stuckPitch = p.pitch_angle_deg;
    p.pitch_angle_deg = ctx.stuckPitch;
    // Above rated wind, power overshoots because pitch didn't feather
    if (p.wind_speed_ms > RATED_WIND) p.power_kw *= 1.08;
  },
  yaw_misalignment: (p, ctx) => {
    ctx.yawOffset = ctx.yawOffset || (Math.random() * 20 + 20);  // 20-40°
    p.yaw_angle_deg = normDeg(p.wind_direction_deg + ctx.yawOffset);
    p.nacelle_direction_deg = p.yaw_angle_deg;
    // Yaw misalignment reduces aerodynamic efficiency by cos^3(err)
    const err = (ctx.yawOffset * Math.PI) / 180;
    p.power_kw *= Math.pow(Math.cos(err), 3);
  },
  generator_bearing_fault: (p, ctx) => {
    ctx.bearingDrift = (ctx.bearingDrift || 0) + 0.4;
    p.generator_bearing_temp_c += ctx.bearingDrift;
    p.vibration_proxy = Math.min(1, 0.05 + ctx.bearingDrift * 0.02);
    if (p.generator_bearing_temp_c > 100) p.operational_state = 'Faulted';
  },
  icing: (p) => {
    // Blades accumulate ice — power under-performs predicted by 15-30%
    const under = 0.15 + Math.random() * 0.15;
    p.power_kw *= (1 - under);
    p.ambient_temp_c = Math.min(p.ambient_temp_c, -1);
  },
  cut_out: (p) => {
    // Wind exceeds 25 m/s cut-out threshold — turbine stops
    p.wind_speed_ms = 26 + Math.random() * 3;
    p.power_kw = 0;
    p.rotor_rpm = 0;
    p.generator_rpm = 0;
    p.pitch_angle_deg = 90; // feathered
    p.operational_state = 'Stopped';
  },
};

export class ScadaStream {
  constructor({ secondsPerSample = 1, startSeed = 0, gateway = null } = {}) {
    this.secondsPerSample = secondsPerSample;
    this.gateway = gateway;
    this._t = startSeed;        // logical elapsed time (samples * 10min)
    this._timer = null;
    this._fault = 'normal';
    this._faultCtx = {};
    this._yawTarget = 180;       // nacelle lags wind direction
  }

  setGateway(gw) { this.gateway = gw; }

  setFault(name) {
    if (!FAULT_MODES.hasOwnProperty(name)) throw new Error(`unknown fault ${name}`);
    this._fault = name;
    this._faultCtx = {};
  }

  getFault() { return this._fault; }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._tick(), this.secondsPerSample * 1000);
    // immediate first tick so the UI isn't blank
    this._tick();
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  isRunning() { return !!this._timer; }

  generate() {
    // Each sample = one 10-minute SCADA record (compressed to 1s in wallclock)
    const stepMinutes = 10;
    this._t += stepMinutes;

    const hourOfDay = ((this._t / 60) % 24 + 24) % 24;
    // Diurnal wind pattern: peak ~14:00, low ~04:00, plus coloured noise
    const diurnal = 4 + 4 * Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI);
    const gust = 2.5 * Math.sin(this._t / 37) + 1.3 * Math.sin(this._t / 11);
    const microNoise = (Math.random() - 0.5) * 1.2;
    let wind = Math.max(0, diurnal + gust + microNoise);

    // Ambient temp tracks hour of day
    const ambient = 10 + 7 * Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI) + (Math.random() - 0.5);

    // Wind direction slow wander
    const direction = normDeg(180 + 40 * Math.sin(this._t / 250) + (Math.random() - 0.5) * 4);

    // Power from IEC 61400-12 curve
    let power = powerCurve(wind);

    // Pitch: 0° below rated, pitch-to-feather above rated
    let pitch = 0;
    if (wind > RATED_WIND && wind < CUT_OUT) pitch = Math.min(25, (wind - RATED_WIND) * 2.2);
    if (wind >= CUT_OUT) pitch = 90;

    // RPM: roughly proportional to wind in the linear range
    let rotor = 0;
    if (wind >= CUT_IN && wind < CUT_OUT) rotor = Math.min(16.5, 4 + (wind - CUT_IN) * 0.9);
    const generator = rotor * 94; // typical gearbox ratio

    // Yaw tracks wind direction with first-order lag
    this._yawTarget += (shortestAngle(direction - this._yawTarget)) * 0.25;
    const yaw = normDeg(this._yawTarget);

    // Thermal model: gearbox and bearing temps rise with load
    const gearbox = 45 + power * 0.012 + rotor * 0.35 + (Math.random() - 0.5) * 0.3;
    const bearing = 50 + power * 0.010 + rotor * 0.30 + (Math.random() - 0.5) * 0.3;
    const vibration = 0.05 + Math.abs(rotor) * 0.003 + (Math.random() - 0.5) * 0.01;

    const grid_voltage = 690 + (Math.random() - 0.5) * 4;
    const grid_frequency = 50.0 + (Math.random() - 0.5) * 0.05;

    let operational_state;
    if (wind < CUT_IN || wind >= CUT_OUT) operational_state = 'Stopped';
    else if (power < 0.3 * powerCurve(wind) && wind > 5) operational_state = 'DeRated';
    else operational_state = 'Running';

    const payload = {
      wind_speed_ms: round(wind, 2),
      wind_direction_deg: round(direction, 1),
      ambient_temp_c: round(ambient, 2),
      power_kw: round(power, 1),
      rotor_rpm: round(rotor, 2),
      generator_rpm: round(generator, 1),
      pitch_angle_deg: round(pitch, 2),
      yaw_angle_deg: round(yaw, 1),
      nacelle_direction_deg: round(yaw, 1),
      gearbox_oil_temp_c: round(gearbox, 2),
      generator_bearing_temp_c: round(bearing, 2),
      vibration_proxy: round(vibration, 3),
      grid_voltage_v: round(grid_voltage, 1),
      grid_frequency_hz: round(grid_frequency, 3),
      operational_state,
    };

    // Inject fault
    const faultFn = FAULT_MODES[this._fault];
    if (faultFn) faultFn(payload, this._faultCtx);

    // Re-clamp after fault mutation
    payload.power_kw = Math.max(0, Math.min(RATED_KW * 1.1, payload.power_kw));
    payload.gearbox_oil_temp_c = Math.max(-10, Math.min(150, payload.gearbox_oil_temp_c));
    payload.generator_bearing_temp_c = Math.max(-10, Math.min(150, payload.generator_bearing_temp_c));

    // Round again
    for (const k of Object.keys(payload)) {
      if (typeof payload[k] === 'number') payload[k] = round(payload[k], 3);
    }

    return payload;
  }

  _tick() {
    if (!this.gateway) return;
    const payload = this.generate();
    this.gateway.accept({
      source: 'scada',
      event_type: 'scada_sample',
      payload,
      confidence: 0.95,
    });
  }
}

// List of available fault presets — exposed for the UI dropdown.
export const FAULT_PRESETS = [
  { id: 'normal',                  label: 'Normal operation' },
  { id: 'gearbox_overheat',        label: 'Gearbox overheat (drift)' },
  { id: 'pitch_stuck',             label: 'Pitch actuator stuck' },
  { id: 'yaw_misalignment',        label: 'Yaw misalignment' },
  { id: 'generator_bearing_fault', label: 'Generator bearing fault' },
  { id: 'icing',                   label: 'Blade icing (power loss)' },
  { id: 'cut_out',                 label: 'Cut-out wind > 25 m/s' },
];

function round(x, d = 2) { const k = Math.pow(10, d); return Math.round(x * k) / k; }
function normDeg(d) { return ((d % 360) + 360) % 360; }
function shortestAngle(d) {
  let x = ((d + 180) % 360 + 360) % 360 - 180;
  return x;
}
