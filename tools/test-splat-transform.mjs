import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const splatTransformCli = path.join(projectRoot, 'node_modules', '@playcanvas', 'splat-transform', 'bin', 'cli.mjs');

const assets = [
    {
        name: 'apartment',
        input: path.join(projectRoot, 'official-engine', 'examples', 'assets', 'splats', 'apartment.sog'),
        voxelParams: '0.05,0.1',
        collisionMesh: true
    },
    {
        name: 'biker',
        input: path.join(projectRoot, 'official-engine', 'examples', 'assets', 'splats', 'biker.compressed.ply'),
        voxelParams: '0.02,0.03',
        collisionMesh: true
    }
];

const outputDir = path.join(projectRoot, 'generated', 'volumes');

const formatBytes = (bytes) => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

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
                return;
            }

            reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}`));
        });
    });
};

const ensureCleanOutputDir = async () => {
    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });
};

const listOutputsFor = async (prefix) => {
    const entries = await readdir(outputDir, { withFileTypes: true });
    const matching = entries
        .filter((entry) => entry.isFile() && entry.name.startsWith(`${prefix}.`))
        .map((entry) => entry.name)
        .sort();

    return Promise.all(matching.map(async (name) => {
        const fullPath = path.join(outputDir, name);
        const info = await stat(fullPath);
        return {
            name,
            fullPath,
            size: info.size
        };
    }));
};

const main = async () => {
    console.log('Preparing generated/volumes output directory...');
    await ensureCleanOutputDir();

    for (const asset of assets) {
        const outputVoxelJson = path.join(outputDir, `${asset.name}.voxel.json`);

        console.log(`\n=== Processing ${asset.name} ===`);
        console.log(`Input: ${asset.input}`);
        console.log(`Output: ${outputVoxelJson}`);

        await run(
            process.execPath,
            [
                splatTransformCli,
                '-w',
                '--voxel-params',
                asset.voxelParams,
                ...(asset.collisionMesh ? ['-K'] : []),
                asset.input,
                outputVoxelJson
            ],
            projectRoot
        );

        const outputs = await listOutputsFor(asset.name);
        if (outputs.length === 0) {
            console.warn(`No outputs were found for ${asset.name}.`);
            continue;
        }

        console.log(`Generated files for ${asset.name}:`);
        for (const output of outputs) {
            console.log(`- ${output.name} (${formatBytes(output.size)})`);
        }
    }

    console.log('\nDone. Generated artifacts are in:');
    console.log(outputDir);
};

main().catch((error) => {
    console.error('\nSplat transform test failed.');
    console.error(error);
    process.exitCode = 1;
});
