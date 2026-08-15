/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// main.js — Wind Turbine Digital Twin orchestration.
// Pipeline: SCADA sample → gateway → state → features → ML inference →
//           scenarios → actuator (auto) → annunciator → 3D scene + dashboard.

import { bus, CH } from './core/bus.js';
import { makeTwin } from './core/schemas.js';
import { TwinStateStore } from './twin/state_store.js';
import { IngestGateway } from './ingest/gateway.js';
import { buildFeatures } from './features/builders.js';
import { InferenceEngine } from './ml/inference.js';
import { SimulationEngine, ScenarioManager } from './sim/engine.js';
import { TurbineActuator } from './behavior/actuator.js';
import { Annunciator } from './ops/annunciator.js';
import { TurbineRuntime } from './scene/turbine_runtime.js';
import { Dashboard } from './ui/dashboard.js';
import { Replay } from './sim/replay.js';
import { ScadaStream, FAULT_PRESETS } from './data/scada_stream.js';

// ---------- boot ----------

const twin = makeTwin();
const store = new TwinStateStore(twin);
const gateway = new IngestGateway(store);
const inference = new InferenceEngine();
const simEngine = new SimulationEngine();
const scenarios = new ScenarioManager(simEngine, inference);
const actuator = new TurbineActuator(store);
const annunciator = new Annunciator();
const turbine3D = new TurbineRuntime(document.getElementById('scene-canvas'));
const dashboard = new Dashboard({ annunciator });
const replay = new Replay();
const scada = new ScadaStream({ secondsPerSample: 1, gateway });

let prevFaultHypothesis = null;

// Initial renders
bus.emit(CH.STATE, twin);
const firstFeatures = buildFeatures(store);
const firstPred = inference.predict(firstFeatures);
store.setPrediction(firstPred);
bus.emit(CH.PREDICTION, firstPred);
const firstSim = scenarios.runAll(store.getCurrent().state);
store.setSimulation({ active_branch: firstSim.active_branch });
bus.emit(CH.SIMULATION, firstSim);

// Initial behavior snapshot
bus.emit(CH.BEHAVIOR, { ...store.getCurrent().actuator });

// ---------- main loop: triggered per SCADA sample ----------

bus.on(CH.EVENT, (ev) => {
  const t0 = performance.now();

  const current = store.getCurrent();
  const features = buildFeatures(store);
  const prediction = inference.predict(features);
  store.setPrediction(prediction);
  bus.emit(CH.PREDICTION, prediction);

  // Trigger scenarios on anomaly or underperformance
  const needsSim =
    prediction.anomaly_score > 0.45 ||
    Math.abs(prediction.power_residual_kw) > 200 ||
    (performance.now() - (main._lastSim || 0)) > 5000;
  if (needsSim) {
    const sim = scenarios.runAll(store.getCurrent().state);
    store.setSimulation({
      active_branch: sim.active_branch,
      branches: sim.branches.map(b => ({
        name: b.name, mean_power_kw: b.mean_power_kw,
        peak_gearbox_c: b.peak_gearbox_c, peak_bearing_c: b.peak_bearing_c,
      })),
    });
    bus.emit(CH.SIMULATION, sim);
    main._lastSim = performance.now();
  }

  // Auto-alarm if a new fault surfaces
  if (prediction.fault_hypothesis && prediction.fault_hypothesis !== prevFaultHypothesis) {
    actuator.raiseAlarm(prediction.fault_hypothesis);
  }
  annunciator.considerPrediction(prediction, prevFaultHypothesis);
  prevFaultHypothesis = prediction.fault_hypothesis;

  // Auto-yaw toward wind (simple closed-loop demo of actuator surface)
  if (typeof current.state.wind_direction_deg === 'number') {
    actuator.trackWind(current.state.wind_direction_deg);
  }

  // Update 3D scene
  turbine3D.updateState(current.state);
  turbine3D.updatePrediction(prediction);

  // Replay capture
  replay.capture(ev);

  // Latency
  const ms = performance.now() - t0;
  bus.emit(CH.LATENCY, ms);
});
const main = { _lastSim: 0 };

// ---------- UI bindings ----------

// Theme toggle
document.getElementById('btn-toggle-theme').addEventListener('click', () => {
  const root = document.documentElement;
  root.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// SCADA stream controls
const streamBtn = document.getElementById('btn-stream');
function updateStreamBtn() { streamBtn.textContent = scada.isRunning() ? 'Pause Stream' : 'Start Stream'; }
streamBtn.addEventListener('click', () => {
  if (scada.isRunning()) scada.stop(); else scada.start();
  updateStreamBtn();
});
updateStreamBtn();

// Fault injection selector
const faultSel = document.getElementById('fault-select');
FAULT_PRESETS.forEach(p => {
  const opt = document.createElement('option');
  opt.value = p.id; opt.textContent = p.label;
  faultSel.appendChild(opt);
});
faultSel.addEventListener('change', (e) => {
  scada.setFault(e.target.value);
  annunciator.fire({
    severity: e.target.value === 'normal' ? 'INFO' : 'WARN',
    code: `fault_injection_${e.target.value}`,
    message: `Fault injection set to: ${e.target.value}`,
    source: 'operator',
  });
});

// Actuator manual controls
document.getElementById('btn-shutdown').addEventListener('click', () => {
  actuator.triggerShutdown('operator_shutdown');
});
document.getElementById('btn-reset-alarm').addEventListener('click', () => {
  actuator.resetAlarm();
  annunciator.acknowledgeAll();
});
document.getElementById('btn-set-pitch').addEventListener('click', () => {
  const deg = parseFloat(document.getElementById('input-pitch').value);
  if (Number.isFinite(deg)) actuator.setPitch(deg);
});
document.getElementById('btn-set-yaw').addEventListener('click', () => {
  const deg = parseFloat(document.getElementById('input-yaw').value);
  if (Number.isFinite(deg)) actuator.setYaw(deg);
});

// Simulation button
document.getElementById('btn-simulate').addEventListener('click', () => {
  const sim = scenarios.runAll(store.getCurrent().state);
  store.setSimulation({ active_branch: sim.active_branch });
  bus.emit(CH.SIMULATION, sim);
});

// Scenario quick buttons — drive stream into named fault
document.querySelectorAll('button[data-scenario]').forEach(btn => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.scenario;
    scada.setFault(name);
    faultSel.value = name;
    if (!scada.isRunning()) { scada.start(); updateStreamBtn(); }
    annunciator.fire({
      severity: name === 'normal' ? 'INFO' : 'WARN',
      code: `scenario_${name}`, message: `Scenario activated: ${name}`, source: 'operator',
    });
  });
});

// Replay
document.getElementById('btn-replay-start').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if (!replay.recording) {
    const id = replay.start();
    btn.textContent = 'Stop';
    document.getElementById('replay-tag').textContent = id.slice(-6);
    document.getElementById('btn-replay-play').disabled = true;
  } else {
    const sess = replay.stop();
    btn.textContent = 'Record';
    document.getElementById('replay-tag').textContent = `${sess.events.length} ev`;
    document.getElementById('btn-replay-play').disabled = sess.events.length === 0;
    window.__lastSession = sess;
  }
});

document.getElementById('btn-replay-play').addEventListener('click', async () => {
  const sess = window.__lastSession;
  if (!sess) return;
  await replay.play(sess, gateway);
});

document.getElementById('btn-replay-export').addEventListener('click', () => {
  const sess = window.__lastSession || replay.session;
  if (!sess) return;
  const blob = new Blob([JSON.stringify(sess, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sess.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- developer-facing API ----------

window.twin = {
  getState: () => store.getCurrent(),
  getHistory: () => store.getHistory(),
  push: (payload, source = 'api') =>
    gateway.accept({ source, event_type: 'scada_sample', payload }),
  predict: () => {
    const p = inference.predict(buildFeatures(store));
    bus.emit(CH.PREDICTION, p);
    return p;
  },
  simulate: () => {
    const sim = scenarios.runAll(store.getCurrent().state);
    bus.emit(CH.SIMULATION, sim);
    return sim;
  },
  stream: scada,
  actuator,
  annunciator,
  on: (ch, fn) => bus.on(ch, fn),
};

// Auto-start the SCADA stream so the demo is alive on first load
scada.start();
updateStreamBtn();

console.log(
  '%cAperture Wind Turbine Digital Twin ready',
  'color:#4bc6cd;font-family:monospace;font-weight:700',
);
console.log('Try: twin.stream.setFault("gearbox_overheat")  |  twin.actuator.triggerShutdown()');
