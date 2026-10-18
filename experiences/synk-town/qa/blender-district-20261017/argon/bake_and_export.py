import bpy
import bmesh
import sys
import os
import time
import math
import json
import numpy as np
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import mat_builder
import geo_builder


def setup_cycles_gpu(samples=512):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    selected_backend = 'NONE'
    for backend in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            gpu_devs = [d for d in prefs.devices if d.type == backend]
            if gpu_devs:
                for d in prefs.devices:
                    d.use = (d.type == backend)
                selected_backend = backend
                break
        except Exception:
            pass
    scene.cycles.device = 'GPU'
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.005
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 2
    scene.cycles.transmission_bounces = 2
    scene.cycles.transparent_max_bounces = 4
    scene.cycles.use_denoising = False
    print(f"[Cycles] Backend={selected_backend}, samples={samples}")
    return selected_backend


def load_and_prepare_occluders():
    """
    Imports reference/v20_surroundings.glb as shadow/bounce-light occluders,
    hooks up vertex Color attributes on surroundings materials so bounce light is accurately tinted,
    and trims ground triangles inside [-2.995, 2.995] x [-3.395, 5.345] (Town coords)
    so they never Z-fight with cafe_ground.
    """
    surr_path = os.path.join(ROOT, "reference", "v20_surroundings.glb")
    before_objs = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=surr_path)
    surr_objs = [o for o in bpy.data.objects if o not in before_objs]

    occ_col = bpy.data.collections.new("Occluders")
    bpy.context.scene.collection.children.link(occ_col)

    visited_mats = set()
    for obj in surr_objs:
        for col in list(obj.users_collection):
            col.objects.unlink(obj)
        occ_col.objects.link(obj)
        if obj.type != 'MESH':
            continue
        me = obj.data
        vcol_name = me.color_attributes[0].name if len(me.color_attributes) > 0 else None
        for mat in me.materials:
            if mat and mat.name not in visited_mats and mat.use_nodes and vcol_name:
                visited_mats.add(mat.name)
                nt = mat.node_tree
                bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                if bsdf:
                    base_col = tuple(bsdf.inputs["Base Color"].default_value)
                    vcol_node = nt.nodes.new("ShaderNodeVertexColor")
                    vcol_node.layer_name = vcol_name
                    mix_node = nt.nodes.new("ShaderNodeMix")
                    mix_node.data_type = 'RGBA'
                    mix_node.blend_type = 'MULTIPLY'
                    mix_node.inputs["Factor"].default_value = 1.0
                    mix_node.inputs[6].default_value = base_col
                    nt.links.new(vcol_node.outputs["Color"], mix_node.inputs[7])
                    nt.links.new(mix_node.outputs[2], bsdf.inputs["Base Color"])

        bm = bmesh.new()
        bm.from_mesh(me)
        faces_to_del = []
        for f in bm.faces:
            if all(v.co.z < 0.22 for v in f.verts):
                pts = [v.co for v in f.verts] + [f.calc_center_median()]
                if any((-2.985 < p.x < 2.985 and -5.335 < p.y < 3.385) for p in pts):
                    faces_to_del.append(f)
        if faces_to_del:
            bmesh.ops.delete(bm, geom=faces_to_del, context='FACES')
            bm.to_mesh(me)
            me.update()
        bm.free()

    return occ_col, surr_objs


def join_and_unwrap_atlas_group(group_name, part_specs, objs_dict, margin=0.0042):
    """
    Tags each object in `part_specs` with an integer polygon attribute `part_id`,
    joins them into a SINGLE Mesh Object `_joined_<group_name>`, and runs Smart UV Project
    on that single mesh so all UV islands across all parts in the atlas are 100% non-overlapping
    with true 3D area-weighted texel density.
    """
    bpy.ops.object.select_all(action='DESELECT')
    group_objs = []
    for part_idx, (obj_name, _mat_name, _rough) in enumerate(part_specs):
        obj = objs_dict[obj_name]
        me = obj.data
        if "part_id" in me.attributes:
            me.attributes.remove(me.attributes["part_id"])
        attr = me.attributes.new(name="part_id", type='INT', domain='FACE')
        attr.data.foreach_set("value", [part_idx] * len(me.polygons))
        me.update()
        obj.select_set(True)
        group_objs.append(obj)

    bpy.context.view_layer.objects.active = group_objs[0]
    if len(group_objs) > 1:
        bpy.ops.object.join()
    joined_obj = bpy.context.view_layer.objects.active
    joined_obj.name = f"_joined_{group_name}"
    joined_obj.data.name = f"_joined_{group_name}"
    for m in list(bpy.data.meshes):
        if m.users == 0:
            bpy.data.meshes.remove(m)

    me = joined_obj.data
    while len(me.uv_layers) > 0:
        me.uv_layers.remove(me.uv_layers[0])
    uv = me.uv_layers.new(name="UVMap")
    me.uv_layers.active = uv
    me.uv_layers.active_index = 0

    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    # angle_limit=82 deg keeps chamfered bevel strips attached to their parent plank/post face
    # area_weight=0.85 scales UV islands proportionally to 3D surface area
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(82.0),
        island_margin=margin,
        area_weight=0.85,
        correct_aspect=True,
        scale_to_bounds=True
    )
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    return joined_obj


def denoise_float_image(img):
    """
    Reads the 32-bit float image buffer directly into NumPy, inpaints zero-luminance occluded
    intersection footprints from surrounding contact-shadow texels so bilinear filtering never
    bleeds black at part intersections, and applies a 2-pass island-masked bilateral filter.
    """
    w, h = img.size
    arr = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(arr)
    rgba = arr.reshape((h, w, 4))
    rgb = np.maximum(rgba[:, :, :3], 0.0)
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    valid = (lum > 1e-4).astype(np.float32)

    # Dilate valid contact-shadow texels into zero-luminance occluded footprints (10 passes)
    for _ in range(10):
        pad_rgb = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode='edge')
        pad_val = np.pad(valid, ((1, 1), (1, 1)), mode='constant', constant_values=0.0)
        sum_rgb = np.zeros_like(rgb)
        sum_val = np.zeros((h, w), dtype=np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nb_v = pad_val[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
                nb_c = pad_rgb[1 + dy:1 + dy + h, 1 + dx:1 + dx + w, :]
                sum_rgb += nb_c * nb_v[:, :, None]
                sum_val += nb_v
        fill_mask = (valid < 0.5) & (sum_val > 0.5)
        rgb = np.where(fill_mask[:, :, None], sum_rgb / np.maximum(sum_val[:, :, None], 1.0), rgb)
        valid = np.where(fill_mask, 1.0, valid)

    sigma_s = 1.20
    sigma_c = 0.035
    for _ in range(2):
        padded_rgb = np.pad(rgb, ((2, 2), (2, 2), (0, 0)), mode='edge')
        padded_val = np.pad(valid, ((2, 2), (2, 2)), mode='constant', constant_values=0.0)
        acc_rgb = np.zeros_like(rgb)
        acc_w = np.zeros((h, w), dtype=np.float32)
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                sw = math.exp(-(dx * dx + dy * dy) / (2.0 * sigma_s * sigma_s))
                nb_rgb = padded_rgb[2 + dy:2 + dy + h, 2 + dx:2 + dx + w, :]
                nb_val = padded_val[2 + dy:2 + dy + h, 2 + dx:2 + dx + w]
                diff2 = np.sum((nb_rgb - rgb) ** 2, axis=2)
                cw = np.exp(-diff2 / (2.0 * sigma_c * sigma_c))
                w_tot = sw * cw * nb_val
                acc_rgb += nb_rgb * w_tot[:, :, None]
                acc_w += w_tot
        rgb = np.where((acc_w > 1e-6)[:, :, None], acc_rgb / np.maximum(acc_w[:, :, None], 1e-6), rgb)

    out = rgba.copy()
    out[:, :, :3] = rgb
    return out


def linear_to_srgb_np(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1.0 / 2.4) - 0.055)


def bake_joined_atlas(group_name, joined_obj, size, samples, sky_path, temp_dir):
    """
    Bakes Total Diffuse (Direct + Indirect + Color) and Direct Sun on `joined_obj`
    into a single `size x size` RGBA 8-bit sRGB image (`tex_bake_<group_name>`).
    """
    t0 = time.time()
    img_tot = bpy.data.images.new(f"_tot_{group_name}", width=size, height=size, alpha=True, float_buffer=True)
    img_tot.colorspace_settings.name = 'Non-Color'
    img_sun = bpy.data.images.new(f"_sun_{group_name}", width=size, height=size, alpha=True, float_buffer=True)
    img_sun.colorspace_settings.name = 'Non-Color'

    def set_active_bake_image(target_img):
        for mat in joined_obj.data.materials:
            if not mat or not mat.use_nodes:
                continue
            nt = mat.node_tree
            tex_node = nt.nodes.get("_bake_target")
            if tex_node is None:
                tex_node = nt.nodes.new("ShaderNodeTexImage")
                tex_node.name = "_bake_target"
                tex_node.location = (-400, -400)
            tex_node.image = target_img
            for n in nt.nodes:
                n.select = False
            tex_node.select = True
            nt.nodes.active = tex_node

    # Pass A: Total Diffuse (Direct + Indirect + Color)
    mat_builder.setup_lighting_and_world(sky_path, sun_only=False)
    bpy.context.scene.cycles.samples = samples
    bpy.context.scene.cycles.max_bounces = 4
    bpy.context.scene.cycles.diffuse_bounces = 3
    bpy.context.scene.cycles.use_denoising = True
    bpy.context.scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    bpy.context.scene.cycles.denoising_use_gpu = True

    bpy.ops.object.select_all(action='DESELECT')
    joined_obj.select_set(True)
    bpy.context.view_layer.objects.active = joined_obj
    set_active_bake_image(img_tot)

    bpy.ops.object.bake(
        type='DIFFUSE',
        pass_filter={'DIRECT', 'INDIRECT', 'COLOR'},
        margin=10,
        margin_type='EXTEND',
        use_clear=True
    )

    tot_rgba = denoise_float_image(img_tot)

    # Pass B: Direct Sun only (sun_only=True, Direct + Color, 64 samples)
    mat_builder.setup_lighting_and_world(sky_path, sun_only=True)
    bpy.context.scene.cycles.samples = 64
    bpy.context.scene.cycles.max_bounces = 0
    bpy.context.scene.cycles.diffuse_bounces = 0
    bpy.context.scene.cycles.use_denoising = False

    bpy.ops.object.select_all(action='DESELECT')
    joined_obj.select_set(True)
    bpy.context.view_layer.objects.active = joined_obj
    set_active_bake_image(img_sun)

    bpy.ops.object.bake(
        type='DIFFUSE',
        pass_filter={'DIRECT', 'COLOR'},
        margin=10,
        margin_type='EXTEND',
        use_clear=True
    )

    sun_arr = np.empty(size * size * 4, dtype=np.float32)
    img_sun.pixels.foreach_get(sun_arr)
    sun_rgba = sun_arr.reshape((size, size, 4))

    for mat in joined_obj.data.materials:
        if mat and mat.use_nodes:
            n = mat.node_tree.nodes.get("_bake_target")
            if n:
                mat.node_tree.nodes.remove(n)

    tot_rgb = np.maximum(tot_rgba[:, :, :3], 0.0)
    sun_rgb = np.maximum(sun_rgba[:, :, :3], 0.0)

    tot_lum = 0.2126 * tot_rgb[:, :, 0] + 0.7152 * tot_rgb[:, :, 1] + 0.0722 * tot_rgb[:, :, 2]
    sun_lum = 0.2126 * sun_rgb[:, :, 0] + 0.7152 * sun_rgb[:, :, 1] + 0.0722 * sun_rgb[:, :, 2]

    valid_mask = tot_lum > 1e-4
    # Clamp minimum sun_alpha to 2/255 (~0.0078) so libwebp never zeroes out RGB where alpha==0
    sun_alpha = np.where(valid_mask, np.clip(sun_lum / np.maximum(tot_lum, 1e-4), 2.0 / 255.0, 1.0), 1.0)

    scaled_linear = tot_rgb * 0.5
    srgb_rgb = linear_to_srgb_np(scaled_linear)

    out_rgba = np.empty((size, size, 4), dtype=np.float32)
    out_rgba[:, :, :3] = srgb_rgb
    out_rgba[:, :, 3] = sun_alpha

    tex_name = f"tex_bake_{group_name}"
    final_img = bpy.data.images.new(tex_name, width=size, height=size, alpha=True, float_buffer=False)
    final_img.colorspace_settings.name = 'sRGB'
    final_img.pixels.foreach_set(out_rgba.ravel())
    final_img.update()

    png_path = os.path.join(temp_dir, f"{tex_name}.png")
    final_img.filepath_raw = png_path
    final_img.file_format = 'PNG'
    final_img.save()
    final_img.pack()

    bpy.data.images.remove(img_tot)
    bpy.data.images.remove(img_sun)

    elapsed = time.time() - t0
    print(f"[Bake] {tex_name} ({size}x{size}) finished in {elapsed:.1f}s")
    return final_img, elapsed


def create_baked_material(mat_name, atlas_img, roughness=0.85, metallic=0.0):
    mat = bpy.data.materials.new(name=mat_name)
    mat.use_nodes = True
    mat["synk_bake_scale"] = 2.0
    mat["synk_sun_alpha"] = 1

    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (100, 0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.location = (-250, 0)
    tex.image = atlas_img

    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def split_joined_by_part_id(joined_obj, part_specs, atlas_img):
    """
    Splits `joined_obj` back into individual `cafe_<part>` objects using polygon attribute `part_id`,
    preserving the exact non-overlapping UVMap coordinates from `joined_obj`, and assigns `bake_<part>`.
    """
    src_me = joined_obj.data
    out_objs = {}
    for part_idx, (obj_name, mat_name, rough) in enumerate(part_specs):
        bm = bmesh.new()
        bm.from_mesh(src_me)
        bm.faces.ensure_lookup_table()
        pid_layer = bm.faces.layers.int.get("part_id")
        del_faces = [f for f in bm.faces if f[pid_layer] != part_idx]
        if del_faces:
            bmesh.ops.delete(bm, geom=del_faces, context='FACES')
        unused_verts = [v for v in bm.verts if not v.link_faces]
        if unused_verts:
            bmesh.ops.delete(bm, geom=unused_verts, context='VERTS')

        new_me = bpy.data.meshes.new(obj_name)
        bm.to_mesh(new_me)
        bm.free()

        while len(new_me.color_attributes) > 0:
            new_me.color_attributes.remove(new_me.color_attributes[0])
        if "part_id" in new_me.attributes:
            new_me.attributes.remove(new_me.attributes["part_id"])

        bmat = create_baked_material(mat_name, atlas_img, roughness=rough, metallic=0.0)
        new_me.materials.clear()
        new_me.materials.append(bmat)
        for p in new_me.polygons:
            p.material_index = 0
            p.use_smooth = True
        new_me.update()

        new_obj = bpy.data.objects.new(obj_name, new_me)
        bpy.context.collection.objects.link(new_obj)
        out_objs[obj_name] = new_obj

    bpy.data.objects.remove(joined_obj, do_unlink=True)
    bpy.data.meshes.remove(src_me)
    return out_objs


def main():
    total_start = time.time()
    work_dir = os.path.join(ROOT, "work")
    out_dir = os.path.join(ROOT, "out")
    os.makedirs(work_dir, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)
    sky_path = os.path.join(ROOT, "sky", "azure-sky-v3.jpg")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bake_samples = 512
    gpu_backend = setup_cycles_gpu(samples=bake_samples)

    # 1. Build procedural materials & cafe district meshes
    mats = mat_builder.build_procedural_materials()
    objs = geo_builder.build_all_cafe_meshes(mats)
    objs['cafe_glass'].hide_render = True

    # 2. Load and prepare surroundings occluders
    occ_col, surr_objs = load_and_prepare_occluders()

    # 3. Balanced 3-atlas layout (2048x2048 each):
    # - ground: cafe_ground
    # - pavilion: cafe_maru, cafe_wall, cafe_ceramic, cafe_metal_lantern (high texel density on close-up hero surfaces)
    # - upper: cafe_timber, cafe_roof, cafe_awning, cafe_foliage
    atlas_plan = {
        "ground": [
            ('cafe_ground', 'bake_ground', 0.93),
        ],
        "pavilion": [
            ('cafe_maru', 'bake_maru', 0.86),
            ('cafe_wall', 'bake_wall', 0.94),
            ('cafe_ceramic', 'bake_ceramic', 0.34),
            ('cafe_metal_lantern', 'bake_metal', 0.48),
        ],
        "upper": [
            ('cafe_timber', 'bake_timber', 0.86),
            ('cafe_roof', 'bake_roof', 0.78),
            ('cafe_awning', 'bake_awning', 0.92),
            ('cafe_foliage', 'bake_foliage', 0.88),
        ],
    }

    joined_groups = {}
    for gname, specs in atlas_plan.items():
        # margin=0.0042 at 2048px is 8.6px (>= 8px spec requirement)
        joined_groups[gname] = join_and_unwrap_atlas_group(gname, specs, objs, margin=0.0042)

    # 4. Bake each joined atlas mesh while all 3 joined meshes + occluders are present in the scene
    atlas_images = {}
    bake_times = {}
    for gname, j_obj in joined_groups.items():
        img, dt = bake_joined_atlas(gname, j_obj, 2048, bake_samples, sky_path, work_dir)
        atlas_images[gname] = img
        bake_times[gname] = round(dt, 2)

    # 5. Split each joined atlas mesh back into individual `cafe_<part>` objects and assign `bake_<part>`
    final_objs = {}
    for gname, specs in atlas_plan.items():
        split_dict = split_joined_by_part_id(joined_groups[gname], specs, atlas_images[gname])
        final_objs.update(split_dict)

    # Restore cafe_glass visibility and clean its vertex Color attribute
    objs['cafe_glass'].hide_render = False
    g_me = objs['cafe_glass'].data
    while len(g_me.color_attributes) > 0:
        g_me.color_attributes.remove(g_me.color_attributes[0])
    final_objs['cafe_glass'] = objs['cafe_glass']

    # 6. Remove surroundings occluders and lights before exporting
    for o in surr_objs:
        if o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(occ_col)
    for o in list(bpy.data.objects):
        if o.type in ('LIGHT', 'CAMERA'):
            bpy.data.objects.remove(o, do_unlink=True)

    bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

    # 7. Save intermediate .blend file to work/cafe-argon.blend
    blend_path = os.path.join(work_dir, "cafe-argon.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)

    # 8. Export GLB to out/cafe-argon.glb
    glb_path = os.path.join(out_dir, "cafe-argon.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_image_format='WEBP',
        export_image_quality=88,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )

    assert os.path.exists(glb_path), f"GLB export failed: {glb_path}"
    glb_size = os.path.getsize(glb_path)
    total_elapsed = round(time.time() - total_start, 2)

    bake_meta = {
        "gpu_backend": gpu_backend,
        "bake_samples_total": bake_samples,
        "bake_samples_sun": 64,
        "bake_times_sec": bake_times,
        "total_pipeline_sec": total_elapsed,
        "glb_size_bytes": glb_size,
        "glb_size_mb": round(glb_size / (1024 * 1024), 3),
    }
    with open(os.path.join(work_dir, "bake_meta.json"), "w", encoding="utf-8") as f:
        json.dump(bake_meta, f, indent=2)

    print("BAKE_AND_EXPORT_SUCCESS:", json.dumps(bake_meta, indent=2))


if __name__ == "__main__":
    main()
