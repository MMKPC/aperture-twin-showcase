/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// behavior/actuator.js — Turbine actuator surface.
// Replaces the humanoid BehaviorController. Exposes the defensible control
// hooks that would map onto a real turbine SCADA/DCS:
//   setPitch(deg), setYaw(deg), triggerShutdown(reason), resetAlarm()
// Also publishes a BEHAVIOR-channel snapshot that downstream UI consumes.

import { bus, CH } from '../core/bus.js';

export class TurbineActuator {
  constructor(store) {
    this.store = store;
    this._snapshot();
  }

  _snapshot() {
    const a = this.store.getCurrent().actuator;
    bus.emit(CH.BEHAVIOR, { ...a });
    return a;
  }

  setPitch(deg) {
    deg = clamp(deg, -2, 90);
    this.store.setActuator({ pitch_cmd_deg: deg });
    bus.emit(CH.LOG, { level: 'info', msg: `pitch command ${deg.toFixed(1)}°` });
    return this._snapshot();
  }

  setYaw(deg) {
    deg = ((deg % 360) + 360) % 360;
    this.store.setActuator({ yaw_cmd_deg: deg });
    bus.emit(CH.LOG, { level: 'info', msg: `yaw command ${deg.toFixed(1)}°` });
    return this._snapshot();
  }

  triggerShutdown(reason = 'manual_shutdown') {
    this.store.setActuator({
      pitch_cmd_deg: 90,
      alarm_state: 'tripped',
      latched_faults: [...new Set([...(this.store.getCurrent().actuator.latched_faults || []), reason])],
    });
    this.store.setOperationalState('Stopped');
    bus.emit(CH.LOG, { level: 'alarm', msg: `SHUTDOWN — ${reason}`, reason });
    return this._snapshot();
  }

  // Auto-triggered by the inference loop when anomaly > threshold.
  raiseAlarm(fault) {
    const cur = this.store.getCurrent().actuator;
    if (cur.alarm_state === 'tripped') return cur;
    const latched = new Set(cur.latched_faults || []);
    latched.add(fault);
    this.store.setActuator({ alarm_state: 'armed', latched_faults: [...latched] });
    bus.emit(CH.LOG, { level: 'warn', msg: `ALARM armed — ${fault}`, fault });
    return this._snapshot();
  }

  resetAlarm() {
    this.store.setActuator({ alarm_state: 'clear', latched_faults: [] });
    bus.emit(CH.LOG, { level: 'info', msg: 'alarm reset / faults acknowledged' });
    return this._snapshot();
  }

  // Derived automatic control: follow the wind with a bit of lag.
  trackWind(windDirectionDeg) {
    const cur = this.store.getCurrent().actuator;
    // smoothly bias yaw command toward wind direction
    const target = ((windDirectionDeg % 360) + 360) % 360;
    const diff = shortestAngle(target - cur.yaw_cmd_deg);
    const next = ((cur.yaw_cmd_deg + diff * 0.3) % 360 + 360) % 360;
    this.store.setActuator({ yaw_cmd_deg: next });
    return this._snapshot();
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function shortestAngle(d) { return ((d + 180) % 360 + 360) % 360 - 180; }
