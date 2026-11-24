import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment";
import { CONFIG, COLORS } from "../config.js";
import {
  createGridTexture,
  createPlatformTexture,
  createRadialGlowTexture,
} from "../utils/textures.js";

/**
 * Owns everything that is visual in the laboratory: renderer, scene, camera,
 * lights, the platform and the decorative architecture. It also registers the
 * static colliders that match the visible structures.
 */
export class LabScene {
  constructor(container, Ammo, physics) {
    this.container = container;
    this.Ammo = Ammo;
    this.physics = physics;
    this.staticBodies = [];
    this.animatedRings = [];
    this.pylons = [];
    this.lights = {};
    this.hatchState = { r: 0.34 };
    this._hatchTween = null;
    this._emitterBoost = 0;
    this._disposables = [];

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._buildPlatform();
    this._buildArchitecture();
    this._buildEmitter();
    this._buildAtmosphere();
    this._initResize();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.classList.add("lab-canvas");
    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.background);
    this.scene.fog = new THREE.FogExp2(COLORS.fog, 0.0175);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this._envRenderTarget = pmrem.fromScene(room, 0.04);
    this.scene.environment = this._envRenderTarget.texture;
    pmrem.dispose();
    room.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fov,
      this.container.clientWidth / this.container.clientHeight,
      CONFIG.camera.near,
      CONFIG.camera.far
    );
    this.camera.position.copy(this.getDefaultCameraPosition());

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(
      CONFIG.camera.target.x,
      CONFIG.camera.target.y,
      CONFIG.camera.target.z
    );
    this.controls.enableDamping = true;
    this.controls.dampingFactor = CONFIG.camera.damping;
    this.controls.minDistance = CONFIG.camera.minDistance;
    this.controls.maxDistance = CONFIG.camera.maxDistance;
    this.controls.maxPolarAngle = CONFIG.camera.maxPolarAngle;
    this.controls.screenSpacePanning = false;
    this.controls.update();
  }

  getDefaultCameraPosition() {
    const aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1);
    const preset = aspect < 1.12 ? CONFIG.camera.narrow : CONFIG.camera.desktop;
    return new THREE.Vector3(preset.x, preset.y, preset.z);
  }

  _initLights() {
    this.lights.ambient = new THREE.HemisphereLight(0x5c82a8, 0x04060a, 0.45);
    this.scene.add(this.lights.ambient);

    const key = new THREE.DirectionalLight(0xd7e9ff, 2.35);
    key.position.set(11, 17, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -14;
    key.shadow.camera.right = 14;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -14;
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 45;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.025;
    this.scene.add(key);
    this.lights.key = key;

    const rim = new THREE.DirectionalLight(COLORS.blue, 1.65);
    rim.position.set(-13, 7, -10);
    this.scene.add(rim);
    this.lights.rim = rim;

    const fill = new THREE.DirectionalLight(0x8ef2ff, 0.75);
    fill.position.set(2, 4, 14);
    this.scene.add(fill);
    this.lights.fill = fill;

    const floorGlow = new THREE.PointLight(0x1d8dff, 2.6, 26, 2);
    floorGlow.position.set(0, -1.4, 0);
    this.scene.add(floorGlow);
    this.lights.floor = floorGlow;

    const sideGlow = new THREE.PointLight(0x2f7dff, 1.4, 22, 2);
    sideGlow.position.set(7.5, 2.2, -5.5);
    this.scene.add(sideGlow);
    this.lights.side = sideGlow;

    this._lightTargets = {
      ambient: this.lights.ambient.intensity,
      key: this.lights.key.intensity,
      rim: this.lights.rim.intensity,
      fill: this.lights.fill.intensity,
      floor: this.lights.floor.intensity,
      side: this.lights.side.intensity,
    };
  }

  _steelMaterial(color = 0x121922) {
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.92,
      roughness: 0.34,
      envMapIntensity: 0.85,
    });
    this._disposables.push(material);
    return material;
  }

  _glowMaterial(color, opacity = 1) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this._disposables.push(material);
    return material;
  }

  _buildPlatform() {
    const radius = CONFIG.world.platformRadius;
    const height = CONFIG.world.platformHeight;

    this.platformGroup = new THREE.Group();
    this.scene.add(this.platformGroup);

    const steel = this._steelMaterial(0x10171f);
    const darkSteel = this._steelMaterial(0x0a0f15);

    // Structural base under the disc.
    const baseGeometry = new THREE.CylinderGeometry(4.4, 5.1, 2.0, 64, 1);
    const base = new THREE.Mesh(baseGeometry, darkSteel);
    base.position.y = CONFIG.world.floorY + 1.0;
    base.castShadow = true;
    base.receiveShadow = true;
    this.platformGroup.add(base);
    this._registerDisposableGeometry(baseGeometry);
    this._addStaticCylinder(4.45, 1.95, { x: 0, y: CONFIG.world.floorY + 1.0, z: 0 });

    // Main platform disc.
    const discGeometry = new THREE.CylinderGeometry(radius, radius * 1.015, height, 96, 1);
    const disc = new THREE.Mesh(discGeometry, steel);
    disc.position.y = CONFIG.world.platformTop - height / 2;
    disc.castShadow = true;
    disc.receiveShadow = true;
    this.platformGroup.add(disc);
    this._registerDisposableGeometry(discGeometry);
    this._addStaticCylinder(radius, height, { x: 0, y: CONFIG.world.platformTop - height / 2, z: 0 });

    // Top surface with a radial laboratory texture.
    const platformTexture = createPlatformTexture();
    const topMaterial = new THREE.MeshStandardMaterial({
      map: platformTexture,
      color: 0xffffff,
      metalness: 0.55,
      roughness: 0.42,
      emissive: 0x0d5a70,
      emissiveMap: platformTexture,
      emissiveIntensity: 0.28,
      envMapIntensity: 0.7,
    });
    this._disposables.push(topMaterial);
    this._disposables.push(platformTexture);
    const topGeometry = new THREE.CircleGeometry(radius - 0.015, 96);
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.rotation.x = -Math.PI / 2;
    top.position.y = CONFIG.world.platformTop + 0.006;
    top.receiveShadow = true;
    this.platformGroup.add(top);
    this._registerDisposableGeometry(topGeometry);

    // Luminous rim.
    const rimRingGeometry = new THREE.TorusGeometry(radius + 0.015, 0.028, 8, 160);
    const rimRing = new THREE.Mesh(rimRingGeometry, this._glowMaterial(COLORS.cyan, 0.7));
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = -0.08;
    this.platformGroup.add(rimRing);
    this._registerDisposableGeometry(rimRingGeometry);

    const outerRingGeometry = new THREE.TorusGeometry(radius + 0.06, 0.012, 6, 160);
    const outerRing = new THREE.Mesh(
      outerRingGeometry,
      this._glowMaterial(COLORS.blue, 0.8)
    );
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = -0.56;
    this.platformGroup.add(outerRing);
    this._registerDisposableGeometry(outerRingGeometry);

    // Segmented safety curb: visual + matching static colliders.
    const curbMaterial = this._steelMaterial(0x1a2531);
    const segments = 24;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * (radius - 0.16);
      const z = Math.sin(angle) * (radius - 0.16);
      const geometry = new THREE.BoxGeometry(1.5, 0.2, 0.16);
      const mesh = new THREE.Mesh(geometry, curbMaterial);
      mesh.position.set(x, 0.1, z);
      mesh.rotation.y = -angle - Math.PI / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.platformGroup.add(mesh);
      this._registerDisposableGeometry(geometry);
      this._addStaticBox(0.75, 0.1, 0.08, mesh.position, mesh.quaternion);
    }

    // Raised experimentation pads.
    this._buildPad(-3.55, -3.95, 1.05, 0.6);
    this._buildPad(3.55, -3.6, 1.3, 0.95);

    // Floor.
    const gridTexture = createGridTexture();
    gridTexture.repeat.set(26, 26);
    this._disposables.push(gridTexture);
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: gridTexture,
      color: 0x8fa4b5,
      metalness: 0.55,
      roughness: 0.72,
      emissive: 0x0c3546,
      emissiveMap: gridTexture,
      emissiveIntensity: 0.24,
      envMapIntensity: 0.45,
    });
    this._disposables.push(floorMaterial);
    const floorGeometry = new THREE.PlaneGeometry(150, 150);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = CONFIG.world.floorY;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this._registerDisposableGeometry(floorGeometry);

    // Matching static floor collider (top at floorY).
    this._addStaticBox(75, 0.15, 75, {
      x: 0,
      y: CONFIG.world.floorY - 0.15,
      z: 0,
    });

    // Invisible ceiling: keeps inverted-gravity experiments inside the lab.
    if (CONFIG.world.hiddenCeiling) {
      this._addStaticBox(40, 0.5, 40, {
        x: 0,
        y: CONFIG.world.ceilingY,
        z: 0,
      });
    }

    // Soft light pool under the platform.
    const glowTexture = createRadialGlowTexture();
    this._disposables.push(glowTexture);
    const glowMaterial = new THREE.MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      color: 0x2e8dd6,
    });
    this._disposables.push(glowMaterial);
    const glowGeometry = new THREE.PlaneGeometry(30, 30);
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = CONFIG.world.floorY + 0.02;
    this.scene.add(glow);
    this._registerDisposableGeometry(glowGeometry);

    this._buildHatch();
  }

  _buildPad(x, z, radius, height) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    this.platformGroup.add(group);

    const material = this._steelMaterial(0x141d27);
    const geometry = new THREE.CylinderGeometry(radius, radius * 1.08, height, 48);
    const pad = new THREE.Mesh(geometry, material);
    pad.position.y = height * 0.5;
    pad.castShadow = true;
    pad.receiveShadow = true;
    group.add(pad);
    this._registerDisposableGeometry(geometry);
    this._addStaticCylinder(radius, height, { x, y: height * 0.5, z });

    const ringGeometry = new THREE.TorusGeometry(radius * 0.82, 0.018, 6, 72);
    const ring = new THREE.Mesh(ringGeometry, this._glowMaterial(COLORS.cyan, 0.62));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height + 0.012;
    group.add(ring);
    this._registerDisposableGeometry(ringGeometry);

    const innerGeometry = new THREE.CylinderGeometry(radius * 0.55, radius * 0.6, 0.02, 48);
    const inner = new THREE.Mesh(innerGeometry, this._steelMaterial(0x0a1017));
    inner.position.y = height + 0.008;
    group.add(inner);
    this._registerDisposableGeometry(innerGeometry);
  }

  _buildHatch() {
    this.hatchGroup = new THREE.Group();
    this.hatchGroup.position.y = CONFIG.world.platformTop + 0.035;
    this.platformGroup.add(this.hatchGroup);

    const material = this._steelMaterial(0x1b2a36);
    const edgeMaterial = this._glowMaterial(COLORS.cyan, 0.75);
    const petalGeometry = new THREE.BoxGeometry(0.78, 0.045, 0.34);
    this._registerDisposableGeometry(petalGeometry);
    const tipGeometry = new THREE.BoxGeometry(0.56, 0.012, 0.035);
    this._registerDisposableGeometry(tipGeometry);

    this.hatchPetals = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const petal = new THREE.Group();
      petal.rotation.y = -angle;

      const panel = new THREE.Mesh(petalGeometry, material);
      panel.position.set(0, 0, 0.42);
      panel.castShadow = true;
      petal.add(panel);

      const tip = new THREE.Mesh(tipGeometry, edgeMaterial);
      tip.position.set(0, 0.032, 0.66);
      petal.add(tip);

      this.hatchGroup.add(petal);
      this.hatchPetals.push({ group: petal, angle });
    }
    this._layoutHatch();
  }

  _layoutHatch() {
    const radius = this.hatchState.r;
    for (const petal of this.hatchPetals) {
      petal.group.position.set(
        Math.cos(petal.angle) * radius,
        0,
        Math.sin(petal.angle) * radius
      );
    }
  }

  openHatch() {
    if (this._hatchTween) this._hatchTween.stop();
    this._hatchTween = new TWEEN.Tween(this.hatchState)
      .to({ r: 1.1 }, 260)
      .easing(TWEEN.Easing.Cubic.Out)
      .onUpdate(() => this._layoutHatch())
      .start();
  }

  cycleHatch() {
    this.openHatch();
    const close = new TWEEN.Tween(this.hatchState)
      .to({ r: 0.34 }, 420)
      .delay(380)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(() => this._layoutHatch());
    this._hatchTween.chain(close);
  }

  _buildArchitecture() {
    const steel = this._steelMaterial(0x0d141c);
    const glowMaterial = this._glowMaterial(0x46d6ff, 0.9);

    // Framing pylons.
    const positions = [
      [-8.8, -8.8],
      [8.8, -8.8],
      [-8.8, 8.8],
      [8.8, 8.8],
    ];
    for (const [x, z] of positions) {
      const group = new THREE.Group();
      group.position.set(x, CONFIG.world.floorY, z);
      this.scene.add(group);

      const baseGeometry = new THREE.BoxGeometry(1.0, 0.18, 1.0);
      const base = new THREE.Mesh(baseGeometry, steel);
      base.position.y = 0.09;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);
      this._registerDisposableGeometry(baseGeometry);

      const columnGeometry = new THREE.BoxGeometry(0.42, 4.3, 0.42);
      const column = new THREE.Mesh(columnGeometry, steel);
      column.position.y = 2.3;
      column.castShadow = true;
      column.receiveShadow = true;
      group.add(column);
      this._registerDisposableGeometry(columnGeometry);

      const rodGeometry = new THREE.CylinderGeometry(0.035, 0.035, 3.6, 8);
      const inward = new THREE.Vector3(-x, 0, -z).normalize().multiplyScalar(0.27);
      const rod = new THREE.Mesh(rodGeometry, glowMaterial);
      rod.position.set(inward.x, 2.4, inward.z);
      group.add(rod);
      this._registerDisposableGeometry(rodGeometry);

      const capGeometry = new THREE.BoxGeometry(0.62, 0.08, 0.62);
      const cap = new THREE.Mesh(capGeometry, glowMaterial);
      cap.position.y = 4.48;
      group.add(cap);
      this._registerDisposableGeometry(capGeometry);

      group.userData.baseY = group.position.y;
      group.position.y -= 3.2;
      this.pylons.push(group);
    }

    // Distant observation gate.
    const gate = new THREE.Group();
    gate.position.set(0, CONFIG.world.floorY, -13.5);
    this.scene.add(gate);

    const postGeometry = new THREE.BoxGeometry(0.55, 7.4, 0.55);
    for (const x of [-5.9, 5.9]) {
      const post = new THREE.Mesh(postGeometry, steel);
      post.position.set(x, 3.7, 0);
      gate.add(post);
    }
    this._registerDisposableGeometry(postGeometry);

    const beamGeometry = new THREE.BoxGeometry(12.4, 0.42, 0.6);
    const beam = new THREE.Mesh(beamGeometry, steel);
    beam.position.y = 7.25;
    gate.add(beam);
    this._registerDisposableGeometry(beamGeometry);

    const gateGlowGeometry = new THREE.BoxGeometry(11.2, 0.035, 0.035);
    const gateGlow = new THREE.Mesh(gateGlowGeometry, glowMaterial);
    gateGlow.position.set(0, 7.0, 0.32);
    gate.add(gateGlow);
    this._registerDisposableGeometry(gateGlowGeometry);
    this.gate = gate;

    // Background observation rings.
    const backdrop = new THREE.Group();
    backdrop.position.set(0, 5.5, -26);
    this.scene.add(backdrop);
    const ringGeometry = new THREE.TorusGeometry(11.5, 0.045, 6, 160);
    const ring = new THREE.Mesh(ringGeometry, this._glowMaterial(0x155c88, 0.65));
    backdrop.add(ring);
    this._registerDisposableGeometry(ringGeometry);
    const ring2Geometry = new THREE.TorusGeometry(15.5, 0.022, 6, 160);
    const ring2 = new THREE.Mesh(ring2Geometry, this._glowMaterial(0x1a6f9e, 0.35));
    backdrop.add(ring2);
    this._registerDisposableGeometry(ring2Geometry);
    this.backdrop = backdrop;
  }

  _buildEmitter() {
    this.emitter = new THREE.Group();
    this.emitter.position.set(0, 6.15, 0);
    this.scene.add(this.emitter);

    const coreGeometry = new THREE.SphereGeometry(0.2, 24, 16);
    this.emitterCore = new THREE.Mesh(
      coreGeometry,
      this._glowMaterial(0xc8f8ff, 0.95)
    );
    this.emitter.add(this.emitterCore);
    this._registerDisposableGeometry(coreGeometry);

    const ringMaterial = this._glowMaterial(COLORS.cyan, 0.75);
    const ringConfigs = [
      { radius: 1.0, rotation: [Math.PI / 2, 0, 0], speed: 0.35 },
      { radius: 1.38, rotation: [Math.PI / 2.25, 0.45, 0.2], speed: -0.26 },
      { radius: 1.8, rotation: [0.35, 0.25, 0.55], speed: 0.18 },
    ];
    for (const config of ringConfigs) {
      const geometry = new THREE.TorusGeometry(config.radius, 0.014, 6, 128);
      const ring = new THREE.Mesh(geometry, ringMaterial);
      ring.rotation.set(...config.rotation);
      ring.userData.speed = config.speed;
      this.emitter.add(ring);
      this.animatedRings.push(ring);
      this._registerDisposableGeometry(geometry);
    }

    const haloTexture = createRadialGlowTexture();
    this._disposables.push(haloTexture);
    const haloMaterial = new THREE.SpriteMaterial({
      map: haloTexture,
      color: 0x5cddff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this._disposables.push(haloMaterial);
    this.emitterHalo = new THREE.Sprite(haloMaterial);
    this.emitterHalo.scale.setScalar(3.6);
    this.emitter.add(this.emitterHalo);

    // Gravitational projector beam.
    const beamGeometry = new THREE.CylinderGeometry(0.16, 2.6, 6.1, 40, 1, true);
    this.beamMaterial = new THREE.MeshBasicMaterial({
      color: 0x3ecbff,
      transparent: true,
      opacity: 0.045,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this._disposables.push(this.beamMaterial);
    this.beam = new THREE.Mesh(beamGeometry, this.beamMaterial);
    this.beam.position.y = -3.1;
    this.emitter.add(this.beam);
    this._registerDisposableGeometry(beamGeometry);

    const innerBeamGeometry = new THREE.CylinderGeometry(0.03, 0.4, 6.1, 20, 1, true);
    this.innerBeamMaterial = this._glowMaterial(0x9af6ff, 0.13);
    const innerBeam = new THREE.Mesh(innerBeamGeometry, this.innerBeamMaterial);
    innerBeam.position.y = -3.1;
    this.emitter.add(innerBeam);
    this._registerDisposableGeometry(innerBeamGeometry);

    this.emitterLight = new THREE.PointLight(0x4fe4ff, 2.4, 16, 2);
    this.emitterLight.position.set(0, 5.9, 0);
    this.scene.add(this.emitterLight);
    this.lights.emitter = this.emitterLight;
    this._lightTargets.emitter = this.emitterLight.intensity;
  }

  _buildAtmosphere() {
    const starCount = 700;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const radius = 38 + Math.random() * 55;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) * 0.65 - 2;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x7cc9ff,
      size: 0.16,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this._disposables.push(material);
    this.stars = new THREE.Points(geometry, material);
    this.scene.add(this.stars);
    this._registerDisposableGeometry(geometry);
  }

  _registerDisposableGeometry(geometry) {
    this._disposables.push(geometry);
  }

  _addStaticBox(halfX, halfY, halfZ, position, quaternion) {
    const shape = this.physics.createBoxShape(halfX, halfY, halfZ);
    const record = this.physics.createBody({
      shape,
      mass: 0,
      position,
      quaternion: quaternion || { x: 0, y: 0, z: 0, w: 1 },
      userIndex: -1,
    });
    this.staticBodies.push(record);
    return record;
  }

  _addStaticCylinder(radius, height, position) {
    const shape = this.physics.createCylinderShape(radius, height);
    const record = this.physics.createBody({
      shape,
      mass: 0,
      position,
      userIndex: -1,
    });
    this.staticBodies.push(record);
    return record;
  }

  playIntro() {
    const intro = { progress: 0 };

    this.pylons.forEach((pylon, index) => {
      pylon.position.y = pylon.userData.baseY - 3.2;
      new TWEEN.Tween(pylon.position)
        .to({ y: pylon.userData.baseY }, 1350)
        .delay(120 + index * 90)
        .easing(TWEEN.Easing.Exponential.Out)
        .start();
    });

    this.emitter.scale.setScalar(0.01);
    new TWEEN.Tween(this.emitter.scale)
      .to({ x: 1, y: 1, z: 1 }, 1400)
      .delay(260)
      .easing(TWEEN.Easing.Elastic.Out)
      .start();

    this.gate.scale.y = 0.01;
    new TWEEN.Tween(this.gate.scale)
      .to({ y: 1 }, 1500)
      .delay(180)
      .easing(TWEEN.Easing.Exponential.Out)
      .start();

    const pulse = { value: 0 };
    new TWEEN.Tween(pulse)
      .to({ value: 1 }, 1600)
      .delay(200)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(() => {
        intro.progress = pulse.value;
        this.lights.key.intensity = this._lightTargets.key * (0.25 + 0.75 * pulse.value);
        this.lights.floor.intensity = this._lightTargets.floor * (0.2 + 0.8 * pulse.value);
        this.lights.rim.intensity = this._lightTargets.rim * (0.25 + 0.75 * pulse.value);
      })
      .start();

    // A small calibration pulse travelling through the emitter.
    this.pulseEmitter(1.6);

    // Cinematic camera approach towards the default framing.
    const destination = this.getDefaultCameraPosition();
    const start = destination.clone().multiplyScalar(1.34);
    start.y += 3.4;
    this.camera.position.copy(start);
    const cameraState = { progress: 0 };
    new TWEEN.Tween(cameraState)
      .to({ progress: 1 }, 2100)
      .easing(TWEEN.Easing.Exponential.Out)
      .onUpdate(() => {
        this.camera.position.lerpVectors(start, destination, cameraState.progress);
      })
      .start();
  }

  pulseEmitter(strength = 1) {
    this._emitterBoost = strength;
    new TWEEN.Tween(this)
      .to({ _emitterBoost: 0 }, 900)
      .easing(TWEEN.Easing.Quadratic.Out)
      .start();
  }

  openHatchForDeploy() {
    this.cycleHatch();
    this.pulseEmitter(0.9);
  }

  resetCamera(animated = true) {
    const destination = this.getDefaultCameraPosition();
    const target = new THREE.Vector3(
      CONFIG.camera.target.x,
      CONFIG.camera.target.y,
      CONFIG.camera.target.z
    );

    if (!animated) {
      this.camera.position.copy(destination);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }

    const from = {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z,
      tx: this.controls.target.x,
      ty: this.controls.target.y,
      tz: this.controls.target.z,
    };
    new TWEEN.Tween(from)
      .to(
        {
          x: destination.x,
          y: destination.y,
          z: destination.z,
          tx: target.x,
          ty: target.y,
          tz: target.z,
        },
        1200
      )
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(() => {
        this.camera.position.set(from.x, from.y, from.z);
        this.controls.target.set(from.tx, from.ty, from.tz);
      })
      .start();
  }

  update(delta, elapsed) {
    const dampedDelta = Math.min(delta, 0.05);
    for (const ring of this.animatedRings) {
      ring.rotation.z += ring.userData.speed * dampedDelta;
      ring.rotation.x += ring.userData.speed * 0.25 * dampedDelta;
    }

    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.6);
    const boost = this._emitterBoost;
    this.emitterCore.scale.setScalar(1 + pulse * 0.16 + boost * 0.45);
    this.emitterHalo.scale.setScalar(3.6 + pulse * 0.35 + boost * 1.4);
    this.emitterLight.intensity =
      this._lightTargets.emitter * (0.85 + pulse * 0.15) + boost * 1.8;
    this.beamMaterial.opacity = 0.035 + pulse * 0.018 + boost * 0.03;
    this.innerBeamMaterial.opacity = 0.09 + pulse * 0.05;
    this.backdrop.rotation.z += dampedDelta * 0.015;
    this.stars.rotation.y += dampedDelta * 0.004;
  }

  _initResize() {
    this._onResize = () => {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      if (!width || !height) return;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };
    window.addEventListener("resize", this._onResize);
    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(this._onResize);
      this._resizeObserver.observe(this.container);
    }
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener("resize", this._onResize);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this.controls.dispose();
    for (const geometry of this._disposables) {
      if (geometry && geometry.isTexture) {
        geometry.dispose();
      } else if (geometry) {
        geometry.dispose();
      }
    }
    if (this._envRenderTarget) this._envRenderTarget.dispose();
    this.renderer.dispose();
  }
}
