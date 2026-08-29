import json
import math
import os
import random
import time
from pathlib import Path

import bpy

ROOT = Path(r"C:\Projects\DigitalTwin")
OBJ_PATH = ROOT / "cad_model" / "28000.obj"
OUTPUT_DIR = ROOT / "synthetic_dataset" / "joint_top_view"

# Configuration (can be overridden via environment variables)
NUM_IMAGES = int(os.environ.get('NUM_IMAGES', '5000'))
RENDER_RESOLUTION = int(os.environ.get('RENDER_RESOLUTION', '1024'))
RENDER_SAMPLES = int(os.environ.get('RENDER_SAMPLES', '24'))
RENDER_ENGINE = os.environ.get('RENDER_ENGINE', 'CYCLES').upper()  # 'CYCLES' or 'EEVEE'
RANDOM_SEED = int(os.environ.get('RANDOM_SEED', '7'))

random.seed(RANDOM_SEED)


def clear_scene():
    """Wipes the scene datablocks cleanly."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)
    for block in bpy.data.lights:
        if block.users == 0:
            bpy.data.lights.remove(block)
    for block in bpy.data.cameras:
        if block.users == 0:
            bpy.data.cameras.remove(block)


def load_model():
    """Imports the CAD chassis OBJ file and joins meshes if multi-part."""
    t0 = time.time()
    bpy.ops.wm.obj_import(filepath=str(OBJ_PATH))
    imported = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
    if not imported:
        raise RuntimeError(f"No mesh objects found in {OBJ_PATH}")
    if len(imported) > 1:
        bpy.context.view_layer.objects.active = imported[0]
        bpy.ops.object.join()
    mesh = bpy.context.active_object
    mesh.name = 'CadChassis'
    print(f"Loaded CAD model in {time.time() - t0:.2f}s (Vertices: {len(mesh.data.vertices):,})")
    return mesh


def normalize_mesh(obj):
    """Centers the chassis origin and scales to a normalized bounding dimension."""
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)

    max_dim = max(obj.dimensions)
    if max_dim > 0:
        obj.scale = (4.0 / max_dim, 4.0 / max_dim, 4.0 / max_dim)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Realistic structural chassis steel/coating PBR material
    mat = bpy.data.materials.new(name='ChassisMetal')
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.22, 0.23, 0.24, 1.0)
    bsdf.inputs['Metallic'].default_value = 0.65
    bsdf.inputs['Roughness'].default_value = 0.35
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def enable_gpu_if_available():
    """Configures hardware acceleration using OptiX or CUDA for NVIDIA GPUs."""
    try:
        prefs = bpy.context.preferences
        cycles_prefs = prefs.addons['cycles'].preferences
        for dev_type in ('OPTIX', 'CUDA'):
            try:
                cycles_prefs.compute_device_type = dev_type
                cycles_prefs.get_devices()
                gpu_count = 0
                for d in cycles_prefs.devices:
                    if d.type != 'CPU':
                        d.use = True
                        gpu_count += 1
                    else:
                        d.use = False
                if gpu_count > 0:
                    bpy.context.scene.cycles.device = 'GPU'
                    print(f"Cycles GPU acceleration enabled: {dev_type} ({gpu_count} device(s))")
                    return dev_type
            except Exception:
                continue
    except Exception as e:
        print("Warning: Could not configure Cycles GPU acceleration:", e)
    return None


def setup_scene():
    """Sets up optimized rendering engine, lighting, camera, and persistent buffers."""
    scene = bpy.context.scene
    scene.render.resolution_x = RENDER_RESOLUTION
    scene.render.resolution_y = RENDER_RESOLUTION
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'

    if RENDER_ENGINE == 'EEVEE':
        available_engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
        scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in available_engines else 'BLENDER_EEVEE'
        print(f"Using EEVEE real-time render engine: {scene.render.engine}")
    else:
        scene.render.engine = 'CYCLES'
        gpu_backend = enable_gpu_if_available()
        if not gpu_backend:
            scene.cycles.device = 'CPU'
            print("Using CPU rendering for Cycles")
        else:
            scene.cycles.device = 'GPU'

        scene.cycles.samples = RENDER_SAMPLES
        scene.cycles.use_denoising = True
        if gpu_backend == 'OPTIX':
            scene.cycles.denoiser = 'OPTIX'
        else:
            scene.cycles.denoiser = 'OPENIMAGEDENOISE'

        # Optimize light bounces for maximum speed without sacrificing surface quality
        scene.cycles.max_bounces = 3
        scene.cycles.diffuse_bounces = 2
        scene.cycles.glossy_bounces = 2
        scene.cycles.transparent_max_bounces = 2
        scene.cycles.transmission_bounces = 0
        scene.cycles.volume_bounces = 0

        # Enable persistent data to avoid re-uploading geometry to GPU on each frame
        scene.render.use_persistent_data = True

    # Setup world background
    world = scene.world.node_tree
    world_nodes = world.nodes
    world_links = world.links
    while world_nodes:
        world_nodes.remove(world_nodes[0])
    bg = world_nodes.new(type='ShaderNodeBackground')
    bg.inputs['Color'].default_value = (0.12, 0.12, 0.14, 1.0)
    bg.inputs['Strength'].default_value = 1.0
    out = world_nodes.new(type='ShaderNodeOutputWorld')
    world_links.new(bg.outputs['Background'], out.inputs['Surface'])

    # Create persistent camera once
    cam_data = bpy.data.cameras.new(name='DatasetCamera')
    cam_obj = bpy.data.objects.new('DatasetCamera', cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 1.0
    cam_obj.location = (0.0, 0.0, 10.0)
    cam_obj.rotation_euler = (0.0, 0.0, 0.0)

    # Create persistent light rig once
    lights = []
    light_positions = [
        (5.0, -5.0, 8.0),
        (-6.0, 4.0, 10.0),
        (0.0, 0.0, 16.0),
    ]
    for idx, loc in enumerate(light_positions):
        ldata = bpy.data.lights.new(name=f"RigLight_{idx}", type='AREA')
        lobj = bpy.data.objects.new(f"RigLight_{idx}", ldata)
        bpy.context.collection.objects.link(lobj)
        lobj.location = loc
        ldata.shape = 'RECTANGLE'
        ldata.energy = 2200.0
        ldata.size = 3.5
        ldata.size_y = 3.5
        lights.append((lobj, ldata))

    return cam_obj, cam_data, lights, bg


# Structural CAD Joints (True structural junctions with high vertex & feature density)
STRUCTURAL_JOINTS = {
    'front_suspension_left': {
        'name': 'Front Left Suspension & Cross-Member Joint',
        'coord': (-1.480, -0.303, -0.095),
        'desc': 'Intersection of front tubular cross-member, upper/lower A-arm suspension bracket, and main longitudinal rail.'
    },
    'front_suspension_right': {
        'name': 'Front Right Suspension & Cross-Member Joint',
        'coord': (-1.494, 0.303, -0.084),
        'desc': 'Right-hand intersection of front cross-tube, suspension control arm mounts, and chassis rail.'
    },
    'engine_trans_mount': {
        'name': 'Engine / Transmission Cross-Member Bracket Joint',
        'coord': (-1.104, 0.304, -0.117),
        'desc': 'Heavy-duty gusseted mounting junction on the right frame rail with complex structural stiffeners.'
    },
    'rear_suspension_perch': {
        'name': 'Rear Suspension Spring Perch & Rail Joint',
        'coord': (0.680, -0.457, -0.027),
        'desc': 'Rear axle kick-up structural joint with spring perch tower and shock absorber mount.'
    },
    'rear_hitch_crossmember': {
        'name': 'Rear Cross-Member / Tow Hitch Flange Joint',
        'coord': (1.710, 0.409, 0.014),
        'desc': 'Rearmost structural cross-member junction with reinforced hitch mounting plates.'
    }
}

SELECTED_JOINT_KEY = os.environ.get('SELECTED_JOINT', 'front_suspension_left')


def select_joint_target(chassis):
    """Returns the 3D target coordinate and metadata for the selected structural joint."""
    joint_info = STRUCTURAL_JOINTS.get(SELECTED_JOINT_KEY, STRUCTURAL_JOINTS['front_suspension_left'])
    print(f"Targeting Structural Joint: {joint_info['name']} at {joint_info['coord']}")
    return joint_info['coord'], joint_info['name']


def render_joint_reference(chassis, joint_target, cam_obj, cam_data, output_dir):
    """Generates full-chassis and zoomed reference images with ground-truth joint indicator."""
    scene = bpy.context.scene

    # Create marker sphere
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=joint_target)
    marker = bpy.context.active_object
    marker.name = 'JointMarker'
    marker_mat = bpy.data.materials.new(name='JointMarkerMat')
    marker_bsdf = marker_mat.node_tree.nodes['Principled BSDF']
    marker_bsdf.inputs['Base Color'].default_value = (1.0, 0.05, 0.05, 1.0)
    marker_bsdf.inputs['Emission Color'].default_value = (1.0, 0.05, 0.05, 1.0)
    marker_bsdf.inputs['Emission Strength'].default_value = 8.0
    marker.data.materials.append(marker_mat)

    # 1) Full top-view overview
    cam_data.ortho_scale = 4.6
    cam_obj.location = (0.0, 0.0, 12.0)
    chassis.location = (0.0, 0.0, 0.0)
    chassis.rotation_euler = (0.0, 0.0, 0.0)
    scene.render.filepath = str(output_dir / "selected_joint_reference_top_full.png")
    bpy.ops.render.render(write_still=True)

    # 2) Centered crop view
    cam_data.ortho_scale = 1.0
    chassis.location = (-joint_target[0], -joint_target[1], 0.0)
    chassis.rotation_euler = (0.0, 0.0, 0.0)
    scene.render.filepath = str(output_dir / "selected_joint_reference_top_crop.png")
    bpy.ops.render.render(write_still=True)

    bpy.data.objects.remove(marker, do_unlink=True)


def generate_dataset(chassis, joint_target, joint_name, cam_obj, cam_data, lights, bg_node, output_dir, count):
    """Renders synthetic variations with zero CPU disk-thrashing and direct GPU updates."""
    scene = bpy.context.scene
    bg_choices = [
        (0.12, 0.12, 0.14, 1.0),
        (0.18, 0.19, 0.22, 1.0),
        (0.08, 0.11, 0.15, 1.0),
        (0.17, 0.14, 0.12, 1.0),
        (0.20, 0.20, 0.18, 1.0),
        (0.10, 0.10, 0.10, 1.0),
    ]

    manifest = []
    t_start = time.time()

    for index in range(1, count + 1):
        t_frame = time.time()

        # Bounded randomization ensures the structural joint is always sharply framed
        joint_x = joint_target[0] + random.uniform(-0.16, 0.16)
        joint_y = joint_target[1] + random.uniform(-0.16, 0.16)
        chassis.location = (-joint_x, -joint_y, 0.0)
        chassis.rotation_euler = (0.0, 0.0, random.uniform(-5.0, 5.0) * (math.pi / 180.0))

        # Camera scale and distance variation
        cam_data.ortho_scale = random.uniform(0.85, 1.20)
        cam_obj.location = (0.0, 0.0, 10.0 + random.uniform(0.0, 2.0))

        # Background color jitter
        chosen_bg = random.choice(bg_choices)
        bg_node.inputs['Color'].default_value = chosen_bg

        # Dynamic lighting variation
        for lobj, ldata in lights:
            ldata.energy = random.uniform(1200.0, 3400.0)
            ldata.size = random.uniform(2.2, 5.5)
            ldata.size_y = random.uniform(2.2, 5.5)
            lobj.rotation_euler = (math.radians(60), 0.0, random.uniform(-90, 90) * (math.pi / 180.0))

        # Render frame
        filename = f"joint_{index:05d}.png"
        filepath = output_dir / filename
        scene.render.filepath = str(filepath)
        bpy.ops.render.render(write_still=True)

        frame_duration = time.time() - t_frame
        elapsed = time.time() - t_start
        fps = index / elapsed
        eta_seconds = (count - index) / fps if fps > 0 else 0
        eta_str = time.strftime('%H:%M:%S', time.gmtime(eta_seconds))

        if index <= 5 or index % 25 == 0 or index == count:
            print(f"[{index:5d}/{count}] {frame_duration:.2f}s/frame | Speed: {fps:.2f} fps | ETA: {eta_str}")

        manifest.append({
            'index': index,
            'filename': filename,
            'joint_name': joint_name,
            'view_type': 'top_orthographic',
            'camera_ortho_scale': round(cam_data.ortho_scale, 4),
            'camera_location': [round(v, 4) for v in cam_obj.location],
            'chassis_rotation_deg': round(math.degrees(chassis.rotation_euler[2]), 2),
            'target_point': [round(joint_x, 4), round(joint_y, 4), round(joint_target[2], 4)],
            'background_rgb': [round(v, 3) for v in chosen_bg[:3]],
        })

    return manifest


def main():
    clear_scene()
    cam_obj, cam_data, lights, bg_node = setup_scene()
    chassis = load_model()
    chassis = normalize_mesh(chassis)
    joint_target, joint_name = select_joint_target(chassis)

    output_dir = OUTPUT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    print("\n--- Generating Reference Images ---")
    render_joint_reference(chassis, joint_target, cam_obj, cam_data, output_dir)

    print(f"\n--- Starting Generation of {NUM_IMAGES} Synthetic Dataset Images ---")
    manifest = generate_dataset(chassis, joint_target, joint_name, cam_obj, cam_data, lights, bg_node, output_dir, NUM_IMAGES)

    manifest_path = output_dir / 'manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as fp:
        json.dump(manifest, fp, indent=2)

    print(f"\nSuccessfully generated {NUM_IMAGES} synthetic images in {output_dir}")
    print(f"Manifest written to: {manifest_path}")



if __name__ == '__main__':
    main()