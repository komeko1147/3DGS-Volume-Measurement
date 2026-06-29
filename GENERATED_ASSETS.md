# Generated Assets Regeneration Guide

這份文件說明本專案中可重新生成的資產檔案，以及它們生成後會分布在哪些資料夾。這些檔案通常不應該 push 到 GitHub；在新的裝置上 clone 專案後，依照本文執行腳本即可重新產生。

## 前置需求

先在專案根目錄安裝 Node 依賴：

```sh
npm install
```

下列 Node 腳本會使用 `@playcanvas/splat-transform` 產生 `.ply`、`.voxel.json`、`.voxel.bin`、`.collision.glb` 等資產。

部分研究用 Python 腳本還需要額外的本地 Python 環境與外部工具：

- `.venv-research/Scripts/python.exe`
- `numpy`
- `trimesh`
- `open3d`
- `plyfile`
- `external_method/3DGS-to-PC`

`external_method/` 是本地端外部工具資料夾，不需要 push 到 GitHub；如果新的裝置也要跑研究流程，需要另外把對應工具與 Python 環境準備好。

## 快速生成常用本地資產

通常先跑這兩個指令，就能產生 official-engine example 會用到的 synthetic splat、voxel 和 collision assets：

```sh
npm run generate:test-splats
npm run generate:surface-test-splats
```

如果也需要 apartment / biker 的 voxel 與 collision assets，再跑：

```sh
npm run test:splat-transform
```

## 指令與輸出位置

### `npm run generate:test-splats`

執行檔：

```text
tools/generate-test-splats.mjs
```

用途：

- 產生實心測試物件 splats。
- 目前包含 `testCube`、`testSphere`、`testCylinder`。
- 使用 `@playcanvas/splat-transform` 產生 voxel 與 collision mesh。

主要輸出：

```text
generated/test-splats/testCube.ply
generated/test-splats/testCube.voxel.json
generated/test-splats/testCube.voxel.bin
generated/test-splats/testCube.collision.glb

generated/test-splats/testSphere.*
generated/test-splats/testCylinder.*
```

腳本也會自動複製到 official-engine example 需要的位置：

```text
official-engine/examples/assets/splats/testCube.ply
official-engine/examples/assets/splats/testSphere.ply
official-engine/examples/assets/splats/testCylinder.ply

official-engine/examples/assets/volumes/testCube.voxel.json
official-engine/examples/assets/volumes/testCube.voxel.bin
official-engine/examples/assets/volumes/testCube.collision.glb

official-engine/examples/assets/volumes/testSphere.*
official-engine/examples/assets/volumes/testCylinder.*
```

此外也會複製到 examples dist 靜態目錄：

```text
official-engine/examples/dist/static/assets/splats/
official-engine/examples/dist/static/assets/volumes/
```

### `npm run generate:surface-test-splats`

執行檔：

```text
tools/generate-surface-test-splats.mjs
```

用途：

- 產生表面型 synthetic splats。
- 目前包含 `surfaceCube`、`surfaceSphere`、`surfaceCylinder`、`surfaceTetrahedron`、`surfaceCone`、`surfaceTorus`、`surfaceCapsule`、`surfacePyramid`。
- 使用 `@playcanvas/splat-transform` 產生 voxel 與 collision mesh。

主要輸出：

```text
generated/surface-test-splats/surfaceCube.ply
generated/surface-test-splats/surfaceCube.voxel.json
generated/surface-test-splats/surfaceCube.voxel.bin
generated/surface-test-splats/surfaceCube.collision.glb

generated/surface-test-splats/surfaceSphere.*
generated/surface-test-splats/surfaceCylinder.*
generated/surface-test-splats/surfaceTetrahedron.*
generated/surface-test-splats/surfaceCone.*
generated/surface-test-splats/surfaceTorus.*
generated/surface-test-splats/surfaceCapsule.*
generated/surface-test-splats/surfacePyramid.*
```

腳本也會自動複製到 official-engine example 需要的位置：

```text
official-engine/examples/assets/splats/surfaceCube.ply
official-engine/examples/assets/splats/surfaceSphere.ply
official-engine/examples/assets/splats/surfaceCylinder.ply
official-engine/examples/assets/splats/surfaceTetrahedron.ply
official-engine/examples/assets/splats/surfaceCone.ply
official-engine/examples/assets/splats/surfaceTorus.ply
official-engine/examples/assets/splats/surfaceCapsule.ply
official-engine/examples/assets/splats/surfacePyramid.ply

official-engine/examples/assets/volumes/surfaceCube.voxel.json
official-engine/examples/assets/volumes/surfaceCube.voxel.bin
official-engine/examples/assets/volumes/surfaceCube.collision.glb

official-engine/examples/assets/volumes/surfaceSphere.*
official-engine/examples/assets/volumes/surfaceCylinder.*
official-engine/examples/assets/volumes/surfaceTetrahedron.*
official-engine/examples/assets/volumes/surfaceCone.*
official-engine/examples/assets/volumes/surfaceTorus.*
official-engine/examples/assets/volumes/surfaceCapsule.*
official-engine/examples/assets/volumes/surfacePyramid.*
```

### `npm run test:splat-transform`

執行檔：

```text
tools/test-splat-transform.mjs
```

用途：

- 從 official-engine 既有 splat asset 產生 voxel 與 collision mesh。
- 目前處理 `apartment` 與 `biker`。

輸入來源：

```text
official-engine/examples/assets/splats/apartment.sog
official-engine/examples/assets/splats/biker.compressed.ply
```

主要輸出：

```text
generated/volumes/apartment.voxel.json
generated/volumes/apartment.voxel.bin
generated/volumes/apartment.collision.glb

generated/volumes/biker.voxel.json
generated/volumes/biker.voxel.bin
generated/volumes/biker.collision.glb
```

注意：這個腳本只寫入 `generated/volumes/`，不會自動複製到 `official-engine/examples/assets/volumes/`。如果 official-engine example 需要這些檔案，需自行複製或用後續研究準備流程確認資產位置。

## 研究流程資產

研究流程會產生 `research-volume` 相關 manifests、PLY mesh、GLB mesh。這些檔案體積較大，而且需要 Python 環境與外部工具。

### `npm run prepare:research-volume`

執行檔：

```text
tools/prepare-research-volume.mjs
```

用途：

- 準備研究流程輸入資料。
- 產生 synthetic camera transforms。
- 產生或更新 `*.research-volume.json` manifest。
- 會讀取 `generated/volumes/` 與 `official-engine/examples/assets/volumes/` 中的 voxel/collision baseline。

主要輸出：

```text
generated/research-volume/<object>/transforms.synthetic.json
generated/research-volume/biker/biker.standard.ply

official-engine/examples/assets/volumes/research/<object>.research-volume.json
```

目前 `<object>` 包含：

```text
biker
testCube
testSphere
testCylinder
surfaceCube
surfaceSphere
surfaceCylinder
```

### `npm run run:research-volume`

執行檔：

```text
tools/run-research-volume.py
```

用途：

- 呼叫本地 `external_method/3DGS-to-PC` 做 3DGS-to-PC reconstruction。
- 輸出點雲、surface points、mesh。
- 將 mesh 轉成 official-engine example 可載入的 `.glb`。
- 更新 `*.research-volume.json` manifest。

主要輸出：

```text
generated/research-volume/<object>/<object>.3dgs-to-pc.points.ply
generated/research-volume/<object>/<object>.3dgs-to-pc.surface-points.ply
generated/research-volume/<object>/<object>.3dgs-to-pc.mesh.ply

official-engine/examples/assets/volumes/research/<object>.3dgs-to-pc.glb
official-engine/examples/assets/volumes/research/<object>.research-volume.json
```

### `npm run run:density-surface-volume`

執行檔：

```text
tools/run-density-surface-volume.py
```

用途：

- 從 Gaussian density / occupancy field 產生 surface mesh。
- 輸出 density-direct 與 occupancy-sdf 相關 mesh。
- 可透過腳本參數輸出 threshold sweep 版本。
- 更新 `*.research-volume.json` manifest。

主要輸出：

```text
generated/research-volume/<object>/<object>.density-direct.mesh.ply
generated/research-volume/<object>/<object>.occupancy-sdf.mesh.ply

official-engine/examples/assets/volumes/research/<object>.density-direct.glb
official-engine/examples/assets/volumes/research/<object>.occupancy-sdf.glb
official-engine/examples/assets/volumes/research/<object>.research-volume.json
```

如果使用 threshold sweep，還會產生類似：

```text
generated/research-volume/biker/biker.density-direct-t001.mesh.ply
generated/research-volume/biker/biker.occupancy-sdf-t001.mesh.ply

official-engine/examples/assets/volumes/research/biker.density-direct-t001.glb
official-engine/examples/assets/volumes/research/biker.occupancy-sdf-t001.glb
```

## 建議的重新生成順序

在新的裝置上，如果只需要 official-engine editor example 的 synthetic objects：

```sh
npm install
npm run generate:test-splats
npm run generate:surface-test-splats
```

如果還需要 apartment / biker voxel baseline：

```sh
npm run test:splat-transform
```

如果還需要研究頁面的 manifests 與 mesh comparison：

```sh
npm run prepare:research-volume
npm run run:research-volume
npm run run:density-surface-volume
```

研究流程前請先確認 `.venv-research`、Python 套件和 `external_method/3DGS-to-PC` 已在本地準備完成。

## 建議不要 push 的產物

以下路徑屬於可重新生成的本地產物，建議加入 `.gitignore`：

```gitignore
generated/
official-engine/examples/assets/splats/test*.ply
official-engine/examples/assets/splats/surface*.ply
official-engine/examples/assets/volumes/
official-engine/examples/dist/
```

如果你需要保留 official-engine 的程式碼修改，請只追蹤 source code 檔案，例如：

```text
official-engine/examples/src/examples/gaussian-splatting/*.mjs
```

不要把上述 generated assets 一起 commit。
