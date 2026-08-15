# 마스코트 인형 리깅 — 형상 GLB 를 «투영 인형»으로 세워 살아있는 아이들 모션을 렌더한다 (2단계 v1).
#
# 통로(실측으로 세움 · probe 1~6 · 2026-08-15):
#   ① 텍스처 = 원본 펠트 사진의 «오브젝트 공간 정면 투영»을 UV 로 한 번 계산해 표면에 붙인다.
#      ⚠ 카메라 UVProject 모디파이어 금지 — 살아있는 모디파이어라 몸이 돌면 텍스처가 화면에 남아
#        미끄러진다(유리그림). ⚠ 원근 투영 금지 — 돔 앞면(가까움)이 사진보다 크게 찍힌다.
#   ② 물체 밖 투영(배경)은 누끼 알파(0.65 문턱 경화 — 페더의 흰 테)로 걸러 코어 단색에 합성.
#   ③ 사진엔 조명이 구워져 있다 — 재조명은 최소(키 120·필 35), 색 보존은 방출 0.55 가 진다.
#   ④ 표정 = 투영 이미지 교체(같은 기하·같은 UV 라 이어짐) — 깜빡임·눈웃음을 믹스 키로.
#   ⑤ 모든 주기가 총 프레임의 정수배 사이클 = 무한 루프 이음매 0.
# 대가(틀릴 때의 모습): 요(yaw)가 ±13° 를 넘으면 옆면의 투영 늘어짐이 보이기 시작한다 — 큰 턴은
#   이 통로가 아니라 텍스처 API(로그인 층)나 멀티뷰 입력으로 푼다.
#
# 사용:
#   blender -b -P tools/마스코트인형리깅.py -- probe <glb> <본체누끼.png> <출력.png>
#   blender -b -P tools/마스코트인형리깅.py -- anim  <glb> <본체누끼> <눈감음> <눈웃음> <출력폴더> [프레임수=600]
# 이후 조립: ffmpeg -framerate 60 -i <출력폴더>/f_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 <출력.mp4>
import bpy, sys, math

argv = sys.argv[sys.argv.index("--") + 1:]
MODE = argv[0]
GLB = argv[1]
사진물체분수 = 597.0 / 1024.0   # 원본 사진에서 물체가 차지하는 프레임 높이 비율(상태컷정합 실측)

def scene_reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    obj = max(meshes, key=lambda o: len(o.data.vertices))
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o is not obj:
            bpy.data.objects.remove(o, do_unlink=True)
    return obj

def normalize(obj):
    # 원점을 기하 중심으로, 키를 1.0 으로 — 회전·호흡이 중심을 돌게
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    obj.location = (0, 0, 0)
    d = obj.dimensions
    s = 1.0 / max(d.z, 1e-6)
    obj.scale = (s, s, s)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    return obj

def make_material(obj, img_paths):
    me = obj.data
    # 이미지 한 변의 오브젝트 길이 W — 메시가 사진 실루엣보다 부푸는 만큼(폭/높이 실측) + 3% 여유.
    # 코랄 형상 실측 1.087 → W 1.921. 오버슈트면 알파 경계가 실루엣 «안»에 앉아 단색 테가 안 생긴다.
    ratio = max(obj.dimensions.x, 1.0)
    W = (ratio * 1.03) / 사진물체분수
    uv = me.uv_layers.new(name="proj")
    for loop in me.loops:
        co = me.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = (0.5 + co.x / W, 0.5 + co.z / W)
    mat = bpy.data.materials.new("펠트")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.95
    for nm in ("Sheen Weight", "Sheen"):
        if nm in bsdf.inputs:
            bsdf.inputs[nm].default_value = 0.3
            break
    texs = []
    for i, p in enumerate(img_paths):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(p)
        t.extension = "EXTEND"
        t.location = (-700, 300 - 320 * i)
        texs.append(t)
    mixes = []
    prev = texs[0].outputs["Color"]
    for i, t in enumerate(texs[1:]):
        m = nt.nodes.new("ShaderNodeMix")
        m.data_type = "RGBA"
        m.location = (-350 + 200 * i, 200)
        nt.links.new(prev, m.inputs[6])
        nt.links.new(t.outputs["Color"], m.inputs[7])
        m.inputs[0].default_value = 0.0
        prev = m.outputs[2]
        mixes.append(m)
    base = nt.nodes.new("ShaderNodeMix")
    base.data_type = "RGBA"
    base.location = (-100, 0)
    base.inputs[6].default_value = (0.777, 0.0865, 0.0648, 1.0)  # 재염색 코어 sRGB 229,80,69 → 리니어
    nt.links.new(prev, base.inputs[7])
    hard = nt.nodes.new("ShaderNodeMath")
    hard.operation = "GREATER_THAN"
    hard.inputs[1].default_value = 0.65
    hard.location = (-300, -80)
    nt.links.new(texs[0].outputs["Alpha"], hard.inputs[0])
    nt.links.new(hard.outputs[0], base.inputs[0])
    nt.links.new(base.outputs[2], bsdf.inputs["Base Color"])
    if "Emission Color" in bsdf.inputs:
        nt.links.new(base.outputs[2], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 0.55
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return mat, mixes

def build_scene(glb, img_paths):
    scene_reset()
    obj = import_glb(glb)
    obj = normalize(obj)
    scn = bpy.context.scene

    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    scn.collection.objects.link(cam)
    cam_data.lens = 70
    d = (1.0 / 사진물체분수) * (cam_data.lens / 36.0)
    cam.location = (0, -d, 0.0)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scn.camera = cam

    rig = bpy.data.objects.new("rig", None)
    scn.collection.objects.link(rig)
    obj.parent = rig

    key = bpy.data.objects.new("key", bpy.data.lights.new("key", "AREA"))
    scn.collection.objects.link(key)
    key.data.energy = 120
    key.data.size = 3.2
    key.location = (-1.7, -1.9, 1.9)
    key.rotation_euler = (math.radians(52), 0, math.radians(-38))
    fill = bpy.data.objects.new("fill", bpy.data.lights.new("fill", "AREA"))
    scn.collection.objects.link(fill)
    fill.data.energy = 35
    fill.data.size = 4.0
    fill.location = (1.6, -1.8, -0.4)
    fill.rotation_euler = (math.radians(75), 0, math.radians(40))

    w = bpy.data.worlds.new("w")
    scn.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.00303, 0.00674, 0.0319, 1.0)  # Navy 2 #0F1730 (sRGB→linear 근사)
    bg.inputs[1].default_value = 1.0

    mat, mixes = make_material(obj, img_paths)

    for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            scn.render.engine = eng
            break
        except Exception:
            continue
    scn.render.resolution_x = 720
    scn.render.resolution_y = 720
    scn.render.fps = 60
    try:
        scn.eevee.taa_render_samples = 24
    except Exception:
        pass
    return scn, obj, rig, mixes

if MODE == "probe":
    scn, obj, rig, mixes = build_scene(GLB, [argv[2]])
    scn.render.filepath = argv[3]
    bpy.ops.render.render(write_still=True)
    print("PROBE OK", argv[3], "engine=", scn.render.engine)

elif MODE == "anim":
    본체, 감음, 웃음, OUT = argv[2], argv[3], argv[4], argv[5]
    N = int(argv[6]) if len(argv) > 6 else 600
    scn, obj, rig, mixes = build_scene(GLB, [본체, 감음, 웃음])
    scn.frame_start = 1
    scn.frame_end = N
    two_pi = 2 * math.pi

    # 모든 주기가 N 프레임의 정수배 사이클 = 무한 루프에서 이음매 0
    for f in range(1, N + 1):
        t = (f - 1) / N
        yaw = math.radians(9) * math.sin(two_pi * t) + math.radians(4) * math.sin(two_pi * 3 * t + 1.1)
        tilt = math.radians(2.2) * math.sin(two_pi * 2 * t + 0.6)
        rig.rotation_euler = (tilt, 0, yaw)
        rig.keyframe_insert("rotation_euler", frame=f)
        br = 1.0 + 0.013 * math.sin(two_pi * 3 * t)
        rig.scale = (1.0 / math.sqrt(br), 1.0 / math.sqrt(br), br)
        rig.keyframe_insert("scale", frame=f)
        rig.location = (0, 0, 0.012 * math.sin(two_pi * 2 * t + 0.9))
        rig.keyframe_insert("location", frame=f)

    def pulse(sock, start_f, up, hold, down):
        # 0→1→0 펄스 키 — 깜빡임·눈웃음
        sock.default_value = 0.0
        sock.keyframe_insert("default_value", frame=start_f)
        sock.default_value = 1.0
        sock.keyframe_insert("default_value", frame=start_f + up)
        sock.keyframe_insert("default_value", frame=start_f + up + hold)
        sock.default_value = 0.0
        sock.keyframe_insert("default_value", frame=start_f + up + hold + down)

    blink, smile = mixes[0].inputs[0], mixes[1].inputs[0]
    blink.default_value = 0.0
    blink.keyframe_insert("default_value", frame=1)
    smile.default_value = 0.0
    smile.keyframe_insert("default_value", frame=1)
    pulse(blink, 165, 4, 5, 5)      # 2.75s 깜빡
    pulse(blink, 445, 4, 5, 5)      # 7.4s 깜빡
    pulse(smile, 285, 8, 70, 10)    # 4.75s~ 눈웃음 약 1.5초

    scn.render.image_settings.file_format = "PNG"
    scn.render.filepath = OUT + "\\f_"
    bpy.ops.render.render(animation=True)
    print("ANIM OK", N, "frames →", OUT, "engine=", scn.render.engine)
