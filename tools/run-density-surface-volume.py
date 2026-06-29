import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import open3d as o3d
from plyfile import PlyData
import trimesh


PROJECT_ROOT = Path(__file__).resolve().parent.parent
GENERATED_DIR = PROJECT_ROOT / "generated" / "research-volume"
ASSET_DIR = PROJECT_ROOT / "official-engine" / "examples" / "assets" / "volumes" / "research"
OBJECTS = ("testCube", "testSphere", "testCylinder", "biker")
CALIBRATION_OBJECTS = ("testCube", "testSphere", "testCylinder")
METHODS = ("density-direct", "occupancy-sdf")


def sha256(filename):
    result = hashlib.sha256()
    with open(filename, "rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def read_manifest(name):
    path = ASSET_DIR / f"{name}.research-volume.json"
    with open(path, "r", encoding="utf8") as source:
        return path, json.load(source)


def write_manifest(path, result):
    with open(path, "w", encoding="utf8") as target:
        json.dump(result, target, indent=2)
        target.write("\n")


def sigmoid(values):
    output = np.empty_like(values, dtype=np.float32)
    positive = values >= 0
    output[positive] = 1 / (1 + np.exp(-values[positive]))
    exp_values = np.exp(values[~positive])
    output[~positive] = exp_values / (1 + exp_values)
    return output


def read_gaussian_ply(path):
    vertex = PlyData.read(path)["vertex"].data
    positions = np.column_stack((vertex["x"], vertex["y"], vertex["z"])).astype(np.float32)
    scales = np.exp(np.column_stack((vertex["scale_0"], vertex["scale_1"], vertex["scale_2"]))).astype(np.float32)
    opacities = sigmoid(np.asarray(vertex["opacity"], dtype=np.float32)).astype(np.float32)
    finite = np.isfinite(positions).all(axis=1) & np.isfinite(scales).all(axis=1) & np.isfinite(opacities)
    return positions[finite], scales[finite], opacities[finite]


def build_grid_bounds(positions, scales, sigma_cutoff):
    padding = float(np.percentile(np.max(scales, axis=1), 99.5) * sigma_cutoff)
    padding = max(padding, 1e-4)
    return positions.min(axis=0) - padding, positions.max(axis=0) + padding


def gaussian_kernel1d(sigma_vox):
    if sigma_vox < 0.35:
        return np.array([1.0], dtype=np.float32)
    radius = max(1, int(math.ceil(sigma_vox * 3)))
    offsets = np.arange(-radius, radius + 1, dtype=np.float32)
    kernel = np.exp(-0.5 * (offsets / sigma_vox) ** 2)
    kernel /= kernel.sum()
    return kernel.astype(np.float32)


def convolve_axis(volume, kernel, axis):
    if len(kernel) == 1:
        return volume
    pad = len(kernel) // 2
    padded = np.pad(volume, [(pad, pad) if i == axis else (0, 0) for i in range(3)], mode="edge")
    moved = np.moveaxis(padded, axis, 0)
    output = np.empty_like(np.moveaxis(volume, axis, 0))
    for i in range(output.shape[0]):
        window = moved[i:i + len(kernel)]
        output[i] = np.tensordot(kernel, window, axes=(0, 0))
    return np.moveaxis(output, 0, axis)


def evaluate_density_field(positions, scales, opacities, resolution, sigma_cutoff, normalization_percentile, field_mode):
    if field_mode != "fast-approximation":
        raise NotImplementedError(
            "exact-anisotropic density evaluation is reserved for a follow-up pass; "
            "use --field-mode fast-approximation for the current research viewer pipeline."
        )

    grid_min, grid_max = build_grid_bounds(positions, scales, sigma_cutoff)
    extent = grid_max - grid_min
    pitch = float(np.max(extent) / resolution)
    grid_max = grid_min + pitch * resolution

    coords = np.floor((positions - grid_min) / pitch).astype(np.int64)
    valid = np.all((coords >= 0) & (coords < resolution), axis=1)
    coords = coords[valid]
    weights = opacities[valid]

    field = np.zeros((resolution, resolution, resolution), dtype=np.float32)
    flat = np.ravel_multi_index((coords[:, 0], coords[:, 1], coords[:, 2]), field.shape)
    np.add.at(field.ravel(), flat, weights)

    # First version uses a deterministic center-density approximation with a
    # global Gaussian blur derived from median scale. This keeps multi-million
    # filled test objects tractable while preserving a smooth density field.
    sigma_world = float(np.median(np.mean(scales[valid], axis=1)))
    sigma_vox = max(0.0, sigma_world / pitch)
    kernel = gaussian_kernel1d(sigma_vox)
    for axis in range(3):
        field = convolve_axis(field, kernel, axis)

    positive = field[field > 0]
    normalizer = float(np.percentile(positive, normalization_percentile)) if positive.size else 1.0
    normalizer = max(normalizer, 1e-8)
    normalized = np.clip(field / normalizer, 0, 8).astype(np.float32)
    return normalized, {
        "gridMin": grid_min.tolist(),
        "gridMax": grid_max.tolist(),
        "pitch": pitch,
        "normalizer": normalizer,
        "sigmaWorldMedian": sigma_world,
        "sigmaVoxelMedian": sigma_vox,
        "fieldMode": field_mode,
        "densityApproximation": "fast-weighted-center-histogram-plus-global-median-gaussian-blur",
        "anisotropicCovarianceEvaluation": False
    }


def open3d_isosurface(field_xyz, level, grid_info):
    # Open3D expects volume indexing [z, y, x], and returns vertices in x/y/z
    # index coordinates where voxel center 0 maps to the first scalar sample.
    volume_zyx = np.transpose(field_xyz, (2, 1, 0)).astype(np.float32)
    mesh_t = o3d.t.geometry.TriangleMesh.create_isosurfaces(o3d.core.Tensor(volume_zyx), [float(level)])
    vertices = mesh_t.vertex.positions.numpy().astype(np.float64)
    faces = mesh_t.triangle.indices.numpy().astype(np.int64)
    grid_min = np.asarray(grid_info["gridMin"], dtype=np.float64)
    pitch = float(grid_info["pitch"])
    vertices = grid_min + (vertices + 0.5) * pitch
    return trimesh.Trimesh(vertices=vertices, faces=faces, process=True)


def keep_largest_component(mesh):
    parts = mesh.split(only_watertight=False)
    if len(parts) <= 1:
        return mesh, len(parts)
    largest = max(parts, key=lambda part: len(part.faces))
    return trimesh.Trimesh(vertices=largest.vertices, faces=largest.faces, process=True), len(parts)


def repair_normals(mesh):
    trimesh.repair.fix_normals(mesh, multibody=True)
    return mesh


def validate_and_export(mesh, object_name, method_id, display_scale, output_suffix=None):
    mesh = repair_normals(mesh)
    mesh, component_count = keep_largest_component(mesh)
    watertight = bool(mesh.is_watertight)
    volume_native = abs(float(mesh.volume)) if watertight else None
    scale = math.prod(abs(axis) for axis in display_scale)
    volume_scene = volume_native * scale if watertight else None

    object_dir = GENERATED_DIR / object_name
    object_dir.mkdir(parents=True, exist_ok=True)
    suffix = output_suffix or method_id
    ply_path = object_dir / f"{object_name}.{suffix}.mesh.ply"
    glb_path = ASSET_DIR / f"{object_name}.{suffix}.glb"
    mesh.export(ply_path)
    mesh.export(glb_path)
    return {
        "meshAsset": f"volumes/research/{object_name}.{suffix}.glb",
        "meshPath": str(ply_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "meshSha256": sha256(glb_path),
        "volumeNative": volume_native,
        "volumeScene": volume_scene,
        "watertight": watertight,
        "componentCount": component_count,
        "meshBounds": mesh.bounds.tolist() if len(mesh.vertices) else None,
        "status": "ready" if watertight else "invalid",
        "message": None if watertight else "Generated density surface mesh is not watertight; volume is not reported."
    }


def binary_closing_once(occupancy):
    padded = np.pad(occupancy, 1, mode="constant", constant_values=False)
    dilated = np.zeros_like(occupancy)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                dilated |= padded[1 + dx:1 + dx + occupancy.shape[0],
                                  1 + dy:1 + dy + occupancy.shape[1],
                                  1 + dz:1 + dz + occupancy.shape[2]]
    padded = np.pad(dilated, 1, mode="constant", constant_values=True)
    eroded = np.ones_like(occupancy)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                eroded &= padded[1 + dx:1 + dx + occupancy.shape[0],
                                 1 + dy:1 + dy + occupancy.shape[1],
                                 1 + dz:1 + dz + occupancy.shape[2]]
    return eroded


def compute_signed_distance_from_mesh(mesh, grid_info, resolution, chunk_size=262144):
    legacy = o3d.geometry.TriangleMesh(
        o3d.utility.Vector3dVector(mesh.vertices),
        o3d.utility.Vector3iVector(mesh.faces)
    )
    mesh_t = o3d.t.geometry.TriangleMesh.from_legacy(legacy)
    scene = o3d.t.geometry.RaycastingScene()
    scene.add_triangles(mesh_t)

    grid_min = np.asarray(grid_info["gridMin"], dtype=np.float32)
    pitch = np.float32(grid_info["pitch"])
    axis_x = grid_min[0] + (np.arange(resolution, dtype=np.float32) + 0.5) * pitch
    axis_y = grid_min[1] + (np.arange(resolution, dtype=np.float32) + 0.5) * pitch
    axis_z = grid_min[2] + (np.arange(resolution, dtype=np.float32) + 0.5) * pitch
    sdf = np.empty((resolution, resolution, resolution), dtype=np.float32)
    zz, yy, xx = np.meshgrid(axis_z, axis_y, axis_x, indexing="ij")
    points_zyx = np.column_stack((xx.ravel(), yy.ravel(), zz.ravel())).astype(np.float32)
    out = np.empty(points_zyx.shape[0], dtype=np.float32)
    for start in range(0, len(points_zyx), chunk_size):
        end = min(start + chunk_size, len(points_zyx))
        values = scene.compute_signed_distance(o3d.core.Tensor(points_zyx[start:end])).numpy()
        out[start:end] = values
    return np.transpose(out.reshape((resolution, resolution, resolution)), (2, 1, 0))


def method_direct(field, iso_level, grid_info, name, display_scale, method_id="density-direct", output_suffix=None):
    mesh = open3d_isosurface(field, iso_level, grid_info)
    return validate_and_export(mesh, name, method_id, display_scale, output_suffix)


def method_occupancy_sdf(field, iso_level, grid_info, name, display_scale, method_id="occupancy-sdf", output_suffix=None):
    occupancy = field >= iso_level
    occupancy = binary_closing_once(occupancy)
    mesh = open3d_isosurface(occupancy.astype(np.float32), 0.5, grid_info)
    return validate_and_export(mesh, name, method_id, display_scale, output_suffix)


def upsert_method(result, method):
    methods = [existing for existing in result.get("methods", []) if existing.get("id") != method["id"]]
    preferred = ["3dgs-to-pc", "density-direct", "occupancy-sdf"]
    methods.append(method)
    result["methods"] = sorted(methods, key=lambda item: (
        preferred.index(item.get("id")) if item.get("id") in preferred else 10,
        item.get("parameters", {}).get("isoLevel", 999),
        item.get("id", "")
    ))


def build_method_record(method_id, label, output, grid_info, args, iso_level, calibration_summary):
    method = {
        "id": method_id,
        "label": label,
        "status": output["status"],
        "cameraSource": "not-required",
        "meshAsset": output["meshAsset"],
        "volumeNative": output["volumeNative"],
        "volumeScene": output["volumeScene"],
        "watertight": output["watertight"],
        "parameters": {
            "field": "normalized-gaussian-density",
            "fieldMode": args.field_mode,
            "gridResolution": args.grid_resolution,
            "sigmaCutoff": args.sigma_cutoff,
            "densityPercentileNormalization": args.normalization_percentile,
            "isoLevel": iso_level,
            "componentPolicy": "largest-component",
            "densityApproximation": grid_info["densityApproximation"],
            "anisotropicCovarianceEvaluation": grid_info["anisotropicCovarianceEvaluation"]
        },
        "diagnostics": {
            "componentCount": output["componentCount"],
            "meshBounds": output["meshBounds"],
            "gridBounds": [grid_info["gridMin"], grid_info["gridMax"]],
            "gridPitch": grid_info["pitch"],
            "thresholdSource": "test-object-calibration",
            "calibration": calibration_summary
        },
        "meshSha256": output["meshSha256"],
        "meshPath": output["meshPath"],
        "message": output["message"]
    }
    if method_id.startswith("occupancy-sdf"):
        method["parameters"]["cleanup"] = {
            "keepLargestComponent": True,
            "smallComponentRatio": 0.005,
            "binaryClosingIterations": 1
        }
        method["parameters"]["sdfLevel"] = 0
        method["parameters"]["sdfApproximation"] = "occupancy-boundary-sdf-approximation"
        method["message"] = method["message"] or "Occupancy-SDF v1 uses binary occupancy boundary isosurface because scipy distance_transform_edt is not installed."
    return method


def threshold_tag(value):
    return f"t{int(round(value * 1000)):03d}"


def parse_thresholds(raw):
    if not raw:
        return [0.02, 0.04, 0.06, 0.08, 0.10, 0.15, 0.20, 0.30]
    return [float(item.strip()) for item in raw.split(",") if item.strip()]


def relative_error(volume, expected):
    if volume is None or not expected:
        return None
    return abs(volume - expected) / expected


def calibrate(args):
    thresholds = np.linspace(args.threshold_min, args.threshold_max, args.threshold_steps).tolist()
    summaries = {method_id: [] for method_id in METHODS}
    fields = {}
    manifests = {}

    for name in CALIBRATION_OBJECTS:
        manifest_path, result = read_manifest(name)
        positions, scales, opacities = read_gaussian_ply(PROJECT_ROOT / result["standardizedInput"])
        field, grid_info = evaluate_density_field(
            positions, scales, opacities, args.grid_resolution, args.sigma_cutoff,
            args.normalization_percentile, args.field_mode
        )
        fields[name] = (field, grid_info)
        manifests[name] = (manifest_path, result)

    best = {}
    for method_id in METHODS:
        best_score = math.inf
        best_threshold = thresholds[0]
        rows = []
        for threshold in thresholds:
            errors = []
            for name, (field, grid_info) in fields.items():
                expected = manifests[name][1].get("expectedVolume")
                if method_id == "density-direct":
                    mesh = open3d_isosurface(field, threshold, grid_info)
                else:
                    occupancy = binary_closing_once(field >= threshold)
                    mesh = open3d_isosurface(occupancy.astype(np.float32), 0.5, grid_info)
                mesh, _component_count = keep_largest_component(repair_normals(mesh))
                watertight = bool(mesh.is_watertight)
                volume = abs(float(mesh.volume)) if watertight else None
                err = relative_error(volume, expected)
                if err is not None:
                    errors.append(err)
            score = float(np.mean(errors)) if errors else math.inf
            rows.append({"isoLevel": threshold, "meanRelativeError": None if not math.isfinite(score) else score})
            if score < best_score:
                best_score = score
                best_threshold = threshold
        best[method_id] = {
            "isoLevel": best_threshold,
            "meanRelativeError": None if not math.isfinite(best_score) else best_score,
            "thresholdSweep": rows
        }

    return best, fields, manifests


def run_object(name, args, thresholds, cached=None):
    manifest_path, result = cached if cached else read_manifest(name)
    if name in cached_fields:
        field, grid_info = cached_fields[name]
    else:
        positions, scales, opacities = read_gaussian_ply(PROJECT_ROOT / result["standardizedInput"])
        field, grid_info = evaluate_density_field(
            positions, scales, opacities, args.grid_resolution, args.sigma_cutoff,
            args.normalization_percentile, args.field_mode
        )

    direct_output = method_direct(field, thresholds["density-direct"]["isoLevel"], grid_info, name, result["displayScale"])
    direct = build_method_record(
        "density-direct", "Density Iso-Surface", direct_output, grid_info, args,
        thresholds["density-direct"]["isoLevel"], thresholds["density-direct"]
    )
    expected = result.get("expectedVolume")
    direct["diagnostics"]["relativeError"] = relative_error(direct["volumeNative"], expected)
    upsert_method(result, direct)

    sdf_output = method_occupancy_sdf(field, thresholds["occupancy-sdf"]["isoLevel"], grid_info, name, result["displayScale"])
    sdf = build_method_record(
        "occupancy-sdf", "Occupancy-SDF", sdf_output, grid_info, args,
        thresholds["occupancy-sdf"]["isoLevel"], thresholds["occupancy-sdf"]
    )
    sdf["diagnostics"]["relativeError"] = relative_error(sdf["volumeNative"], expected)
    upsert_method(result, sdf)

    result["status"] = "ready" if any(method.get("status") == "ready" for method in result["methods"]) else result.get("status")
    write_manifest(manifest_path, result)
    print(f"Completed {name}: direct={direct['volumeScene']} occupancy-sdf={sdf['volumeScene']}")


def run_threshold_sweep_object(name, args):
    manifest_path, result = read_manifest(name)
    positions, scales, opacities = read_gaussian_ply(PROJECT_ROOT / result["standardizedInput"])
    field, grid_info = evaluate_density_field(
        positions, scales, opacities, args.grid_resolution, args.sigma_cutoff,
        args.normalization_percentile, args.field_mode
    )
    expected = result.get("expectedVolume")
    thresholds = parse_thresholds(args.sweep_thresholds)
    for threshold in thresholds:
        tag = threshold_tag(threshold)
        direct_id = f"density-direct-{tag}"
        direct_output = method_direct(
            field, threshold, grid_info, name, result["displayScale"],
            method_id=direct_id, output_suffix=direct_id
        )
        direct = build_method_record(
            direct_id, f"Density t={threshold:.3f}", direct_output, grid_info, args,
            threshold, {"isoLevel": threshold, "thresholdSource": "manual-sweep"}
        )
        direct["diagnostics"]["relativeError"] = relative_error(direct["volumeNative"], expected)
        direct["diagnostics"]["thresholdSource"] = "manual-sweep"
        upsert_method(result, direct)

        sdf_id = f"occupancy-sdf-{tag}"
        sdf_output = method_occupancy_sdf(
            field, threshold, grid_info, name, result["displayScale"],
            method_id=sdf_id, output_suffix=sdf_id
        )
        sdf = build_method_record(
            sdf_id, f"Occ-SDF t={threshold:.3f}", sdf_output, grid_info, args,
            threshold, {"isoLevel": threshold, "thresholdSource": "manual-sweep"}
        )
        sdf["diagnostics"]["relativeError"] = relative_error(sdf["volumeNative"], expected)
        sdf["diagnostics"]["thresholdSource"] = "manual-sweep"
        upsert_method(result, sdf)

        print(f"Completed {name} threshold {threshold:.2f}: direct={direct['volumeScene']} occupancy-sdf={sdf['volumeScene']}")

    result["status"] = "ready" if any(method.get("status") == "ready" for method in result["methods"]) else result.get("status")
    write_manifest(manifest_path, result)


cached_fields = {}


def main():
    parser = argparse.ArgumentParser(description="Generate density-derived surface meshes and volumes.")
    parser.add_argument("--object", choices=OBJECTS, action="append", dest="objects")
    parser.add_argument("--grid-resolution", type=int, default=160)
    parser.add_argument("--field-mode", choices=("fast-approximation", "exact-anisotropic"), default="fast-approximation")
    parser.add_argument("--sigma-cutoff", type=float, default=3.0)
    parser.add_argument("--normalization-percentile", type=float, default=99.5)
    parser.add_argument("--threshold-min", type=float, default=0.02)
    parser.add_argument("--threshold-max", type=float, default=0.80)
    parser.add_argument("--threshold-steps", type=int, default=20)
    parser.add_argument("--export-threshold-sweep", action="store_true")
    parser.add_argument("--sweep-thresholds", default="0.02,0.04,0.06,0.08,0.10,0.15,0.20,0.30")
    args = parser.parse_args()

    if args.export_threshold_sweep:
        objects = args.objects or ("biker",)
        for name in objects:
            run_threshold_sweep_object(name, args)
        return

    thresholds, fields, manifests = calibrate(args)
    cached_fields.update(fields)
    objects = args.objects or OBJECTS
    for name in objects:
        run_object(name, args, thresholds, manifests.get(name))


if __name__ == "__main__":
    main()
