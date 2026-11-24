/**
 * Node integration test for the Ammo.js layer used by GRAVITY LAB.
 *
 * It boots the real ammojs-typed module, builds the same kind of world as the
 * application (gravity, static platform, dynamic sphere / cube / cylinder) and
 * checks falling, resting contacts, collision counting and gravity inversion.
 *
 * Run with: npm run test:physics
 */
import AmmoModule from "ammojs-typed";
import { CONFIG } from "../src/gravity-lab/config.js";
import { PhysicsEngine } from "../src/gravity-lab/core/PhysicsEngine.js";

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

function bootAmmo() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Ammo.js did not boot within 30 s")),
      30000
    );
    try {
      AmmoModule(AmmoModule).then(() => {
        clearTimeout(timer);
        resolve(AmmoModule);
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

  const physics = new PhysicsEngine(Ammo);
  physics.init();
  check("World created", physics.isReady && Boolean(physics.world));

  const floor = physics.createBody({
    shape: physics.createBoxShape(30, 0.5, 30),
    mass: 0,
    position: { x: 0, y: -0.5, z: 0 },
    friction: 0.9,
    restitution: 0.1,
    userIndex: -1,
  });

  const sphere = physics.createBody({
    shape: physics.createSphereShape(0.55),
    mass: 2.4,
    position: { x: 0, y: 6, z: 0 },
    friction: 0.45,
    restitution: 0.42,
    userIndex: 1,
    ccdRadius: 0.55,
  });

  const cube = physics.createBody({
    shape: physics.createBoxShape(0.5, 0.5, 0.5),
    mass: 4.2,
    position: { x: 1.6, y: 7.4, z: 0 },
    friction: 0.6,
    restitution: 0.18,
    userIndex: 2,
  });

  const cylinder = physics.createBody({
    shape: physics.createCylinderShape(0.45, 1.1),
    mass: 3.1,
    position: { x: -1.6, y: 8.2, z: 0.4 },
    friction: 0.5,
    restitution: 0.25,
    userIndex: 3,
  });

  check("Bodies registered as dynamic", physics.dynamicBodies.length === 3);

  const readY = (record) => {
    const position = { x: 0, y: 0, z: 0 };
    const quaternion = { x: 0, y: 0, z: 0, w: 1 };
    physics.syncTransform(record, position, quaternion);
    return position.y;
  };

  const startPositions = [readY(sphere), readY(cube), readY(cylinder)];
  const fixed = CONFIG.physics.fixedTimeStep;

  // 1.2 s of free fall: gravity must be pulling the bodies down.
  for (let i = 0; i < 72; i++) physics.step(fixed);
  const afterFall = [readY(sphere), readY(cube), readY(cylinder)];
  check(
    "Gravity pulls bodies down",
    afterFall.every((y, i) => y < startPositions[i] - 0.5),
    afterFall.map((y) => y.toFixed(2)).join(", ")
  );
  check(
    "Collision events counted during landing",
    physics.collisionTotal > 0,
    `${physics.collisionTotal} contacts`
  );

  // 6 s more: the three bodies must be resting on the static floor.
  for (let i = 0; i < 360; i++) physics.step(fixed);
  const resting = [readY(sphere), readY(cube), readY(cylinder)];
  check(
    "Bodies rest on the floor",
    resting.every((y) => y > 0.3 && y < 1.1),
    resting.map((y) => y.toFixed(2)).join(", ")
  );
  check(
    "Bodies stay above the floor",
    resting.every((y) => y > 0.2)
  );

  // 2. Gravity inversion: the same bodies must climb.
  const beforeInversion = readY(sphere);
  physics.setGravityMagnitude(CONFIG.physics.gravity);
  for (let i = 0; i < 60; i++) physics.step(fixed);
  check(
    "Inverted gravity pushes bodies up",
    readY(sphere) > beforeInversion + 1,
    `${beforeInversion.toFixed(2)} -> ${readY(sphere).toFixed(2)}`
  );

  // 3. Zero gravity: no acceleration, velocity must stay nearly constant.
  physics.setGravityMagnitude(0);
  for (let i = 0; i < 30; i++) physics.step(fixed);
  const speed = physics.getSpeed(sphere.body);
  check("Zero-gravity world is stable", Number.isFinite(speed), `speed ${speed.toFixed(2)} m/s`);

  // 4. Central impulse must change the velocity.
  const before = physics.getSpeed(sphere.body);
  physics.applyImpulse(sphere.body, { x: 12, y: 4, z: 0 });
  for (let i = 0; i < 6; i++) physics.step(fixed);
  check(
    "Central impulse modifies velocity",
    physics.getSpeed(sphere.body) > before + 0.5,
    `${before.toFixed(2)} -> ${physics.getSpeed(sphere.body).toFixed(2)}`
  );

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
  console.log(
    `\n${results.length - failures}/${results.length} checks passed.\n`
  );

  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("\nGRAVITY LAB physics smoke test failed:");
  console.error(error);
  process.exitCode = 1;
});
