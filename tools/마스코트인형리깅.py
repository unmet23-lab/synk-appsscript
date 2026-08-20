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
#   ⑥ (v2 하이브리드 · 08-15) 익명 GPU 몫 0 실측으로 텍스처 API 가 닫혀 있는 동안의 로컬 통로:
#      «오브젝트 공간 노멀»이 정면(-Y)에서 멀어질수록 사진 → «울 패치»(같은 사진의 민무늬 양모 영역을
#      잘라 MIRROR 타일로 옆면에 평면 투영)로 섞는다. 마스코트의 옆·뒤는 민무늬 펠트라 성립한다.
#      ⚠ TexCoord.Normal(오브젝트 공간)로 잰다 — 월드 노멀이면 몸이 돌 때 경계가 표면 위를 미끄러진다.
#      ⚠ 프로시저럴 노이즈는 기각(probe2 실측 08-15) — 매끈한 왁스로 읽혀 사진의 섬유 결과 갈라진다.
#        진짜 섬유는 사진 픽셀에서만 온다 — 그래서 패치를 사진에서 «잘라» 쓴다(색·결 자동 일치).
#      대가: 패치 타일은 명암이 균일해 사진의 구운 음영 경사와 완전히 같지는 않다 — 경계는 smoothstep
#      폭(dot 0.10~0.50)이 숨기지만, 극단 조명에선 반달 경계가 보일 수 있다(probe2 로 눈검증 후 쓴다).
#      v1 모드(probe·anim)는 이 갈래를 안 탄다 — 승인받은 판의 재현성은 그대로.
#
# 사용:
#   blender -b -P tools/마스코트인형리깅.py -- probe <glb> <본체누끼.png> <출력.png>
#   blender -b -P tools/마스코트인형리깅.py -- anim  <glb> <본체누끼> <눈감음> <눈웃음> <출력폴더> [프레임수=600]
#   blender -b -P tools/마스코트인형리깅.py -- probe2 <glb> <본체누끼> <출력접두> <yaw도들(콤마 · 예 0,20,35,45)>
#   blender -b -P tools/마스코트인형리깅.py -- probe3 <채색glb> <출력접두> <yaw도들(예 0,45,90,135,180)>
#     probe3 = 텍스처가 구워진 GLB 전용(마스코트채색굽기.py 산출) — 투영·울패치를 안 타므로 요 제한이 없다.
#   blender -b -P tools/마스코트인형리깅.py -- anim2 <glb> <본체누끼> <눈감음> <눈웃음> <출력폴더> [프레임수=600] [시작] [끝]
#     시작·끝 = 렌더 «구간»만 좁힌다(키프레임은 늘 전체 N 을 박는다 — 결정론이라 구간 이어붙기에 이음매 0).
#     ⚠ 블렌더가 긴 렌더 중 조용히 죽을 수 있다(실측 08-15: 572/600 에서 exit 0 얼굴) — 빠진 구간만 재굽는 용도.
#   python tools/마스코트인형리깅.py 조립 <프레임폴더> <출력.mp4> [프레임수=600] [fps=60] [--재굽기=a-b,c-d]
#     ⚠ 조립은 «이 통로 하나»로만 한다 — 맨손 ffmpeg 금지(구 머리말의 그 한 줄이 이번 사고의 통로다).
#     블렌더 없이 도는 유일한 모드다(파이썬 표준 + ffmpeg).
import sys, math

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
MODE = argv[0]

if MODE == "조립":
    # 프레임 폴더 → mp4. 굽기 «전에» 폴더가 한 벌인지부터 잰다.
    # 왜(실사고 08-15): 렌더가 도는 중에 맨손 ffmpeg 로 구웠더니 앞 절반은 새 렌더·뒤 절반은
    #   «앞 렌더가 남긴 낡은 파일»인 영상이 나왔다(코랄_3D라이브_v3.mp4 의 f300·f450·f480 이
    #   v2 와 바이트 동일). 그걸 라이브 판으로 읽고 「좌 턴이 안 착지한다」는 없는 결함을 진단했다 —
    #   렌더 폴더는 덮어쓰기라 «렌더 머리»보다 뒤 번호는 늘 지난 판이다.
    # 잣대 둘: ①1~N 이 다 있는가 ②mtime 이 번호 순으로 단조증가하는가(역행 = 두 벌이 섞였다는 뜻).
    # 대가(틀릴 때의 모습):
    #   · 거짓양성 — 중간 구간을 «일부러» 다시 구우면 그 구간이 최신이라 정당한 역행이 생긴다.
    #     거절문이 `--재굽기=<시작>-<끝>` 과 그 조건을 함께 알려준다. ⚠붙여넣을 값을 만들어 주지는
    #     않는다 — 그러면 이번 사고의 역행 지점이 그대로 면제문으로 나와 세탁 처방이 된다.
    #   · 거짓음성 — mtime 을 안 보존하고 폴더를 복사하면 시각이 평평해져 ②가 조용히 통과한다.
    #     그 경우 남는 방어는 ① 뿐이다.
    #   · 「렌더가 지금 도는 중인가」를 따로 안 잰다 — 빈 폴더 위면 ①이, 낡은 한 벌 위면 ②가 잡아
    #     실측된 두 경우를 이미 덮는다(중복 장치를 안 만든다).
    import os, glob, time, subprocess
    # 윈도 콘솔은 cp949 라 「—」 하나에 도구가 죽는다(실측) — 진단문을 내는 게 일인 가드가
    # 자기 출력에 죽으면 그 자리가 통째로 사각이 된다. 못 그리는 글자는 대체해서라도 낸다.
    for 통 in (sys.stdout, sys.stderr):
        try:
            통.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    자리 = [a for a in argv[1:] if not a.startswith("--")]
    폴더, 출력 = 자리[0], 자리[1]
    N = int(자리[2]) if len(자리) > 2 else 600
    fps = int(자리[3]) if len(자리) > 3 else 60
    재굽기 = []
    for a in argv:
        if a.startswith("--재굽기="):
            for 구간 in a.split("=", 1)[1].split(","):
                lo, hi = 구간.split("-")
                재굽기.append((int(lo), int(hi)))

    def 면제(i):
        return any(lo <= i <= hi for lo, hi in 재굽기)

    때 = {}
    for p in glob.glob(os.path.join(폴더, "f_*.png")):
        번호 = os.path.basename(p)[2:-4]
        if 번호.isdigit():
            때[int(번호)] = os.path.getmtime(p)

    빠짐 = [i for i in range(1, N + 1) if i not in 때]
    if 빠짐:
        print(f"🔴 조립 거절 — 1~{N} 중 {len(빠짐)}장이 없다:",
              ", ".join(str(i) for i in 빠짐[:20]) + (" …" if len(빠짐) > 20 else ""))
        print(f"   ▶ 빠진 구간만 다시 굽는다: … -- anim2 <…> <출력폴더> {N} {빠짐[0]} {빠짐[-1]}")
        raise SystemExit(2)

    def 시각(i):
        return time.strftime("%H:%M:%S", time.localtime(때[i]))

    # 선언한 «재굽기» 구간은 이웃보다 새 것이어야 한다 — 안 그러면 이 면제가 이번 사고를 그대로
    # 세탁한다(낡은 꼬리의 첫 번호를 「내가 다시 구웠다」고 적으면 나머지 낡은 판은 자기들끼리
    # 단조증가라 통과한다). 다시 구운 구간은 정의상 «새 섬»이다 — 그걸 기계가 되묻는다.
    거짓선언 = [(lo, hi) for lo, hi in 재굽기
                if (lo - 1 in 때 and 때[lo] < 때[lo - 1]) or (hi + 1 in 때 and 때[hi] < 때[hi + 1])]
    if 거짓선언:
        print("🔴 조립 거절 — --재굽기 로 선언한 구간이 이웃보다 «오래됐다». 다시 구운 게 아니다:")
        for lo, hi in 거짓선언:
            print(f"   {lo}-{hi} : f_{lo:04d}({시각(lo)}) · f_{hi:04d}({시각(hi)})")
        print("   ▶ 면제를 지우고, 렌더를 끝낸 뒤 다시 부른다.")
        raise SystemExit(2)

    역행 = [i for i in range(2, N + 1)
            if 때[i] < 때[i - 1] and not (면제(i) or 면제(i - 1))]
    if 역행:
        print(f"🔴 조립 거절 — 프레임 두 벌이 섞였다(mtime 역행 {len(역행)}곳).")
        for i in 역행[:5]:
            print(f"   f_{i-1:04d}({시각(i-1)}) → f_{i:04d}({시각(i)}) : {(때[i-1]-때[i])/60:.1f}분 뒤로")
        print("   왜: 렌더가 아직 도는 중이면 «렌더 머리» 뒤 번호는 앞 렌더가 남긴 낡은 파일이다.")
        print("   ▶ 렌더가 끝난 뒤 다시 부른다.")
        print("   · 중간 구간을 «일부러» 다시 구운 경우에만 --재굽기=<시작>-<끝> 으로 선언한다"
              " — 그 구간이 이웃보다 새 것일 때만 통과한다(위 사고는 이걸로 못 지난다).")
        raise SystemExit(2)

    if "--검사만" in argv:
        print(f"검사 OK — {N}장 · 빠짐 0 · 역행 0 (굽지 않았다)")
        raise SystemExit(0)

    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", str(fps),
                        "-start_number", "1", "-i", os.path.join(폴더, "f_%04d.png"),
                        "-frames:v", str(N), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        "-crf", "18", 출력])
    if r.returncode != 0:
        raise SystemExit("🔴 ffmpeg 실패")
    print(f"조립 OK — {N}장 · {fps}fps · 한 벌 확인(빠짐 0 · 역행 0) → {출력}")
    raise SystemExit(0)

import bpy
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

def 울패치(src_img, cx, cy, s=192):
    # 본체 사진에서 민무늬 양모 s×s 를 잘라 타일 이미지를 만든다 — cx·cy 는 «이미지 좌표»(왼위 원점).
    # ⚠ 배(520,600)는 기각(probe2 v2 실측) — 채도는 오히려 높지만(S 0.70) 마블 줄무늬가 타일로 반복된다.
    #   정본 = 윗돔(510,320) — 눈(y≥395) 위·돔 꼭대기(y≈230) 아래의 균질 민무늬(S 0.57 · V 0.98).
    import numpy as np
    w, h = src_img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    src_img.pixels.foreach_get(buf)
    a = buf.reshape(h, w, 4)
    y0 = h - cy - s // 2
    x0 = cx - s // 2
    p = a[y0:y0 + s, x0:x0 + s, :].copy()
    # AgX 톤맵은 밝은 값의 채도를 씻는다(실측: 원본 S 0.572 → 렌더 S 0.365) — 회색축 고정으로
    # 채도를 미리 올리고(×1.25) 명도를 어깨 아래로 내린다(×0.88). 균일 ×0.93 은 기각(채도 축 못 건드림).
    rgb = p[:, :, :3]
    luma = (rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32))[:, :, None]
    p[:, :, :3] = np.clip((luma + 1.25 * (rgb - luma)) * 0.88, 0.0, 1.0)
    p[:, :, 3] = 1.0
    img = bpy.data.images.new("울패치", width=s, height=s)
    img.pixels.foreach_set(p.ravel())
    return img

def make_material(obj, img_paths, hybrid=False):
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
    out = base.outputs[2]
    if hybrid:
        # 창백함의 원인은 명도가 아니라 «채도»였다(probe2 v4 실측: V 0.82=0.82 · S 0.55→0.34) —
        # 스펙큘러·sheen 이 스치는 각에서 흰빛을 «더해» 옆면을 씻는다. 하이브리드 판에서만 끈다(v1 무변경).
        for nm in ("Specular IOR Level", "Specular"):
            if nm in bsdf.inputs:
                bsdf.inputs[nm].default_value = 0.0
                break
        for nm in ("Sheen Weight", "Sheen"):
            if nm in bsdf.inputs:
                bsdf.inputs[nm].default_value = 0.1
                break
        # 통로 ⑥ — 오브젝트 공간 노멀·정면(-Y) 내적으로 사진(정면) ↔ 펠트 결(옆·뒤)을 섞는다
        texco = nt.nodes.new("ShaderNodeTexCoord")
        texco.location = (-950, -300)
        dot = nt.nodes.new("ShaderNodeVectorMath")
        dot.operation = "DOT_PRODUCT"
        dot.location = (-750, -300)
        dot.inputs[1].default_value = (0.0, -1.0, 0.0)
        nt.links.new(texco.outputs["Normal"], dot.inputs[0])
        front = nt.nodes.new("ShaderNodeMapRange")
        front.location = (-550, -300)
        front.interpolation_type = "SMOOTHSTEP"
        # 0.10~0.50 은 기각(probe2 v2·v3) — 옆면 블렌드에 사진 «가장자리 창백 픽셀» 지분이 남아 옆이 연해진다.
        front.inputs["From Min"].default_value = 0.25
        front.inputs["From Max"].default_value = 0.55
        nt.links.new(dot.outputs["Value"], front.inputs[0])
        # 울 패치 — 본체 사진에서 잘라낸 진짜 섬유를 오브젝트 공간 X축 평면 투영으로 옆면에 타일
        # (±45° 턴에서 보이는 것은 옆면뿐이라 한 축 투영으로 충분 — 뒤 180°가 필요해지면 그때 넓힌다)
        # 반복 무늬 대책: 같은 패치를 «회전(uv 스왑)·다른 배율» 두 벌로 깔고 큰 노이즈로 섞는다(타일 주기 상쇄).
        s = 144
        patch = 울패치(texs[0].image, 510, 320, s)
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        sep.location = (-950, -520)
        nt.links.new(texco.outputs["Object"], sep.inputs[0])
        tile = W * (s / texs[0].image.size[0])  # 본체 사진과 같은 섬유 밀도가 되는 타일 한 변(오브젝트 단위)

        def 패치층(u_out, v_out, tile_len, ypos):
            comb = nt.nodes.new("ShaderNodeCombineXYZ")
            comb.location = (-800, ypos)
            nt.links.new(u_out, comb.inputs[0])
            nt.links.new(v_out, comb.inputs[1])
            scl = nt.nodes.new("ShaderNodeVectorMath")
            scl.operation = "MULTIPLY_ADD"
            scl.location = (-650, ypos)
            scl.inputs[1].default_value = (1.0 / tile_len, 1.0 / tile_len, 0.0)
            scl.inputs[2].default_value = (0.5, 0.5, 0.0)
            nt.links.new(comb.outputs[0], scl.inputs[0])
            t = nt.nodes.new("ShaderNodeTexImage")
            t.image = patch
            t.extension = "MIRROR"
            t.location = (-450, ypos)
            nt.links.new(scl.outputs[0], t.inputs["Vector"])
            return t

        pa = 패치층(sep.outputs["Y"], sep.outputs["Z"], tile, -520)
        pb = 패치층(sep.outputs["Z"], sep.outputs["Y"], tile * 1.61, -820)  # 회전 + 배율 — 주기 어긋냄
        bomb = nt.nodes.new("ShaderNodeTexNoise")
        bomb.location = (-450, -300)
        bomb.inputs["Scale"].default_value = 5.0
        nt.links.new(texco.outputs["Object"], bomb.inputs["Vector"])
        bfac = nt.nodes.new("ShaderNodeMapRange")
        bfac.location = (-300, -300)
        bfac.interpolation_type = "SMOOTHSTEP"
        bfac.inputs["From Min"].default_value = 0.35
        bfac.inputs["From Max"].default_value = 0.65
        nt.links.new(bomb.outputs["Fac"], bfac.inputs[0])
        pmix = nt.nodes.new("ShaderNodeMix")
        pmix.data_type = "RGBA"
        pmix.location = (-250, -520)
        nt.links.new(bfac.outputs[0], pmix.inputs[0])
        nt.links.new(pa.outputs["Color"], pmix.inputs[6])
        nt.links.new(pb.outputs["Color"], pmix.inputs[7])
        hyb = nt.nodes.new("ShaderNodeMix")
        hyb.data_type = "RGBA"
        hyb.location = (150, 0)
        nt.links.new(front.outputs[0], hyb.inputs[0])
        nt.links.new(pmix.outputs[2], hyb.inputs[6])
        nt.links.new(out, hyb.inputs[7])
        out = hyb.outputs[2]
    nt.links.new(out, bsdf.inputs["Base Color"])
    if "Emission Color" in bsdf.inputs:
        nt.links.new(out, bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 0.55
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return mat, mixes

def build_scene(glb, img_paths, hybrid=False, textured=False):
    # textured=True → GLB 에 구워져 온 재질을 그대로 쓴다(투영·울패치 통로를 아예 안 탄다).
    # 이 갈래에서만 요 제한이 없다 — 표면 전체가 자기 색을 지고 있어 뒤태까지 성립한다.
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
    bg.inputs[0].default_value = (0.00303, 0.00674, 0.0319, 1.0)  # Navy 2 #08090C (sRGB→linear 근사)
    bg.inputs[1].default_value = 1.0

    mat, mixes = (None, []) if textured else make_material(obj, img_paths, hybrid=hybrid)

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

elif MODE == "probe2":
    # 하이브리드 재질 눈검증 — 요 각별 스틸. 경계 반달·옆면 결이 어떻게 보이는지 여기서 먼저 본다.
    본체, 접두 = argv[2], argv[3]
    yaws = [float(x) for x in argv[4].split(",")] if len(argv) > 4 else [0, 20, 35, 45]
    scn, obj, rig, mixes = build_scene(GLB, [본체], hybrid=True)
    for y in yaws:
        rig.rotation_euler = (0, 0, math.radians(y))
        scn.render.filepath = f"{접두}yaw{int(y):+04d}.png"
        bpy.ops.render.render(write_still=True)
        print("PROBE2 OK", scn.render.filepath)

elif MODE == "probe3":
    # 텍스처 GLB 눈검증 — 요 각별 스틸. 여기서 «뒤태»를 처음 본다(투영 통로에는 없던 각).
    접두 = argv[2]
    yaws = [float(x) for x in argv[3].split(",")] if len(argv) > 3 else [0, 45, 90, 135, 180]
    scn, obj, rig, mixes = build_scene(GLB, [], textured=True)
    for y in yaws:
        rig.rotation_euler = (0, 0, math.radians(y))
        scn.render.filepath = f"{접두}yaw{int(y):+04d}.png"
        bpy.ops.render.render(write_still=True)
        print("PROBE3 OK", scn.render.filepath)

elif MODE == "anim2":
    # 큰 턴 + 제스처(호흡·바운스·깜빡임·눈웃음·더블 홉) — 아이들(rig) 위에 제스처(gest) 부모를 얹는다.
    # 아이들은 v1 과 같은 정수배 사이클, 제스처 키는 f1·fN 에서 전부 0 — 무한 루프 이음매 0 유지.
    본체, 감음, 웃음, OUT = argv[2], argv[3], argv[4], argv[5]
    N = int(argv[6]) if len(argv) > 6 else 600
    scn, obj, rig, mixes = build_scene(GLB, [본체, 감음, 웃음], hybrid=True)
    scn.frame_start = 1
    scn.frame_end = N
    two_pi = 2 * math.pi

    gest = bpy.data.objects.new("gest", None)
    scn.collection.objects.link(gest)
    rig.parent = gest

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

    def keys(o, path, idx, frames_vals, to_rad=False):
        for f, v in frames_vals:
            val = math.radians(v) if to_rad else v
            cur = getattr(o, path)
            cur[idx] = val
            setattr(o, path, cur)
            o.keyframe_insert(path, index=idx, frame=f)

    # 큰 턴 — **좌우 비대칭이 정답이다**(probe2 각도 스윕 실측 08-15):
    #   투영 한계는 각도가 아니라 «방향»에 있다. 좌(+)는 +90° 까지 눈이 온전한데, 우(-)는 -45° 부터
    #   눈 안에 코랄이 반달로 새어 「깨진 눈」이 된다(사진 속 눈 위치·돔 곡률의 좌우 비대칭).
    #   그래서 좌를 «크게 도는 순간»으로 쓰고, 우는 곁눈질 크기로 남긴다 — 사람도 한쪽으로 더 잘 돈다.
    #   ⚠ 아이들 요(±13°)가 더해지니 net 상한은 좌 +88°(안전) · 우 -35°(안전).
    #   🚫 우 턴을 -45° 이상으로 키우는 재시도 금지 — 재봤고 깨진다(neg_yaw-045·-060).
    keys(gest, "rotation_euler", 2, [(1, 0), (100, 0), (118, 5), (150, -28), (185, -24), (215, 0),
                                     (395, 0), (412, -8), (450, 75), (495, 68), (540, 0), (N, 0)], to_rad=True)
    keys(gest, "rotation_euler", 0, [(1, 0), (100, 0), (150, -3), (215, 0),
                                     (395, 0), (450, 5), (495, 4), (540, 0), (N, 0)], to_rad=True)

    # 더블 홉 (f283~356 · 눈웃음 f285 와 겹침) — 스쿼시&스트레치, 부피 보존
    for f, br in [(1, 1.0), (283, 1.0), (292, 0.93), (302, 1.07), (312, 0.96), (322, 1.0),
                  (330, 0.95), (338, 1.045), (348, 0.985), (356, 1.0), (N, 1.0)]:
        gest.scale = (1.0 / math.sqrt(br), 1.0 / math.sqrt(br), br)
        gest.keyframe_insert("scale", frame=f)
    keys(gest, "location", 2, [(1, 0), (283, 0), (292, -0.012), (303, 0.075), (313, 0.0), (322, 0),
                               (331, -0.008), (339, 0.05), (349, 0.0), (356, 0), (N, 0)])

    def pulse(sock, start_f, up, hold, down):
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
    pulse(blink, 424, 4, 5, 5)      # 7.1s 깜빡 — 큰 좌 턴에 «들어가는» 순간(감은 눈이 스윙을 가린다)
    pulse(smile, 285, 8, 70, 10)    # 4.75s~ 눈웃음 — 더블 홉과 한 호흡

    scn.frame_start = int(argv[7]) if len(argv) > 7 else 1
    scn.frame_end = int(argv[8]) if len(argv) > 8 else N
    scn.render.image_settings.file_format = "PNG"
    scn.render.filepath = OUT + "\\f_"
    bpy.ops.render.render(animation=True)
    print("ANIM2 OK", scn.frame_start, "~", scn.frame_end, "→", OUT, "engine=", scn.render.engine)
