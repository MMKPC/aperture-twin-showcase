/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// ml/inference.js — composes the interpretable models into the turbine
// prediction bundle: power curve regression, gearbox-temp forecast,
// operational-state classifier, anomaly score with fault hypothesis.

import { LinearRegression, KNNRegressor, ModeClassifier, AnomalyScorer } from './models.js';

// Feature-vector order for the power-curve regression:
// [wind_speed, wind_speed^2, wind_speed^3, ambient_temp_c]
const POWER_FEATURES = ['wind_speed_ms', 'wind_speed_ms^2', 'wind_speed_ms^3', 'ambient_temp_c'];

// Gearbox-forecast vector: recent (power, rotor_rpm, ambient_temp) window stats
const GEARBOX_FEATURES = ['mean_power', 'slope_power', 'mean_rpm', 'ambient_temp_c', 'mean_gearbox'];

// Rated power for normalization — aligned with profile
const RATED_KW = 2050;

// Turbine-specific ModeClassifier subclass, replacing the avatar rules.
class TurbineStateClassifier {
  classify(s) {
    const path = [];
    const { wind_speed_ms, power_kw, pitch_angle_deg, rotor_rpm, anomaly_score = 0, op_state } = s;

    // Depth-2 rules operate on canonical SCADA signals.
    if (anomaly_score > 0.75) {
      path.push(`anomaly ${anomaly_score.toFixed(2)} > 0.75`);
      return { label: 'Faulted', path };
    }
    path.push(`anomaly ${anomaly_score.toFixed(2)} ≤ 0.75`);

    if (op_state === 'MaintenanceStop') {
      path.push('op_state=MaintenanceStop');
      return { label: 'MaintenanceStop', path };
    }

    if (wind_speed_ms > 25) {
      path.push(`wind ${wind_speed_ms.toFixed(1)} > 25 (cut-out)`);
      return { label: 'Stopped', path };
    }
    path.push(`wind ${wind_speed_ms.toFixed(1)} ≤ 25`);

    if (wind_speed_ms < 3) {
      path.push(`wind ${wind_speed_ms.toFixed(1)} < 3 (cut-in)`);
      return { label: 'Stopped', path };
    }
    path.push(`wind ${wind_speed_ms.toFixed(1)} ≥ 3`);

    if (wind_speed_ms > 12 && pitch_angle_deg > 3) {
      path.push(`wind > 12 & pitch ${pitch_angle_deg.toFixed(1)}° > 3° (above rated)`);
      return { label: 'Running', path };
    }

    if (rotor_rpm < 4 && wind_speed_ms > 5) {
      path.push(`rpm ${rotor_rpm.toFixed(1)} < 4 while wind ${wind_speed_ms.toFixed(1)} > 5`);
      return { label: 'DeRated', path };
    }

    if (power_kw < 0.3 * expectedPower(wind_speed_ms) && wind_speed_ms > 5) {
      path.push(`power ${power_kw.toFixed(0)}kW underperforming expected`);
      return { label: 'DeRated', path };
    }

    path.push('nominal envelope');
    return { label: 'Running', path };
  }
}

// Simple physics-based expected power (for fallback / reference)
function expectedPower(v) {
  if (v < 3) return 0;
  if (v >= 12 && v < 25) return RATED_KW;
  if (v >= 25) return 0;
  // cubic region, rho*A*Cp*v^3/2 normalized so rated hits at 12 m/s
  const t = (v - 3) / (12 - 3);
  return RATED_KW * Math.pow(t, 2.6);
}

export class InferenceEngine {
  constructor() {
    this.powerModel = new LinearRegression();
    this.gearboxModel = new KNNRegressor(4);
    this.classifier = new TurbineStateClassifier();
    this.anomaly = new AnomalyScorer();
    this._seedPriors();
  }

  _seedPriors() {
    // Power curve prior: sample points from the physics-based expected power,
    // fit a linear model in [v, v^2, v^3, T] space — a convex surrogate.
    const X = [], y = [];
    for (let v = 0; v <= 26; v += 0.5) {
      for (const T of [-5, 5, 15, 25]) {
        X.push([v, v * v, v * v * v, T]);
        // Physics-based expected power with tiny temp dependence
        const p = expectedPower(v) * (1 - 0.002 * (T - 15));
        y.push(p);
      }
    }
    this.powerModel.fit(X, y, POWER_FEATURES);

    // Gearbox forecast prior: higher load + high rpm + warm ambient → warmer gearbox
    const gX = [], gy = [];
    for (let p = 0; p <= RATED_KW; p += 200) {
      for (const rpm of [4, 8, 12, 16]) {
        for (const T of [-5, 5, 15, 25]) {
          gX.push([p, 0, rpm, T, 45 + 0.01 * p + 0.3 * rpm - 0.05 * T]);
          gy.push(45 + 0.012 * p + 0.35 * rpm - 0.04 * T);
        }
      }
    }
    this.gearboxModel.fit(gX, gy);
  }

  predict(features) {
    const s = features.current;
    const v = s.wind_speed_ms ?? 0;
    const T = s.ambient_temp_c ?? 15;
    const x = [v, v * v, v * v * v, T];

    // 1. Power curve — linear regression surrogate
    const powerPred = Math.max(0, Math.min(RATED_KW * 1.05, this.powerModel.predict(x)));

    // 2. Gearbox forecast — KNN over recent operating window
    const meanPower = features.means.power_kw ?? s.power_kw ?? 0;
    const slopePower = features.slopes.power_kw ?? 0;
    const meanRpm = features.means.rotor_rpm ?? s.rotor_rpm ?? 0;
    const meanGear = features.means.gearbox_oil_temp_c ?? s.gearbox_oil_temp_c ?? 45;
    const gearVec = [meanPower, slopePower, meanRpm, T, meanGear];
    let gearboxForecast = this.gearboxModel.predict(gearVec);
    // Incorporate recent slope — 10-step-ahead = current + ~10 * slope
    gearboxForecast = Math.max(20, gearboxForecast + 10 * slopePower * 0.1);

    // 3. Anomaly — multivariate score of residuals
    const powerResidual = (s.power_kw ?? 0) - powerPred;
    const gearResidual = (s.gearbox_oil_temp_c ?? 45) - meanGear;
    const bearingResidual = (s.generator_bearing_temp_c ?? 50)
      - (features.means.generator_bearing_temp_c ?? s.generator_bearing_temp_c ?? 50);
    const pitchDev = (s.pitch_angle_deg ?? 0) - commandedPitch(s);
    const yawMisalign = shortestAngle((s.yaw_angle_deg ?? 180) - (s.wind_direction_deg ?? 180));

    const residuals = {
      power: powerResidual / (RATED_KW * 0.5 + 1),
      gearbox: gearResidual / 10,
      bearing: bearingResidual / 10,
      pitch: pitchDev / 15,
      yaw: yawMisalign / 30,
    };
    const zVec = Object.values(residuals).map(r => Math.abs(r));
    const topZ = Math.max(...zVec);
    const anomaly = Math.max(0, Math.min(1, Math.tanh(topZ * 0.9)));

    // Fault hypothesis — which residual dominates AND direction
    const fault = hypothesize(residuals, s, anomaly);

    // 4. State classification
    const { label: stateLabel, path } = this.classifier.classify({
      wind_speed_ms: v,
      power_kw: s.power_kw ?? 0,
      pitch_angle_deg: s.pitch_angle_deg ?? 0,
      rotor_rpm: s.rotor_rpm ?? 0,
      anomaly_score: anomaly,
      op_state: s.operational_state,
    });

    // State probabilities — softmax-ish from distance to boundaries
    const probs = stateProbabilities(v, s.power_kw ?? 0, anomaly, s.operational_state);

    // Top contributors from power model explain
    const contribs = this.powerModel.explain(x, 3);

    // Also expose residuals as feature weights
    const residualContribs = Object.entries(residuals)
      .map(([feature, weight]) => ({ feature, weight }))
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 3);

    const explanation = buildExplanation({
      powerPred, actualPower: s.power_kw ?? 0, gearboxForecast,
      stateLabel, anomaly, fault, contribs, path,
    });

    return {
      power_prediction_kw: powerPred,
      gearbox_temp_forecast_10min_c: gearboxForecast,
      operational_state_predicted: stateLabel,
      state_probabilities: probs,
      anomaly_score: anomaly,
      power_residual_kw: powerResidual,
      top_contributors: residualContribs,
      power_feature_contribs: contribs,
      fault_hypothesis: fault,
      routing_path: path,
      explanation,
    };
  }
}

// Expected pitch given wind speed (simple heuristic matching typical Type III turbines)
function commandedPitch(s) {
  const v = s.wind_speed_ms ?? 0;
  if (v < 12) return 0;              // below rated → zero pitch
  if (v >= 25) return 90;            // cut-out → feathered
  return Math.min(25, (v - 12) * 2.2); // pitch-to-feather above rated
}

function shortestAngle(d) {
  let x = ((d + 180) % 360 + 360) % 360 - 180;
  return x;
}

function hypothesize(r, s, anomaly) {
  if (anomaly < 0.35) return null;
  // rank by magnitude
  const sorted = Object.entries(r).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [topKey, topVal] = sorted[0];

  if (topKey === 'gearbox' && topVal > 0.3) return 'gearbox_overheat';
  if (topKey === 'bearing' && topVal > 0.3) return 'generator_bearing_fault';
  if (topKey === 'pitch' && Math.abs(topVal) > 0.2) return 'pitch_actuator_stuck';
  if (topKey === 'yaw' && Math.abs(topVal) > 0.4) return 'yaw_misalignment';
  if (topKey === 'power' && topVal < -0.15 && (s.wind_speed_ms ?? 0) > 5) return 'icing_or_degradation';
  if ((s.wind_speed_ms ?? 0) > 25) return 'cut_out_exceedance';
  return 'unknown_anomaly';
}

function stateProbabilities(v, p, anomaly, current) {
  const probs = { Running: 0, DeRated: 0, Faulted: 0, Stopped: 0, MaintenanceStop: 0 };
  if (current === 'MaintenanceStop') { probs.MaintenanceStop = 1; return probs; }
  if (v < 3 || v > 25) { probs.Stopped = 0.9; probs.Faulted = 0.05; probs.DeRated = 0.05; return probs; }
  const expected = expectedPower(v);
  const perf = expected > 10 ? Math.max(0, Math.min(1, p / expected)) : 0.5;
  probs.Faulted = anomaly * 0.9;
  probs.Running = (1 - anomaly) * Math.min(1, perf + 0.1);
  probs.DeRated = (1 - anomaly) * Math.max(0, 1 - perf) * 0.8;
  probs.Stopped = Math.max(0, 1 - probs.Running - probs.Faulted - probs.DeRated);
  probs.MaintenanceStop = 0;
  // normalize
  const sum = Object.values(probs).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(probs)) probs[k] /= sum;
  return probs;
}

function buildExplanation({ powerPred, actualPower, gearboxForecast, stateLabel, anomaly, fault, contribs, path }) {
  const frag = [];
  frag.push(`State ${stateLabel}; predicted ${powerPred.toFixed(0)}kW vs actual ${actualPower.toFixed(0)}kW.`);
  frag.push(`Gearbox forecast ${gearboxForecast.toFixed(1)}°C (10-min horizon).`);
  if (anomaly > 0.35) frag.push(`Anomaly score ${anomaly.toFixed(2)}${fault ? ` — hypothesis: ${fault}` : ''}.`);
  if (contribs.length) frag.push(`Driver: ${contribs[0].name} (${contribs[0].value.toFixed(0)}).`);
  if (path.length) frag.push(`Rule: ${path.slice(0, 2).join(' → ')}.`);
  return frag.join(' ');
}
