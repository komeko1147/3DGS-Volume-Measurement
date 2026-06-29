# 3DGS Volume Measurement

This repository contains a PlayCanvas / Gaussian Splatting volume-measurement experiment.

It has two main parts:

- A small Vite demo in the repository root.
- A modified copy of `official-engine/` with PlayCanvas Gaussian Splatting examples extended for selection, voxel, collision mesh, and research volume measurements.

Do not use `npm create playcanvas@latest` to reproduce this project. That command creates a new generic PlayCanvas project and will not include the modified `official-engine` example code in this repository.

## Requirements

- Node.js 18 or newer
- npm
- Optional, for research-only pipelines:
  - local `.venv-research`
  - Python packages such as `numpy`, `trimesh`, `open3d`, `plyfile`
  - local `external_method/3DGS-to-PC`

The optional research environment and external methods are intentionally not committed.

## Root Demo

Install dependencies from the repository root:

```sh
npm install
```

Run the root Vite demo:

```sh
npm run dev
```

Build the root demo:

```sh
npm run build
```

## Generate Local Assets

Generated assets are not committed. Recreate them locally when needed.

For solid synthetic test objects such as `testCube.ply`, `testSphere.ply`, and `testCylinder.ply`:

```sh
npm run generate:test-splats
```

For surface synthetic objects such as `surfaceCube.ply`, `surfaceSphere.ply`, `surfaceCylinder.ply`, and related shapes:

```sh
npm run generate:surface-test-splats
```

These scripts write files under `generated/` and copy the assets needed by the PlayCanvas examples into:

```text
official-engine/examples/assets/splats/
official-engine/examples/assets/volumes/
```

For apartment / biker voxel and collision outputs:

```sh
npm run test:splat-transform
```

For the full generated-asset map and research pipeline details, see:

```text
GENERATED_ASSETS.md
```

## Modified PlayCanvas Engine Examples

The volume-measurement work lives mainly in:

```text
official-engine/examples/src/examples/gaussian-splatting/editor.example.mjs
official-engine/examples/src/examples/gaussian-splatting/editor.controls.mjs
official-engine/examples/src/examples/gaussian-splatting/editor-for-research.example.mjs
```

To run the modified official-engine examples, install dependencies for the engine and examples:

```sh
cd official-engine
npm install

cd examples
npm install
```

Build the engine from `official-engine/` when needed:

```sh
cd official-engine
npm run build
```

Run the examples browser from `official-engine/examples/`:

```sh
cd official-engine/examples
npm run develop
```

The examples server uses port `5555` by default.

Before opening the modified Gaussian Splatting volume examples, regenerate the local assets from the repository root:

```sh
npm run generate:test-splats
npm run generate:surface-test-splats
```

## Research Pipeline

The research pipeline is optional and depends on local Python and external-method setup.

Prepare research manifests:

```sh
npm run prepare:research-volume
```

Run 3DGS-to-PC reconstruction:

```sh
npm run run:research-volume
```

Run density / occupancy surface volume generation:

```sh
npm run run:density-surface-volume
```

These commands generate local files under:

```text
generated/research-volume/
official-engine/examples/assets/volumes/research/
```

## Git Notes

Large generated files and local dependency folders are ignored, including:

```text
node_modules/
dist/
generated/
external_method/
.venv-research/
official-engine/examples/assets/splats/test*.ply
official-engine/examples/assets/splats/surface*.ply
official-engine/examples/assets/volumes/
official-engine/examples/dist/
```

If a fresh clone is missing `surfaceCube.ply`, `testCube.ply`, or `.voxel` / `.collision` files, regenerate them with the npm scripts above instead of downloading them from Git.
