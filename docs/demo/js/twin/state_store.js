/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// twin/state_store.js — canonical turbine state + rolling history
// Reducer folds SCADA samples into state with confidence-weighted smoothing.

import { bus, CH } from '../core/bus.js';
import { nowISO, SCADA_NUMERIC_FIELDS, VALID_OP_STATES } from '../core/schemas.js';

const MAX_HISTORY = 1000;

export class TwinStateStore {
  constructor(twin) {
    this.twin = twin;
    this.history = [];
  }

  getCurrent() { return this.twin; }

  getHistory(start = null, end = null) {
    if (!start && !end) return this.history.slice();
    return this.history.filter(h => {
      const t = Date.parse(h.ts);
      if (start && t < Date.parse(start)) return false;
      if (end && t > Date.parse(end)) return false;
      return true;
    });
  }

  upsertEvent(event) {
    const t = this.twin;
    t.timestamps.updated_at = event.ts;

    if (event.event_type === 'scada_sample' || event.event_type === 'state_update') {
      const alpha = Math.max(0, Math.min(1, event.confidence ?? 1));
      for (const [k, v] of Object.entries(event.payload)) {
        if (k === 'operational_state') {
          if (VALID_OP_STATES.has(v)) t.state.operational_state = v;
        } else if (SCADA_NUMERIC_FIELDS.has(k) && typeof v === 'number') {
          // confidence-weighted smoothing on numeric channels
          const prev = t.state[k];
          t.state[k] = typeof prev === 'number'
            ? prev * (1 - alpha) + v * alpha
            : v;
        }
      }
    }

    this.history.push({
      ts: event.ts,
      event,
      state: cloneState(t.state),
    });
    if (this.history.length > MAX_HISTORY) this.history.shift();

    bus.emit(CH.STATE, this.twin);
  }

  setOperationalState(s) {
    this.twin.state.operational_state = s;
    this.twin.timestamps.updated_at = nowISO();
    bus.emit(CH.STATE, this.twin);
  }

  setPrediction(prediction) {
    this.twin.predictions = { ...this.twin.predictions, ...prediction };
    bus.emit(CH.STATE, this.twin);
  }

  setSimulation(sim) {
    this.twin.simulation = { ...this.twin.simulation, ...sim };
    bus.emit(CH.STATE, this.twin);
  }

  setActuator(partial) {
    this.twin.actuator = { ...this.twin.actuator, ...partial };
    bus.emit(CH.STATE, this.twin);
  }

  reset(twin) {
    this.twin = twin;
    this.history = [];
    bus.emit(CH.STATE, this.twin);
  }
}

function cloneState(s) { return JSON.parse(JSON.stringify(s)); }
