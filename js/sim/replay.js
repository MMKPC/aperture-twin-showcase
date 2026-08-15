/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// sim/replay.js — recording + playback of event streams.
// Framework §Test plan → replay determinism.

export class Replay {
  constructor() {
    this.recording = false;
    this.session = null; // { id, started_at, events: [] }
  }

  start() {
    this.recording = true;
    this.session = {
      id: `session-${Date.now().toString(36)}`,
      started_at: new Date().toISOString(),
      events: [],
    };
    return this.session.id;
  }

  capture(event) {
    if (!this.recording || !this.session) return;
    this.session.events.push({
      dt_ms: Date.parse(event.ts) - Date.parse(this.session.started_at),
      event: { ...event },
    });
  }

  stop() {
    this.recording = false;
    return this.session;
  }

  export(session = this.session) {
    if (!session) return null;
    return JSON.stringify(session, null, 2);
  }

  // Replay a saved session through the gateway.  Preserves inter-event timing.
  async play(session, gateway) {
    if (!session) return;
    const t0 = performance.now();
    for (const item of session.events) {
      const wait = (t0 + item.dt_ms) - performance.now();
      if (wait > 0) await sleep(wait);
      gateway.accept({
        ...item.event,
        event_id: undefined, // re-stamp on ingest
        ts: new Date().toISOString(),
      });
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
