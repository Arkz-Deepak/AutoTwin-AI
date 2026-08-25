import json
from pathlib import Path

import numpy as np
import pyrender
import trimesh
from PIL import Image

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / 'cad_model' / '28000.obj'
OUTPUT_DIR = ROOT / 'synthetic_dataset'


def load_model(path: Path):
    scene = trimesh.load(path, force='scene')
    if isinstance(scene, trimesh.Scene):
        meshes = list(scene.geometry.values())
        if not meshes:
            raise ValueError(f'No geometry found in {path}')
        mesh = trimesh.util.concatenate(meshes)
    else:
        mesh = scene

    if not isinstance(mesh, trimesh.Trimesh):
        raise TypeError(f'Expected a mesh from {path}, got {type(mesh)}')

    if hasattr(mesh, 'merge_vertices'):
        mesh.merge_vertices()
    if hasattr(mesh, 'remove_unreferenced_vertices'):
        mesh.remove_unreferenced_vertices()

    center = mesh.bounding_box.centroid
    mesh.apply_translation(-center)
    max_dim = max(mesh.extents)
    if max_dim > 0:
        mesh.apply_scale(2.0 / max_dim)

    return mesh


def look_at(eye, target, up):
    forward = target - eye
    forward = forward / np.linalg.norm(forward)
    right = np.cross(forward, up)
    right = right / np.linalg.norm(right)
    corrected_up = np.cross(right, forward)
    matrix = np.eye(4)
    matrix[:3, 0] = right
    matrix[:3, 1] = corrected_up
    matrix[:3, 2] = -forward
    matrix[:3, 3] = eye
    return matrix


def render_views(mesh, output_dir: Path, views):
    output_dir.mkdir(parents=True, exist_ok=True)
    renderer = pyrender.OffscreenRenderer(viewport_width=512, viewport_height=512, point_size=1.0)

    mesh_material = pyrender.MetallicRoughnessMaterial(
        baseColorFactor=[0.85, 0.85, 0.85, 1.0],
        metallicFactor=0.2,
        roughnessFactor=0.8,
    )

    manifest = []
    for index, view in enumerate(views, start=1):
        scene = pyrender.Scene(bg_color=[1.0, 1.0, 1.0, 1.0], ambient_light=[0.35, 0.35, 0.35])
        node = pyrender.Node(mesh=pyrender.Mesh.from_trimesh(mesh, material=mesh_material, smooth=True))
        scene.add_node(node)

        distance = 3.5
        azimuth = view['azimuth']
        elevation = view['elevation']
        eye = np.array([
            distance * np.cos(np.deg2rad(azimuth)) * np.cos(np.deg2rad(elevation)),
            distance * np.sin(np.deg2rad(azimuth)) * np.cos(np.deg2rad(elevation)),
            distance * np.sin(np.deg2rad(elevation)),
        ])
        target = np.zeros(3)
        camera = pyrender.PerspectiveCamera(yfov=np.deg2rad(35))
        cam_pose = look_at(eye, target, np.array([0.0, 0.0, 1.0]))
        scene.add(camera, pose=cam_pose)

        sun = pyrender.DirectionalLight(color=np.ones(3), intensity=3.0)
        scene.add(sun, pose=look_at(eye * 0.8 + np.array([0.0, 0.0, 1.0]), target, np.array([0.0, 0.0, 1.0])))

        color, _ = renderer.render(scene)
        image = Image.fromarray(color)
        filename = f'view_{index:02d}_{view["name"]}.png'
        image.save(output_dir / filename)

        manifest.append({
            'filename': filename,
            'name': view['name'],
            'azimuth_deg': azimuth,
            'elevation_deg': elevation,
            'distance': distance,
        })

    return manifest


def main():
    mesh = load_model(MODEL_PATH)
    views = [
        {'name': 'front', 'azimuth': 90, 'elevation': 0},
        {'name': 'top', 'azimuth': 0, 'elevation': 90},
        {'name': 'side', 'azimuth': 0, 'elevation': 0},
        {'name': 'isometric_1', 'azimuth': 45, 'elevation': 25},
        {'name': 'isometric_2', 'azimuth': 135, 'elevation': 20},
        {'name': 'isometric_3', 'azimuth': 225, 'elevation': 15},
    ]

    manifest = render_views(mesh, OUTPUT_DIR, views)
    manifest_path = OUTPUT_DIR / 'manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'Generated {len(manifest)} synthetic views in {OUTPUT_DIR}')
    print(f'Manifest: {manifest_path}')


if __name__ == '__main__':
    main()
