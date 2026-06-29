// @config DESCRIPTION Internal research view comparing offline 3DGS-to-PC estimated volumes against voxel and collision mesh baselines.
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await pc.createGraphicsDevice(canvas, {
    deviceTypes: [deviceType],
    antialias: false
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const OBJECTS = {
    biker: {
        label: 'Biker',
        position: [0, -0.55, 0],
        rotation: [180, -90, 0],
        scale: [0.3, 0.3, 0.3]
    },
    testCube: {
        label: 'Test Cube',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
    },
    testSphere: {
        label: 'Test Sphere',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
    },
    testCylinder: {
        label: 'Test Cylinder',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
    }
};

const assets = {
    orbit: new pc.Asset('orbit', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    biker: new pc.Asset('biker', 'gsplat', { url: `${rootPath}/static/assets/splats/biker.compressed.ply` }),
    testCube: new pc.Asset('testCube', 'gsplat', { url: `${rootPath}/static/assets/splats/testCube.ply` }),
    testSphere: new pc.Asset('testSphere', 'gsplat', { url: `${rootPath}/static/assets/splats/testSphere.ply` }),
    testCylinder: new pc.Asset('testCylinder', 'gsplat', { url: `${rootPath}/static/assets/splats/testCylinder.ply` }),
    bikerCollision: new pc.Asset('bikerCollision', 'container', { url: `${rootPath}/static/assets/volumes/biker.collision.glb` }),
    testCubeCollision: new pc.Asset('testCubeCollision', 'container', { url: `${rootPath}/static/assets/volumes/testCube.collision.glb` }),
    testSphereCollision: new pc.Asset('testSphereCollision', 'container', { url: `${rootPath}/static/assets/volumes/testSphere.collision.glb` }),
    testCylinderCollision: new pc.Asset('testCylinderCollision', 'container', { url: `${rootPath}/static/assets/volumes/testCylinder.collision.glb` })
};

const CORE_VIEW_MODES = [
    { id: 'splat', label: 'Original Splat' },
    { id: '3dgs-to-pc', label: '3DGS-to-PC' },
    { id: 'density-direct', label: 'Density Iso-Surface' },
    { id: 'occupancy-sdf', label: 'Occupancy-SDF' }
];

const formatVolume = (volume) => {
    return Number.isFinite(volume) ? volume.toFixed(6) : '--';
};
const formatPercent = (value) => {
    return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '--';
};

const style = document.createElement('style');
style.textContent = `
    .research-panel {
        position: absolute;
        top: 22px;
        left: 22px;
        width: 370px;
        padding: 14px;
        background: rgba(25, 27, 30, 0.94);
        border: 1px solid #515861;
        border-radius: 6px;
        color: #eef2f4;
        font: 13px Arial, sans-serif;
        z-index: 1000;
    }
    .research-panel h2 {
        margin: 0 0 4px;
        font-size: 18px;
    }
    .research-note {
        color: #aab7c2;
        font-size: 11px;
        margin-bottom: 12px;
    }
    .research-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
    }
    .research-button {
        flex: 1 1 76px;
        padding: 7px 5px;
        background: #30383d;
        border: 1px solid #56636d;
        border-radius: 4px;
        color: #f2f4f5;
        cursor: pointer;
    }
    .research-button.active {
        background: #4c6a80;
        border-color: #91b1ca;
    }
    .research-button:disabled {
        cursor: not-allowed;
        color: #7d878d;
        background: #252a2e;
    }
    .research-section {
        padding-top: 10px;
        margin-top: 10px;
        border-top: 1px solid #4a5157;
    }
    .research-title {
        margin-bottom: 7px;
        color: #d7e2e9;
        font-weight: bold;
    }
    .research-metric {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        padding: 3px 0;
    }
    .research-value {
        text-align: right;
        color: #f0f4f7;
    }
    .research-estimated {
        color: #ffd269;
        font-weight: bold;
    }
    .research-status {
        padding: 7px;
        margin-top: 8px;
        border-radius: 4px;
        background: #222b31;
        color: #bed0dc;
        font-size: 12px;
    }
    .research-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
        color: #f0f4f7;
    }
    .research-table th, .research-table td {
        border-bottom: 1px solid #384148;
        padding: 4px 3px;
        text-align: right;
        color: #f0f4f7;
    }
    .research-table th:first-child, .research-table td:first-child {
        text-align: left;
    }
    .research-details {
        margin-top: 8px;
        color: #aebcc5;
        font-size: 11px;
    }
`;
document.head.appendChild(style);

const panel = document.createElement('div');
panel.className = 'research-panel';
panel.innerHTML = `
    <h2>Volume Research Viewer</h2>
    <div class="research-note">Internal evaluation prototype | whole-object density surface measurement</div>
    <div class="research-row" id="research-objects"></div>
    <div class="research-row" id="research-modes"></div>
    <div class="research-section">
        <div class="research-title" id="research-object-title">Biker</div>
        <div class="research-metric"><span id="research-method-title">Estimated Volume (Scene)</span><span class="research-value research-estimated" id="research-estimate">--</span></div>
        <div class="research-metric"><span>Native Mesh Volume</span><span class="research-value" id="research-native">--</span></div>
        <div class="research-metric"><span>Threshold / Grid</span><span class="research-value" id="research-threshold">--</span></div>
        <div class="research-metric"><span>Components</span><span class="research-value" id="research-components">--</span></div>
        <div class="research-metric"><span>Voxel Baseline</span><span class="research-value" id="research-voxel">--</span></div>
        <div class="research-metric"><span>Collision Mesh Baseline</span><span class="research-value" id="research-collision">--</span></div>
        <div class="research-status" id="research-status">Loading results...</div>
        <details class="research-details">
            <summary>Input and method details</summary>
            <div id="research-details-content"></div>
        </details>
    </div>
    <div class="research-section">
        <div class="research-title">Filled Test Object Validation</div>
        <table class="research-table">
            <thead><tr><th>Object</th><th>Method</th><th>Expected</th><th>Estimated</th><th>Error</th></tr></thead>
            <tbody id="research-test-results"></tbody>
        </table>
        <div class="research-note">Filled test objects calibrate density-derived pseudo-surfaces. Invalid meshes remain visible for diagnosis.</div>
    </div>
    <div class="research-section">
        <div class="research-metric"><span>SuGaR</span><span class="research-value">Unavailable</span></div>
        <div class="research-note">Source scene/checkpoint not provided.</div>
    </div>
`;
document.body.appendChild(panel);

const objectButtonContainer = /** @type {HTMLDivElement} */ (document.getElementById('research-objects'));
const modeButtonContainer = /** @type {HTMLDivElement} */ (document.getElementById('research-modes'));
const objectTitle = /** @type {HTMLDivElement} */ (document.getElementById('research-object-title'));
const methodTitle = /** @type {HTMLSpanElement} */ (document.getElementById('research-method-title'));
const estimateLabel = /** @type {HTMLSpanElement} */ (document.getElementById('research-estimate'));
const nativeLabel = /** @type {HTMLSpanElement} */ (document.getElementById('research-native'));
const thresholdLabel = /** @type {HTMLSpanElement} */ (document.getElementById('research-threshold'));
const componentsLabel = /** @type {HTMLSpanElement} */ (document.getElementById('research-components'));
const voxelLabel = /** @type {HTMLSpanElement} */ (document.getElementById('research-voxel'));
const collisionLabel = /** @type {HTMLSpanElement} */ (document.getElementById('research-collision'));
const statusLabel = /** @type {HTMLDivElement} */ (document.getElementById('research-status'));
const detailsContent = /** @type {HTMLDivElement} */ (document.getElementById('research-details-content'));
const testResults = /** @type {HTMLTableSectionElement} */ (document.getElementById('research-test-results'));

/** @type {Record<string, any>} */
const results = {};
/** @type {Record<string, Promise<pc.Asset>>} */
const meshAssetPromises = {};
/** @type {Record<string, number>} */
const collisionVolumes = {};
let currentObject = 'testSphere';
let currentMode = 'splat';
/** @type {pc.Entity | null} */
let displayedEntity = null;
/** @type {pc.Entity | null} */
let focusEntity = null;
/** @type {pc.Entity | null} */
let camera = null;
let viewRequestId = 0;
let sceneReady = false;

const tempP0 = new pc.Vec3();
const tempP1 = new pc.Vec3();
const tempP2 = new pc.Vec3();
const tempCross = new pc.Vec3();

const calculateMeshVolume = (mesh) => {
    const primitive = mesh.primitive[0];
    if (!primitive || primitive.type !== pc.PRIMITIVE_TRIANGLES) {
        return 0;
    }
    const positions = new Float32Array(mesh.vertexBuffer.numVertices * 3);
    mesh.getPositions(positions);
    const indices = mesh.indexBuffer[0].format === pc.INDEXFORMAT_UINT32 ?
        new Uint32Array(mesh.indexBuffer[0].numIndices) :
        new Uint16Array(mesh.indexBuffer[0].numIndices);
    mesh.getIndices(indices);
    let signedVolume = 0;
    for (let i = primitive.base; i < primitive.base + primitive.count; i += 3) {
        const i0 = indices[i] * 3;
        const i1 = indices[i + 1] * 3;
        const i2 = indices[i + 2] * 3;
        tempP0.set(positions[i0], positions[i0 + 1], positions[i0 + 2]);
        tempP1.set(positions[i1], positions[i1 + 1], positions[i1 + 2]);
        tempP2.set(positions[i2], positions[i2 + 1], positions[i2 + 2]);
        tempCross.cross(tempP1, tempP2);
        signedVolume += tempP0.dot(tempCross) / 6;
    }
    return Math.abs(signedVolume);
};

const calculateCollisionVolume = (name) => {
    if (Number.isFinite(collisionVolumes[name])) {
        return collisionVolumes[name];
    }
    const collisionAsset = assets[`${name}Collision`];
    const entity = collisionAsset.resource.instantiateRenderEntity();
    let volume = 0;
    const renderComponents = entity.findComponents('render');
    for (const renderComponent of renderComponents) {
        for (const meshInstance of renderComponent.meshInstances) {
            volume += calculateMeshVolume(meshInstance.mesh);
        }
    }
    entity.destroy();
    const scale = OBJECTS[name].scale.reduce((product, value) => product * Math.abs(value), 1);
    collisionVolumes[name] = volume * scale;
    return collisionVolumes[name];
};

const loadMeshAsset = (assetPath, name) => {
    const key = `${name}:${assetPath}`;
    if (!meshAssetPromises[key]) {
        meshAssetPromises[key] = new Promise((resolve, reject) => {
            const asset = new pc.Asset(`${name}-${assetPath}-research-mesh`, 'container', {
                url: `${rootPath}/static/assets/${assetPath}`
            });
            asset.ready(() => resolve(asset));
            asset.on('error', reject);
            app.assets.add(asset);
            app.assets.load(asset);
        });
    }
    return meshAssetPromises[key];
};

const applyTransform = (entity, config) => {
    entity.setLocalPosition(...config.position);
    entity.setLocalEulerAngles(...config.rotation);
    entity.setLocalScale(...config.scale);
};

const showObject = () => {
    if (!sceneReady || !focusEntity) {
        return;
    }
    const name = currentObject;
    const mode = currentMode;
    const config = OBJECTS[name];
    const result = results[name];
    const requestId = ++viewRequestId;

    const attach = (entity) => {
        if (requestId !== viewRequestId) {
            entity.destroy();
            return;
        }
        displayedEntity?.destroy();
        displayedEntity = entity;
        applyTransform(entity, config);
        app.root.addChild(entity);
        focusEntity.setLocalPosition(...config.position);
        if (camera?.script?.orbitCamera) {
            camera.script.orbitCamera.focusEntity = focusEntity;
            camera.script.orbitCamera.resetAndLookAtPoint(new pc.Vec3(1.7, 1.2, 3), focusEntity.getPosition());
        }
        updatePanel();
    };

    const method = methodFor(name, mode);
    if (mode !== 'splat' && method?.meshAsset) {
        loadMeshAsset(method.meshAsset, `${name}-${mode}`).then((meshAsset) => {
            attach(meshAsset.resource.instantiateRenderEntity());
        }).catch((error) => {
            if (requestId === viewRequestId) {
                currentMode = 'splat';
                statusLabel.textContent = `Mesh failed to load: ${error.message}`;
                showObject();
            }
        });
        return;
    }

    const entity = new pc.Entity(`${name}-splat`);
    entity.addComponent('gsplat', {
        asset: assets[name],
        castShadows: true
    });
    attach(entity);
};

const methodFor = (name, methodId = currentMode) => results[name]?.methods?.find(method => method.id === methodId);
const viewModesFor = (name) => {
    const modes = [...CORE_VIEW_MODES];
    const sweepMethods = (results[name]?.methods ?? [])
        .filter(method => /^(density-direct|occupancy-sdf)-t\d+$/.test(method.id))
        .sort((a, b) => {
            const methodOrder = a.id.startsWith('density-direct') === b.id.startsWith('density-direct') ? 0 :
                a.id.startsWith('density-direct') ? -1 : 1;
            return methodOrder || ((a.parameters?.isoLevel ?? 999) - (b.parameters?.isoLevel ?? 999));
        })
        .map(method => ({ id: method.id, label: method.label ?? method.id }));
    return modes.concat(sweepMethods);
};
const currentViewLabel = () => viewModesFor(currentObject).find(mode => mode.id === currentMode)?.label ?? currentMode;
const rebuildModeButtons = () => {
    modeButtonContainer.innerHTML = '';
    for (const mode of viewModesFor(currentObject)) {
        const button = document.createElement('button');
        button.className = 'research-button';
        button.textContent = mode.label;
        button.dataset.mode = mode.id;
        button.disabled = true;
        button.onclick = () => {
            currentMode = button.dataset.mode;
            showObject();
        };
        modeButtonContainer.appendChild(button);
    }
};

const updateValidationTable = () => {
    testResults.innerHTML = '';
    for (const name of ['testCube', 'testSphere', 'testCylinder']) {
        const result = results[name];
        for (const methodId of ['density-direct', 'occupancy-sdf']) {
            const method = methodFor(name, methodId);
            const expected = result?.expectedVolume;
            const measured = method?.volumeNative;
            const relativeError = Number.isFinite(measured) && Number.isFinite(expected) ?
                Math.abs(measured - expected) / expected :
                method?.diagnostics?.relativeError;
            const row = document.createElement('tr');
            row.innerHTML = `<td>${OBJECTS[name].label}</td><td>${method?.label ?? methodId}</td><td>${formatVolume(expected)}</td><td>${formatVolume(measured)}</td><td>${formatPercent(relativeError)}</td>`;
            testResults.appendChild(row);
        }
    }
};

function updatePanel() {
    const result = results[currentObject];
    const method = currentMode === 'splat' ? null : methodFor(currentObject);
    const selectedLabel = currentMode === 'splat' ? 'Original Splat' : currentViewLabel();
    const meshAvailable = currentMode === 'splat' || Boolean(method?.meshAsset);
    objectTitle.textContent = OBJECTS[currentObject].label;
    methodTitle.textContent = `${selectedLabel} Volume (Scene)`;
    estimateLabel.textContent = method?.status === 'ready' ?
        `${formatVolume(method.volumeScene)} scene units^3 (Estimated)` :
        '-- (Estimated)';
    nativeLabel.textContent = method?.status === 'ready' ?
        `${formatVolume(method.volumeNative)} native units^3` :
        '--';
    thresholdLabel.textContent = method?.parameters?.isoLevel ?
        `${method.parameters.isoLevel.toFixed(4)} / ${method.parameters.gridResolution}` :
        '--';
    componentsLabel.textContent = Number.isFinite(method?.diagnostics?.componentCount) ?
        `${method.diagnostics.componentCount}` :
        '--';
    voxelLabel.textContent = Number.isFinite(result?.baselines?.voxel?.volumeScene) ?
        `${formatVolume(result.baselines.voxel.volumeScene)} scene units^3` :
        '--';
    collisionLabel.textContent = assets[`${currentObject}Collision`] ?
        `${formatVolume(calculateCollisionVolume(currentObject))} scene units^3` :
        '--';
    const repairText = method?.meshRepair?.applied ?
        ` | sealed boundary loops: ${method.meshRepair.boundaryLoops.join(', ')}` :
        '';
    const statusText = method?.status === 'ready' ?
        `Ready | mesh watertight: ${method.watertight ? 'yes' : 'no'}${repairText}` :
        currentMode === 'splat' ?
            'Original Gaussian splat display' :
            `${method?.status ?? 'missing'} | ${method?.message ?? 'No offline result manifest found.'}`;
    statusLabel.textContent = statusText;
    const allocation = method?.parameters?.uniformSurfaceSampling ? 'uniform surface' : 'visibility weighted';
    detailsContent.textContent = method ?
        method.id === '3dgs-to-pc' ?
            `Input: ${method.cameraSource}; representation: ${result.representation}; point allocation: ${allocation}; renderer: ${method.parameters.rendererType}; SH degree: ${method.parameters.maxShDegree}; Poisson depth: ${method.parameters.poissonDepth}. ${method.meshRepair?.message ?? ''}` :
            `Input: ${method.cameraSource}; representation: ${result.representation}; field: ${method.parameters.field}; threshold: ${method.parameters.isoLevel}; grid: ${method.parameters.gridResolution}; approximation: ${method.parameters.densityApproximation}; components: ${method.diagnostics?.componentCount ?? '--'}. ${method.message ?? ''}` :
        'Original Gaussian splat display.';
    for (const button of modeButtonContainer.querySelectorAll('button')) {
        const targetMode = button.dataset.mode;
        const targetMethod = targetMode === 'splat' ? null : methodFor(currentObject, targetMode);
        button.disabled = targetMode !== 'splat' && !targetMethod?.meshAsset;
        button.classList.toggle('active', button.dataset.mode === currentMode);
    }
    if (!meshAvailable && currentMode !== 'splat') {
        currentMode = 'splat';
        showObject();
        return;
    }
    for (const button of objectButtonContainer.querySelectorAll('button')) {
        button.classList.toggle('active', button.dataset.object === currentObject);
    }
    updateValidationTable();
}

Object.entries(OBJECTS).forEach(([name, config]) => {
    const button = document.createElement('button');
    button.className = 'research-button';
    button.textContent = config.label;
    button.dataset.object = name;
    button.disabled = true;
    button.onclick = () => {
        currentObject = name;
        currentMode = 'splat';
        rebuildModeButtons();
        showObject();
    };
    objectButtonContainer.appendChild(button);
});

rebuildModeButtons();

const loadResults = async () => {
    await Promise.all(Object.keys(OBJECTS).map(async (name) => {
        try {
            const response = await fetch(`${rootPath}/static/assets/volumes/research/${name}.research-volume.json`);
            if (response.ok) {
                results[name] = await response.json();
            }
        } catch (error) {
            console.warn(`Unable to load research result for ${name}`, error);
        }
    }));
};

const assetLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetLoader.load(async () => {
    app.start();
    await loadResults();

    focusEntity = new pc.Entity('ResearchFocus');
    app.root.addChild(focusEntity);

    camera = new pc.Entity('ResearchCamera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.01, 0.01, 0.01),
        toneMapping: pc.TONEMAP_ACES
    });
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity,
            distanceMax: 60,
            frameOnStart: false
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    camera.setLocalPosition(1.7, 1.2, 3);
    app.root.addChild(camera);

    // Keep the diagnostic mesh readable from every angle without flattening its contours.
    app.scene.ambientLight.set(0.28, 0.3, 0.34);

    const keyLight = new pc.Entity('ResearchKeyLight');
    keyLight.addComponent('light', {
        type: 'directional',
        castShadows: true,
        intensity: 0.95,
        color: new pc.Color(1, 1, 1)
    });
    keyLight.setEulerAngles(45, 35, 0);
    app.root.addChild(keyLight);

    const fillLight = new pc.Entity('ResearchFillLight');
    fillLight.addComponent('light', {
        type: 'directional',
        castShadows: false,
        intensity: 0.6,
        color: new pc.Color(1, 1, 1)
    });
    fillLight.setEulerAngles(25, -145, 0);
    app.root.addChild(fillLight);

    const rimLight = new pc.Entity('ResearchRimLight');
    rimLight.addComponent('light', {
        type: 'directional',
        castShadows: false,
        intensity: 0.4,
        color: new pc.Color(1, 1, 1)
    });
    rimLight.setEulerAngles(-50, 155, 0);
    app.root.addChild(rimLight);

    const bottomLight = new pc.Entity('ResearchBottomLight');
    bottomLight.addComponent('light', {
        type: 'directional',
        castShadows: false,
        intensity: 0.45,
        color: new pc.Color(1, 1, 1)
    });
    bottomLight.setEulerAngles(145, 15, 0);
    app.root.addChild(bottomLight);

    sceneReady = true;
    rebuildModeButtons();
    for (const button of objectButtonContainer.querySelectorAll('button')) {
        button.disabled = false;
    }
    for (const button of modeButtonContainer.querySelectorAll('button')) {
        button.disabled = button.dataset.mode !== 'splat';
    }
    showObject();
});

export { app };
