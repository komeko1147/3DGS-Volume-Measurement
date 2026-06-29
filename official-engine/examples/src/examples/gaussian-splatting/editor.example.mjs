// @config DESCRIPTION <span style="color:yellow"><b>Controls:</b> Select button - show selection box | Gizmo - move selection box | Left Mouse Button - orbit </span><br>GSplat editor with AABB selection, deletion, and cloning using GSplatProcessor.
import { data } from 'examples/observer';
import { deviceType, rootPath, localImport } from 'examples/utils';
import * as pc from 'playcanvas';


const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
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

// Initialize control data
data.set('boxSizeX', 0.67);
data.set('boxSizeY', 0.67);
data.set('boxSizeZ', 0.67);
data.set('boxRotationX', 0);
data.set('boxRotationY', 0);
data.set('boxRotationZ', 0);

const assets = {
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    biker: new pc.Asset('biker', 'gsplat', { url: `${rootPath}/static/assets/splats/biker.compressed.ply` }),
    apartment: new pc.Asset('apartment', 'gsplat', { url: `${rootPath}/static/assets/splats/apartment.sog` }),
    testCube: new pc.Asset('testCube', 'gsplat', { url: `${rootPath}/static/assets/splats/testCube.ply` }),
    testSphere: new pc.Asset('testSphere', 'gsplat', { url: `${rootPath}/static/assets/splats/testSphere.ply` }),
    testCylinder: new pc.Asset('testCylinder', 'gsplat', { url: `${rootPath}/static/assets/splats/testCylinder.ply` }),
    surfaceCube: new pc.Asset('surfaceCube', 'gsplat', { url: `${rootPath}/static/assets/splats/surfaceCube.ply` }),
    surfaceSphere: new pc.Asset('surfaceSphere', 'gsplat', { url: `${rootPath}/static/assets/splats/surfaceSphere.ply` }),
    surfaceCylinder: new pc.Asset('surfaceCylinder', 'gsplat', { url: `${rootPath}/static/assets/splats/surfaceCylinder.ply` }),
    surfaceTetrahedron: new pc.Asset('surfaceTetrahedron', 'gsplat', { url: `${rootPath}/static/assets/splats/surfaceTetrahedron.ply` }),
    surfaceCone: new pc.Asset('surfaceCone', 'gsplat', { url: `${rootPath}/static/assets/splats/surfaceCone.ply` }),
    surfaceTorus: new pc.Asset('surfaceTorus', 'gsplat', { url: `${rootPath}/static/assets/splats/surfaceTorus.ply` }),
    surfaceCapsule: new pc.Asset('surfaceCapsule', 'gsplat', { url: `${rootPath}/static/assets/splats/surfaceCapsule.ply` }),
    surfacePyramid: new pc.Asset('surfacePyramid', 'gsplat', { url: `${rootPath}/static/assets/splats/surfacePyramid.ply` }),
    bikerCollision: new pc.Asset('bikerCollision', 'container', { url: `${rootPath}/static/assets/volumes/biker.collision.glb` }),
    apartmentCollision: new pc.Asset('apartmentCollision', 'container', { url: `${rootPath}/static/assets/volumes/apartment.collision.glb` }),
    testCubeCollision: new pc.Asset('testCubeCollision', 'container', { url: `${rootPath}/static/assets/volumes/testCube.collision.glb` }),
    testSphereCollision: new pc.Asset('testSphereCollision', 'container', { url: `${rootPath}/static/assets/volumes/testSphere.collision.glb` }),
    testCylinderCollision: new pc.Asset('testCylinderCollision', 'container', { url: `${rootPath}/static/assets/volumes/testCylinder.collision.glb` }),
    surfaceCubeCollision: new pc.Asset('surfaceCubeCollision', 'container', { url: `${rootPath}/static/assets/volumes/surfaceCube.collision.glb` }),
    surfaceSphereCollision: new pc.Asset('surfaceSphereCollision', 'container', { url: `${rootPath}/static/assets/volumes/surfaceSphere.collision.glb` }),
    surfaceCylinderCollision: new pc.Asset('surfaceCylinderCollision', 'container', { url: `${rootPath}/static/assets/volumes/surfaceCylinder.collision.glb` }),
    surfaceTetrahedronCollision: new pc.Asset('surfaceTetrahedronCollision', 'container', { url: `${rootPath}/static/assets/volumes/surfaceTetrahedron.collision.glb` }),
    surfaceConeCollision: new pc.Asset('surfaceConeCollision', 'container', { url: `${rootPath}/static/assets/volumes/surfaceCone.collision.glb` }),
    surfaceTorusCollision: new pc.Asset('surfaceTorusCollision', 'container', { url: `${rootPath}/static/assets/volumes/surfaceTorus.collision.glb` }),
    surfaceCapsuleCollision: new pc.Asset('surfaceCapsuleCollision', 'container', { url: `${rootPath}/static/assets/volumes/surfaceCapsule.collision.glb` }),
    surfacePyramidCollision: new pc.Asset('surfacePyramidCollision', 'container', { url: `${rootPath}/static/assets/volumes/surfacePyramid.collision.glb` })
};

// Import shader modules
const { workBufferModifier } = await localImport('workbuffer-modifier.mjs');
const { selectionProcessor } = await localImport('selection-processor.mjs');
const { deleteProcessor } = await localImport('delete-processor.mjs');
const { copyProcessor } = await localImport('copy-processor.mjs');

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(async () => {
    app.start();

    data.on('renderer:set', () => {
        app.scene.gsplat.renderer = data.get('renderer');
        const current = app.scene.gsplat.currentRenderer;
        if (current !== data.get('renderer')) {
            setTimeout(() => data.set('renderer', current), 0);
        }
    });
    data.set('renderer', pc.GSPLAT_RENDERER_AUTO);

    // Store all editable gsplat entities
    const editables = [];
    let cloneCounter = 0;
    let activeGizmoEntity = null;
    let currentSceneKey = 'test';
    let defaultBoxCenter = null;
    const meshVolumeCache = new Map();

    // Gizmo will be created after camera
    let gizmoLayer = null;
    let gizmo = null;

    // Selection box state
    let selectionBox = null;
    let selectionBoxVisible = false;
    const selectionBoxEntity = new pc.Entity('SelectionBox');
    app.root.addChild(selectionBoxEntity);
    const selectionBoxState = {
        center: new pc.Vec3(),
        halfExtents: new pc.Vec3(0.335, 0.335, 0.335),
        rotation: new pc.Vec3(),
        mode: 'aabb'
    };

    // MOD: Track and display the AABB volume of the currently selected splats.
    let selectionVolumeLabel = null;
    let selectionBoxSizeLabel = null;
    let selectionBoxModeLabel = null;
    let selectedSplatsAabbLabel = null;
    let selectionCountLabel = null;
    let selectedOccupiedVoxelsLabel = null;
    let selectionEllipsoidVolumeLabel = null;
    let voxelVolumeLabel = null;
    let enclosedVoxelCountLabel = null;
    let enclosedVoxelVolumeLabel = null;
    let enclosedVoxelUpperBoundLabel = null;
    let enclosedVolumeMethodLabel = null;
    let obbEnclosedVoxelVolumeLabel = null;
    let obbEnclosedVoxelCountLabel = null;
    let obbExteriorSurfaceAreaLabel = null;
    let obbExteriorFacesLabel = null;
    let obbMetricsMethodLabel = null;
    let selectedExteriorSurfaceAreaLabel = null;
    let selectedExteriorFacesLabel = null;
    let surfaceAreaMethodLabel = null;
    let visibleEnclosedVoxelLabel = null;
    let voxelOverlayStatusLabel = null;
    let surfaceClosureStatusLabel = null;
    let skippedEllipsoidLabel = null;
    let zeroScaleEllipsoidLabel = null;
    let selectedScaleRangeLabel = null;
    let volumeRefreshPending = false;
    let volumeRefreshQueued = false;
    const lastVolumeBoxCenter = new pc.Vec3(Number.NaN, Number.NaN, Number.NaN);
    const lastVolumeHalfExtents = new pc.Vec3(Number.NaN, Number.NaN, Number.NaN);
    const lastVolumeBoxRotation = new pc.Vec3(Number.NaN, Number.NaN, Number.NaN);
    const ELLIPSOID_SIGMA_RADIUS = 1;
    // MOD: Ground-truth volumes for synthetic analytic test splats.
    const referenceVolumes = {
        testCube: 1.0,
        testSphere: (4 / 3) * Math.PI * Math.pow(0.5, 3),
        testCylinder: Math.PI * Math.pow(0.35, 2),
        surfaceCube: 1.0,
        surfaceSphere: (4 / 3) * Math.PI * Math.pow(0.5, 3),
        surfaceCylinder: Math.PI * Math.pow(0.35, 2),
        surfaceTetrahedron: 1 / 3,
        surfaceCone: (1 / 3) * Math.PI * Math.pow(0.35, 2),
        surfaceTorus: 2 * Math.PI * Math.PI * 0.32 * Math.pow(0.14, 2),
        surfaceCapsule: Math.PI * Math.pow(0.3, 2) * 0.4 + (4 / 3) * Math.PI * Math.pow(0.3, 3),
        surfacePyramid: 1 / 3
    };
    // MOD: Analytic surface areas for synthetic calibration objects. These are
    // references only; selected exterior area still comes from voxel faces.
    const referenceSurfaceAreas = {
        testCube: 6.0,
        testSphere: 4 * Math.PI * Math.pow(0.5, 2),
        testCylinder: 2 * Math.PI * 0.35 * 1 + 2 * Math.PI * Math.pow(0.35, 2),
        surfaceCube: 6.0,
        surfaceSphere: 4 * Math.PI * Math.pow(0.5, 2),
        surfaceCylinder: 2 * Math.PI * 0.35 * 1 + 2 * Math.PI * Math.pow(0.35, 2),
        surfaceTetrahedron: Math.sqrt(3),
        surfaceCone: Math.PI * 0.35 * (0.35 + Math.sqrt(Math.pow(0.35, 2) + Math.pow(1, 2))),
        surfaceTorus: 4 * Math.PI * Math.PI * 0.32 * 0.14,
        surfaceCapsule: 2 * Math.PI * 0.3 * 0.4 + 4 * Math.PI * Math.pow(0.3, 2),
        surfacePyramid: 1 + 2 * Math.sqrt(1.25)
    };
    const sceneConfigs = {
        test: {
            label: 'Test Objects',
            cameraPos: new pc.Vec3(0, 0.85, 4.5),
            focusPos: new pc.Vec3(0, 0.05, 0),
            defaultBoxCenter: new pc.Vec3(-1.6, 0, 0),
            objects: [
                { name: 'testCube', assetKey: 'testCube', position: [-1.6, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
                { name: 'testSphere', assetKey: 'testSphere', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
                { name: 'testCylinder', assetKey: 'testCylinder', position: [1.6, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
            ]
        },
        demo: {
            label: 'Biker/Apartment',
            cameraPos: new pc.Vec3(-0.98, 0.28, -2.31),
            focusPos: new pc.Vec3(-1.10, 0.13, -1.56),
            defaultBoxCenter: new pc.Vec3(-1.695, -0.302, -0.721),
            objects: [
                { name: 'biker1', assetKey: 'biker', position: [-1.9, -0.55, 0.6], rotation: [180, -90, 0], scale: [0.3, 0.3, 0.3] },
                { name: 'biker2', assetKey: 'biker', position: [-3, -0.5, -0.5], rotation: [180, 180, 0], scale: [0.3, 0.3, 0.3] },
                { name: 'apartment', assetKey: 'apartment', position: [0, -0.5, -3], rotation: [180, 0, 0], scale: [0.5, 0.5, 0.5] }
            ]
        },
        surface: {
            label: 'Surface Objects',
            cameraPos: new pc.Vec3(-0.3, 1.4, 8.0),
            focusPos: new pc.Vec3(-0.3, 0, -0.55),
            defaultBoxCenter: new pc.Vec3(-3.3, 0, 0),
            objects: [
                { name: 'surfaceCube', assetKey: 'surfaceCube', position: [-3.3, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], volumeMode: 'surface-enclosed' },
                { name: 'surfaceCubeRotated45', assetKey: 'surfaceCube', voxelProxyName: 'surfaceCube', referenceVolumeName: 'surfaceCube', position: [-1.65, 0, 0], rotation: [0, 45, 0], scale: [1, 1, 1], volumeMode: 'surface-enclosed' },
                { name: 'surfaceSphere', assetKey: 'surfaceSphere', position: [0.05, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], volumeMode: 'surface-enclosed' },
                { name: 'surfaceCylinder', assetKey: 'surfaceCylinder', position: [1.55, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], volumeMode: 'surface-enclosed' },
                { name: 'surfaceTetrahedron', assetKey: 'surfaceTetrahedron', position: [-3.3, 0, -2.15], rotation: [0, 0, 0], scale: [1, 1, 1], volumeMode: 'surface-enclosed' },
                { name: 'surfaceCone', assetKey: 'surfaceCone', position: [-1.65, 0, -2.15], rotation: [0, 0, 0], scale: [1, 1, 1], volumeMode: 'surface-enclosed' },
                { name: 'surfaceTorus', assetKey: 'surfaceTorus', position: [0.05, 0, -2.15], rotation: [0, 0, 0], scale: [1, 1, 1], volumeMode: 'surface-enclosed' },
                { name: 'surfaceCapsule', assetKey: 'surfaceCapsule', position: [1.55, 0, -2.15], rotation: [0, 0, 0], scale: [1, 1, 1], volumeMode: 'surface-enclosed' },
                { name: 'surfacePyramid', assetKey: 'surfacePyramid', position: [3.05, 0, -2.15], rotation: [0, 0, 0], scale: [1, 1, 1], volumeMode: 'surface-enclosed' }
            ]
        }
    };
    defaultBoxCenter = sceneConfigs.test.defaultBoxCenter.clone();
    const LEAF_SIZE = 4;
    const SOLID_LEAF_MASK = 0xFF;
    const SOLID_LEAF_MARKER = 0xFF000000 >>> 0;
    const MAX_VISIBLE_ENCLOSED_SLABS = 12000;
    const MAX_VISIBLE_EXTERIOR_FACES = 12000;
    const EXTERIOR_FACE_OVERLAY_THICKNESS = 0.003;
    const VOXEL_SLAB_MERGE_EPSILON = 1e-6;
    const voxelQueryLocalAabb = new pc.BoundingBox();
    const voxelQueryWorldAabb = new pc.BoundingBox();
    const voxelQueryClippedAabb = new pc.BoundingBox();
    const voxelSelectionMin = new pc.Vec3();
    const voxelSelectionMax = new pc.Vec3();
    const voxelEntityScale = new pc.Vec3();
    const voxelQueryTransform = new pc.Mat4();
    const AXIS_ALIGNED_EPSILON = 1e-5;
    const VOLUME_CLAMP_EPSILON = 1e-9;
    const aabbIntersectionAMin = new pc.Vec3();
    const aabbIntersectionAMax = new pc.Vec3();
    const aabbIntersectionBMin = new pc.Vec3();
    const aabbIntersectionBMax = new pc.Vec3();
    const surfaceFaceLocalAabb = new pc.BoundingBox();
    const surfaceFaceWorldAabb = new pc.BoundingBox();
    const selectionBoxDrawMin = new pc.Vec3();
    const selectionBoxDrawMax = new pc.Vec3();
    const selectionBoxDrawMatrix = new pc.Mat4();
    const selectionBoxDrawRotation = new pc.Quat();
    const selectionBoxDrawScale = new pc.Vec3(1, 1, 1);
    const selectionObbRotation = new pc.Quat();
    const selectionObbAxes = [new pc.Vec3(), new pc.Vec3(), new pc.Vec3()];
    const selectionObbAabbCenterOffset = new pc.Vec3();
    const selectionObbAabbCenter = new pc.Vec3();
    const selectionObbAabbHalfExtents = new pc.Vec3();
    const selectionObbAbsRotation = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
    ];
    const selectionObbPointOffset = new pc.Vec3();
    const selectionObbTempPoint = new pc.Vec3();
    const selectionObbLocalPoint = new pc.Vec3();
    const clipPlaneNormals = [
        new pc.Vec3(1, 0, 0),
        new pc.Vec3(-1, 0, 0),
        new pc.Vec3(0, 1, 0),
        new pc.Vec3(0, -1, 0),
        new pc.Vec3(0, 0, 1),
        new pc.Vec3(0, 0, -1)
    ];
    const surfaceFaceWorldCorners = [new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3()];
    const surfaceFaceLocalCorners = [new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3()];
    const overlayVoxelPosition = new pc.Vec3();
    const overlayVoxelRotation = new pc.Quat();
    const overlayVoxelScale = new pc.Vec3();
    const overlayVoxelMatrix = new pc.Mat4();
    const overlayInstanceFormat = pc.VertexFormat.getDefaultInstancingFormat(device);
    let selectedVoxelOverlayEntity = null;
    let selectedVoxelOverlayMeshInstance = null;
    let selectedVoxelOverlayVertexBuffer = null;
    let selectedExteriorFaceOverlayEntity = null;
    let selectedExteriorFaceOverlayMeshInstance = null;
    let selectedExteriorFaceOverlayVertexBuffer = null;
    // Voxel v1.1 output is already in PlayCanvas coordinates; PLY display data is not.
    const plyVoxelToSplatTransform = new pc.Mat4().setFromEulerAngles(0, 0, 180);

    // Inject CSS styles for UI
    const style = document.createElement('style');
    style.textContent = `
        .gsplat-panel {
            position: absolute; top: 50%; left: 10px; transform: translateY(-50%);
            background: rgba(30, 30, 30, 0.9); border: 1px solid #444; border-radius: 5px;
            padding: 10px; color: white; font-family: Arial, sans-serif; font-size: 12px;
            min-width: 180px; z-index: 1000;
        }
        .gsplat-title { font-weight: bold; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid #555; }
        .gsplat-list { max-height: 300px; overflow-y: auto; }
        .gsplat-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 5px 8px; margin: 2px 0; background: #333; border-radius: 3px; cursor: pointer;
        }
        .gsplat-item.active { background: #446; }
        .gsplat-item span { flex-grow: 1; }
        .gsplat-delete {
            background: #833; border: none; color: white;
            padding: 2px 6px; border-radius: 3px; cursor: pointer; margin-left: 8px;
        }
        .gsplat-scene-row {
            display: flex; gap: 6px; margin-bottom: 10px;
        }
        .gsplat-scene-btn {
            flex: 1;
            background: #2f3a3f;
            border: 1px solid #566;
            color: white;
            padding: 6px 8px;
            border-radius: 4px;
            cursor: pointer;
        }
        .gsplat-scene-btn.active {
            background: #4c6a80;
            border-color: #89a9c2;
        }
    `;
    document.head.appendChild(style);

    // HTML UI for entity list
    const uiPanel = document.createElement('div');
    uiPanel.className = 'gsplat-panel';

    const uiTitle = document.createElement('div');
    uiTitle.textContent = 'GSplat Entities';
    uiTitle.className = 'gsplat-title';
    uiPanel.appendChild(uiTitle);

    const sceneButtonRow = document.createElement('div');
    sceneButtonRow.className = 'gsplat-scene-row';
    uiPanel.appendChild(sceneButtonRow);

    const testSceneButton = document.createElement('button');
    testSceneButton.textContent = 'Test Objects';
    testSceneButton.className = 'gsplat-scene-btn';
    sceneButtonRow.appendChild(testSceneButton);

    const demoSceneButton = document.createElement('button');
    demoSceneButton.textContent = 'Biker/Apartment';
    demoSceneButton.className = 'gsplat-scene-btn';
    sceneButtonRow.appendChild(demoSceneButton);

    const surfaceSceneButton = document.createElement('button');
    surfaceSceneButton.textContent = 'Surface Objects';
    surfaceSceneButton.className = 'gsplat-scene-btn';
    sceneButtonRow.appendChild(surfaceSceneButton);

    const listContainer = document.createElement('div');
    listContainer.className = 'gsplat-list';
    uiPanel.appendChild(listContainer);

    // MOD: Selection metrics area for the selected-splat AABB volume estimate.
    const metricsContainer = document.createElement('div');
    metricsContainer.className = 'gsplat-title';
    metricsContainer.style.marginTop = '10px';
    metricsContainer.style.marginBottom = '0';
    metricsContainer.style.borderBottom = 'none';
    metricsContainer.textContent = 'Selection Metrics';
    uiPanel.appendChild(metricsContainer);

    selectionVolumeLabel = document.createElement('div');
    selectionVolumeLabel.textContent = 'Selection Box Volume (Upper Bound): --';
    uiPanel.appendChild(selectionVolumeLabel);

    selectionBoxSizeLabel = document.createElement('div');
    selectionBoxSizeLabel.textContent = 'Selection Box Size: --';
    uiPanel.appendChild(selectionBoxSizeLabel);

    selectionBoxModeLabel = document.createElement('div');
    selectionBoxModeLabel.textContent = 'Selection Box Mode: --';
    uiPanel.appendChild(selectionBoxModeLabel);

    selectedSplatsAabbLabel = document.createElement('div');
    selectedSplatsAabbLabel.textContent = 'Selected Splats AABB Volume: --';
    uiPanel.appendChild(selectedSplatsAabbLabel);

    selectionCountLabel = document.createElement('div');
    selectionCountLabel.textContent = 'Selected Ellipsoids: --';
    uiPanel.appendChild(selectionCountLabel);

    // MOD: Show the number of occupied voxels hit by the current selection box.
    selectedOccupiedVoxelsLabel = document.createElement('div');
    selectedOccupiedVoxelsLabel.textContent = 'Selected Occupied Voxels: --';
    uiPanel.appendChild(selectedOccupiedVoxelsLabel);

    // MOD: Display occupied voxel volume for the current selection box.
    voxelVolumeLabel = document.createElement('div');
    voxelVolumeLabel.textContent = 'Occupied Voxel Volume: --';
    uiPanel.appendChild(voxelVolumeLabel);

    enclosedVoxelCountLabel = document.createElement('div');
    enclosedVoxelCountLabel.textContent = 'Enclosed Voxels: --';
    uiPanel.appendChild(enclosedVoxelCountLabel);

    enclosedVoxelVolumeLabel = document.createElement('div');
    enclosedVoxelVolumeLabel.textContent = 'Enclosed Voxel Volume: --';
    uiPanel.appendChild(enclosedVoxelVolumeLabel);

    enclosedVoxelUpperBoundLabel = document.createElement('div');
    enclosedVoxelUpperBoundLabel.textContent = 'Enclosed Voxel Upper Bound: --';
    uiPanel.appendChild(enclosedVoxelUpperBoundLabel);

    enclosedVolumeMethodLabel = document.createElement('div');
    enclosedVolumeMethodLabel.textContent = 'Enclosed Volume Method: --';
    uiPanel.appendChild(enclosedVolumeMethodLabel);

    obbEnclosedVoxelVolumeLabel = document.createElement('div');
    obbEnclosedVoxelVolumeLabel.textContent = 'OBB Enclosed Voxel Volume: --';
    uiPanel.appendChild(obbEnclosedVoxelVolumeLabel);

    obbEnclosedVoxelCountLabel = document.createElement('div');
    obbEnclosedVoxelCountLabel.textContent = 'OBB Enclosed Voxels: --';
    uiPanel.appendChild(obbEnclosedVoxelCountLabel);

    obbExteriorSurfaceAreaLabel = document.createElement('div');
    obbExteriorSurfaceAreaLabel.textContent = 'OBB Exterior Surface Area: --';
    uiPanel.appendChild(obbExteriorSurfaceAreaLabel);

    obbExteriorFacesLabel = document.createElement('div');
    obbExteriorFacesLabel.textContent = 'OBB Exterior Faces: --';
    uiPanel.appendChild(obbExteriorFacesLabel);

    obbMetricsMethodLabel = document.createElement('div');
    obbMetricsMethodLabel.textContent = 'OBB Metrics Method: --';
    uiPanel.appendChild(obbMetricsMethodLabel);

    selectedExteriorSurfaceAreaLabel = document.createElement('div');
    selectedExteriorSurfaceAreaLabel.textContent = 'Selected Exterior Surface Area: --';
    uiPanel.appendChild(selectedExteriorSurfaceAreaLabel);

    selectedExteriorFacesLabel = document.createElement('div');
    selectedExteriorFacesLabel.textContent = 'Selected Exterior Faces: --';
    uiPanel.appendChild(selectedExteriorFacesLabel);

    surfaceAreaMethodLabel = document.createElement('div');
    surfaceAreaMethodLabel.textContent = 'Surface Area Method: --';
    uiPanel.appendChild(surfaceAreaMethodLabel);

    visibleEnclosedVoxelLabel = document.createElement('div');
    visibleEnclosedVoxelLabel.textContent = 'Visible Voxel Slabs: --';
    uiPanel.appendChild(visibleEnclosedVoxelLabel);

    voxelOverlayStatusLabel = document.createElement('div');
    voxelOverlayStatusLabel.textContent = 'Voxel Overlay: --';
    uiPanel.appendChild(voxelOverlayStatusLabel);

    surfaceClosureStatusLabel = document.createElement('div');
    surfaceClosureStatusLabel.textContent = 'Surface Closure Status: --';
    uiPanel.appendChild(surfaceClosureStatusLabel);

    selectionEllipsoidVolumeLabel = document.createElement('div');
    selectionEllipsoidVolumeLabel.textContent = `Ellipsoid Volume Sum (${ELLIPSOID_SIGMA_RADIUS}sigma): --`;
    uiPanel.appendChild(selectionEllipsoidVolumeLabel);

    // MOD: Show how many selected gaussians were skipped during volume accumulation.
    skippedEllipsoidLabel = document.createElement('div');
    skippedEllipsoidLabel.textContent = 'Skipped Ellipsoids: --';
    uiPanel.appendChild(skippedEllipsoidLabel);

    // MOD: Show whether selected gaussians contain zero-valued scale axes.
    zeroScaleEllipsoidLabel = document.createElement('div');
    zeroScaleEllipsoidLabel.textContent = 'Zero-Scale Ellipsoids: --';
    uiPanel.appendChild(zeroScaleEllipsoidLabel);

    // MOD: Show decoded scale range for the current selection to debug scale extraction.
    selectedScaleRangeLabel = document.createElement('div');
    selectedScaleRangeLabel.textContent = 'Selected Scale Range: --';
    uiPanel.appendChild(selectedScaleRangeLabel);

    document.body.appendChild(uiPanel);

    const selectedVoxelOverlayLayer = new pc.Layer({ name: 'Selected Enclosed Voxel Overlay' });
    const worldLayer = app.scene.layers.getLayerByName('World');
    if (worldLayer) {
        app.scene.layers.insertTransparent(
            selectedVoxelOverlayLayer,
            app.scene.layers.getTransparentIndex(worldLayer) + 1
        );
    } else {
        app.scene.layers.push(selectedVoxelOverlayLayer);
    }

    const createSelectedVoxelOverlay = () => {
        const createOverlayMaterial = (emissive, opacity, intensity) => {
            const material = new pc.StandardMaterial();
            material.diffuse = new pc.Color(0, 0, 0);
            material.emissive = emissive;
            material.emissiveIntensity = intensity;
            material.useLighting = false;
            material.opacity = opacity;
            material.blendType = pc.BLEND_NORMAL;
            material.depthWrite = false;
            material.opacityFadesSpecular = false;
            material.update();
            return material;
        };

        const mesh = pc.Mesh.fromGeometry(device, new pc.BoxGeometry());
        const material = createOverlayMaterial(new pc.Color(0.0, 1.0, 0.82), 0.50, 1.25);
        selectedVoxelOverlayMeshInstance = new pc.MeshInstance(mesh, material);
        selectedVoxelOverlayMeshInstance.pick = false;
        selectedVoxelOverlayMeshInstance.cull = false;
        selectedVoxelOverlayMeshInstance.drawOrder = 10000;

        selectedVoxelOverlayEntity = new pc.Entity('SelectedEnclosedVoxelOverlay');
        selectedVoxelOverlayEntity.addComponent('render', {
            meshInstances: [selectedVoxelOverlayMeshInstance],
            layers: [selectedVoxelOverlayLayer.id]
        });
        selectedVoxelOverlayEntity.enabled = false;
        app.root.addChild(selectedVoxelOverlayEntity);

        const exteriorFaceMaterial = createOverlayMaterial(new pc.Color(1.0, 0.05, 0.78), 0.82, 1.55);
        selectedExteriorFaceOverlayMeshInstance = new pc.MeshInstance(mesh, exteriorFaceMaterial);
        selectedExteriorFaceOverlayMeshInstance.pick = false;
        selectedExteriorFaceOverlayMeshInstance.cull = false;
        selectedExteriorFaceOverlayMeshInstance.drawOrder = 10001;

        selectedExteriorFaceOverlayEntity = new pc.Entity('SelectedExteriorFaceOverlay');
        selectedExteriorFaceOverlayEntity.addComponent('render', {
            meshInstances: [selectedExteriorFaceOverlayMeshInstance],
            layers: [selectedVoxelOverlayLayer.id]
        });
        selectedExteriorFaceOverlayEntity.enabled = false;
        app.root.addChild(selectedExteriorFaceOverlayEntity);
    };

    const clearSelectedEnclosedVoxelOverlay = () => {
        if (selectedVoxelOverlayMeshInstance) {
            selectedVoxelOverlayMeshInstance.setInstancing(null);
        }
        if (selectedExteriorFaceOverlayMeshInstance) {
            selectedExteriorFaceOverlayMeshInstance.setInstancing(null);
        }
        selectedVoxelOverlayVertexBuffer?.destroy();
        selectedVoxelOverlayVertexBuffer = null;
        selectedExteriorFaceOverlayVertexBuffer?.destroy();
        selectedExteriorFaceOverlayVertexBuffer = null;
        if (selectedVoxelOverlayEntity) {
            selectedVoxelOverlayEntity.enabled = false;
        }
        if (selectedExteriorFaceOverlayEntity) {
            selectedExteriorFaceOverlayEntity.enabled = false;
        }
        if (visibleEnclosedVoxelLabel) {
            visibleEnclosedVoxelLabel.textContent = 'Visible Voxel Slabs: --';
        }
        if (voxelOverlayStatusLabel) {
            voxelOverlayStatusLabel.textContent = 'Voxel Overlay: off';
        }
    };

    const clearSelectedEnclosedVoxelOverlayOnly = () => {
        if (selectedVoxelOverlayMeshInstance) {
            selectedVoxelOverlayMeshInstance.setInstancing(null);
        }
        selectedVoxelOverlayVertexBuffer?.destroy();
        selectedVoxelOverlayVertexBuffer = null;
        if (selectedVoxelOverlayEntity) {
            selectedVoxelOverlayEntity.enabled = false;
        }
    };

    const clearSelectedExteriorFaceOverlayOnly = () => {
        if (selectedExteriorFaceOverlayMeshInstance) {
            selectedExteriorFaceOverlayMeshInstance.setInstancing(null);
        }
        selectedExteriorFaceOverlayVertexBuffer?.destroy();
        selectedExteriorFaceOverlayVertexBuffer = null;
        if (selectedExteriorFaceOverlayEntity) {
            selectedExteriorFaceOverlayEntity.enabled = false;
        }
    };

    createSelectedVoxelOverlay();

    // Show/hide gizmo for an entity
    const showGizmoFor = (entity) => {
        if (activeGizmoEntity) {
            gizmo.detach();
        }
        activeGizmoEntity = entity;
        if (entity) {
            gizmo.attach(entity);
        }
        updateEntityList();
    };

    // Remove entity from scene
    const removeEntity = (editable) => {
        showGizmoFor(null);

        // Cleanup processors
        editable.selectionProcessor?.destroy();
        editable.deleteProcessor?.destroy();

        // Remove from editables
        const idx = editables.indexOf(editable);
        if (idx !== -1) {
            editables.splice(idx, 1);
        }

        // Destroy entity
        editable.entity.destroy();

        updateEntityList();
        if (selectionBoxVisible) {
            requestSelectedAabbVolumeUpdate();
        }
    };

    function updateEntityList() {
        listContainer.innerHTML = '';

        for (const editable of editables) {
            const item = document.createElement('div');
            item.className = activeGizmoEntity === editable.entity ? 'gsplat-item active' : 'gsplat-item';

            const nameSpan = document.createElement('span');
            const totalMeshVolume = editable.collisionMeshVolume;
            const referenceVolume = editable.referenceVolume;
            const referenceSurfaceArea = editable.referenceSurfaceArea;
            const metrics = [];

            if (Number.isFinite(referenceVolume)) {
                metrics.push(`truth ${formatMetricVolume(referenceVolume)} u^3`);
            }

            if (Number.isFinite(referenceSurfaceArea)) {
                metrics.push(`truth area ${formatMetricVolume(referenceSurfaceArea)} u^2`);
            }

            if (Number.isFinite(totalMeshVolume)) {
                metrics.push(`mesh ${formatMetricVolume(totalMeshVolume)} u^3`);
            } else {
                metrics.push('mesh --');
            }

            nameSpan.textContent = `${editable.entity.name} (${metrics.join(' | ')})`;
            nameSpan.onclick = () => showGizmoFor(editable.entity);
            item.appendChild(nameSpan);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'X';
            deleteBtn.className = 'gsplat-delete';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                removeEntity(editable);
            };
            item.appendChild(deleteBtn);

            listContainer.appendChild(item);
        }
    }

    const updateSceneButtons = () => {
        testSceneButton.classList.toggle('active', currentSceneKey === 'test');
        demoSceneButton.classList.toggle('active', currentSceneKey === 'demo');
        surfaceSceneButton.classList.toggle('active', currentSceneKey === 'surface');
    };

    const getBoxSizeValue = (key) => {
        const value = data.get(key);
        return Number.isFinite(value) && value > 0 ? value : 0.67;
    };

    const updateSelectionBoxStateFromData = () => {
        selectionBoxState.halfExtents.set(
            getBoxSizeValue('boxSizeX') * 0.5,
            getBoxSizeValue('boxSizeY') * 0.5,
            getBoxSizeValue('boxSizeZ') * 0.5
        );
        selectionBoxState.rotation.set(
            Number.isFinite(data.get('boxRotationX')) ? data.get('boxRotationX') : 0,
            Number.isFinite(data.get('boxRotationY')) ? data.get('boxRotationY') : 0,
            Number.isFinite(data.get('boxRotationZ')) ? data.get('boxRotationZ') : 0
        );
        selectionBoxState.mode = isSelectionBoxAxisAligned() ? 'aabb' : 'obb';

        if (selectionBox) {
            selectionBox.halfExtents.copy(selectionBoxState.halfExtents);
        }
        selectionBoxEntity.setLocalEulerAngles(
            selectionBoxState.rotation.x,
            selectionBoxState.rotation.y,
            selectionBoxState.rotation.z
        );
    };

    const isSelectionBoxAxisAligned = () => (
        Math.abs(selectionBoxState.rotation.x) <= AXIS_ALIGNED_EPSILON &&
        Math.abs(selectionBoxState.rotation.y) <= AXIS_ALIGNED_EPSILON &&
        Math.abs(selectionBoxState.rotation.z) <= AXIS_ALIGNED_EPSILON
    );

    const getSelectionBoxCalculationModeLabel = () => (
        isSelectionBoxAxisAligned() ? 'aabb exact' : 'obb clipped metrics / aabb splats'
    );

    const updateSelectionObbAxes = () => {
        selectionObbRotation.setFromEulerAngles(
            selectionBoxState.rotation.x,
            selectionBoxState.rotation.y,
            selectionBoxState.rotation.z
        );
        selectionObbAxes[0].set(1, 0, 0);
        selectionObbAxes[1].set(0, 1, 0);
        selectionObbAxes[2].set(0, 0, 1);
        selectionObbRotation.transformVector(selectionObbAxes[0], selectionObbAxes[0]);
        selectionObbRotation.transformVector(selectionObbAxes[1], selectionObbAxes[1]);
        selectionObbRotation.transformVector(selectionObbAxes[2], selectionObbAxes[2]);
    };

    const obbIntersectsWorldAabb = (aabb) => {
        updateSelectionObbAxes();
        selectionObbAabbCenter.copy(aabb.center);
        selectionObbAabbHalfExtents.copy(aabb.halfExtents);
        selectionObbAabbCenterOffset.sub2(selectionObbAabbCenter, selectionBoxState.center);

        const aHalf = [
            selectionBoxState.halfExtents.x,
            selectionBoxState.halfExtents.y,
            selectionBoxState.halfExtents.z
        ];
        const bHalf = [
            selectionObbAabbHalfExtents.x,
            selectionObbAabbHalfExtents.y,
            selectionObbAabbHalfExtents.z
        ];
        const t = [
            selectionObbAabbCenterOffset.dot(selectionObbAxes[0]),
            selectionObbAabbCenterOffset.dot(selectionObbAxes[1]),
            selectionObbAabbCenterOffset.dot(selectionObbAxes[2])
        ];
        const r = [
            [selectionObbAxes[0].x, selectionObbAxes[0].y, selectionObbAxes[0].z],
            [selectionObbAxes[1].x, selectionObbAxes[1].y, selectionObbAxes[1].z],
            [selectionObbAxes[2].x, selectionObbAxes[2].y, selectionObbAxes[2].z]
        ];
        const epsilon = 1e-6;

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                selectionObbAbsRotation[i][j] = Math.abs(r[i][j]) + epsilon;
            }
        }

        for (let i = 0; i < 3; i++) {
            const radiusA = aHalf[i];
            const radiusB = bHalf[0] * selectionObbAbsRotation[i][0] +
                bHalf[1] * selectionObbAbsRotation[i][1] +
                bHalf[2] * selectionObbAbsRotation[i][2];
            if (Math.abs(t[i]) > radiusA + radiusB) {
                return false;
            }
        }

        for (let j = 0; j < 3; j++) {
            const radiusA = aHalf[0] * selectionObbAbsRotation[0][j] +
                aHalf[1] * selectionObbAbsRotation[1][j] +
                aHalf[2] * selectionObbAbsRotation[2][j];
            const radiusB = bHalf[j];
            const distance = Math.abs(t[0] * r[0][j] + t[1] * r[1][j] + t[2] * r[2][j]);
            if (distance > radiusA + radiusB) {
                return false;
            }
        }

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const radiusA = aHalf[(i + 1) % 3] * selectionObbAbsRotation[(i + 2) % 3][j] +
                    aHalf[(i + 2) % 3] * selectionObbAbsRotation[(i + 1) % 3][j];
                const radiusB = bHalf[(j + 1) % 3] * selectionObbAbsRotation[i][(j + 2) % 3] +
                    bHalf[(j + 2) % 3] * selectionObbAbsRotation[i][(j + 1) % 3];
                const distance = Math.abs(t[(i + 2) % 3] * r[(i + 1) % 3][j] -
                    t[(i + 1) % 3] * r[(i + 2) % 3][j]);
                if (distance > radiusA + radiusB) {
                    return false;
                }
            }
        }

        return true;
    };

    const worldPointToSelectionBoxLocal = (point, result) => {
        updateSelectionObbAxes();
        selectionObbPointOffset.sub2(point, selectionBoxState.center);
        result.set(
            selectionObbPointOffset.dot(selectionObbAxes[0]),
            selectionObbPointOffset.dot(selectionObbAxes[1]),
            selectionObbPointOffset.dot(selectionObbAxes[2])
        );
        return result;
    };

    const isSelectionLocalPointInside = (point, epsilon = 1e-8) => (
        point.x >= -selectionBoxState.halfExtents.x - epsilon &&
        point.x <= selectionBoxState.halfExtents.x + epsilon &&
        point.y >= -selectionBoxState.halfExtents.y - epsilon &&
        point.y <= selectionBoxState.halfExtents.y + epsilon &&
        point.z >= -selectionBoxState.halfExtents.z - epsilon &&
        point.z <= selectionBoxState.halfExtents.z + epsilon
    );

    const getSelectionLocalAxisValue = (point, axis) => axis === 0 ? point.x : (axis === 1 ? point.y : point.z);

    const setSelectionLocalAxisValue = (point, axis, value) => {
        if (axis === 0) {
            point.x = value;
        } else if (axis === 1) {
            point.y = value;
        } else {
            point.z = value;
        }
    };

    const clipPolygonByAxisPlane = (points, axis, limit, keepLessEqual) => {
        if (points.length === 0) {
            return [];
        }

        const clipped = [];
        for (let i = 0; i < points.length; i++) {
            const current = points[i];
            const previous = points[(i + points.length - 1) % points.length];
            const currentDistance = getSelectionLocalAxisValue(current, axis) - limit;
            const previousDistance = getSelectionLocalAxisValue(previous, axis) - limit;
            const currentInside = keepLessEqual ? currentDistance <= 1e-8 : currentDistance >= -1e-8;
            const previousInside = keepLessEqual ? previousDistance <= 1e-8 : previousDistance >= -1e-8;

            if (currentInside !== previousInside) {
                const t = previousDistance / (previousDistance - currentDistance);
                const intersection = new pc.Vec3().lerp(previous, current, t);
                setSelectionLocalAxisValue(intersection, axis, limit);
                clipped.push(intersection);
            }
            if (currentInside) {
                clipped.push(current.clone());
            }
        }

        return clipped;
    };

    const clipPolygonBySelectionAabb = (points) => {
        let clipped = points.map(point => point.clone());
        clipped = clipPolygonByAxisPlane(clipped, 0, selectionBoxState.halfExtents.x, true);
        clipped = clipPolygonByAxisPlane(clipped, 0, -selectionBoxState.halfExtents.x, false);
        clipped = clipPolygonByAxisPlane(clipped, 1, selectionBoxState.halfExtents.y, true);
        clipped = clipPolygonByAxisPlane(clipped, 1, -selectionBoxState.halfExtents.y, false);
        clipped = clipPolygonByAxisPlane(clipped, 2, selectionBoxState.halfExtents.z, true);
        clipped = clipPolygonByAxisPlane(clipped, 2, -selectionBoxState.halfExtents.z, false);
        return clipped;
    };

    const computePolygonArea = (points) => {
        if (points.length < 3) {
            return 0;
        }

        const areaVector = new pc.Vec3();
        const edgeCross = new pc.Vec3();
        for (let i = 0; i < points.length; i++) {
            const current = points[i];
            const next = points[(i + 1) % points.length];
            edgeCross.cross(current, next);
            areaVector.add(edgeCross);
        }
        return areaVector.length() * 0.5;
    };

    const getWorldAabbCornersInSelectionLocal = (aabb) => {
        const min = getAabbMin(aabb, aabbIntersectionAMin);
        const max = getAabbMax(aabb, aabbIntersectionAMax);
        const corners = [];
        for (const x of [min.x, max.x]) {
            for (const y of [min.y, max.y]) {
                for (const z of [min.z, max.z]) {
                    selectionObbTempPoint.set(x, y, z);
                    corners.push(worldPointToSelectionBoxLocal(selectionObbTempPoint, new pc.Vec3()).clone());
                }
            }
        }
        return corners;
    };

    const isWorldAabbFullyInsideSelectionObb = (aabb) => {
        const corners = getWorldAabbCornersInSelectionLocal(aabb);
        return corners.every(corner => isSelectionLocalPointInside(corner));
    };

    const makePolyhedronFromWorldAabb = (aabb) => {
        const min = getAabbMin(aabb, aabbIntersectionAMin);
        const max = getAabbMax(aabb, aabbIntersectionAMax);
        const worldCorners = [
            [min.x, min.y, min.z],
            [max.x, min.y, min.z],
            [max.x, max.y, min.z],
            [min.x, max.y, min.z],
            [min.x, min.y, max.z],
            [max.x, min.y, max.z],
            [max.x, max.y, max.z],
            [min.x, max.y, max.z]
        ];
        const vertices = worldCorners.map(([x, y, z]) => {
            selectionObbTempPoint.set(x, y, z);
            return worldPointToSelectionBoxLocal(selectionObbTempPoint, new pc.Vec3()).clone();
        });
        return [
            [vertices[0], vertices[3], vertices[2], vertices[1]],
            [vertices[4], vertices[5], vertices[6], vertices[7]],
            [vertices[0], vertices[1], vertices[5], vertices[4]],
            [vertices[3], vertices[7], vertices[6], vertices[2]],
            [vertices[0], vertices[4], vertices[7], vertices[3]],
            [vertices[1], vertices[2], vertices[6], vertices[5]]
        ];
    };

    const addClipCapFace = (faces, points, axis, limit, keepLessEqual) => {
        const unique = [];
        for (const point of points) {
            if (Math.abs(getSelectionLocalAxisValue(point, axis) - limit) > 1e-6) {
                continue;
            }
            if (!unique.some(existing =>
                Math.abs(existing.x - point.x) < 1e-6 &&
                Math.abs(existing.y - point.y) < 1e-6 &&
                Math.abs(existing.z - point.z) < 1e-6)) {
                unique.push(point.clone());
            }
        }
        if (unique.length < 3) {
            return;
        }

        const center = new pc.Vec3();
        for (const point of unique) {
            center.add(point);
        }
        center.mulScalar(1 / unique.length);

        const normal = clipPlaneNormals[axis * 2 + (keepLessEqual ? 0 : 1)];
        const ref = Math.abs(normal.x) < 0.9 ? new pc.Vec3(1, 0, 0) : new pc.Vec3(0, 1, 0);
        const tangent = new pc.Vec3().cross(ref, normal).normalize();
        const bitangent = new pc.Vec3().cross(normal, tangent).normalize();
        unique.sort((a, b) => {
            const da = new pc.Vec3().sub2(a, center);
            const db = new pc.Vec3().sub2(b, center);
            return Math.atan2(da.dot(bitangent), da.dot(tangent)) -
                Math.atan2(db.dot(bitangent), db.dot(tangent));
        });
        faces.push(keepLessEqual ? unique : unique.reverse());
    };

    const clipPolyhedronByAxisPlane = (faces, axis, limit, keepLessEqual) => {
        const clippedFaces = [];
        const capPoints = [];
        for (const face of faces) {
            const clipped = clipPolygonByAxisPlane(face, axis, limit, keepLessEqual);
            if (clipped.length >= 3) {
                clippedFaces.push(clipped);
                for (const point of clipped) {
                    capPoints.push(point);
                }
            }
        }
        addClipCapFace(clippedFaces, capPoints, axis, limit, keepLessEqual);
        return clippedFaces;
    };

    const clipPolyhedronBySelectionAabb = (faces) => {
        let clipped = faces;
        clipped = clipPolyhedronByAxisPlane(clipped, 0, selectionBoxState.halfExtents.x, true);
        clipped = clipPolyhedronByAxisPlane(clipped, 0, -selectionBoxState.halfExtents.x, false);
        clipped = clipPolyhedronByAxisPlane(clipped, 1, selectionBoxState.halfExtents.y, true);
        clipped = clipPolyhedronByAxisPlane(clipped, 1, -selectionBoxState.halfExtents.y, false);
        clipped = clipPolyhedronByAxisPlane(clipped, 2, selectionBoxState.halfExtents.z, true);
        clipped = clipPolyhedronByAxisPlane(clipped, 2, -selectionBoxState.halfExtents.z, false);
        return clipped;
    };

    const computeConvexPolyhedronVolume = (faces) => {
        const unique = [];
        for (const face of faces) {
            for (const point of face) {
                if (!unique.some(existing =>
                    Math.abs(existing.x - point.x) < 1e-6 &&
                    Math.abs(existing.y - point.y) < 1e-6 &&
                    Math.abs(existing.z - point.z) < 1e-6)) {
                    unique.push(point);
                }
            }
        }
        if (unique.length < 4) {
            return 0;
        }

        const center = new pc.Vec3();
        for (const point of unique) {
            center.add(point);
        }
        center.mulScalar(1 / unique.length);

        const hullFaces = [];
        const hullPlaneEpsilon = 1e-6;
        const hullNormalEpsilon = 1e-5;
        const normal = new pc.Vec3();
        const edgeA = new pc.Vec3();
        const edgeB = new pc.Vec3();

        for (let i = 0; i < unique.length - 2; i++) {
            for (let j = i + 1; j < unique.length - 1; j++) {
                for (let k = j + 1; k < unique.length; k++) {
                    edgeA.sub2(unique[j], unique[i]);
                    edgeB.sub2(unique[k], unique[i]);
                    normal.cross(edgeA, edgeB);
                    const normalLength = normal.length();
                    if (normalLength < hullPlaneEpsilon) {
                        continue;
                    }
                    normal.mulScalar(1 / normalLength);
                    let minDistance = 0;
                    let maxDistance = 0;
                    for (const point of unique) {
                        const distance = normal.dot(point) - normal.dot(unique[i]);
                        minDistance = Math.min(minDistance, distance);
                        maxDistance = Math.max(maxDistance, distance);
                    }
                    if (minDistance < -hullPlaneEpsilon && maxDistance > hullPlaneEpsilon) {
                        continue;
                    }

                    const planeNormal = normal.clone();
                    let planeD = -planeNormal.dot(unique[i]);
                    if (planeNormal.dot(center) + planeD > 0) {
                        planeNormal.mulScalar(-1);
                        planeD *= -1;
                    }

                    const duplicate = hullFaces.some(face =>
                        Math.abs(face.normal.x - planeNormal.x) < hullNormalEpsilon &&
                        Math.abs(face.normal.y - planeNormal.y) < hullNormalEpsilon &&
                        Math.abs(face.normal.z - planeNormal.z) < hullNormalEpsilon &&
                        Math.abs(face.d - planeD) < hullNormalEpsilon);
                    if (duplicate) {
                        continue;
                    }

                    const facePoints = unique
                    .filter(point => Math.abs(planeNormal.dot(point) + planeD) < hullNormalEpsilon)
                    .map(point => point.clone());
                    if (facePoints.length >= 3) {
                        hullFaces.push({
                            normal: planeNormal,
                            d: planeD,
                            points: facePoints
                        });
                    }
                }
            }
        }

        let volume = 0;
        const cross = new pc.Vec3();
        const faceCenter = new pc.Vec3();
        const tangent = new pc.Vec3();
        const bitangent = new pc.Vec3();
        const ref = new pc.Vec3();
        const delta = new pc.Vec3();
        for (const face of hullFaces) {
            if (face.points.length < 3) {
                continue;
            }
            faceCenter.set(0, 0, 0);
            for (const point of face.points) {
                faceCenter.add(point);
            }
            faceCenter.mulScalar(1 / face.points.length);

            ref.set(Math.abs(face.normal.x) < 0.9 ? 1 : 0, Math.abs(face.normal.x) < 0.9 ? 0 : 1, 0);
            tangent.cross(ref, face.normal).normalize();
            bitangent.cross(face.normal, tangent).normalize();
            face.points.sort((a, b) => {
                delta.sub2(a, faceCenter);
                const angleA = Math.atan2(delta.dot(bitangent), delta.dot(tangent));
                delta.sub2(b, faceCenter);
                const angleB = Math.atan2(delta.dot(bitangent), delta.dot(tangent));
                return angleA - angleB;
            });

            const first = face.points[0];
            for (let i = 1; i + 1 < face.points.length; i++) {
                edgeA.sub2(first, center);
                edgeB.sub2(face.points[i], center);
                cross.cross(edgeA, edgeB);
                edgeA.sub2(face.points[i + 1], center);
                volume += Math.abs(edgeA.dot(cross)) / 6;
            }
        }
        return volume;
    };

    const drawSelectionBoxWire = () => {
        if (!selectionBox || !selectionBoxVisible) {
            return;
        }

        if (isSelectionBoxAxisAligned()) {
            app.drawWireAlignedBox(selectionBox.getMin(), selectionBox.getMax(), pc.Color.YELLOW);
            return;
        }

        selectionBoxDrawMin.set(
            -selectionBox.halfExtents.x,
            -selectionBox.halfExtents.y,
            -selectionBox.halfExtents.z
        );
        selectionBoxDrawMax.copy(selectionBox.halfExtents);
        selectionBoxDrawRotation.setFromEulerAngles(
            selectionBoxState.rotation.x,
            selectionBoxState.rotation.y,
            selectionBoxState.rotation.z
        );
        selectionBoxDrawMatrix.setTRS(selectionBox.center, selectionBoxDrawRotation, selectionBoxDrawScale);
        app.drawWireAlignedBox(selectionBoxDrawMin, selectionBoxDrawMax, pc.Color.YELLOW, true, undefined, selectionBoxDrawMatrix);
        app.drawWireAlignedBox(selectionBox.getMin(), selectionBox.getMax(), new pc.Color(1, 0.55, 0));
    };

    const destroyAllEditables = () => {
        while (editables.length > 0) {
            removeEntity(editables[0]);
        }
    };

    // Sets up textures, creates processors, and sets work buffer modifier
    // Assumes extra streams already exist on the format
    // Returns { selectionProcessor, deleteProcessor }
    const setupEditableProcessors = (gsplatComponent) => {
        // Initialize splatVisible: all visible (255)
        const visibleTexture = gsplatComponent.getInstanceTexture('splatVisible');
        const visibleData = new Uint8Array(visibleTexture.width * visibleTexture.height);
        visibleData.fill(255);
        visibleTexture.lock().set(visibleData);
        visibleTexture.unlock();

        // Initialize splatSelection: none selected (0)
        const selectionTexture = gsplatComponent.getInstanceTexture('splatSelection');
        const selectionData = new Uint8Array(selectionTexture.width * selectionTexture.height);
        selectionData.fill(0);
        selectionTexture.lock().set(selectionData);
        selectionTexture.unlock();

        // Create processors
        const selectionProc = new pc.GSplatProcessor(
            device,
            { component: gsplatComponent },
            { component: gsplatComponent, streams: ['splatSelection'] },
            selectionProcessor
        );

        const deleteProc = new pc.GSplatProcessor(
            device,
            { component: gsplatComponent },
            { component: gsplatComponent, streams: ['splatVisible'] },
            deleteProcessor
        );

        // Set work buffer modifier
        gsplatComponent.setWorkBufferModifier(workBufferModifier);

        return { selectionProcessor: selectionProc, deleteProcessor: deleteProc };
    };

    // MOD: Match the renderer's decoded scale semantics across different gsplat formats.
    // Uncompressed data already returns actual scales, while compressed/sog iterators return log-scale.
    const decodeScaleForVolume = (gsplatData, sx, sy, sz) => {
        const isCompressedGsplat = !!gsplatData?.chunkData;
        const isSogGsplat = !!gsplatData?.meta?.scales;

        if (isCompressedGsplat || isSogGsplat) {
            return [
                Math.exp(sx),
                Math.exp(sy),
                Math.exp(sz)
            ];
        }

        return [sx, sy, sz];
    };

    // MOD: Use scientific notation for very small / very large values so tiny volumes do not look like zero.
    const formatMetricVolume = (value) => {
        if (!Number.isFinite(value)) {
            return '0';
        }

        const absValue = Math.abs(value);
        if ((absValue > 0 && absValue < 0.001) || absValue >= 1000) {
            return value.toExponential(3);
        }

        return value.toFixed(3);
    };

    const popcount8 = (value) => {
        let count = 0;
        let bits = value & 0xFF;
        while (bits) {
            bits &= bits - 1;
            count++;
        }
        return count;
    };

    const countBits32 = (value) => {
        let count = 0;
        let bits = value >>> 0;
        while (bits) {
            bits &= bits - 1;
            count++;
        }
        return count;
    };

    const getAabbMin = (aabb, result) => {
        result.sub2(aabb.center, aabb.halfExtents);
        return result;
    };

    const getAabbMax = (aabb, result) => {
        result.add2(aabb.center, aabb.halfExtents);
        return result;
    };

    const aabbIntersects = (a, b) => {
        const aMin = getAabbMin(a, new pc.Vec3());
        const aMax = getAabbMax(a, new pc.Vec3());
        const bMin = getAabbMin(b, new pc.Vec3());
        const bMax = getAabbMax(b, new pc.Vec3());

        return !(aMax.x < bMin.x || aMin.x > bMax.x ||
            aMax.y < bMin.y || aMin.y > bMax.y ||
            aMax.z < bMin.z || aMin.z > bMax.z);
    };

    const computeAabbIntersection = (a, b, result) => {
        const aMin = getAabbMin(a, aabbIntersectionAMin);
        const aMax = getAabbMax(a, aabbIntersectionAMax);
        const bMin = getAabbMin(b, aabbIntersectionBMin);
        const bMax = getAabbMax(b, aabbIntersectionBMax);
        const minX = Math.max(aMin.x, bMin.x);
        const minY = Math.max(aMin.y, bMin.y);
        const minZ = Math.max(aMin.z, bMin.z);
        const maxX = Math.min(aMax.x, bMax.x);
        const maxY = Math.min(aMax.y, bMax.y);
        const maxZ = Math.min(aMax.z, bMax.z);
        const overlapX = maxX - minX;
        const overlapY = maxY - minY;
        const overlapZ = maxZ - minZ;

        if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) {
            return 0;
        }

        result.center.set(
            (minX + maxX) * 0.5,
            (minY + maxY) * 0.5,
            (minZ + maxZ) * 0.5
        );
        result.halfExtents.set(overlapX * 0.5, overlapY * 0.5, overlapZ * 0.5);
        return overlapX * overlapY * overlapZ;
    };

    const isAxisAlignedVoxelTransform = (transform) => {
        const data = transform.data;
        const usedAxes = [false, false, false];
        const basisColumns = [
            [data[0], data[1], data[2]],
            [data[4], data[5], data[6]],
            [data[8], data[9], data[10]]
        ];

        for (const column of basisColumns) {
            let dominantAxis = -1;
            for (let axis = 0; axis < 3; axis++) {
                if (Math.abs(column[axis]) > AXIS_ALIGNED_EPSILON) {
                    if (dominantAxis !== -1) {
                        return false;
                    }
                    dominantAxis = axis;
                }
            }

            if (dominantAxis === -1 || usedAxes[dominantAxis]) {
                return false;
            }

            usedAxes[dominantAxis] = true;
        }

        return true;
    };

    const getDominantWorldAxisForLocalAxis = (transform, localAxis) => {
        const data = transform.data;
        const offset = localAxis * 4;
        let dominantAxis = -1;
        let dominantValue = 0;
        for (let axis = 0; axis < 3; axis++) {
            const value = Math.abs(data[offset + axis]);
            if (value > dominantValue) {
                dominantValue = value;
                dominantAxis = axis;
            }
        }

        return dominantValue > AXIS_ALIGNED_EPSILON ? dominantAxis : -1;
    };

    const getAxisValue = (vec, axis) => axis === 0 ? vec.x : (axis === 1 ? vec.y : vec.z);

    const computeFaceSelectionArea = (faceWorldAabb, normalWorldAxis, selectionWorldAabb) => {
        const faceMin = getAabbMin(faceWorldAabb, aabbIntersectionAMin);
        const faceMax = getAabbMax(faceWorldAabb, aabbIntersectionAMax);
        const selectionMin = getAabbMin(selectionWorldAabb, aabbIntersectionBMin);
        const selectionMax = getAabbMax(selectionWorldAabb, aabbIntersectionBMax);

        const normalMin = Math.max(getAxisValue(faceMin, normalWorldAxis), getAxisValue(selectionMin, normalWorldAxis));
        const normalMax = Math.min(getAxisValue(faceMax, normalWorldAxis), getAxisValue(selectionMax, normalWorldAxis));
        if (normalMax < normalMin - AXIS_ALIGNED_EPSILON) {
            return 0;
        }

        let area = 1;
        for (let axis = 0; axis < 3; axis++) {
            if (axis === normalWorldAxis) {
                continue;
            }

            const overlap = Math.min(getAxisValue(faceMax, axis), getAxisValue(selectionMax, axis)) -
                Math.max(getAxisValue(faceMin, axis), getAxisValue(selectionMin, axis));
            if (overlap <= 0) {
                return 0;
            }
            area *= overlap;
        }

        return area;
    };

    const aabbContains = (outer, inner) => {
        const outerMin = getAabbMin(outer, new pc.Vec3());
        const outerMax = getAabbMax(outer, new pc.Vec3());
        const innerMin = getAabbMin(inner, new pc.Vec3());
        const innerMax = getAabbMax(inner, new pc.Vec3());

        return innerMin.x >= outerMin.x && innerMax.x <= outerMax.x &&
            innerMin.y >= outerMin.y && innerMax.y <= outerMax.y &&
            innerMin.z >= outerMin.z && innerMax.z <= outerMax.z;
    };

    const loadVoxelProxy = async (name) => {
        const baseUrl = `${rootPath}/static/assets/volumes/${name}`;
        const [metadataResponse, binaryResponse] = await Promise.all([
            fetch(`${baseUrl}.voxel.json`),
            fetch(`${baseUrl}.voxel.bin`)
        ]);

        if (!metadataResponse.ok || !binaryResponse.ok) {
            throw new Error(`Failed to load voxel proxy for ${name}`);
        }

        const metadata = await metadataResponse.json();
        const binaryBuffer = await binaryResponse.arrayBuffer();
        const raw = new Uint32Array(binaryBuffer);
        const nodes = raw.slice(0, metadata.nodeCount);
        const leafData = raw.slice(metadata.nodeCount, metadata.nodeCount + metadata.leafDataCount);
        const gridMin = new pc.Vec3(...metadata.gridBounds.min);
        const voxelResolution = metadata.voxelResolution;
        const rootBlockCount = 1 << metadata.treeDepth;

        return {
            name,
            metadata,
            nodes,
            leafData,
            gridMin,
            voxelResolution,
            voxelVolume: voxelResolution * voxelResolution * voxelResolution,
            rootWorldSize: voxelResolution * LEAF_SIZE * rootBlockCount
        };
    };

    // MOD: Sparse-octree leaves are identified by node payload, not by array index.
    // Solid leaves use the 0xFF000000 marker, while mixed leaves store a 24-bit leaf pair index.
    const isVoxelLeafNode = (node) => {
        const normalizedNode = node >>> 0;
        return normalizedNode === SOLID_LEAF_MARKER || (normalizedNode >>> 24) === 0;
    };

    const voxelProxiesByName = {};
    for (const proxyName of [
        'biker',
        'apartment',
        'testCube',
        'testSphere',
        'testCylinder',
        'surfaceCube',
        'surfaceSphere',
        'surfaceCylinder',
        'surfaceTetrahedron',
        'surfaceCone',
        'surfaceTorus',
        'surfaceCapsule',
        'surfacePyramid'
    ]) {
        try {
            voxelProxiesByName[proxyName] = await loadVoxelProxy(proxyName);
        } catch (error) {
            console.warn(`Unable to load voxel proxy for ${proxyName}`, error);
            voxelProxiesByName[proxyName] = null;
        }
    }

    const tempTriangleP0 = new pc.Vec3();
    const tempTriangleP1 = new pc.Vec3();
    const tempTriangleP2 = new pc.Vec3();
    const tempTriangleCross = new pc.Vec3();
    const tempTriangleWorldP0 = new pc.Vec3();
    const tempTriangleWorldP1 = new pc.Vec3();
    const tempTriangleWorldP2 = new pc.Vec3();

    const calculateMeshVolume = (mesh, transform) => {
        const primitive = mesh.primitive[0];
        if (!primitive || primitive.type !== pc.PRIMITIVE_TRIANGLES) {
            return 0;
        }

        const positions = new Float32Array(mesh.vertexBuffer.numVertices * 3);
        mesh.getPositions(positions);

        const primitiveCount = primitive.count;
        const baseVertex = primitive.baseVertex || 0;
        let signedVolume = 0;

        if (primitive.indexed && mesh.indexBuffer[0]) {
            const indices = mesh.indexBuffer[0].format === pc.INDEXFORMAT_UINT32 ?
                new Uint32Array(mesh.indexBuffer[0].numIndices) :
                new Uint16Array(mesh.indexBuffer[0].numIndices);
            mesh.getIndices(indices);

            for (let i = primitive.base; i < primitive.base + primitiveCount; i += 3) {
                const i0 = indices[i + 0] + baseVertex;
                const i1 = indices[i + 1] + baseVertex;
                const i2 = indices[i + 2] + baseVertex;

                tempTriangleP0.set(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
                tempTriangleP1.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
                tempTriangleP2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

                transform.transformPoint(tempTriangleP0, tempTriangleWorldP0);
                transform.transformPoint(tempTriangleP1, tempTriangleWorldP1);
                transform.transformPoint(tempTriangleP2, tempTriangleWorldP2);

                tempTriangleCross.cross(tempTriangleWorldP1, tempTriangleWorldP2);
                signedVolume += tempTriangleWorldP0.dot(tempTriangleCross) / 6;
            }
        } else {
            for (let i = primitive.base; i < primitive.base + primitiveCount; i += 3) {
                tempTriangleP0.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
                tempTriangleP1.set(positions[(i + 1) * 3], positions[(i + 1) * 3 + 1], positions[(i + 1) * 3 + 2]);
                tempTriangleP2.set(positions[(i + 2) * 3], positions[(i + 2) * 3 + 1], positions[(i + 2) * 3 + 2]);

                transform.transformPoint(tempTriangleP0, tempTriangleWorldP0);
                transform.transformPoint(tempTriangleP1, tempTriangleWorldP1);
                transform.transformPoint(tempTriangleP2, tempTriangleWorldP2);

                tempTriangleCross.cross(tempTriangleWorldP1, tempTriangleWorldP2);
                signedVolume += tempTriangleWorldP0.dot(tempTriangleCross) / 6;
            }
        }

        return Math.abs(signedVolume);
    };

    const calculateContainerVolume = (containerAsset) => {
        if (!containerAsset?.resource) {
            return 0;
        }

        const collisionEntity = containerAsset.resource.instantiateRenderEntity();
        let totalVolume = 0;
        const renderComponents = collisionEntity.findComponents('render');
        for (const renderComponent of renderComponents) {
            for (const meshInstance of renderComponent.meshInstances) {
                totalVolume += calculateMeshVolume(meshInstance.mesh, meshInstance.node.getWorldTransform());
            }
        }
        collisionEntity.destroy();

        return totalVolume;
    };

    const getCollisionMeshVolumeByName = (name) => {
        if (meshVolumeCache.has(name)) {
            return meshVolumeCache.get(name);
        }

        const assetName = `${name}Collision`;
        const containerAsset = assets[assetName];
        const totalVolume = containerAsset ? calculateContainerVolume(containerAsset) : null;
        meshVolumeCache.set(name, totalVolume);
        return totalVolume;
    };

    const queryLeafVoxelCount = (proxy, leafNode, origin, entityTransform, selectionWorldAabb) => {
        const normalizedLeafNode = leafNode >>> 0;
        if (normalizedLeafNode === SOLID_LEAF_MARKER) {
            return 64;
        }

        const leafPairIndex = normalizedLeafNode & 0x00FFFFFF;
        const leafDataOffset = leafPairIndex * 2;
        const maskLo = proxy.leafData[leafDataOffset] ?? 0;
        const maskHi = proxy.leafData[leafDataOffset + 1] ?? 0;
        if (aabbContains(selectionWorldAabb, voxelQueryWorldAabb)) {
            return countBits32(maskLo) + countBits32(maskHi);
        }

        let occupiedVoxelCount = 0;
        const voxelSize = proxy.voxelResolution;

        for (let z = 0; z < LEAF_SIZE; z++) {
            for (let y = 0; y < LEAF_SIZE; y++) {
                for (let x = 0; x < LEAF_SIZE; x++) {
                    const bitIndex = x + y * LEAF_SIZE + z * LEAF_SIZE * LEAF_SIZE;
                    const occupied = bitIndex < 32 ?
                        ((maskLo >>> bitIndex) & 1) !== 0 :
                        ((maskHi >>> (bitIndex - 32)) & 1) !== 0;
                    if (!occupied) {
                        continue;
                    }

                    voxelQueryLocalAabb.center.set(
                        origin.x + (x + 0.5) * voxelSize,
                        origin.y + (y + 0.5) * voxelSize,
                        origin.z + (z + 0.5) * voxelSize
                    );
                    voxelQueryLocalAabb.halfExtents.set(voxelSize * 0.5, voxelSize * 0.5, voxelSize * 0.5);
                    voxelQueryWorldAabb.setFromTransformedAabb(voxelQueryLocalAabb, entityTransform);

                    if (aabbIntersects(voxelQueryWorldAabb, selectionWorldAabb)) {
                        occupiedVoxelCount++;
                    }
                }
            }
        }

        return occupiedVoxelCount;
    };

    const queryVoxelCountRecursive = (proxy, entityTransform, selectionWorldAabb, nodeIndex, level, origin, nodeWorldSize) => {
        voxelQueryLocalAabb.center.set(
            origin.x + nodeWorldSize * 0.5,
            origin.y + nodeWorldSize * 0.5,
            origin.z + nodeWorldSize * 0.5
        );
        voxelQueryLocalAabb.halfExtents.set(nodeWorldSize * 0.5, nodeWorldSize * 0.5, nodeWorldSize * 0.5);
        voxelQueryWorldAabb.setFromTransformedAabb(voxelQueryLocalAabb, entityTransform);

        if (!aabbIntersects(voxelQueryWorldAabb, selectionWorldAabb)) {
            return 0;
        }

        const node = proxy.nodes[nodeIndex] >>> 0;

        if (isVoxelLeafNode(node)) {
            if (aabbContains(selectionWorldAabb, voxelQueryWorldAabb) && node === SOLID_LEAF_MARKER) {
                return 64;
            }

            return queryLeafVoxelCount(proxy, node, origin, entityTransform, selectionWorldAabb);
        }

        const childMask = node >>> 24;
        const baseOffset = node & 0x00FFFFFF;

        const childWorldSize = nodeWorldSize * 0.5;
        let childOffset = 0;
        let occupiedVoxelCount = 0;

        for (let octant = 0; octant < 8; octant++) {
            if ((childMask & (1 << octant)) === 0) {
                continue;
            }

            const childOrigin = new pc.Vec3(
                origin.x + ((octant & 1) ? childWorldSize : 0),
                origin.y + ((octant & 2) ? childWorldSize : 0),
                origin.z + ((octant & 4) ? childWorldSize : 0)
            );

            occupiedVoxelCount += queryVoxelCountRecursive(
                proxy,
                entityTransform,
                selectionWorldAabb,
                baseOffset + childOffset,
                level + 1,
                childOrigin,
                childWorldSize
            );
            childOffset++;
        }

        return occupiedVoxelCount;
    };

    // Stores only original object exterior faces. Selection cut planes are not
    // included, so the metric answers "how much original surface is selected?"
    const buildSurfaceExteriorFaceCache = (rootVoxelCount, solidMask, exteriorMask) => {
        const sliceSize = rootVoxelCount * rootVoxelCount;
        const indexFor = (x, y, z) => x + y * rootVoxelCount + z * sliceSize;
        const exteriorFaces = [];

        const isExteriorNeighbor = (x, y, z) => (
            x < 0 ||
            y < 0 ||
            z < 0 ||
            x >= rootVoxelCount ||
            y >= rootVoxelCount ||
            z >= rootVoxelCount ||
            exteriorMask[indexFor(x, y, z)] !== 0
        );

        for (let z = 0; z < rootVoxelCount; z++) {
            for (let y = 0; y < rootVoxelCount; y++) {
                for (let x = 0; x < rootVoxelCount; x++) {
                    const index = indexFor(x, y, z);
                    if (!solidMask[index]) {
                        continue;
                    }

                    if (isExteriorNeighbor(x - 1, y, z)) exteriorFaces.push(index * 6 + 0);
                    if (isExteriorNeighbor(x + 1, y, z)) exteriorFaces.push(index * 6 + 1);
                    if (isExteriorNeighbor(x, y - 1, z)) exteriorFaces.push(index * 6 + 2);
                    if (isExteriorNeighbor(x, y + 1, z)) exteriorFaces.push(index * 6 + 3);
                    if (isExteriorNeighbor(x, y, z - 1)) exteriorFaces.push(index * 6 + 4);
                    if (isExteriorNeighbor(x, y, z + 1)) exteriorFaces.push(index * 6 + 5);
                }
            }
        }

        return new Uint32Array(exteriorFaces);
    };

    const buildSurfaceVolumeCache = (proxy) => {
        if (!proxy) {
            return null;
        }

        const rootVoxelCount = LEAF_SIZE * (1 << proxy.metadata.treeDepth);
        const gridVoxelCount = rootVoxelCount * rootVoxelCount * rootVoxelCount;
        const shellMask = new Uint8Array(gridVoxelCount);
        const indexFor = (x, y, z) => x + y * rootVoxelCount + z * rootVoxelCount * rootVoxelCount;

        const markLeaf = (leafNode, baseX, baseY, baseZ) => {
            const normalizedLeafNode = leafNode >>> 0;
            if (normalizedLeafNode === SOLID_LEAF_MARKER) {
                for (let z = 0; z < LEAF_SIZE; z++) {
                    for (let y = 0; y < LEAF_SIZE; y++) {
                        for (let x = 0; x < LEAF_SIZE; x++) {
                            shellMask[indexFor(baseX + x, baseY + y, baseZ + z)] = 1;
                        }
                    }
                }
                return;
            }

            const leafPairIndex = normalizedLeafNode & 0x00FFFFFF;
            const leafDataOffset = leafPairIndex * 2;
            const maskLo = proxy.leafData[leafDataOffset] ?? 0;
            const maskHi = proxy.leafData[leafDataOffset + 1] ?? 0;
            for (let z = 0; z < LEAF_SIZE; z++) {
                for (let y = 0; y < LEAF_SIZE; y++) {
                    for (let x = 0; x < LEAF_SIZE; x++) {
                        const bitIndex = x + y * LEAF_SIZE + z * LEAF_SIZE * LEAF_SIZE;
                        const occupied = bitIndex < 32 ?
                            ((maskLo >>> bitIndex) & 1) !== 0 :
                            ((maskHi >>> (bitIndex - 32)) & 1) !== 0;
                        if (occupied) {
                            shellMask[indexFor(baseX + x, baseY + y, baseZ + z)] = 1;
                        }
                    }
                }
            }
        };

        const markNode = (nodeIndex, baseX, baseY, baseZ, sizeVoxels) => {
            const node = proxy.nodes[nodeIndex] >>> 0;
            if (isVoxelLeafNode(node)) {
                markLeaf(node, baseX, baseY, baseZ);
                return;
            }

            const childMask = node >>> 24;
            const baseOffset = node & 0x00FFFFFF;
            const childSize = sizeVoxels / 2;
            let childOffset = 0;
            for (let octant = 0; octant < 8; octant++) {
                if ((childMask & (1 << octant)) === 0) {
                    continue;
                }

                markNode(
                    baseOffset + childOffset,
                    baseX + ((octant & 1) ? childSize : 0),
                    baseY + ((octant & 2) ? childSize : 0),
                    baseZ + ((octant & 4) ? childSize : 0),
                    childSize
                );
                childOffset++;
            }
        };

        markNode(0, 0, 0, 0, rootVoxelCount);

        const exteriorMask = new Uint8Array(gridVoxelCount);
        const queue = new Uint32Array(gridVoxelCount);
        let head = 0;
        let tail = 0;

        const enqueueExterior = (x, y, z) => {
            const index = indexFor(x, y, z);
            if (shellMask[index] || exteriorMask[index]) {
                return;
            }
            exteriorMask[index] = 1;
            queue[tail++] = index;
        };

        for (let z = 0; z < rootVoxelCount; z++) {
            for (let y = 0; y < rootVoxelCount; y++) {
                enqueueExterior(0, y, z);
                enqueueExterior(rootVoxelCount - 1, y, z);
            }
            for (let x = 0; x < rootVoxelCount; x++) {
                enqueueExterior(x, 0, z);
                enqueueExterior(x, rootVoxelCount - 1, z);
            }
        }
        for (let y = 0; y < rootVoxelCount; y++) {
            for (let x = 0; x < rootVoxelCount; x++) {
                enqueueExterior(x, y, 0);
                enqueueExterior(x, y, rootVoxelCount - 1);
            }
        }

        while (head < tail) {
            const index = queue[head++];
            const z = Math.floor(index / (rootVoxelCount * rootVoxelCount));
            const yz = index - z * rootVoxelCount * rootVoxelCount;
            const y = Math.floor(yz / rootVoxelCount);
            const x = yz - y * rootVoxelCount;
            if (x > 0) enqueueExterior(x - 1, y, z);
            if (x + 1 < rootVoxelCount) enqueueExterior(x + 1, y, z);
            if (y > 0) enqueueExterior(x, y - 1, z);
            if (y + 1 < rootVoxelCount) enqueueExterior(x, y + 1, z);
            if (z > 0) enqueueExterior(x, y, z - 1);
            if (z + 1 < rootVoxelCount) enqueueExterior(x, y, z + 1);
        }

        let shellVoxelCount = 0;
        let interiorVoxelCount = 0;
        const solidIndices = [];
        const solidMask = new Uint8Array(gridVoxelCount);
        for (let i = 0; i < gridVoxelCount; i++) {
            if (shellMask[i]) {
                shellVoxelCount++;
                solidIndices.push(i);
                solidMask[i] = 1;
            } else if (!exteriorMask[i]) {
                interiorVoxelCount++;
                solidIndices.push(i);
                solidMask[i] = 1;
            }
        }
        const exteriorFaces = buildSurfaceExteriorFaceCache(rootVoxelCount, solidMask, exteriorMask);

        return {
            rootVoxelCount,
            // Used by enclosed volume queries.
            solidIndices: new Uint32Array(solidIndices),
            // Used by selected exterior surface area queries.
            exteriorFaces,
            shellVoxelCount,
            interiorVoxelCount,
            status: interiorVoxelCount > 0 ? 'ready' : 'open/no interior'
        };
    };

    const computeVoxelSelectionForEditable = (editable, selectionWorldAabb) => {
        const proxy = editable.voxelProxy;
        if (!proxy) {
            return { occupiedVoxelCount: 0, volume: 0 };
        }

        const entityTransform = editable.entity.getWorldTransform();
        const transform = editable.voxelToSplatTransform ?
            voxelQueryTransform.mul2(entityTransform, editable.voxelToSplatTransform) :
            entityTransform;
        transform.getScale(voxelEntityScale);
        const transformVolumeScale = Math.abs(voxelEntityScale.x * voxelEntityScale.y * voxelEntityScale.z);
        const occupiedVoxelCount = queryVoxelCountRecursive(
            proxy,
            transform,
            selectionWorldAabb,
            0,
            0,
            proxy.gridMin,
            proxy.rootWorldSize
        );

        return {
            occupiedVoxelCount,
            volume: occupiedVoxelCount * proxy.voxelVolume * transformVolumeScale
        };
    };

    const forEachSelectedEnclosedVoxel = (editable, selectionWorldAabb, callback) => {
        const proxy = editable.voxelProxy;
        const surfaceVolumeCache = editable.surfaceVolumeCache;
        if (!proxy || !surfaceVolumeCache) {
            return {
                applicable: false,
                status: 'not applicable',
                method: 'not applicable',
                transformVolumeScale: 0
            };
        }

        const entityTransform = editable.entity.getWorldTransform();
        const transform = editable.voxelToSplatTransform ?
            voxelQueryTransform.mul2(entityTransform, editable.voxelToSplatTransform) :
            entityTransform;
        transform.getScale(voxelEntityScale);
        const transformVolumeScale = Math.abs(voxelEntityScale.x * voxelEntityScale.y * voxelEntityScale.z);
        const axisAlignedTransform = isAxisAlignedVoxelTransform(transform);
        const selectionBoxSize = selectionWorldAabb.halfExtents;
        const selectionBoxVolume = selectionBoxSize.x * 2 * selectionBoxSize.y * 2 * selectionBoxSize.z * 2;
        const voxelSize = proxy.voxelResolution;
        const rootVoxelCount = surfaceVolumeCache.rootVoxelCount;
        const sliceSize = rootVoxelCount * rootVoxelCount;

        for (let i = 0; i < surfaceVolumeCache.solidIndices.length; i++) {
            const index = surfaceVolumeCache.solidIndices[i];
            const z = Math.floor(index / sliceSize);
            const yz = index - z * sliceSize;
            const y = Math.floor(yz / rootVoxelCount);
            const x = yz - y * rootVoxelCount;

            voxelQueryLocalAabb.center.set(
                proxy.gridMin.x + (x + 0.5) * voxelSize,
                proxy.gridMin.y + (y + 0.5) * voxelSize,
                proxy.gridMin.z + (z + 0.5) * voxelSize
            );
            voxelQueryLocalAabb.halfExtents.set(voxelSize * 0.5, voxelSize * 0.5, voxelSize * 0.5);
            voxelQueryWorldAabb.setFromTransformedAabb(voxelQueryLocalAabb, transform);

            const overlapVolume = computeAabbIntersection(voxelQueryWorldAabb, selectionWorldAabb, voxelQueryClippedAabb);
            if (overlapVolume > 0) {
                callback(voxelQueryWorldAabb, overlapVolume, proxy.voxelVolume * transformVolumeScale, voxelQueryClippedAabb, x, y, z);
            }
        }

        return {
            applicable: true,
            status: surfaceVolumeCache.status,
            method: axisAlignedTransform ? 'axis-aligned fractional' : 'rotated/aabb approximation',
            axisAlignedTransform,
            transformVolumeScale,
            selectionBoxVolume
        };
    };

    const computeEnclosedVoxelSelectionForEditable = (editable, selectionWorldAabb) => {
        let enclosedVoxelCount = 0;
        let fractionalEnclosedVolume = 0;
        let upperBoundVolume = 0;

        const result = forEachSelectedEnclosedVoxel(editable, selectionWorldAabb, (_worldAabb, overlapVolume, voxelVolume) => {
            enclosedVoxelCount++;
            upperBoundVolume += voxelVolume;
            fractionalEnclosedVolume += overlapVolume;
        });

        if (!result.applicable) {
            return {
                applicable: false,
                enclosedVoxelCount: 0,
                fractionalEnclosedVolume: 0,
                upperBoundVolume: 0,
                status: result.status,
                method: result.method
            };
        }

        if (result.axisAlignedTransform &&
            fractionalEnclosedVolume > result.selectionBoxVolume &&
            fractionalEnclosedVolume <= result.selectionBoxVolume + VOLUME_CLAMP_EPSILON) {
            fractionalEnclosedVolume = result.selectionBoxVolume;
        }

        return {
            applicable: true,
            enclosedVoxelCount,
            fractionalEnclosedVolume,
            upperBoundVolume,
            status: result.status,
            method: result.method
        };
    };

    const forEachSelectedExteriorFace = (editable, selectionWorldAabb, callback) => {
        const proxy = editable.voxelProxy;
        const surfaceVolumeCache = editable.surfaceVolumeCache;
        if (!proxy || !surfaceVolumeCache?.exteriorFaces) {
            return {
                applicable: false,
                method: 'not applicable',
                axisAlignedTransform: false
            };
        }

        const entityTransform = editable.entity.getWorldTransform();
        const transform = editable.voxelToSplatTransform ?
            voxelQueryTransform.mul2(entityTransform, editable.voxelToSplatTransform) :
            entityTransform;
        const axisAlignedTransform = isAxisAlignedVoxelTransform(transform);
        if (!axisAlignedTransform) {
            return {
                applicable: true,
                method: 'rotated/not precise',
                axisAlignedTransform: false
            };
        }

        const voxelSize = proxy.voxelResolution;
        const rootVoxelCount = surfaceVolumeCache.rootVoxelCount;
        const sliceSize = rootVoxelCount * rootVoxelCount;

        for (let i = 0; i < surfaceVolumeCache.exteriorFaces.length; i++) {
            const encodedFace = surfaceVolumeCache.exteriorFaces[i];
            const index = Math.floor(encodedFace / 6);
            const face = encodedFace - index * 6;
            const localAxis = Math.floor(face / 2);
            const positiveSide = (face & 1) === 1;
            const z = Math.floor(index / sliceSize);
            const yz = index - z * sliceSize;
            const y = Math.floor(yz / rootVoxelCount);
            const x = yz - y * rootVoxelCount;
            const normalWorldAxis = getDominantWorldAxisForLocalAxis(transform, localAxis);
            if (normalWorldAxis < 0) {
                continue;
            }

            surfaceFaceLocalAabb.center.set(
                proxy.gridMin.x + (x + 0.5) * voxelSize,
                proxy.gridMin.y + (y + 0.5) * voxelSize,
                proxy.gridMin.z + (z + 0.5) * voxelSize
            );
            surfaceFaceLocalAabb.halfExtents.set(voxelSize * 0.5, voxelSize * 0.5, voxelSize * 0.5);
            if (localAxis === 0) {
                surfaceFaceLocalAabb.center.x += positiveSide ? voxelSize * 0.5 : -voxelSize * 0.5;
                surfaceFaceLocalAabb.halfExtents.x = 0;
            } else if (localAxis === 1) {
                surfaceFaceLocalAabb.center.y += positiveSide ? voxelSize * 0.5 : -voxelSize * 0.5;
                surfaceFaceLocalAabb.halfExtents.y = 0;
            } else {
                surfaceFaceLocalAabb.center.z += positiveSide ? voxelSize * 0.5 : -voxelSize * 0.5;
                surfaceFaceLocalAabb.halfExtents.z = 0;
            }
            surfaceFaceWorldAabb.setFromTransformedAabb(surfaceFaceLocalAabb, transform);

            const faceArea = computeFaceSelectionArea(surfaceFaceWorldAabb, normalWorldAxis, selectionWorldAabb);
            if (faceArea > 0) {
                callback(surfaceFaceWorldAabb, faceArea, normalWorldAxis, x, y, z, face);
            }
        }

        return {
            applicable: true,
            method: 'axis-aligned voxel faces',
            axisAlignedTransform: true
        };
    };

    const computeSelectedExteriorSurfaceAreaForEditable = (editable, selectionWorldAabb) => {
        let selectedExteriorFaces = 0;
        let selectedExteriorSurfaceArea = 0;

        const result = forEachSelectedExteriorFace(editable, selectionWorldAabb, (_faceWorldAabb, faceArea) => {
            selectedExteriorFaces++;
            selectedExteriorSurfaceArea += faceArea;
        });

        if (!result.applicable) {
            return {
                applicable: false,
                selectedExteriorFaces: 0,
                selectedExteriorSurfaceArea: 0,
                method: result.method
            };
        }

        return {
            applicable: true,
            selectedExteriorFaces,
            selectedExteriorSurfaceArea,
            method: result.method
        };
    };

    const computeObbClippedMetricsForEditable = (editable) => {
        const proxy = editable.voxelProxy;
        const surfaceVolumeCache = editable.surfaceVolumeCache;
        if (!proxy || !surfaceVolumeCache) {
            return {
                applicable: false,
                enclosedVoxelCount: 0,
                enclosedVoxelVolume: 0,
                exteriorFaceCount: 0,
                exteriorSurfaceArea: 0,
                method: 'not applicable'
            };
        }

        const entityTransform = editable.entity.getWorldTransform();
        const transform = editable.voxelToSplatTransform ?
            voxelQueryTransform.mul2(entityTransform, editable.voxelToSplatTransform) :
            entityTransform;
        const objectAxisAligned = isAxisAlignedVoxelTransform(transform);
        const voxelSize = proxy.voxelResolution;
        const rootVoxelCount = surfaceVolumeCache.rootVoxelCount;
        const sliceSize = rootVoxelCount * rootVoxelCount;
        let enclosedVoxelCount = 0;
        let enclosedVoxelVolume = 0;
        let exteriorFaceCount = 0;
        let exteriorSurfaceArea = 0;

        for (let i = 0; i < surfaceVolumeCache.solidIndices.length; i++) {
            const index = surfaceVolumeCache.solidIndices[i];
            const z = Math.floor(index / sliceSize);
            const yz = index - z * sliceSize;
            const y = Math.floor(yz / rootVoxelCount);
            const x = yz - y * rootVoxelCount;

            voxelQueryLocalAabb.center.set(
                proxy.gridMin.x + (x + 0.5) * voxelSize,
                proxy.gridMin.y + (y + 0.5) * voxelSize,
                proxy.gridMin.z + (z + 0.5) * voxelSize
            );
            voxelQueryLocalAabb.halfExtents.set(voxelSize * 0.5, voxelSize * 0.5, voxelSize * 0.5);
            voxelQueryWorldAabb.setFromTransformedAabb(voxelQueryLocalAabb, transform);

            if (!obbIntersectsWorldAabb(voxelQueryWorldAabb)) {
                continue;
            }

            enclosedVoxelCount++;
            if (isWorldAabbFullyInsideSelectionObb(voxelQueryWorldAabb)) {
                enclosedVoxelVolume += (voxelQueryWorldAabb.halfExtents.x * 2) *
                    (voxelQueryWorldAabb.halfExtents.y * 2) *
                    (voxelQueryWorldAabb.halfExtents.z * 2);
                continue;
            }

            const clippedFaces = clipPolyhedronBySelectionAabb(makePolyhedronFromWorldAabb(voxelQueryWorldAabb));
            enclosedVoxelVolume += computeConvexPolyhedronVolume(clippedFaces);
        }

        if (surfaceVolumeCache.exteriorFaces) {
            for (let i = 0; i < surfaceVolumeCache.exteriorFaces.length; i++) {
                const encodedFace = surfaceVolumeCache.exteriorFaces[i];
                const index = Math.floor(encodedFace / 6);
                const face = encodedFace - index * 6;
                const localAxis = Math.floor(face / 2);
                const positiveSide = (face & 1) === 1;
                const z = Math.floor(index / sliceSize);
                const yz = index - z * sliceSize;
                const y = Math.floor(yz / rootVoxelCount);
                const x = yz - y * rootVoxelCount;

                surfaceFaceLocalAabb.center.set(
                    proxy.gridMin.x + (x + 0.5) * voxelSize,
                    proxy.gridMin.y + (y + 0.5) * voxelSize,
                    proxy.gridMin.z + (z + 0.5) * voxelSize
                );
                surfaceFaceLocalAabb.halfExtents.set(voxelSize * 0.5, voxelSize * 0.5, voxelSize * 0.5);
                if (localAxis === 0) {
                    surfaceFaceLocalAabb.center.x += positiveSide ? voxelSize * 0.5 : -voxelSize * 0.5;
                    surfaceFaceLocalAabb.halfExtents.x = 0;
                } else if (localAxis === 1) {
                    surfaceFaceLocalAabb.center.y += positiveSide ? voxelSize * 0.5 : -voxelSize * 0.5;
                    surfaceFaceLocalAabb.halfExtents.y = 0;
                } else {
                    surfaceFaceLocalAabb.center.z += positiveSide ? voxelSize * 0.5 : -voxelSize * 0.5;
                    surfaceFaceLocalAabb.halfExtents.z = 0;
                }
                surfaceFaceWorldAabb.setFromTransformedAabb(surfaceFaceLocalAabb, transform);
                if (!obbIntersectsWorldAabb(surfaceFaceWorldAabb)) {
                    continue;
                }

                const min = getAabbMin(surfaceFaceWorldAabb, aabbIntersectionAMin);
                const max = getAabbMax(surfaceFaceWorldAabb, aabbIntersectionAMax);
                if (localAxis === 0) {
                    const worldX = positiveSide ? max.x : min.x;
                    surfaceFaceWorldCorners[0].set(worldX, min.y, min.z);
                    surfaceFaceWorldCorners[1].set(worldX, max.y, min.z);
                    surfaceFaceWorldCorners[2].set(worldX, max.y, max.z);
                    surfaceFaceWorldCorners[3].set(worldX, min.y, max.z);
                } else if (localAxis === 1) {
                    const worldY = positiveSide ? max.y : min.y;
                    surfaceFaceWorldCorners[0].set(min.x, worldY, min.z);
                    surfaceFaceWorldCorners[1].set(max.x, worldY, min.z);
                    surfaceFaceWorldCorners[2].set(max.x, worldY, max.z);
                    surfaceFaceWorldCorners[3].set(min.x, worldY, max.z);
                } else {
                    const worldZ = positiveSide ? max.z : min.z;
                    surfaceFaceWorldCorners[0].set(min.x, min.y, worldZ);
                    surfaceFaceWorldCorners[1].set(max.x, min.y, worldZ);
                    surfaceFaceWorldCorners[2].set(max.x, max.y, worldZ);
                    surfaceFaceWorldCorners[3].set(min.x, max.y, worldZ);
                }

                for (let cornerIndex = 0; cornerIndex < 4; cornerIndex++) {
                    worldPointToSelectionBoxLocal(surfaceFaceWorldCorners[cornerIndex], surfaceFaceLocalCorners[cornerIndex]);
                }
                const polygonInside = surfaceFaceLocalCorners.every(corner => isSelectionLocalPointInside(corner));
                const clippedPolygon = polygonInside ?
                    surfaceFaceLocalCorners.map(corner => corner.clone()) :
                    clipPolygonBySelectionAabb(surfaceFaceLocalCorners);
                if (clippedPolygon.length >= 3) {
                    exteriorFaceCount++;
                    exteriorSurfaceArea += computePolygonArea(clippedPolygon);
                }
            }
        }

        return {
            applicable: true,
            enclosedVoxelCount,
            enclosedVoxelVolume,
            exteriorFaceCount,
            exteriorSurfaceArea,
            method: objectAxisAligned ? 'clipped voxel/face' : 'clipped voxel/face + object rotated approximation risk'
        };
    };

    const createOverlayBoxFromAabb = (aabb) => ({
        minX: aabb.center.x - aabb.halfExtents.x,
        minY: aabb.center.y - aabb.halfExtents.y,
        minZ: aabb.center.z - aabb.halfExtents.z,
        maxX: aabb.center.x + aabb.halfExtents.x,
        maxY: aabb.center.y + aabb.halfExtents.y,
        maxZ: aabb.center.z + aabb.halfExtents.z
    });

    const areClose = (a, b) => Math.abs(a - b) <= VOXEL_SLAB_MERGE_EPSILON;

    const canMergeOverlayBoxesX = (a, b) => (
        Math.abs(a.minY - b.minY) <= VOXEL_SLAB_MERGE_EPSILON &&
        Math.abs(a.maxY - b.maxY) <= VOXEL_SLAB_MERGE_EPSILON &&
        Math.abs(a.minZ - b.minZ) <= VOXEL_SLAB_MERGE_EPSILON &&
        Math.abs(a.maxZ - b.maxZ) <= VOXEL_SLAB_MERGE_EPSILON &&
        b.minX <= a.maxX + VOXEL_SLAB_MERGE_EPSILON
    );

    const canMergeOverlayBoxesY = (a, b) => (
        areClose(a.minX, b.minX) &&
        areClose(a.maxX, b.maxX) &&
        areClose(a.minZ, b.minZ) &&
        areClose(a.maxZ, b.maxZ) &&
        b.minY <= a.maxY + VOXEL_SLAB_MERGE_EPSILON
    );

    const canMergeOverlayBoxesZ = (a, b) => (
        areClose(a.minX, b.minX) &&
        areClose(a.maxX, b.maxX) &&
        areClose(a.minY, b.minY) &&
        areClose(a.maxY, b.maxY) &&
        b.minZ <= a.maxZ + VOXEL_SLAB_MERGE_EPSILON
    );

    const overlayBoxKey = (box, fields) => fields.map(field => box[field].toFixed(6)).join(':');

    const mergeOverlayBoxGroup = (items, sortField, mergeTest, extendField) => {
        const merged = [];
        items.sort((a, b) => a[sortField] - b[sortField]);
        let current = null;

        for (const item of items) {
            if (!current) {
                current = { ...item };
                continue;
            }

            if (mergeTest(current, item)) {
                current[extendField] = Math.max(current[extendField], item[extendField]);
            } else {
                merged.push(current);
                current = { ...item };
            }
        }

        if (current) {
            merged.push(current);
        }

        return merged;
    };

    const mergeOverlayBoxesByGroups = (boxes, keyFields, sortField, mergeTest, extendField) => {
        const groups = new Map();
        for (const box of boxes) {
            const key = overlayBoxKey(box, keyFields);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(box);
        }

        const merged = [];
        for (const group of groups.values()) {
            merged.push(...mergeOverlayBoxGroup(group, sortField, mergeTest, extendField));
        }
        return merged;
    };

    const mergeAxisAlignedOverlayBoxes = (boxes) => {
        const xMerged = mergeOverlayBoxesByGroups(
            boxes,
            ['minY', 'maxY', 'minZ', 'maxZ'],
            'minX',
            canMergeOverlayBoxesX,
            'maxX'
        );
        const xyMerged = mergeOverlayBoxesByGroups(
            xMerged,
            ['minX', 'maxX', 'minZ', 'maxZ'],
            'minY',
            canMergeOverlayBoxesY,
            'maxY'
        );
        return mergeOverlayBoxesByGroups(
            xyMerged,
            ['minX', 'maxX', 'minY', 'maxY'],
            'minZ',
            canMergeOverlayBoxesZ,
            'maxZ'
        );
    };

    const collectSelectedEnclosedVoxelSlabs = (selectionWorldAabb) => {
        const slabs = [];
        let totalHitCount = 0;

        for (const editable of editables) {
            const boxes = [];
            const result = forEachSelectedEnclosedVoxel(editable, selectionWorldAabb, (_worldAabb, _overlapVolume, _voxelVolume, clippedAabb) => {
                totalHitCount++;
                boxes.push(createOverlayBoxFromAabb(clippedAabb));
            });

            if (!result.applicable) {
                continue;
            }

            if (!result.axisAlignedTransform) {
                slabs.push(...boxes);
                continue;
            }

            slabs.push(...mergeAxisAlignedOverlayBoxes(boxes));
        }

        return { slabs, totalHitCount };
    };

    const collectObbSelectedEnclosedVoxelOverlayBoxes = () => {
        const boxes = [];
        let totalHitCount = 0;

        for (const editable of editables) {
            const proxy = editable.voxelProxy;
            const surfaceVolumeCache = editable.surfaceVolumeCache;
            if (!proxy || !surfaceVolumeCache) {
                continue;
            }

            const entityTransform = editable.entity.getWorldTransform();
            const transform = editable.voxelToSplatTransform ?
                voxelQueryTransform.mul2(entityTransform, editable.voxelToSplatTransform) :
                entityTransform;
            const voxelSize = proxy.voxelResolution;
            const rootVoxelCount = surfaceVolumeCache.rootVoxelCount;
            const sliceSize = rootVoxelCount * rootVoxelCount;

            for (let i = 0; i < surfaceVolumeCache.solidIndices.length; i++) {
                const index = surfaceVolumeCache.solidIndices[i];
                const z = Math.floor(index / sliceSize);
                const yz = index - z * sliceSize;
                const y = Math.floor(yz / rootVoxelCount);
                const x = yz - y * rootVoxelCount;

                voxelQueryLocalAabb.center.set(
                    proxy.gridMin.x + (x + 0.5) * voxelSize,
                    proxy.gridMin.y + (y + 0.5) * voxelSize,
                    proxy.gridMin.z + (z + 0.5) * voxelSize
                );
                voxelQueryLocalAabb.halfExtents.set(voxelSize * 0.5, voxelSize * 0.5, voxelSize * 0.5);
                voxelQueryWorldAabb.setFromTransformedAabb(voxelQueryLocalAabb, transform);

                if (obbIntersectsWorldAabb(voxelQueryWorldAabb)) {
                    totalHitCount++;
                    boxes.push(createOverlayBoxFromAabb(voxelQueryWorldAabb));
                }
            }
        }

        return { boxes, totalHitCount };
    };

    const createExteriorFaceOverlayBox = (faceWorldAabb, normalWorldAxis, selectionWorldAabb) => {
        const faceMin = getAabbMin(faceWorldAabb, aabbIntersectionAMin);
        const faceMax = getAabbMax(faceWorldAabb, aabbIntersectionAMax);
        const selectionMin = getAabbMin(selectionWorldAabb, aabbIntersectionBMin);
        const selectionMax = getAabbMax(selectionWorldAabb, aabbIntersectionBMax);
        const box = {
            minX: Math.max(faceMin.x, selectionMin.x),
            minY: Math.max(faceMin.y, selectionMin.y),
            minZ: Math.max(faceMin.z, selectionMin.z),
            maxX: Math.min(faceMax.x, selectionMax.x),
            maxY: Math.min(faceMax.y, selectionMax.y),
            maxZ: Math.min(faceMax.z, selectionMax.z)
        };
        const thickness = EXTERIOR_FACE_OVERLAY_THICKNESS * 0.5;

        if (normalWorldAxis === 0) {
            const center = (faceMin.x + faceMax.x) * 0.5;
            box.minX = center - thickness;
            box.maxX = center + thickness;
        } else if (normalWorldAxis === 1) {
            const center = (faceMin.y + faceMax.y) * 0.5;
            box.minY = center - thickness;
            box.maxY = center + thickness;
        } else {
            const center = (faceMin.z + faceMax.z) * 0.5;
            box.minZ = center - thickness;
            box.maxZ = center + thickness;
        }

        return box;
    };

    const createExteriorFaceObbPreviewBox = (faceWorldAabb) => {
        const box = createOverlayBoxFromAabb(faceWorldAabb);
        const thickness = EXTERIOR_FACE_OVERLAY_THICKNESS * 0.5;
        if (box.maxX - box.minX < EXTERIOR_FACE_OVERLAY_THICKNESS) {
            const center = (box.minX + box.maxX) * 0.5;
            box.minX = center - thickness;
            box.maxX = center + thickness;
        }
        if (box.maxY - box.minY < EXTERIOR_FACE_OVERLAY_THICKNESS) {
            const center = (box.minY + box.maxY) * 0.5;
            box.minY = center - thickness;
            box.maxY = center + thickness;
        }
        if (box.maxZ - box.minZ < EXTERIOR_FACE_OVERLAY_THICKNESS) {
            const center = (box.minZ + box.maxZ) * 0.5;
            box.minZ = center - thickness;
            box.maxZ = center + thickness;
        }
        return box;
    };

    const collectSelectedExteriorFaceOverlayBoxes = (selectionWorldAabb) => {
        const boxes = [];
        let totalFaceCount = 0;

        for (const editable of editables) {
            forEachSelectedExteriorFace(editable, selectionWorldAabb, (faceWorldAabb, _faceArea, normalWorldAxis) => {
                totalFaceCount++;
                boxes.push(createExteriorFaceOverlayBox(faceWorldAabb, normalWorldAxis, selectionWorldAabb));
            });
        }

        return { boxes, totalFaceCount };
    };

    const collectObbSelectedExteriorFaceOverlayBoxes = () => {
        const boxes = [];
        let totalFaceCount = 0;

        for (const editable of editables) {
            const proxy = editable.voxelProxy;
            const surfaceVolumeCache = editable.surfaceVolumeCache;
            if (!proxy || !surfaceVolumeCache?.exteriorFaces) {
                continue;
            }

            const entityTransform = editable.entity.getWorldTransform();
            const transform = editable.voxelToSplatTransform ?
                voxelQueryTransform.mul2(entityTransform, editable.voxelToSplatTransform) :
                entityTransform;
            const voxelSize = proxy.voxelResolution;
            const rootVoxelCount = surfaceVolumeCache.rootVoxelCount;
            const sliceSize = rootVoxelCount * rootVoxelCount;

            for (let i = 0; i < surfaceVolumeCache.exteriorFaces.length; i++) {
                const encodedFace = surfaceVolumeCache.exteriorFaces[i];
                const index = Math.floor(encodedFace / 6);
                const face = encodedFace - index * 6;
                const localAxis = Math.floor(face / 2);
                const positiveSide = (face & 1) === 1;
                const z = Math.floor(index / sliceSize);
                const yz = index - z * sliceSize;
                const y = Math.floor(yz / rootVoxelCount);
                const x = yz - y * rootVoxelCount;

                surfaceFaceLocalAabb.center.set(
                    proxy.gridMin.x + (x + 0.5) * voxelSize,
                    proxy.gridMin.y + (y + 0.5) * voxelSize,
                    proxy.gridMin.z + (z + 0.5) * voxelSize
                );
                surfaceFaceLocalAabb.halfExtents.set(voxelSize * 0.5, voxelSize * 0.5, voxelSize * 0.5);
                if (localAxis === 0) {
                    surfaceFaceLocalAabb.center.x += positiveSide ? voxelSize * 0.5 : -voxelSize * 0.5;
                    surfaceFaceLocalAabb.halfExtents.x = 0;
                } else if (localAxis === 1) {
                    surfaceFaceLocalAabb.center.y += positiveSide ? voxelSize * 0.5 : -voxelSize * 0.5;
                    surfaceFaceLocalAabb.halfExtents.y = 0;
                } else {
                    surfaceFaceLocalAabb.center.z += positiveSide ? voxelSize * 0.5 : -voxelSize * 0.5;
                    surfaceFaceLocalAabb.halfExtents.z = 0;
                }
                surfaceFaceWorldAabb.setFromTransformedAabb(surfaceFaceLocalAabb, transform);

                if (obbIntersectsWorldAabb(surfaceFaceWorldAabb)) {
                    totalFaceCount++;
                    boxes.push(createExteriorFaceObbPreviewBox(surfaceFaceWorldAabb));
                }
            }
        }

        return { boxes, totalFaceCount };
    };

    const updateSelectedExteriorFaceOverlay = (selectionWorldAabb) => {
        if (!selectionWorldAabb || !selectionBoxVisible || !selectedExteriorFaceOverlayMeshInstance) {
            return;
        }

        const { boxes, totalFaceCount } = isSelectionBoxAxisAligned() ?
            collectSelectedExteriorFaceOverlayBoxes(selectionWorldAabb) :
            collectObbSelectedExteriorFaceOverlayBoxes();
        if (totalFaceCount === 0 || boxes.length === 0) {
            clearSelectedExteriorFaceOverlayOnly();
            return;
        }

        const sampledCount = Math.min(boxes.length, MAX_VISIBLE_EXTERIOR_FACES);
        const sampleStep = boxes.length / sampledCount;
        const matrices = new Float32Array(sampledCount * 16);
        let sampleIndex = 0;

        for (let boxIndex = 0; boxIndex < boxes.length; boxIndex++) {
            if (sampleIndex < sampledCount && boxIndex >= Math.floor(sampleIndex * sampleStep)) {
                const box = boxes[boxIndex];
                overlayVoxelPosition.set(
                    (box.minX + box.maxX) * 0.5,
                    (box.minY + box.maxY) * 0.5,
                    (box.minZ + box.maxZ) * 0.5
                );
                overlayVoxelScale.set(
                    box.maxX - box.minX,
                    box.maxY - box.minY,
                    box.maxZ - box.minZ
                );
                overlayVoxelRotation.set(0, 0, 0, 1);
                overlayVoxelMatrix.setTRS(overlayVoxelPosition, overlayVoxelRotation, overlayVoxelScale);
                matrices.set(overlayVoxelMatrix.data, sampleIndex * 16);
                sampleIndex++;
            }
        }

        selectedExteriorFaceOverlayVertexBuffer?.destroy();
        selectedExteriorFaceOverlayVertexBuffer = new pc.VertexBuffer(device, overlayInstanceFormat, sampleIndex, {
            data: sampleIndex === sampledCount ? matrices : matrices.slice(0, sampleIndex * 16)
        });
        selectedExteriorFaceOverlayMeshInstance.setInstancing(selectedExteriorFaceOverlayVertexBuffer);
        selectedExteriorFaceOverlayEntity.enabled = sampleIndex > 0;
    };

    const updateSelectedEnclosedVoxelOverlay = (selectionWorldAabb) => {
        if (!selectionWorldAabb || !selectionBoxVisible || !selectedVoxelOverlayMeshInstance) {
            clearSelectedEnclosedVoxelOverlay();
            return;
        }

        const overlayData = isSelectionBoxAxisAligned() ?
            collectSelectedEnclosedVoxelSlabs(selectionWorldAabb) :
            collectObbSelectedEnclosedVoxelOverlayBoxes();
        const slabs = overlayData.slabs ?? overlayData.boxes;
        const { totalHitCount } = overlayData;

        if (totalHitCount === 0 || slabs.length === 0) {
            clearSelectedEnclosedVoxelOverlayOnly();
            visibleEnclosedVoxelLabel.textContent = `Visible Voxel Slabs: 0 / 0 (from ${totalHitCount} voxels)`;
            voxelOverlayStatusLabel.textContent = isSelectionBoxAxisAligned() ?
                'Voxel Overlay: slabs ready' :
                'Voxel Overlay: obb hit preview / metrics clipped';
            updateSelectedExteriorFaceOverlay(selectionWorldAabb);
            return;
        }

        const sampledCount = Math.min(slabs.length, MAX_VISIBLE_ENCLOSED_SLABS);
        const sampleStep = slabs.length / sampledCount;
        const matrices = new Float32Array(sampledCount * 16);
        let sampleIndex = 0;

        for (let slabIndex = 0; slabIndex < slabs.length; slabIndex++) {
            if (sampleIndex < sampledCount && slabIndex >= Math.floor(sampleIndex * sampleStep)) {
                const slab = slabs[slabIndex];
                overlayVoxelPosition.set(
                    (slab.minX + slab.maxX) * 0.5,
                    (slab.minY + slab.maxY) * 0.5,
                    (slab.minZ + slab.maxZ) * 0.5
                );
                overlayVoxelScale.set(
                    slab.maxX - slab.minX,
                    slab.maxY - slab.minY,
                    slab.maxZ - slab.minZ
                );
                overlayVoxelRotation.set(0, 0, 0, 1);
                overlayVoxelMatrix.setTRS(overlayVoxelPosition, overlayVoxelRotation, overlayVoxelScale);
                matrices.set(overlayVoxelMatrix.data, sampleIndex * 16);
                sampleIndex++;
            }
        }

        selectedVoxelOverlayVertexBuffer?.destroy();
        selectedVoxelOverlayVertexBuffer = new pc.VertexBuffer(device, overlayInstanceFormat, sampleIndex, {
            data: sampleIndex === sampledCount ? matrices : matrices.slice(0, sampleIndex * 16)
        });
        selectedVoxelOverlayMeshInstance.setInstancing(selectedVoxelOverlayVertexBuffer);
        selectedVoxelOverlayEntity.enabled = sampleIndex > 0;
        visibleEnclosedVoxelLabel.textContent = `Visible Voxel Slabs: ${sampleIndex} / ${slabs.length} (from ${totalHitCount} voxels)`;
        voxelOverlayStatusLabel.textContent = isSelectionBoxAxisAligned() ?
            `Voxel Overlay: ${sampleIndex < slabs.length ? 'slabs sampled' : 'slabs ready'}` :
            `Voxel Overlay: obb hit preview / metrics clipped${sampleIndex < slabs.length ? ' sampled' : ''}`;
        updateSelectedExteriorFaceOverlay(selectionWorldAabb);
    };

    // Creates an editable gsplat entity with splatVisible and splatSelection streams
    // MOD: Extract per-splat local scale data once so CPU-side metrics can reuse it later.
    const extractSplatScales = (resource) => {
        const scaleData = new Float32Array(resource.numSplats * 3);
        const scale = new pc.Vec3();
        const gsplatData = resource.gsplatData;
        const iter = gsplatData?.createIter?.(null, null, scale, null);
        if (!iter) {
            return scaleData;
        }

        for (let i = 0; i < resource.numSplats; i++) {
            iter.read(i);
            const [decodedScaleX, decodedScaleY, decodedScaleZ] = decodeScaleForVolume(gsplatData, scale.x, scale.y, scale.z);
            // MOD: Guard against invalid per-splat scale values so metrics never become NaN.
            scaleData[i * 3 + 0] = Number.isFinite(decodedScaleX) ? Math.abs(decodedScaleX) : 0;
            scaleData[i * 3 + 1] = Number.isFinite(decodedScaleY) ? Math.abs(decodedScaleY) : 0;
            scaleData[i * 3 + 2] = Number.isFinite(decodedScaleZ) ? Math.abs(decodedScaleZ) : 0;
        }

        return scaleData;
    };

    // Creates an editable gsplat entity with splatVisible and splatSelection streams
    const createEditableSplat = (name, asset, position, rotation, scale, volumeMode = 'occupied', options = {}) => {
        const entity = new pc.Entity(name);
        const gsplatComponent = entity.addComponent('gsplat', { asset, unified: true });
        entity.setLocalPosition(...position);
        entity.setLocalEulerAngles(...rotation);
        entity.setLocalScale(...scale);
        app.root.addChild(entity);

        const resource = /** @type {pc.GSplatResource} */ (asset.resource);

        // Add splatVisible and splatSelection streams if not present
        if (!resource.format.getStream('splatVisible')) {
            resource.format.addExtraStreams([
                { name: 'splatVisible', format: pc.PIXELFORMAT_R8, storage: pc.GSPLAT_STREAM_INSTANCE },
                { name: 'splatSelection', format: pc.PIXELFORMAT_R8, storage: pc.GSPLAT_STREAM_INSTANCE }
            ]);
        }

        // Setup textures and processors
        const { selectionProcessor, deleteProcessor } = setupEditableProcessors(gsplatComponent);

        const voxelProxyName = options.voxelProxyName ?? asset.name;
        const referenceVolumeName = options.referenceVolumeName ?? asset.name;
        const collisionMeshVolumeName = options.collisionMeshVolumeName ?? referenceVolumeName;
        const voxelProxy = voxelProxiesByName[voxelProxyName] ?? null;
        const editable = {
            entity,
            resource,
            component: gsplatComponent,
            voxelProxy,
            voxelToSplatTransform: /\.ply(?:$|\?)/i.test(asset.file?.url ?? '') ? plyVoxelToSplatTransform : null,
            volumeMode,
            surfaceVolumeCache: volumeMode === 'surface-enclosed' ? buildSurfaceVolumeCache(voxelProxy) : null,
            collisionMeshVolume: null,
            referenceVolume: referenceVolumes[referenceVolumeName] ?? null,
            referenceSurfaceArea: referenceSurfaceAreas[referenceVolumeName] ?? null,
            scaleData: extractSplatScales(resource),
            selectionProcessor,
            deleteProcessor
        };

        const baseCollisionMeshVolume = getCollisionMeshVolumeByName(collisionMeshVolumeName);
        if (Number.isFinite(baseCollisionMeshVolume)) {
            editable.collisionMeshVolume = baseCollisionMeshVolume * Math.abs(scale[0] * scale[1] * scale[2]);
        }

        editables.push(editable);
        updateEntityList();
        return editable;
    };

    // Creates a cloned gsplat from selected splats using GPU-based data copy
    // aabbCenter is used to make splat positions local (relative to aabbCenter)
    const createClonedSplat = (selectedData, aabbCenter) => {
        const { totalCount, centers, aabb, mappings } = selectedData;

        if (totalCount === 0) return null;

        // Use built-in default format for full visual preservation
        const format = pc.GSplatFormat.createDefaultFormat(device);

        // Add visibility and selection streams (with instance storage)
        format.addExtraStreams([
            { name: 'splatVisible', format: pc.PIXELFORMAT_R8, storage: pc.GSPLAT_STREAM_INSTANCE },
            { name: 'splatSelection', format: pc.PIXELFORMAT_R8, storage: pc.GSPLAT_STREAM_INSTANCE }
        ]);

        const container = new pc.GSplatContainer(device, totalCount, format);
        const dstTextureSize = container.textureDimensions.x;
        const clonedScaleData = new Float32Array(totalCount * 3);

        // Run GSplatProcessor per source editable to copy data
        for (const mapping of mappings) {
            // Extract source entity's transform
            const worldTransform = mapping.editable.entity.getWorldTransform();
            const modelScale = new pc.Vec3();
            const modelRotation = new pc.Quat();
            worldTransform.getScale(modelScale);
            modelRotation.setFromMat4(worldTransform);
            if (modelRotation.w < 0) {
                modelRotation.mulScalar(-1);
            }

            // Create remapping texture for this source
            const remapTexture = new pc.Texture(device, {
                name: 'RemapTexture',
                width: dstTextureSize,
                height: dstTextureSize,
                format: pc.PIXELFORMAT_R32U,
                mipmaps: false,
                minFilter: pc.FILTER_NEAREST,
                magFilter: pc.FILTER_NEAREST,
                addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                addressV: pc.ADDRESS_CLAMP_TO_EDGE
            });

            // Fill remapping texture on CPU
            const remapData = remapTexture.lock();
            remapData.fill(0xFFFFFFFF);  // mark all as "skip"
            for (let i = 0; i < mapping.srcIndices.length; i++) {
                remapData[mapping.destStartOffset + i] = mapping.srcIndices[i];
                // MOD: Persist cloned splat scales for CPU-side ellipsoid metrics.
                const srcIndex = mapping.srcIndices[i];
                const srcScaleOffset = srcIndex * 3;
                const dstScaleOffset = (mapping.destStartOffset + i) * 3;
                clonedScaleData[dstScaleOffset + 0] = mapping.editable.scaleData[srcScaleOffset + 0] * Math.abs(modelScale.x);
                clonedScaleData[dstScaleOffset + 1] = mapping.editable.scaleData[srcScaleOffset + 1] * Math.abs(modelScale.y);
                clonedScaleData[dstScaleOffset + 2] = mapping.editable.scaleData[srcScaleOffset + 2] * Math.abs(modelScale.z);
            }
            remapTexture.unlock();

            // Create processor to copy data from source to destination
            const copyProc = new pc.GSplatProcessor(device,
                { component: mapping.editable.component },  // source
                { resource: container, streams: ['dataColor', 'dataCenter', 'dataScale', 'dataRotation'] },
                copyProcessor
            );

            copyProc.setParameter('uRemapTexture', remapTexture);
            copyProc.setParameter('matrix_model', worldTransform.data);
            copyProc.setParameter('model_scale', [modelScale.x, modelScale.y, modelScale.z]);
            copyProc.setParameter('model_rotation', [modelRotation.x, modelRotation.y, modelRotation.z, modelRotation.w]);
            copyProc.setParameter('aabb_center', [aabbCenter.x, aabbCenter.y, aabbCenter.z]);
            copyProc.process();

            // Cleanup
            copyProc.destroy();
            remapTexture.destroy();
        }

        // Set centers and aabb (make local by subtracting aabbCenter)
        const localCenters = new Float32Array(totalCount * 3);
        for (let i = 0; i < totalCount; i++) {
            localCenters[i * 3 + 0] = centers[i * 3 + 0] - aabbCenter.x;
            localCenters[i * 3 + 1] = centers[i * 3 + 1] - aabbCenter.y;
            localCenters[i * 3 + 2] = centers[i * 3 + 2] - aabbCenter.z;
        }
        container.centers.set(localCenters);

        // Make aabb local too
        const localAabb = new pc.BoundingBox();
        localAabb.center.sub2(aabb.center, aabbCenter);
        localAabb.halfExtents.copy(aabb.halfExtents);
        container.aabb.copy(localAabb);

        // Create entity at aabbCenter position (with small offset to make clone visible)
        cloneCounter++;
        const name = `clone${cloneCounter}`;
        const entity = new pc.Entity(name);
        const gsplatComponent = entity.addComponent('gsplat', {
            resource: container,
            unified: true
        });
        entity.setLocalPosition(aabbCenter.x + 0.1, aabbCenter.y, aabbCenter.z + 0.1);
        app.root.addChild(entity);

        // Setup textures and processors
        const { selectionProcessor, deleteProcessor } = setupEditableProcessors(gsplatComponent);

        const editable = {
            entity,
            resource: container,
            component: gsplatComponent,
            voxelProxy: null,
            volumeMode: 'occupied',
            surfaceVolumeCache: null,
            collisionMeshVolume: null,
            referenceVolume: null,
            referenceSurfaceArea: null,
            scaleData: clonedScaleData,
            selectionProcessor,
            deleteProcessor
        };

        editables.push(editable);
        updateEntityList();

        return editable;
    };

    // Collect selected splat data from all editables (using GPU-computed selection)
    const collectSelectedData = async () => {
        if (!selectionBox || !selectionBoxVisible) {
            return {
                totalCount: 0,
                centers: null,
                aabb: null,
                mappings: [],
                ellipsoidVolume: 0,
                skippedEllipsoidCount: 0,
                zeroScaleEllipsoidCount: 0,
                zeroScaleAxisCounts: { x: 0, y: 0, z: 0 },
                scaleStats: null
            };
        }

        // Run selection processor on all editables to ensure splatSelection textures are up to date
        const boxMin = selectionBox.getMin();
        const boxMax = selectionBox.getMax();
        for (const editable of editables) {
            if (!editable.selectionProcessor) continue;
            editable.selectionProcessor.setParameter('uBoxMin', [boxMin.x, boxMin.y, boxMin.z]);
            editable.selectionProcessor.setParameter('uBoxMax', [boxMax.x, boxMax.y, boxMax.z]);
            editable.selectionProcessor.setParameter('matrix_model', editable.entity.getWorldTransform().data);
            editable.selectionProcessor.process();
        }

        let totalCount = 0;
        const mappings = [];

        // Read all visibility and selection textures in parallel
        const textureDataArray = await Promise.all(editables.map(async (editable) => {
            const visibleTexture = editable.component.getInstanceTexture('splatVisible');
            const selectionTexture = editable.component.getInstanceTexture('splatSelection');
            const [visibleData, selectionData] = await Promise.all([
                visibleTexture.read(0, 0, visibleTexture.width, visibleTexture.height, { immediate: true }),
                selectionTexture.read(0, 0, selectionTexture.width, selectionTexture.height, { immediate: true })
            ]);
            return { visibleData, selectionData };
        }));

        // Process each editable using GPU-computed selection data
        for (let e = 0; e < editables.length; e++) {
            const editable = editables[e];
            const { visibleData, selectionData } = textureDataArray[e];

            const srcIndices = [];
            for (let i = 0; i < editable.resource.numSplats; i++) {
                // Include splats that are both visible and selected (by GPU)
                if (visibleData[i] > 127 && selectionData[i] > 127) {
                    srcIndices.push(i);
                }
            }

            if (srcIndices.length > 0) {
                mappings.push({ editable, destStartOffset: totalCount, srcIndices });
                totalCount += srcIndices.length;
            }
        }

        if (totalCount === 0) {
            return {
                totalCount: 0,
                centers: null,
                aabb: null,
                mappings: [],
                ellipsoidVolume: 0,
                skippedEllipsoidCount: 0,
                zeroScaleEllipsoidCount: 0,
                zeroScaleAxisCounts: { x: 0, y: 0, z: 0 },
                scaleStats: null
            };
        }

        // Collect centers (still needed for aabb/sorting)
        const centers = new Float32Array(totalCount * 3);
        const aabb = new pc.BoundingBox();
        const tempBox = new pc.BoundingBox();
        const point = new pc.Vec3();
        const entityScale = new pc.Vec3();
        const ellipsoidVolumeFactor = (4 / 3) * Math.PI * Math.pow(ELLIPSOID_SIGMA_RADIUS, 3);
        let ellipsoidVolume = 0;
        let skippedEllipsoidCount = 0;
        let zeroScaleEllipsoidCount = 0;
        let zeroScaleXCount = 0;
        let zeroScaleYCount = 0;
        let zeroScaleZCount = 0;
        let minScale = Number.POSITIVE_INFINITY;
        let maxScale = 0;
        let offset = 0;

        for (const mapping of mappings) {
            const srcCenters = mapping.editable.resource.centers;
            const transform = mapping.editable.entity.getWorldTransform();
            transform.getScale(entityScale);
            const scaleData = mapping.editable.scaleData;
            const transformVolumeScale = Number.isFinite(entityScale.x) &&
                Number.isFinite(entityScale.y) &&
                Number.isFinite(entityScale.z) ?
                Math.abs(entityScale.x * entityScale.y * entityScale.z) :
                0;

            for (const idx of mapping.srcIndices) {
                // Get center and transform to world space
                point.set(srcCenters[idx * 3], srcCenters[idx * 3 + 1], srcCenters[idx * 3 + 2]);
                transform.transformPoint(point, point);

                centers[offset * 3 + 0] = point.x;
                centers[offset * 3 + 1] = point.y;
                centers[offset * 3 + 2] = point.z;

                if (offset === 0) {
                    aabb.center.copy(point);
                    aabb.halfExtents.set(0.01, 0.01, 0.01);
                } else {
                    // BoundingBox.add expects a BoundingBox, not a Vec3
                    tempBox.center.copy(point);
                    tempBox.halfExtents.set(0.01, 0.01, 0.01);
                    aabb.add(tempBox);
                }

                const scaleOffset = idx * 3;
                const sx = scaleData[scaleOffset + 0];
                const sy = scaleData[scaleOffset + 1];
                const sz = scaleData[scaleOffset + 2];
                if (Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(sz)) {
                    minScale = Math.min(minScale, sx, sy, sz);
                    maxScale = Math.max(maxScale, sx, sy, sz);
                    const zeroX = sx === 0;
                    const zeroY = sy === 0;
                    const zeroZ = sz === 0;
                    if (zeroX) zeroScaleXCount++;
                    if (zeroY) zeroScaleYCount++;
                    if (zeroZ) zeroScaleZCount++;
                    if (zeroX || zeroY || zeroZ) {
                        zeroScaleEllipsoidCount++;
                    }
                }
                // MOD: Skip malformed scale entries instead of letting one bad splat poison the total.
                if (Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(sz) && Number.isFinite(transformVolumeScale)) {
                    ellipsoidVolume += ellipsoidVolumeFactor * Math.abs(sx * sy * sz) * transformVolumeScale;
                } else {
                    skippedEllipsoidCount++;
                }
                offset++;
            }
        }

        return {
            totalCount,
            centers,
            aabb,
            mappings,
            ellipsoidVolume: Number.isFinite(ellipsoidVolume) ? ellipsoidVolume : 0,
            skippedEllipsoidCount,
            zeroScaleEllipsoidCount,
            zeroScaleAxisCounts: {
                x: zeroScaleXCount,
                y: zeroScaleYCount,
                z: zeroScaleZCount
            },
            scaleStats: Number.isFinite(minScale) ? { min: minScale, max: maxScale } : null
        };
    };

    // MOD: Compute a coarse volume estimate from the selected splats' world-space AABB.
    const updateSelectedAabbVolume = async () => {
        if (!selectionVolumeLabel || !selectionBoxSizeLabel || !selectionBoxModeLabel || !selectedSplatsAabbLabel || !selectionCountLabel || !selectedOccupiedVoxelsLabel || !selectionEllipsoidVolumeLabel || !voxelVolumeLabel || !enclosedVoxelCountLabel || !enclosedVoxelVolumeLabel || !enclosedVoxelUpperBoundLabel || !enclosedVolumeMethodLabel || !obbEnclosedVoxelVolumeLabel || !obbEnclosedVoxelCountLabel || !obbExteriorSurfaceAreaLabel || !obbExteriorFacesLabel || !obbMetricsMethodLabel || !selectedExteriorSurfaceAreaLabel || !selectedExteriorFacesLabel || !surfaceAreaMethodLabel || !visibleEnclosedVoxelLabel || !voxelOverlayStatusLabel || !surfaceClosureStatusLabel || !skippedEllipsoidLabel || !zeroScaleEllipsoidLabel || !selectedScaleRangeLabel) {
            return;
        }

        if (!selectionBox || !selectionBoxVisible) {
            clearSelectedEnclosedVoxelOverlay();
            selectionVolumeLabel.textContent = 'Selection Box Volume (Upper Bound): --';
            selectionBoxSizeLabel.textContent = 'Selection Box Size: --';
            selectionBoxModeLabel.textContent = 'Selection Box Mode: --';
            selectedSplatsAabbLabel.textContent = 'Selected Splats AABB Volume: --';
            selectionCountLabel.textContent = 'Selected Ellipsoids: --';
            selectedOccupiedVoxelsLabel.textContent = 'Selected Occupied Voxels: --';
            voxelVolumeLabel.textContent = 'Occupied Voxel Volume: --';
            enclosedVoxelCountLabel.textContent = 'Enclosed Voxels: --';
            enclosedVoxelVolumeLabel.textContent = 'Enclosed Voxel Volume: --';
            enclosedVoxelUpperBoundLabel.textContent = 'Enclosed Voxel Upper Bound: --';
            enclosedVolumeMethodLabel.textContent = 'Enclosed Volume Method: --';
            obbEnclosedVoxelVolumeLabel.textContent = 'OBB Enclosed Voxel Volume: --';
            obbEnclosedVoxelCountLabel.textContent = 'OBB Enclosed Voxels: --';
            obbExteriorSurfaceAreaLabel.textContent = 'OBB Exterior Surface Area: --';
            obbExteriorFacesLabel.textContent = 'OBB Exterior Faces: --';
            obbMetricsMethodLabel.textContent = 'OBB Metrics Method: --';
            selectedExteriorSurfaceAreaLabel.textContent = 'Selected Exterior Surface Area: --';
            selectedExteriorFacesLabel.textContent = 'Selected Exterior Faces: --';
            surfaceAreaMethodLabel.textContent = 'Surface Area Method: --';
            visibleEnclosedVoxelLabel.textContent = 'Visible Voxel Slabs: --';
            voxelOverlayStatusLabel.textContent = 'Voxel Overlay: off';
            surfaceClosureStatusLabel.textContent = 'Surface Closure Status: --';
            selectionEllipsoidVolumeLabel.textContent = `Ellipsoid Volume Sum (${ELLIPSOID_SIGMA_RADIUS}sigma): --`;
            skippedEllipsoidLabel.textContent = 'Skipped Ellipsoids: --';
            zeroScaleEllipsoidLabel.textContent = 'Zero-Scale Ellipsoids: --';
            selectedScaleRangeLabel.textContent = 'Selected Scale Range: --';
            return;
        }

        // MOD: Use the visible selection box itself as the upper-bound AABB volume,
        // even when no splats are currently selected.
        const selectionBoxSize = selectionBox.halfExtents.clone().mulScalar(2);
        const selectionBoxVolume = selectionBoxSize.x * selectionBoxSize.y * selectionBoxSize.z;
        selectionVolumeLabel.textContent = `Selection Box Volume (Upper Bound): ${formatMetricVolume(selectionBoxVolume)} scene units^3`;
        selectionBoxSizeLabel.textContent = `Selection Box Size: ${formatMetricVolume(selectionBoxSize.x)} / ${formatMetricVolume(selectionBoxSize.y)} / ${formatMetricVolume(selectionBoxSize.z)}`;
        selectionBoxModeLabel.textContent = `Selection Box Mode: ${getSelectionBoxCalculationModeLabel()}`;
        let selectedOccupiedVoxels = 0;
        let voxelVolume = 0;
        let enclosedVoxelCount = 0;
        let enclosedVoxelVolume = 0;
        let enclosedVoxelUpperBoundVolume = 0;
        let obbEnclosedVoxelCount = 0;
        let obbEnclosedVoxelVolume = 0;
        let obbExteriorFaceCount = 0;
        let obbExteriorSurfaceArea = 0;
        let selectedExteriorFaces = 0;
        let selectedExteriorSurfaceArea = 0;
        const closureStatuses = [];
        const enclosedVolumeMethods = [];
        const obbMetricsMethods = [];
        const surfaceAreaMethods = [];
        for (const editable of editables) {
            const voxelSelection = computeVoxelSelectionForEditable(editable, selectionBox);
            selectedOccupiedVoxels += voxelSelection.occupiedVoxelCount;
            voxelVolume += voxelSelection.volume;
            const enclosedSelection = computeEnclosedVoxelSelectionForEditable(editable, selectionBox);
            if (enclosedSelection.applicable) {
                enclosedVoxelCount += enclosedSelection.enclosedVoxelCount;
                enclosedVoxelVolume += enclosedSelection.fractionalEnclosedVolume;
                enclosedVoxelUpperBoundVolume += enclosedSelection.upperBoundVolume;
                closureStatuses.push(enclosedSelection.status);
                if (enclosedSelection.enclosedVoxelCount > 0) {
                    enclosedVolumeMethods.push(enclosedSelection.method);
                }
            }
            const surfaceAreaSelection = computeSelectedExteriorSurfaceAreaForEditable(editable, selectionBox);
            if (surfaceAreaSelection.applicable) {
                selectedExteriorFaces += surfaceAreaSelection.selectedExteriorFaces;
                selectedExteriorSurfaceArea += surfaceAreaSelection.selectedExteriorSurfaceArea;
                if (surfaceAreaSelection.selectedExteriorFaces > 0) {
                    surfaceAreaMethods.push(surfaceAreaSelection.method);
                }
            }
            const obbMetrics = computeObbClippedMetricsForEditable(editable);
            if (obbMetrics.applicable) {
                obbEnclosedVoxelCount += obbMetrics.enclosedVoxelCount;
                obbEnclosedVoxelVolume += obbMetrics.enclosedVoxelVolume;
                obbExteriorFaceCount += obbMetrics.exteriorFaceCount;
                obbExteriorSurfaceArea += obbMetrics.exteriorSurfaceArea;
                if (obbMetrics.enclosedVoxelCount > 0 || obbMetrics.exteriorFaceCount > 0) {
                    obbMetricsMethods.push(obbMetrics.method);
                }
            }
        }
        selectedOccupiedVoxelsLabel.textContent = `Selected Occupied Voxels: ${selectedOccupiedVoxels}`;
        voxelVolumeLabel.textContent = `Occupied Voxel Volume: ${formatMetricVolume(voxelVolume)} scene units^3`;
        enclosedVoxelCountLabel.textContent = `Enclosed Voxels: ${enclosedVoxelCount}`;
        enclosedVoxelVolumeLabel.textContent = `Enclosed Voxel Volume: ${formatMetricVolume(enclosedVoxelVolume)} scene units^3`;
        enclosedVoxelUpperBoundLabel.textContent = `Enclosed Voxel Upper Bound: ${formatMetricVolume(enclosedVoxelUpperBoundVolume)} scene units^3`;
        const enclosedVolumeMethod = enclosedVolumeMethods.length === 0 ?
            'not applicable' :
            (enclosedVolumeMethods.every(method => method === enclosedVolumeMethods[0]) ? enclosedVolumeMethods[0] : 'mixed');
        const selectionFallbackSuffix = isSelectionBoxAxisAligned() ? '' : ' + selection aabb fallback';
        enclosedVolumeMethodLabel.textContent = `Enclosed Volume Method: ${enclosedVolumeMethod}${selectionFallbackSuffix}`;
        obbEnclosedVoxelVolumeLabel.textContent = `OBB Enclosed Voxel Volume: ${formatMetricVolume(obbEnclosedVoxelVolume)} scene units^3`;
        obbEnclosedVoxelCountLabel.textContent = `OBB Enclosed Voxels: ${obbEnclosedVoxelCount}`;
        obbExteriorSurfaceAreaLabel.textContent = `OBB Exterior Surface Area: ${formatMetricVolume(obbExteriorSurfaceArea)} scene units^2`;
        obbExteriorFacesLabel.textContent = `OBB Exterior Faces: ${obbExteriorFaceCount}`;
        const obbMetricsMethod = obbMetricsMethods.length === 0 ?
            'not applicable' :
            (obbMetricsMethods.every(method => method === obbMetricsMethods[0]) ? obbMetricsMethods[0] : 'mixed');
        obbMetricsMethodLabel.textContent = `OBB Metrics Method: ${obbMetricsMethod}`;
        selectedExteriorSurfaceAreaLabel.textContent = `Selected Exterior Surface Area: ${formatMetricVolume(selectedExteriorSurfaceArea)} scene units^2`;
        selectedExteriorFacesLabel.textContent = `Selected Exterior Faces: ${selectedExteriorFaces}`;
        const surfaceAreaMethod = surfaceAreaMethods.length === 0 ?
            'not applicable' :
            (surfaceAreaMethods.every(method => method === surfaceAreaMethods[0]) ? surfaceAreaMethods[0] : 'mixed');
        surfaceAreaMethodLabel.textContent = `Surface Area Method: ${surfaceAreaMethod}${selectionFallbackSuffix}`;
        const closureStatus = closureStatuses.length === 0 ?
            'not applicable' :
            (closureStatuses.some(status => status !== 'ready') ? 'open/no interior' : 'ready');
        surfaceClosureStatusLabel.textContent = `Surface Closure Status: ${closureStatus}`;
        updateSelectedEnclosedVoxelOverlay(selectionBox);

        const selectedData = await collectSelectedData();
        if (!selectedData.aabb || selectedData.totalCount === 0) {
            selectedSplatsAabbLabel.textContent = 'Selected Splats AABB Volume: 0.000 scene units^3';
            selectionCountLabel.textContent = 'Selected Ellipsoids: 0';
            selectedOccupiedVoxelsLabel.textContent = `Selected Occupied Voxels: ${selectedOccupiedVoxels}`;
            selectionEllipsoidVolumeLabel.textContent = `Ellipsoid Volume Sum (${ELLIPSOID_SIGMA_RADIUS}sigma): 0.000 scene units^3`;
            skippedEllipsoidLabel.textContent = 'Skipped Ellipsoids: 0 (0.0%)';
            zeroScaleEllipsoidLabel.textContent = 'Zero-Scale Ellipsoids: 0 (x:0, y:0, z:0)';
            selectedScaleRangeLabel.textContent = 'Selected Scale Range: --';
            return;
        }

        const selectedAabbSize = selectedData.aabb.halfExtents.clone().mulScalar(2);
        const selectedAabbVolume = selectedAabbSize.x * selectedAabbSize.y * selectedAabbSize.z;
        selectedSplatsAabbLabel.textContent = `Selected Splats AABB Volume: ${formatMetricVolume(selectedAabbVolume)} scene units^3`;
        selectionCountLabel.textContent = `Selected Ellipsoids: ${selectedData.totalCount}`;
        selectionEllipsoidVolumeLabel.textContent = `Ellipsoid Volume Sum (${ELLIPSOID_SIGMA_RADIUS}sigma): ${formatMetricVolume(selectedData.ellipsoidVolume)} scene units^3`;
        const skippedRatio = (selectedData.skippedEllipsoidCount / selectedData.totalCount) * 100;
        skippedEllipsoidLabel.textContent = `Skipped Ellipsoids: ${selectedData.skippedEllipsoidCount} (${skippedRatio.toFixed(1)}%)`;
        zeroScaleEllipsoidLabel.textContent = `Zero-Scale Ellipsoids: ${selectedData.zeroScaleEllipsoidCount} (x:${selectedData.zeroScaleAxisCounts.x}, y:${selectedData.zeroScaleAxisCounts.y}, z:${selectedData.zeroScaleAxisCounts.z})`;
        if (selectedData.scaleStats) {
            selectedScaleRangeLabel.textContent = `Selected Scale Range: ${formatMetricVolume(selectedData.scaleStats.min)} .. ${formatMetricVolume(selectedData.scaleStats.max)}`;
        } else {
            selectedScaleRangeLabel.textContent = 'Selected Scale Range: --';
        }
    };

    // MOD: Queue volume recomputation when the selection box changes.
    const requestSelectedAabbVolumeUpdate = () => {
        if (volumeRefreshPending) {
            volumeRefreshQueued = true;
            return;
        }

        volumeRefreshPending = true;
        void updateSelectedAabbVolume().finally(() => {
            volumeRefreshPending = false;
            if (volumeRefreshQueued) {
                volumeRefreshQueued = false;
                requestSelectedAabbVolumeUpdate();
            }
        });
    };

    // Camera setup
    const initialScene = sceneConfigs[currentSceneKey];
    const cameraPos = initialScene.cameraPos.clone();
    const focusPos = initialScene.focusPos.clone();

    const camera = new pc.Entity('Camera');
    camera.addComponent('camera', {
        fov: 90,
        clearColor: new pc.Color(0, 0, 0),
        toneMapping: pc.TONEMAP_LINEAR
    });
    if (!camera.camera.layers.includes(selectedVoxelOverlayLayer.id)) {
        camera.camera.layers = [...camera.camera.layers, selectedVoxelOverlayLayer.id];
    }
    camera.setLocalPosition(cameraPos);
    camera.lookAt(focusPos);
    app.root.addChild(camera);

    // Create gizmo now that camera exists
    gizmoLayer = pc.Gizmo.createLayer(app);
    gizmo = new pc.TranslateGizmo(camera.camera, gizmoLayer);

    camera.addComponent('script');
    const orbitCamera = camera.script.create('orbitCamera', {
        attributes: {
            frameOnStart: false,
            inertiaFactor: 0.07
        }
    });
    const orbitInput = camera.script.create('orbitCameraInputMouse');
    orbitCamera.resetAndLookAtPoint(cameraPos, focusPos);

    // Gizmo interaction - disable camera when using gizmo
    gizmo.on('pointer:down', (_x, _y, meshInstance) => {
        if (meshInstance) {
            orbitInput.enabled = false;
        }
    });
    gizmo.on('pointer:up', () => {
        orbitInput.enabled = true;
    });

    app.mouse.disableContextMenu();

    // Update loop - draw selection box, sync position, and update selection highlights
    app.on('update', () => {
        // Sync selection box center with entity position (gizmo moves the entity)
        if (selectionBox && selectionBoxVisible) {
            selectionBox.center.copy(selectionBoxEntity.getPosition());
            selectionBoxState.center.copy(selectionBox.center);
            drawSelectionBoxWire();

            // Update selection highlighting for all editables
            const boxMin = selectionBox.getMin();
            const boxMax = selectionBox.getMax();

            for (const editable of editables) {
                if (!editable.selectionProcessor) continue;
                editable.selectionProcessor.setParameter('uBoxMin', [boxMin.x, boxMin.y, boxMin.z]);
                editable.selectionProcessor.setParameter('uBoxMax', [boxMax.x, boxMax.y, boxMax.z]);
                editable.selectionProcessor.setParameter('matrix_model', editable.entity.getWorldTransform().data);
                editable.selectionProcessor.process();
                editable.component.workBufferUpdate = pc.WORKBUFFER_UPDATE_ONCE;
            }

            // MOD: Refresh the selected-splat AABB volume only when the box transform changes.
            if (!selectionBox.center.equalsApprox(lastVolumeBoxCenter) ||
                !selectionBox.halfExtents.equalsApprox(lastVolumeHalfExtents) ||
                !selectionBoxState.rotation.equalsApprox(lastVolumeBoxRotation)) {
                lastVolumeBoxCenter.copy(selectionBox.center);
                lastVolumeHalfExtents.copy(selectionBox.halfExtents);
                lastVolumeBoxRotation.copy(selectionBoxState.rotation);
                requestSelectedAabbVolumeUpdate();
            }
        }
    });

    // Select button handler - show/create selection box
    data.on('select', () => {
        updateSelectionBoxStateFromData();

        if (!selectionBox) {
            selectionBox = new pc.BoundingBox(defaultBoxCenter.clone(), selectionBoxState.halfExtents.clone());
        } else {
            selectionBox.halfExtents.copy(selectionBoxState.halfExtents);
        }

        selectionBoxVisible = true;
        selectionBoxEntity.setPosition(selectionBox.center);
        selectionBoxState.center.copy(selectionBox.center);
        updateSelectionBoxStateFromData();
        showGizmoFor(selectionBoxEntity);
        requestSelectedAabbVolumeUpdate();
    });

    // Box size and rotation change handlers
    const handleSelectionBoxTransformChange = () => {
        if (selectionBox) {
            updateSelectionBoxStateFromData();
            requestSelectedAabbVolumeUpdate();
        }
    };
    data.on('boxSizeX:set', handleSelectionBoxTransformChange);
    data.on('boxSizeY:set', handleSelectionBoxTransformChange);
    data.on('boxSizeZ:set', handleSelectionBoxTransformChange);
    data.on('boxRotationX:set', handleSelectionBoxTransformChange);
    data.on('boxRotationY:set', handleSelectionBoxTransformChange);
    data.on('boxRotationZ:set', handleSelectionBoxTransformChange);

    data.on('resetRotation', () => {
        data.set('boxRotationX', 0);
        data.set('boxRotationY', 0);
        data.set('boxRotationZ', 0);
        handleSelectionBoxTransformChange();
    });

    // Clear selection - hide box and remove yellow highlighting
    const clearSelection = () => {
        selectionBoxVisible = false;
        clearSelectedEnclosedVoxelOverlay();
        selectionVolumeLabel.textContent = 'Selection Box Volume (Upper Bound): --';
        selectionBoxSizeLabel.textContent = 'Selection Box Size: --';
        selectionBoxModeLabel.textContent = 'Selection Box Mode: --';
        selectedSplatsAabbLabel.textContent = 'Selected Splats AABB Volume: --';
        selectionCountLabel.textContent = 'Selected Ellipsoids: --';
        selectedOccupiedVoxelsLabel.textContent = 'Selected Occupied Voxels: --';
        voxelVolumeLabel.textContent = 'Occupied Voxel Volume: --';
        enclosedVoxelCountLabel.textContent = 'Enclosed Voxels: --';
        enclosedVoxelVolumeLabel.textContent = 'Enclosed Voxel Volume: --';
        enclosedVoxelUpperBoundLabel.textContent = 'Enclosed Voxel Upper Bound: --';
        enclosedVolumeMethodLabel.textContent = 'Enclosed Volume Method: --';
        obbEnclosedVoxelVolumeLabel.textContent = 'OBB Enclosed Voxel Volume: --';
        obbEnclosedVoxelCountLabel.textContent = 'OBB Enclosed Voxels: --';
        obbExteriorSurfaceAreaLabel.textContent = 'OBB Exterior Surface Area: --';
        obbExteriorFacesLabel.textContent = 'OBB Exterior Faces: --';
        obbMetricsMethodLabel.textContent = 'OBB Metrics Method: --';
        selectedExteriorSurfaceAreaLabel.textContent = 'Selected Exterior Surface Area: --';
        selectedExteriorFacesLabel.textContent = 'Selected Exterior Faces: --';
        surfaceAreaMethodLabel.textContent = 'Surface Area Method: --';
        visibleEnclosedVoxelLabel.textContent = 'Visible Voxel Slabs: --';
        voxelOverlayStatusLabel.textContent = 'Voxel Overlay: off';
        surfaceClosureStatusLabel.textContent = 'Surface Closure Status: --';
        selectionEllipsoidVolumeLabel.textContent = `Ellipsoid Volume Sum (${ELLIPSOID_SIGMA_RADIUS}sigma): --`;
        skippedEllipsoidLabel.textContent = 'Skipped Ellipsoids: --';
        zeroScaleEllipsoidLabel.textContent = 'Zero-Scale Ellipsoids: --';
        selectedScaleRangeLabel.textContent = 'Selected Scale Range: --';
        if (activeGizmoEntity === selectionBoxEntity) {
            showGizmoFor(null);
        }
        // Clear selection highlighting on all editables
        for (const editable of editables) {
            const selectionTexture = editable.component.getInstanceTexture('splatSelection');
            if (selectionTexture) {
                const selectionData = new Uint8Array(selectionTexture.width * selectionTexture.height);
                selectionData.fill(0);
                selectionTexture.lock().set(selectionData);
                selectionTexture.unlock();
                editable.component.workBufferUpdate = pc.WORKBUFFER_UPDATE_ONCE;
            }
        }
    };

    const switchScene = (sceneKey) => {
        const sceneConfig = sceneConfigs[sceneKey];
        if (!sceneConfig) {
            return;
        }

        clearSelection();
        showGizmoFor(null);
        destroyAllEditables();

        currentSceneKey = sceneKey;
        defaultBoxCenter.copy(sceneConfig.defaultBoxCenter);
        camera.setLocalPosition(sceneConfig.cameraPos);
        camera.lookAt(sceneConfig.focusPos);
        orbitCamera.resetAndLookAtPoint(sceneConfig.cameraPos, sceneConfig.focusPos);

        for (const objectConfig of sceneConfig.objects) {
            createEditableSplat(
                objectConfig.name,
                assets[objectConfig.assetKey],
                objectConfig.position,
                objectConfig.rotation,
                objectConfig.scale,
                objectConfig.volumeMode,
                {
                    voxelProxyName: objectConfig.voxelProxyName,
                    referenceVolumeName: objectConfig.referenceVolumeName,
                    collisionMeshVolumeName: objectConfig.collisionMeshVolumeName
                }
            );
        }

        updateSceneButtons();
    };

    testSceneButton.onclick = () => switchScene('test');
    demoSceneButton.onclick = () => switchScene('demo');
    surfaceSceneButton.onclick = () => switchScene('surface');
    switchScene(currentSceneKey);

    // Delete selected button handler
    data.on('deleteSelected', () => {
        if (!selectionBox || !selectionBoxVisible) return;

        const boxMin = selectionBox.getMin();
        const boxMax = selectionBox.getMax();

        for (const editable of editables) {
            if (!editable.deleteProcessor) continue;
            editable.deleteProcessor.setParameter('uBoxMin', [boxMin.x, boxMin.y, boxMin.z]);
            editable.deleteProcessor.setParameter('uBoxMax', [boxMax.x, boxMax.y, boxMax.z]);
            editable.deleteProcessor.setParameter('matrix_model', editable.entity.getWorldTransform().data);
            editable.deleteProcessor.process();
            editable.component.workBufferUpdate = pc.WORKBUFFER_UPDATE_ONCE;
        }

        clearSelection();
    });

    // Clone selected button handler
    data.on('cloneSelected', async () => {
        const selectedData = await collectSelectedData();
        if (selectedData.totalCount > 0) {
            // Use selection box center as the clone's pivot point
            const aabbCenter = selectionBox.center.clone();
            const cloned = createClonedSplat(selectedData, aabbCenter);
            clearSelection();
            if (cloned) {
                showGizmoFor(cloned.entity);
            }
        }
    });

    // Cleanup on destroy
    app.on('destroy', () => {
        for (const editable of editables) {
            editable.selectionProcessor?.destroy();
            editable.deleteProcessor?.destroy();
        }
        gizmo.destroy();
        uiPanel.remove();
    });
});

export { app };
