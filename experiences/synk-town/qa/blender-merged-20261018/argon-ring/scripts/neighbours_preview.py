import bpy
import json
import math
import os
import sys
import time
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.join(ROOT, "prev", "scripts") not in sys.path:
    sys.path.insert(0, os.path.join(ROOT, "prev", "scripts"))
if os.path.join(ROOT, "scripts") not in sys.path:
    sys.path.insert(0, os.path.join(ROOT, "scripts"))

import mat_builder
import neighbours_geo


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def configure_cycles_render(width=1280, height=900, samples=64):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0

    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 2
    scene.cycles.transparent_max_bounces = 6

    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for dev_type in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
            try:
                prefs.compute_device_type = dev_type
                prefs.get_devices()
                if any(d.type == dev_type for d in prefs.devices):
                    for d in prefs.devices:
                        d.use = True
                    scene.cycles.device = 'GPU'
                    break
            except Exception:
                continue
    except Exception:
        pass


def setup_camera(location, look_at, vfov_deg):
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.get("PreviewCam")
    if cam_data is None:
        cam_data = bpy.data.cameras.new("PreviewCam")
    cam_obj = bpy.data.objects.get("PreviewCam")
    if cam_obj is None:
        cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
        scene.collection.objects.link(cam_obj)

    cam_data.type = 'PERSP'
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.angle = math.radians(vfov_deg)
    cam_data.clip_start = 0.05
    cam_data.clip_end = 250.0

    pos = Vector(location)
    target = Vector(look_at)
    direction = (target - pos).normalized()

    cam_obj.location = pos
    cam_obj.rotation_mode = 'QUATERNION'
    cam_obj.rotation_quaternion = direction.to_track_quat('-Z', 'Y')
    scene.camera = cam_obj
    return cam_obj


def main():
    clear_scene()
    os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)

    t0 = time.perf_counter()
    mats = mat_builder.build_procedural_materials()
    neighbours_geo.ROOT = ROOT
    objs = neighbours_geo.build_all_neighbours_meshes(mats)
    build_seconds = round(time.perf_counter() - t0, 3)

    tri_counts = {}
    total_tris = 0
    for name, obj in objs.items():
        obj.data.calc_loop_triangles()
        n_tris = len(obj.data.loop_triangles)
        tri_counts[name] = n_tris
        total_tris += n_tris

    print(f"[neighbours_preview] Built {len(objs)} objects in {build_seconds}s, total triangles = {total_tris}")
    for k, v in tri_counts.items():
        print(f"  {k}: {v} tris")

    report = {
        "asset": "neighbours",
        "objects": tri_counts,
        "total_triangles": total_tris,
        "triangle_budget": 64000,
        "within_budget": total_tris <= 64000,
        "atlas_groups": neighbours_geo.ATLAS_GROUPS,
        "build_seconds": build_seconds,
        "changes_vs_v20": [
            "Included all 8 neighbour houses and their yard elements (stone foundations, front paving pads, style-0 porch steps & plank decks, yard gravel paths, and front/side garden fences) directly in neighbours_* world-space meshes while keeping exact town-layout.mjs positions, dimensions, yaw rotations, and collision footprints.",
            "Upgraded roofs across all 3 styles (symmetric gable style 0, mono-pitch shed style 1, curved bell-gable style 2, plus style 0 porch roof and style 2 rotated pantry roof) with smooth high-resolution curved slabs, 11 curved purlin tile courses following roof Z-curvature, 9 standing-seam slope ribs, sculpted ridge caps, and darkWood gable bargeboard trims.",
            "Replaced flat single-box doors and shutters with recessed darkWood shadow backings, individual beveled vertical tongue-and-groove planks (5 planks per door, 3 planks per shutter) with alternating wood-grain tints, horizontal battens, and door latches.",
            "Replaced solid block window frames with 4-piece mortised picture-frame joinery (front windows, side windows, and style-1 clerestory windows) plus inner wood sashes, beveled mullions/transoms, and 3-block dressed limestone sills.",
            "Refined stone foundations, fence coping caps, front paving pads, and porch steps into individual beveled ashlar/flagstone courses with mortar bases and subtle stone-to-stone color variation.",
            "Added procedural 'neighbours_*' Cycles materials (Metallic = 0) with multi-scale lime plaster trowel & sand grain, slate tile striations, oak/walnut wood grain, limestone bump, and river gravel Voronoi texture."
        ],
        "unmet_requirements": []
    }

    report_path = os.path.join(ROOT, "out", "report-neighbours.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"[neighbours_preview] Wrote {report_path}")

    # Import background reference GLBs for preview rendering
    for bg_name in ("v20_live.glb", "v20_town_ground.glb"):
        bg_path = os.path.join(ROOT, "reference", bg_name)
        if os.path.exists(bg_path):
            bpy.ops.import_scene.gltf(filepath=bg_path)

    # Setup lighting and world environment
    sky_path = os.path.join(ROOT, "sky", "azure-sky-v3.jpg")
    mat_builder.setup_lighting_and_world(sky_path, sun_only=False)
    configure_cycles_render(width=1280, height=900, samples=64)

    views = [
        ("ring-wide",       (0.0, -10.0, 14.0), (0.0, 12.0, 0.0),   50.0),
        ("neighbour-left",  (-10.0, 11.0, 2.2), (-10.0, 16.0, 1.0), 42.0),
        ("neighbour-right", (6.0, 11.5, 2.2),   (5.4, 16.6, 1.0),   42.0),
    ]

    for view_name, cam_pos, cam_target, vfov in views:
        setup_camera(cam_pos, cam_target, vfov)
        out_png = os.path.join(ROOT, "out", f"preview-neighbours-{view_name}.png")
        bpy.context.scene.render.filepath = out_png
        t_r = time.perf_counter()
        bpy.ops.render.render(write_still=True)
        print(f"[neighbours_preview] Rendered {out_png} in {time.perf_counter() - t_r:.2f}s")


if __name__ == "__main__":
    main()
