# Aperture: Wind Turbine Digital Twin

Public portfolio presentation of Aperture, a browser-native hybrid digital twin for utility-scale wind turbines.

This controlled showcase contains the static interactive demo, visual evidence, technical notes, evaluation figures, and licensing documents. The original development repository remains private; this repository is the public studio presentation surface.

Start with the [portfolio breakdown](https://mmkpc.github.io/aperture-twin-showcase/), then [open the interactive demo](https://mmkpc.github.io/aperture-twin-showcase/demo/). The showcase remains available to authorized studio and portfolio workflows; private development history and machine-specific materials remain outside it.

## What it demonstrates

- SCADA-style telemetry ingestion and typed state.
- Physics-informed state, interpretable ML surrogates, and anomaly detection.
- Baseline, optimistic, and stress scenario branches.
- Operator-first annunciation and actuator controls.
- A procedural Three.js turbine view and a fully static deployment model.

## Public boundary

No credentials, private infrastructure, or external service secrets are included. The demo runs in the browser and uses the published technical artifacts and synthetic replay data included here.

## Studio control

This repository is the interactive demonstration layer referenced by MMKProspects.com. Current access policy is in `MMKPC_STUDIO_LICENSE.md`, the existing `LICENSE` remains applicable to previously released code, credential handling is in `SECURITY.md`, and the release gate is `scripts/validate_studio_manifest.ps1`.
