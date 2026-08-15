/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// ml/models.js — interpretable predictive models.
// The framework's §Minimum algorithm set calls out linear regression, SVR, KNN,
// classification tree (OCT-style), and an unsupervised anomaly scorer.
// We implement pure-JS versions here: no external ML runtime, so the app runs
// offline in the browser.

// -----------------------------------------------------------------------------
// 1. Linear Regression — closed-form multivariate least squares via normal
//    equations.  X is (n x d) with a leading column of 1s for bias.
// -----------------------------------------------------------------------------
export class LinearRegression {
  constructor() { this.w = null; this.featureNames = []; }

  fit(X, y, featureNames = []) {
    this.featureNames = featureNames;
    const Xb = X.map(row => [1, ...row]);
    const XT = transpose(Xb);
    const XTX = matmul(XT, Xb);
    const XTy = matvec(XT, y);
    this.w = solve(XTX, XTy);
    return this;
  }

  predict(x) {
    const xb = [1, ...x];
    return dot(this.w, xb);
  }

  // Produce an interpretable explanation: top contributors to prediction
  explain(x, k = 3) {
    if (!this.w) return [];
    const xb = [1, ...x];
    const contribs = this.w.map((w, i) => ({
      name: i === 0 ? 'bias' : (this.featureNames[i - 1] || `x${i - 1}`),
      value: w * xb[i],
    }));
    contribs.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return contribs.slice(0, k);
  }
}

// -----------------------------------------------------------------------------
// 2. K-Nearest-Neighbours regression — simple distance-weighted mean.
// -----------------------------------------------------------------------------
export class KNNRegressor {
  constructor(k = 3) { this.k = k; this.X = []; this.y = []; }

  fit(X, y) { this.X = X; this.y = y; return this; }

  predict(x) {
    if (!this.X.length) return 0;
    const dists = this.X.map((xi, i) => ({ d: euclid(xi, x), i }));
    dists.sort((a, b) => a.d - b.d);
    const top = dists.slice(0, this.k);
    const w = top.map(t => 1 / (t.d + 1e-6));
    const wsum = w.reduce((a, b) => a + b, 0);
    return top.reduce((acc, t, idx) => acc + w[idx] * this.y[t.i], 0) / wsum;
  }
}

// -----------------------------------------------------------------------------
// 3. Tree-based classifier — very small depth-2 decision tree with manual
//    thresholds, standing in for an Optimal Classification Tree.  Framework
//    explicitly names OCT for interpretable routing.
// -----------------------------------------------------------------------------
export class ModeClassifier {
  // Rules designed from the state domain:
  //   risk > 0.65              → alert
  //   engagement > 0.55 or energy > 0.8 → active
  //   else                     → idle
  // Each rule returns {label, path:[..rule texts..]} so we can display it.
  classify({ risk_score, engagement, energy, anomaly_score = 0 }) {
    const path = [];
    if (risk_score > 0.65) { path.push(`risk_score ${risk_score.toFixed(2)} > 0.65`); return { label: 'alert', path }; }
    path.push(`risk_score ${risk_score.toFixed(2)} ≤ 0.65`);
    if (anomaly_score > 0.70) { path.push(`anomaly ${anomaly_score.toFixed(2)} > 0.70`); return { label: 'alert', path }; }
    if (engagement > 0.55) { path.push(`engagement ${engagement.toFixed(2)} > 0.55`); return { label: 'active', path }; }
    if (energy > 0.80) { path.push(`energy ${energy.toFixed(2)} > 0.80`); return { label: 'active', path }; }
    path.push('low activation');
    return { label: 'idle', path };
  }
}

// -----------------------------------------------------------------------------
// 4. Anomaly scorer — z-score against rolling window mean/std, normalised
//    through tanh so output is always [0,1].  Unsupervised, interpretable.
// -----------------------------------------------------------------------------
export class AnomalyScorer {
  score(features) {
    // Use the three core state channels
    const pairs = [
      [features.current.health, features.means.health, features.volatility.health],
      [features.current.energy, features.means.energy, features.volatility.energy],
      [features.current.risk_score, features.means.risk_score, features.volatility.risk_score],
    ];
    let max = 0;
    let winner = null;
    for (const [v, m, s] of pairs) {
      if (s < 1e-4) continue;
      const z = Math.abs(v - m) / s;
      const norm = Math.tanh(z / 3);
      if (norm > max) { max = norm; winner = { value: v, mean: m, std: s, z }; }
    }
    // If we have no history, a large absolute risk_score itself is anomalous
    if (features.samples < 3) {
      max = Math.max(max, Math.max(0, features.current.risk_score - 0.5) * 2);
    }
    return { score: Math.max(0, Math.min(1, max)), winner };
  }
}

// -----------------------------------------------------------------------------
// Linear-algebra helpers (no external deps)
// -----------------------------------------------------------------------------
function transpose(M) { return M[0].map((_, j) => M.map(r => r[j])); }
function matmul(A, B) {
  const m = A.length, n = B[0].length, p = B.length;
  const out = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) for (let k = 0; k < p; k++) {
    const a = A[i][k];
    for (let j = 0; j < n; j++) out[i][j] += a * B[k][j];
  }
  return out;
}
function matvec(A, v) { return A.map(r => r.reduce((s, a, j) => s + a * v[j], 0)); }
function dot(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0); }
function euclid(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s); }

// Gaussian-elimination solver for small matrices.  OK for d ≤ ~20.
function solve(A, b) {
  const n = A.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    // pivot
    let max = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[max][i])) max = k;
    [M[i], M[max]] = [M[max], M[i]];
    const piv = M[i][i];
    if (Math.abs(piv) < 1e-12) continue; // singular: treat as 0
    for (let j = i; j <= n; j++) M[i][j] /= piv;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const f = M[k][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  return M.map(r => r[n]);
}
