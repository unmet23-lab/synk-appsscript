# 캐릭터 3D — 실시간(360°) 자산을 «표준 GLB 하나»로 굽는다 (2026-08-26 · 유호 지시 「진짜 게임처럼 360도」).
#
# ■ 이 도구가 푸는 관문 하나 — «펠트 털을 GLB 에 담는 법»
#   정본 굽기(요소굽기.py)의 털은 **블렌더 헤어 파티클**이라 glTF 규격 밖이다.
#   그대로 내보내면 **털이 통째로 사라진 민둥 몸**이 나온다 — 펠트는 회사 전용 재질이라 그건 죽음이다.
#   ⇒ 털을 **«셸»(껍질 여러 겹)로 굽는다**: 몸 표면을 N 겹 복제해 노멀 방향으로 밀어내고,
#     각 겹을 «털 밀도» 텍스처로 알파 클립(MASK)한다. 낮은 겹은 많이 남고 높은 겹은 조금 남아
#     **원뿔 모양 털**이 선다. 겹은 «진짜 지오메트리»라 커스텀 셰이더가 필요 없다 —
#     🔑 그래서 이 GLB 는 three.js·filament·블렌더 어디에 넣어도 **그대로 털이 보인다.**
#
#   🔑 텍스처는 **한 장**이다. 겹을 가르는 것은 `alphaCutoff` 하나뿐(겹 i → i/N).
#     같은 무작위 밀도 맵을 점점 높은 문턱으로 자르면 그것이 곧 털의 «가늘어짐»이다.
#   ⚠ 알파는 BLEND 가 아니라 **MASK** 다 — BLEND 는 겹칠 때 그리는 순서를 타서(정렬 문제)
#     360° 로 돌리면 겹이 서로를 지운다. MASK 는 픽셀이 있거나 없거나라 순서와 무관하다.
#
# ■ 형태는 «절차»로 짓는다 — 몽글이는 3D 소스가 없기 때문이다
#   정본 `펠트코랄_0815` 는 생성 이미지를 재염색한 PNG 뿐이다(커밋 15e2290d5).
#   그래서 3D 는 새로 짓는 수밖에 없다. 까몽·마린이 이미 그 방식(절차적 블렌더)이고,
#   이것은 «생성 모델 재생성»이 아니라 코드가 쥐는 형태라 유호 확정 08-14 「재생성 금지」와 무충돌이다.
#   실루엣은 정본 그림에서 읽었다: 둥근 돔 → 아래로 벌어지는 몸 → **물결 밑단 6산**.
#
# ■ 대가(틀릴 때의 모습)
#   · 셸은 «짧은 털»에만 성립한다. 긴 갈기는 겹이 벌어져 «비늘»로 읽힌다 — SYNK 는 짧은 퍼라 성립한다.
#   · 겹 수가 성능을 가른다(겹 = 정점 배수). 8겹이 기본 — 모바일에서 그 이상은 재보고 올린다.
#   · 극단 클로즈업에서는 겹 사이가 보인다. 그 자리는 실시간이 아니라 밤 Cycles 렌더가 맡는다.
#
# 쓰기:
#   blender -b -P tools/캐릭터3D.py -- 출력=<경로.glb> [캐릭터=몽글] [겹=8] [털길이=0.055] [해상도=1024]
import math
import os
import sys

import bpy

_인자 = {}
if '--' in sys.argv:
    for a in sys.argv[sys.argv.index('--') + 1:]:
        if '=' in a:
            k, v = a.split('=', 1)
            _인자[k] = v

출력 = _인자.get('출력') or sys.exit('출력=<경로.glb> 가 필요하다')
캐릭터 = _인자.get('캐릭터', '몽글')
겹수 = int(_인자.get('겹', '8'))
털길이 = float(_인자.get('털길이', '0.075'))
해상도 = int(_인자.get('해상도', '1024'))

# 킷 색 — docs/디자인_토큰.json 의 마스코트 평상복 램프와 같은 값(DESIGN.md §2 표).
색 = {
    'Coral':      (0.976, 0.408, 0.349),
    'Coral 2':    (0.992, 0.612, 0.529),
    'Coral Soft': (0.984, 0.718, 0.639),
    'Coral 3':    (0.682, 0.196, 0.165),
    'Stitch':     (0.941, 0.890, 0.784),
    'Ink':        (0.169, 0.137, 0.125),
    'Paper':      (0.984, 0.969, 0.941),
}


def s리니어(c):
    """sRGB → 선형. 블렌더 재질 색은 선형이고 위 표는 sRGB 라 반드시 거친다."""
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def 판갈이():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ── ① 형태 — 회전체 + 물결 밑단 ──────────────────────────────────────────────
def 몽글몸(고리=64, 마디=40, 물결산=6, 물결깊이=0.085):
    """정본 실루엣의 절차 번역: 돔 → 벌어지는 몸 → 물결 밑단.

    회전체로 짓는 까닭은 «UV 가 자동으로 곧게» 나오기 때문이다 — 셸의 털 텍스처가
    타일링될 때 이음매가 안 생긴다(구를 그냥 쓰면 극점에서 텍셀이 뭉친다).
    """
    프로파일 = [  # (반지름, 높이) — 위에서 아래로
        (0.000, 1.000), (0.180, 0.988), (0.352, 0.952), (0.510, 0.888),
        (0.648, 0.792), (0.760, 0.664), (0.842, 0.508), (0.898, 0.332),
        (0.936, 0.146), (0.962, -0.046), (0.980, -0.240), (0.992, -0.430),
        (1.000, -0.585),
    ]
    정점, 면, uv면 = [], [], []
    М = len(프로파일)
    for j, (r, y) in enumerate(프로파일):
        for i in range(고리):
            t = 2 * math.pi * i / 고리
            # 물결 밑단 — 아래로 갈수록 세게 먹인다(v² 로 위쪽은 건드리지 않는다)
            깊이 = 물결깊이 * ((j / (М - 1)) ** 2.4)
            yy = y + 깊이 * math.cos(물결산 * t)
            정점.append((r * math.cos(t), r * math.sin(t), yy))
    # 바닥 중앙(닫는 점) — 뚫려 있으면 360° 로 돌 때 속이 보인다
    정점.append((0.0, 0.0, -0.585 - 물결깊이 * 0.35))
    바닥 = len(정점) - 1

    def idx(i, j):
        return j * 고리 + (i % 고리)

    for j in range(М - 1):
        for i in range(고리):
            a, b, c, d = idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)
            # ⚠ winding 이 뒤집히면 노멀이 «안쪽»을 향해 셸이 몸 속으로 파고든다 —
            #   화면에는 «매끈한 고무»로 나오고 원인이 안 보인다(08-26 실측: dot(위치,노멀) = -0.999,
            #   8겹 최대반경이 몸보다 0.0038 «작았다»). 그래서 순서를 뒤집어 못박는다.
            if j == 0:                      # 꼭대기는 한 점으로 모인다
                면.append((a, d, c)); uv면.append(((i / 고리, 0.0), (i / 고리, 1 / (М - 1)), ((i + 1) / 고리, 1 / (М - 1))))
            else:
                면.append((a, d, c, b))
                uv면.append(((i / 고리, j / (М - 1)), (i / 고리, (j + 1) / (М - 1)),
                            ((i + 1) / 고리, (j + 1) / (М - 1)), ((i + 1) / 고리, j / (М - 1))))
    for i in range(고리):                    # 바닥 팬
        면.append((idx(i, М - 1), idx(i + 1, М - 1), 바닥))
        uv면.append(((i / 고리, 1.0), ((i + 1) / 고리, 1.0), ((i + 0.5) / 고리, 1.0)))

    me = bpy.data.meshes.new('몽글몸')
    me.from_pydata(정점, [], 면)
    me.update()
    층 = me.uv_layers.new(name='UVMap')
    k = 0
    for f, uvs in zip(me.polygons, uv면):
        for uv in uvs:
            층.data[k].uv = uv
            k += 1
    ob = bpy.data.objects.new('몽글몸', me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    return ob


# ── ② 털 밀도 맵 — 무작위 «가닥 씨앗» 한 장 ──────────────────────────────────
def 털맵(경로, 크기, 밀도=0.62, 씨=20260826):
    """각 텍셀 = 「그 자리 털이 어디까지 자라는가」(0~1).

    겹 i 는 이 값이 i/N 보다 큰 자리만 남긴다 ⇒ 낮은 겹은 굵고 높은 겹은 가늘어져 원뿔이 선다.
    ⚠ 균일 난수를 그대로 쓰면 «모래»가 된다 — 가닥은 «점»이 아니라 «작은 원»이라야
      털로 읽힌다. 그래서 씨앗을 뿌리고 각 씨앗 둘레에 부드러운 감쇠를 그린다.
    ⚠ 블렌더 내장 파이썬에는 PIL 이 없다(실측 08-26) — 이미지 저장은 bpy 가 한다.
    """
    import random

    import numpy as np

    손 = random.Random(씨)
    a = np.zeros((크기, 크기), dtype=np.float32)
    # 🔑 08-26 파라미터 탐색으로 못박은 값 — 「덮임」과 「끝」 둘을 동시에 만족하는 자리다.
    #   피부 덮임 94.2%(>0.115) · 중간 86.7%(>0.46) · **털 끝 29.7%(>0.92)**.
    #   ⚠ 너무 촘촘하면(끝 60%대) 최상단 겹이 화면을 다 덮어 **다시 매끈해진다** — 위아래 둘 다 함정이다.
    가닥수 = int(크기 * 크기 * 밀도 / 14.0)
    반경 = max(3.0, 크기 / 110.0)
    R = int(반경 * 1.3)
    yy, xx = np.mgrid[-R:R + 1, -R:R + 1]
    거리 = np.sqrt(xx ** 2 + yy ** 2) / 반경
    # 단면은 «원뿔»이 아니라 **평평한 원판 + 부드러운 테**다.
    #   원뿔(지수 감쇠)이면 중심만 높아 털 «끝»이 3.5% 밖에 안 남는다(실측) — 끝이 없으면 결이 안 보인다.
    핵 = np.clip((1.0 - 거리) / 0.28, 0.0, 1.0)
    for _ in range(가닥수):
        cx, cy = 손.randrange(크기), 손.randrange(크기)
        조각 = 핵 * 손.uniform(0.62, 1.0)          # 가닥마다 키가 다르다 = 층이 생긴다
        ys = (cy + np.arange(-R, R + 1)) % 크기    # 감김 인덱싱 — 타일 이음매 0
        xs = (cx + np.arange(-R, R + 1)) % 크기
        칸 = np.ix_(ys, xs)
        a[칸] = np.maximum(a[칸], 조각)
    im = bpy.data.images.new('털밀도', 크기, 크기, alpha=True)
    px = np.ones((크기, 크기, 4), dtype=np.float32)
    px[:, :, 3] = a
    im.pixels.foreach_set(px.ravel())
    im.filepath_raw = 경로
    im.file_format = 'PNG'
    im.alpha_mode = 'STRAIGHT'
    im.save()
    return im


# ── ③ 셸 — 겹을 «진짜 지오메트리»로 굽는다 ───────────────────────────────────
def 셸입히기(몸, tex, 겹수, 길이, 몸색, 타일=3.0):
    """몸을 N 겹 복제해 노멀 방향으로 밀고, 겹마다 alphaCutoff 를 높인다."""
    안쪽 = s리니어(몸색)
    껍질들 = []
    for i in range(1, 겹수 + 1):
        t = i / 겹수
        새 = 몸.copy()
        새.data = 몸.data.copy()
        새.name = f'털겹_{i:02d}'
        bpy.context.collection.objects.link(새)
        # 노멀 방향 밀어내기 — Displace 대신 정점을 직접 옮긴다(모디파이어는 GLB 로 안 나간다).
        # ⚠ 노멀을 «먼저 전부» 읽는다 — co 를 고치는 도중에 읽으면 이미 옮긴 이웃 때문에 재계산되어 오염된다.
        법선 = [v.normal.copy() for v in 새.data.vertices]
        for v, n in zip(새.data.vertices, 법선):
            v.co = (v.co[0] + n[0] * 길이 * t, v.co[1] + n[1] * 길이 * t, v.co[2] + n[2] * 길이 * t)
        m = bpy.data.materials.new(f'털_{i:02d}')
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes['Principled BSDF']
        # 뿌리는 그늘, 끝은 빛 — 이 한 축이 «부피»를 낸다(펠트 램프 5단의 축약).
        # 🔑 08-26 실측: 0.72~1.14(폭 1.58배)로는 **정면이 매끈한 고무로 렌더된다.**
        #   겹의 구멍으로 보이는 것은 «바로 아래 겹»인데 밝기가 1/8 밖에 안 갈리면 대비가 0 이다.
        #   털이 보이는 것은 가닥이 아니라 **뿌리 그늘**이므로 t 를 비선형으로 눌러 폭을 4배로 연다.
        밝기 = 0.30 + 0.92 * (t ** 1.6)
        bsdf.inputs['Base Color'].default_value = (안쪽[0] * 밝기, 안쪽[1] * 밝기, 안쪽[2] * 밝기, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.92
        if 'Specular IOR Level' in bsdf.inputs:
            bsdf.inputs['Specular IOR Level'].default_value = 0.18
        텍노드 = nt.nodes.new('ShaderNodeTexImage')
        텍노드.image = tex
        텍노드.interpolation = 'Closest'   # 문턱 근처를 뭉개지 않는다 — 가닥 끝이 또렷해진다
        맵핑 = nt.nodes.new('ShaderNodeMapping')
        좌표 = nt.nodes.new('ShaderNodeTexCoord')
        맵핑.inputs['Scale'].default_value = (타일, 타일, 1.0)
        nt.links.new(좌표.outputs['UV'], 맵핑.inputs['Vector'])
        nt.links.new(맵핑.outputs['Vector'], 텍노드.inputs['Vector'])
        # 🔑 알파를 **0/1 로 직접 자른다** — blender 4.2 에서 CLIP 블렌드가 사라져
        #   재질 설정만으로는 클립이 안 된다(08-26 실측: 8겹이 통째로 불투명해져 매끈한 고무로 렌더됐다).
        #   Greater Than 은 렌더러·내보내기와 무관하게 «셰이더가» 자르므로 어디서나 같은 그림이 나온다.
        자르기 = nt.nodes.new('ShaderNodeMath')
        자르기.operation = 'GREATER_THAN'
        자르기.inputs[1].default_value = t * 0.92
        nt.links.new(텍노드.outputs['Alpha'], 자르기.inputs[0])
        nt.links.new(자르기.outputs['Value'], bsdf.inputs['Alpha'])
        # 🔑 glTF exporter 는 이 둘을 읽어 alphaMode=MASK · alphaCutoff 를 쓴다.
        #   5.x 에서 이름이 바뀐 자리가 있어 있는 것만 세팅한다(없으면 후처리가 GLB JSON 에 직접 박는다).
        for 키, 값 in (('blend_method', 'CLIP'), ('alpha_threshold', t * 0.92),
                      ('surface_render_method', 'DITHERED')):
            try:
                setattr(m, 키, 값)
            except (AttributeError, TypeError):
                pass
        새.data.materials.clear()
        새.data.materials.append(m)
        껍질들.append((새, t * 0.92))
        if i == 겹수:
            print(f'[캐릭터3D] 진단 · 바깥겹 재질: '
                  f"surface_render_method={getattr(m, 'surface_render_method', '없음')} "
                  f"blend={getattr(m, 'blend_method', '없음')} 컷오프={t*0.92:.3f}")
    # 속몸 — 겹 사이로 배경이 비치지 않게 받치는 불투명 몸
    속 = bpy.data.materials.new('속살')
    속.use_nodes = True
    b = 속.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (안쪽[0] * 0.26, 안쪽[1] * 0.26, 안쪽[2] * 0.26, 1.0)
    b.inputs['Roughness'].default_value = 0.95
    몸.data.materials.clear()
    몸.data.materials.append(속)
    return 껍질들


# ── ④ 구슬 눈 ────────────────────────────────────────────────────────────────
def 구슬눈(반경=0.135, 벌림=0.285, 높이=0.372, 앞=-0.98, 털두께=0.075):
    """또렷한 것은 «광 나는 구슬» — 몽글 문법. 캐치라이트 한 점이 생기를 낸다.

    ⚠ 08-26 실측: 셸을 밖으로 밀자 **털이 눈을 통째로 덮었다.** 구슬은 털보다 밖에 있어야 한다 —
      구슬 반경이 털 두께보다 크고(0.135 > 0.075), 중심이 몸 표면에 놓여야 절반이 솟는다.
    """
    눈들 = []
    검정 = bpy.data.materials.new('눈구슬')
    검정.use_nodes = True
    b = 검정.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*s리니어(색['Ink']), 1.0)
    b.inputs['Roughness'].default_value = 0.14
    if 'Metallic' in b.inputs:
        b.inputs['Metallic'].default_value = 0.0
    흰 = bpy.data.materials.new('캐치라이트')
    흰.use_nodes = True
    w = 흰.node_tree.nodes['Principled BSDF']
    w.inputs['Base Color'].default_value = (*s리니어(색['Paper']), 1.0)
    w.inputs['Roughness'].default_value = 0.08
    if 'Emission Color' in w.inputs:
        w.inputs['Emission Color'].default_value = (*s리니어(색['Paper']), 1.0)
        w.inputs['Emission Strength'].default_value = 0.45
    for 쪽 in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=반경, segments=28, ring_count=18)
        눈 = bpy.context.object
        눈.name = f'눈_{"좌" if 쪽 < 0 else "우"}'
        # 몸 표면에 «박힌» 자리 — 구슬이 절반쯤 잠겨야 꿰맨 것으로 읽힌다
        눈.location = (쪽 * 벌림, 앞 * 0.86, 높이)   # xy 거리 ≈ 0.89 = 그 높이의 몸 표면
        눈.data.materials.append(검정)
        for p in 눈.data.polygons:
            p.use_smooth = True
        눈들.append(눈)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=반경 * 0.27, segments=16, ring_count=10)
        빛 = bpy.context.object
        빛.name = f'캐치_{"좌" if 쪽 < 0 else "우"}'
        빛.location = (쪽 * 벌림 - 0.042, 앞 * 0.86 - 0.072, 높이 + 0.046)
        빛.data.materials.append(흰)
        for p in 빛.data.polygons:
            p.use_smooth = True
        눈들.append(빛)
    return 눈들


# ── ⑤ 굽기 ───────────────────────────────────────────────────────────────────
def 굽기():
    판갈이()
    os.makedirs(os.path.dirname(출력), exist_ok=True)
    맵 = 털맵(os.path.join(os.path.dirname(출력), '털밀도.png'), 해상도)
    몸 = 몽글몸()
    껍질 = 셸입히기(몸, 맵, 겹수, 털길이, 색['Coral'])
    구슬눈()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=출력,
        export_format='GLB',
        export_apply=True,
        export_yup=True,
        export_materials='EXPORT',
        export_image_format='AUTO',
    )
    총정점 = sum(len(o.data.vertices) for o in bpy.data.objects if o.type == 'MESH')
    print(f'[캐릭터3D] {출력}  {os.path.getsize(출력)//1024}KB · 겹 {겹수} · 정점 {총정점:,} · 오브젝트 {len(bpy.data.objects)}')
    return [c for _, c in 껍질]



# ── ⑥ GLB 후처리 — alphaMode 를 MASK 로 못 박는다 ────────────────────────────
def GLB알파고치기(경로, 컷오프들):
    """blender 4.2 부터 재질의 CLIP 블렌드가 없어져 exporter 가 **BLEND** 를 쓴다(실측 08-26).

    BLEND 는 그리는 «순서»를 타므로 360° 로 돌리면 겹이 서로를 지운다 — 털이 깜빡인다.
    ⇒ GLB 의 JSON 청크를 열어 털 겹 재질만 `MASK` + `alphaCutoff` 로 바꾼다.
      🔑 이 한 자리가 「털이 360° 로 버티는가」를 가른다. 몸·눈은 OPAQUE 그대로 둔다.
    ⚠ 청크는 4바이트 정렬이다 — JSON 은 공백(0x20), BIN 은 0x00 으로 채운다.
      길이 셋(파일 전체·JSON 청크·BIN 청크)을 다 고쳐야 한다(하나만 틀려도 로더가 거절한다).
    """
    import json
    import struct

    raw = open(경로, 'rb').read()
    if raw[:4] != b'glTF':
        raise SystemExit('GLB 가 아니다: ' + 경로)
    off, js, binc = 12, None, b''
    while off < len(raw):
        ln, ty = struct.unpack_from('<II', raw, off)
        off += 8
        if ty == 0x4E4F534A:
            js = json.loads(raw[off:off + ln].decode('utf-8'))
        elif ty == 0x004E4942:
            binc = raw[off:off + ln]
        off += ln

    고침 = 0
    for m in js.get('materials', []):
        이름 = m.get('name', '')
        if not 이름.startswith('털_'):
            continue
        i = int(이름.split('_')[1])
        m['alphaMode'] = 'MASK'
        m['alphaCutoff'] = round(컷오프들[i - 1], 4)
        m['doubleSided'] = True          # 털 겹은 안쪽에서도 보여야 실루엣이 안 뚫린다
        고침 += 1

    jb = json.dumps(js, separators=(',', ':')).encode('utf-8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    bb = binc + bytes((4 - len(binc) % 4) % 4)
    총 = 12 + 8 + len(jb) + (8 + len(bb) if bb else 0)
    out = bytearray()
    out += b'glTF' + struct.pack('<II', 2, 총)
    out += struct.pack('<II', len(jb), 0x4E4F534A) + jb
    if bb:
        out += struct.pack('<II', len(bb), 0x004E4942) + bb
    open(경로, 'wb').write(out)
    print(f'[캐릭터3D] alphaMode=MASK 로 고친 재질 {고침}개 · GLB {len(out)//1024}KB')
    return 고침


# ── ⑦ 미리보기 — EEVEE 로 360° 를 «네 각도»에서 본다 ─────────────────────────
def 미리보기(접두, 각도들=(0, 90, 180, 270), 너비=560):
    """🔑 셸은 헤어 파티클이 «아니라» 그냥 메시다 — 그래서 EEVEE 가 정상 속도로 돈다.
    (헤어 파티클에서 EEVEE Next 가 레거시보다 40배 느린 함정 #114752 을 원리적으로 비켜간다.)
    이 렌더 시간이 곧 «영화형을 EEVEE 로 굽는 비용»의 실측이다.
    """
    import time

    씬 = bpy.context.scene
    씬.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in         bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items else 'BLENDER_EEVEE'
    씬.render.film_transparent = False
    씬.view_settings.view_transform = 'AgX'          # 정본 요소굽기.py 와 같은 자
    try:
        씬.view_settings.look = 'AgX - Punchy'       # 〃 (없는 빌드면 조용히 건너뛴다)
    except TypeError:
        pass
    씬.render.resolution_x = 너비
    씬.render.resolution_y = 너비
    씬.world = bpy.data.worlds.new('무대')
    씬.world.use_nodes = True
    씬.world.node_tree.nodes['Background'].inputs['Color'].default_value = (*s리니어(색['Paper']), 1.0)
    씬.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0

    for 이름, 위치, 힘 in (('키', (2.6, -3.4, 2.9), 900), ('필', (-3.2, -1.8, 1.1), 260),
                          ('림', (0.4, 3.6, 2.4), 420)):
        d = bpy.data.lights.new(이름, 'AREA')
        d.energy = 힘
        d.size = 3.4
        o = bpy.data.objects.new(이름, d)
        o.location = 위치
        o.rotation_euler = (math.atan2(math.hypot(위치[0], 위치[1]), 위치[2]),
                            0, math.atan2(위치[1], 위치[0]) + math.pi / 2)
        bpy.context.collection.objects.link(o)

    cam_d = bpy.data.cameras.new('카메라')
    cam_d.lens = 85
    cam = bpy.data.objects.new('카메라', cam_d)
    bpy.context.collection.objects.link(cam)
    씬.camera = cam

    피벗 = bpy.data.objects.new('피벗', None)
    bpy.context.collection.objects.link(피벗)
    피벗.location = (0, 0, 0.16)
    cam.parent = 피벗
    cam.location = (0, -6.2, 0.9)
    cam.rotation_euler = (math.radians(82), 0, 0)

    잰값 = []
    for a in 각도들:
        피벗.rotation_euler = (0, 0, math.radians(a))
        씬.render.filepath = f'{접두}_{a:03d}.png'
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        잰값.append((a, time.time() - t0))
    for a, 초 in 잰값:
        print(f'[캐릭터3D] 미리보기 {a:3d}° · {초:.1f}초')
    print(f'[캐릭터3D] 한 장 평균 {sum(s for _, s in 잰값)/len(잰값):.1f}초 '
          f'({너비}px · EEVEE) — 60fps 10초(600장) 환산 {sum(s for _, s in 잰값)/len(잰값)*600/60:.0f}분')
    return 잰값

컷오프들 = 굽기()
GLB알파고치기(출력, 컷오프들)
if _인자.get('미리보기'):
    미리보기(_인자['미리보기'])
print('[캐릭터3D] 겹 컷오프:', ' '.join(f'{c:.3f}' for c in 컷오프들))
