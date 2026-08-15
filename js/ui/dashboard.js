/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// ui/dashboard.js — renders turbine state, predictions, scenarios,
// annunciator panel, actuator state. Subscribes to the bus.

import { bus, CH } from '../core/bus.js';

const $ = (id) => document.getElementById(id);

export class Dashboard {
  constructor({ annunciator } = {}) {
    this.annunciator = annunciator;
    this.eventCount = 0;
    this._powerHistory = [];
    this._predHistory = [];
    this._gearboxHistory = [];
    this._wire();
    if (annunciator) annunciator.onChange(() => this._renderAnnunciator());
  }

  _wire() {
    bus.on(CH.STATE, (twin) => this.renderState(twin));
    bus.on(CH.EVENT, (ev) => this.addEventRow(ev));
    bus.on(CH.PREDICTION, (p) => this.renderPrediction(p));
    bus.on(CH.SIMULATION, (s) => this.renderSimulation(s));
    bus.on(CH.BEHAVIOR, (a) => this.renderActuator(a));
    bus.on(CH.LATENCY, (ms) => { const el = $('latency-readout'); if (el) el.textContent = `${ms.toFixed(1)} ms / tick`; });
  }

  // -------- state panel --------

  renderState(twin) {
    const s = twin.state;
    $('twin-id-tag').textContent = twin.profile.asset_id;

    // Asset profile
    setIfExists('m-asset-id', twin.profile.asset_id);
    setIfExists('m-asset-mfr', `${twin.profile.manufacturer} ${twin.profile.model}`);
    setIfExists('m-asset-rated', `${twin.profile.rated_power_kw} kW`);
    setIfExists('m-asset-hub', `${twin.profile.hub_height_m} m`);
    setIfExists('m-asset-commissioned', twin.profile.commissioning_date);
    setIfExists('m-asset-location', twin.profile.location);

    // Environmental
    fmt('m-wind-speed', s.wind_speed_ms, ' m/s', 2);
    fmt('m-wind-dir',   s.wind_direction_deg, '°', 0);
    fmt('m-ambient',    s.ambient_temp_c, ' °C', 1);

    // Electrical
    fmt('m-power',       s.power_kw, ' kW', 0);
    fmt('m-grid-v',      s.grid_voltage_v, ' V', 1);
    fmt('m-grid-f',      s.grid_frequency_hz, ' Hz', 3);

    // Mechanical
    fmt('m-rotor-rpm',  s.rotor_rpm, ' rpm', 2);
    fmt('m-gen-rpm',    s.generator_rpm, ' rpm', 0);
    fmt('m-gearbox-t',  s.gearbox_oil_temp_c, ' °C', 1);
    fmt('m-bearing-t',  s.generator_bearing_temp_c, ' °C', 1);
    fmt('m-vib',        s.vibration_proxy, '', 3);

    // Control
    fmt('m-pitch',     s.pitch_angle_deg, '°', 2);
    fmt('m-yaw',       s.yaw_angle_deg, '°', 1);
    fmt('m-nacelle-d', s.nacelle_direction_deg, '°', 1);
    setIfExists('m-op-state', s.operational_state);
    const opEl = $('m-op-state');
    if (opEl) opEl.setAttribute('data-state', s.operational_state);

    // Header status pill
    const pill = $('sys-status');
    const txt = $('sys-status-text');
    if (pill && txt) {
      if (s.operational_state === 'Faulted') { pill.setAttribute('data-state', 'alert'); txt.textContent = 'Faulted'; }
      else if (s.operational_state === 'Stopped') { pill.setAttribute('data-state', 'warn'); txt.textContent = 'Stopped'; }
      else { pill.setAttribute('data-state', 'active'); txt.textContent = s.operational_state; }
    }
  }

  // -------- predictions panel --------

  renderPrediction(p) {
    const twin = window.twin?.getState?.();
    const actualPower = twin ? twin.state.power_kw : 0;

    fmt('p-power',     p.power_prediction_kw, ' kW', 0);
    fmt('p-power-actual', actualPower, ' kW', 0);
    fmt('p-gearbox',   p.gearbox_temp_forecast_10min_c, ' °C', 1);
    setIfExists('p-state', p.operational_state_predicted);
    fmt('p-anom',      p.anomaly_score, '', 2);
    setIfExists('p-fault', p.fault_hypothesis ? humanize(p.fault_hypothesis) : '—');
    setIfExists('p-explain', p.explanation || '');

    // Sparkline: actual vs predicted power
    this._powerHistory.push(actualPower);
    this._predHistory.push(p.power_prediction_kw);
    this._gearboxHistory.push(p.gearbox_temp_forecast_10min_c);
    if (this._powerHistory.length > 120) { this._powerHistory.shift(); this._predHistory.shift(); this._gearboxHistory.shift(); }
    this._drawPowerSpark();
    this._drawGearboxSpark();

    // Anomaly gauge
    this._drawAnomalyGauge(p.anomaly_score);

    // State probability bars
    this._drawStateProbs(p.state_probabilities || {});

    // Routing path
    const routeEl = $('p-routing');
    if (routeEl) routeEl.textContent = (p.routing_path || []).slice(0, 2).join(' → ') || '—';
  }

  _drawPowerSpark() {
    const c = $('spark-power');
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    const hist = this._powerHistory;
    const pred = this._predHistory;
    if (!hist.length) return;
    const max = Math.max(1, Math.max(...hist, ...pred, 2000));
    // predicted (muted)
    this._line(ctx, pred, w, h, 0, max, getCSS('--color-warn'), 0.35, 1.2);
    // actual (primary)
    this._line(ctx, hist, w, h, 0, max, getCSS('--color-primary'), 0.8, 1.8);
  }

  _drawGearboxSpark() {
    const c = $('spark-gearbox');
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    if (!this._gearboxHistory.length) return;
    const min = 20, max = 110;
    this._line(ctx, this._gearboxHistory, w, h, min, max, getCSS('--color-warn'), 0.7, 1.6);
  }

  _line(ctx, arr, w, h, min, max, color, alpha, width) {
    ctx.beginPath();
    const span = max - min || 1;
    arr.forEach((v, i) => {
      const x = (i / Math.max(1, arr.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _drawAnomalyGauge(score) {
    const c = $('gauge-anomaly');
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.85;
    const r = Math.min(w * 0.46, h * 0.78);
    // background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = getCSS('--color-border');
    ctx.lineWidth = 8; ctx.stroke();
    // score arc
    const a = Math.PI + Math.min(1, Math.max(0, score)) * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, a);
    ctx.strokeStyle = score > 0.7 ? getCSS('--color-alert')
                    : score > 0.4 ? getCSS('--color-warn')
                    : getCSS('--color-primary');
    ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
    // label
    ctx.fillStyle = getCSS('--color-text');
    ctx.font = '600 16px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(score.toFixed(2), cx, cy - 2);
  }

  _drawStateProbs(probs) {
    const container = $('p-state-probs');
    if (!container) return;
    const keys = ['Running', 'DeRated', 'Faulted', 'Stopped', 'MaintenanceStop'];
    const colors = {
      Running: getCSS('--color-ok'),
      DeRated: getCSS('--color-warn'),
      Faulted: getCSS('--color-alert'),
      Stopped: getCSS('--color-text-muted'),
      MaintenanceStop: getCSS('--color-text-faint'),
    };
    container.innerHTML = keys.map(k => {
      const v = Math.max(0, Math.min(1, probs[k] ?? 0));
      return `
        <div class="prob-row">
          <div class="prob-label">${k}</div>
          <div class="prob-bar"><span style="width:${(v * 100).toFixed(0)}%; background:${colors[k]}"></span></div>
          <div class="prob-val">${v.toFixed(2)}</div>
        </div>
      `;
    }).join('');
  }

  // -------- scenarios --------

  renderSimulation(sim) {
    const { branches, active_branch } = sim;
    for (const b of branches) {
      const el = document.querySelector(`.branch[data-branch="${b.name}"]`);
      if (el) el.setAttribute('data-active', b.name === active_branch ? '1' : '0');
      const score = $(`s-${b.name}`);
      if (score) {
        const meanP = (b.mean_power_kw || 0).toFixed(0);
        const peakG = (b.peak_gearbox_c || 0).toFixed(0);
        score.textContent = `${meanP}kW · ${peakG}°C`;
      }
      this._drawBranchSpark(
        `spark-${b.name}`,
        b.trajectory.map(p => p.state.power_kw || 0),
        b.name,
      );
    }
    const sel = $('branch-selected');
    if (sel) sel.innerHTML = `Active branch: <strong>${active_branch}</strong>`;
    const chip = $('chip-branch'); if (chip) chip.textContent = active_branch;
  }

  _drawBranchSpark(canvasId, values, name) {
    const c = $(canvasId);
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(128,128,128,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h - 1); ctx.lineTo(w, h - 1); ctx.stroke();

    if (!values.length) return;
    const min = 0, max = 2100;
    const color = name === 'stress' ? getCSS('--color-warn')
               : name === 'optimistic' ? getCSS('--color-ok')
               : getCSS('--color-primary');

    ctx.beginPath();
    ctx.moveTo(0, h);
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.fillStyle = color + '22';
    ctx.fill();

    ctx.beginPath();
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // -------- events (SCADA samples shown as a rolling log) --------

  addEventRow(ev) {
    this.eventCount += 1;
    const ec = $('event-count'); if (ec) ec.textContent = `${this.eventCount} sample${this.eventCount === 1 ? '' : 's'}`;
    const stream = $('event-stream'); if (!stream) return;

    const row = document.createElement('div');
    row.className = 'event-row';
    const ts = document.createElement('span'); ts.className = 'event-ts'; ts.textContent = formatTime(ev.ts);
    const src = document.createElement('span'); src.className = 'event-src'; src.textContent = ev.source || '—';
    const payload = document.createElement('span'); payload.className = 'event-payload'; payload.textContent = summarise(ev);
    row.append(ts, src, payload);
    stream.prepend(row);
    while (stream.children.length > 60) stream.removeChild(stream.lastChild);
  }

  // -------- annunciator panel --------

  _renderAnnunciator() {
    const list = this.annunciator?.list() || [];
    const container = $('annunciator');
    if (!container) return;
    container.innerHTML = list.slice(0, 30).map(e => `
      <div class="ann-row" data-sev="${e.severity}" data-ack="${e.acknowledged ? '1' : '0'}" data-id="${e.id}">
        <span class="ann-sev">${e.severity}</span>
        <span class="ann-ts">${formatTime(e.ts)}</span>
        <span class="ann-msg">${escapeHtml(e.message)}</span>
        <button class="btn btn-sm btn-ghost ann-ack" data-id="${e.id}" ${e.acknowledged ? 'disabled' : ''}>
          ${e.acknowledged ? 'ACK' : 'Ack'}
        </button>
      </div>
    `).join('');
    container.querySelectorAll('.ann-ack').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const id = ev.currentTarget.dataset.id;
        this.annunciator.acknowledge(id);
      });
    });
    const active = list.filter(e => !e.acknowledged && e.severity !== 'INFO').length;
    const tag = $('ann-count');
    if (tag) tag.textContent = `${active} active / ${list.length}`;
  }

  // -------- actuator --------

  renderActuator(a) {
    fmt('act-pitch', a.pitch_cmd_deg, '°', 1);
    fmt('act-yaw',   a.yaw_cmd_deg, '°', 1);
    setIfExists('act-alarm', a.alarm_state);
    const alarmEl = $('act-alarm');
    if (alarmEl) alarmEl.setAttribute('data-state', a.alarm_state);
    setIfExists('act-faults', (a.latched_faults || []).map(humanize).join(', ') || '—');
  }
}

function getCSS(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#4bc6cd';
}
function summarise(ev) {
  if (!ev.payload) return '';
  return Object.entries(ev.payload).slice(0, 4).map(([k, v]) =>
    `${k}=${typeof v === 'number' ? v.toFixed(1) : v}`
  ).join(' ');
}
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour12: false });
}
function humanize(s) {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(id, v, unit = '', digits = 2) {
  const el = $(id);
  if (!el) return;
  if (typeof v === 'number' && Number.isFinite(v)) el.textContent = `${v.toFixed(digits)}${unit}`;
  else el.textContent = '—';
}
function setIfExists(id, val) {
  const el = $(id);
  if (el) el.textContent = val ?? '—';
}
