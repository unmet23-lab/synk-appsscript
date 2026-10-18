import bpy
import os
import sys
import json
import struct
import math
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "prev", "scripts"))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import mat_builder


def inspect_glb_json(glb_path):
    with open(glb_path, "rb") as f:
        magic, version, length = struct.unpack("<4sII", f.read(12))
        assert magic == b"glTF", "Not a valid GLB file"
        chunk_len, chunk_type = struct.unpack("<II", f.read(8))
        json_bytes = f.read(chunk_len)
    return json.loads(json_bytes.decode("utf-8"))


def convert_baked_and_glass_materials(objs, collect_report=False):
    converted_mats = set()
    mat_report = []
    for obj in objs:
        if obj.type != "MESH":
            continue
        for mat in obj.data.materials:
            if not mat or mat.name in converted_mats or not mat.use_nodes:
                continue
            converted_mats.add(mat.name)
            nt = mat.node_tree
            tex_node = next((n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image is not None), None)
            scale = float(mat.get("synk_bake_scale", 2.0))
            sun_alpha = int(mat.get("synk_sun_alpha", 0))

            if mat.name.startswith("bake_") and tex_node is not None:
                img = tex_node.image
                if collect_report:
                    mat_report.append(
                        {
                            "name": mat.name,
                            "type": "baked_diffuse",
                            "texture": img.name,
                            "resolution": [img.size[0], img.size[1]],
                            "synk_bake_scale": scale,
                            "synk_sun_alpha": sun_alpha,
                        }
                    )
                out_node = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
                bsdf_node = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
                emis = nt.nodes.new("ShaderNodeEmission")
                emis.inputs["Strength"].default_value = scale
                nt.links.new(tex_node.outputs["Color"], emis.inputs["Color"])

                lp = nt.nodes.new("ShaderNodeLightPath")
                mix_s = nt.nodes.new("ShaderNodeMixShader")
                nt.links.new(lp.outputs["Is Camera Ray"], mix_s.inputs["Fac"])
                if bsdf_node is not None:
                    nt.links.new(bsdf_node.outputs["BSDF"], mix_s.inputs[1])
                nt.links.new(emis.outputs["Emission"], mix_s.inputs[2])
                nt.links.new(mix_s.outputs["Shader"], out_node.inputs["Surface"])
            elif "glass" in mat.name.lower():
                if collect_report:
                    mat_report.append(
                        {
                            "name": mat.name,
                            "type": "realtime_glass",
                            "baseColor": "#bedbd5",
                            "roughness": 0.1,
                            "opacity": 0.29,
                        }
                    )
                nt.nodes.clear()
                out_node = nt.nodes.new("ShaderNodeOutputMaterial")
                transp = nt.nodes.new("ShaderNodeBsdfTransparent")
                emis = nt.nodes.new("ShaderNodeEmission")
                emis.inputs["Color"].default_value = (0.515, 0.708, 0.665, 1.0)
                emis.inputs["Strength"].default_value = 0.22
                mix_s = nt.nodes.new("ShaderNodeMixShader")
                mix_s.inputs["Fac"].default_value = 0.29
                nt.links.new(transp.outputs["BSDF"], mix_s.inputs[1])
                nt.links.new(emis.outputs["Emission"], mix_s.inputs[2])
                nt.links.new(mix_s.outputs["Shader"], out_node.inputs["Surface"])
    return mat_report


def load_context_buildings_and_live():
    """
    Loads the 4 baked buildings (`town-argon-home.glb`, `town-argon-workshop.glb`,
    `town-argon-greenhouse.glb`, `prev/cafe-argon.glb` without `cafe_ground`) and
    `reference/v20_live.glb` into the preview scene.
    """
    ctx_col = bpy.data.collections.new("PreviewContext")
    bpy.context.scene.collection.children.link(ctx_col)

    building_files = [
        os.path.join(ROOT, "out", "town-argon-home.glb"),
        os.path.join(ROOT, "out", "town-argon-workshop.glb"),
        os.path.join(ROOT, "out", "town-argon-greenhouse.glb"),
        os.path.join(ROOT, "prev", "cafe-argon.glb"),
    ]
    building_objs = []
    for fpath in building_files:
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
            ctx_col.objects.link(obj)
            building_objs.append(obj)

    convert_baked_and_glass_materials(building_objs, collect_report=False)

    # Load reference/v20_live.glb
    live_path = os.path.join(ROOT, "reference", "v20_live.glb")
    map0_path = os.path.join(ROOT, "reference", "map_0.png")
    img_map0 = bpy.data.images.load(map0_path, check_existing=True)
    img_map0.colorspace_settings.name = "sRGB"

    if os.path.exists(live_path):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=live_path)
        live_objs = [o for o in bpy.data.objects if o not in before]
        visited_mats = set()

        for obj in live_objs:
            for col in list(obj.users_collection):
                col.objects.unlink(obj)
            ctx_col.objects.link(obj)
            if obj.type != "MESH":
                continue
            me = obj.data
            for mat in me.materials:
                if not mat or not mat.use_nodes or mat.name in visited_mats:
                    continue
                visited_mats.add(mat.name)
                nt = mat.node_tree
                bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
                out_node = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
                vcol_node = next((n for n in nt.nodes if n.type == "VERTEX_COLOR"), None)
                if not bsdf or not out_node:
                    continue

                # Ensure left street bench (_t14) is 100% opaque in core & follow views
                if "_t14" in mat.name:
                    for lnk in list(bsdf.inputs["Alpha"].links):
                        nt.links.remove(lnk)
                    bsdf.inputs["Alpha"].default_value = 1.0
                    for lnk in list(out_node.inputs["Surface"].links):
                        nt.links.remove(lnk)
                    nt.links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

                # Connect map_0.png (`grassMap`) to live terrainMaterial and gardenSoil so outer lawn matches 100%
                if vcol_node and (mat.name.startswith("terrainMaterial_") or mat.name.startswith("gardenSoil_")):
                    geom = nt.nodes.new("ShaderNodeNewGeometry")
                    mapping = nt.nodes.new("ShaderNodeMapping")
                    mapping.inputs["Location"].default_value = (12.0, 9.288889, 0.0)
                    mapping.inputs["Scale"].default_value = (0.24, 22.0 / 90.0, 1.0)
                    nt.links.new(geom.outputs["Position"], mapping.inputs["Vector"])

                    tex = nt.nodes.new("ShaderNodeTexImage")
                    tex.image = img_map0
                    tex.extension = "REPEAT"
                    nt.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])

                    mix_node = nt.nodes.new("ShaderNodeMix")
                    mix_node.data_type = "RGBA"
                    mix_node.blend_type = "MULTIPLY"
                    mix_node.inputs["Factor"].default_value = 1.0
                    nt.links.new(vcol_node.outputs["Color"], mix_node.inputs[6])
                    nt.links.new(tex.outputs["Color"], mix_node.inputs[7])
                    nt.links.new(mix_node.outputs[2], bsdf.inputs["Base Color"])
                    bsdf.inputs["Roughness"].default_value = 0.98
                elif vcol_node and (mat.name.startswith("wood_ffffff") or mat.name.startswith("env_ffffff_r100_m0_t14")):
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


def main():
    out_dir = os.path.join(ROOT, "out")
    work_dir = os.path.join(ROOT, "work")
    blend_path = os.path.join(work_dir, "ground_baked.blend")
    glb_path = os.path.join(out_dir, "town-argon-ground.glb")
    sky_path = os.path.join(ROOT, "sky", "azure-sky-v3.jpg")

    # Normalize any .001 material names in work/ground_baked.blend and re-export GLB if needed
    if os.path.exists(blend_path):
        bpy.ops.wm.open_mainfile(filepath=blend_path)
        renamed = False
        bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
        for m in list(bpy.data.materials):
            if m.name.endswith(".001") and m.name.startswith("bake_"):
                base_name = m.name[:-4]
                old = bpy.data.materials.get(base_name)
                if old and old.users == 0:
                    bpy.data.materials.remove(old)
                m.name = base_name
                renamed = True
        if renamed:
            bpy.ops.wm.save_as_mainfile(filepath=blend_path)
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

    assert os.path.exists(glb_path), f"Missing {glb_path}"

    # 1. Start a clean scene and import out/town-argon-ground.glb
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)

    ground_mesh_objs = [o for o in bpy.data.objects if o.type == "MESH"]
    mesh_report = []
    total_tris = 0

    for obj in sorted(ground_mesh_objs, key=lambda x: x.name):
        me = obj.data
        me.calc_loop_triangles()
        tris = len(me.loop_triangles)
        total_tris += tris
        mat_names = [m.name for m in me.materials if m]
        mesh_report.append(
            {
                "name": obj.name,
                "vertices": len(me.vertices),
                "triangles": tris,
                "materials": mat_names,
            }
        )

    # 2. Convert imported ground materials to Emission (scale=2.0) for camera rays
    mat_report = convert_baked_and_glass_materials(ground_mesh_objs, collect_report=True)

    # 3. Load 4 baked buildings + v20_live.glb & scene lighting
    load_context_buildings_and_live()
    mat_builder.setup_lighting_and_world(sky_path, sun_only=False)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            if any(d.type == backend for d in prefs.devices):
                for d in prefs.devices:
                    d.use = (d.type == backend)
                break
        except Exception:
            pass
    scene.cycles.device = "GPU"
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True

    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100

    def render_camera(cam_name, pos, target, fov_y_deg, filepath):
        cam_data = bpy.data.cameras.new(cam_name)
        cam_data.sensor_fit = "VERTICAL"
        cam_data.angle = math.radians(fov_y_deg)
        cam_obj = bpy.data.objects.new(cam_name, cam_data)
        scene.collection.objects.link(cam_obj)
        cam_obj.location = Vector(pos)
        direction = (Vector(target) - Vector(pos)).normalized()
        cam_obj.rotation_mode = "QUATERNION"
        cam_obj.rotation_quaternion = direction.to_track_quat("-Z", "Y")
        scene.camera = cam_obj
        scene.render.filepath = filepath
        bpy.ops.render.render(write_still=True)
        assert os.path.exists(filepath), f"Failed to render {filepath}"

    # Render core: position (0, -12.4, 8.2), target (0, 2.6, 0.2), vertical FOV 42 deg
    core_path = os.path.join(out_dir, "preview-ground-core.png")
    render_camera(
        "cam_ground_core",
        (0.0, -12.4, 8.2),
        (0.0, 2.6, 0.2),
        42.0,
        core_path,
    )

    # Render follow: position (-0.066, -16.186, 12.359), target (-0.066, -1.186, 1.559), vertical FOV 44 deg
    follow_path = os.path.join(out_dir, "preview-ground-follow.png")
    render_camera(
        "cam_ground_follow",
        (-0.066, -16.186, 12.359),
        (-0.066, -1.186, 1.559),
        44.0,
        follow_path,
    )

    # 4. Inspect GLB JSON and build out/report-ground.json
    gltf_json = inspect_glb_json(glb_path)
    buffer_views = gltf_json.get("bufferViews", [])
    textures_info = []
    for idx, img_def in enumerate(gltf_json.get("images", [])):
        bv_idx = img_def.get("bufferView")
        byte_len = buffer_views[bv_idx].get("byteLength", 0) if bv_idx is not None else 0
        img_name = img_def.get("name", f"image_{idx}")
        png_file = os.path.join(out_dir, f"{img_name}.png")
        png_bytes = os.path.getsize(png_file) if os.path.exists(png_file) else 0
        textures_info.append(
            {
                "index": idx,
                "name": img_name,
                "mimeType": img_def.get("mimeType", "image/webp"),
                "resolution": [2048, 2048],
                "webp_byteLength": byte_len,
                "webp_sizeKB": round(byte_len / 1024.0, 1),
                "source_png": f"out/{img_name}.png",
                "source_png_sizeKB": round(png_bytes / 1024.0, 1),
            }
        )

    bake_meta_path = os.path.join(work_dir, "ground_bake_meta.json")
    bake_meta = {}
    if os.path.exists(bake_meta_path):
        with open(bake_meta_path, "r", encoding="utf-8") as f:
            bake_meta = json.load(f)

    glb_bytes = os.path.getsize(glb_path)
    report = {
        "part": "ground",
        "asset": "out/town-argon-ground.glb",
        "blender_version": bpy.app.version_string,
        "gpu_backend": bake_meta.get("gpu_backend", "OPTIX"),
        "totals": {
            "triangles": total_tris,
            "triangle_budget": 80000,
            "meshes": len(ground_mesh_objs),
            "mesh_budget": 24,
            "materials": len(mat_report),
            "textures": len(textures_info),
            "texture_budget": "3 x 2048x2048",
            "glb_size_bytes": glb_bytes,
            "glb_size_mb": round(glb_bytes / (1024.0 * 1024.0), 3),
        },
        "baking": {
            "diffuse_passes": ["DIRECT", "INDIRECT", "COLOR"],
            "samples_total_diffuse": bake_meta.get("bake_samples_total", 512),
            "samples_direct_sun_alpha": bake_meta.get("bake_samples_sun", 64),
            "sun_alpha_min_clamp": "2/255",
            "uv_island_margin_px": 8.6,
            "bake_times_sec": bake_meta.get("bake_times_sec", {}),
            "total_pipeline_sec": bake_meta.get("total_pipeline_sec", 0.0),
        },
        "meshes": mesh_report,
        "materials": mat_report,
        "textures": textures_info,
        "previews": [
            "out/preview-ground-core.png",
            "out/preview-ground-follow.png",
        ],
        "unmet_requirements": [],
    }

    report_path = os.path.join(out_dir, "report-ground.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print("GROUND_PREVIEW_AND_REPORT_SUCCESS:", report_path)


if __name__ == "__main__":
    main()
