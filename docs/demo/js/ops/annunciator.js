/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// ops/annunciator.js — SCADA/DCS-style alarm annunciator panel.
// Replaces the voice/dialogue layer. Maintains a ring buffer of
// operator-relevant events with severity, timestamp, and acknowledge state.

import { bus, CH } from '../core/bus.js';

const MAX_EVENTS = 200;

const SEVERITY_RANK = { INFO: 0, WARN: 1, ALARM: 2 };

export class Annunciator {
  constructor() {
    this.events = [];
    this._listeners = new Set();
    this._wire();
  }

  _wire() {
    // Log channel — system messages from actuators / validation
    bus.on(CH.LOG, (log) => {
      const severity = this._severityForLog(log);
      this.fire({
        severity,
        code: log.fault || log.reason || severity.toLowerCase(),
        message: log.msg,
        source: 'system',
      });
    });
  }

  _severityForLog(log) {
    const lv = (log.level || '').toLowerCase();
    if (lv === 'alarm' || lv === 'error') return 'ALARM';
    if (lv === 'warn' || lv === 'warning') return 'WARN';
    return 'INFO';
  }

  // Raise a new annunciator event. Returns the event.
  fire({ severity = 'INFO', code = 'generic', message = '', source = 'system' }) {
    const ev = {
      id: `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toISOString(),
      severity: severity.toUpperCase(),
      code,
      message,
      source,
      acknowledged: false,
    };
    this.events.unshift(ev);
    if (this.events.length > MAX_EVENTS) this.events.length = MAX_EVENTS;
    this._notify();
    return ev;
  }

  // Raise automatically from a prediction bundle if there's a new fault hypothesis.
  considerPrediction(prediction, prevHypothesis) {
    if (!prediction) return;
    const fault = prediction.fault_hypothesis;
    if (!fault) return;
    if (fault === prevHypothesis) return;  // already annunciated
    const severity = prediction.anomaly_score > 0.7 ? 'ALARM' : 'WARN';
    this.fire({
      severity,
      code: fault,
      message: `${humanize(fault)} — anomaly ${prediction.anomaly_score.toFixed(2)}, ` +
               `state ${prediction.operational_state_predicted}`,
      source: 'inference',
    });
  }

  acknowledge(id) {
    const e = this.events.find(x => x.id === id);
    if (e) { e.acknowledged = true; this._notify(); }
    return e;
  }

  acknowledgeAll() {
    this.events.forEach(e => e.acknowledged = true);
    this._notify();
  }

  getActive() {
    return this.events.filter(e => !e.acknowledged && e.severity !== 'INFO');
  }

  list() { return this.events.slice(); }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  _notify() {
    for (const fn of this._listeners) { try { fn(this.events); } catch (err) { console.error(err); } }
  }
}

function humanize(code) {
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
