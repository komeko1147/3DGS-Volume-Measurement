import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const generatedDir = path.join(projectRoot, 'generated', 'research-volume');
const assetDir = path.join(projectRoot, 'official-engine', 'examples', 'assets', 'volumes', 'research');
const splatDir = path.join(projectRoot, 'official-engine', 'examples', 'assets', 'splats');
const volumesDir = path.join(projectRoot, 'official-engine', 'examples', 'assets', 'volumes');
const generatedVolumesDir = path.join(projectRoot, 'generated', 'volumes');
const splatTransformCli = path.join(projectRoot, 'node_modules', '@playcanvas', 'splat-transform', 'bin', 'cli.mjs');

const LEAF_SIZE = 4;
const SOLID_LEAF_MARKER = 0xFF000000 >>> 0;
const CAMERA_COUNT_PER_RING = 8;
const CAMERA_ELEVATIONS = [-25, 0, 25];
const CAMERA_FOV_DEGREES = 55;
const CAMERA_RESOLUTION = 256;

const objectConfigs = [
    {
        name: 'biker',
        label: 'Biker',
        input: path.join(splatDir, 'biker.compressed.ply'),
        standardized: path.join(generatedDir, 'biker', 'biker.standard.ply'),
        displayScale: [0.3, 0.3, 0.3],
        expectedVolume: null,
        voxelBase: path.join(generatedVolumesDir, 'biker'),
        collisionBase: path.join(volumesDir, 'biker')
    },
    {
        name: 'testCube',
        label: 'Cube',
        input: path.join(splatDir, 'testCube.ply'),
        displayScale: [1, 1, 1],
        expectedVolume: 1,
        voxelBase: path.join(volumesDir, 'testCube'),
        collisionBase: path.join(volumesDir, 'testCube')
    },
    {
        name: 'testSphere',
        label: 'Sphere',
        input: path.join(splatDir, 'testSphere.ply'),
        displayScale: [1, 1, 1],
        expectedVolume: (4 / 3) * Math.PI * Math.pow(0.5, 3),
        voxelBase: path.join(volumesDir, 'testSphere'),
        collisionBase: path.join(volumesDir, 'testSphere')
    },
    {
        name: 'testCylinder',
        label: 'Cylinder',
        input: path.join(splatDir, 'testCylinder.ply'),
        displayScale: [1, 1, 1],
        expectedVolume: Math.PI * Math.pow(0.35, 2),
        voxelBase: path.join(volumesDir, 'testCylinder'),
        collisionBase: path.join(volumesDir, 'testCylinder')
    },
    {
        name: 'surfaceCube',
        label: 'Surface Cube',
        input: path.join(splatDir, 'surfaceCube.ply'),
        displayScale: [1, 1, 1],
        expectedVolume: 1,
        voxelBase: path.join(volumesDir, 'surfaceCube'),
        collisionBase: path.join(volumesDir, 'surfaceCube'),
        representation: 'oriented-surface-gaussians'
    },
    {
        name: 'surfaceSphere',
        label: 'Surface Sphere',
        input: path.join(splatDir, 'surfaceSphere.ply'),
        displayScale: [1, 1, 1],
        expectedVolume: (4 / 3) * Math.PI * Math.pow(0.5, 3),
        voxelBase: path.join(volumesDir, 'surfaceSphere'),
        collisionBase: path.join(volumesDir, 'surfaceSphere'),
        representation: 'oriented-surface-gaussians'
    },
    {
        name: 'surfaceCylinder',
        label: 'Surface Cylinder',
        input: path.join(splatDir, 'surfaceCylinder.ply'),
        displayScale: [1, 1, 1],
        expectedVolume: Math.PI * Math.pow(0.35, 2),
        voxelBase: path.join(volumesDir, 'surfaceCylinder'),
        collisionBase: path.join(volumesDir, 'surfaceCylinder'),
        representation: 'oriented-surface-gaussians'
    }
];

const run = (command, args, cwd) => {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: 'inherit',
            shell: false
        });

        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}`));
            }
        });
    });
};

const sha256 = async (filename) => {
    const content = await readFile(filename);
    return createHash('sha256').update(content).digest('hex');
};

const parseStandardPly = async (filename) => {
    const content = await readFile(filename);
    const headerEndText = 'end_header\n';
    const headerEnd = content.indexOf(Buffer.from(headerEndText, 'ascii'));
    if (headerEnd < 0) {
        throw new Error(`PLY header terminator missing in ${filename}`);
    }

    const dataOffset = headerEnd + headerEndText.length;
    const header = content.subarray(0, dataOffset).toString('ascii');
    const lines = header.trim().split(/\r?\n/);
    const vertexLine = lines.find((line) => line.startsWith('element vertex '));
    const vertexCount = Number(vertexLine?.split(' ')[2]);
    const vertexIndex = lines.indexOf(vertexLine);
    const properties = [];
    for (let i = vertexIndex + 1; i < lines.length && lines[i].startsWith('property '); i++) {
        const [, type, name] = lines[i].split(' ');
        if (type !== 'float') {
            throw new Error(`Only float standard PLY properties are supported for research input: ${filename}`);
        }
        properties.push(name);
    }

    const required = ['x', 'y', 'z', 'opacity', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3'];
    const missing = required.filter((name) => !properties.includes(name));
    if (missing.length > 0) {
        throw new Error(`Missing 3DGS PLY properties in ${filename}: ${missing.join(', ')}`);
    }
    if (!properties.includes('f_dc_0') && !properties.includes('red')) {
        throw new Error(`Missing PLY color properties in ${filename}`);
    }

    const xOffset = properties.indexOf('x') * 4;
    const yOffset = properties.indexOf('y') * 4;
    const zOffset = properties.indexOf('z') * 4;
    const stride = properties.length * 4;
    const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (let i = 0; i < vertexCount; i++) {
        const offset = dataOffset + i * stride;
        const values = [
            content.readFloatLE(offset + xOffset),
            content.readFloatLE(offset + yOffset),
            content.readFloatLE(offset + zOffset)
        ];
        for (let axis = 0; axis < 3; axis++) {
            min[axis] = Math.min(min[axis], values[axis]);
            max[axis] = Math.max(max[axis], values[axis]);
        }
    }

    return {
        vertexCount,
        properties,
        bounds: { min, max }
    };
};

const countBits32 = (value) => {
    let bits = value >>> 0;
    bits -= (bits >>> 1) & 0x55555555;
    bits = (bits & 0x33333333) + ((bits >>> 2) & 0x33333333);
    return (((bits + (bits >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
};

const countVoxelNode = (nodes, leafData, nodeIndex) => {
    const node = nodes[nodeIndex] >>> 0;
    if (node === SOLID_LEAF_MARKER) {
        return LEAF_SIZE * LEAF_SIZE * LEAF_SIZE;
    }
    if ((node >>> 24) === 0) {
        const leafOffset = (node & 0x00FFFFFF) * 2;
        return countBits32(leafData[leafOffset] ?? 0) + countBits32(leafData[leafOffset + 1] ?? 0);
    }

    const childMask = node >>> 24;
    const childBase = node & 0x00FFFFFF;
    let count = 0;
    let childOffset = 0;
    for (let octant = 0; octant < 8; octant++) {
        if ((childMask & (1 << octant)) !== 0) {
            count += countVoxelNode(nodes, leafData, childBase + childOffset);
            childOffset++;
        }
    }
    return count;
};

const getVoxelBaseline = async (config) => {
    try {
        const metadata = JSON.parse(await readFile(`${config.voxelBase}.voxel.json`, 'utf8'));
        const rawBuffer = await readFile(`${config.voxelBase}.voxel.bin`);
        const raw = new Uint32Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength / 4);
        const nodes = raw.subarray(0, metadata.nodeCount);
        const leafData = raw.subarray(metadata.nodeCount, metadata.nodeCount + metadata.leafDataCount);
        const occupiedVoxelCount = countVoxelNode(nodes, leafData, 0);
        const scale = config.displayScale.reduce((product, value) => product * Math.abs(value), 1);
        const volumeScene = occupiedVoxelCount * Math.pow(metadata.voxelResolution, 3) * scale;
        return {
            occupiedVoxelCount,
            volumeScene,
            voxelResolution: metadata.voxelResolution,
            source: path.relative(projectRoot, `${config.voxelBase}.voxel.json`).replaceAll('\\', '/')
        };
    } catch (error) {
        return {
            status: 'unavailable',
            message: error.message
        };
    }
};

const normalize = (vector) => {
    const length = Math.hypot(...vector);
    return vector.map((value) => value / length);
};

const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
];

const createSyntheticTransforms = (bounds) => {
    const center = bounds.min.map((value, index) => (value + bounds.max[index]) * 0.5);
    const size = bounds.min.map((value, index) => bounds.max[index] - value);
    const radius = Math.max(0.001, Math.max(...size) * 3);
    const focal = 0.5 * CAMERA_RESOLUTION / Math.tan((CAMERA_FOV_DEGREES * Math.PI / 180) * 0.5);
    const frames = [];

    for (const elevationDegrees of CAMERA_ELEVATIONS) {
        const elevation = elevationDegrees * Math.PI / 180;
        for (let i = 0; i < CAMERA_COUNT_PER_RING; i++) {
            const azimuth = (i / CAMERA_COUNT_PER_RING) * Math.PI * 2;
            const position = [
                center[0] + radius * Math.cos(elevation) * Math.cos(azimuth),
                center[1] + radius * Math.sin(elevation),
                center[2] + radius * Math.cos(elevation) * Math.sin(azimuth)
            ];
            const backward = normalize(position.map((value, index) => value - center[index]));
            const right = normalize(cross([0, 1, 0], backward));
            const up = cross(backward, right);
            frames.push({
                file_path: `synthetic_${elevationDegrees}_${i}.png`,
                transform_matrix: [
                    [right[0], up[0], backward[0], position[0]],
                    [right[1], up[1], backward[1], position[1]],
                    [right[2], up[2], backward[2], position[2]],
                    [0, 0, 0, 1]
                ]
            });
        }
    }

    return {
        w: CAMERA_RESOLUTION,
        h: CAMERA_RESOLUTION,
        fl_x: focal,
        fl_y: focal,
        camera_model: 'synthetic-orbit',
        camera_fov_degrees: CAMERA_FOV_DEGREES,
        orbit_center: center,
        orbit_radius: radius,
        frames
    };
};

const prepareObject = async (config) => {
    const objectDir = path.join(generatedDir, config.name);
    await mkdir(objectDir, { recursive: true });
    let input = config.input;
    if (config.standardized) {
        await run(process.execPath, [
            splatTransformCli,
            '-w',
            config.input,
            '-H',
            '0',
            config.standardized
        ], projectRoot);
        input = config.standardized;
    }

    const plyInfo = await parseStandardPly(input);
    const transforms = createSyntheticTransforms(plyInfo.bounds);
    const transformsPath = path.join(objectDir, 'transforms.synthetic.json');
    await writeFile(transformsPath, `${JSON.stringify(transforms, null, 2)}\n`, 'utf8');

    const result = {
        object: config.name,
        label: config.label,
        status: 'prepared',
        sourceAsset: path.relative(projectRoot, config.input).replaceAll('\\', '/'),
        standardizedInput: path.relative(projectRoot, input).replaceAll('\\', '/'),
        displayScale: config.displayScale,
        expectedVolume: config.expectedVolume,
        representation: config.representation ?? 'captured-or-solid-filled',
        input: {
            compatibleWith3dgsToPc: true,
            originalWasCompressed: Boolean(config.standardized),
            vertexCount: plyInfo.vertexCount,
            properties: plyInfo.properties,
            sha256: await sha256(input)
        },
        syntheticCamera: {
            status: 'prepared',
            source: 'synthetic-orbit',
            frameCount: transforms.frames.length,
            resolution: CAMERA_RESOLUTION,
            fovDegrees: CAMERA_FOV_DEGREES,
            orbitRadius: transforms.orbit_radius,
            nearPlane: 0.001,
            farPlane: 1000,
            transformsPath: path.relative(projectRoot, transformsPath).replaceAll('\\', '/')
        },
        methods: [{
            id: '3dgs-to-pc',
            label: 'Estimated',
            status: 'prepared',
            cameraSource: 'synthetic-orbit',
            meshAsset: null,
            volumeNative: null,
            volumeScene: null,
            watertight: null,
            parameters: {
                rendererType: 'cuda',
                maxShDegree: 0,
                nearPlane: 0.001,
                farPlane: 1000,
                poissonDepth: 10,
                poissonDensityTrimQuantile: 0,
                laplacianIterations: 10
            },
            inputSha256: await sha256(input),
            meshSha256: null,
            message: 'Run the CUDA reconstruction pipeline to generate the estimated volume.'
        }],
        baselines: {
            voxel: await getVoxelBaseline(config),
            voxelVolumeScene: null,
            collisionMeshVolumeScene: null,
            collisionAsset: `volumes/${config.name}.collision.glb`
        },
        sugar: {
            status: 'unavailable',
            message: 'Source scene and checkpoint were not provided.'
        }
    };
    result.baselines.voxelVolumeScene = result.baselines.voxel.volumeScene ?? null;

    const output = path.join(assetDir, `${config.name}.research-volume.json`);
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(`Prepared ${config.name}: ${path.relative(projectRoot, output)}`);
};

const main = async () => {
    await mkdir(generatedDir, { recursive: true });
    await mkdir(assetDir, { recursive: true });
    for (const config of objectConfigs) {
        await prepareObject(config);
    }
    console.log('\nResearch inputs and result manifests are prepared.');
    console.log('Run the CUDA reconstruction stage with: npm run run:research-volume');
};

main().catch((error) => {
    console.error('\nFailed to prepare research-volume data.');
    console.error(error);
    process.exitCode = 1;
});
