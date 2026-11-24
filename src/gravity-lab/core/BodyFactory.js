import * as THREE from "three";
import { BODY_PALETTES, CONFIG } from "../config.js";

/**
 * Builds the paired visual + physical representation of an experiment body.
 * Geometry is owned per body (it can be disposed safely); materials are shared
 * per material profile so the GPU state stays small.
 */
export class BodyFactory {
  constructor(Ammo, scene, physics) {
    this.Ammo = Ammo;
    this.scene = scene;
    this.physics = physics;
    this.nextId = 1;
    this.materials = new Map();
    this.edgeMaterials = new Map();
    this.accentMaterial = new THREE.MeshBasicMaterial({
      color: 0x9bf3ff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    for (const palette of BODY_PALETTES) {
      this.materials.set(
        palette.id,
        new THREE.MeshStandardMaterial({
          color: palette.color,
          emissive: palette.emissive,
          emissiveIntensity: palette.emissiveIntensity,
          metalness: palette.metalness,
          roughness: palette.roughness,
          envMapIntensity: 1.15,
        })
      );
      this.edgeMaterials.set(
        palette.id,
        new THREE.LineBasicMaterial({
          color: palette.edge,
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        })
      );
    }
  }

  create(type, { position, quaternion = new THREE.Quaternion() }) {
    const id = this.nextId++;
    const palette = BODY_PALETTES[Math.floor(Math.random() * BODY_PALETTES.length)];
    const material = this.materials.get(palette.id);

    let geometry;
    let shape;
    let mass;
    let friction;
    let restitution;
    let radius;
    let ccdRadius;

    if (type === "sphere") {
      radius = 0.42 + Math.random() * 0.3;
      geometry = new THREE.SphereGeometry(radius, 32, 24);
      shape = this.physics.createSphereShape(radius);
      mass = 1.2 + radius * 4.2 + Math.random() * 0.8;
      friction = 0.38;
      restitution = 0.58 + Math.random() * 0.12;
      ccdRadius = radius;
    } else if (type === "cube") {
      const halfX = 0.42 + Math.random() * 0.24;
      const halfY = 0.42 + Math.random() * 0.24;
      const halfZ = 0.42 + Math.random() * 0.24;
      geometry = new THREE.BoxGeometry(halfX * 2, halfY * 2, halfZ * 2);
      shape = this.physics.createBoxShape(halfX, halfY, halfZ);
      radius = Math.max(halfX, halfY, halfZ);
      mass = 2.6 + radius * 5.2 + Math.random() * 0.9;
      friction = 0.72;
      restitution = 0.16 + Math.random() * 0.1;
      ccdRadius = radius;
    } else {
      radius = 0.38 + Math.random() * 0.18;
      const height = 0.92 + Math.random() * 0.56;
      geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
      shape = this.physics.createCylinderShape(radius, height);
      mass = 1.9 + radius * 4.6 + height * 0.9 + Math.random() * 0.6;
      friction = 0.54;
      restitution = 0.3 + Math.random() * 0.12;
      ccdRadius = Math.max(radius, height * 0.5);
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.quaternion.copy(quaternion);
    mesh.scale.setScalar(0.001);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `body-${id}`;

    const extras = [];
    if (type === "cube") {
      const edgesGeometry = new THREE.EdgesGeometry(geometry, 20);
      const edges = new THREE.LineSegments(
        edgesGeometry,
        this.edgeMaterials.get(palette.id)
      );
      mesh.add(edges);
      extras.push(edgesGeometry);
    } else {
      const ringGeometry = new THREE.TorusGeometry(radius * 1.015, 0.012, 5, 48);
      const ring = new THREE.Mesh(ringGeometry, this.accentMaterial);
      ring.rotation.x = Math.PI / 2;
      mesh.add(ring);
      extras.push(ringGeometry);
    }

    const record = this.physics.createBody({
      shape,
      mass,
      position,
      quaternion: {
        x: quaternion.x,
        y: quaternion.y,
        z: quaternion.z,
        w: quaternion.w,
      },
      friction,
      restitution,
      userIndex: id,
      ccdRadius,
    });

    const labBody = {
      id,
      type,
      palette,
      mass,
      radius,
      mesh,
      record,
      extras,
      geometry,
    };

    mesh.userData.labBody = labBody;
    this.scene.add(mesh);
    return labBody;
  }

  disposeBody(labBody) {
    this.scene.remove(labBody.mesh);
    labBody.geometry.dispose();
    for (const extra of labBody.extras) extra.dispose();
    this.physics.removeBody(labBody.record);
  }

  dispose() {
    this.accentMaterial.dispose();
    for (const material of this.materials.values()) material.dispose();
    for (const material of this.edgeMaterials.values()) material.dispose();
  }
}
