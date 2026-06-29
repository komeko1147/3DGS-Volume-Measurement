import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys

import numpy as np
import trimesh


PROJECT_ROOT = Path(__file__).resolve().parent.parent
GENERATED_DIR = PROJECT_ROOT / "generated" / "research-volume"
ASSET_DIR = PROJECT_ROOT / "official-engine" / "examples" / "assets" / "volumes" / "research"
VOLUME_DIR = PROJECT_ROOT / "official-engine" / "examples" / "assets" / "volumes"
METHOD_DIR = PROJECT_ROOT / "external_method" / "3DGS-to-PC"
OBJECTS = ("surfaceCube", "surfaceSphere", "surfaceCylinder", "testCube", "testSphere", "testCylinder", "biker")


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


def measure_collision_baseline(name, display_scale):
    collision_path = VOLUME_DIR / f"{name}.collision.glb"
    if not collision_path.exists():
        return None
    collision = trimesh.load(collision_path, force="scene")
    native = sum(abs(geometry.volume) for geometry in collision.geometry.values())
    scale = math.prod(abs(axis) for axis in display_scale)
    return native * scale


def seal_simple_boundary_loops(mesh):
    if mesh.is_watertight:
        return mesh, {
            "id": "cap-simple-boundary-loops",
            "applied": False,
            "boundaryLoops": [],
            "message": "Raw Poisson mesh is already watertight."
        }

    edge_counts = np.bincount(mesh.edges_unique_inverse)
    if np.any(edge_counts > 2):
        return mesh, {
            "id": "cap-simple-boundary-loops",
            "applied": False,
            "boundaryLoops": [],
            "message": "Mesh contains non-manifold edges; boundary sealing was skipped."
        }

    boundary_edges = mesh.edges_unique[edge_counts == 1]
    adjacency = {}
    for start, end in boundary_edges:
        adjacency.setdefault(int(start), []).append(int(end))
        adjacency.setdefault(int(end), []).append(int(start))

    if not adjacency or any(len(neighbors) != 2 for neighbors in adjacency.values()):
        return mesh, {
            "id": "cap-simple-boundary-loops",
            "applied": False,
            "boundaryLoops": [],
            "message": "Mesh boundary is not a set of simple closed loops; sealing was skipped."
        }

    visited = set()
    loops = []
    for start in adjacency:
        if start in visited:
            continue
        loop = []
        previous = None
        current = start
        while current not in visited:
            visited.add(current)
            loop.append(current)
            next_vertices = [vertex for vertex in adjacency[current] if vertex != previous]
            if not next_vertices:
                return mesh, {
                    "id": "cap-simple-boundary-loops",
                    "applied": False,
                    "boundaryLoops": [],
                    "message": "Boundary traversal failed; sealing was skipped."
                }
            previous, current = current, next_vertices[0]
        loops.append(loop)

    vertices = mesh.vertices.tolist()
    faces = mesh.faces.tolist()
    for loop in loops:
        center = np.asarray(mesh.vertices[loop]).mean(axis=0)
        center_index = len(vertices)
        vertices.append(center.tolist())
        for index in range(len(loop)):
            faces.append([loop[index], loop[(index + 1) % len(loop)], center_index])

    sealed = trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=True)
    trimesh.repair.fix_normals(sealed, multibody=True)
    return sealed, {
        "id": "cap-simple-boundary-loops",
        "applied": True,
        "boundaryLoops": [len(loop) for loop in loops],
        "message": "Simple boundary loops were sealed before volume validation."
    }


def run_reconstruction(name, args):
    manifest_path, result = read_manifest(name)
    method = result["methods"][0]
    input_path = PROJECT_ROOT / result["standardizedInput"]
    transforms_path = PROJECT_ROOT / result["syntheticCamera"]["transformsPath"]
    object_dir = GENERATED_DIR / name
    object_dir.mkdir(parents=True, exist_ok=True)
    point_cloud_path = object_dir / f"{name}.3dgs-to-pc.points.ply"
    surface_point_cloud_path = object_dir / f"{name}.3dgs-to-pc.surface-points.ply"
    mesh_path = object_dir / f"{name}.3dgs-to-pc.mesh.ply"
    glb_path = ASSET_DIR / f"{name}.3dgs-to-pc.glb"

    command = [
        sys.executable,
        str(METHOD_DIR / "gauss_to_pc.py"),
        "--input_path", str(input_path),
        "--transform_path", str(transforms_path),
        "--renderer_type", "cuda",
        "--max_sh_degree", "0",
        "--num_points", str(args.num_points),
        "--colour_quality", args.colour_quality,
        "--seed", str(args.seed),
        "--generate_mesh",
        "--poisson_depth", str(args.poisson_depth),
        "--laplacian_iterations", str(args.laplacian_iterations),
        "--output_path", str(point_cloud_path),
        "--surface_output_path", str(surface_point_cloud_path),
        "--mesh_output_path", str(mesh_path)
    ]
    uniform_surface_sampling = result.get("representation") == "oriented-surface-gaussians"
    if uniform_surface_sampling:
        command.append("--no_prioritise_visible_gaussians")

    method["status"] = "running"
    method["parameters"].update({
        "numPoints": args.num_points,
        "colourQuality": args.colour_quality,
        "seed": args.seed,
        "uniformSurfaceSampling": uniform_surface_sampling,
        "poissonDepth": args.poisson_depth,
        "laplacianIterations": args.laplacian_iterations
    })
    write_manifest(manifest_path, result)

    try:
        subprocess.run(command, cwd=METHOD_DIR, check=True)
        raw_mesh = trimesh.load(mesh_path, force="mesh", process=True)
        mesh, repair = seal_simple_boundary_loops(raw_mesh)
        watertight = bool(mesh.is_watertight)
        volume_native = abs(float(mesh.volume)) if watertight else None
        volume_scene = volume_native * math.prod(abs(axis) for axis in result["displayScale"]) if watertight else None
        mesh.export(glb_path)

        method.update({
            "status": "ready" if watertight else "invalid",
            "meshAsset": f"volumes/research/{name}.3dgs-to-pc.glb",
            "surfacePointCloud": str(surface_point_cloud_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "volumeNative": volume_native,
            "volumeScene": volume_scene,
            "watertight": watertight,
            "rawWatertight": bool(raw_mesh.is_watertight),
            "meshRepair": repair,
            "meshSha256": sha256(glb_path),
            "message": repair["message"] if watertight and repair["applied"] else
                (None if watertight else "Generated mesh is not watertight; volume is not reported.")
        })
    except Exception as error:
        method.update({
            "status": "error",
            "meshAsset": None,
            "volumeNative": None,
            "volumeScene": None,
            "watertight": None,
            "meshSha256": None,
            "message": str(error)
        })
        write_manifest(manifest_path, result)
        raise

    result["baselines"]["collisionMeshVolumeScene"] = measure_collision_baseline(name, result["displayScale"])
    result["status"] = method["status"]
    write_manifest(manifest_path, result)
    print(f"Completed {name}: {method['volumeScene']} scene units^3")


def main():
    parser = argparse.ArgumentParser(description="Run 3DGS-to-PC research volume generation.")
    parser.add_argument("--object", choices=OBJECTS, action="append", dest="objects")
    parser.add_argument("--num-points", type=int, default=500000)
    parser.add_argument("--colour-quality", default="tiny")
    parser.add_argument("--seed", type=int, default=1337)
    parser.add_argument("--poisson-depth", type=int, default=10)
    parser.add_argument("--laplacian-iterations", type=int, default=10)
    args = parser.parse_args()
    objects = args.objects or OBJECTS

    for name in objects:
        run_reconstruction(name, args)


if __name__ == "__main__":
    main()
