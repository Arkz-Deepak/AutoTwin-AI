import bpy
import math
import random
import os
from pathlib import Path

# 1. Clean the scene
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

obj_path = r"C:\Projects\DigitalTwin\cad_model\28000.obj"
output_path = r"C:\Projects\DigitalTwin\synthetic_dataset\defective_test.png"
Path(output_path).parent.mkdir(parents=True, exist_ok=True)

# 2. Import and center the chassis
bpy.ops.wm.obj_import(filepath=obj_path)
imported_objs = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
bpy.context.view_layer.objects.active = imported_objs[0]
if len(imported_objs) > 1:
    bpy.ops.object.join()
chassis = bpy.context.active_object

bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
chassis.location = (0, 0, 0)
chassis.rotation_euler = (0.0, 0.0, 0.0)

max_dim = max(chassis.dimensions)
if max_dim > 0:
    scale_val = 4.0 / max_dim
    chassis.scale = (scale_val, scale_val, scale_val)

bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# Material
mat = bpy.data.materials.new(name='ChassisSteel')
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.28, 0.29, 0.31, 1.0)
bsdf.inputs['Metallic'].default_value = 0.75
bsdf.inputs['Roughness'].default_value = 0.28
chassis.data.materials.clear()
chassis.data.materials.append(mat)

# ---------------------------------------------------------
# 3. DEFECT INJECTION (Simulating massive weld spatter / slag blob)
# ---------------------------------------------------------
# Primary trained target joint: (-1.480, -0.303, -0.095)
defect_loc = (-1.480 + 0.02, -0.303 - 0.01, -0.095 + 0.03)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.075, location=defect_loc)
defect = bpy.context.active_object
defect.name = 'WeldDefectBlob'

# Distort it so it looks like an irregular manufacturing slag/weld spatter
defect.scale = (1.2, 0.6, 0.8)
defect.rotation_euler = (math.radians(45), math.radians(120), math.radians(15))

# Dark oxidized slag material
defect_mat = bpy.data.materials.new(name='DefectSlag')
d_bsdf = defect_mat.node_tree.nodes['Principled BSDF']
d_bsdf.inputs['Base Color'].default_value = (0.12, 0.10, 0.09, 1.0)
d_bsdf.inputs['Metallic'].default_value = 0.3
d_bsdf.inputs['Roughness'].default_value = 0.8
defect.data.materials.append(defect_mat)

# 4. Set up Camera (Exact same macro view as baseline training)
cam_x, cam_y, cam_z = -1.480, -0.303, 10.0
bpy.ops.object.camera_add(location=(cam_x, cam_y, cam_z))
cam = bpy.context.object
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 0.85
cam.rotation_euler = (0, 0, 0)
bpy.context.scene.camera = cam

# 5. Lighting Setup
bpy.ops.object.light_add(type='SUN', location=(0, 0, 5))
sun = bpy.context.object
sun.data.energy = 5.5
sun.rotation_euler = (math.radians(45), math.radians(10), math.radians(30))

# 6. Render Settings & OptiX GPU Acceleration
bpy.context.scene.render.engine = 'CYCLES'
try:
    prefs = bpy.context.preferences
    cycles_prefs = prefs.addons['cycles'].preferences
    cycles_prefs.compute_device_type = 'OPTIX'
    cycles_prefs.get_devices()
    for d in cycles_prefs.devices:
        if d.type != 'CPU':
            d.use = True
        else:
            d.use = False
    bpy.context.scene.cycles.device = 'GPU'
except Exception:
    pass

bpy.context.scene.cycles.samples = 64
bpy.context.scene.cycles.use_denoising = True
bpy.context.scene.render.resolution_x = 1024
bpy.context.scene.render.resolution_y = 1024
bpy.context.scene.render.filepath = output_path

bpy.ops.render.render(write_still=True)
print(f"Anomalous render complete! Check {output_path}")
