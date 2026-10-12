"""Convert a pinned MIT Rocketbox subset to compact seated, facially rigged GLBs.

Run with the installed Blender Python:
  blender --background --python tools/prepare-interview-actors.py -- --cache <source-cache>
Source FBX/TGA files stay in a temporary cache, never in the browser build.
"""
import argparse
import hashlib
import json
import math
import pathlib
import sys
import urllib.request

import bpy
from mathutils import Matrix, Vector

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "experiences/path-vr/assets/interview/actors"
MODELS = [("Business_Male_02", "m008", "m"), ("Business_Female_03", "f016", "f"), ("Business_Male_03", "m020", "m")]
KEEP_MORPHS = {
    "Basis", "AK_09_EyeBlinkLeft", "AK_10_EyeBlinkRight", "AK_25_JawOpen",
    "AK_03_BrowInnerUp", "AK_44_MouthSmileLeft", "AK_45_MouthSmileRight",
    "AA_VI_01_PP", "AA_VI_10_aa", "AA_VI_11_E", "AA_VI_13_O", "AA_VI_14_U",
}


def retrieve(url, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        urllib.request.urlretrieve(url, target)


def texture(path, output, size, alpha=False):
    image = bpy.data.images.load(str(path), check_existing=False)
    image.scale(size, size)
    image.filepath_raw = str(output)
    image.file_format = "PNG" if alpha else "JPEG"
    image.save()
    image.filepath = str(output)
    return image


def material(prefix, kind, source, scratch):
    mat = bpy.data.materials.new(prefix + "_" + kind)
    mat.use_nodes = True
    n = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = n.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
    bsdf.inputs["Metallic"].default_value = 0
    bsdf.inputs["Roughness"].default_value = .72 if kind == "body" else .66
    bsdf.inputs["Specular IOR Level"].default_value = .26
    is_alpha = kind == "opacity"
    color = texture(source / f"{prefix}_{kind}_color.tga", scratch / f"{prefix}_{kind}_color.{'png' if is_alpha else 'jpg'}", 1024, is_alpha)
    color.colorspace_settings.name = "sRGB"
    tex = n.new("ShaderNodeTexImage"); tex.image = color
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if is_alpha:
        links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        mat.surface_render_method = "DITHERED"
        mat.use_backface_culling = False
    else:
        norm = texture(source / f"{prefix}_{kind}_normal.tga", scratch / f"{prefix}_{kind}_normal.jpg", 1024 if kind == "head" else 512)
        norm.colorspace_settings.name = "Non-Color"
        nt = n.new("ShaderNodeTexImage"); nt.image = norm
        nm = n.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = .5
        links.new(nt.outputs["Color"], nm.inputs["Color"]); links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def convert(name, prefix, sex, cache, revision):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    folder = cache / "Assets/Avatars/Professions" / name
    fbx = folder / "Export" / f"{name}_facial.fbx"
    source_base = f"https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/{revision}/"
    paths = [f"Assets/Avatars/Professions/{name}/Export/{name}_facial.fbx"]
    paths += [f"Assets/Avatars/Professions/{name}/Textures/{prefix}_{s}.tga" for s in ["body_color", "body_normal", "head_color", "head_normal", "opacity_color"]]
    anim_path = f"Assets/Animations/all_animations_max_motextr_static/{sex}_sit_chair_idle_neutral_01.max.fbx"
    for path in paths + [anim_path]:
        retrieve(source_base + path, cache / path)
    bpy.ops.import_scene.fbx(filepath=str(fbx), ignore_leaf_bones=True)
    rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    original = set(bpy.context.scene.objects)
    bpy.ops.import_scene.fbx(filepath=str(cache / anim_path), ignore_leaf_bones=True)
    anim_objects = set(bpy.context.scene.objects) - original
    source_rig = next(o for o in anim_objects if o.type == "ARMATURE")
    bpy.context.scene.frame_set(40 if sex == "f" else 80)
    # The source animation's bind skeleton is already seated. Copy armature-space
    # orientations instead of pose deltas, preserving each avatar's limb lengths.
    rig.rotation_euler = source_rig.rotation_euler.copy()
    rig.location = source_rig.location.copy()
    for bone in rig.pose.bones:
        source_bone = source_rig.pose.bones.get(bone.name)
        if source_bone:
            bpy.context.view_layer.update()
            head = bone.head.copy()
            pose = source_bone.matrix.to_quaternion().to_matrix().to_4x4()
            pose.translation = head
            bone.matrix = pose
    bpy.context.view_layer.update()
    for o in anim_objects:
        bpy.data.objects.remove(o, do_unlink=True)
    scratch = cache / "converted-textures" / name
    scratch.mkdir(parents=True, exist_ok=True)
    materials = {k: material(prefix, k, folder / "Textures", scratch) for k in ["body", "head", "opacity"]}
    for mesh in meshes:
        for slot in mesh.material_slots:
            kind = next((k for k in materials if k in slot.material.name), "body")
            slot.material = materials[kind]
        for key in list(mesh.data.shape_keys.key_blocks):
            if key.name not in KEEP_MORPHS:
                mesh.shape_key_remove(key)
        for poly in mesh.data.polygons:
            poly.use_smooth = True
    rig.animation_data_clear()
    for o in meshes:
        o.animation_data_clear()
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    # Keep source seated dimensions. Runtime applies the documented per-person
    # scale; landmark measurements below make chair/eye alignment reviewable.
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{name}.glb"
    bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB", export_animations=False,
                             export_rest_position_armature=False, export_current_frame=True,
                             export_yup=True, export_morph=True, export_morph_normal=False,
                             export_morph_tangent=False, export_cameras=False, export_lights=False,
                             export_image_format="AUTO", export_jpeg_quality=84)
    data = target.read_bytes()
    landmarks = {}
    for label, bone_name in [("head", "Bip01 Head"), ("eye", "Bip01 REye"), ("hip", "Bip01 Pelvis"), ("hand", "Bip01 R Hand"), ("foot", "Bip01 R Foot")]:
        v = rig.matrix_world @ rig.pose.bones[bone_name].head
        landmarks[label] = [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]
    entry = {"id": name, "file": target.name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "landmarks": landmarks,
             "sourceFiles": paths + [anim_path], "vertices": sum(len(o.data.vertices) for o in meshes),
             "morphTargets": list(meshes[0].data.shape_keys.key_blocks.keys())[1:], "license": "MIT"}
    print("SYNK_ACTOR", json.dumps(entry))
    # A build-side visual preview includes face, alpha hair, and the seated pose.
    world = bpy.data.worlds.new("Preview")
    world.use_nodes = True; world.node_tree.nodes["Background"].inputs[0].default_value = (.13, .15, .18, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = .65
    bpy.context.scene.world = world
    for pos, energy, size in [((-2, -3, 4), 350, 3), ((2, -1, 2.5), 180, 2.5)]:
        bpy.ops.object.light_add(type="AREA", location=pos)
        light = bpy.context.object; light.data.energy = energy; light.data.shape = "DISK"; light.data.size = size
        light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=(0, -2.8, 1.25))
    camera = bpy.context.object; camera.rotation_euler = (Vector((0, 0, 1.04)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 45; bpy.context.scene.camera = camera
    scene = bpy.context.scene; scene.render.engine = "CYCLES"; scene.cycles.samples = 16
    scene.render.resolution_x = 700; scene.render.resolution_y = 850; scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"; scene.render.filepath = str(cache / f"{name}-preview.png")
    bpy.ops.render.render(write_still=True)
    return entry


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser(); p.add_argument("--cache", required=True); p.add_argument("--revision", default="0943055db6ec570bcef9f2c8b41c9e5467c808f9")
    p.add_argument("--only", default="")
    opts = p.parse_args(args)
    cache = pathlib.Path(opts.cache)
    revision = opts.revision
    if revision == "master":
        revision = json.load(urllib.request.urlopen("https://api.github.com/repos/microsoft/Microsoft-Rocketbox/commits/master"))["sha"]
    entries = [convert(*m, cache, revision) for m in MODELS if not opts.only or opts.only == m[0]]
    retrieve(f"https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/{revision}/LICENSE.md", OUT / "LICENSE-Microsoft-Rocketbox.txt")
    manifest = {"source": "https://github.com/microsoft/Microsoft-Rocketbox", "revision": revision,
                "checkedAt": "2026-10-11", "license": "MIT", "copyright": "Copyright (c) 2020 Microsoft",
                "pipeline": "FBX facial rig + seated animation pose; retained 11 face morphs; JPEG color/normal and alpha PNG; GLB, no animation clips",
                "qualityScope": "Textured rigged realistic-style game characters; not scanned people, photoreal video, or proven headset quality.",
                "loader": {"package": "three", "version": "0.180.0", "license": "MIT", "licenseFile": "../../../vendor/THREE-LICENSE.txt",
                           "sources": ["https://github.com/mrdoob/three.js/blob/r180/examples/jsm/loaders/GLTFLoader.js", "https://github.com/mrdoob/three.js/blob/r180/examples/jsm/utils/BufferGeometryUtils.js"],
                           "modification": "Module import paths changed to local vendored Three modules"},
                "models": entries}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
