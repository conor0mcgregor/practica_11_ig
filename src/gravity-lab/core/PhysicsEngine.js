import { CONFIG } from "../config.js";

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
export class PhysicsEngine {
  constructor(Ammo) {
    this.Ammo = Ammo;
    this.world = null;
    this.dispatcher = null;
    this.dynamicBodies = [];
    this.gravity = -CONFIG.physics.gravity;
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
    this.world = new A.btDiscreteDynamicsWorld(
      this.dispatcher,
      this.broadphase,
      this.solver,
      this.collisionConfiguration
    );

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
    shape.setMargin(CONFIG.physics.margin);
    A.destroy(halfExtents);
    return shape;
  }

  createSphereShape(radius) {
    const shape = new this.Ammo.btSphereShape(radius);
    shape.setMargin(CONFIG.physics.margin);
    return shape;
  }

  createCylinderShape(radius, height) {
    const A = this.Ammo;
    const halfExtents = new A.btVector3(radius, height * 0.5, radius);
    const shape = new A.btCylinderShape(halfExtents);
    shape.setMargin(CONFIG.physics.margin);
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
    quaternion = { x: 0, y: 0, z: 0, w: 1 },
    friction = 0.5,
    restitution = 0.3,
    userIndex = -1,
    linearDamping = 0.04,
    angularDamping = 0.08,
    ccdRadius = 0,
  }) {
    if (!this._ready) {
      throw new Error("PhysicsEngine.createBody() called before init().");
    }

    const A = this.Ammo;
    const origin = new A.btVector3(position.x, position.y, position.z);
    const rotation = new A.btQuaternion(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    );

    const transform = new A.btTransform();
    transform.setIdentity();
    transform.setOrigin(origin);
    transform.setRotation(rotation);

    const motionState = new A.btDefaultMotionState(transform);
    const localInertia = new A.btVector3(0, 0, 0);
    if (mass > 0) {
      shape.calculateLocalInertia(mass, localInertia);
    }

    const constructionInfo = new A.btRigidBodyConstructionInfo(
      mass,
      motionState,
      shape,
      localInertia
    );
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

    return { body, motionState, shape };
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
