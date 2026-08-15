/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// features/builders.js — feature pipeline generalized over any numeric series.
// Produces rolling means, slopes, volatility and a short-window vector suited
// to the SCADA inference targets (power curve, gearbox forecast, state, anomaly).

const TRACKED_KEYS = [
  'wind_speed_ms', 'ambient_temp_c', 'power_kw',
  'rotor_rpm', 'generator_rpm',
  'gearbox_oil_temp_c', 'generator_bearing_temp_c', 'vibration_proxy',
  'pitch_angle_deg', 'yaw_angle_deg', 'nacelle_direction_deg',
];

export function buildFeatures(store, windowMs = 120_000) {
  const now = Date.now();
  const hist = store.getHistory();
  const windowStart = now - windowMs;
  const current = store.getCurrent().state;

  const recent = hist.filter(h => Date.parse(h.ts) >= windowStart);

  if (recent.length === 0) {
    const means = {}, slopes = {}, vol = {};
    for (const k of TRACKED_KEYS) { means[k] = current[k] ?? 0; slopes[k] = 0; vol[k] = 0; }
    return {
      current, window_ms: windowMs, samples: 0,
      means, slopes, volatility: vol,
      recent_power: [], recent_gearbox_temp: [], recent_bearing_temp: [],
      recent_rotor_rpm: [], recent_wind: [],
      gap: true, uncertainty: 1.0,
    };
  }

  const means = {}, slopes = {}, vol = {};
  for (const k of TRACKED_KEYS) {
    const series = recent.map(r => r.state[k]).filter(v => typeof v === 'number' && Number.isFinite(v));
    if (!series.length) { means[k] = current[k] ?? 0; slopes[k] = 0; vol[k] = 0; continue; }
    means[k] = avg(series);
    slopes[k] = linearSlope(series);
    vol[k] = stddev(series);
  }

  const recent_power = recent.map(r => r.state.power_kw ?? 0);
  const recent_gearbox_temp = recent.map(r => r.state.gearbox_oil_temp_c ?? 0);
  const recent_bearing_temp = recent.map(r => r.state.generator_bearing_temp_c ?? 0);
  const recent_rotor_rpm = recent.map(r => r.state.rotor_rpm ?? 0);
  const recent_wind = recent.map(r => r.state.wind_speed_ms ?? 0);

  const conf = avg(recent.map(r => r.event.confidence ?? 1));

  return {
    current, window_ms: windowMs, samples: recent.length,
    means, slopes, volatility: vol,
    recent_power, recent_gearbox_temp, recent_bearing_temp,
    recent_rotor_rpm, recent_wind,
    gap: false, uncertainty: 1 - conf,
  };
}

function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(avg(arr.map(v => (v - m) ** 2)));
}
function linearSlope(arr) {
  const n = arr.length;
  if (n < 2) return 0;
  const xs = arr.map((_, i) => i);
  const mx = avg(xs), my = avg(arr);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (arr[i] - my); den += (xs[i] - mx) ** 2; }
  return den === 0 ? 0 : num / den;
}
