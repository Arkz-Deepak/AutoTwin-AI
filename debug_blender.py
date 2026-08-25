import bpy, math
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.wm.obj_import(filepath=r'C:\Projects\DigitalTwin\cad_model\28000.obj')
obj = bpy.context.selected_objects[0]
bpy.context.view_layer.objects.active = obj
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
obj.location = (0,0,0)
obj.rotation_euler = (math.radians(90),0,math.radians(90))
max_dim = max(obj.dimensions)
obj.scale = (4.0/max_dim,4.0/max_dim,4.0/max_dim)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
for block in bpy.data.materials:
    if block.users == 0: bpy.data.materials.remove(block)
mat = bpy.data.materials.new('Mat'); mat.use_nodes=True; bsdf=mat.node_tree.nodes['Principled BSDF']; bsdf.inputs['Base Color'].default_value=(0.2,0.2,0.2,1); bsdf.inputs['Metallic'].default_value=0.5; bsdf.inputs['Roughness'].default_value=0.4; obj.data.materials.clear(); obj.data.materials.append(mat)
# camera setup 1
bpy.ops.object.camera_add(location=(0,0,10))
cam = bpy.context.object
cam.data.type='ORTHO'
cam.data.ortho_scale=2.0
cam.rotation_euler=(0,0,0)
scene = bpy.context.scene
scene.camera = cam
scene.render.engine='CYCLES'; scene.cycles.samples=8; scene.render.resolution_x=512; scene.render.resolution_y=512; scene.render.filepath=r'C:\Projects\DigitalTwin\debug_default.png'; scene.cycles.use_denoising=False
bpy.ops.render.render(write_still=True)
# camera setup 2
cam.location=(0,0,10)
cam.rotation_euler=(math.radians(90),0,0)
scene.render.filepath=r'C:\Projects\DigitalTwin\debug_rot90.png'
bpy.ops.render.render(write_still=True)
print('done')
