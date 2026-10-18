import bpy
import bmesh
import sys
import os
import time
import math
import json
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "prev", "scripts"))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import mat_builder
import ground_geo


def setup_cycles_gpu(samples=512):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    selected_backend = "NONE"
    for backend in ("OPTIX", "CUDA"):
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
    scene.cycles.device = "GPU"
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
    Loads the 4 buildings:
      - out/town-argon-home.glb (fallback reference/v20_home.glb)
      - out/town-argon-workshop.glb (fallback reference/v20_workshop.glb)
      - out/town-argon-greenhouse.glb (fallback reference/v20_greenhouse.glb)
      - prev/cafe-argon.glb (removing `cafe_ground`)
    plus `reference/v20_live.glb` as shadow and bounce-light occluders.
    """
    occ_col = bpy.data.collections.new("Occluders")
    bpy.context.scene.collection.children.link(occ_col)
    all_occ_objs = []

    building_sources = [
        ("home", os.path.join(ROOT, "out", "town-argon-home.glb"), os.path.join(ROOT, "reference", "v20_home.glb")),
        ("workshop", os.path.join(ROOT, "out", "town-argon-workshop.glb"), os.path.join(ROOT, "reference", "v20_workshop.glb")),
        ("greenhouse", os.path.join(ROOT, "out", "town-argon-greenhouse.glb"), os.path.join(ROOT, "reference", "v20_greenhouse.glb")),
        ("cafe", os.path.join(ROOT, "prev", "cafe-argon.glb"), os.path.join(ROOT, "reference", "v20_cafe.glb")),
    ]

    for b_tag, primary_path, fallback_path in building_sources:
        fpath = primary_path if os.path.exists(primary_path) else fallback_path
        if not os.path.exists(fpath):
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=fpath)
        new_objs = [o for o in bpy.data.objects if o not in before]
        for obj in new_objs:
            if obj.name.startswith("cafe_ground"):
                me_tmp = obj.data
                bpy.data.objects.remove(obj, do_unlink=True)
                if me_tmp and me_tmp.users == 0:
                    bpy.data.meshes.remove(me_tmp)
                continue
            for col in list(obj.users_collection):
                col.objects.unlink(obj)
            occ_col.objects.link(obj)
            all_occ_objs.append(obj)

            if obj.type != "MESH":
                continue
            # Hide glass panes so windows don't cast opaque black shadows
            if "glass" in obj.name.lower() or any("glass" in m.name.lower() for m in obj.data.materials if m):
                obj.hide_render = True
                continue
            # Prevent maru/curb slabs that sit flush on the ground from creating dark intersection rings
            if any(k in obj.name.lower() for k in ("_maru", "_curb", "_sill")):
                obj.visible_shadow = False
                obj.visible_diffuse = False

    # Load reference/v20_live.glb
    live_path = os.path.join(ROOT, "reference", "v20_live.glb")
    if os.path.exists(live_path):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=live_path)
        live_objs = [o for o in bpy.data.objects if o not in before]
        visited_mats = set()

        for obj in live_objs:
            for col in list(obj.users_collection):
                col.objects.unlink(obj)
            occ_col.objects.link(obj)
            all_occ_objs.append(obj)

            if obj.type != "MESH":
                continue
            oname = obj.name
            # Hide ground/water/grass-blade layers in v20_live so they don't Z-fight or blotch the ground bake
            if any(
                oname.startswith(p)
                for p in (
                    "terrainMaterial_",
                    "gardenSoil_",
                    "gravel_",
                    "paving_",
                    "grass_",
                    "water_",
                    "soil_",
                    "env_ffffff_r8_m0_t29",
                )
            ):
                obj.hide_render = True
                continue

            me = obj.data
            for mat in me.materials:
                if not mat or not mat.use_nodes or mat.name in visited_mats:
                    continue
                visited_mats.add(mat.name)
                nt = mat.node_tree
                bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
                out_node = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
                if bsdf and out_node:
                    # Ensure left street bench (_t14) is 100% opaque during baking so both benches cast equal shadows
                    if "_t14" in mat.name:
                        bsdf.inputs["Alpha"].default_value = 1.0
                        nt.links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

                    # Multiply wood/stone textures onto vertex color where needed
                    vcol_node = next((n for n in nt.nodes if n.type == "VERTEX_COLOR"), None)
                    if vcol_node and (mat.name.startswith("wood_ffffff") or mat.name.startswith("env_ffffff_r100_m0_t14")):
                        mix_node = nt.nodes.new("ShaderNodeMix")
                        mix_node.data_type = "RGBA"
                        mix_node.blend_type = "MULTIPLY"
                        mix_node.inputs["Factor"].default_value = 1.0
                        mix_node.inputs[6].default_value = mat_builder.rgba_linear("#c4a274")
                        nt.links.new(vcol_node.outputs["Color"], mix_node.inputs[7])
                        nt.links.new(mix_node.outputs[2], bsdf.inputs["Base Color"])
                    elif vcol_node and mat.name.startswith("stone_ffffff"):
                        mix_node = nt.nodes.new("ShaderNodeMix")
                        mix_node.data_type = "RGBA"
                        mix_node.blend_type = "MULTIPLY"
                        mix_node.inputs["Factor"].default_value = 1.0
                        mix_node.inputs[6].default_value = mat_builder.rgba_linear("#dee0db")
                        nt.links.new(vcol_node.outputs["Color"], mix_node.inputs[7])
                        nt.links.new(mix_node.outputs[2], bsdf.inputs["Base Color"])

    return occ_col, all_occ_objs


def join_and_unwrap_atlas_group(group_name, part_specs, objs_dict, margin=0.0042):
    bpy.ops.object.select_all(action="DESELECT")
    group_objs = []
    for part_idx, (obj_name, _mat_name, _rough) in enumerate(part_specs):
        obj = objs_dict[obj_name]
        me = obj.data
        if "part_id" in me.attributes:
            me.attributes.remove(me.attributes["part_id"])
        attr = me.attributes.new(name="part_id", type="INT", domain="FACE")
        attr.data.foreach_set("value", [part_idx] * len(me.polygons))
        me.update()
        obj.select_set(True)
        group_objs.append(obj)

    bpy.context.view_layer.objects.active = group_objs[0]
    if len(group_objs) > 1:
        bpy.ops.object.join()
    joined_obj = bpy.context.view_layer.objects.active
    joined_obj.name = f"_joined_ground_{group_name}"
    joined_obj.data.name = f"_joined_ground_{group_name}"
    for m in list(bpy.data.meshes):
        if m.users == 0:
            bpy.data.meshes.remove(m)

    me = joined_obj.data
    while len(me.uv_layers) > 0:
        me.uv_layers.remove(me.uv_layers[0])
    uv = me.uv_layers.new(name="UVMap")
    me.uv_layers.active = uv
    me.uv_layers.active_index = 0

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(82.0),
        island_margin=margin,
        area_weight=0.85,
        correct_aspect=True,
        scale_to_bounds=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    return joined_obj


def denoise_float_image(img):
    w, h = img.size
    arr = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(arr)
    rgba = arr.reshape((h, w, 4))
    rgb = np.maximum(rgba[:, :, :3], 0.0)
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    valid = (lum > 1e-4).astype(np.float32)

    for _ in range(10):
        pad_rgb = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode="edge")
        pad_val = np.pad(valid, ((1, 1), (1, 1)), mode="constant", constant_values=0.0)
        sum_rgb = np.zeros_like(rgb)
        sum_val = np.zeros((h, w), dtype=np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nb_v = pad_val[1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w]
                nb_c = pad_rgb[1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w, :]
                sum_rgb += nb_c * nb_v[:, :, None]
                sum_val += nb_v
        fill_mask = (valid < 0.5) & (sum_val > 0.5)
        rgb = np.where(fill_mask[:, :, None], sum_rgb / np.maximum(sum_val[:, :, None], 1.0), rgb)
        valid = np.where(fill_mask, 1.0, valid)

    sigma_s = 1.15
    sigma_c = 0.032
    for _ in range(2):
        padded_rgb = np.pad(rgb, ((2, 2), (2, 2), (0, 0)), mode="edge")
        padded_val = np.pad(valid, ((2, 2), (2, 2)), mode="constant", constant_values=0.0)
        acc_rgb = np.zeros_like(rgb)
        acc_w = np.zeros((h, w), dtype=np.float32)
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                sw = math.exp(-(dx * dx + dy * dy) / (2.0 * sigma_s * sigma_s))
                nb_rgb = padded_rgb[2 + dy : 2 + dy + h, 2 + dx : 2 + dx + w, :]
                nb_val = padded_val[2 + dy : 2 + dy + h, 2 + dx : 2 + dx + w]
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


def bake_joined_atlas(group_name, joined_obj, all_joined_objs, size, samples, sky_path, out_dir):
    t0 = time.time()

    # Hide other ground atlas layers during baking so upper ribbons don't cast black shadows onto lower layers,
    # and disable self-shadowing between overlapping ground layers while keeping full building/tree shadows.
    for g_other, obj_other in all_joined_objs.items():
        if g_other == group_name:
            obj_other.hide_render = False
            obj_other.visible_shadow = False
            obj_other.visible_diffuse = False
        else:
            obj_other.hide_render = True

    img_tot = bpy.data.images.new(f"_tot_ground_{group_name}", width=size, height=size, alpha=True, float_buffer=True)
    img_tot.colorspace_settings.name = "Non-Color"
    img_sun = bpy.data.images.new(f"_sun_ground_{group_name}", width=size, height=size, alpha=True, float_buffer=True)
    img_sun.colorspace_settings.name = "Non-Color"

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
    bpy.context.scene.cycles.use_denoising = False

    bpy.ops.object.select_all(action="DESELECT")
    joined_obj.select_set(True)
    bpy.context.view_layer.objects.active = joined_obj
    set_active_bake_image(img_tot)

    bpy.ops.object.bake(
        type="DIFFUSE",
        pass_filter={"DIRECT", "INDIRECT", "COLOR"},
        margin=10,
        margin_type="EXTEND",
        use_clear=True,
    )

    tot_rgba = denoise_float_image(img_tot)

    # Pass B: Direct Sun only (sun_only=True, Direct + Color, 64 samples)
    mat_builder.setup_lighting_and_world(sky_path, sun_only=True)
    bpy.context.scene.cycles.samples = 64
    bpy.context.scene.cycles.max_bounces = 0
    bpy.context.scene.cycles.diffuse_bounces = 0
    bpy.context.scene.cycles.use_denoising = False

    bpy.ops.object.select_all(action="DESELECT")
    joined_obj.select_set(True)
    bpy.context.view_layer.objects.active = joined_obj
    set_active_bake_image(img_sun)

    bpy.ops.object.bake(
        type="DIFFUSE",
        pass_filter={"DIRECT", "COLOR"},
        margin=10,
        margin_type="EXTEND",
        use_clear=True,
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

    tex_name = f"town-argon-ground-{group_name}"
    final_img = bpy.data.images.new(tex_name, width=size, height=size, alpha=True, float_buffer=False)
    final_img.colorspace_settings.name = "sRGB"
    final_img.pixels.foreach_set(out_rgba.ravel())
    final_img.update()

    png_path = os.path.join(out_dir, f"{tex_name}.png")
    final_img.filepath_raw = png_path
    final_img.file_format = "PNG"
    final_img.save()
    final_img.pack()

    bpy.data.images.remove(img_tot)
    bpy.data.images.remove(img_sun)

    elapsed = time.time() - t0
    print(f"[Bake] {tex_name} ({size}x{size}) finished in {elapsed:.1f}s -> {png_path}")
    return final_img, elapsed


def create_baked_material(mat_name, atlas_img, roughness=0.92, metallic=0.0):
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
    src_me = joined_obj.data
    out_objs = {}
    for part_idx, (obj_name, mat_name, rough) in enumerate(part_specs):
        bm = bmesh.new()
        bm.from_mesh(src_me)
        bm.faces.ensure_lookup_table()
        pid_layer = bm.faces.layers.int.get("part_id")
        del_faces = [f for f in bm.faces if f[pid_layer] != part_idx]
        if del_faces:
            bmesh.ops.delete(bm, geom=del_faces, context="FACES")
        unused_verts = [v for v in bm.verts if not v.link_faces]
        if unused_verts:
            bmesh.ops.delete(bm, geom=unused_verts, context="VERTS")

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

    # 1. Build procedural materials & all 9 ground meshes
    mats = mat_builder.build_procedural_materials()
    objs = ground_geo.build_all_ground_meshes(mats)

    # 2. Load and prepare occluders (4 buildings + v20_live.glb)
    occ_col, occ_objs = load_and_prepare_occluders()

    # 3. 3-atlas layout (2048x2048 each), concentrating texels on court & paths and keeping lawn sparse:
    atlas_plan = {
        "court": [
            ("ground_court", "bake_court", 0.92),
            ("ground_mortar", "bake_mortar", 0.96),
            ("ground_curb", "bake_curb", 0.93),
        ],
        "path": [
            ("ground_path", "bake_path", 0.92),
            ("ground_stepping", "bake_stepping", 0.90),
            ("ground_gravel", "bake_gravel", 0.95),
            ("ground_stones", "bake_stones", 0.91),
        ],
        "lawn": [
            ("ground_lawn", "bake_lawn", 0.98),
            ("ground_soil", "bake_soil", 0.96),
        ],
    }

    joined_groups = {}
    for gname, specs in atlas_plan.items():
        # margin=0.0042 at 2048px is 8.6px (>= 8px spec requirement)
        joined_groups[gname] = join_and_unwrap_atlas_group(gname, specs, objs, margin=0.0042)

    # 4. Bake each joined atlas mesh
    atlas_images = {}
    bake_times = {}
    for gname, j_obj in joined_groups.items():
        img, dt = bake_joined_atlas(gname, j_obj, joined_groups, 2048, bake_samples, sky_path, out_dir)
        atlas_images[gname] = img
        bake_times[gname] = round(dt, 2)

    # 5. Remove occluders and lights and purge orphan materials before creating bake_<part> materials
    for o in occ_objs:
        if o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)
    if occ_col.name in bpy.data.collections:
        bpy.data.collections.remove(occ_col)
    for o in list(bpy.data.objects):
        if o.type in ("LIGHT", "CAMERA"):
            bpy.data.objects.remove(o, do_unlink=True)

    bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

    # 6. Split each joined atlas mesh back into individual `ground_<part>` objects and assign `bake_<part>`
    final_objs = {}
    for gname, specs in atlas_plan.items():
        split_dict = split_joined_by_part_id(joined_groups[gname], specs, atlas_images[gname])
        final_objs.update(split_dict)

    bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

    # 7. Save intermediate .blend file to work/ground_baked.blend
    blend_path = os.path.join(work_dir, "ground_baked.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)

    # 8. Export GLB to out/town-argon-ground.glb
    glb_path = os.path.join(out_dir, "town-argon-ground.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="WEBP",
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
    with open(os.path.join(work_dir, "ground_bake_meta.json"), "w", encoding="utf-8") as f:
        json.dump(bake_meta, f, indent=2)

    print("GROUND_BAKE_AND_EXPORT_SUCCESS:", json.dumps(bake_meta, indent=2))


if __name__ == "__main__":
    main()
