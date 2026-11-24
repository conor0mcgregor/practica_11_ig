import * as THREE from "three";

/**
 * Pointer picking for the 3D scene. Kept separate from OrbitControls so
 * dragging the camera never selects a body by accident.
 */
export class InteractionController {
  constructor({ domElement, camera, simulation, onSelectionChange }) {
    this.domElement = domElement;
    this.camera = camera;
    this.simulation = simulation;
    this.onSelectionChange = onSelectionChange;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._downX = 0;
    this._downY = 0;
    this._dragged = false;
    this._hoverTimer = null;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);

    this.domElement.addEventListener("pointerdown", this._onPointerDown);
    this.domElement.addEventListener("pointerup", this._onPointerUp);
    this.domElement.addEventListener("pointermove", this._onPointerMove);
  }

  _updatePointer(event) {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(
      this.simulation.getSelectableMeshes(),
      true
    );
    for (const hit of intersections) {
      let object = hit.object;
      while (object && !object.userData.labBody) {
        object = object.parent;
      }
      if (object && object.userData.labBody) {
        return object.userData.labBody;
      }
    }
    return null;
  }

  _onPointerDown(event) {
    if (event.button !== 0) return;
    this._downX = event.clientX;
    this._downY = event.clientY;
    this._dragged = false;
    this._updatePointer(event);
  }

  _onPointerUp(event) {
    if (event.button !== 0) return;
    const distance = Math.hypot(
      event.clientX - this._downX,
      event.clientY - this._downY
    );
    if (distance > 6) return;
    this._updatePointer(event);
    const body = this._pick();
    this.simulation.selectByMesh(body ? body.mesh : null);
    if (this.onSelectionChange) this.onSelectionChange(body);
  }

  _onPointerMove(event) {
    if (event.buttons !== 0) return;
    if (this._hoverTimer) return;
    this._hoverTimer = window.setTimeout(() => {
      this._hoverTimer = null;
      this._updatePointer(event);
      const body = this._pick();
      this.domElement.style.cursor = body ? "pointer" : "grab";
    }, 70);
  }

  dispose() {
    this.domElement.removeEventListener("pointerdown", this._onPointerDown);
    this.domElement.removeEventListener("pointerup", this._onPointerUp);
    this.domElement.removeEventListener("pointermove", this._onPointerMove);
    if (this._hoverTimer) window.clearTimeout(this._hoverTimer);
  }
}
