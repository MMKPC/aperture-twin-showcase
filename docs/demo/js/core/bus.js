/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// core/bus.js — tiny synchronous pub/sub event bus
// Channels mirror the WebSocket channels from the framework spec:
//   state, prediction, simulation, behavior, voice, scene, log
//
// Every layer publishes upward; the UI layer subscribes.

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(channel, fn) {
    if (!this.listeners.has(channel)) this.listeners.set(channel, new Set());
    this.listeners.get(channel).add(fn);
    return () => this.listeners.get(channel).delete(fn);
  }

  emit(channel, payload) {
    const set = this.listeners.get(channel);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); }
      catch (err) { console.error(`[bus] listener on "${channel}" threw`, err); }
    }
  }
}

export const bus = new EventBus();

// Standard channel names as constants so typos don't haunt us
export const CH = {
  EVENT:      'event',      // raw ingest event
  STATE:      'state',      // canonical state snapshot
  PREDICTION: 'prediction', // ML inference output
  SIMULATION: 'simulation', // scenario branches
  BEHAVIOR:   'behavior',   // animation / expression / dialogue cues
  VOICE:      'voice',      // utterance to speak
  SCENE:      'scene',      // scene-level command
  LOG:        'log',        // system log entry
  LATENCY:    'latency',    // loop timing
};
