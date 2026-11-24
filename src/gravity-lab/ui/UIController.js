import * as TWEEN from "@tweenjs/tween.js";
import { CONFIG } from "../config.js";

/**
 * DOM-only interface controller. It never talks to Ammo or Three directly:
 * the application wires its handlers to the simulation.
 */
export class UIController {
  constructor() {
    this.bodyType = "sphere";
    this.gravityMagnitude = CONFIG.physics.gravity;
    this.gravityInverted = false;
    this.explosionStrength = CONFIG.physics.explosionDefault;
    this.handlers = {};

    this._lastStatsTime = 0;
    this._lastSparkTime = 0;
    this._lastCollisionTotal = 0;
    this._lastPaused = false;
    this._speedHistory = new Array(CONFIG.ui.speedHistoryLength).fill(0);
    this._bootTimer = null;
    this._toastTimer = null;
    this._toastTween = null;
    this._openPanel = null;
    this._revealed = false;
    this._bootMessages = [
      "INITIALIZING PHYSICS CORE",
      "CALIBRATING INERTIAL FRAMES",
      "COMPILING CONTACT MANIFOLDS",
      "SYNCHRONIZING RENDER PIPELINE",
      "LABORATORY READY",
    ];

    this._cacheElements();
    this._bindEvents();
    this._renderGravity();
    this._renderExplosion();
    this._drawSparkline();
  }

  _cacheElements() {
    const byId = (id) => document.getElementById(id);
    this.el = {
      bootScreen: byId("boot-screen"),
      bootStatus: byId("boot-status"),
      fatalScreen: byId("fatal-screen"),
      fatalMessage: byId("fatal-message"),
      fatalDetail: byId("fatal-detail"),
      retry: byId("btn-retry"),

      simStatus: byId("sim-status"),
      simStatusLabel: byId("sim-status-label"),
      engineChip: byId("engine-chip"),
      engineLabel: byId("engine-label"),

      pause: byId("btn-pause"),
      pauseLabel: byId("btn-pause-label"),
      camera: byId("btn-camera"),
      reboot: byId("btn-reboot"),

      typeButtons: Array.from(document.querySelectorAll("[data-body-type]")),
      addBody: byId("btn-add-body"),
      capacity: byId("body-capacity"),

      gravityRange: byId("gravity-range"),
      gravityValue: byId("gravity-value"),
      invert: byId("btn-invert"),
      presets: Array.from(document.querySelectorAll("[data-gravity]")),

      explosionRange: byId("explosion-range"),
      explosionValue: byId("explosion-value"),
      explode: byId("btn-explode"),

      resetScenario: byId("btn-reset-scenario"),
      rebootPanel: byId("btn-reboot-panel"),

      statBodies: byId("stat-bodies"),
      statActive: byId("stat-active"),
      statCollisions: byId("stat-collisions"),
      statSpeed: byId("stat-speed"),
      statSpeedMax: byId("stat-speed-max"),
      statFps: byId("stat-fps"),
      statGravity: byId("stat-gravity"),
      statGravityMode: byId("stat-gravity-mode"),
      cellBodies: byId("cell-bodies"),
      cellCollisions: byId("cell-collisions"),
      sparkline: byId("speed-sparkline"),
      sparkValue: byId("spark-value"),

      selectionEmpty: byId("selection-empty"),
      selectionDetails: byId("selection-details"),
      selectedId: byId("selected-id"),
      selectedType: byId("selected-type"),
      selectedMass: byId("selected-mass"),
      selectedSpeed: byId("selected-speed"),
      selectedMaterial: byId("selected-material"),
      impulse: byId("btn-impulse"),
      deselect: byId("btn-deselect"),

      toast: byId("toast"),
      backdrop: byId("panel-backdrop"),
      panels: {
        lab: byId("panel-lab"),
        data: byId("panel-data"),
      },
      dockButtons: Array.from(document.querySelectorAll("[data-open-panel]")),
      closeButtons: Array.from(document.querySelectorAll("[data-close-panel]")),
      enterElements: Array.from(document.querySelectorAll("[data-enter]")),
      app: byId("app"),
    };

    this._sparkContext = this.el.sparkline.getContext("2d");
  }

  _bindEvents() {
    for (const button of this.el.typeButtons) {
      button.addEventListener("click", () => this.setBodyType(button.dataset.bodyType));
    }

    this.el.addBody.addEventListener("click", () => {
      const body = this._call("onAddBody", this.bodyType);
      if (body) {
        this.showToast(`${body.type.toUpperCase()} INJECTED · MASS ${body.mass.toFixed(2)} kg`);
      } else {
        this.showToast("CORE BUSY · TRY AGAIN", "warn");
      }
    });

    this.el.gravityRange.addEventListener("input", () => {
      this.gravityMagnitude = Number.parseFloat(this.el.gravityRange.value);
      this._renderGravity();
      this._emitGravity();
    });

    this.el.invert.addEventListener("click", () => {
      this.gravityInverted = !this.gravityInverted;
      this._renderGravity();
      this._emitGravity();
    });

    for (const preset of this.el.presets) {
      preset.addEventListener("click", () => {
        this.gravityMagnitude = Number.parseFloat(preset.dataset.gravity);
        this.gravityInverted = false;
        this._renderGravity();
        this._emitGravity();
        this.showToast(`GRAVITY FIELD SET · ${this.gravityMagnitude.toFixed(2)} m/s²`);
      });
    }

    this.el.explosionRange.addEventListener("input", () => {
      this.explosionStrength = Number.parseFloat(this.el.explosionRange.value);
      this._renderExplosion();
      this._call("onExplosionStrengthChange", this.explosionStrength);
    });

    this.el.explode.addEventListener("click", () => {
      const affected = this._call("onExplode") || 0;
      this.showToast(
        affected > 0
          ? `DETONATION FIRED · ${affected} BODIES AFFECTED`
          : "DETONATION FIRED · NO BODIES IN RANGE",
        affected > 0 ? "info" : "warn"
      );
    });

    this.el.pause.addEventListener("click", () => {
      const paused = this._call("onTogglePause");
      if (typeof paused === "boolean") {
        this.setPaused(paused);
        this.showToast(paused ? "SIMULATION PAUSED" : "SIMULATION RESUMED");
      }
    });

    this.el.camera.addEventListener("click", () => {
      this._call("onResetCamera");
      this.showToast("CAMERA VIEW REALIGNED");
    });

    const reboot = () => {
      this._call("onResetAll");
      this.setGravityState(CONFIG.physics.gravity, false, false);
      this.setPaused(false);
      this.showToast("FULL LABORATORY REBOOT COMPLETE");
    };
    this.el.reboot.addEventListener("click", reboot);
    this.el.rebootPanel.addEventListener("click", reboot);

    this.el.resetScenario.addEventListener("click", () => {
      this._call("onResetScenario");
      this.showToast("SCENARIO RESET · CONTAINMENT CLEARED");
    });

    this.el.impulse.addEventListener("click", () => {
      const applied = this._call("onApplyImpulse");
      this.showToast(
        applied ? "IMPULSE VECTOR APPLIED" : "SELECT A BODY FIRST",
        applied ? "info" : "warn"
      );
    });

    this.el.deselect.addEventListener("click", () => {
      this._call("onDeselect");
    });

    this.el.retry.addEventListener("click", () => window.location.reload());

    for (const button of this.el.dockButtons) {
      button.addEventListener("click", () => this.openPanel(button.dataset.openPanel));
    }
    for (const button of this.el.closeButtons) {
      button.addEventListener("click", () => this.closePanels());
    }
    this.el.backdrop.addEventListener("click", () => this.closePanels());

    window.addEventListener("keydown", (event) => this._onKeyDown(event));
    window.addEventListener("resize", () => {
      if (window.innerWidth > 980) this.closePanels();
    });
  }

  _onKeyDown(event) {
    const target = event.target;
    const tag = target && target.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      (target && target.isContentEditable)
    ) {
      return;
    }
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (this.el.fatalScreen && !this.el.fatalScreen.hidden) return;

    switch (event.code) {
      case "Space": {
        event.preventDefault();
        const paused = this._call("onTogglePause");
        if (typeof paused === "boolean") {
          this.setPaused(paused);
          this.showToast(paused ? "SIMULATION PAUSED" : "SIMULATION RESUMED");
        }
        break;
      }
      case "KeyN": {
        event.preventDefault();
        this.el.addBody.click();
        break;
      }
      case "KeyR": {
        event.preventDefault();
        this.el.resetScenario.click();
        break;
      }
      case "KeyC": {
        event.preventDefault();
        this.el.camera.click();
        break;
      }
      case "KeyE": {
        event.preventDefault();
        this.el.explode.click();
        break;
      }
      case "KeyF": {
        event.preventDefault();
        this.el.impulse.click();
        break;
      }
      case "KeyG": {
        event.preventDefault();
        this.el.invert.click();
        break;
      }
      case "Digit1":
        this.setBodyType("sphere");
        break;
      case "Digit2":
        this.setBodyType("cube");
        break;
      case "Digit3":
        this.setBodyType("cylinder");
        break;
      case "Escape":
        if (this._openPanel) this.closePanels();
        else this._call("onDeselect");
        break;
      default:
        break;
    }
  }

  _call(name, ...args) {
    const handler = this.handlers[name];
    return typeof handler === "function" ? handler(...args) : undefined;
  }

  setHandlers(handlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  setBodyType(type) {
    this.bodyType = type;
    for (const button of this.el.typeButtons) {
      const active = button.dataset.bodyType === type;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  _formatSigned(value) {
    if (Math.abs(value) < 0.005) return "0.00";
    const sign = value < 0 ? "−" : "+";
    return `${sign}${Math.abs(value).toFixed(2)}`;
  }

  _renderGravity() {
    const magnitude = Math.min(Math.max(this.gravityMagnitude, 0), CONFIG.physics.maxGravity);
    this.gravityMagnitude = magnitude;
    const signed = this.gravityInverted ? -magnitude : magnitude;

    this.el.gravityRange.value = String(magnitude);
    this.el.gravityRange.style.setProperty("--fill", `${(magnitude / CONFIG.physics.maxGravity) * 100}%`);
    this.el.gravityValue.textContent = this._formatSigned(signed);
    this.el.invert.setAttribute("aria-checked", String(this.gravityInverted));

    for (const preset of this.el.presets) {
      const value = Number.parseFloat(preset.dataset.gravity);
      const active = !this.gravityInverted && Math.abs(value - magnitude) < 0.02;
      preset.classList.toggle("is-active", active);
    }
  }

  _renderExplosion() {
    const value = this.explosionStrength;
    this.el.explosionValue.textContent = String(Math.round(value));
    this.el.explosionRange.style.setProperty(
      "--fill",
      `${((value - 5) / (60 - 5)) * 100}%`
    );
  }

  _emitGravity() {
    const signed = this.gravityInverted
      ? -this.gravityMagnitude
      : this.gravityMagnitude;
    this._call("onGravityChange", signed);
  }

  setGravityState(magnitude, inverted, emit = false) {
    this.gravityMagnitude = magnitude;
    this.gravityInverted = inverted;
    this._renderGravity();
    if (emit) this._emitGravity();
  }

  setPaused(paused) {
    this._lastPaused = paused;
    this.el.pause.dataset.state = paused ? "paused" : "live";
    this.el.pauseLabel.textContent = paused ? "RESUME" : "PAUSE";
    this.el.pause.setAttribute(
      "aria-label",
      paused ? "Resume simulation" : "Pause simulation"
    );
    this.el.simStatus.dataset.state = paused ? "paused" : "live";
    this.el.simStatusLabel.textContent = paused
      ? "SIMULATION PAUSED"
      : "SIMULATION LIVE";
  }

  startBootSequence() {
    let index = 0;
    this.setBootMessage(this._bootMessages[0]);
    this._bootTimer = window.setInterval(() => {
      index = Math.min(index + 1, this._bootMessages.length - 2);
      this.setBootMessage(this._bootMessages[index]);
    }, 900);
  }

  setBootMessage(message) {
    if (this.el.bootStatus) this.el.bootStatus.textContent = message;
  }

  setEngineReady() {
    if (this._bootTimer) {
      window.clearInterval(this._bootTimer);
      this._bootTimer = null;
    }
    this.el.engineChip.dataset.state = "ready";
    this.el.engineLabel.textContent = "AMMO // ONLINE";
    this.setBootMessage("LABORATORY READY");

    const state = { opacity: 1 };
    new TWEEN.Tween(state)
      .to({ opacity: 0 }, 650)
      .delay(280)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(() => {
        this.el.bootScreen.style.opacity = String(state.opacity);
      })
      .onComplete(() => {
        this.el.bootScreen.style.display = "none";
      })
      .start();

    this.revealInterface();
  }

  revealInterface() {
    if (this._revealed) return;
    this._revealed = true;
    this.el.app.classList.add("is-ready");

    this.el.enterElements.forEach((element, index) => {
      const state = { progress: 0 };
      new TWEEN.Tween(state)
        .to({ progress: 1 }, 620)
        .delay(160 + index * 110)
        .easing(TWEEN.Easing.Cubic.Out)
        .onUpdate(() => {
          element.style.opacity = String(state.progress);
        })
        .start();
    });
  }

  showFatal(message, detail = "") {
    if (this._bootTimer) {
      window.clearInterval(this._bootTimer);
      this._bootTimer = null;
    }
    this.el.engineChip.dataset.state = "error";
    this.el.engineLabel.textContent = "AMMO // FAULT";
    this.el.bootScreen.style.display = "none";
    this.el.fatalScreen.hidden = false;
    this.el.fatalMessage.textContent = message;
    this.el.fatalDetail.textContent = detail;
    this.el.fatalDetail.style.display = detail ? "block" : "none";
  }

  openPanel(name) {
    if (!this.el.panels[name]) return;
    if (this._openPanel === name) {
      this.closePanels();
      return;
    }
    this.closePanels();
    this._openPanel = name;
    this.el.panels[name].classList.add("is-open");
    this.el.backdrop.classList.add("is-visible");
    for (const button of this.el.dockButtons) {
      button.classList.toggle("is-active", button.dataset.openPanel === name);
    }
  }

  closePanels() {
    this._openPanel = null;
    for (const panel of Object.values(this.el.panels)) {
      panel.classList.remove("is-open");
    }
    this.el.backdrop.classList.remove("is-visible");
    for (const button of this.el.dockButtons) {
      button.classList.remove("is-active");
    }
  }

  showToast(message, tone = "info", duration = 2300) {
    const element = this.el.toast;
    if (this._toastTimer) {
      window.clearTimeout(this._toastTimer);
      this._toastTimer = null;
    }
    if (this._toastTween) {
      this._toastTween.stop();
      this._toastTween = null;
    }

    element.textContent = message;
    element.dataset.tone = tone;
    element.style.visibility = "visible";
    element.style.opacity = "0";
    element.style.transform = "translate(-50%, 8px)";

    const state = { opacity: 0, y: 8 };
    this._toastTween = new TWEEN.Tween(state)
      .to({ opacity: 1, y: 0 }, 200)
      .easing(TWEEN.Easing.Cubic.Out)
      .onUpdate(() => {
        element.style.opacity = String(state.opacity);
        element.style.transform = `translate(-50%, ${state.y}px)`;
      })
      .start();

    this._toastTimer = window.setTimeout(() => {
      const hideState = { opacity: 1, y: 0 };
      this._toastTween = new TWEEN.Tween(hideState)
        .to({ opacity: 0, y: -5 }, 260)
        .easing(TWEEN.Easing.Cubic.In)
        .onUpdate(() => {
          element.style.opacity = String(hideState.opacity);
          element.style.transform = `translate(-50%, ${hideState.y}px)`;
        })
        .onComplete(() => {
          element.style.visibility = "hidden";
        })
        .start();
    }, duration);
  }

  updateStats(stats, now = performance.now()) {
    if (!stats) return;
    if (now - this._lastStatsTime < CONFIG.ui.statsInterval) return;
    this._lastStatsTime = now;

    const count = stats.bodyCount;
    this._setText(this.el.statBodies, String(count).padStart(2, "0"));
    this._setText(this.el.statActive, `${stats.activeCount} ACTIVE`);
    this._setText(this.el.capacity, `${count} / ${CONFIG.physics.maxBodies}`);

    const collisions = String(stats.collisionTotal).padStart(4, "0");
    this._setText(this.el.statCollisions, collisions);
    if (stats.collisionTotal > this._lastCollisionTotal) {
      this.el.cellCollisions.classList.remove("pulse");
      void this.el.cellCollisions.offsetWidth;
      this.el.cellCollisions.classList.add("pulse");
    }
    this._lastCollisionTotal = stats.collisionTotal;

    this._setHTML(
      this.el.statSpeed,
      `${stats.avgSpeed.toFixed(2)}<small>m/s</small>`
    );
    this._setText(
      this.el.statSpeedMax,
      `PEAK ${stats.maxSpeed.toFixed(2)} m/s`
    );
    this._setHTML(this.el.statFps, `${stats.fps}<small>fps</small>`);
    this._setHTML(
      this.el.statGravity,
      `${this._formatSigned(stats.gravity)}<small>m/s²</small>`
    );

    let mode = "NOMINAL DOWNWARD FIELD";
    if (Math.abs(stats.gravity) < 0.005) mode = "ZERO-G ENVIRONMENT";
    else if (stats.gravity > 0) mode = "INVERTED UPWARD FIELD";
    this._setText(this.el.statGravityMode, mode);

    if (stats.paused !== this._lastPaused) this.setPaused(stats.paused);
    this._updateSelection(stats.selected);

    if (now - this._lastSparkTime >= 500) {
      this._lastSparkTime = now;
      this._speedHistory.push(stats.avgSpeed);
      this._speedHistory.shift();
      this._drawSparkline();
      this._setText(this.el.sparkValue, stats.avgSpeed.toFixed(2));
    }
  }

  _updateSelection(selected) {
    const hasSelection = Boolean(selected);
    this.el.selectionEmpty.hidden = hasSelection;
    this.el.selectionDetails.hidden = !hasSelection;
    this.el.impulse.disabled = !hasSelection;
    if (!hasSelection) return;

    this._setText(this.el.selectedId, `BODY-${String(selected.id).padStart(3, "0")}`);
    this._setText(this.el.selectedType, selected.typeLabel);
    this._setText(this.el.selectedMass, `${selected.mass.toFixed(2)} kg`);
    this._setText(this.el.selectedSpeed, `${selected.speed.toFixed(2)} m/s`);
    this._setText(this.el.selectedMaterial, selected.palette);
  }

  _drawSparkline() {
    const canvas = this.el.sparkline;
    const ctx = this._sparkContext;
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 12, right: 4, bottom: 8, left: 4 };

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(112, 172, 200, 0.11)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = padding.top + ((height - padding.top - padding.bottom) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    const values = this._speedHistory;
    const maxValue = Math.max(1, ...values) * 1.18;
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const points = values.map((value, index) => {
      const x = padding.left + (index / (values.length - 1)) * plotWidth;
      const y = padding.top + plotHeight - (value / maxValue) * plotHeight;
      return { x, y };
    });

    const gradient = ctx.createLinearGradient(0, padding.top, 0, height);
    gradient.addColorStop(0, "rgba(87, 232, 255, 0.22)");
    gradient.addColorStop(1, "rgba(87, 232, 255, 0)");

    ctx.beginPath();
    ctx.moveTo(points[0].x, height - padding.bottom);
    for (const point of points) ctx.lineTo(point.x, point.y);
    ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    const stroke = ctx.createLinearGradient(0, 0, width, 0);
    stroke.addColorStop(0, "rgba(38, 122, 152, 0.7)");
    stroke.addColorStop(1, "#57e8ff");
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(87, 232, 255, 0.55)";
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x - 1, last.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = "#bff9ff";
    ctx.fill();
  }

  _setText(element, value) {
    if (element && element.textContent !== value) {
      element.textContent = value;
    }
  }

  _setHTML(element, value) {
    if (element && element.innerHTML !== value) {
      element.innerHTML = value;
    }
  }
}
