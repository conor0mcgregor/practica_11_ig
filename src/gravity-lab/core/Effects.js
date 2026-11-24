import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import { createRadialGlowTexture, createSparkTexture } from "../utils/textures.js";

/**
 * Purely visual reactions to physical events. Nothing here drives a dynamic
 * body: Ammo.js owns those transforms. Tween.js animates shockwaves, SPARKS,
 * light flashes and screen flashes.
 */
export class Effects {
  constructor({ scene, flashElement }) {
    this.scene = scene;
    this.flashElement = flashElement;
    this._tweens = [];
    this._sparkTween = null;

    this.shockwaveMaterial = new THREE.MeshBasicMaterial({
      color: 0x5fe9ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    const ringGeometry = new THREE.RingGeometry(0.9, 1, 96);
    this.shockwave = new THREE.Mesh(ringGeometry, this.shockwaveMaterial);
    this.shockwave.rotation.x = -Math.PI / 2;
    this.shockwave.visible = false;
    this.scene.add(this.shockwave);

    this.bubbleMaterial = new THREE.MeshBasicMaterial({
      color: 0x4dc7ff,
      wireframe: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const bubbleGeometry = new THREE.SphereGeometry(1, 18, 12);
    this.bubble = new THREE.Mesh(bubbleGeometry, this.bubbleMaterial);
    this.bubble.visible = false;
    this.scene.add(this.bubble);

    this.glowTexture = createRadialGlowTexture();
    this.flashMaterial = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xa8f4ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.flashSprite = new THREE.Sprite(this.flashMaterial);
    this.flashSprite.visible = false;
    this.scene.add(this.flashSprite);

    this.light = new THREE.PointLight(0x67e6ff, 0, 30, 2);
    this.scene.add(this.light);

    const sparkCount = 46;
    this.sparkCount = sparkCount;
    this.sparkPositions = new Float32Array(sparkCount * 3);
    this.sparkDirections = [];
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.sparkPositions, 3)
    );
    this.sparkGeometry = sparkGeometry;
    const sparkTexture = createSparkTexture();
    this.sparkMaterial = new THREE.PointsMaterial({
      map: sparkTexture,
      color: 0xbdf7ff,
      size: 0.19,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    });
    this.sparks = new THREE.Points(sparkGeometry, this.sparkMaterial);
    this.sparks.frustumCulled = false;
    this.scene.add(this.sparks);

    this._ringGeometry = ringGeometry;
    this._bubbleGeometry = bubbleGeometry;
    this._sparkGeometry = sparkGeometry;
    this._sparkTexture = sparkTexture;
  }

  _track(tween) {
    this._tweens.push(tween);
    return tween;
  }

  _screenFlash(opacity, duration = 520) {
    if (!this.flashElement) return;
    const state = { opacity };
    this.flashElement.style.opacity = String(opacity);
    const tween = new TWEEN.Tween(state)
      .to({ opacity: 0 }, duration)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onUpdate(() => {
        this.flashElement.style.opacity = String(state.opacity);
      })
      .start();
    this._track(tween);
  }

  burst(position, strength) {
    const intensity = THREE.MathUtils.clamp(strength / 28, 0.35, 2.2);
    const centerX = position.x;
    const centerY = Math.max(position.y, 0.35);
    const centerZ = position.z;

    // Expanding floor shockwave.
    this.shockwave.visible = true;
    this.shockwave.position.set(centerX, 0.09, centerZ);
    this.shockwave.scale.setScalar(0.4);
    this.shockwaveMaterial.opacity = 0.9;
    const wave = { progress: 0 };
    this._track(
      new TWEEN.Tween(wave)
        .to({ progress: 1 }, 820)
        .easing(TWEEN.Easing.Cubic.Out)
        .onUpdate(() => {
          const scale = 0.4 + wave.progress * (8.5 * intensity + 3);
          this.shockwave.scale.setScalar(scale);
          this.shockwaveMaterial.opacity = 0.9 * Math.pow(1 - wave.progress, 1.6);
        })
        .onComplete(() => {
          this.shockwave.visible = false;
        })
        .start()
    );

    // Radial containment bubble.
    this.bubble.visible = true;
    this.bubble.position.set(centerX, centerY, centerZ);
    this.bubbleMaterial.opacity = 0.32;
    const bubble = { progress: 0 };
    this._track(
      new TWEEN.Tween(bubble)
        .to({ progress: 1 }, 560)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => {
          this.bubble.scale.setScalar(0.3 + bubble.progress * (5.5 * intensity));
          this.bubbleMaterial.opacity = 0.32 * (1 - bubble.progress);
        })
        .onComplete(() => {
          this.bubble.visible = false;
        })
        .start()
    );

    // Core flash.
    this.flashSprite.visible = true;
    this.flashSprite.position.set(centerX, centerY, centerZ);
    this.flashMaterial.opacity = 0.95;
    this.flashSprite.scale.setScalar(1.5);
    const flash = { progress: 0 };
    this._track(
      new TWEEN.Tween(flash)
        .to({ progress: 1 }, 620)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => {
          this.flashSprite.scale.setScalar(1.5 + flash.progress * 9 * intensity);
          this.flashMaterial.opacity = 0.95 * (1 - flash.progress);
        })
        .onComplete(() => {
          this.flashSprite.visible = false;
        })
        .start()
    );

    // Physical light flash.
    this.light.position.set(centerX, centerY + 1.2, centerZ);
    this.light.intensity = 9 * intensity;
    const light = { intensity: this.light.intensity };
    this._track(
      new TWEEN.Tween(light)
        .to({ intensity: 0 }, 700)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => {
          this.light.intensity = light.intensity;
        })
        .start()
    );

    // Spark burst driven by a single tween over a pooled points cloud.
    if (this._sparkTween) this._sparkTween.stop();
    for (let i = 0; i < this.sparkCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 3.5 + Math.random() * 7.5;
      this.sparkDirections[i] = {
        x: Math.sin(phi) * Math.cos(theta) * speed,
        y: Math.abs(Math.cos(phi)) * speed * 0.9 + 1.5,
        z: Math.sin(phi) * Math.sin(theta) * speed,
      };
    }

    const sparkState = { progress: 0 };
    this.sparkMaterial.opacity = 0.9;
    this.sparks.position.set(centerX, centerY, centerZ);
    this._sparkTween = new TWEEN.Tween(sparkState)
      .to({ progress: 1 }, 950)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onUpdate(() => {
        const p = sparkState.progress;
        for (let i = 0; i < this.sparkCount; i++) {
          const direction = this.sparkDirections[i];
          this.sparkPositions[i * 3] = direction.x * p * intensity;
          this.sparkPositions[i * 3 + 1] =
            direction.y * p * intensity - p * p * 3.4;
          this.sparkPositions[i * 3 + 2] = direction.z * p * intensity;
        }
        this.sparkGeometry.attributes.position.needsUpdate = true;
        this.sparkMaterial.opacity =
          0.9 * (1 - p) * (1 - p) + 0.05 * (1 - p);
        this.sparkMaterial.size = 0.19 * (1 - p * 0.55);
      })
      .onComplete(() => {
        this.sparkMaterial.opacity = 0;
      })
      .start();

    this._screenFlash(0.26 + Math.min(intensity, 2) * 0.1, 560);
    this._track(this._sparkTween);
  }

  impulsePulse(position) {
    this.shockwave.visible = true;
    this.shockwave.position.set(position.x, 0.09, position.z);
    this.shockwave.scale.setScalar(0.2);
    this.shockwaveMaterial.opacity = 0.6;
    const state = { progress: 0 };
    const tween = new TWEEN.Tween(state)
      .to({ progress: 1 }, 420)
      .easing(TWEEN.Easing.Cubic.Out)
      .onUpdate(() => {
        this.shockwave.scale.setScalar(0.2 + state.progress * 2.7);
        this.shockwaveMaterial.opacity = 0.6 * (1 - state.progress);
      })
      .onComplete(() => {
        this.shockwave.visible = false;
      })
      .start();
    this._track(tween);

    this.light.position.set(position.x, position.y, position.z);
    this.light.intensity = 2.2;
    const light = { intensity: 2.2 };
    const lightTween = new TWEEN.Tween(light)
      .to({ intensity: 0 }, 340)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onUpdate(() => {
        this.light.intensity = light.intensity;
      })
      .start();
    this._track(lightTween);
  }

  resetPulse() {
    this._screenFlash(0.18, 420);
  }

  dispose() {
    this.scene.remove(this.shockwave);
    this.scene.remove(this.bubble);
    this.scene.remove(this.flashSprite);
    this.scene.remove(this.sparks);
    this.scene.remove(this.light);
    this._ringGeometry.dispose();
    this._bubbleGeometry.dispose();
    this._sparkGeometry.dispose();
    this._sparkTexture.dispose();
    this.glowTexture.dispose();
    this.shockwaveMaterial.dispose();
    this.bubbleMaterial.dispose();
    this.flashMaterial.dispose();
    this.sparkMaterial.dispose();
  }
}
