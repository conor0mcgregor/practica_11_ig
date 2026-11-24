// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"WEZx":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TYPE_LABELS = exports.MAX_BODY_MASS_FOR_DISPLAY = exports.CONFIG = exports.COLORS = exports.BODY_TYPES = exports.BODY_PALETTES = void 0;
/**
 * GRAVITY LAB — central configuration.
 * Every tunable value used by the simulation lives here so the laboratory
 * can be balanced without touching the systems that consume it.
 */

const CONFIG = exports.CONFIG = {
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
    impulseStrength: 7.5
  },
  world: {
    platformRadius: 6.35,
    platformHeight: 0.8,
    platformTop: 0,
    floorY: -2.8,
    ceilingY: 22,
    hiddenCeiling: true
  },
  camera: {
    fov: 40,
    near: 0.1,
    far: 220,
    target: {
      x: 0,
      y: 1.35,
      z: 0
    },
    desktop: {
      x: 12.5,
      y: 9.4,
      z: 17.2
    },
    narrow: {
      x: 14.5,
      y: 12.6,
      z: 23.5
    },
    minDistance: 7,
    maxDistance: 38,
    maxPolarAngle: 1.48,
    damping: 0.065
  },
  spawn: {
    minY: 6.4,
    maxY: 9.2,
    radius: 2.6
  },
  ui: {
    statsInterval: 120,
    // ms
    speedHistoryLength: 56
  }
};
const BODY_TYPES = exports.BODY_TYPES = ["sphere", "cube", "cylinder"];
const TYPE_LABELS = exports.TYPE_LABELS = {
  sphere: "SPHERE",
  cube: "CUBE",
  cylinder: "CYLINDER"
};

/**
 * Body palettes. Materials are shared between bodies of the same palette so
 * adding/removing objects does not create per-object material state.
 */
const BODY_PALETTES = exports.BODY_PALETTES = [{
  id: "ion",
  name: "ION-X",
  color: 0x0f6f88,
  emissive: 0x0bb7e0,
  emissiveIntensity: 0.34,
  edge: 0x8cf5ff,
  metalness: 0.62,
  roughness: 0.2
}, {
  id: "cobalt",
  name: "COBALT",
  color: 0x17357a,
  emissive: 0x2b63ff,
  emissiveIntensity: 0.32,
  edge: 0x8fb8ff,
  metalness: 0.7,
  roughness: 0.24
}, {
  id: "alloy",
  name: "ALLOY-9",
  color: 0x9aa7b6,
  emissive: 0x123642,
  emissiveIntensity: 0.14,
  edge: 0xd9fbff,
  metalness: 1.0,
  roughness: 0.18
}, {
  id: "obsidian",
  name: "OBSIDIAN",
  color: 0x0c1218,
  emissive: 0x0d5968,
  emissiveIntensity: 0.22,
  edge: 0x62d9ee,
  metalness: 0.88,
  roughness: 0.3
}];
const COLORS = exports.COLORS = {
  background: 0x04070c,
  fog: 0x04070c,
  cyan: 0x47e8ff,
  blue: 0x2f79ff,
  ice: 0xc8f4ff,
  steel: 0x10161d
};
const MAX_BODY_MASS_FOR_DISPLAY = exports.MAX_BODY_MASS_FOR_DISPLAY = 12;
},{}],"cHvq":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PhysicsEngine = void 0;
var _config = require("../config.js");
/**
 * Thin, explicit wrapper around Ammo.js.
 *
 * Responsibilities:
 *  - Own the btDiscreteDynamicsWorld and its helper objects.
 *  - Create / destroy rigid bodies and collision shapes.
 *  - Count real contact-begin events through the dispatcher manifolds.
 *  - Expose convenient force helpers.
 *
 * No Three.js object is referenced here: the physics world is completely
 * independent from the render world.
 */
class PhysicsEngine {
  constructor(Ammo) {
    this.Ammo = Ammo;
    this.world = null;
    this.dispatcher = null;
    this.dynamicBodies = [];
    this.gravity = -_config.CONFIG.physics.gravity;
    this.collisionTotal = 0;
    this._prevPairs = new Set();
    this._currPairs = new Set();
    this._transformAux = null;
    this._gravityVector = null;
    this._ready = false;
  }
  init() {
    const A = this.Ammo;
    this.collisionConfiguration = new A.btDefaultCollisionConfiguration();
    this.dispatcher = new A.btCollisionDispatcher(this.collisionConfiguration);
    this.broadphase = new A.btDbvtBroadphase();
    this.solver = new A.btSequentialImpulseConstraintSolver();
    this.world = new A.btDiscreteDynamicsWorld(this.dispatcher, this.broadphase, this.solver, this.collisionConfiguration);
    this._gravityVector = new A.btVector3(0, this.gravity, 0);
    this.world.setGravity(this._gravityVector);
    this._transformAux = new A.btTransform();
    this._ready = true;
  }
  get isReady() {
    return this._ready;
  }
  createBoxShape(halfX, halfY, halfZ) {
    const A = this.Ammo;
    const halfExtents = new A.btVector3(halfX, halfY, halfZ);
    const shape = new A.btBoxShape(halfExtents);
    shape.setMargin(_config.CONFIG.physics.margin);
    A.destroy(halfExtents);
    return shape;
  }
  createSphereShape(radius) {
    const shape = new this.Ammo.btSphereShape(radius);
    shape.setMargin(_config.CONFIG.physics.margin);
    return shape;
  }
  createCylinderShape(radius, height) {
    const A = this.Ammo;
    const halfExtents = new A.btVector3(radius, height * 0.5, radius);
    const shape = new A.btCylinderShape(halfExtents);
    shape.setMargin(_config.CONFIG.physics.margin);
    A.destroy(halfExtents);
    return shape;
  }

  /**
   * Creates a rigid body. mass === 0 produces a static body.
   * Returns a record holding every Ammo allocation that must be released.
   */
  createBody({
    shape,
    mass = 0,
    position,
    quaternion = {
      x: 0,
      y: 0,
      z: 0,
      w: 1
    },
    friction = 0.5,
    restitution = 0.3,
    userIndex = -1,
    linearDamping = 0.04,
    angularDamping = 0.08,
    ccdRadius = 0
  }) {
    if (!this._ready) {
      throw new Error("PhysicsEngine.createBody() called before init().");
    }
    const A = this.Ammo;
    const origin = new A.btVector3(position.x, position.y, position.z);
    const rotation = new A.btQuaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    const transform = new A.btTransform();
    transform.setIdentity();
    transform.setOrigin(origin);
    transform.setRotation(rotation);
    const motionState = new A.btDefaultMotionState(transform);
    const localInertia = new A.btVector3(0, 0, 0);
    if (mass > 0) {
      shape.calculateLocalInertia(mass, localInertia);
    }
    const constructionInfo = new A.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
    const body = new A.btRigidBody(constructionInfo);
    body.setFriction(friction);
    body.setRestitution(restitution);
    body.setRollingFriction(0.04);
    body.setUserIndex(userIndex);
    if (mass > 0) {
      body.setDamping(linearDamping, angularDamping);
      // Keep dynamic objects active: experiments with zero / inverted gravity
      // must never leave bodies permanently asleep.
      body.setActivationState(4);
      if (ccdRadius > 0) {
        body.setCcdMotionThreshold(ccdRadius * 0.5);
        body.setCcdSweptSphereRadius(ccdRadius * 0.35);
      }
      this.dynamicBodies.push(body);
    }
    this.world.addRigidBody(body);
    A.destroy(constructionInfo);
    A.destroy(localInertia);
    A.destroy(transform);
    A.destroy(origin);
    A.destroy(rotation);
    return {
      body,
      motionState,
      shape
    };
  }
  removeBody(record) {
    if (!record || !this.world) return;
    const body = record.body;
    const index = this.dynamicBodies.indexOf(body);
    if (index !== -1) this.dynamicBodies.splice(index, 1);
    this.world.removeRigidBody(body);
    this.Ammo.destroy(body);
    this.Ammo.destroy(record.motionState);
    this.Ammo.destroy(record.shape);
  }

  /**
   * Advances the world exactly one fixed tick. Bullet is always fed the same
   * dt; the accumulator that calls this method lives in Simulation.
   */
  step(fixedDelta) {
    if (!this._ready) return 0;
    this.world.stepSimulation(fixedDelta, 2, fixedDelta);
    return this._collectNewContacts();
  }

  /**
   * Real collision counting: every persistent manifold generated by the
   * dispatcher is inspected. A collision is reported only when a contacting
   * pair appears that was not in contact during the previous tick.
   */
  _collectNewContacts() {
    this._currPairs.clear();
    let newCollisions = 0;
    const manifoldCount = this.dispatcher.getNumManifolds();
    for (let i = 0; i < manifoldCount; i++) {
      const manifold = this.dispatcher.getManifoldByIndexInternal(i);
      const bodyA = manifold.getBody0();
      const bodyB = manifold.getBody1();
      const indexA = bodyA.getUserIndex();
      const indexB = bodyB.getUserIndex();

      // Ignore static-static pairs (decorative colliders touching each other).
      if (indexA < 0 && indexB < 0) continue;
      let touching = false;
      const contactCount = manifold.getNumContacts();
      for (let j = 0; j < contactCount; j++) {
        const point = manifold.getContactPoint(j);
        if (point.getDistance() <= 0.03 && point.getAppliedImpulse() >= 0.04) {
          touching = true;
          break;
        }
      }
      if (!touching) continue;
      const key = indexA < indexB ? `${indexA}:${indexB}` : `${indexB}:${indexA}`;
      this._currPairs.add(key);
      if (!this._prevPairs.has(key)) newCollisions++;
    }
    this.collisionTotal += newCollisions;

    // Swap the two sets instead of allocating a new one each tick.
    const previous = this._prevPairs;
    this._prevPairs = this._currPairs;
    this._currPairs = previous;
    return newCollisions;
  }
  syncTransform(record, targetPosition, targetQuaternion) {
    const motionState = record.motionState;
    if (!motionState) return false;
    motionState.getWorldTransform(this._transformAux);
    const origin = this._transformAux.getOrigin();
    const rotation = this._transformAux.getRotation();
    targetPosition.set(origin.x(), origin.y(), origin.z());
    targetQuaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w());
    return true;
  }
  setGravityMagnitude(signedGravity) {
    this.gravity = signedGravity;
    this._gravityVector.setValue(0, signedGravity, 0);
    this.world.setGravity(this._gravityVector);
    this.wakeAll();
  }
  wakeAll() {
    for (const body of this.dynamicBodies) {
      body.activate(true);
    }
  }
  applyImpulse(body, impulse) {
    const A = this.Ammo;
    const vector = new A.btVector3(impulse.x, impulse.y, impulse.z);
    body.activate(true);
    body.applyCentralImpulse(vector);
    A.destroy(vector);
  }
  applyTorqueImpulse(body, impulse) {
    const A = this.Ammo;
    const vector = new A.btVector3(impulse.x, impulse.y, impulse.z);
    body.applyTorqueImpulse(vector);
    A.destroy(vector);
  }
  getSpeed(body) {
    // The returned btVector3 is a view, not an owned allocation: do not
    // destroy it, only read its magnitude.
    return body.getLinearVelocity().length();
  }
  resetCollisionCount() {
    this.collisionTotal = 0;
    this._prevPairs.clear();
    this._currPairs.clear();
  }
  dispose() {
    if (!this._ready) return;
    this._ready = false;
    if (this.world) {
      for (const body of [...this.dynamicBodies]) {
        this.world.removeRigidBody(body);
        this.Ammo.destroy(body);
      }
      this.dynamicBodies = [];
    }
    const A = this.Ammo;
    if (this._transformAux) A.destroy(this._transformAux);
    if (this._gravityVector) A.destroy(this._gravityVector);
    if (this.world) A.destroy(this.world);
    if (this.solver) A.destroy(this.solver);
    if (this.broadphase) A.destroy(this.broadphase);
    if (this.dispatcher) A.destroy(this.dispatcher);
    if (this.collisionConfiguration) A.destroy(this.collisionConfiguration);
  }
}
exports.PhysicsEngine = PhysicsEngine;
},{"../config.js":"WEZx"}],"rS4q":[function(require,module,exports) {
"use strict";

var _ammojsTyped = _interopRequireDefault(require("ammojs-typed"));
var _config = require("../src/gravity-lab/config.js");
var _PhysicsEngine = require("../src/gravity-lab/core/PhysicsEngine.js");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
/**
 * Node integration test for the Ammo.js layer used by GRAVITY LAB.
 *
 * It boots the real ammojs-typed module, builds the same kind of world as the
 * application (gravity, static platform, dynamic sphere / cube / cylinder) and
 * checks falling, resting contacts, collision counting and gravity inversion.
 *
 * Run with: npm run test:physics
 */

const results = [];
let failures = 0;
function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
function bootAmmo() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Ammo.js did not boot within 30 s")), 30000);
    try {
      (0, _ammojsTyped.default)(_ammojsTyped.default).then(() => {
        clearTimeout(timer);
        resolve(_ammojsTyped.default);
      });
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}
async function main() {
  const Ammo = await bootAmmo();
  check("Ammo.js bootstraps", typeof Ammo.btDiscreteDynamicsWorld === "function");
  const physics = new _PhysicsEngine.PhysicsEngine(Ammo);
  physics.init();
  check("World created", physics.isReady && Boolean(physics.world));
  const floor = physics.createBody({
    shape: physics.createBoxShape(30, 0.5, 30),
    mass: 0,
    position: {
      x: 0,
      y: -0.5,
      z: 0
    },
    friction: 0.9,
    restitution: 0.1,
    userIndex: -1
  });
  const sphere = physics.createBody({
    shape: physics.createSphereShape(0.55),
    mass: 2.4,
    position: {
      x: 0,
      y: 6,
      z: 0
    },
    friction: 0.45,
    restitution: 0.42,
    userIndex: 1,
    ccdRadius: 0.55
  });
  const cube = physics.createBody({
    shape: physics.createBoxShape(0.5, 0.5, 0.5),
    mass: 4.2,
    position: {
      x: 1.6,
      y: 7.4,
      z: 0
    },
    friction: 0.6,
    restitution: 0.18,
    userIndex: 2
  });
  const cylinder = physics.createBody({
    shape: physics.createCylinderShape(0.45, 1.1),
    mass: 3.1,
    position: {
      x: -1.6,
      y: 8.2,
      z: 0.4
    },
    friction: 0.5,
    restitution: 0.25,
    userIndex: 3
  });
  check("Bodies registered as dynamic", physics.dynamicBodies.length === 3);
  const readY = record => {
    const position = {
      x: 0,
      y: 0,
      z: 0
    };
    const quaternion = {
      x: 0,
      y: 0,
      z: 0,
      w: 1
    };
    physics.syncTransform(record, position, quaternion);
    return position.y;
  };
  const startPositions = [readY(sphere), readY(cube), readY(cylinder)];
  const fixed = _config.CONFIG.physics.fixedTimeStep;

  // 1.2 s of free fall: gravity must be pulling the bodies down.
  for (let i = 0; i < 72; i++) physics.step(fixed);
  const afterFall = [readY(sphere), readY(cube), readY(cylinder)];
  check("Gravity pulls bodies down", afterFall.every((y, i) => y < startPositions[i] - 0.5), afterFall.map(y => y.toFixed(2)).join(", "));
  check("Collision events counted during landing", physics.collisionTotal > 0, `${physics.collisionTotal} contacts`);

  // 6 s more: the three bodies must be resting on the static floor.
  for (let i = 0; i < 360; i++) physics.step(fixed);
  const resting = [readY(sphere), readY(cube), readY(cylinder)];
  check("Bodies rest on the floor", resting.every(y => y > 0.3 && y < 1.1), resting.map(y => y.toFixed(2)).join(", "));
  check("Bodies stay above the floor", resting.every(y => y > 0.2));

  // 2. Gravity inversion: the same bodies must climb.
  const beforeInversion = readY(sphere);
  physics.setGravityMagnitude(_config.CONFIG.physics.gravity);
  for (let i = 0; i < 60; i++) physics.step(fixed);
  check("Inverted gravity pushes bodies up", readY(sphere) > beforeInversion + 1, `${beforeInversion.toFixed(2)} -> ${readY(sphere).toFixed(2)}`);

  // 3. Zero gravity: no acceleration, velocity must stay nearly constant.
  physics.setGravityMagnitude(0);
  for (let i = 0; i < 30; i++) physics.step(fixed);
  const speed = physics.getSpeed(sphere.body);
  check("Zero-gravity world is stable", Number.isFinite(speed), `speed ${speed.toFixed(2)} m/s`);

  // 4. Central impulse must change the velocity.
  const before = physics.getSpeed(sphere.body);
  physics.applyImpulse(sphere.body, {
    x: 12,
    y: 4,
    z: 0
  });
  for (let i = 0; i < 6; i++) physics.step(fixed);
  check("Central impulse modifies velocity", physics.getSpeed(sphere.body) > before + 0.5, `${before.toFixed(2)} -> ${physics.getSpeed(sphere.body).toFixed(2)}`);

  // 5. Cleanup must not throw.
  physics.removeBody(cylinder);
  check("Body removal works", physics.dynamicBodies.length === 2);
  physics.removeBody(floor);
  physics.removeBody(sphere);
  physics.removeBody(cube);
  physics.dispose();
  check("Physics engine disposes cleanly", !physics.isReady);
  console.log("\nGRAVITY LAB · Ammo.js physics smoke test\n");
  for (const line of results) console.log(`  ${line}`);
  console.log(`\n${results.length - failures}/${results.length} checks passed.\n`);
  if (failures > 0) process.exitCode = 1;
}
main().catch(error => {
  console.error("\nGRAVITY LAB physics smoke test failed:");
  console.error(error);
  process.exitCode = 1;
});
},{"../src/gravity-lab/config.js":"WEZx","../src/gravity-lab/core/PhysicsEngine.js":"cHvq"}]},{},["rS4q"], null)
//# sourceMappingURL=/physics-smoke-entry.js.map