import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const splatTransformCli = path.join(projectRoot, 'node_modules', '@playcanvas', 'splat-transform', 'bin', 'cli.mjs');

const generatedDir = path.join(projectRoot, 'generated', 'surface-test-splats');
const examplesSplatsDir = path.join(projectRoot, 'official-engine', 'examples', 'assets', 'splats');
const examplesVolumesDir = path.join(projectRoot, 'official-engine', 'examples', 'assets', 'volumes');

const SH_C0 = 0.28209479177387814;
const OPACITY_LOGIT = 8;
const SPACING = 0.025;
// Keep splats overlapping while limiting sampling beyond sharp shape boundaries.
const TANGENT_RADIUS = SPACING * 0.32;
const NORMAL_RADIUS = SPACING * 0.10;
const TANGENT_SCALE_LOG = Math.log(TANGENT_RADIUS);
const NORMAL_SCALE_LOG = Math.log(NORMAL_RADIUS);

const rgbToDc = value => (value - 0.5) / SH_C0;

const normalize = (vector) => {
    const length = Math.hypot(...vector);
    return vector.map(value => value / length);
};

// Returns a wxyz quaternion rotating the local Z axis onto an outward normal.
const quaternionFromZToNormal = (normal) => {
    const [x, y, z] = normalize(normal);
    if (z < -0.999999) {
        return [0, 1, 0, 0];
    }
    const q = [1 + z, -y, x, 0];
    const length = Math.hypot(...q);
    return q.map(value => value / length);
};

const makePoint = (position, normal) => ({
    position,
    normal: normalize(normal)
});

const triangleArea = (a, b, c) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0]
    ];
    return Math.hypot(...cross) * 0.5;
};

const triangleNormal = (a, b, c) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return normalize([
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0]
    ]);
};

const sampleTriangle = (a, b, c, normal) => {
    const points = [];
    const steps = Math.max(1, Math.ceil(Math.sqrt(triangleArea(a, b, c)) / SPACING));
    for (let i = 0; i <= steps; i++) {
        for (let j = 0; j <= steps - i; j++) {
            const u = i / steps;
            const v = j / steps;
            const w = 1 - u - v;
            points.push(makePoint([
                a[0] * w + b[0] * u + c[0] * v,
                a[1] * w + b[1] * u + c[1] * v,
                a[2] * w + b[2] * u + c[2] * v
            ], normal));
        }
    }
    return points;
};

const sampleTriangleFaces = (vertices, faces) => {
    const points = [];
    for (const face of faces) {
        const [ia, ib, ic] = face;
        const a = vertices[ia];
        const b = vertices[ib];
        const c = vertices[ic];
        points.push(...sampleTriangle(a, b, c, triangleNormal(a, b, c)));
    }
    return points;
};

const generateCubeSurface = () => {
    const points = [];
    const half = 0.5;
    const steps = Math.ceil(1 / SPACING);
    for (let i = 0; i <= steps; i++) {
        const a = -half + i / steps;
        for (let j = 0; j <= steps; j++) {
            const b = -half + j / steps;
            points.push(makePoint([half, a, b], [1, 0, 0]));
            points.push(makePoint([-half, a, b], [-1, 0, 0]));
            points.push(makePoint([a, half, b], [0, 1, 0]));
            points.push(makePoint([a, -half, b], [0, -1, 0]));
            points.push(makePoint([a, b, half], [0, 0, 1]));
            points.push(makePoint([a, b, -half], [0, 0, -1]));
        }
    }
    return points;
};

const generateSphereSurface = () => {
    const radius = 0.5;
    const count = Math.ceil((4 * Math.PI * radius * radius) / (SPACING * SPACING));
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const points = [];
    for (let i = 0; i < count; i++) {
        const y = 1 - (2 * (i + 0.5)) / count;
        const radial = Math.sqrt(1 - y * y);
        const theta = goldenAngle * i;
        const normal = [Math.cos(theta) * radial, y, Math.sin(theta) * radial];
        points.push(makePoint(normal.map(value => value * radius), normal));
    }
    return points;
};

const generateCylinderSurface = () => {
    const radius = 0.35;
    const halfHeight = 0.5;
    const circumferenceSteps = Math.ceil((2 * Math.PI * radius) / SPACING);
    const heightSteps = Math.ceil((halfHeight * 2) / SPACING);
    const radialSteps = Math.ceil(radius / SPACING);
    const points = [];

    for (let ring = 0; ring < circumferenceSteps; ring++) {
        const angle = (ring / circumferenceSteps) * Math.PI * 2;
        const normal = [Math.cos(angle), 0, Math.sin(angle)];
        for (let h = 0; h <= heightSteps; h++) {
            const y = -halfHeight + h / heightSteps;
            points.push(makePoint([normal[0] * radius, y, normal[2] * radius], normal));
        }
    }

    for (let radial = 0; radial <= radialSteps; radial++) {
        const r = radius * radial / radialSteps;
        const steps = radial === 0 ? 1 : Math.ceil((2 * Math.PI * r) / SPACING);
        for (let ring = 0; ring < steps; ring++) {
            const angle = (ring / steps) * Math.PI * 2;
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            points.push(makePoint([x, halfHeight, z], [0, 1, 0]));
            points.push(makePoint([x, -halfHeight, z], [0, -1, 0]));
        }
    }
    return points;
};

const generateTetrahedronSurface = () => {
    const s = 0.5;
    const vertices = [
        [s, s, s],
        [s, -s, -s],
        [-s, s, -s],
        [-s, -s, s]
    ];
    return sampleTriangleFaces(vertices, [
        [0, 2, 1],
        [0, 1, 3],
        [0, 3, 2],
        [1, 2, 3]
    ]);
};

const generateConeSurface = () => {
    const radius = 0.35;
    const halfHeight = 0.5;
    const slopeLength = Math.hypot(radius, halfHeight * 2);
    const circumferenceSteps = Math.ceil((2 * Math.PI * radius) / SPACING);
    const heightSteps = Math.ceil(slopeLength / SPACING);
    const radialSteps = Math.ceil(radius / SPACING);
    const points = [];

    for (let ring = 0; ring < circumferenceSteps; ring++) {
        const angle0 = (ring / circumferenceSteps) * Math.PI * 2;
        const angle1 = ((ring + 1) / circumferenceSteps) * Math.PI * 2;
        for (let h = 0; h <= heightSteps; h++) {
            const t = h / heightSteps;
            const angle = angle0 * (1 - t) + angle1 * t;
            const y = -halfHeight + t * (halfHeight * 2);
            const r = radius * (1 - t);
            const normal = normalize([Math.cos(angle) * halfHeight * 2, radius, Math.sin(angle) * halfHeight * 2]);
            points.push(makePoint([Math.cos(angle) * r, y, Math.sin(angle) * r], normal));
        }
    }

    for (let radial = 0; radial <= radialSteps; radial++) {
        const r = radius * radial / radialSteps;
        const steps = radial === 0 ? 1 : Math.ceil((2 * Math.PI * r) / SPACING);
        for (let ring = 0; ring < steps; ring++) {
            const angle = (ring / steps) * Math.PI * 2;
            points.push(makePoint([Math.cos(angle) * r, -halfHeight, Math.sin(angle) * r], [0, -1, 0]));
        }
    }

    return points;
};

const generateTorusSurface = () => {
    const majorRadius = 0.32;
    const minorRadius = 0.14;
    const majorSteps = Math.ceil((2 * Math.PI * majorRadius) / SPACING);
    const minorSteps = Math.ceil((2 * Math.PI * minorRadius) / SPACING);
    const points = [];

    for (let i = 0; i < majorSteps; i++) {
        const u = (i / majorSteps) * Math.PI * 2;
        const cu = Math.cos(u);
        const su = Math.sin(u);
        for (let j = 0; j < minorSteps; j++) {
            const v = (j / minorSteps) * Math.PI * 2;
            const cv = Math.cos(v);
            const sv = Math.sin(v);
            const radial = majorRadius + minorRadius * cv;
            points.push(makePoint(
                [radial * cu, minorRadius * sv, radial * su],
                [cv * cu, sv, cv * su]
            ));
        }
    }

    return points;
};

const generateCapsuleSurface = () => {
    const radius = 0.3;
    const cylinderHeight = 0.4;
    const halfCylinder = cylinderHeight * 0.5;
    const circumferenceSteps = Math.ceil((2 * Math.PI * radius) / SPACING);
    const heightSteps = Math.ceil(cylinderHeight / SPACING);
    const hemisphereSteps = Math.ceil((Math.PI * radius * 0.5) / SPACING);
    const points = [];

    for (let ring = 0; ring < circumferenceSteps; ring++) {
        const angle = (ring / circumferenceSteps) * Math.PI * 2;
        const normal = [Math.cos(angle), 0, Math.sin(angle)];
        for (let h = 0; h <= heightSteps; h++) {
            const y = -halfCylinder + h / heightSteps * cylinderHeight;
            points.push(makePoint([normal[0] * radius, y, normal[2] * radius], normal));
        }
    }

    for (const sign of [-1, 1]) {
        const centerY = sign * halfCylinder;
        for (let lat = 1; lat <= hemisphereSteps; lat++) {
            const phi = (lat / hemisphereSteps) * Math.PI * 0.5;
            const yOffset = sign * Math.sin(phi) * radius;
            const ringRadius = Math.cos(phi) * radius;
            const steps = Math.max(1, Math.ceil((2 * Math.PI * ringRadius) / SPACING));
            for (let ring = 0; ring < steps; ring++) {
                const angle = (ring / steps) * Math.PI * 2;
                const normal = [Math.cos(angle) * Math.cos(phi), sign * Math.sin(phi), Math.sin(angle) * Math.cos(phi)];
                points.push(makePoint([Math.cos(angle) * ringRadius, centerY + yOffset, Math.sin(angle) * ringRadius], normal));
            }
        }
    }

    return points;
};

const generatePyramidSurface = () => {
    const half = 0.5;
    const vertices = [
        [-half, -0.5, -half],
        [half, -0.5, -half],
        [half, -0.5, half],
        [-half, -0.5, half],
        [0, 0.5, 0]
    ];
    return sampleTriangleFaces(vertices, [
        [0, 2, 1],
        [0, 3, 2],
        [0, 1, 4],
        [1, 2, 4],
        [2, 3, 4],
        [3, 0, 4]
    ]);
};

const shapes = [
    {
        name: 'surfaceCube',
        color: [0.95, 0.35, 0.25],
        referenceVolume: 1,
        generatePoints: generateCubeSurface
    },
    {
        name: 'surfaceSphere',
        color: [0.25, 0.55, 0.95],
        referenceVolume: (4 / 3) * Math.PI * Math.pow(0.5, 3),
        generatePoints: generateSphereSurface
    },
    {
        name: 'surfaceCylinder',
        color: [0.3, 0.9, 0.45],
        referenceVolume: Math.PI * Math.pow(0.35, 2),
        generatePoints: generateCylinderSurface
    },
    {
        name: 'surfaceTetrahedron',
        color: [0.95, 0.8, 0.25],
        referenceVolume: 1 / 3,
        generatePoints: generateTetrahedronSurface
    },
    {
        name: 'surfaceCone',
        color: [0.9, 0.35, 0.95],
        referenceVolume: (1 / 3) * Math.PI * Math.pow(0.35, 2),
        generatePoints: generateConeSurface
    },
    {
        name: 'surfaceTorus',
        color: [0.25, 0.9, 0.9],
        referenceVolume: 2 * Math.PI * Math.PI * 0.32 * Math.pow(0.14, 2),
        generatePoints: generateTorusSurface
    },
    {
        name: 'surfaceCapsule',
        color: [0.75, 0.45, 0.95],
        referenceVolume: Math.PI * Math.pow(0.3, 2) * 0.4 + (4 / 3) * Math.PI * Math.pow(0.3, 3),
        generatePoints: generateCapsuleSurface
    },
    {
        name: 'surfacePyramid',
        color: [0.95, 0.6, 0.3],
        referenceVolume: 1 / 3,
        generatePoints: generatePyramidSurface
    }
];

const run = (command, args, cwd) => new Promise((resolve, reject) => {
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

const writeBinaryPly = async (filename, points, color, referenceVolume) => {
    const propertyNames = [
        'x', 'y', 'z',
        'rot_0', 'rot_1', 'rot_2', 'rot_3',
        'scale_0', 'scale_1', 'scale_2',
        'f_dc_0', 'f_dc_1', 'f_dc_2',
        'opacity'
    ];
    const header = [
        'ply',
        'format binary_little_endian 1.0',
        'comment generated by generate-surface-test-splats.mjs',
        'comment input_representation oriented_surface_gaussians',
        `comment reference_volume ${referenceVolume}`,
        `element vertex ${points.length}`,
        ...propertyNames.map(name => `property float ${name}`),
        'end_header'
    ].join('\n') + '\n';
    const buffer = Buffer.allocUnsafe(points.length * propertyNames.length * 4);
    const dc = color.map(rgbToDc);
    let offset = 0;
    for (const point of points) {
        const [w, x, y, z] = quaternionFromZToNormal(point.normal);
        const values = [
            ...point.position,
            w, x, y, z,
            TANGENT_SCALE_LOG, TANGENT_SCALE_LOG, NORMAL_SCALE_LOG,
            ...dc,
            OPACITY_LOGIT
        ];
        for (const value of values) {
            buffer.writeFloatLE(value, offset);
            offset += 4;
        }
    }
    await writeFile(filename, Buffer.concat([Buffer.from(header, 'ascii'), buffer]));
};

const main = async () => {
    await mkdir(generatedDir, { recursive: true });
    await mkdir(examplesSplatsDir, { recursive: true });
    await mkdir(examplesVolumesDir, { recursive: true });
    for (const shape of shapes) {
        const points = shape.generatePoints();
        const plyPath = path.join(generatedDir, `${shape.name}.ply`);
        const voxelPath = path.join(generatedDir, `${shape.name}.voxel.json`);
        console.log(`\n=== Generating ${shape.name} ===`);
        console.log(`Reference volume: ${shape.referenceVolume.toFixed(6)} | Surface splats: ${points.length}`);
        await writeBinaryPly(plyPath, points, shape.color, shape.referenceVolume);
        await run(process.execPath, [
            splatTransformCli,
            '-w',
            '--voxel-params',
            '0.02,0.01',
            '-K',
            plyPath,
            voxelPath
        ], projectRoot);
        await copyFile(plyPath, path.join(examplesSplatsDir, `${shape.name}.ply`));
        for (const suffix of ['voxel.json', 'voxel.bin', 'collision.glb']) {
            await copyFile(path.join(generatedDir, `${shape.name}.${suffix}`), path.join(examplesVolumesDir, `${shape.name}.${suffix}`));
        }
    }
};

main().catch((error) => {
    console.error('\nFailed to generate surface-only calibration splats.');
    console.error(error);
    process.exitCode = 1;
});
