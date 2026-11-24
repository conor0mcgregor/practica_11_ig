/**
 * GRAVITY LAB — central configuration.
 * Every tunable value used by the simulation lives here so the laboratory
 * can be balanced without touching the systems that consume it.
 */

export const CONFIG = {
  physics: {
    gravity: 9.81,
    maxGravity: 26,
    fixedTimeStep: 1 / 60,
    maxSubSteps: 5,
    margin: 0.04,
    maxBodies: 32,
    initialBodies: 11,
    explosionRadius: 10,
    explosionDefault: 28,
    impulseStrength: 7.5,
  },

  world: {
    platformRadius: 6.35,
    platformHeight: 0.8,
    platformTop: 0,
    floorY: -2.8,
    ceilingY: 22,
    hiddenCeiling: true,
  },

  camera: {
    fov: 40,
    near: 0.1,
    far: 220,
    target: { x: 0, y: 1.35, z: 0 },
    desktop: { x: 12.5, y: 9.4, z: 17.2 },
    narrow: { x: 14.5, y: 12.6, z: 23.5 },
    minDistance: 7,
    maxDistance: 38,
    maxPolarAngle: 1.48,
    damping: 0.065,
  },

  spawn: {
    minY: 6.4,
    maxY: 9.2,
    radius: 2.6,
  },

  ui: {
    statsInterval: 120, // ms
    speedHistoryLength: 56,
  },
};

export const BODY_TYPES = ["sphere", "cube", "cylinder"];

export const TYPE_LABELS = {
  sphere: "SPHERE",
  cube: "CUBE",
  cylinder: "CYLINDER",
};

/**
 * Body palettes. Materials are shared between bodies of the same palette so
 * adding/removing objects does not create per-object material state.
 */
export const BODY_PALETTES = [
  {
    id: "ion",
    name: "ION-X",
    color: 0x0f6f88,
    emissive: 0x0bb7e0,
    emissiveIntensity: 0.34,
    edge: 0x8cf5ff,
    metalness: 0.62,
    roughness: 0.2,
  },
  {
    id: "cobalt",
    name: "COBALT",
    color: 0x17357a,
    emissive: 0x2b63ff,
    emissiveIntensity: 0.32,
    edge: 0x8fb8ff,
    metalness: 0.7,
    roughness: 0.24,
  },
  {
    id: "alloy",
    name: "ALLOY-9",
    color: 0x9aa7b6,
    emissive: 0x123642,
    emissiveIntensity: 0.14,
    edge: 0xd9fbff,
    metalness: 1.0,
    roughness: 0.18,
  },
  {
    id: "obsidian",
    name: "OBSIDIAN",
    color: 0x0c1218,
    emissive: 0x0d5968,
    emissiveIntensity: 0.22,
    edge: 0x62d9ee,
    metalness: 0.88,
    roughness: 0.3,
  },
];

export const COLORS = {
  background: 0x04070c,
  fog: 0x04070c,
  cyan: 0x47e8ff,
  blue: 0x2f79ff,
  ice: 0xc8f4ff,
  steel: 0x10161d,
};

export const MAX_BODY_MASS_FOR_DISPLAY = 12;
