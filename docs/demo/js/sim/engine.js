/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// sim/engine.js — Scenario engine for what-if branches on turbine state.
// Steps forward through simple physics-light transitions of wind → power
// and thermal drift, producing baseline / optimistic (wind picks up) /
// stress (gearbox overheat injected) branches.

const RATED_KW = 2050;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function noise(amount) { return (Math.random() - 0.5) * amount; }

// Power curve (matches inference expected curve)
function expectedPower(v) {
  if (v < 3) return 0;
  if (v >= 12 && v < 25) return RATED_KW;
  if (v >= 25) return 0;
  const t = (v - 3) / (12 - 3);
  return RATED_KW * Math.pow(t, 2.6);
}

const BRANCH_PROFILES = {
  baseline:   { windDrift: 0.00,  windNoise: 0.4,  gearDrift: 0.00, bearDrift: 0.00 },
  optimistic: { windDrift: 0.08,  windNoise: 0.3,  gearDrift: -0.02, bearDrift: -0.01 },
  stress:     { windDrift: 0.02,  windNoise: 0.5,  gearDrift: 0.30, bearDrift: 0.15 },
};

export class SimulationEngine {
  runBranch(name, startState, steps = 30) {
    const p = BRANCH_PROFILES[name] || BRANCH_PROFILES.baseline;
    const out = [];
    let s = { ...startState };
    for (let i = 0; i < steps; i++) {
      const wind = clamp((s.wind_speed_ms ?? 0) + p.windDrift + noise(p.windNoise), 0, 28);
      const targetPower = expectedPower(wind);
      const power = clamp((s.power_kw ?? 0) * 0.6 + targetPower * 0.4 + noise(30), 0, RATED_KW * 1.02);
      const rotor = wind < 3 || wind > 25 ? 0 : clamp(4 + wind * 0.9, 0, 17);
      const gen = rotor * 94; // gearbox ratio ~94
      const gearbox = clamp((s.gearbox_oil_temp_c ?? 45) + p.gearDrift + noise(0.1), 20, 110);
      const bearing = clamp((s.generator_bearing_temp_c ?? 50) + p.bearDrift + noise(0.08), 20, 120);
      const vib = clamp(0.05 + (bearing - 50) * 0.01 + noise(0.01), 0, 1);

      s = {
        ...s,
        wind_speed_ms: wind,
        power_kw: power,
        rotor_rpm: rotor,
        generator_rpm: gen,
        gearbox_oil_temp_c: gearbox,
        generator_bearing_temp_c: bearing,
        vibration_proxy: vib,
      };
      out.push({ step: i, state: s });
    }
    return out;
  }
}

export class ScenarioManager {
  constructor(engine, inference) {
    this.engine = engine;
    this.inference = inference;
  }

  runAll(currentState) {
    const names = ['baseline', 'optimistic', 'stress'];
    const branches = names.map(name => {
      const trajectory = this.engine.runBranch(name, currentState);
      const finalState = trajectory[trajectory.length - 1].state;
      const meanPower = trajectory.reduce((s, p) => s + p.state.power_kw, 0) / trajectory.length;
      const peakGearbox = Math.max(...trajectory.map(p => p.state.gearbox_oil_temp_c));
      const peakBearing = Math.max(...trajectory.map(p => p.state.generator_bearing_temp_c));
      return {
        name, trajectory, final_state: finalState,
        mean_power_kw: meanPower,
        peak_gearbox_c: peakGearbox,
        peak_bearing_c: peakBearing,
      };
    });

    const active = this.select(branches);
    return { branches, active_branch: active };
  }

  select(branches) {
    const stress = branches.find(b => b.name === 'stress');
    if (stress && stress.peak_gearbox_c > 85) return 'stress';
    const opt = branches.find(b => b.name === 'optimistic');
    if (opt && opt.mean_power_kw > RATED_KW * 0.8) return 'optimistic';
    return 'baseline';
  }
}
