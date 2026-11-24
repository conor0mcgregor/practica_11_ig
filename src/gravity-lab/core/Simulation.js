import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import { CONFIG, TYPE_LABELS } from "../config.js";
import { createRingTexture } from "../utils/textures.js";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * The experiment conductor:
 *  - owns the list of dynamic bodies,
 *  - advances Ammo with a fixed timestep accumulator,
 *  - keeps rendering transforms in sync with the physics transforms,
 *  - implements spawning, reset, impulses and radial explosions,
 *  - exposes live telemetry taken from the real simulation.
 */
export class Simulation {
  constructor({ scene, physics, bodyFactory, effects, labScene }) {
    this.scene = scene;
    this.physics = physics;
    this.bodyFactory = bodyFactory;
    this.effects = effects;
    this.labScene = labScene;

    this.bodies = [];
    this.selected = null;
    this.paused = false;
    this.gravity = -CONFIG.physics.gravity;
    this.explosionStrength = CONFIG.physics.explosionDefault;
    this.accumulator = 0;
    this.elapsed = 0;
    this.fpsSmooth = 60;
    this._spawnCounter = 0;
    this._resetInProgress = false;
    this._disposed = false;

    this._tempPosition = new THREE.Vector3();
    this._tempQuaternion = new THREE.Quaternion();

    this._stats = {
      bodyCount: 0,
      activeCount: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      collisionTotal: 0,
      gravity: this.gravity,
      paused: this.paused,
      fps: 60,
      selected: null,
    };
    this._statsTimer = 0;

    this._initSelectionMarker();
  }

  _initSelectionMarker() {
    this._selectionTexture = createRingTexture();
    this._selectionMaterial = new THREE.SpriteMaterial({
      map: this._selectionTexture,
      color: 0x8df4ff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.selectionMarker = new THREE.Sprite(this._selectionMaterial);
    this.selectionMarker.visible = false;
    this.selectionMarker.renderOrder = 20;
    this.scene.add(this.selectionMarker);
  }

  start() {
    this._seedInitial();
  }

  _seedInitial() {
    if (this._disposed) return;
    const types = ["sphere", "cube", "cylinder"];
    for (let i = 0; i < CONFIG.physics.initialBodies; i++) {
      const angle = i * GOLDEN_ANGLE + 0.4;
      const radius = 1.2 + (i % 4) * 0.72;
      const position = new THREE.Vector3(
        Math.cos(angle) * radius,
        CONFIG.spawn.minY + (i % 3) * 0.95 + Math.random() * 0.4,
        Math.sin(angle) * radius
      );
      this._createBody(types[i % types.length], position, {
        delay: 320 + i * 95,
      });
    }
    this._refreshStats();
  }

  _createBody(type, position, { delay = 0 } = {}) {
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        (Math.random() - 0.5) * 0.5,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.5
      )
    );

    const body = this.bodyFactory.create(type, { position, quaternion });
    this.bodies.push(body);

    body.mesh.scale.setScalar(0.001);
    new TWEEN.Tween(body.mesh.scale)
      .to({ x: 1, y: 1, z: 1 }, 620)
      .delay(delay)
      .easing(TWEEN.Easing.Back.Out)
      .start();

    return body;
  }

  addBody(type) {
    if (this._disposed || this._resetInProgress) return null;

    if (this.bodies.length >= CONFIG.physics.maxBodies) {
      const oldest = this.bodies[0];
      this._retireBody(oldest);
    }

    this._spawnCounter += 1;
    const angle = this._spawnCounter * GOLDEN_ANGLE;
    const radius = 0.25 + (this._spawnCounter % 3) * 0.55;
    const position = new THREE.Vector3(
      Math.cos(angle) * radius,
      CONFIG.spawn.minY + (this._spawnCounter % 4) * 0.75 + Math.random() * 0.5,
      Math.sin(angle) * radius
    );

    const body = this._createBody(type, position, { delay: 0 });
    this.labScene.openHatchForDeploy();
    return body;
  }

  _retireBody(body) {
    const index = this.bodies.indexOf(body);
    if (index === -1) return;
    this.bodies.splice(index, 1);
    if (this.selected === body) this.clearSelection();

    const state = { scale: body.mesh.scale.x || 1 };
    new TWEEN.Tween(state)
      .to({ scale: 0.001 }, 200)
      .easing(TWEEN.Easing.Cubic.In)
      .onUpdate(() => {
        body.mesh.scale.setScalar(state.scale);
      })
      .onComplete(() => {
        this.bodyFactory.disposeBody(body);
      })
      .start();
  }

  setGravity(signedGravity) {
    this.gravity = signedGravity;
    this.physics.setGravityMagnitude(signedGravity);
    this._refreshStats();
  }

  setPaused(paused) {
    this.paused = paused;
    this.accumulator = 0;
    this._refreshStats();
  }

  togglePause() {
    this.setPaused(!this.paused);
    return this.paused;
  }

  selectByMesh(mesh) {
    const body = mesh ? mesh.userData.labBody : null;
    this.selected = body && this.bodies.includes(body) ? body : null;
    if (this.selected) {
      this.selectionMarker.visible = true;
      this.selectionMarker.position.copy(this.selected.mesh.position);
    } else {
      this.selectionMarker.visible = false;
    }
    this._refreshStats();
  }

  clearSelection() {
    this.selected = null;
    this.selectionMarker.visible = false;
    this._refreshStats();
  }

  getSelectableMeshes() {
    return this.bodies.map((body) => body.mesh);
  }

  applyImpulseToSelected() {
    if (!this.selected) return false;
    const body = this.selected;
    const direction = new THREE.Vector3()
      .subVectors(body.mesh.position, new THREE.Vector3(0, 1.2, 0));
    if (direction.lengthSq() < 0.001) direction.set(0.7, 1, 0.5);
    direction.y = Math.abs(direction.y) + 1.8;
    direction.normalize();

    const impulse = direction.multiplyScalar(
      body.mass * CONFIG.physics.impulseStrength
    );
    impulse.x += (Math.random() - 0.5) * body.mass * 2;
    impulse.z += (Math.random() - 0.5) * body.mass * 2;
    impulse.y += body.mass * 3;

    this.physics.applyImpulse(body.record.body, impulse);
    this.physics.applyTorqueImpulse(body.record.body, {
      x: (Math.random() - 0.5) * body.mass * 2.5,
      y: (Math.random() - 0.5) * body.mass * 2.5,
      z: (Math.random() - 0.5) * body.mass * 2.5,
    });
    this.effects.impulsePulse(body.mesh.position);
    return true;
  }

  explode() {
    const strength = this.explosionStrength;
    const center = this.selected
      ? this.selected.mesh.position.clone()
      : new THREE.Vector3(0, 0.9, 0);

    this.effects.burst(center, strength);
    this.labScene.pulseEmitter(1.7);

    let affected = 0;
    for (const body of this.bodies) {
      const offset = new THREE.Vector3().subVectors(body.mesh.position, center);
      const distance = offset.length();
      const falloff = THREE.MathUtils.clamp(
        1 - distance / CONFIG.physics.explosionRadius,
        0,
        1
      );
      if (falloff <= 0.02) continue;

      offset.y += 0.75;
      if (offset.lengthSq() < 0.0001) offset.set(0, 1, 0);
      offset.normalize();

      const magnitude =
        strength * (0.3 + falloff) * (0.75 + Math.random() * 0.5);
      this.physics.applyImpulse(body.record.body, {
        x: offset.x * magnitude,
        y: offset.y * magnitude,
        z: offset.z * magnitude,
      });

      const torque = magnitude * 0.16;
      this.physics.applyTorqueImpulse(body.record.body, {
        x: (Math.random() - 0.5) * torque,
        y: (Math.random() - 0.5) * torque,
        z: (Math.random() - 0.5) * torque,
      });
      affected++;
    }
    return affected;
  }

  update(delta) {
    const dt = Math.min(Math.max(delta, 0), 0.1);
    this.elapsed += dt;
    const instantFps = 1 / Math.max(dt, 0.0001);
    this.fpsSmooth += (instantFps - this.fpsSmooth) * 0.08;

    if (!this.paused && !this._resetInProgress) {
      this.accumulator += dt;
      let steps = 0;
      const fixed = CONFIG.physics.fixedTimeStep;
      while (this.accumulator >= fixed && steps < CONFIG.physics.maxSubSteps) {
        this.physics.step(fixed);
        this.accumulator -= fixed;
        steps += 1;
      }
      if (steps === CONFIG.physics.maxSubSteps) this.accumulator = 0;
    }

    for (const body of this.bodies) {
      if (this.physics.syncTransform(
        body.record,
        this._tempPosition,
        this._tempQuaternion
      )) {
        body.mesh.position.copy(this._tempPosition);
        body.mesh.quaternion.copy(this._tempQuaternion);
      }
    }

    if (this.selected && this.bodies.includes(this.selected)) {
      this.selectionMarker.visible = true;
      this.selectionMarker.position.copy(this.selected.mesh.position);
      const pulse = 1 + Math.sin(this.elapsed * 4.2) * 0.06;
      const size = this.selected.radius * 3.1 * pulse;
      this.selectionMarker.scale.set(size, size, 1);
      this._selectionMaterial.opacity =
        0.72 + Math.sin(this.elapsed * 4.2) * 0.18;
    } else {
      this.selectionMarker.visible = false;
    }

    this._statsTimer += dt;
    if (this._statsTimer >= 0.12) {
      this._statsTimer = 0;
      this._refreshStats();
    }
  }

  _refreshStats() {
    let speedSum = 0;
    let maxSpeed = 0;
    let activeCount = 0;
    for (const body of this.bodies) {
      const speed = this.physics.getSpeed(body.record.body);
      speedSum += speed;
      if (speed > maxSpeed) maxSpeed = speed;
      if (body.record.body.isActive()) activeCount += 1;
    }

    const bodyCount = this.bodies.length;
    this._stats = {
      bodyCount,
      activeCount,
      avgSpeed: bodyCount > 0 ? speedSum / bodyCount : 0,
      maxSpeed,
      collisionTotal: this.physics.collisionTotal,
      gravity: this.gravity,
      paused: this.paused,
      fps: Math.round(this.fpsSmooth),
      selected:
        this.selected && this.bodies.includes(this.selected)
          ? {
              id: this.selected.id,
              type: this.selected.type,
              typeLabel: TYPE_LABELS[this.selected.type],
              mass: this.selected.mass,
              speed: this.physics.getSpeed(this.selected.record.body),
              palette: this.selected.palette.name,
            }
          : null,
    };
  }

  getStats() {
    return this._stats;
  }

  reset({ full = false } = {}) {
    if (this._resetInProgress || this._disposed) return;
    this._resetInProgress = true;
    this.clearSelection();
    this.effects.resetPulse();

    if (full) {
      this.gravity = -CONFIG.physics.gravity;
      this.physics.setGravityMagnitude(this.gravity);
      this.paused = false;
    }

    const retiring = [...this.bodies];
    this.bodies = [];
    this._refreshStats();

    const state = { scale: 1 };
    new TWEEN.Tween(state)
      .to({ scale: 0.001 }, 260)
      .easing(TWEEN.Easing.Cubic.In)
      .onUpdate(() => {
        for (const body of retiring) {
          body.mesh.scale.setScalar(state.scale);
        }
      })
      .onComplete(() => {
        for (const body of retiring) {
          this.bodyFactory.disposeBody(body);
        }
        this.physics.resetCollisionCount();
        this.accumulator = 0;
        this._resetInProgress = false;
        if (!this._disposed) this._seedInitial();
      })
      .start();
  }

  dispose() {
    this._disposed = true;
    for (const body of this.bodies) {
      this.bodyFactory.disposeBody(body);
    }
    this.bodies = [];
    this.scene.remove(this.selectionMarker);
    this._selectionMaterial.dispose();
    this._selectionTexture.dispose();
  }
}
