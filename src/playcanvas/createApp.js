import {
  Application,
  FILLMODE_FILL_WINDOW,
  RESOLUTION_AUTO
} from 'playcanvas';

export function createApp(container) {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const app = new Application(canvas, {
    graphicsDeviceOptions: {
      antialias: false
    }
  });

  app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(RESOLUTION_AUTO);
  app.start();

  const resize = () => app.resizeCanvas();
  window.addEventListener('resize', resize);
  resize();

  return { app, canvas };
}
