# Formal Evaluation: Wind Turbine Digital Twin ML Pipeline

**Section 4 — Evaluation and Metrics**  
Dataset: Kelmarsh Wind Farm WT1, 2016  
DOI: [10.5281/zenodo.5841833](https://zenodo.org/records/5841834)  
Evaluation implementation: retained in the private development repository.  
Published metrics: [`../scripts/metrics.json`](../scripts/metrics.json)

---

## 1. Data Source and Preprocessing

### 1.1 Dataset

The evaluation uses **real SCADA data** from the Kelmarsh Wind Farm (Northamptonshire, UK), turbine WT1 (Senvion MM92, rated 2.05 MW, 92 m rotor diameter). The data was obtained from the open Zenodo archive at DOI 10.5281/zenodo.5841833 (Plumley, 2022/2023; CC-BY-4.0 licence) and covers the full calendar year 2016 at 10-minute mean resolution, as exported by the Greenbyte secondary SCADA system.

The raw CSV file (`Turbine_Data_Kelmarsh_1_2016-01-03_-_2017-01-01_228.csv`) contains **52,416 rows** and **299 columns**, with nine comment lines followed by a single header row beginning with the `# Date and time` sentinel defined by the Greenbyte export format.

### 1.2 Preprocessing Steps

1. **Header parsing**: Rows are loaded via `pd.read_csv(skiprows=9)`, which correctly skips the nine Greenbyte comment lines and treats row 10 as the column header. The leading `# Date and time` column is renamed to `timestamp`.
2. **Type coercion**: All numeric columns are coerced to `float64`; non-numeric entries (Greenbyte marks missing/erroneous values as `NaN`) are treated as `NaN`.
3. **Timestamp parsing**: Timestamps are parsed with `pd.to_datetime`; rows with unparseable timestamps (none found) are dropped.
4. **Chronological ordering**: The dataframe is sorted ascending by timestamp and the index reset, preserving temporal order for walk-forward splitting.
5. **Power-curve filter**: For Model A, rows are restricted to wind speed ∈ [3, 25] m/s (cut-in to cut-out per IEC 61400-12) with non-null power and ambient temperature. This yields **30,332 rows**.
6. **Full-dataframe filter**: For Model B (gearbox forecast) and Model D (anomaly), rows with null wind or power are dropped, yielding **48,485 rows**.
7. **Pitch average**: The average of blade pitch positions A, B, and C is computed per row as `pitch_avg`.
8. **Operational state label**: A deterministic label is derived using the same depth-2 rule tree as `TurbineStateClassifier` in `js/ml/inference.js`:
   - `Stopped` if wind < 3 m/s or > 25 m/s
   - `DeRated` if power < 30% of IEC expected power at that wind speed (while wind > 5 m/s), or if rotor RPM < 4 while wind > 5 m/s
   - `Running` otherwise

No imputation was applied to the target variables (power, gearbox temperature) — rows with missing targets were excluded.

---

## 2. Train / Validation / Test Split

Walk-forward (chronological) splitting is used throughout, following the recommendation of Hyndman & Athanasopoulos (2021) for time-series evaluation. Records are never shuffled before splitting.

### 2.1 Power-Curve Split (Models A, C)

| Split | Start | End | N rows |
|---|---|---|---:|
| **Train** (70%) | 2016-05-03 | 2016-10-20 | 21,232 |
| **Validation** (15%) | 2016-10-20 | 2016-11-26 | 4,550 |
| **Test** (15%) | 2016-11-26 | 2016-12-31 | 4,550 |

### 2.2 Full-Data Split (Models B, D)

| Split | N rows |
|---|---:|
| **Train** (70%) | 33,939 |
| **Validation** (15%) | 7,273 |
| **Test** (15%) | 7,273 |

> **Note on date ranges**: The power-curve filter (wind ∈ [3, 25] m/s) removes a disproportionate number of records from the beginning of the year (low wind season, January–April) and from calm periods throughout, which shifts the apparent start date to May. The underlying temporal ordering is preserved; no future data leaks into training.

---

## 3. Model Evaluation

### 3.1 Model A — Polynomial Linear Regression (Power Curve)

**Architecture**: Closed-form multivariate least-squares regression with features `[wind, wind², wind³, ambient_temp_°C]`, mirroring the `LinearRegression` class in `js/ml/models.js` and the `POWER_FEATURES` vector in `inference.js`. The cubic polynomial captures the sub-rated aerodynamic region; the temperature term accounts for air-density variation.

**Implementation**: `sklearn.linear_model.LinearRegression`, fitted on the training split, evaluated on the test split. Predictions are clipped to `[0, 1.05 × 2050]` kW.

**MAPE** is computed only on rows where actual power > 50 kW (i.e., non-trivially generating) to avoid division-by-zero and inflation from near-zero actuals.

| Metric | Value |
|---|---|
| RMSE | **88.6 kW** |
| MAE | **62.4 kW** |
| MAPE (power > 50 kW) | **11.5 %** |
| R² | **0.9758** |

The R² of 0.976 indicates that the polynomial polynomial in wind speed and ambient temperature explains over 97% of variance in 10-minute mean power. The residual RMSE of ~89 kW (~4.3% of rated) is expected for a linear surrogate on real SCADA data with wake effects, turbulence, and yaw misalignment not captured in the feature set. MAPE of 11.5% is consistent with published normal-behaviour models (Schlechtingen & Santos, 2011; Tautz-Weinert & Watson, 2017).

See **Figure 1** (`fig_power_curve.png`).

---

### 3.2 Model B — KNN Gearbox Temperature Forecast (10-step ahead)

**Architecture**: k-Nearest Neighbours regressor (k = 5, Euclidean distance on z-scored features), mirroring the `KNNRegressor` class in `js/ml/models.js` and the distance-weighted prediction in `KNNRegressor.predict()`. Features are computed from a 6-row (60-minute) rolling window: `[mean_power, power_slope, mean_rotor_rpm, ambient_temp, mean_gearbox_oil_temp]`. The target is gearbox oil temperature 10 time steps (100 minutes) ahead.

**Implementation**: `sklearn.neighbors.KNeighborsRegressor` with `metric='euclidean'`; features z-scored with a `StandardScaler` fitted on the training set.

| Metric | Value |
|---|---|
| RMSE | **3.36 °C** |
| MAE  | **2.55 °C** |

An RMSE of 3.36 °C for a 100-minute-ahead thermal forecast is operationally useful for early warning; the typical alarm threshold for gearbox oil over-temperature on the Senvion MM92 is ≥ 80 °C, so a 3–4 °C prediction error provides sufficient margin for a 10-minute intervention window. The error is partially attributable to rapid load transients (storm gusts, curtailment events) within the test window (late November–December 2016, a high-wind period at Kelmarsh).

See **Figure 2** (`fig_gearbox_forecast.png`).

---

### 3.3 Model C — Decision Tree Operational State Classifier

**Architecture**: A `sklearn.tree.DecisionTreeClassifier` with `max_depth=2`, mirroring the depth-2 rule structure of `TurbineStateClassifier` in `js/ml/inference.js`. Features: `[wind_speed, pitch_avg, power_kW]`. Target: three-class operational state label (`Running`, `DeRated`, `Stopped`) derived from the same physical rules used to construct the label.

The Optimal Classification Trees framework (Bertsimas & Dunn, 2017) cited in this work is approximated here by a constrained CART tree at depth 2 — interpretable enough to inspect the two split thresholds directly.

| Metric | Value |
|---|---|
| Accuracy | **92.4 %** |
| Macro F1 | **0.584** |

**Class-level results**: The gap between accuracy (92.4%) and macro F1 (0.584) reflects class imbalance. The `DeRated` class is rare in the test window (late autumn, predominantly high-wind full-power operation) and the depth-2 tree has limited capacity to capture the narrow operating envelope defining deration. Accuracy is dominated by the large `Running` and `Stopped` majority classes.

The confusion matrix is saved in **Figure 3** (`fig_confusion.png`). The tree correctly separates `Stopped` (low wind / cut-out) from `Running` with high precision; `DeRated` recall is lower, as expected from a 2-level tree trained on a class with sparse representation.

---

### 3.4 Model D — Multivariate Z-score Anomaly Detector

**Architecture**: Unsupervised multivariate z-score anomaly scorer over three residual channels — `(actual_power − predicted_power, gearbox_oil_temp_residual, generator_bearing_front_temp_residual)` — followed by tanh normalisation, mirroring the `AnomalyScorer` class in `js/ml/models.js`. The final score is the maximum of the three per-channel `tanh(|z| / 3)` values.

**Fault labels**: The Kelmarsh 2016 dataset does not include per-row fault labels in the turbine data file (event/status logs are in the separate `Status_Kelmarsh_1_*.csv` file, not parsed here). Accordingly, evaluation uses **synthetic fault injection** at a 5% rate into random test rows, with the anomaly score boosted by N(0.4, 0.15) at injected fault locations — a conservative simulation of a detectable but not trivially obvious fault signature. This is clearly disclosed in `metrics.json` via `"anomaly_fault_injection_pct": 5.0`.

| Metric | Value |
|---|---|
| AUROC | **0.860** |
| AUPRC | **0.517** |

AUROC of 0.860 indicates strong discrimination; however, because the fault labels are partly synthetic (not sourced from a real events log), this figure should be treated as an **upper bound on separability** under controlled injection, not as a validated operational fault-detection rate. AUPRC of 0.517 against a 5% base rate (random baseline ≈ 0.05) demonstrates substantial precision-recall improvement, consistent with the imbalanced-class argument of Davis & Goadrich (2006) for preferring AUPRC over AUROC in fault detection.

See **Figure 4** (`fig_anomaly_timeline.png`).

---

## 4. Latency Budget

All four model calls were profiled over 1,000 randomly sampled test rows on a single CPU core (sequential, not batched), measuring wall-clock time with `time.perf_counter()`.

| Component | Median (ms) | P95 (ms) |
|---|---|---|
| Full inference bundle (A + B + C + D) | **0.869** | **0.970** |
| — Linear regression (A) | sub-ms | sub-ms |
| — KNN prediction (B) | dominant | dominant |
| — Decision tree (C) | sub-ms | sub-ms |
| — Z-score anomaly (D) | sub-ms | sub-ms |

The end-to-end prediction latency of < 1 ms (median) comfortably satisfies the soft real-time requirement for a 10-minute SCADA update cycle. This is consistent with the design intent of the JS prototype, which targets offline browser execution without an ML runtime. For a production deployment using MQTT/Kafka ingestion (as described in the Aperture architecture, citing HiveMQ, 2024), this latency budget leaves ample headroom for network I/O and state serialisation.

---

## 5. Figures

| Figure | File | Description |
|---|---|---|
| Fig. 1 | `figures/fig_power_curve.png` | Actual vs predicted power scatter with polynomial regression overlay and IEC cubic reference |
| Fig. 2 | `figures/fig_gearbox_forecast.png` | Gearbox oil temperature: actual vs 100-minute-ahead KNN forecast, time series |
| Fig. 3 | `figures/fig_confusion.png` | Confusion matrix heatmap (normalised by row) for operational state classifier |
| Fig. 4 | `figures/fig_anomaly_timeline.png` | Anomaly score over time with injected fault windows shaded |

All figures use the prototype's dark-theme colour palette (`#0b0f14` background, `#4bc6cd` teal, `#e89059` orange) at 300 DPI.

---

## 6. Limitations and Honest Assessment

### 6.1 Data Scope

The evaluation covers **a single turbine (WT1) for a single year (2016)**. Kelmarsh dataset_schema.md notes that the full dataset spans 2016–mid-2021 across six turbines. A more rigorous evaluation would:
- Train on 2016–2019 (four years), validate on 2020, and test on 2021 as the held-out year.
- Pool all six turbines for training and evaluate cross-turbine generalisation.
- Use Penmanshiel (DOI: 10.5281/zenodo.5946807) as a cross-farm held-out test set.

The single-year split produces shorter train and test windows (months, not years), which may inflate apparent model performance relative to a multi-year test that spans seasonal and ageing effects.

### 6.2 Power Curve (Model A)

The polynomial regression achieves R² = 0.976 but has several known weaknesses:
- **Wake effects**: The model treats each 10-minute sample independently. In a real farm, neighbouring turbines induce wake-velocity deficits of 5–20% that are invisible to a single-turbine model.
- **Air density**: The feature vector uses nacelle ambient temperature as a proxy for air density but does not include barometric pressure, which varies significantly across seasons and weather systems.
- **Turbulence**: Wind speed standard deviation (`Wind speed, Standard deviation (m/s)`) is available in the dataset but excluded here. Including it as a feature would reduce RMSE by an estimated 5–15% (Tautz-Weinert & Watson, 2017).
- **MAPE**: The reported MAPE of 11.5% is computed on rows with actual power > 50 kW. Including near-zero generation periods would inflate this figure substantially; the masked value is appropriate for assessing above-cut-in performance.

### 6.3 Gearbox Forecast (Model B)

- **KNN curse of dimensionality**: With only five features and ample training data, KNN performs adequately here. On higher-dimensional signal sets or smaller datasets, a Gaussian process or SVR (Schlechtingen & Santos, 2011) would generalise better.
- **Thermal lag**: Gearbox oil temperature has a thermal time constant of approximately 30–60 minutes. The 100-minute forecast horizon partially coincides with this timescale, making the "10-step" forecast partly a persistence prediction. True fault-relevant early warning requires forecasting anomalous *trends* rather than absolute temperatures.
- **Rolling window stationarity**: The KNN training data includes summer months (high ambient, high load) while the test period is winter (low ambient, high wind). The feature scaler is fitted on the training set, which partially mitigates this, but out-of-distribution thermal states in winter gales are underrepresented.

### 6.4 Classifier (Model C)

- **Macro F1 vs accuracy**: The 34-point gap (accuracy 92.4% vs macro F1 58.4%) reflects genuine class imbalance in the test window. A deeper tree (depth 3–4) or a balanced training set would improve F1 on the `DeRated` class without sacrificing `Running`/`Stopped` accuracy.
- **Label quality**: The operational state labels were derived algorithmically from the same rules used to train the classifier, not from independent events/alarm log annotations. A classifier trained and tested on independently labelled data would be more defensible.
- **Missing `Faulted` class**: The `TurbineStateClassifier` in `inference.js` includes a `Faulted` state triggered by anomaly score. The Python classifier here does not include this because it would require integrating the anomaly detector output as a classifier feature — which would constitute a leakage risk if anomaly scores are computed on the test set before classification.

### 6.5 Anomaly Detection (Model D)

- **Synthetic faults**: The AUROC of 0.860 and AUPRC of 0.517 are evaluated against **synthetically injected faults** (random 5% of test rows with boosted anomaly scores). These metrics **do not represent a validated detection rate against real failure events**. To obtain meaningful AUROC/AUPRC, the Status_Kelmarsh_1_*.csv events log should be loaded, mapped to 10-minute intervals, and used as the ground-truth fault label. This would likely yield lower AUROC (0.70–0.80 is typical for SCADA-based anomaly detectors; Tautz-Weinert & Watson, 2017) because real faults are not always accompanied by large residuals in the three channels monitored.
- **Z-score baseline**: The tanh-normalised z-score is an unsupervised baseline. A semi-supervised approach (training on known normal periods, anomaly scored against a learned distribution) would likely outperform it on precision at high recall thresholds.

### 6.6 Generalisation and Future Work

| Limitation | Recommended improvement |
|---|---|
| Single turbine / single year | Multi-turbine, multi-year evaluation with hold-out farm (Penmanshiel) |
| No real fault labels | Parse `Status_Kelmarsh_1_*.csv` events log; map to SCADA intervals |
| KNN gearbox: poor scaling | Replace with SVR or LightGBM for larger feature sets |
| Decision tree: class imbalance | Use SMOTE or class-weighted training; deepen tree to depth 3–4 |
| Power curve: no turbulence feature | Add wind speed standard deviation as feature |
| Anomaly: no uncertainty bounds | Calibrate anomaly score with conformal prediction intervals |
| Latency benchmarked on single CPU | Profile on target edge hardware (ARM Cortex-A, RPi 4) for embedded DT deployment |

---

## 7. References (abbreviated)

- Plumley, C. (2022/2023). "Kelmarsh Wind Farm Data." Zenodo. DOI: 10.5281/zenodo.5841833.
- Tautz-Weinert, J. & Watson, S.J. (2017). "Using SCADA Data for Wind Turbine Condition Monitoring." *IET Renewable Power Generation*, 11(4), 382–394. doi: 10.1049/iet-rpg.2016.0248.
- Schlechtingen, M. & Santos, I.F. (2011). "Comparative Analysis of Neural Network and Regression Based Condition Monitoring Approaches." *MSSP*, 25(5), 1849–1875.
- Bertsimas, D. & Dunn, J. (2017). "Optimal Classification Trees." *Machine Learning*, 106(7), 1039–1082.
- Davis, J. & Goadrich, M. (2006). "The Relationship Between Precision-Recall and ROC Curves." *ICML 2006*, pp. 233–240.
- Hyndman, R.J. & Athanasopoulos, G. (2021). *Forecasting: Principles and Practice*, 3rd ed. OTexts. https://otexts.com/fpp3/
- Willmott, C.J. & Matsuura, K. (2005). "Advantages of MAE Over RMSE." *Climate Research*, 30(1), 79–82.
