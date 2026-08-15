/*
 * Aperture — Hybrid Digital Twin for Utility-Scale Wind Turbines
 * Copyright © 2026 Matthew Mitchell · MMKPC Studios
 * Source-available under PolyForm Noncommercial License 1.0.0
 * https://github.com/MMKPC/aperture-twin
 * Commercial licensing: memitchell@mmkpcstudios.com
 */
// scene/turbine_runtime.js — Three.js procedural Wind Turbine runtime.
// No external assets. Tower, nacelle, hub, 3 blades, ground, sky gradient,
// wind indicator, alert pulse. Driven by live SCADA state:
//   rotor_rpm    → rotor spin rate
//   yaw_angle    → nacelle yaw
//   pitch_angle  → blade pitch around long axis
//   anomaly/state → nacelle alert tint + pulsing status light

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Real-world scaling: 1 three-unit = 1 metre.
const HUB_HEIGHT = 78.5;
const TOWER_TOP_RADIUS = 1.4;
const TOWER_BASE_RADIUS = 2.3;
const BLADE_LENGTH = 45;
const NACELLE_LENGTH = 9;
const NACELLE_WIDTH = 3.2;
const NACELLE_HEIGHT = 3;
const HUB_RADIUS = 1.8;

export class TurbineRuntime {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 4000);
    this.camera.position.set(120, 80, 160);
    this.camera.lookAt(0, HUB_HEIGHT, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, HUB_HEIGHT * 0.6, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 50;
    this.controls.maxDistance = 500;
    this.controls.maxPolarAngle = Math.PI * 0.52;

    this.clock = new THREE.Clock();

    // Live, smoothed values
    this.state = {
      rotor_rpm: 0,
      pitch_angle_deg: 0,
      yaw_angle_deg: 180,
      wind_direction_deg: 180,
      wind_speed_ms: 0,
      anomaly: 0,
      operational_state: 'Stopped',
    };
    // Smoothed display values (lagged toward target)
    this.disp = { ...this.state, rotor_theta: 0, alert: 0 };

    this._buildSky();
    this._buildGround();
    this._buildLighting();
    this._buildTurbine();
    this._buildWindIndicator();
    this._bindResize();
    this._loop();
  }

  // ---------- setup ----------

  _buildSky() {
    // Gradient sky — dark operator aesthetic. A large sphere with
    // vertex-colour gradient so we don't depend on a texture.
    const geo = new THREE.SphereGeometry(2000, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x0a0d13) },
        midColor: { value: new THREE.Color(0x1a2a33) },
        bottomColor: { value: new THREE.Color(0x06080b) },
      },
      vertexShader: `varying vec3 vWorld; void main(){ vWorld = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vWorld;
        uniform vec3 topColor, midColor, bottomColor;
        void main(){
          float h = normalize(vWorld).y;
          vec3 c = mix(bottomColor, midColor, smoothstep(-0.1, 0.3, h));
          c = mix(c, topColor, smoothstep(0.3, 0.9, h));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.scene.add(this.sky);

    this.scene.fog = new THREE.FogExp2(0x0a0d13, 0.0012);
  }

  _buildGround() {
    const groundGeo = new THREE.CircleGeometry(800, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x12171c, roughness: 1.0, metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // Subtle grid helper to evoke a control-room overlay
    const grid = new THREE.GridHelper(800, 40, 0x1b4148, 0x12272b);
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    grid.position.y = 0.05;
    this.scene.add(grid);

    // Teal footprint ring around tower base
    const ringGeo = new THREE.RingGeometry(TOWER_BASE_RADIUS + 1.2, TOWER_BASE_RADIUS + 1.6, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4bc6cd, side: THREE.DoubleSide, transparent: true, opacity: 0.55,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    this.scene.add(ring);
  }

  _buildLighting() {
    const ambient = new THREE.AmbientLight(0x4a5a68, 0.55);
    this.scene.add(ambient);

    // Key light — low cool sun
    const key = new THREE.DirectionalLight(0xdce6ef, 1.1);
    key.position.set(150, 200, 120);
    this.scene.add(key);

    // Rim teal
    this.rim = new THREE.DirectionalLight(0x4bc6cd, 0.6);
    this.rim.position.set(-120, 80, -140);
    this.scene.add(this.rim);

    // Hemisphere for soft ground bounce
    const hemi = new THREE.HemisphereLight(0x8aa4b8, 0x1a1a1f, 0.35);
    this.scene.add(hemi);
  }

  _buildTurbine() {
    this.turbine = new THREE.Group();
    this.scene.add(this.turbine);

    // --- Tower (tapered) ---
    const towerGeo = new THREE.CylinderGeometry(
      TOWER_TOP_RADIUS, TOWER_BASE_RADIUS, HUB_HEIGHT, 40, 1, true
    );
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xe5e6e4, roughness: 0.75, metalness: 0.15, side: THREE.DoubleSide,
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = HUB_HEIGHT / 2;
    this.turbine.add(tower);

    // Tower shadow gradient via vertex colors? Keep simple with a subtle dark band at the base
    const baseGeo = new THREE.CylinderGeometry(TOWER_BASE_RADIUS * 1.05, TOWER_BASE_RADIUS * 1.25, 3, 32);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 1.5;
    this.turbine.add(base);

    // --- Nacelle assembly (yaw-rotates around vertical axis) ---
    this.yawGroup = new THREE.Group();
    this.yawGroup.position.y = HUB_HEIGHT;
    this.turbine.add(this.yawGroup);

    // Nacelle body — rounded box (box + hemi caps)
    const nacelleGeo = new THREE.BoxGeometry(NACELLE_LENGTH, NACELLE_HEIGHT, NACELLE_WIDTH);
    this.nacelleMat = new THREE.MeshStandardMaterial({
      color: 0xdad9d4, roughness: 0.55, metalness: 0.3,
    });
    this.nacelle = new THREE.Mesh(nacelleGeo, this.nacelleMat);
    this.nacelle.position.set(-0.5, 0, 0); // shift slightly back from hub
    this.yawGroup.add(this.nacelle);

    // Nacelle cap (front rounded)
    const capGeo = new THREE.SphereGeometry(NACELLE_HEIGHT / 2, 24, 16, 0, Math.PI);
    const cap = new THREE.Mesh(capGeo, this.nacelleMat);
    cap.rotation.y = Math.PI / 2;
    cap.position.set(NACELLE_LENGTH / 2 - 0.5, 0, 0);
    cap.scale.set(NACELLE_WIDTH / NACELLE_HEIGHT, 1, 1);
    this.yawGroup.add(cap);

    // Status light on top of nacelle
    const lightGeo = new THREE.SphereGeometry(0.45, 12, 12);
    this.statusLightMat = new THREE.MeshBasicMaterial({ color: 0x6ed8de });
    this.statusLight = new THREE.Mesh(lightGeo, this.statusLightMat);
    this.statusLight.position.set(-1.5, NACELLE_HEIGHT / 2 + 0.3, 0);
    this.yawGroup.add(this.statusLight);

    // Subtle point light for status pulse
    this.statusPointLight = new THREE.PointLight(0x6ed8de, 0, 30);
    this.statusPointLight.position.copy(this.statusLight.position);
    this.yawGroup.add(this.statusPointLight);

    // --- Hub (on front of nacelle, along +x in yaw-local space) ---
    this.hubGroup = new THREE.Group();
    this.hubGroup.position.set(NACELLE_LENGTH / 2 + 0.8, 0, 0);
    // Blades spin around their own axis which, in yaw-local space, runs along +x
    this.yawGroup.add(this.hubGroup);

    const hubGeo = new THREE.SphereGeometry(HUB_RADIUS, 24, 18);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0xe2e1dc, roughness: 0.45, metalness: 0.35,
    });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    this.hubGroup.add(hub);

    // Rotor — spins around hub-local +x. Inside hubGroup, we use rotation.x.
    this.rotorGroup = new THREE.Group();
    this.hubGroup.add(this.rotorGroup);

    // Three blades at 120° around the rotor axis (+x).
    this.bladeGroups = [];
    for (let i = 0; i < 3; i++) {
      const phase = (i / 3) * Math.PI * 2;
      const bladeAssembly = new THREE.Group();
      bladeAssembly.rotation.x = phase;   // position around rotor axis
      this.rotorGroup.add(bladeAssembly);

      // Inside bladeAssembly, blade extends along +y in rotor-local space
      const pitchGroup = new THREE.Group();
      bladeAssembly.add(pitchGroup);
      // pitchGroup rotates around y (the blade's long axis)

      const blade = this._makeBlade();
      pitchGroup.add(blade);

      this.bladeGroups.push({ bladeAssembly, pitchGroup, phase });
    }
  }

  _makeBlade() {
    // Blade = a tapered shape built from a custom BufferGeometry.
    // Blade runs along +Y from the hub (0,0,0) to (0, BLADE_LENGTH, 0),
    // chord (width) along +Z, thickness along +X (thin).
    const len = BLADE_LENGTH;
    const tipOffset = 1.5;      // tip section width
    const rootChord = 2.6;      // root chord
    const rootThick = 0.7;      // thick root
    const tipThick = 0.15;      // thin tip
    const segments = 10;

    const verts = [];
    const idx = [];

    // Produce two rings per segment: leading edge + trailing edge, airfoil-ish.
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = t * len;
      // Chord + thickness taper from root to tip
      const chord = rootChord * (1 - t * 0.6) + 0.2;
      const thick = rootThick * (1 - t * 0.85) + tipThick * t;
      const shift = t * tipOffset;  // slight tip sweep forward in +z
      // 4 vertices around the airfoil cross-section (simplified to a lens)
      verts.push(
        // leading edge
        thick * 0.5,  y,  -chord * 0.3 + shift,
        // upper surface mid
        thick * 0.3,  y,   chord * 0.4 + shift,
        // trailing edge
        -thick * 0.3, y,   chord * 0.7 + shift,
        // lower surface mid
        -thick * 0.4, y,  -chord * 0.1 + shift,
      );
    }
    // Faces
    for (let i = 0; i < segments; i++) {
      const r0 = i * 4;
      const r1 = (i + 1) * 4;
      for (let k = 0; k < 4; k++) {
        const a = r0 + k;
        const b = r0 + ((k + 1) % 4);
        const c = r1 + ((k + 1) % 4);
        const d = r1 + k;
        idx.push(a, b, c, a, c, d);
      }
    }
    // Cap the tip
    const lastRing = segments * 4;
    idx.push(lastRing, lastRing + 1, lastRing + 2, lastRing, lastRing + 2, lastRing + 3);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xf4f4ef, roughness: 0.45, metalness: 0.12,
      flatShading: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // slight offset so the blade root sits at the hub surface
    mesh.position.y = HUB_RADIUS * 0.4;
    return mesh;
  }

  _buildWindIndicator() {
    // A subtle arrow + dashed streak at ground plane, pointing
    // in the direction the wind is blowing toward.
    this.windGroup = new THREE.Group();
    this.windGroup.position.set(0, 0.6, 0);
    this.scene.add(this.windGroup);

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 18, 12),
      new THREE.MeshBasicMaterial({ color: 0x4bc6cd, transparent: true, opacity: 0.55 })
    );
    shaft.rotation.z = Math.PI / 2; // point along +x
    shaft.position.set(9, 0, 0);
    this.windGroup.add(shaft);

    const head = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 2.4, 16),
      new THREE.MeshBasicMaterial({ color: 0x4bc6cd, transparent: true, opacity: 0.8 })
    );
    head.rotation.z = -Math.PI / 2;
    head.position.set(19.2, 0, 0);
    this.windGroup.add(head);

    // Streak dashes — animate by cycling offsets
    this.windStreaks = [];
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(
        new THREE.BoxGeometry(3, 0.2, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x4bc6cd, transparent: true, opacity: 0.35 })
      );
      s.position.set(-25 + i * 6, 0, 0);
      this.windGroup.add(s);
      this.windStreaks.push(s);
    }
  }

  // ---------- state binding ----------

  updateState(state) {
    // Accept partial state updates; don't throw if fields missing
    if (!state) return;
    if (typeof state.rotor_rpm === 'number') this.state.rotor_rpm = state.rotor_rpm;
    if (typeof state.pitch_angle_deg === 'number') this.state.pitch_angle_deg = state.pitch_angle_deg;
    if (typeof state.yaw_angle_deg === 'number') this.state.yaw_angle_deg = state.yaw_angle_deg;
    if (typeof state.wind_direction_deg === 'number') this.state.wind_direction_deg = state.wind_direction_deg;
    if (typeof state.wind_speed_ms === 'number') this.state.wind_speed_ms = state.wind_speed_ms;
    if (typeof state.operational_state === 'string') this.state.operational_state = state.operational_state;
  }

  updatePrediction(pred) {
    if (!pred) return;
    if (typeof pred.anomaly_score === 'number') this.state.anomaly = pred.anomaly_score;
  }

  // ---------- loop ----------

  _bindResize() {
    const resize = () => {
      const c = this.canvas;
      const rect = c.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(this.canvas);
    window.addEventListener('resize', resize);
  }

  _loop() {
    const tick = () => {
      const dt = Math.min(0.1, this.clock.getDelta());

      // --- smooth displayed values toward target ---
      const lerp = (a, b, t) => a + (b - a) * t;
      const lerpAngle = (a, b, t) => {
        let d = ((b - a + 540) % 360) - 180;
        return a + d * t;
      };

      this.disp.rotor_rpm = lerp(this.disp.rotor_rpm, this.state.rotor_rpm, 0.08);
      this.disp.pitch_angle_deg = lerp(this.disp.pitch_angle_deg, this.state.pitch_angle_deg, 0.08);
      this.disp.yaw_angle_deg = lerpAngle(this.disp.yaw_angle_deg, this.state.yaw_angle_deg, 0.05);
      this.disp.wind_direction_deg = lerpAngle(this.disp.wind_direction_deg, this.state.wind_direction_deg, 0.05);

      // Alert intensity: rises on Faulted or high anomaly
      const alertTarget = this.state.operational_state === 'Faulted' ? 1
                        : this.state.anomaly > 0.5 ? Math.min(1, (this.state.anomaly - 0.5) * 2)
                        : 0;
      this.disp.alert = lerp(this.disp.alert, alertTarget, 0.06);

      // --- rotor spin ---
      // rpm → rad/s: rpm * 2π/60
      const radPerSec = (this.disp.rotor_rpm * Math.PI * 2) / 60;
      this.disp.rotor_theta += radPerSec * dt;
      this.rotorGroup.rotation.x = this.disp.rotor_theta;

      // --- blade pitch around long axis (y in bladeAssembly local space) ---
      const pitchRad = (this.disp.pitch_angle_deg * Math.PI) / 180;
      for (const bg of this.bladeGroups) {
        bg.pitchGroup.rotation.y = pitchRad;
      }

      // --- yaw (nacelle rotates around world +y) ---
      // yaw_angle_deg is compass-style (0=N, 90=E). Nacelle default faces +x.
      // We align nacelle's +x face with the wind "from" direction.
      // Simple mapping: world rotation.y = -(yaw - 180) radians, tweakable.
      const yawRad = ((this.disp.yaw_angle_deg - 180) * Math.PI) / 180;
      this.yawGroup.rotation.y = -yawRad;

      // --- wind indicator ---
      if (this.windGroup) {
        const wdRad = ((this.disp.wind_direction_deg - 180) * Math.PI) / 180;
        this.windGroup.rotation.y = -wdRad;
        // Pulse streaks with wind speed
        const speedPulse = 1 + Math.min(1, this.state.wind_speed_ms / 15);
        this.windStreaks.forEach((s, i) => {
          s.position.x = -25 + ((i * 6 + performance.now() * 0.0005 * speedPulse * 20) % 42);
          s.material.opacity = 0.2 + 0.25 * speedPulse;
        });
      }

      // --- alert tinting ---
      const baseColor = new THREE.Color(0xdad9d4);
      const alertColor = new THREE.Color(0xe56b72);
      const blended = baseColor.clone().lerp(alertColor, this.disp.alert * 0.75);
      this.nacelleMat.color.copy(blended);

      // Status light pulse
      const now = performance.now() * 0.001;
      if (this.disp.alert > 0.1) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 6);
        this.statusLightMat.color.setRGB(1.0, 0.35 + 0.2 * pulse, 0.35 + 0.2 * pulse);
        this.statusPointLight.color.setRGB(1.0, 0.4, 0.4);
        this.statusPointLight.intensity = 2.5 * pulse * this.disp.alert;
      } else {
        this.statusLightMat.color.setHex(0x6ed8de);
        this.statusPointLight.color.setHex(0x6ed8de);
        this.statusPointLight.intensity = 0.4;
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
