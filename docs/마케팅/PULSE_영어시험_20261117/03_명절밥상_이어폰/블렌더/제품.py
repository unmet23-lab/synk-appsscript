# 셋째 편 가상 이어폰 · 케이스 기준 그림(2026-11-17).
# 카본이 제품 생김새를 컷마다 같게 굽도록 참고로 넣는 그림이다. 브랜드 글자는 넣지 않는다(케이스 뚜껑에 작은 원 하나).
# 쓰는 법: "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python 제품.py -- <내보낼 폴더>
import bpy, bmesh, math, sys, os
from mathutils import Vector

out_dir = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.path.dirname(__file__)
os.makedirs(out_dir, exist_ok=True)

CELADON = (0.36, 0.47, 0.41, 1.0)   # 화면에서 옅은 청자색(#9fb8a8 언저리)이 되도록 선형 값
TIP = (0.55, 0.62, 0.58, 1.0)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("OPTIX", "CUDA"):
            try:
                prefs.compute_device_type = kind
                prefs.get_devices()
                for d in prefs.devices:
                    d.use = True
                sc.cycles.device = "GPU"
                break
            except Exception:
                continue
    except Exception:
        pass
    sc.cycles.samples = 160
    sc.cycles.use_denoising = True
    sc.render.resolution_x = 1600
    sc.render.resolution_y = 1600
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Base Contrast" if "AgX - Base Contrast" in [l for l in ("AgX - Base Contrast",)] else "None"
    w = bpy.data.worlds.new("w")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.62, 0.62, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.35
    return sc


def mat(name, color, rough, metal=0.0, coat=0.0, aniso=0.0, sss=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    for key, val in (("Coat Weight", coat), ("Anisotropic", aniso), ("Subsurface Weight", sss)):
        if key in b.inputs:
            b.inputs[key].default_value = val
    return m


def smooth(obj, level=2):
    for p in obj.data.polygons:
        p.use_smooth = True
    md = obj.modifiers.new("sub", "SUBSURF")
    md.levels = level
    md.render_levels = level


def ellipsoid(name, size, loc, m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    for p in o.data.polygons:
        p.use_smooth = True
    o.data.materials.append(m)
    return o


def ring(name, major, minor, loc, rot, m, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=96, minor_segments=16, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    for p in o.data.polygons:
        p.use_smooth = True
    o.data.materials.append(m)
    return o


def disk(name, r, depth, loc, rot, m):
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    for p in o.data.polygons:
        p.use_smooth = True
    md = o.modifiers.new("bev", "BEVEL")
    md.width = depth * 0.45
    md.segments = 4
    o.data.materials.append(m)
    return o


def earbud(origin, rot_z, m_body, m_ring, m_tip):
    # 몸통: 둥근 조약돌(지름 약 2 cm), 바깥 면은 납작한 원판 + 은색 고리, 안쪽엔 짧은 귀 팁
    parts = []
    body = ellipsoid("bud_body", (1.0, 0.86, 0.74), origin, m_body)
    parts.append(body)
    face_c = Vector(origin) + Vector((0, 0, 0.70))
    face = disk("bud_face", 0.62, 0.10, face_c, (0, 0, 0), m_body)
    parts.append(face)
    parts.append(ring("bud_ring", 0.64, 0.035, face_c + Vector((0, 0, 0.02)), (0, 0, 0), m_ring))
    tip_c = Vector(origin) + Vector((0.30, 0.0, -0.78))
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.26, depth=0.42, location=tip_c, rotation=(0, math.radians(20), 0))
    tip = bpy.context.active_object
    tip.name = "bud_tip"
    for p in tip.data.polygons:
        p.use_smooth = True
    md = tip.modifiers.new("bev", "BEVEL"); md.width = 0.1; md.segments = 5
    tip.data.materials.append(m_tip)
    parts.append(tip)
    # 묶어서 돌린다
    bpy.ops.object.empty_add(location=origin)
    piv = bpy.context.active_object
    for p in parts:
        p.parent = piv
        p.matrix_parent_inverse = piv.matrix_world.inverted()
    piv.rotation_euler = rot_z
    return piv


def case(origin, rot, m_body, m_ring, open_lid=False):
    # 달걀만 한 조약돌 케이스(가로 6 cm 언저리) — 가운데 은색 이음선, 뚜껑 가운데 아주 작은 오목한 원 하나
    sx, sy, sz = 3.0, 2.3, 1.45
    base = ellipsoid("case", (sx, sy, sz), origin, m_body)
    seam_c = Vector(origin) + Vector((0, 0, 0.05))
    seam = ring("case_seam", 1.0, 0.018, seam_c, (0, 0, 0), m_ring, scale=(sx * 1.0, sy * 1.0, 1.0))
    # 뚜껑 원(오목): 얇은 고리를 위 면에 살짝 묻는다
    top = Vector(origin) + Vector((0, 0, sz - 0.015))
    mark = ring("case_mark", 0.22, 0.022, top, (0, 0, 0), mat("mark", (0.28, 0.37, 0.32, 1), 0.6))
    bpy.ops.object.empty_add(location=origin)
    piv = bpy.context.active_object
    for p in (base, seam, mark):
        p.parent = piv
        p.matrix_parent_inverse = piv.matrix_world.inverted()
    piv.rotation_euler = rot
    return piv


def floor_and_lights(sc, target=(0, 0, 0), floor_z=-1.5):
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, floor_z))
    fl = bpy.context.active_object
    fl.data.materials.append(mat("floor", (0.55, 0.55, 0.55, 1), 0.8))
    # 키: 화면 왼쪽 위의 큰 부드러운 빛, 채움: 오른쪽, 테: 뒤
    def area(name, loc, power, size, color=(1, 0.97, 0.93)):
        bpy.ops.object.light_add(type="AREA", location=loc)
        l = bpy.context.active_object
        l.name = name
        l.data.energy = power
        l.data.size = size
        l.data.color = color
        d = Vector(target) - l.location
        l.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        return l
    area("key", (-9, -6, 9), 2600, 8)
    area("fill", (9, -5, 4), 700, 8, (0.95, 0.97, 1))
    area("rim", (2, 9, 7), 1400, 5)


def camera(loc, target, lens=85):
    bpy.ops.object.camera_add(location=loc)
    c = bpy.context.active_object
    c.data.lens = lens
    d = Vector(target) - c.location
    c.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = c
    return c


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("렌더:", path)


# 1) 이어폰 두 알 — 하나는 바깥 면(은색 고리)이 보이게, 하나는 옆으로 누워 귀 팁이 보이게
sc = reset()
m_body = mat("celadon", CELADON, 0.42, coat=0.15, sss=0.05)
m_ring = mat("brushed", (0.80, 0.80, 0.80, 1), 0.28, metal=1.0, aniso=0.6)
m_tip = mat("tip", TIP, 0.55, sss=0.2)
earbud((-1.3, 0, 0), (math.radians(18), math.radians(-12), math.radians(20)), m_body, m_ring, m_tip)
earbud((1.4, 0.2, -0.05), (math.radians(95), math.radians(0), math.radians(-40)), m_body, m_ring, m_tip)
floor_and_lights(sc, floor_z=-0.92)
camera((0, -9.5, 5.5), (0, 0, -0.1), lens=70)
render(os.path.join(out_dir, "소품_이어폰.png"))

# 2) 닫힌 케이스 — 비스듬히 3/4
sc = reset()
m_body = mat("celadon", CELADON, 0.42, coat=0.15, sss=0.05)
m_ring = mat("brushed", (0.80, 0.80, 0.80, 1), 0.28, metal=1.0, aniso=0.6)
case((0, 0, 0), (0, 0, math.radians(18)), m_body, m_ring)
floor_and_lights(sc, floor_z=-1.42)
camera((0, -13, 8), (0, 0, 0), lens=70)
render(os.path.join(out_dir, "소품_케이스.png"))
