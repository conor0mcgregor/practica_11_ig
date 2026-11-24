import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import Ammo from "ammojs-typed";
import { CONFIG } from "./config.js";
import { PhysicsEngine } from "./core/PhysicsEngine.js";
import { LabScene } from "./core/LabScene.js";
import { BodyFactory } from "./core/BodyFactory.js";
import { Effects } from "./core/Effects.js";
import { Simulation } from "./core/Simulation.js";
import { InteractionController } from "./core/InteractionController.js";
import { UIController } from "./ui/UIController.js";

const ui = new UIController();
let app = null;

boot();

async function boot() {
  ui.startBootSequence();

  try {
    ui.setBootMessage("LOADING AMMO.JS SOLVER");
    await loadAmmo();
    ui.setBootMessage("BUILDING LABORATORY SHELL");

    const physics = new PhysicsEngine(Ammo);
    physics.init();

    const container = document.getElementById("viewport");
    const labScene = new LabScene(container, Ammo, physics);
    const bodyFactory = new BodyFactory(Ammo, labScene.scene, physics);
    const effects = new Effects({
      scene: labScene.scene,
      flashElement: document.getElementById("flash-layer"),
    });
    const simulation = new Simulation({
      scene: labScene.scene,
      physics,
      bodyFactory,
      effects,
      labScene,
    });

    const interaction = new InteractionController({
      domElement: labScene.renderer.domElement,
      camera: labScene.camera,
      simulation,
      onSelectionChange: (body) => {
        if (body) {
          ui.setBootMessage("BODY LOCKED");
        }
      },
    });

    wireHandlers({ simulation, labScene, ui });
    ui.setGravityState(CONFIG.physics.gravity, false, false);
    ui.setPaused(false);

    labScene.playIntro();
    simulation.start();

    app = {
      physics,
      labScene,
      bodyFactory,
      effects,
      simulation,
      interaction,
      ui,
      disposed: false,
    };

    // The render loop must exist before Tween.js starts the boot/reveal
    // transitions, otherwise those tweens would never be updated.
    startRenderLoop(app);

    ui.setBootMessage("SEEDING EXPERIMENT");
    ui.setEngineReady();
    ui.showToast("LABORATORY ONLINE · 11 BODIES DEPLOYED");
  } catch (error) {
    console.error("[GRAVITY LAB] Boot failure:", error);
    ui.showFatal(
      "The Ammo.js physics core could not be initialized. WebGL or the physics runtime is unavailable in this browser.",
      error && error.stack ? error.stack : String(error)
    );
  }
}

function wireHandlers({ simulation, labScene, ui }) {
  ui.setHandlers({
    onAddBody: (type) => simulation.addBody(type),
    onGravityChange: (signedGravity) => simulation.setGravity(signedGravity),
    onExplosionStrengthChange: (value) => {
      simulation.explosionStrength = value;
    },
    onExplode: () => simulation.explode(),
    onTogglePause: () => simulation.togglePause(),
    onResetScenario: () => {
      simulation.reset();
      ui.setPaused(simulation.paused);
    },
    onResetAll: () => {
      simulation.setPaused(false);
      simulation.reset({ full: true });
      labScene.resetCamera(true);
    },
    onResetCamera: () => labScene.resetCamera(true),
    onApplyImpulse: () => simulation.applyImpulseToSelected(),
    onDeselect: () => simulation.clearSelection(),
  });
}

function startRenderLoop(context) {
  const clock = new THREE.Clock();
  let running = true;

  const animate = (time) => {
    if (!running) return;
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsed = time / 1000;

    TWEEN.update(time);
    context.simulation.update(delta);
    context.labScene.update(delta, elapsed);
    context.labScene.render();
    context.ui.updateStats(context.simulation.getStats(), time);
  };

  requestAnimationFrame(animate);

  context.stopRenderLoop = () => {
    running = false;
  };
}

function loadAmmo() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (error) {
        reject(error);
        return;
      }
      if (typeof Ammo.btDiscreteDynamicsWorld !== "function") {
        reject(new Error("Ammo.js loaded but the API namespace is empty."));
        return;
      }
      resolve();
    };

    const timeout = window.setTimeout(() => {
      finish(
        new Error(
          "Ammo.js bootstrap timed out after 30 seconds. The asm.js module could not start."
        )
      );
    }, 30000);

    try {
      const result = Ammo(Ammo);
      if (result && typeof result.then === "function") {
        result.then(() => finish()).catch((error) => finish(error));
      } else {
        finish();
      }
    } catch (error) {
      finish(error);
    }
  });
}

function disposeApp(context) {
  if (!context || context.disposed) return;
  context.disposed = true;
  try {
    if (context.stopRenderLoop) context.stopRenderLoop();
    if (context.interaction) context.interaction.dispose();
    if (context.simulation) context.simulation.dispose();
    if (context.effects) context.effects.dispose();
    if (context.bodyFactory) context.bodyFactory.dispose();
    if (context.labScene) context.labScene.dispose();
    if (context.physics) context.physics.dispose();
    TWEEN.removeAll();
  } catch (error) {
    console.warn("[GRAVITY LAB] Cleanup warning:", error);
  }
}

window.addEventListener(
  "beforeunload",
  () => {
    if (app) disposeApp(app);
  },
  { once: true }
);

window.addEventListener("error", (event) => {
  if (!app && !document.getElementById("fatal-screen").hidden) return;
  if (!app && event.error) {
    console.error("[GRAVITY LAB] Uncaught error:", event.error);
  }
});
