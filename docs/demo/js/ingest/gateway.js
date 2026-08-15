/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// ingest/gateway.js — Ingestion Gateway
// Accepts sensor/manual/file/api/scene events, validates, normalises, fans out.
// Mirrors framework §Layer responsibilities → 1. Ingestion Gateway.

import { bus, CH } from '../core/bus.js';
import { makeEvent, validateEvent } from '../core/schemas.js';

export class IngestGateway {
  constructor(store) {
    this.store = store;
  }

  // Accept a raw event payload; returns the normalised event or null on error.
  accept(input) {
    const ev = input.event_id
      ? input
      : makeEvent({ twin_id: this.store.getCurrent().twin_id, ...input });

    const { ok, errors } = validateEvent(ev);
    if (!ok) {
      bus.emit(CH.LOG, { level: 'warn', msg: `dropped event: ${errors.join('; ')}`, ev });
      return null;
    }

    // Normalise "risk" alias to risk_score already handled in reducer, but
    // stamp confidence if missing.
    if (typeof ev.confidence !== 'number') ev.confidence = 1.0;

    this.store.upsertEvent(ev);
    bus.emit(CH.EVENT, ev);
    return ev;
  }

  // Bulk push, e.g. from a replay file
  acceptBatch(events) {
    const out = [];
    for (const e of events) {
      const r = this.accept(e);
      if (r) out.push(r);
    }
    return out;
  }
}
