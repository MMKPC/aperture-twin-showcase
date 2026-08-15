# Dataset Schema: Kelmarsh Wind Farm

**Chosen Dataset for Prototype Build**  
DOI: 10.5281/zenodo.5841833  
URL: https://zenodo.org/records/5841834  
License: CC-BY-4.0  
Publisher: Cubico Sustainable Investments Ltd (contact: charlie.plumley@cubicoinvest.com)  
Released: 2022, updated 2023

---

## Farm Overview

| Field | Value |
|---|---|
| Farm name | Kelmarsh Wind Farm, Northamptonshire, UK |
| Turbine model | Senvion MM92 (6 units: WT01–WT06) |
| Rated power | 2.05 MW per turbine |
| Rotor diameter | 92 m |
| Hub height | 80 m |
| Temporal coverage | 2016-01-03 through 2021-07-01 (≈ 5.5 years) |
| Sampling rate | **10-minute mean** (plus stdev, min, max for key channels) |
| Total rows (approx.) | ~280,000 per turbine × 6 turbines = ~1.7 M rows |
| Total variables | ~110 per turbine including timestamp |
| Source SCADA | Greenbyte secondary SCADA system |
| Signal mapping file | `Kelmarsh_WT_Turbine_dataSignalMapping.xlsx` |

---

## File Structure

```
Kelmarsh_WTXX_YYYY.csv        # per-turbine, per-year SCADA data
Kelmarsh_WT_Turbine_dataSignalMapping.xlsx   # column name ↔ description mapping
Kelmarsh_WT_StaticData.xlsx   # turbine coordinates, rated specs
Kelmarsh_WT_EventsYYYY.csv    # alarm/event log per year
Kelmarsh_Site_PMU_YYYY.csv    # substation/grid meter (site-level)
```

---

## Core SCADA Columns (CSV Column Names → Description → Unit)

The Greenbyte secondary SCADA exports each 10-minute statistic as a quartet of suffixed columns:
- `_avg` = arithmetic mean over the 10-minute window
- `_std` = standard deviation
- `_min` = minimum sample value
- `_max` = maximum sample value

### Timestamp

| Column | Description | Type/Unit |
|---|---|---|
| `# Date and time` | UTC timestamp of end of 10-min interval | ISO 8601 datetime |

### Wind Resource

| Base column | Description | Unit |
|---|---|---|
| `Wind speed_avg` | Hub-height wind speed (anemometer) | m/s |
| `Wind speed_std` | Standard deviation of wind speed | m/s |
| `Wind speed_min` | Minimum wind speed in interval | m/s |
| `Wind speed_max` | Maximum wind speed in interval | m/s |
| `Wind direction_avg` | Nacelle-based wind direction (via vane) | degrees (0–360°) |

### Power and Energy

| Base column | Description | Unit |
|---|---|---|
| `Power_avg` | Active electrical power output | kW |
| `Power_std` | Standard deviation of active power | kW |
| `Power_min` | Minimum active power in interval | kW |
| `Power_max` | Maximum active power in interval | kW |
| `Reactive power_avg` | Reactive power | kVAR |
| `Cos phi_avg` | Power factor (cosine phi) | dimensionless |
| `Production_avg` | Cumulative energy counter (reset on fault) | kWh |

### Rotor and Drive Train

| Base column | Description | Unit |
|---|---|---|
| `Rotor speed_avg` | Low-speed shaft / rotor rotational speed | RPM |
| `Generator speed_avg` | High-speed shaft / generator speed | RPM |
| `Gear ratio_derived` | Gearbox ratio (static, from turbine spec) | — |
| `Torque_avg` | Estimated torque at main shaft | kNm |

### Blade Pitch System

| Base column | Description | Unit |
|---|---|---|
| `Blade angle pitch A_avg` | Pitch angle of blade A | degrees |
| `Blade angle pitch B_avg` | Pitch angle of blade B | degrees |
| `Blade angle pitch C_avg` | Pitch angle of blade C | degrees |

### Yaw System

| Base column | Description | Unit |
|---|---|---|
| `Nacelle position_avg` | Nacelle yaw angle (absolute heading) | degrees (0–360°) |
| `Yaw error_avg` | Difference between wind direction and nacelle heading | degrees |

### Temperature Signals

| Base column | Description | Unit |
|---|---|---|
| `Nacelle temperature_avg` | Internal nacelle air temperature | °C |
| `Nacelle ambient temperature_avg` | Ambient temperature at nacelle (outdoor) | °C |
| `Generator bearing temperature (DE)_avg` | Drive-end (front) main bearing temperature | °C |
| `Generator bearing temperature (NDE)_avg` | Non-drive-end (rear) bearing temperature | °C |
| `Rotor bearing temperature_avg` | Main rotor / low-speed shaft bearing | °C |
| `Gearbox oil temperature_avg` | Gearbox oil sump temperature | °C |
| `Gearbox oil inlet temperature_avg` | Gearbox oil inlet (after cooling) | °C |
| `Generator stator 1 temperature_avg` | Generator stator winding temperature | °C |
| `Converter ambient temperature_avg` | Power converter cabinet ambient | °C |
| `Transformer temperature_avg` | Main transformer oil/winding temperature | °C |
| `Top box temperature_avg` | Tower top cabinet temperature | °C |
| `Hub temperature_avg` | Spinner/hub internal temperature | °C |
| `CPU temperature_avg` | Controller CPU temperature | °C |

### Pressure and Lubrication

| Base column | Description | Unit |
|---|---|---|
| `Gear oil inlet pressure_avg` | Gearbox oil inlet pressure | bar |
| `Gear oil pump pressure_avg` | Gearbox oil pump outlet pressure | bar |

### Structural / Vibration

| Base column | Description | Unit |
|---|---|---|
| `Drive train acceleration_avg` | Drive-train vibration (accelerometer) | m/s² or g |

### Status and Events

| Column | Description | Type |
|---|---|---|
| `Turbine state_avg` | Operational state code (0=ok, >0=fault code) | integer |
| `Service state_avg` | Maintenance/service state code | integer |

---

## Derived / Computed Columns for Prototype

The prototype should compute these from raw signals:

| Derived column | Formula | Unit | Notes |
|---|---|---|---|
| `tip_speed_ratio` | `(pi * rotor_diameter * rotor_speed_avg) / (60 * wind_speed_avg)` | dimensionless | Use rotor_diameter = 92 m |
| `power_coefficient_Cp` | `power_avg / (0.5 * air_density * pi * (46)^2 * wind_speed_avg^3)` | dimensionless | Standard air density = 1.225 kg/m³ |
| `capacity_factor_10min` | `power_avg / rated_power_kW` | % | rated_power = 2050 kW |
| `delta_gearbox_temp` | `gearbox_oil_temp_avg - ambient_temp_avg` | °C | Thermal anomaly indicator |
| `label_fault` | Binary flag from events file | 0/1 | 1 if turbine state > 0 or event logged |

---

## Recommended Train/Test Split (Walk-Forward Validation)

| Split | Period | Turbines |
|---|---|---|
| **Training** | 2016-01-01 – 2019-12-31 (4 years) | WT01–WT06 |
| **Validation** | 2020-01-01 – 2020-12-31 (1 year) | WT01–WT06 |
| **Test (hold-out)** | 2021-01-01 – 2021-07-01 (6 months) | WT01–WT06 |
| **Cross-farm test** | 2016–2021 | Penmanshiel WT01–WT14 (DOI: 10.5281/zenodo.5946807) |

> **Important:** Never shuffle time series records before splitting. Chronological ordering must be preserved; use walk-forward (rolling-origin) cross-validation for hyperparameter tuning.

---

## Filtering Recommendations

1. **Remove curtailment periods:** Filter rows where `turbine_state_avg > 0` or `service_state_avg > 0` for normal-behaviour model training (retain for fault detection testing).
2. **Wind speed range:** Keep records with `wind_speed_avg` ∈ [3, 25] m/s (cut-in to cut-out) for power curve modelling.
3. **Icing filter:** Flag and optionally remove records where `nacelle_ambient_temperature_avg < 0` and `power_avg < expected_power * 0.5`.
4. **Missing data:** Rows with NaN in target (`power_avg`) or primary feature (`wind_speed_avg`) should be dropped; impute remaining NaN features with turbine-specific medians.

---

## CSV Row Example (illustrative — not real data)

```
# Date and time,Wind speed_avg,Wind speed_std,Power_avg,Rotor speed_avg,Blade angle pitch A_avg,Nacelle position_avg,Gearbox oil temperature_avg,Nacelle ambient temperature_avg,Generator bearing temperature (DE)_avg,Turbine state_avg
2019-06-15 14:00:00,9.3,1.2,1820.4,16.1,1.8,245.3,52.1,14.2,68.3,0
```

---

## Secondary Dataset (Cross-Farm Validation)

**Penmanshiel Wind Farm**  
DOI: 10.5281/zenodo.5946807  
URL: https://zenodo.org/records/5946808  
Turbines: 14 × Senvion MM82 (same manufacturer, 82 m rotor, 2 MW)  
Period: 2016–mid-2021 (same as Kelmarsh)  
Format: Identical Greenbyte CSV format — drop-in replacement for cross-farm experiments.  
Note: WT03 is absent from the dataset; file coverage is WT01–WT02, WT04–WT15.
