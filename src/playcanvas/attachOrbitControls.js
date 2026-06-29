import { math, Vec3 } from 'playcanvas';

export function attachOrbitControls(app, camera, options = {}) {
  const canvas = app.graphicsDevice.canvas;
  const state = {
    yaw: options.yaw ?? 0,
    pitch: options.pitch ?? -12,
    distance: options.distance ?? 2.5,
    minDistance: options.minDistance ?? 1,
    maxDistance: options.maxDistance ?? 10,
    target: options.target?.clone?.() ?? new Vec3(0, 0, 0),
    rotateSpeed: options.rotateSpeed ?? 0.25,
    panSpeed: options.panSpeed ?? 0.0025,
    zoomSpeed: options.zoomSpeed ?? 0.002,
    mode: null,
    lastX: 0,
    lastY: 0
  };

  const forward = new Vec3();
  const right = new Vec3();
  const up = new Vec3();

  const updateCamera = () => {
    const yaw = state.yaw * math.DEG_TO_RAD;
    const pitch = state.pitch * math.DEG_TO_RAD;
    const cosPitch = Math.cos(pitch);

    const offset = new Vec3(
      Math.sin(yaw) * cosPitch,
      Math.sin(pitch),
      Math.cos(yaw) * cosPitch
    ).mulScalar(state.distance);

    camera.setPosition(state.target.clone().add(offset));
    camera.lookAt(state.target);
  };

  const endInteraction = () => {
    state.mode = null;
  };

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  canvas.addEventListener('pointerdown', (event) => {
    state.mode = event.button === 2 ? 'pan' : 'rotate';
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!state.mode) {
      return;
    }

    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;

    if (state.mode === 'rotate') {
      state.yaw -= dx * state.rotateSpeed;
      state.pitch = math.clamp(state.pitch - dy * state.rotateSpeed, -89, 89);
      updateCamera();
      return;
    }

    forward.copy(camera.forward).mulScalar(state.distance * state.panSpeed * dy);
    right.copy(camera.right).mulScalar(-state.distance * state.panSpeed * dx);
    up.set(0, 1, 0).mulScalar(state.distance * state.panSpeed * dy * 0.15);
    state.target.add(right).add(forward).add(up);
    updateCamera();
  });

  canvas.addEventListener('pointerup', endInteraction);
  canvas.addEventListener('pointercancel', endInteraction);
  canvas.addEventListener('pointerleave', endInteraction);

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const zoomDelta = 1 + event.deltaY * state.zoomSpeed;
    state.distance = math.clamp(
      state.distance * zoomDelta,
      state.minDistance,
      state.maxDistance
    );
    updateCamera();
  }, { passive: false });

  updateCamera();

  return {
    updateCamera
  };
}
