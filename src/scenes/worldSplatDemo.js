import { Color, Entity, Vec3 } from 'playcanvas';
import { createApp } from '../playcanvas/createApp.js';
import { loadAssets } from '../playcanvas/loadAssets.js';
import { attachOrbitControls } from '../playcanvas/attachOrbitControls.js';

const WORLD_SPLAT_ASSETS = [
  {
    name: 'toy-cat',
    type: 'gsplat',
    url: 'https://developer.playcanvas.com/assets/toy-cat.sog'
  }
];

export async function createWorldSplatDemo(container) {
  container.innerHTML = '';

  const loading = document.createElement('div');
  loading.className = 'app-loading';
  loading.innerHTML = `
    <h1>Loading world splat demo</h1>
    <p>Fetching the Gaussian splat asset.</p>
  `;
  container.appendChild(loading);

  const hud = document.createElement('div');
  hud.className = 'app-hud';
  hud.innerHTML = `
    <h1>PlayCanvas Local Splat Sandbox</h1>
    <p>Orbit: drag</p>
    <p>Pan: right-drag</p>
    <p>Zoom: mouse wheel</p>
    <p>Entry file: <code>src/scenes/worldSplatDemo.js</code></p>
  `;
  container.appendChild(hud);

  const { app } = createApp(container);
  app.scene.ambientLight = new Color(0.15, 0.18, 0.22);

  const assets = await loadAssets(app, WORLD_SPLAT_ASSETS);

  const camera = new Entity('Camera');
  camera.setPosition(0, 0, 2.5);
  camera.addComponent('camera', {
    clearColor: new Color(0.02, 0.04, 0.06)
  });
  app.root.addChild(camera);

  const splat = new Entity('Toy Cat');
  splat.setPosition(0, -0.7, 0);
  splat.setEulerAngles(0, 0, 180);
  splat.addComponent('gsplat', { asset: assets[0] });
  app.root.addChild(splat);

  attachOrbitControls(app, camera, {
    target: new Vec3(0, -0.15, 0),
    distance: 2.5,
    minDistance: 1.2,
    maxDistance: 8
  });

  loading.remove();

  return { app, camera, splat, assets };
}
