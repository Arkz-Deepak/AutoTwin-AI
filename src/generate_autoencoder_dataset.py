import json
import math
import os
import random
import time
from pathlib import Path

import bpy

# ---------------------------------------------------------
# Step 0: Path & Configuration Setup
# ---------------------------------------------------------
ROOT = Path(r"C:\Projects\DigitalTwin")
OBJ_PATH = ROOT / "cad_model" / "28000.obj"
OUTPUT_DIR = ROOT / "synthetic_dataset" / "autoencoder_baseline"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

NUM_ITERATIONS = int(os.environ.get('NUM_IMAGES', '100'))
RENDER_RESOLUTION = int(os.environ.get('RENDER_RESOLUTION', '1024'))
RENDER_SAMPLES = int(os.environ.get('RENDER_SAMPLES', '24'))
RANDOM_SEED = int(os.environ.get('RANDOM_SEED', '42'))

random.seed(RANDOM_SEED)

# ---------------------------------------------------------
# Step 1: Clear Scene
# ---------------------------------------------------------
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

# ---------------------------------------------------------
# Step 2: Import OBJ & Center Geometry
# ---------------------------------------------------------
t0 = time.time()
bpy.ops.wm.obj_import(filepath=str(OBJ_PATH))
imported = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
if not imported:
    raise RuntimeError(f"No mesh objects found in {OBJ_PATH}")
if len(imported) > 1:
    bpy.context.view_layer.objects.active = imported[0]
    bpy.ops.object.join()
chassis = bpy.context.active_object
chassis.name = 'CadChassis'

bpy.context.view_layer.objects.active = chassis
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
chassis.location = (0.0, 0.0, 0.0)
chassis.rotation_euler = (0.0, 0.0, 0.0)

max_dim = max(chassis.dimensions)
if max_dim > 0:
    chassis.scale = (4.0 / max_dim, 4.0 / max_dim, 4.0 / max_dim)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
print(f"Loaded CAD Chassis in {time.time() - t0:.2f}s ({len(chassis.data.vertices):,} vertices)")

# ---------------------------------------------------------
# Step 3: Material Setup (PBR Structural Chassis Steel)
# ---------------------------------------------------------
mat = bpy.data.materials.new(name='ChassisSteel')
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.28, 0.29, 0.31, 1.0)
bsdf.inputs['Metallic'].default_value = 0.75
bsdf.inputs['Roughness'].default_value = 0.28
chassis.data.materials.clear()
chassis.data.materials.append(mat)

# ---------------------------------------------------------
# Step 4: Render Engine & GPU OptiX Acceleration
# ---------------------------------------------------------
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.render.resolution_x = RENDER_RESOLUTION
scene.render.resolution_y = RENDER_RESOLUTION
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'

try:
    prefs = bpy.context.preferences
    cycles_prefs = prefs.addons['cycles'].preferences
    for dev_type in ('OPTIX', 'CUDA'):
        try:
            cycles_prefs.compute_device_type = dev_type
            cycles_prefs.get_devices()
            gpu_found = False
            for d in cycles_prefs.devices:
                if d.type != 'CPU':
                    d.use = True
                    gpu_found = True
                else:
                    d.use = False
            if gpu_found:
                scene.cycles.device = 'GPU'
                scene.cycles.use_denoising = True
                scene.cycles.denoiser = 'OPTIX' if dev_type == 'OPTIX' else 'OPENIMAGEDENOISE'
                print(f"Hardware Acceleration: {dev_type} GPU enabled")
                break
        except Exception:
            continue
except Exception as e:
    print("Cycles GPU init notice:", e)

scene.cycles.samples = RENDER_SAMPLES
scene.cycles.max_bounces = 3
scene.cycles.diffuse_bounces = 2
scene.cycles.glossy_bounces = 2
scene.cycles.transparent_max_bounces = 2
scene.cycles.transmission_bounces = 0
scene.cycles.volume_bounces = 0
scene.render.use_persistent_data = True

# World Background
world = scene.world.node_tree
world.nodes.clear()
bg = world.nodes.new(type='ShaderNodeBackground')
bg.inputs['Color'].default_value = (0.06, 0.07, 0.08, 1.0)
bg.inputs['Strength'].default_value = 1.0
out = world.nodes.new(type='ShaderNodeOutputWorld')
world.links.new(bg.outputs['Background'], out.inputs['Surface'])

# ---------------------------------------------------------
# Step 5: Macro Top-Down Orthographic Camera Targeting Suspension Bracket
# ---------------------------------------------------------
TARGET_BRACKET_COORD = (-1.480, -0.303, -0.095)

cam_data = bpy.data.cameras.new(name='MacroCamera')
camera_obj = bpy.data.objects.new('MacroCamera', cam_data)
bpy.context.collection.objects.link(camera_obj)
scene.camera = camera_obj

cam_data.type = 'ORTHO'
cam_data.ortho_scale = 0.85  # Macro-level crop on the suspension bracket & weld joint
camera_obj.location = (TARGET_BRACKET_COORD[0], TARGET_BRACKET_COORD[1], 10.0)
camera_obj.rotation_euler = (0.0, 0.0, 0.0)

# ---------------------------------------------------------
# Step 6: Industrial SUN Light Source
# ---------------------------------------------------------
sun_light_data = bpy.data.lights.new(name="Sun", type='SUN')
sun_light_obj = bpy.data.objects.new("Sun", sun_light_data)
bpy.context.collection.objects.link(sun_light_obj)
sun_light_data.energy = 5.0

# Store the baseline/nominal camera position for micro-jitter
base_cam_x = camera_obj.location.x
base_cam_y = camera_obj.location.y
base_cam_z = camera_obj.location.z

# ---------------------------------------------------------
# Auto-Resume Check & Domain Randomization Loop
# ---------------------------------------------------------
manifest_path = OUTPUT_DIR / 'manifest.json'
manifest = []
if manifest_path.exists():
    try:
        with open(manifest_path, 'r', encoding='utf-8') as fp:
            manifest = json.load(fp)
    except Exception:
        manifest = []

# Detect already completed valid images on disk
existing_files = set(f.name for f in OUTPUT_DIR.glob('weld_normal_*.png') if f.stat().st_size > 1000)

start_idx = 0
while f"weld_normal_{start_idx:05d}.png" in existing_files:
    start_idx += 1

# Filter manifest to match existing validated indices
manifest = [entry for entry in manifest if entry.get('index', -1) < start_idx]

print(f"\n===========================================================")
print(f"  Autoencoder Training Dataset Generator")
print(f"  Target Directory: {OUTPUT_DIR}")
print(f"  Total Requested:  {NUM_ITERATIONS:,} Images")
print(f"  Already Rendered: {start_idx:,} Images (Resuming from index {start_idx})")
print(f"  Remaining Frames: {max(0, NUM_ITERATIONS - start_idx):,} Images")
print(f"  Resolution:       {RENDER_RESOLUTION}x{RENDER_RESOLUTION} | Samples: {RENDER_SAMPLES}")
print(f"===========================================================\n")

if start_idx >= NUM_ITERATIONS:
    print(f"Dataset generation already complete! All {NUM_ITERATIONS:,} images are present.")
else:
    t_start = time.time()
    frames_to_render = NUM_ITERATIONS - start_idx

    for i in range(start_idx, NUM_ITERATIONS):
        t_frame = time.time()

        # 1. Lighting Variance (Factory Floor Simulation)
        sun_pitch = math.radians(random.uniform(25.0, 70.0))
        sun_roll = math.radians(random.uniform(-20.0, 20.0))
        sun_yaw = math.radians(random.uniform(-180.0, 180.0))
        sun_light_obj.rotation_euler = (sun_pitch, sun_roll, sun_yaw)
        sun_light_obj.data.energy = random.uniform(3.0, 8.5)

        # 2. Ambient World Tone Shifts (Factory environment variance)
        bg_val = random.uniform(0.04, 0.12)
        bg.inputs['Color'].default_value = (bg_val, bg_val * 1.02, bg_val * 1.05, 1.0)

        # 3. Camera Jitter (Micro-vibrations, mounting tolerance & micro-rotations)
        jitter_x = random.uniform(-0.03, 0.03)
        jitter_y = random.uniform(-0.03, 0.03)
        jitter_z = random.uniform(-0.05, 0.05)
        jitter_rot_z = math.radians(random.uniform(-3.5, 3.5))

        camera_obj.location.x = base_cam_x + jitter_x
        camera_obj.location.y = base_cam_y + jitter_y
        camera_obj.location.z = base_cam_z + jitter_z
        camera_obj.rotation_euler = (0.0, 0.0, jitter_rot_z)

        # 4. Dynamic Sequential File Output (weld_normal_00000.png - weld_normal_04999.png)
        output_filename = f"weld_normal_{i:05d}.png"
        scene.render.filepath = str(OUTPUT_DIR / output_filename)

        # 5. Render and Save
        bpy.ops.render.render(write_still=True)

        frame_dur = time.time() - t_frame
        rendered_count = (i - start_idx) + 1
        elapsed = time.time() - t_start
        fps = rendered_count / elapsed
        eta_s = (NUM_ITERATIONS - (i + 1)) / fps if fps > 0 else 0
        eta_str = time.strftime('%H:%M:%S', time.gmtime(eta_s))

        if (i + 1) <= (start_idx + 5) or (i + 1) % 50 == 0 or (i + 1) == NUM_ITERATIONS:
            pct = ((i + 1) / NUM_ITERATIONS) * 100.0
            print(f"[{i + 1:5d}/{NUM_ITERATIONS:,}] ({pct:5.1f}%) | {frame_dur:.2f}s/frame | Speed: {fps:.2f} fps | ETA: {eta_str} | Saved: {output_filename}")

        manifest.append({
            'index': i,
            'filename': output_filename,
            'joint_target': list(TARGET_BRACKET_COORD),
            'camera_location': [round(v, 5) for v in camera_obj.location],
            'camera_rotation_z_deg': round(math.degrees(jitter_rot_z), 2),
            'sun_rotation_euler': [round(v, 4) for v in sun_light_obj.rotation_euler],
            'sun_energy': round(sun_light_obj.data.energy, 2),
        })

        # Periodically flush manifest to disk every 250 frames for safe checkpointing
        if (i + 1) % 250 == 0 or (i + 1) == NUM_ITERATIONS:
            with open(manifest_path, 'w', encoding='utf-8') as fp:
                json.dump(manifest, fp, indent=2)

    total_elapsed = time.time() - t_start
    print(f"\n===========================================================")
    print(f"  Successfully Generated {NUM_ITERATIONS:,} Images (Ran {frames_to_render:,} new frames in {total_elapsed / 60.0:.1f} min)")
    print(f"  Dataset Saved to: {OUTPUT_DIR}")
    print(f"  Manifest: {manifest_path}")
    print(f"===========================================================\n")



