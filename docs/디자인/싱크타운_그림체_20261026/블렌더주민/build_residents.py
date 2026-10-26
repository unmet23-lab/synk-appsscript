import bpy
import bmesh
import math
import os
import sys
import json
import time
import traceback
from mathutils import Vector, Matrix, Euler


# ==============================================================================
# 0. 경로 및 인자 처리
# ==============================================================================

def get_script_dir():
    argv = sys.argv
    for i, arg in enumerate(argv):
        if arg in ("-P", "--python") and i + 1 < len(argv):
            return os.path.dirname(os.path.abspath(argv[i + 1]))
        if arg.endswith(".py") and os.path.exists(arg):
            return os.path.dirname(os.path.abspath(arg))
    if "__file__" in globals():
        return os.path.dirname(os.path.abspath(__file__))
    return os.getcwd()


def parse_cli_args():
    argv = sys.argv
    if "--" in argv:
        extra = argv[argv.index("--") + 1:]
    else:
        extra = []
    return {
        "previews": ("--previews" in extra),
        "raw": extra,
    }


# ==============================================================================
# 1. 결정론적 3D 절차적 노이즈 & 사방으로 엉킨 짧은 양모 섬유 결
# ==============================================================================

_PERM = [
    151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
    8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
    35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
    134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
    55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,
    18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,
    250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,
    189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,
    172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,
    228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,
    107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
    138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
]
_PERM = _PERM + _PERM


def _fade(t):
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)


def _lerp(t, a, b):
    return a + t * (b - a)


def _grad(hash_val, x, y, z):
    h = hash_val & 15
    u = x if h < 8 else y
    v = y if h < 4 else (x if h in (12, 14) else z)
    return (u if (h & 1) == 0 else -u) + (v if (h & 2) == 0 else -v)


def pnoise3(x, y, z):
    X = int(math.floor(x)) & 255
    Y = int(math.floor(y)) & 255
    Z = int(math.floor(z)) & 255
    x -= math.floor(x)
    y -= math.floor(y)
    z -= math.floor(z)
    u = _fade(x)
    v = _fade(y)
    w = _fade(z)
    A = _PERM[X] + Y
    AA = _PERM[A] + Z
    AB = _PERM[A + 1] + Z
    B = _PERM[X + 1] + Y
    BA = _PERM[B] + Z
    BB = _PERM[B + 1] + Z
    return _lerp(
        w,
        _lerp(
            v,
            _lerp(u, _grad(_PERM[AA], x, y, z), _grad(_PERM[BA], x - 1.0, y, z)),
            _lerp(u, _grad(_PERM[AB], x, y - 1.0, z), _grad(_PERM[BB], x - 1.0, y - 1.0, z)),
        ),
        _lerp(
            v,
            _lerp(u, _grad(_PERM[AA + 1], x, y, z - 1.0), _grad(_PERM[BA + 1], x - 1.0, y, z - 1.0)),
            _lerp(u, _grad(_PERM[AB + 1], x, y - 1.0, z - 1.0), _grad(_PERM[BB + 1], x - 1.0, y - 1.0, z - 1.0)),
        ),
    )


def felt_macro_lump(x, y, z, seed=0.0):
    """손으로 바늘질해 뭉친 큰 굴곡 (낮은 판과 높은 판 공유)."""
    s = seed * 13.7
    n1 = pnoise3(x * 3.0 + s, y * 3.0 - s, z * 2.8 + s * 0.5)
    n2 = pnoise3(x * 6.2 - s * 0.4, y * 6.2 + s * 0.8, z * 5.8 - s)
    n3 = pnoise3(x * 11.0 + s * 0.9, y * 11.0 + s * 0.2, z * 11.0 + s * 0.3)
    return 0.62 * n1 + 0.28 * n2 + 0.10 * n3


# 4개의 서로 다른 3D 회전 행렬 (사방으로 엉킨 짧은 양모 결 생성용)
_FIBER_MATS = [
    Euler((0.42, 0.78, 0.31), "XYZ").to_matrix(),
    Euler((-0.85, 0.34, 1.12), "XYZ").to_matrix(),
    Euler((1.05, -0.62, -0.48), "XYZ").to_matrix(),
    Euler((-0.38, -0.95, 0.74), "XYZ").to_matrix(),
]


def felt_tangled_web_detail(x, y, z, seed=0.0):
    """
    높은 판(_high) 전용:
    mongle_master_felt.jpg처럼 폭 0.5~1 mm · 길이 4~12 mm의 가늘고 짧은 양모 털이
    사방으로 겹겹이 엉켜 덮은 얕은 털 결(높이 0.2~0.5 mm) + 바늘로 다진 중간 굴곡.
    """
    s = seed * 5.7
    # 섬유가 직선이 아니라 양모처럼 살짝 휘어지도록 도메인 왜곡
    wx = x + 0.022 * pnoise3(x * 18.0 + s, y * 18.0, z * 18.0)
    wy = y + 0.022 * pnoise3(x * 18.0, y * 18.0 + s, z * 18.0)
    wz = z + 0.022 * pnoise3(x * 18.0, y * 18.0, z * 18.0 + s)
    p = Vector((wx, wy, wz))

    # 4개 방향으로 교차하며 겹겹이 얽힌 비등방성(폭 ~0.8mm, 길이 ~8mm) 섬유 웹
    web_sum = 0.0
    for idx, rmat in enumerate(_FIBER_MATS):
        q = rmat @ p
        off = idx * 7.3 + s
        # 가로(폭) 방향은 고주파(78 Hz -> 폭 ~0.8mm), 세로(길이) 방향은 저주파(10 Hz -> 길이 ~8mm)
        n_str = pnoise3(q.x * 78.0 + off, q.y * 78.0 - off, q.z * 10.5 + off * 0.5)
        # 부드러운 반원통형 양모 가닥 단면 (1.0 - |n|)
        ridge = 1.0 - abs(n_str) * 1.65
        web_sum += ridge

    web_val = (web_sum / 4.0) - 0.35

    # 손으로 바늘질해 뭉친 중간 양모 덩어리 굴곡
    clump = (
        0.65 * pnoise3(x * 16.0 - s, y * 16.0 + s, z * 16.0)
        + 0.35 * pnoise3(x * 32.0 + s, y * 32.0 - s, z * 32.0)
    )

    # 최종 변위 (미터 단위: 섬유 결 ~0.45 mm + 중간 양모 뭉침 ~0.75 mm)
    return 0.00055 * web_val + 0.00085 * clump


# ==============================================================================
# 2. 색상 및 재질 생성 (Principled BSDF 단일 종단 + 사방으로 엉킨 양모 범프)
# ==============================================================================

def hex_to_srgb_tuple(hex_str):
    h = hex_str.lstrip("#")
    return (
        int(h[0:2], 16) / 255.0,
        int(h[2:4], 16) / 255.0,
        int(h[4:6], 16) / 255.0,
    )


def srgb_to_linear(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgba(hex_str, alpha=1.0):
    r, g, b = hex_to_srgb_tuple(hex_str)
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)


def set_bsdf_input(bsdf, names, value):
    if isinstance(names, str):
        names = [names]
    for name in names:
        if name in bsdf.inputs:
            bsdf.inputs[name].default_value = value
            return True
    return False


def create_felt_material(name, hex_color, style="felt"):
    """
    모든 재질은 사용자 속성 synk_color에 hex를 담고,
    굽기(텍스처 베이크) 호환을 위해 Principled BSDF 하나로 끝나도록 구성한다.
    3회차:
    - 폭 0.5~1mm · 길이 4~12mm의 짧은 양모 털이 사방으로 엉킨 3겹 비등방성 섬유 결을
      Bump(Normal)와 미세 색상 농담에 연결하여 미리보기와 베이크 모두에서 양모 결이 살아나게 함.
    - 흰 점이나 큰 얼룩 없이 부위 본래 색에 아주 옅은 얼룩만 부여.
    """
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat["synk_color"] = hex_color.lower()

    nt = mat.node_tree
    nt.nodes.clear()

    out_node = nt.nodes.new("ShaderNodeOutputMaterial")
    out_node.location = (780, 0)

    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (440, 0)
    nt.links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

    lin_rgba = hex_to_linear_rgba(hex_color, 1.0)
    set_bsdf_input(bsdf, "Base Color", lin_rgba)

    if style == "bead_black":
        set_bsdf_input(bsdf, "Roughness", 0.035)
        set_bsdf_input(bsdf, ["Specular IOR Level", "Specular"], 0.92)
        set_bsdf_input(bsdf, ["Coat Weight", "Clearcoat"], 0.85)
        set_bsdf_input(bsdf, ["Coat Roughness", "Clearcoat Roughness"], 0.025)
        return mat

    if style == "eye_highlight":
        set_bsdf_input(bsdf, "Base Color", (1.0, 1.0, 1.0, 1.0))
        set_bsdf_input(bsdf, "Roughness", 0.05)
        set_bsdf_input(bsdf, ["Emission Color", "Emission"], (1.0, 1.0, 1.0, 1.0))
        set_bsdf_input(bsdf, "Emission Strength", 0.45)
        return mat

    if style == "fuzz":
        # 보송한 털(_fuzz) 전용: 부위 색보다 조금 밝게, 어두운 그림자 없이 보송한 테두리 강조
        fuzz_rgba = (
            min(1.0, lin_rgba[0] * 1.13 + 0.016),
            min(1.0, lin_rgba[1] * 1.12 + 0.015),
            min(1.0, lin_rgba[2] * 1.11 + 0.014),
            1.0,
        )
        set_bsdf_input(bsdf, "Base Color", fuzz_rgba)
        set_bsdf_input(bsdf, "Roughness", 0.88)
        set_bsdf_input(bsdf, ["Specular IOR Level", "Specular"], 0.03)
        set_bsdf_input(bsdf, ["Sheen Weight", "Sheen"], 0.98)
        set_bsdf_input(bsdf, "Sheen Roughness", 0.72)
        set_bsdf_input(bsdf, "Sheen Tint", fuzz_rgba)
        set_bsdf_input(bsdf, ["Subsurface Weight", "Subsurface"], 0.50)
        set_bsdf_input(bsdf, "Subsurface Scale", 0.018)
        return mat

    # 공통 Object 좌표계
    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    tex_coord.location = (-1200, 0)

    # 섬유가 꼬불꼬불하게 휘어지도록 도메인 워핑 노이즈 (Scale=22)
    warp_noise = nt.nodes.new("ShaderNodeTexNoise")
    warp_noise.location = (-980, 120)
    warp_noise.inputs["Scale"].default_value = 22.0
    warp_noise.inputs["Detail"].default_value = 3.0
    warp_noise.inputs["Roughness"].default_value = 0.55
    nt.links.new(tex_coord.outputs["Object"], warp_noise.inputs["Vector"])

    vec_mix = nt.nodes.new("ShaderNodeMix")
    vec_mix.location = (-780, 140)
    vec_mix.data_type = "VECTOR"
    vec_mix.inputs["Factor"].default_value = 0.085
    nt.links.new(tex_coord.outputs["Object"], vec_mix.inputs["A"])
    nt.links.new(warp_noise.outputs["Color"], vec_mix.inputs["B"])

    # 3개의 서로 다른 회전 방향을 가진 비등방성(폭 0.7mm : 길이 7mm -> 스케일 95 : 11) 양모 섬유 레이어
    fiber_rots = [
        (0.35, 0.75, 0.25),
        (-0.72, 0.28, 1.05),
        (0.95, -0.58, -0.42),
    ]
    fiber_scale = (95.0, 95.0, 11.5) if style != "wood" else (45.0, 45.0, 6.0)
    fiber_noises = []

    for idx, rot_euler in enumerate(fiber_rots):
        mapping = nt.nodes.new("ShaderNodeMapping")
        mapping.location = (-560, 320 - idx * 220)
        mapping.inputs["Rotation"].default_value = rot_euler
        mapping.inputs["Scale"].default_value = fiber_scale
        nt.links.new(vec_mix.outputs["Result"], mapping.inputs["Vector"])

        fn = nt.nodes.new("ShaderNodeTexNoise")
        fn.location = (-360, 320 - idx * 220)
        fn.inputs["Scale"].default_value = 1.0
        fn.inputs["Detail"].default_value = 3.5
        fn.inputs["Roughness"].default_value = 0.62
        nt.links.new(mapping.outputs["Vector"], fn.inputs["Vector"])
        fiber_noises.append(fn)

    # 뜨개 숄(knit)인 경우 뜨개 코 물결 노이즈 추가
    macro_noise = nt.nodes.new("ShaderNodeTexNoise")
    macro_noise.location = (-360, -340)
    macro_noise.inputs["Scale"].default_value = 14.0 if style != "knit" else 28.0
    macro_noise.inputs["Detail"].default_value = 3.0
    macro_noise.inputs["Roughness"].default_value = 0.55
    nt.links.new(tex_coord.outputs["Object"], macro_noise.inputs["Vector"])

    # 3겹 양모 섬유 합성
    m_add1 = nt.nodes.new("ShaderNodeMath")
    m_add1.location = (-140, 220)
    m_add1.operation = "ADD"
    nt.links.new(fiber_noises[0].outputs["Fac"], m_add1.inputs[0])
    nt.links.new(fiber_noises[1].outputs["Fac"], m_add1.inputs[1])

    m_add2 = nt.nodes.new("ShaderNodeMath")
    m_add2.location = (20, 160)
    m_add2.operation = "ADD"
    nt.links.new(m_add1.outputs["Value"], m_add2.inputs[0])
    nt.links.new(fiber_noises[2].outputs["Fac"], m_add2.inputs[1])

    m_avg = nt.nodes.new("ShaderNodeMath")
    m_avg.location = (160, 140)
    m_avg.operation = "MULTIPLY_ADD"
    m_avg.inputs[1].default_value = 0.26
    nt.links.new(m_add2.outputs["Value"], m_avg.inputs[0])
    nt.links.new(macro_noise.outputs["Fac"], m_avg.inputs[2])

    # 색은 부위 본래 색 하나에 아주 옅은 얼룩만 (흰 점이나 큰 반점 방지)
    dark_rgba = (lin_rgba[0] * 0.91, lin_rgba[1] * 0.90, lin_rgba[2] * 0.89, 1.0)
    light_rgba = (
        min(1.0, lin_rgba[0] * 1.05 + 0.003),
        min(1.0, lin_rgba[1] * 1.05 + 0.003),
        min(1.0, lin_rgba[2] * 1.04 + 0.002),
        1.0,
    )
    col_mix = nt.nodes.new("ShaderNodeMix")
    col_mix.location = (180, 340)
    col_mix.data_type = "RGBA"
    col_mix.inputs["A"].default_value = dark_rgba
    col_mix.inputs["B"].default_value = light_rgba
    nt.links.new(m_avg.outputs["Value"], col_mix.inputs["Factor"])

    col_final = nt.nodes.new("ShaderNodeMix")
    col_final.location = (310, 280)
    col_final.data_type = "RGBA"
    col_final.inputs["Factor"].default_value = 0.28 if style != "wood" else 0.18
    col_final.inputs["A"].default_value = lin_rgba
    nt.links.new(col_mix.outputs["Result"], col_final.inputs["B"])
    nt.links.new(col_final.outputs["Result"], bsdf.inputs["Base Color"])

    set_bsdf_input(bsdf, "Roughness", 0.94 if style != "wood" else 0.72)

    # 사방으로 엉킨 짧은 양모 털 결이 또렷하게 보이도록 범프 설정
    bump = nt.nodes.new("ShaderNodeBump")
    bump.location = (260, -180)
    bump.inputs["Strength"].default_value = 0.78 if style != "wood" else 0.22
    bump.inputs["Distance"].default_value = 0.0032 if style != "knit" else 0.0048
    nt.links.new(m_avg.outputs["Value"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    set_bsdf_input(bsdf, ["Specular IOR Level", "Specular"], 0.03 if style != "wood" else 0.18)
    set_bsdf_input(bsdf, ["Sheen Weight", "Sheen"], 0.88 if style != "wood" else 0.15)
    set_bsdf_input(bsdf, "Sheen Roughness", 0.74)
    set_bsdf_input(bsdf, "Sheen Tint", light_rgba)
    set_bsdf_input(bsdf, ["Subsurface Weight", "Subsurface"], 0.07)
    set_bsdf_input(bsdf, "Subsurface Scale", 0.010)

    return mat


def build_all_materials():
    mats = {}
    mats["bead_black"] = create_felt_material("bead_black", "#111114", style="bead_black")
    mats["eye_highlight"] = create_felt_material("eye_highlight", "#ffffff", style="eye_highlight")
    mats["thread_cream"] = create_felt_material("thread_cream", "#efe2c8", style="felt")

    # 1. 찐빵 (bun)
    mats["felt_bun_body"] = create_felt_material("felt_bun_body", "#efe1c2", style="felt")
    mats["felt_bun_apron"] = create_felt_material("felt_bun_apron", "#8fab8b", style="felt")
    mats["felt_bun_teapot"] = create_felt_material("felt_bun_teapot", "#6c9070", style="felt")
    mats["felt_bun_blush"] = create_felt_material("felt_bun_blush", "#e49b8c", style="felt")
    mats["felt_bun_detail"] = create_felt_material("felt_bun_detail", "#5c4638", style="felt")

    # 2. 키 큰 콩 (bean)
    mats["felt_bean_body"] = create_felt_material("felt_bean_body", "#7186a6", style="felt")
    mats["felt_bean_belt"] = create_felt_material("felt_bean_belt", "#394766", style="felt")
    mats["felt_bean_pencil"] = create_felt_material("felt_bean_pencil", "#f2c75c", style="felt")
    mats["felt_bean_pencil_tip"] = create_felt_material("felt_bean_pencil_tip", "#d96b59", style="felt")
    mats["felt_bean_mallet_handle"] = create_felt_material("felt_bean_mallet_handle", "#a97c50", style="wood")
    mats["felt_bean_mallet_head"] = create_felt_material("felt_bean_mallet_head", "#56698a", style="felt")
    mats["felt_bean_blush"] = create_felt_material("felt_bean_blush", "#d98e82", style="felt")
    mats["felt_bean_detail"] = create_felt_material("felt_bean_detail", "#352c28", style="felt")

    # 3. 할머니 찹쌀떡 (ricecake)
    mats["felt_ricecake_body"] = create_felt_material("felt_ricecake_body", "#f0e9dd", style="felt")
    mats["felt_ricecake_bun"] = create_felt_material("felt_ricecake_bun", "#8c8077", style="felt")
    mats["felt_ricecake_wood"] = create_felt_material("felt_ricecake_wood", "#b98b5b", style="wood")
    mats["felt_ricecake_shawl"] = create_felt_material("felt_ricecake_shawl", "#d48e9a", style="knit")
    mats["felt_ricecake_blush"] = create_felt_material("felt_ricecake_blush", "#e39a92", style="felt")
    mats["felt_ricecake_detail"] = create_felt_material("felt_ricecake_detail", "#6e5a50", style="felt")

    # 각 펠트 재질에 대응하는 보송한 털(_fuzz) 재질
    fuzz_targets = [
        ("felt_bun_body", "#efe1c2"),
        ("felt_bun_apron", "#8fab8b"),
        ("felt_bun_teapot", "#6c9070"),
        ("felt_bean_body", "#7186a6"),
        ("felt_bean_belt", "#394766"),
        ("felt_bean_mallet_head", "#56698a"),
        ("felt_ricecake_body", "#f0e9dd"),
        ("felt_ricecake_bun", "#8c8077"),
        ("felt_ricecake_shawl", "#d48e9a"),
    ]
    for base_name, hex_c in fuzz_targets:
        fname = f"{base_name}_fuzz"
        mats[fname] = create_felt_material(fname, hex_c, style="fuzz")

    return mats


# ==============================================================================
# 3. 파라메트릭 메시 빌더 (높은 판 고밀도 분할 + 사방으로 엉킨 양모 결 변위)
# ==============================================================================

class MeshBuilder:
    def __init__(self, name):
        self.name = name
        self.materials = []
        self.mat_map = {}
        self.islands = []

    def get_mat_index(self, mat):
        if mat.name not in self.mat_map:
            self.mat_map[mat.name] = len(self.materials)
            self.materials.append(mat)
        return self.mat_map[mat.name]

    def add_grid_surface(
        self,
        grid_pts,
        mat,
        closed_u=False,
        cap_bottom=False,
        cap_top=False,
        allow_fuzz=True,
        displace_scale=1.0,
    ):
        mat_idx = self.get_mat_index(mat)
        nv = len(grid_pts)
        nu = len(grid_pts[0])
        verts = []
        for r in range(nv):
            for c in range(nu):
                verts.append(grid_pts[r][c].copy())

        faces = []
        face_uvs = []
        u_steps = nu if closed_u else (nu - 1)

        v_max_uv = 0.80 if (cap_bottom or cap_top) else 0.98
        for r in range(nv - 1):
            v0 = 0.02 + (v_max_uv - 0.02) * (r / max(1, nv - 1))
            v1 = 0.02 + (v_max_uv - 0.02) * ((r + 1) / max(1, nv - 1))
            for c in range(u_steps):
                c_next = (c + 1) % nu
                idx00 = r * nu + c
                idx10 = r * nu + c_next
                idx11 = (r + 1) * nu + c_next
                idx01 = (r + 1) * nu + c

                u0 = 0.02 + 0.96 * (c / max(1, u_steps))
                u1 = 0.02 + 0.96 * ((c + 1) / max(1, u_steps))

                faces.append((idx00, idx10, idx11, idx01))
                face_uvs.append(((u0, v0), (u1, v0), (u1, v1), (u0, v1)))

        if cap_bottom and closed_u:
            center_b = Vector((0.0, 0.0, 0.0))
            for c in range(nu):
                center_b += grid_pts[0][c]
            center_b /= float(nu)
            b_idx = len(verts)
            verts.append(center_b)
            for c in range(nu):
                c_next = (c + 1) % nu
                ang0 = 2.0 * math.pi * (c / nu)
                ang1 = 2.0 * math.pi * ((c + 1) / nu)
                faces.append((b_idx, c_next, c))
                face_uvs.append((
                    (0.25, 0.90),
                    (0.25 + 0.08 * math.cos(ang1), 0.90 + 0.08 * math.sin(ang1)),
                    (0.25 + 0.08 * math.cos(ang0), 0.90 + 0.08 * math.sin(ang0)),
                ))

        if cap_top and closed_u:
            center_t = Vector((0.0, 0.0, 0.0))
            top_r = nv - 1
            for c in range(nu):
                center_t += grid_pts[top_r][c]
            center_t /= float(nu)
            t_idx = len(verts)
            verts.append(center_t)
            for c in range(nu):
                c_next = (c + 1) % nu
                ang0 = 2.0 * math.pi * (c / nu)
                ang1 = 2.0 * math.pi * ((c + 1) / nu)
                faces.append((top_r * nu + c, top_r * nu + c_next, t_idx))
                face_uvs.append((
                    (0.75 + 0.08 * math.cos(ang0), 0.90 + 0.08 * math.sin(ang0)),
                    (0.75 + 0.08 * math.cos(ang1), 0.90 + 0.08 * math.sin(ang1)),
                    (0.75, 0.90),
                ))

        self.islands.append({
            "verts": verts,
            "faces": faces,
            "uvs": face_uvs,
            "mat_idx": mat_idx,
            "allow_fuzz": allow_fuzz,
            "displace_scale": displace_scale,
        })

    def add_tube_along_curve(
        self,
        centers,
        radii,
        mat,
        nu=12,
        cap_ends=True,
        scale_xy=(1.0, 1.0),
        allow_fuzz=True,
        displace_scale=0.5,
    ):
        nv = len(centers)
        grid = []
        prev_up = Vector((0.0, 0.0, 1.0))
        for i in range(nv):
            if i == 0:
                tang = (centers[1] - centers[0]).normalized()
            elif i == nv - 1:
                tang = (centers[-1] - centers[-2]).normalized()
            else:
                tang = (centers[i + 1] - centers[i - 1]).normalized()
            if tang.length < 1e-6:
                tang = Vector((0.0, 0.0, 1.0))

            side = tang.cross(prev_up)
            if side.length < 1e-4:
                alt = Vector((1.0, 0.0, 0.0)) if abs(tang.x) < 0.8 else Vector((0.0, 1.0, 0.0))
                side = tang.cross(alt)
            side.normalize()
            up = side.cross(tang).normalized()
            prev_up = up

            r = radii[i] if isinstance(radii, (list, tuple)) else radii
            ring = []
            for c in range(nu):
                ang = 2.0 * math.pi * (c / nu)
                offset = (
                    side * (math.cos(ang) * r * scale_xy[0])
                    + up * (math.sin(ang) * r * scale_xy[1])
                )
                ring.append(centers[i] + offset)
            grid.append(ring)

        self.add_grid_surface(
            grid,
            mat,
            closed_u=True,
            cap_bottom=cap_ends,
            cap_top=cap_ends,
            allow_fuzz=allow_fuzz,
            displace_scale=displace_scale,
        )

    def add_ellipsoid(
        self,
        center,
        rx,
        ry,
        rz,
        mat,
        nu=18,
        nv=12,
        rot_euler=(0.0, 0.0, 0.0),
        allow_fuzz=True,
        displace_scale=0.6,
        lump_seed=None,
        lump_amp=0.0,
    ):
        rot_mat = Euler(rot_euler, "XYZ").to_matrix()
        grid = []
        for r in range(nv):
            phi = math.pi * (0.05 + 0.90 * (r / max(1, nv - 1)))
            sin_p = math.sin(phi)
            cos_p = math.cos(phi)
            ring = []
            for c in range(nu):
                theta = 2.0 * math.pi * (c / nu)
                local_p = Vector((
                    rx * sin_p * math.cos(theta),
                    ry * sin_p * math.sin(theta),
                    -rz * cos_p,
                ))
                if lump_seed is not None and lump_amp > 0.0:
                    n = felt_macro_lump(local_p.x * 2.5, local_p.y * 2.5, local_p.z * 2.5, lump_seed)
                    local_p += local_p.normalized() * (n * lump_amp)
                ring.append(center + (rot_mat @ local_p))
            grid.append(ring)

        self.add_grid_surface(
            grid,
            mat,
            closed_u=True,
            cap_bottom=True,
            cap_top=True,
            allow_fuzz=allow_fuzz,
            displace_scale=displace_scale,
        )

    def add_stitch_line(self, pts, mat, stitch_len=0.016, radius=0.0040):
        for i in range(0, len(pts) - 1, 2):
            p0 = pts[i]
            p1 = pts[i + 1]
            mid = 0.5 * (p0 + p1)
            seg = p1 - p0
            if seg.length < 1e-5:
                continue
            dir_v = seg.normalized()
            half = min(seg.length * 0.42, stitch_len * 0.5)
            a = mid - dir_v * half
            b = mid + dir_v * half
            c0 = a
            c1 = a * 0.65 + b * 0.35 + Vector((0, 0, radius * 0.25))
            c2 = a * 0.35 + b * 0.65 + Vector((0, 0, radius * 0.25))
            c3 = b
            self.add_tube_along_curve(
                [c0, c1, c2, c3],
                [radius * 0.55, radius, radius, radius * 0.55],
                mat,
                nu=6,
                cap_ends=True,
                allow_fuzz=False,
                displace_scale=0.10,
            )

    def build_object(
        self,
        obj_name,
        collection,
        location=(0.0, 0.0, 0.0),
        parent=None,
        is_high=False,
        high_seed=1.0,
    ):
        mesh = bpy.data.meshes.new(obj_name)
        obj = bpy.data.objects.new(obj_name, mesh)
        collection.objects.link(obj)

        for mat in self.materials:
            mesh.materials.append(mat)

        bm = bmesh.new()
        uv_layer = bm.loops.layers.uv.new("bake")
        fuzz_layer = bm.faces.layers.int.new("allow_fuzz")
        disp_layer = bm.verts.layers.float.new("disp_scale")

        for isl_idx, isl in enumerate(self.islands):
            bm_verts = []
            for v_co in isl["verts"]:
                bv = bm.verts.new(v_co)
                bv[disp_layer] = isl["displace_scale"]
                bm_verts.append(bv)
            bm.verts.ensure_lookup_table()

            for f_idx, f_verts in enumerate(isl["faces"]):
                try:
                    bf = bm.faces.new([bm_verts[k] for k in f_verts])
                except ValueError:
                    continue
                bf.material_index = isl["mat_idx"]
                bf.smooth = True
                bf[fuzz_layer] = 1 if isl["allow_fuzz"] else 0
                uvs = isl["uvs"][f_idx]
                for loop_i, loop in enumerate(bf.loops):
                    u_local, v_local = uvs[loop_i]
                    loop[uv_layer].uv = (u_local + isl_idx * 2.0, v_local)

        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

        if is_high:
            # 3회차: 짧은 양모 결(폭 0.5~1mm, 길이 4~12mm)이 실제 메시 형상에 새겨지도록
            # 분할 수를 높이고(cuts=3) 결을 지우던 스무딩을 제거
            if len(bm.faces) < 12000:
                bmesh.ops.subdivide_edges(
                    bm,
                    edges=bm.edges[:],
                    cuts=3,
                    use_grid_fill=True,
                    smooth=1.0,
                )
            elif len(bm.faces) < 35000:
                bmesh.ops.subdivide_edges(
                    bm,
                    edges=bm.edges[:],
                    cuts=2,
                    use_grid_fill=True,
                    smooth=1.0,
                )

            bm.verts.ensure_lookup_table()
            bm.normal_update()
            for v in bm.verts:
                d_scale = v[disp_layer]
                if d_scale <= 0.01:
                    continue
                co = v.co
                disp = felt_tangled_web_detail(co.x, co.y, co.z, seed=high_seed)
                v.co = co + v.normal * (disp * d_scale)

            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bm.normal_update()

        bm.to_mesh(mesh)
        bm.free()

        for poly in mesh.polygons:
            poly.use_smooth = True

        obj.location = Vector(location)
        if parent is not None:
            obj.parent = parent

        return obj


# ==============================================================================
# 4. 주민별 공유 UV 맵 `bake` 비겹침 아틀라스 패커
# ==============================================================================

def pack_resident_uv_atlas(low_objects):
    for obj in low_objects:
        mesh = obj.data
        while len(mesh.uv_layers) > 0:
            mesh.uv_layers.remove(mesh.uv_layers[0])
        uv_layer = mesh.uv_layers.new(name="bake")
        mesh.uv_layers.active = uv_layer
        mesh.uv_layers.active_index = 0

    all_slots = []
    for obj in low_objects:
        mesh = obj.data
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bm.faces.ensure_lookup_table()

        visited = set()
        obj_islands = []
        for f in bm.faces:
            if f.index in visited:
                continue
            stack = [f]
            comp = []
            visited.add(f.index)
            while stack:
                cur = stack.pop()
                comp.append(cur.index)
                for e in cur.edges:
                    for nf in e.link_faces:
                        if nf.index not in visited and nf.material_index == cur.material_index:
                            visited.add(nf.index)
                            stack.append(nf)
            area = sum(bm.faces[idx].calc_area() for idx in comp)
            obj_islands.append((comp, max(area, 1e-5)))
        bm.free()

        for comp, area in obj_islands:
            all_slots.append({
                "obj": obj,
                "faces": comp,
                "weight": math.sqrt(area),
            })

    all_slots.sort(key=lambda x: x["weight"], reverse=True)
    n_slots = len(all_slots)
    n_rows = max(4, int(math.ceil(math.sqrt(n_slots * 0.75))))
    rows = [[] for _ in range(n_rows)]
    row_weights = [0.0] * n_rows
    for s in all_slots:
        min_r = min(range(n_rows), key=lambda r: row_weights[r])
        rows[min_r].append(s)
        row_weights[min_r] += s["weight"]

    non_empty_rows = [r for r in rows if len(r) > 0]
    row_heights = [sum(s["weight"] for s in r) / max(1, len(r)) ** 0.45 for r in non_empty_rows]
    sum_rh = sum(row_heights)

    margin = 0.006
    v_cursor = margin
    usable_v = 1.0 - 2.0 * margin

    for r_idx, r_slots in enumerate(non_empty_rows):
        rh = usable_v * (row_heights[r_idx] / sum_rh)
        v0 = v_cursor + margin * 0.5
        v1 = v_cursor + rh - margin * 0.5
        v_cursor += rh

        sum_cw = sum(s["weight"] for s in r_slots)
        u_cursor = margin
        usable_u = 1.0 - 2.0 * margin
        for s in r_slots:
            cw = usable_u * (s["weight"] / sum_cw)
            u0 = u_cursor + margin * 0.5
            u1 = u_cursor + cw - margin * 0.5
            u_cursor += cw
            s["rect"] = (u0, v0, max(u0 + 0.004, u1), max(v0 + 0.004, v1))

    for s in all_slots:
        obj = s["obj"]
        mesh = obj.data
        uv_layer = mesh.uv_layers["bake"].data
        u0, v0, u1, v1 = s["rect"]

        verts_co = []
        for f_idx in s["faces"]:
            poly = mesh.polygons[f_idx]
            for v_idx in poly.vertices:
                verts_co.append(mesh.vertices[v_idx].co)
        center = sum(verts_co, Vector((0.0, 0.0, 0.0))) / max(1, len(verts_co))

        raw_uvs = {}
        min_u, max_u = 1e9, -1e9
        min_v, max_v = 1e9, -1e9

        for f_idx in s["faces"]:
            poly = mesh.polygons[f_idx]
            f_center = poly.center - center
            base_ang = math.atan2(f_center.x, -f_center.y)
            for loop_idx in poly.loop_indices:
                v_co = mesh.vertices[mesh.loops[loop_idx].vertex_index].co - center
                ang = math.atan2(v_co.x, -v_co.y)
                if ang - base_ang > math.pi:
                    ang -= 2.0 * math.pi
                elif ang - base_ang < -math.pi:
                    ang += 2.0 * math.pi
                ru = ang / (2.0 * math.pi) + 0.5
                rv = v_co.z
                raw_uvs[loop_idx] = (ru, rv)
                if ru < min_u:
                    min_u = ru
                if ru > max_u:
                    max_u = ru
                if rv < min_v:
                    min_v = rv
                if rv > max_v:
                    max_v = rv

        span_u = max(1e-5, max_u - min_u)
        span_v = max(1e-5, max_v - min_v)
        for loop_idx, (ru, rv) in raw_uvs.items():
            nu_val = (ru - min_u) / span_u
            nv_val = (rv - min_v) / span_v
            uv_layer[loop_idx].uv = (
                u0 + nu_val * (u1 - u0),
                v0 + nv_val * (v1 - v0),
            )


# ==============================================================================
# 5. 높은 판 전용 보송한 양모 털 (_fuzz) 생성기 (3회차: 굵기 0.5~0.7mm, 길이 3~8mm, 윤곽 집중)
# ==============================================================================

def create_fuzz_for_high_object(
    high_obj,
    collection,
    mats,
    seed=1,
    nap_count=5500,
    halo_count=4800,
    fiber_scale=1.0,
):
    """
    3회차 개선:
    - 굵기 0.5~0.7 mm (bevel_depth = 0.00032 m -> 직경 ~0.64 mm), 길이 3~8 mm.
    - 윤곽 둘레(측면·어깨·정수리)에 가중치를 두어 미리보기에서 시안처럼 보송한 테두리가 또렷이 보이게 함.
    - 색은 부위 색보다 조금 밝게, 그림자 투사 비활성화로 어두운 얼룩 방지.
    """
    fuzz_name = high_obj.name.replace("_high", "_fuzz")
    mesh = high_obj.data

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    fuzz_layer = bm.faces.layers.int.get("allow_fuzz")

    eligible_faces = []
    nap_areas = []
    halo_areas = []
    total_nap_area = 0.0
    total_halo_area = 0.0

    for f in bm.faces:
        if fuzz_layer is not None and f[fuzz_layer] == 0:
            continue
        a = f.calc_area()
        if a > 1e-7:
            eligible_faces.append(f)
            total_nap_area += a
            nap_areas.append(total_nap_area)
            # 정면/3/4 뷰에서 윤곽 둘레를 이루는 옆면·윗면에 2.8배 가중치 부여
            n = f.normal
            rim_weight = 1.0 + 2.2 * (abs(n.x) ** 1.2 + max(0.0, n.z) * 0.85)
            total_halo_area += a * rim_weight
            halo_areas.append(total_halo_area)

    if not eligible_faces or total_nap_area <= 0.0:
        bm.free()
        return None

    curve_data = bpy.data.curves.new(name=fuzz_name, type="CURVE")
    curve_data.dimensions = "3D"
    # 반지름 0.32 mm -> 직경 0.64 mm (0.5~0.7 mm 규격 충족)
    curve_data.bevel_depth = 0.00032 * fiber_scale
    curve_data.bevel_resolution = 0
    curve_data.use_fill_caps = False

    for mat in mesh.materials:
        fuzz_mat_name = f"{mat.name}_fuzz"
        if fuzz_mat_name in mats:
            curve_data.materials.append(mats[fuzz_mat_name])
        else:
            curve_data.materials.append(mat)

    import bisect

    def sample_face(idx_seed, use_halo_weight=False):
        arr = halo_areas if use_halo_weight else nap_areas
        tot = total_halo_area if use_halo_weight else total_nap_area
        r = ((idx_seed * 0.61803398875 + seed * 0.173) % 1.0) * tot
        f_idx = bisect.bisect_left(arr, r)
        f_idx = min(f_idx, len(eligible_faces) - 1)
        f = eligible_faces[f_idx]
        u = (idx_seed * 0.38196601125 + seed * 0.29) % 1.0
        v = (idx_seed * 0.75487766624 + seed * 0.41) % 1.0
        if u + v > 1.0:
            u = 1.0 - u
            v = 1.0 - v
        v0 = f.verts[0].co
        v1 = f.verts[1].co
        v2 = f.verts[2].co
        pt = v0 * (1.0 - u - v) + v1 * u + v2 * v
        return pt, f.normal.copy(), f.material_index

    # 1) 표면을 사방으로 덮는 짧은 양모 털 (길이 4 ~ 8 mm)
    for i in range(nap_count):
        pt, nrm, mat_idx = sample_face(i + 100, use_halo_weight=False)
        if nrm.length < 1e-4:
            continue
        nrm.normalize()
        alt = Vector((0.0, 0.0, 1.0)) if abs(nrm.z) < 0.85 else Vector((1.0, 0.0, 0.0))
        t1 = nrm.cross(alt).normalized()
        t2 = nrm.cross(t1).normalized()

        flow = pnoise3(pt.x * 12.0 + seed, pt.y * 12.0, pt.z * 12.0)
        ang = 6.283185 * ((i * 0.3183099 + flow * 0.65) % 1.0)
        tang = (t1 * math.cos(ang) + t2 * math.sin(ang)).normalized()
        side = nrm.cross(tang).normalized()

        length = (0.0042 + 0.0038 * ((i * 0.47) % 1.0)) * fiber_scale
        arch_h = (0.0010 + 0.0014 * ((i * 0.73) % 1.0)) * fiber_scale
        curl_w = (0.0014 * math.sin(i * 1.9)) * fiber_scale

        p0 = pt - nrm * 0.0002
        p1 = pt + tang * (length * 0.52) + side * curl_w + nrm * arch_h
        p2 = pt + tang * length - side * (curl_w * 0.5) + nrm * (arch_h * 0.45)

        spline = curve_data.splines.new("POLY")
        spline.material_index = mat_idx
        spline.points.add(2)
        spline.points[0].co = (p0.x, p0.y, p0.z, 1.0)
        spline.points[0].radius = 0.95
        spline.points[1].co = (p1.x, p1.y, p1.z, 1.0)
        spline.points[1].radius = 0.85
        spline.points[2].co = (p2.x, p2.y, p2.z, 1.0)
        spline.points[2].radius = 0.50

    # 2) 윤곽 둘레에 집중 배치되는 보송한 테두리 털 (길이 3 ~ 7.5 mm, 직경 0.5~0.65mm 유지)
    for i in range(halo_count):
        pt, nrm, mat_idx = sample_face(i + 30000, use_halo_weight=True)
        if nrm.length < 1e-4:
            continue
        nrm.normalize()
        alt = Vector((0.0, 0.0, 1.0)) if abs(nrm.z) < 0.85 else Vector((1.0, 0.0, 0.0))
        t1 = nrm.cross(alt).normalized()
        t2 = nrm.cross(t1).normalized()

        ang = 6.283185 * ((i * 0.71828 + seed * 0.13) % 1.0)
        tang = (t1 * math.cos(ang) + t2 * math.sin(ang)).normalized()
        side = nrm.cross(tang).normalized()

        # 윤곽 바깥으로 보송하게 일어나는 잔털 (돌출 1.8 ~ 3.6 mm, 전체 길이 3.5 ~ 7.5 mm)
        out_h = (0.0018 + 0.0018 * ((i * 0.53) % 1.0)) * fiber_scale
        tang_l = (0.0030 + 0.0035 * ((i * 0.37) % 1.0)) * fiber_scale

        p0 = pt - nrm * 0.0002
        p1 = pt + nrm * (out_h * 0.65) + tang * (tang_l * 0.50) + side * (0.0009 * math.cos(i))
        p2 = pt + nrm * out_h + tang * tang_l - side * (0.0008 * math.sin(i))

        spline = curve_data.splines.new("POLY")
        spline.material_index = mat_idx
        spline.points.add(2)
        spline.points[0].co = (p0.x, p0.y, p0.z, 1.0)
        spline.points[0].radius = 1.00
        spline.points[1].co = (p1.x, p1.y, p1.z, 1.0)
        spline.points[1].radius = 0.85
        spline.points[2].co = (p2.x, p2.y, p2.z, 1.0)
        spline.points[2].radius = 0.55

    bm.free()

    fuzz_obj = bpy.data.objects.new(fuzz_name, curve_data)
    collection.objects.link(fuzz_obj)
    fuzz_obj.parent = high_obj
    fuzz_obj.location = (0.0, 0.0, 0.0)
    if hasattr(fuzz_obj, "visible_shadow"):
        fuzz_obj.visible_shadow = False
    return fuzz_obj


# ==============================================================================
# 6. 주민 1: 찻집 사장님 — 찐빵 (bun)
# ==============================================================================

def build_bun_resident(mats, collection):
    """
    찐빵 bun (3회차 시안 규격: 높이 0.78 m · 폭 0.82 m, x = -1.5, y = 0, z = 0)
    - 높이와 폭이 거의 같은 통통한 찐빵 실루엣.
    - 얼굴은 높이 50~60% 자리 (눈 z = 0.435 m).
    - 두 팔을 몸 앞으로 내밀어 양손으로 찻주전자를 감싸 쥐는 자세 (시안 사진 그대로).
    """
    base_loc = Vector((-1.5, 0.0, 0.0))

    def bun_surface_point(theta, z_norm, lump_seed=11.0):
        # z_norm: 0.0 (바닥 z=0.028) ~ 1.0 (꼭지 z=0.780)
        z = 0.028 + 0.752 * z_norm
        # 최대 반지름 0.410 m (폭 0.82 m), 어깨가 꺼지지 않는 포근한 만두/찐빵 돔
        if z_norm < 0.33:
            t = z_norm / 0.33
            r_base = 0.225 + 0.185 * math.sqrt(max(0.0, 1.0 - (1.0 - t) ** 2))
        elif z_norm < 0.89:
            t = (z_norm - 0.33) / 0.56
            # 시안처럼 위쪽 볼과 어깨가 통통하게 올라오다가 꼭지로 모이는 곡선
            r_base = 0.410 * (math.cos(t * math.pi * 0.45) ** 0.78)
        else:
            t = (z_norm - 0.89) / 0.11
            r_base = 0.078 * (1.0 - 0.52 * math.sin(t * math.pi * 0.75)) + 0.016 * (1.0 - t)

        rx = r_base * 1.00
        ry = r_base * 0.94

        pleat_env = 0.0
        if z_norm > 0.54:
            pt = min(1.0, (z_norm - 0.54) / 0.40)
            pleat_env = math.sin(pt * math.pi * 0.88) ** 1.30
        twist = 0.44 * max(0.0, (z_norm - 0.54) / 0.46) ** 1.4
        pleat_wave = math.cos(9.0 * (theta + twist) + 0.24 * math.sin(3.0 * theta))
        pleat_disp = pleat_env * (0.016 * pleat_wave - 0.004 * abs(pleat_wave))

        x0 = (rx + pleat_disp) * math.sin(theta)
        y0 = -(ry + pleat_disp) * math.cos(theta)

        lump = felt_macro_lump(x0, y0, z, seed=lump_seed) * 0.012 * (1.0 - 0.5 * (z_norm ** 2))
        x = x0 + math.sin(theta) * lump
        y = y0 - math.cos(theta) * lump

        for ex in (-0.108, 0.108):
            dx = x - ex
            dz = z - 0.438
            d2 = dx * dx + dz * dz
            if y < -0.15 and d2 < 0.0045:
                indent = 0.015 * math.exp(-d2 / 0.0014)
                y += indent

        return Vector((x, y, z))

    mb_body = MeshBuilder("bun_body")
    nu, nv = 54, 34
    body_grid = []
    for r in range(nv):
        zn = r / (nv - 1)
        ring = []
        for c in range(nu):
            th = 2.0 * math.pi * (c / nu)
            ring.append(bun_surface_point(th, zn))
        body_grid.append(ring)
    mb_body.add_grid_surface(
        body_grid,
        mats["felt_bun_body"],
        closed_u=True,
        cap_bottom=True,
        cap_top=True,
        allow_fuzz=True,
        displace_scale=1.0,
    )

    # 볼터치 둘 & 입 & 눈썹 (높이 50~60% 자리)
    for sx in (-1.0, 1.0):
        p_bl = bun_surface_point(sx * math.radians(26.0), 0.470)
        mb_body.add_ellipsoid(
            p_bl + Vector((0.0, -0.003, 0.0)),
            0.029, 0.011, 0.019,
            mats["felt_bun_blush"],
            nu=12, nv=8,
            rot_euler=(0.14, sx * 0.18, sx * 0.40),
            allow_fuzz=False,
            displace_scale=0.30,
        )

    mouth_pts = []
    for i in range(7):
        ut = (i / 6.0) - 0.5
        th_m = ut * math.radians(8.5)
        zn_m = 0.472 - 0.010 * math.cos(ut * math.pi)
        mouth_pts.append(bun_surface_point(th_m, zn_m) + Vector((0.0, -0.004, 0.0)))
    mb_body.add_tube_along_curve(mouth_pts, 0.0038, mats["felt_bun_detail"], nu=6, allow_fuzz=False, displace_scale=0.10)

    for sx in (-1.0, 1.0):
        brow_pts = []
        for i in range(4):
            ut = i / 3.0
            th_b = sx * math.radians(15.5 + 3.5 * ut)
            zn_b = 0.625 + 0.004 * math.sin(math.pi * ut)
            brow_pts.append(bun_surface_point(th_b, zn_b) + Vector((0.0, -0.004, 0.0)))
        mb_body.add_tube_along_curve(brow_pts, 0.0040, mats["felt_bun_detail"], nu=6, allow_fuzz=False, displace_scale=0.10)

    # 세이지 연두 앞치마 (#8fab8b)
    ap_nu, ap_nv = 26, 14
    ap_front = []
    for r in range(ap_nv):
        zn = 0.10 + 0.30 * (r / (ap_nv - 1))
        row = []
        for c in range(ap_nu):
            th = math.radians(-68.0 + 136.0 * (c / (ap_nu - 1)))
            p_surf = bun_surface_point(th, zn)
            n_out = Vector((math.sin(th), -math.cos(th), 0.0)).normalized()
            edge_u = math.sin(math.pi * (c / (ap_nu - 1))) ** 0.35
            edge_v = math.sin(math.pi * (r / (ap_nv - 1))) ** 0.35
            thick = 0.003 + 0.012 * (edge_u * edge_v)
            row.append(p_surf + n_out * thick)
        ap_front.append(row)
    mb_body.add_grid_surface(ap_front, mats["felt_bun_apron"], closed_u=False, allow_fuzz=True, displace_scale=0.85)

    # 앞치마 앞 주머니 패치
    pk_nu, pk_nv = 12, 8
    pk_grid = []
    for r in range(pk_nv):
        zn = 0.15 + 0.14 * (r / (pk_nv - 1))
        row = []
        for c in range(pk_nu):
            th = math.radians(-26.0 + 52.0 * (c / (pk_nu - 1)))
            p_surf = bun_surface_point(th, zn)
            n_out = Vector((math.sin(th), -math.cos(th), 0.0)).normalized()
            edge = (math.sin(math.pi * c / (pk_nu - 1)) * math.sin(math.pi * r / (pk_nv - 1))) ** 0.4
            row.append(p_surf + n_out * (0.014 + 0.006 * edge))
        pk_grid.append(row)
    mb_body.add_grid_surface(pk_grid, mats["felt_bun_apron"], closed_u=False, allow_fuzz=True, displace_scale=0.7)

    # 앞치마 허리끈
    strap_pts = []
    for c in range(40):
        th = 2.0 * math.pi * (c / 40.0)
        p_surf = bun_surface_point(th, 0.400)
        n_out = Vector((math.sin(th), -math.cos(th), 0.0)).normalized()
        strap_pts.append(p_surf + n_out * 0.011)
    strap_pts.append(strap_pts[0])
    mb_body.add_tube_along_curve(
        strap_pts, 0.013, mats["felt_bun_apron"], nu=8, cap_ends=False, scale_xy=(0.65, 1.35), allow_fuzz=True, displace_scale=0.6
    )

    # 옆 매듭 (-X 쪽)
    knot_center = bun_surface_point(math.radians(-78.0), 0.400) + Vector((-0.018, -0.004, 0.0))
    mb_body.add_ellipsoid(knot_center, 0.022, 0.024, 0.022, mats["felt_bun_apron"], nu=10, nv=8, allow_fuzz=True)
    for loop_dir in (-1.0, 1.0):
        l_pts = []
        for k in range(10):
            t = k / 9.0
            ang = t * math.pi
            lp = knot_center + Vector((
                -0.024 * math.sin(ang),
                loop_dir * (0.042 * math.sin(ang)),
                0.028 * math.sin(ang * 0.9) * loop_dir * 0.4 + 0.015 * math.sin(ang),
            ))
            l_pts.append(lp)
        mb_body.add_tube_along_curve(l_pts, 0.010, mats["felt_bun_apron"], nu=7, allow_fuzz=True, displace_scale=0.5)

    for y_off in (-0.022, 0.024):
        t_pts = []
        for k in range(8):
            t = k / 7.0
            tp = knot_center + Vector((
                -0.015 - 0.018 * math.sin(t * 2.2),
                y_off * (0.5 + 1.1 * t),
                -0.155 * t,
            ))
            t_pts.append(tp)
        mb_body.add_tube_along_curve(
            t_pts,
            [0.011, 0.012, 0.012, 0.013, 0.013, 0.012, 0.010, 0.006],
            mats["felt_bun_apron"],
            nu=7,
            scale_xy=(0.55, 1.35),
            allow_fuzz=True,
            displace_scale=0.5,
        )

    # 밑단을 도는 크림색 홈질 바늘땀 + 앞치마 밑단 바늘땀
    hem_pts = []
    for c in range(68):
        th = 2.0 * math.pi * (c / 68.0)
        p_surf = bun_surface_point(th, 0.042)
        n_out = Vector((math.sin(th), -math.cos(th), 0.0)).normalized()
        hem_pts.append(p_surf + n_out * 0.0035)
    mb_body.add_stitch_line(hem_pts, mats["thread_cream"], stitch_len=0.017, radius=0.0040)

    ap_hem_pts = []
    for c in range(30):
        th = math.radians(-64.0 + 128.0 * (c / 29.0))
        p_surf = bun_surface_point(th, 0.120)
        n_out = Vector((math.sin(th), -math.cos(th), 0.0)).normalized()
        ap_hem_pts.append(p_surf + n_out * 0.0155)
    mb_body.add_stitch_line(ap_hem_pts, mats["thread_cream"], stitch_len=0.015, radius=0.0038)

    # 눈 둘 (높이 ~56% 자리: z = 0.438 m)
    p_eye_xp = bun_surface_point(math.radians(17.5), 0.545)
    p_eye_xn = bun_surface_point(math.radians(-17.5), 0.545)
    eye_locs = {
        "eye_xpos": Vector((0.108, p_eye_xp.y - 0.004, 0.438)),
        "eye_xneg": Vector((-0.108, p_eye_xn.y - 0.004, 0.438)),
    }
    eye_builders = {}
    for ename in ("eye_xpos", "eye_xneg"):
        eb = MeshBuilder(f"bun_{ename}")
        eb.add_ellipsoid(
            Vector((0.0, 0.0, 0.0)),
            0.032, 0.025, 0.033,
            mats["bead_black"],
            nu=16, nv=12,
            allow_fuzz=False,
            displace_scale=0.0,
        )
        eb.add_ellipsoid(
            Vector((-0.009, -0.023, 0.010)),
            0.0065, 0.0035, 0.0065,
            mats["eye_highlight"],
            nu=8, nv=6,
            allow_fuzz=False,
            displace_scale=0.0,
        )
        eye_builders[ename] = eb

    # 팔 둘 (3회차: 시안처럼 두 팔을 모두 몸 앞으로 포근히 내밀어 찻주전자를 함께 감싸 쥐는 자세)
    arm_locs = {
        "arm_xpos": Vector((0.285, -0.235, 0.345)),
        "arm_xneg": Vector((-0.285, -0.235, 0.345)),
    }
    arm_builders = {}
    # 오른쪽 팔(+X): 앞가슴 쪽으로 뻗어 찻주전자 옆/손잡이를 쥠
    pts_xpos = [
        Vector((0.0, 0.0, 0.0)),
        Vector((-0.025, -0.065, -0.012)),
        Vector((-0.075, -0.125, -0.022)),
        Vector((-0.135, -0.165, -0.024)),
    ]
    mb_arm_xp = MeshBuilder("bun_arm_xpos")
    mb_arm_xp.add_tube_along_curve(
        pts_xpos,
        [0.044, 0.048, 0.047, 0.040],
        mats["felt_bun_body"],
        nu=14,
        allow_fuzz=True,
        displace_scale=0.75,
    )
    arm_builders["arm_xpos"] = mb_arm_xp

    # 왼쪽 팔(-X): 앞가슴 쪽으로 뻗어 찻주전자 반대편 손잡이를 받쳐 듦 (concept_bun_cafe_owner.jpg)
    pts_xneg = [
        Vector((0.0, 0.0, 0.0)),
        Vector((0.025, -0.065, -0.012)),
        Vector((0.080, -0.125, -0.022)),
        Vector((0.145, -0.165, -0.024)),
    ]
    mb_arm_xn = MeshBuilder("bun_arm_xneg")
    mb_arm_xn.add_tube_along_curve(
        pts_xneg,
        [0.044, 0.048, 0.047, 0.040],
        mats["felt_bun_body"],
        nu=14,
        allow_fuzz=True,
        displace_scale=0.75,
    )
    arm_builders["arm_xneg"] = mb_arm_xn

    # 발 둘
    foot_locs = {
        "foot_xpos": Vector((0.140, -0.110, 0.036)),
        "foot_xneg": Vector((-0.140, -0.110, 0.036)),
    }
    foot_builders = {}
    for fname in ("foot_xpos", "foot_xneg"):
        fb = MeshBuilder(f"bun_{fname}")
        fb.add_ellipsoid(
            Vector((0.0, 0.0, 0.0)),
            0.058, 0.075, 0.036,
            mats["felt_bun_body"],
            nu=14, nv=10,
            allow_fuzz=True,
            displace_scale=0.6,
            lump_seed=21.0,
            lump_amp=0.004,
        )
        foot_builders[fname] = fb

    # 소품: bun_teapot (부모 bun_arm_xpos, 원점 = 오른손에 쥐는 자리, 몸통 앞가슴 중앙에 위치)
    teapot_loc_rel = Vector((-0.140, -0.170, -0.022))
    mb_pot = MeshBuilder("bun_teapot")
    # 오른손(0,0,0)에서 왼쪽(-X)으로 주전자 몸통이 놓여 가슴 정중앙(world x ≈ -1.48)에 오도록 배치
    pot_center = Vector((-0.115, -0.030, 0.002))
    mb_pot.add_ellipsoid(
        pot_center,
        0.092, 0.088, 0.074,
        mats["felt_bun_teapot"],
        nu=18, nv=12,
        allow_fuzz=True,
        displace_scale=0.75,
        lump_seed=33.0,
        lump_amp=0.005,
    )
    mb_pot.add_ellipsoid(
        pot_center + Vector((0.0, 0.0, 0.066)),
        0.054, 0.054, 0.017,
        mats["felt_bun_teapot"],
        nu=14, nv=8,
        allow_fuzz=True,
        displace_scale=0.5,
    )
    mb_pot.add_ellipsoid(
        pot_center + Vector((0.0, 0.0, 0.088)),
        0.014, 0.014, 0.015,
        mats["felt_bun_detail"],
        nu=10, nv=6,
        allow_fuzz=False,
        displace_scale=0.2,
    )
    # 왼쪽(-X, 왼손 쪽)에 달린 C자 손잡이 + 오른쪽(+X, 오른손 원점 (0,0,0) 쪽) 주둥이 (concept_bun_cafe_owner.jpg 방향 그대로!)
    handle_pts = [
        pot_center + Vector((-0.068, 0.0, 0.042)),
        pot_center + Vector((-0.122, -0.006, 0.032)),
        pot_center + Vector((-0.128, 0.0, -0.002)),
        pot_center + Vector((-0.118, 0.005, -0.034)),
        pot_center + Vector((-0.068, 0.0, -0.038)),
    ]
    mb_pot.add_tube_along_curve(
        handle_pts,
        [0.014, 0.015, 0.016, 0.015, 0.014],
        mats["felt_bun_teapot"],
        nu=8,
        allow_fuzz=True,
        displace_scale=0.45,
    )
    spout_pts = [
        pot_center + Vector((0.072, -0.012, -0.010)),
        Vector((-0.010, -0.025, 0.005)),
        Vector((0.018, -0.028, 0.038)),
        Vector((0.035, -0.030, 0.055)),
    ]
    mb_pot.add_tube_along_curve(
        spout_pts,
        [0.025, 0.020, 0.015, 0.012],
        mats["felt_bun_teapot"],
        nu=10,
        allow_fuzz=True,
        displace_scale=0.45,
    )

    low_objs = []
    high_objs = []
    for is_high in (False, True):
        sfx = "_high" if is_high else ""
        body_obj = mb_body.build_object(
            f"bun_body{sfx}", collection, location=base_loc, parent=None, is_high=is_high, high_seed=101.0
        )
        e_xp = eye_builders["eye_xpos"].build_object(
            f"bun_eye_xpos{sfx}", collection, location=eye_locs["eye_xpos"], parent=body_obj, is_high=is_high, high_seed=102.0
        )
        e_xn = eye_builders["eye_xneg"].build_object(
            f"bun_eye_xneg{sfx}", collection, location=eye_locs["eye_xneg"], parent=body_obj, is_high=is_high, high_seed=103.0
        )
        a_xp = arm_builders["arm_xpos"].build_object(
            f"bun_arm_xpos{sfx}", collection, location=arm_locs["arm_xpos"], parent=body_obj, is_high=is_high, high_seed=104.0
        )
        a_xn = arm_builders["arm_xneg"].build_object(
            f"bun_arm_xneg{sfx}", collection, location=arm_locs["arm_xneg"], parent=body_obj, is_high=is_high, high_seed=105.0
        )
        f_xp = foot_builders["foot_xpos"].build_object(
            f"bun_foot_xpos{sfx}", collection, location=foot_locs["foot_xpos"], parent=body_obj, is_high=is_high, high_seed=106.0
        )
        f_xn = foot_builders["foot_xneg"].build_object(
            f"bun_foot_xneg{sfx}", collection, location=foot_locs["foot_xneg"], parent=body_obj, is_high=is_high, high_seed=107.0
        )
        pot = mb_pot.build_object(
            f"bun_teapot{sfx}", collection, location=teapot_loc_rel, parent=a_xp, is_high=is_high, high_seed=108.0
        )

        group = [body_obj, e_xp, e_xn, a_xp, a_xn, f_xp, f_xn, pot]
        if is_high:
            high_objs.extend(group)
        else:
            low_objs.extend(group)

    pack_resident_uv_atlas(low_objs)
    pack_resident_uv_atlas(high_objs)

    fuzz_objs = []
    fuzz_counts = {
        "bun_body_high": (6200, 5200),
        "bun_arm_xpos_high": (520, 420),
        "bun_arm_xneg_high": (520, 420),
        "bun_foot_xpos_high": (350, 280),
        "bun_foot_xneg_high": (350, 280),
        "bun_teapot_high": (750, 580),
    }
    for h_obj in high_objs:
        if h_obj.name in fuzz_counts:
            nc, hc = fuzz_counts[h_obj.name]
            fz = create_fuzz_for_high_object(
                h_obj, collection, mats, seed=len(fuzz_objs) + 10, nap_count=nc, halo_count=hc
            )
            if fz is not None:
                fuzz_objs.append(fz)

    return {"low": low_objs, "high": high_objs, "fuzz": fuzz_objs}


# ==============================================================================
# 7. 주민 2: 공방 주인 — 키 큰 콩 (bean)
# ==============================================================================

def build_bean_resident(mats, collection):
    """
    키 큰 콩 bean (높이 1.32 m, 폭 약 0.58 m, x = 0.0, y = 0, z = 0)
    3회차 개선:
    - 곧은 캡슐이 아니라 등은 둥글게 휘고 배/가슴 쪽은 오목하게 들어간 강낭콩(C자) 곡선으로 몸 자체가 앞으로 굽음.
    - 발 둘이 몸 밑에 또렷이 보이도록 몸 밑단을 살짝 올리고 발을 앞쪽에 배치.
    """
    base_loc = Vector((0.0, 0.0, 0.0))

    def bean_spine_and_radii(z_norm):
        # 발 둘이 몸 밑에 잘 보이도록 밑단을 z=0.052에서 시작해 1.320까지 올라감
        z = 0.052 + 1.268 * z_norm
        # 강낭콩 C자 중심선: 아랫배~허리는 뒤(+Y)로 불룩했다가 가슴~머리가 앞(-Y)으로 크게 굽어 숙여짐
        arch_back = 0.075 * math.sin(z_norm * math.pi * 0.92)
        bend_forward = -0.245 * (z_norm ** 1.75)
        lean_y = arch_back + bend_forward
        lean_x = -0.014 * math.sin(z_norm * math.pi)

        if z_norm < 0.16:
            t = z_norm / 0.16
            r = 0.140 + 0.150 * math.sqrt(max(0.0, 1.0 - (1.0 - t) ** 2))
        elif z_norm < 0.72:
            t = (z_norm - 0.16) / 0.56
            base_taper = 0.290 * (1.0 - 0.055 * t)
            waist_indent = -0.018 * (math.sin(t * math.pi) ** 1.5)
            r = base_taper + waist_indent
        else:
            t = (z_norm - 0.72) / 0.28
            r_top_start = 0.290 * (1.0 - 0.055)
            r = r_top_start * math.sqrt(max(0.0004, 1.0 - (t ** 1.95)))

        return Vector((lean_x, lean_y, z)), r * 1.00, r * 0.95

    def bean_surface_point(theta, z_norm, lump_seed=42.0):
        center, rx, ry = bean_spine_and_radii(z_norm)
        # 강낭콩 단면 비대칭: 앞배(-Y, cos(theta)>0)는 가슴·허리가 오목하게 들어가고,
        # 등(+Y, cos(theta)<0)은 둥글고 볼록하게 부풀어 오름 (시안 옆모습 그대로)
        cos_t = math.cos(theta)
        front_factor = max(0.0, cos_t)
        back_factor = max(0.0, -cos_t)

        front_concave = -0.042 * (front_factor ** 1.2) * math.exp(-((z_norm - 0.54) / 0.24) ** 2)
        back_convex = 0.036 * (back_factor ** 1.1) * math.sin(z_norm * math.pi * 0.90)

        # 옆모습에서도 허리가 들어간 강낭콩 실루엣이 읽히도록 측면 반경에도 미세한 굴곡 반영
        x0 = center.x + rx * math.sin(theta)
        y0 = center.y - (ry + front_concave + back_convex) * cos_t
        z = center.z

        lump = felt_macro_lump(x0, y0, z, seed=lump_seed) * 0.012 * (1.0 - 0.45 * (z_norm ** 2))
        x = x0 + math.sin(theta) * lump
        y = y0 - cos_t * lump

        # 눈자위 오목 홈
        for ex in (-0.102, 0.102):
            dx = x - ex
            dz = z - 0.960
            d2 = dx * dx + dz * dz
            if y < center.y - 0.10 and d2 < 0.0058:
                y += 0.016 * math.exp(-d2 / 0.0018)

        return Vector((x, y, z))

    mb_body = MeshBuilder("bean_body")
    nu, nv = 48, 40
    body_grid = []
    for r in range(nv):
        zn = r / (nv - 1)
        ring = []
        for c in range(nu):
            th = 2.0 * math.pi * (c / nu)
            ring.append(bean_surface_point(th, zn))
        body_grid.append(ring)
    mb_body.add_grid_surface(
        body_grid,
        mats["felt_bean_body"],
        closed_u=True,
        cap_bottom=True,
        cap_top=True,
        allow_fuzz=True,
        displace_scale=1.0,
    )

    # 볼터치 & 수놓은 작은 입
    for sx in (-1.0, 1.0):
        p_blush = bean_surface_point(sx * math.radians(34.0), 0.680)
        mb_body.add_ellipsoid(
            p_blush + Vector((0.0, -0.003, 0.0)),
            0.032, 0.011, 0.020,
            mats["felt_bean_blush"],
            nu=12, nv=8,
            rot_euler=(0.18, sx * 0.16, sx * 0.35),
            allow_fuzz=False,
            displace_scale=0.25,
        )

    mouth_pts = []
    for i in range(7):
        u_m = (i / 6.0) - 0.5
        th_m = u_m * math.radians(14.0)
        zn_m = 0.672 - 0.007 * math.cos(u_m * math.pi)
        pm = bean_surface_point(th_m, zn_m) + Vector((0.0, -0.004, 0.0))
        mouth_pts.append(pm)
    mb_body.add_tube_along_curve(mouth_pts, 0.0042, mats["felt_bean_detail"], nu=6, allow_fuzz=False, displace_scale=0.10)

    # 남색 작업 띠 (#394766): 허리 둘레
    belt_nu, belt_nv = 44, 6
    belt_grid = []
    for r in range(belt_nv):
        zn = 0.375 + 0.052 * (r / (belt_nv - 1))
        edge_v = math.sin(math.pi * (r / (belt_nv - 1))) ** 0.45
        ring = []
        for c in range(belt_nu):
            th = 2.0 * math.pi * (c / belt_nu)
            p_surf = bean_surface_point(th, zn)
            n_out = Vector((math.sin(th), -math.cos(th), 0.0)).normalized()
            ring.append(p_surf + n_out * (0.004 + 0.015 * edge_v))
        belt_grid.append(ring)
    mb_body.add_grid_surface(belt_grid, mats["felt_bean_belt"], closed_u=True, allow_fuzz=True, displace_scale=0.80)

    # 띠 앞 작은 주머니 & 노란 연필 (#f2c75c)
    pouch_nu, pouch_nv = 12, 10
    pouch_grid = []
    for r in range(pouch_nv):
        zn = 0.298 + 0.102 * (r / (pouch_nv - 1))
        row = []
        for c in range(pouch_nu):
            th = math.radians(-32.0 + 30.0 * (c / (pouch_nu - 1)))
            p_surf = bean_surface_point(th, zn)
            n_out = Vector((math.sin(th), -math.cos(th), 0.0)).normalized()
            edge = (math.sin(math.pi * c / (pouch_nu - 1)) * math.sin(math.pi * r / (pouch_nv - 1))) ** 0.35
            row.append(p_surf + n_out * (0.012 + 0.017 * edge))
        pouch_grid.append(row)
    mb_body.add_grid_surface(pouch_grid, mats["felt_bean_belt"], closed_u=False, allow_fuzz=True, displace_scale=0.70)

    pouch_base = bean_surface_point(math.radians(-17.0), 0.355)
    pouch_nrm = Vector((math.sin(math.radians(-17.0)), -math.cos(math.radians(-17.0)), 0.0)).normalized()
    holder_pos = pouch_base + pouch_nrm * 0.030
    mb_body.add_ellipsoid(
        holder_pos,
        0.020, 0.015, 0.032,
        mats["felt_bean_mallet_handle"],
        nu=12, nv=8,
        rot_euler=(0.0, 0.0, math.radians(-17.0)),
        allow_fuzz=True,
        displace_scale=0.40,
    )

    pen_base = holder_pos + Vector((0.0, 0.0, -0.008))
    pen_top = holder_pos + Vector((-0.004, -0.012, 0.098))
    pen_tip = holder_pos + Vector((-0.005, -0.015, 0.130))
    mb_body.add_tube_along_curve(
        [pen_base, pen_base * 0.5 + pen_top * 0.5, pen_top],
        [0.011, 0.0115, 0.0115],
        mats["felt_bean_pencil"],
        nu=8,
        allow_fuzz=False,
        displace_scale=0.15,
    )
    mb_body.add_tube_along_curve(
        [pen_top, pen_top * 0.4 + pen_tip * 0.6, pen_tip],
        [0.0115, 0.0065, 0.002],
        mats["felt_bean_pencil_tip"],
        nu=8,
        allow_fuzz=False,
        displace_scale=0.10,
    )

    # 밑단을 도는 크림색 바늘땀 + 양 옆구리 세로 솔기 바늘땀
    hem_pts = []
    for c in range(56):
        th = 2.0 * math.pi * (c / 56.0)
        p_surf = bean_surface_point(th, 0.038)
        n_out = Vector((math.sin(th), -math.cos(th), 0.0)).normalized()
        hem_pts.append(p_surf + n_out * 0.0035)
    mb_body.add_stitch_line(hem_pts, mats["thread_cream"], stitch_len=0.017, radius=0.0040)

    for side_th in (math.radians(-88.0), math.radians(88.0)):
        side_pts = []
        n_out = Vector((math.sin(side_th), -math.cos(side_th), 0.0)).normalized()
        for k in range(36):
            zn = 0.06 + 0.74 * (k / 35.0)
            if 0.368 <= zn <= 0.438:
                continue
            side_pts.append(bean_surface_point(side_th, zn) + n_out * 0.0035)
        mb_body.add_stitch_line(side_pts, mats["thread_cream"], stitch_len=0.016, radius=0.0038)

    # 눈 둘
    p_eye_xp = bean_surface_point(math.radians(22.5), 0.716) + Vector((0.0, -0.005, 0.0))
    p_eye_xn = bean_surface_point(math.radians(-22.5), 0.716) + Vector((0.0, -0.005, 0.0))
    eye_locs = {
        "eye_xpos": Vector((0.102, p_eye_xp.y, p_eye_xp.z)),
        "eye_xneg": Vector((-0.102, p_eye_xn.y, p_eye_xn.z)),
    }
    eye_builders = {}
    for ename in ("eye_xpos", "eye_xneg"):
        eb = MeshBuilder(f"bean_{ename}")
        eb.add_ellipsoid(
            Vector((0.0, 0.0, 0.0)),
            0.038, 0.029, 0.039,
            mats["bead_black"],
            nu=18, nv=14,
            allow_fuzz=False,
            displace_scale=0.0,
        )
        eb.add_ellipsoid(
            Vector((-0.011, -0.026, 0.012)),
            0.0075, 0.0040, 0.0075,
            mats["eye_highlight"],
            nu=8, nv=6,
            allow_fuzz=False,
            displace_scale=0.0,
        )
        eye_builders[ename] = eb

    # 팔 둘 (몸 옆에 편히 내린 쉬는 자세)
    p_sh_xp = bean_surface_point(math.radians(82.0), 0.530)
    p_sh_xn = bean_surface_point(math.radians(-82.0), 0.530)
    arm_locs = {
        "arm_xpos": Vector((0.258, p_sh_xp.y, p_sh_xp.z)),
        "arm_xneg": Vector((-0.258, p_sh_xn.y, p_sh_xn.z)),
    }
    arm_builders = {}
    for sx, aname in ((1.0, "arm_xpos"), (-1.0, "arm_xneg")):
        ab = MeshBuilder(f"bean_{aname}")
        pts_rest = [
            Vector((0.0, 0.0, 0.0)),
            Vector((sx * 0.034, -0.018, -0.068)),
            Vector((sx * 0.040, -0.035, -0.142)),
            Vector((sx * 0.028, -0.048, -0.205)),
        ]
        ab.add_tube_along_curve(
            pts_rest,
            [0.048, 0.052, 0.051, 0.044],
            mats["felt_bean_body"],
            nu=14,
            allow_fuzz=True,
            displace_scale=0.75,
        )
        arm_builders[aname] = ab

    # 발 둘 (3회차: 몸 밑에 두 발이 또렷이 보이도록 앞쪽·바깥쪽으로 살짝 내밀고 통통하게 조형)
    foot_locs = {
        "foot_xpos": Vector((0.125, -0.125, 0.042)),
        "foot_xneg": Vector((-0.125, -0.125, 0.042)),
    }
    foot_builders = {}
    for fname in ("foot_xpos", "foot_xneg"):
        fb = MeshBuilder(f"bean_{fname}")
        fb.add_ellipsoid(
            Vector((0.0, 0.0, 0.0)),
            0.066, 0.088, 0.042,
            mats["felt_bean_body"],
            nu=14, nv=10,
            allow_fuzz=True,
            displace_scale=0.65,
            lump_seed=51.0,
            lump_amp=0.004,
        )
        foot_builders[fname] = fb

    # 소품: bean_mallet (부모 bean_arm_xpos, 원점 = 손에 쥐는 자리, 아래를 향함)
    mallet_loc_rel = Vector((0.028, -0.048, -0.195))
    mb_mallet = MeshBuilder("bean_mallet")
    h_pts = [
        Vector((-0.004, 0.032, 0.042)),
        Vector((0.0, 0.0, 0.0)),
        Vector((0.008, -0.058, -0.075)),
        Vector((0.015, -0.115, -0.150)),
    ]
    mb_mallet.add_tube_along_curve(
        h_pts,
        [0.015, 0.017, 0.017, 0.015],
        mats["felt_bean_mallet_handle"],
        nu=10,
        allow_fuzz=False,
        displace_scale=0.20,
    )
    head_c = Vector((0.014, -0.108, -0.142))
    m_pts = [
        head_c + Vector((-0.055, -0.035, 0.025)),
        head_c + Vector((-0.018, -0.012, 0.008)),
        head_c + Vector((0.018, 0.012, -0.008)),
        head_c + Vector((0.055, 0.035, -0.025)),
    ]
    mb_mallet.add_tube_along_curve(
        m_pts,
        [0.038, 0.043, 0.043, 0.038],
        mats["felt_bean_mallet_head"],
        nu=14,
        scale_xy=(0.92, 1.08),
        allow_fuzz=True,
        displace_scale=0.65,
    )

    low_objs = []
    high_objs = []
    for is_high in (False, True):
        sfx = "_high" if is_high else ""
        body_obj = mb_body.build_object(
            f"bean_body{sfx}", collection, location=base_loc, parent=None, is_high=is_high, high_seed=201.0
        )
        e_xp = eye_builders["eye_xpos"].build_object(
            f"bean_eye_xpos{sfx}", collection, location=eye_locs["eye_xpos"], parent=body_obj, is_high=is_high, high_seed=202.0
        )
        e_xn = eye_builders["eye_xneg"].build_object(
            f"bean_eye_xneg{sfx}", collection, location=eye_locs["eye_xneg"], parent=body_obj, is_high=is_high, high_seed=203.0
        )
        a_xp = arm_builders["arm_xpos"].build_object(
            f"bean_arm_xpos{sfx}", collection, location=arm_locs["arm_xpos"], parent=body_obj, is_high=is_high, high_seed=204.0
        )
        a_xn = arm_builders["arm_xneg"].build_object(
            f"bean_arm_xneg{sfx}", collection, location=arm_locs["arm_xneg"], parent=body_obj, is_high=is_high, high_seed=205.0
        )
        f_xp = foot_builders["foot_xpos"].build_object(
            f"bean_foot_xpos{sfx}", collection, location=foot_locs["foot_xpos"], parent=body_obj, is_high=is_high, high_seed=206.0
        )
        f_xn = foot_builders["foot_xneg"].build_object(
            f"bean_foot_xneg{sfx}", collection, location=foot_locs["foot_xneg"], parent=body_obj, is_high=is_high, high_seed=207.0
        )
        mallet = mb_mallet.build_object(
            f"bean_mallet{sfx}", collection, location=mallet_loc_rel, parent=a_xp, is_high=is_high, high_seed=208.0
        )

        group = [body_obj, e_xp, e_xn, a_xp, a_xn, f_xp, f_xn, mallet]
        if is_high:
            high_objs.extend(group)
        else:
            low_objs.extend(group)

    pack_resident_uv_atlas(low_objs)
    pack_resident_uv_atlas(high_objs)

    fuzz_objs = []
    fuzz_counts = {
        "bean_body_high": (6800, 5600),
        "bean_arm_xpos_high": (520, 420),
        "bean_arm_xneg_high": (520, 420),
        "bean_foot_xpos_high": (380, 300),
        "bean_foot_xneg_high": (380, 300),
        "bean_mallet_high": (480, 380),
    }
    for h_obj in high_objs:
        if h_obj.name in fuzz_counts:
            nc, hc = fuzz_counts[h_obj.name]
            fz = create_fuzz_for_high_object(
                h_obj, collection, mats, seed=len(fuzz_objs) + 40, nap_count=nc, halo_count=hc
            )
            if fz is not None:
                fuzz_objs.append(fz)

    return {"low": low_objs, "high": high_objs, "fuzz": fuzz_objs}


# ==============================================================================
# 8. 주민 3: 할머니 — 찹쌀떡 (ricecake)
# ==============================================================================

def build_ricecake_resident(mats, collection):
    """
    찹쌀떡 ricecake (3회차 시안 규격: 높이 0.62 m · 폭 0.66 m, x = 1.5, y = 0, z = 0)
    - 납작한 돔이 아니라 시안처럼 위가 둥근 통통한 달걀·찹쌀떡 꼴.
    - 얼굴은 높이 60~70% 자리 (눈 z = 0.388 m).
    - 숄은 허리띠가 아니라 얼굴 바로 아래에서 양옆 어깨를 높게 덮고 앞에서 두 자락이 V자로 겹쳐 늘어지는 뜨개 숄(아래 끝은 높이 35% 언저리).
    - 두 팔은 숄 아래에서 나와 무릎 앞 털실 뭉치와 뜨개바늘을 쥐며, 몸통과 같은 귀리빛(#f0e9dd).
    """
    base_loc = Vector((1.5, 0.0, 0.0))

    def ricecake_surface_point(theta, z_norm, lump_seed=77.0):
        # 몸통 높이 z = 0.024 ~ 0.568 m (그 위 뒤쪽에 쪽진 꼭지가 0.620 m까지 올라감)
        z = 0.024 + 0.544 * z_norm
        # 시안처럼 거의 둥근 달걀/통통한 떡 꼴 (몸통 반지름 0.312 m -> 숄 포함 전체 폭 0.66 m)
        if z_norm < 0.34:
            t = z_norm / 0.34
            r_base = 0.195 + 0.117 * math.sqrt(max(0.0, 1.0 - (1.0 - t) ** 2))
        else:
            t = (z_norm - 0.34) / 0.66
            r_base = 0.312 * math.sqrt(max(0.0004, 1.0 - (t ** 1.92)))

        rx = r_base * 1.00
        ry = r_base * 0.95

        x0 = rx * math.sin(theta)
        y0 = -ry * math.cos(theta)

        lump = felt_macro_lump(x0, y0, z, seed=lump_seed) * 0.010 * (1.0 - 0.5 * (z_norm ** 2))
        x = x0 + math.sin(theta) * lump
        y = y0 - math.cos(theta) * lump

        # 눈자위 오목 홈 (높이 ~63% 자리: z ≈ 0.388 m)
        for ex in (-0.086, 0.086):
            dx = x - ex
            dz = z - 0.388
            d2 = dx * dx + dz * dz
            if y < -0.12 and d2 < 0.0044:
                y += 0.014 * math.exp(-d2 / 0.0014)

        return Vector((x, y, z))

    mb_body = MeshBuilder("ricecake_body")
    nu, nv = 50, 34
    body_grid = []
    for r in range(nv):
        zn = r / (nv - 1)
        ring = []
        for c in range(nu):
            th = 2.0 * math.pi * (c / nu)
            ring.append(ricecake_surface_point(th, zn))
        body_grid.append(ring)
    mb_body.add_grid_surface(
        body_grid,
        mats["felt_ricecake_body"],
        closed_u=True,
        cap_bottom=True,
        cap_top=True,
        allow_fuzz=True,
        displace_scale=1.0,
    )

    # 꼭대기 뒤쪽 작은 회갈색 쪽진 꼭지 (#8c8077) + 나무 비녀 (#b98b5b) (전체 높이 0.62 m)
    bun_center = Vector((0.0, 0.042, 0.582))
    mb_body.add_ellipsoid(
        bun_center,
        0.055, 0.050, 0.038,
        mats["felt_ricecake_bun"],
        nu=18, nv=12,
        allow_fuzz=True,
        displace_scale=0.80,
        lump_seed=81.0,
        lump_amp=0.004,
    )
    tie_pts = []
    for k in range(20):
        ang = 2.0 * math.pi * (k / 20.0)
        tie_pts.append(Vector((0.046 * math.cos(ang), 0.042 + 0.042 * math.sin(ang), 0.552)))
    tie_pts.append(tie_pts[0])
    mb_body.add_tube_along_curve(
        tie_pts, 0.0055, mats["felt_ricecake_wood"], nu=8, cap_ends=False, allow_fuzz=False, displace_scale=0.15
    )
    pin_pts = [
        Vector((-0.100, 0.042, 0.572)),
        Vector((-0.030, 0.042, 0.575)),
        Vector((0.040, 0.042, 0.578)),
        Vector((0.120, 0.042, 0.581)),
    ]
    mb_body.add_tube_along_curve(
        pin_pts,
        [0.0072, 0.0058, 0.0048, 0.0034],
        mats["felt_ricecake_wood"],
        nu=10,
        allow_fuzz=False,
        displace_scale=0.10,
    )

    # 얼굴 (높이 60~70% 자리: 눈 z=0.388m, 눈썹 z=0.440m, 볼터치·입 z=0.338m)
    for sx in (-1.0, 1.0):
        p_blush = ricecake_surface_point(sx * math.radians(28.0), 0.580)
        mb_body.add_ellipsoid(
            p_blush + Vector((0.0, -0.003, 0.0)),
            0.026, 0.010, 0.017,
            mats["felt_ricecake_blush"],
            nu=12, nv=8,
            rot_euler=(0.18, sx * 0.16, sx * 0.38),
            allow_fuzz=False,
            displace_scale=0.25,
        )
        # 짧은 수놓은 눈썹 (#8c8077)
        brow_pts = []
        for i in range(5):
            ut = i / 4.0
            th_b = sx * math.radians(15.0 + 10.0 * ut)
            zn_b = 0.768 + 0.012 * math.sin(math.pi * ut) - 0.010 * ut
            pb = ricecake_surface_point(th_b, zn_b) + Vector((0.0, -0.004, 0.002))
            brow_pts.append(pb)
        mb_body.add_tube_along_curve(
            brow_pts,
            [0.0048, 0.0068, 0.0072, 0.0064, 0.0042],
            mats["felt_ricecake_bun"],
            nu=8,
            allow_fuzz=True,
            displace_scale=0.30,
        )

    mouth_pts = []
    for i in range(7):
        ut = (i / 6.0) - 0.5
        th_m = ut * math.radians(11.0)
        zn_m = 0.578 - 0.010 * math.cos(ut * math.pi)
        pm = ricecake_surface_point(th_m, zn_m) + Vector((0.0, -0.004, 0.0))
        mouth_pts.append(pm)
    mb_body.add_tube_along_curve(mouth_pts, 0.0036, mats["felt_ricecake_detail"], nu=6, allow_fuzz=False, displace_scale=0.10)

    # 3회차 핵심: 얼굴 바로 아래에서 어깨를 높게 덮고 앞에서 두 자락이 V자로 겹쳐 늘어지는 장밋빛 뜨개 숄 (#d48e9a)
    # - 옆/어깨(|theta| >= 45 deg)에서는 눈높이 근처(z_norm 0.72 -> z=0.415m)까지 올라와 어깨를 감싸고,
    # - 정면(theta ~ 0)에서는 입 바로 아래(z_norm 0.50 -> z=0.295m)로 V자 네크라인을 그리며,
    # - 아래 끝은 높이 35% 언저리(z ≈ 0.215m -> z_norm 0.35)까지 내려온다.
    sh_nu, sh_nv = 56, 16
    sh_grid = []
    for r in range(sh_nv):
        v_t = r / (sh_nv - 1)
        edge_v = math.sin(math.pi * v_t) ** 0.35
        knit_row = 0.0032 * math.sin(v_t * math.pi * 12.0)
        ring = []
        for c in range(sh_nu):
            th = 2.0 * math.pi * (c / sh_nu)
            # 정면 V-네크라인 함몰 가중치 (정면 +-52도 구간에서만 아래로 파임)
            front_v_neck = max(0.0, (math.cos(th) - 0.35) / 0.65) ** 1.35
            zn_top = 0.73 - 0.23 * front_v_neck
            zn_bot = 0.35 - 0.04 * front_v_neck
            zn = zn_bot + (zn_top - zn_bot) * v_t

            p_surf = ricecake_surface_point(th, zn)
            n_out = Vector((math.sin(th), -math.cos(th), 0.14)).normalized()
            knit_col = 0.0020 * math.cos(th * 38.0 + (r % 2) * 1.5)
            thick = 0.004 + (0.015 + knit_row + knit_col) * edge_v
            ring.append(p_surf + n_out * thick)
        sh_grid.append(ring)
    mb_body.add_grid_surface(sh_grid, mats["felt_ricecake_shawl"], closed_u=True, allow_fuzz=True, displace_scale=0.90)

    # 앞에서 두 자락이 V자로 겹쳐 가슴~배 위(높이 32~35% 언저리, z ≈ 0.195~0.215m)까지 늘어지는 숄 앞자락
    for idx_end, sx in enumerate((-1.0, 1.0)):
        te_nu, te_nv = 10, 14
        te_grid = []
        for r in range(te_nv):
            vt = r / (te_nv - 1)
            # 위쪽(vt=1): 양옆 어깨(theta ≈ +-48 deg, zn=0.68)에서 내려와
            # 아래쪽(vt=0): 앞가슴 중앙(theta ≈ -sx*6 deg, zn=0.31 -> z=0.193m, 높이 ~31%)에서 포개짐
            zn = 0.31 + 0.37 * vt
            center_th = sx * math.radians(46.0 * vt - 5.0 * (1.0 - vt))
            row = []
            for c in range(te_nu):
                ut = (c / (te_nu - 1)) - 0.5
                th = center_th + ut * math.radians(14.0)
                p_surf = ricecake_surface_point(th, zn)
                n_out = Vector((math.sin(th), -math.cos(th), 0.10)).normalized()
                rib = 0.0030 * math.cos(ut * math.pi * 6.0) + 0.0020 * math.sin(vt * math.pi * 12.0)
                edge = (math.sin(math.pi * (c / (te_nu - 1))) * math.sin(math.pi * (0.06 + 0.88 * vt))) ** 0.35
                layer_off = 0.015 + (0.006 if idx_end == 1 else 0.0)
                row.append(p_surf + n_out * (layer_off + (0.012 + rib) * edge))
            te_grid.append(row)
        mb_body.add_grid_surface(te_grid, mats["felt_ricecake_shawl"], closed_u=False, allow_fuzz=True, displace_scale=0.85)

    # 밑단을 도는 크림색 홈질 바늘땀
    hem_pts = []
    for c in range(56):
        th = 2.0 * math.pi * (c / 56.0)
        p_surf = ricecake_surface_point(th, 0.042)
        n_out = Vector((math.sin(th), -math.cos(th), 0.0)).normalized()
        hem_pts.append(p_surf + n_out * 0.0035)
    mb_body.add_stitch_line(hem_pts, mats["thread_cream"], stitch_len=0.016, radius=0.0038)

    # 눈 둘 (높이 ~63% 자리: z = 0.388 m)
    p_eye_xp = ricecake_surface_point(math.radians(18.5), 0.670)
    p_eye_xn = ricecake_surface_point(math.radians(-18.5), 0.670)
    eye_locs = {
        "eye_xpos": Vector((0.086, p_eye_xp.y - 0.004, 0.388)),
        "eye_xneg": Vector((-0.086, p_eye_xn.y - 0.004, 0.388)),
    }
    eye_builders = {}
    for ename in ("eye_xpos", "eye_xneg"):
        eb = MeshBuilder(f"ricecake_{ename}")
        eb.add_ellipsoid(
            Vector((0.0, 0.0, 0.0)),
            0.030, 0.023, 0.031,
            mats["bead_black"],
            nu=16, nv=12,
            allow_fuzz=False,
            displace_scale=0.0,
        )
        eb.add_ellipsoid(
            Vector((-0.008, -0.021, 0.010)),
            0.0065, 0.0035, 0.0065,
            mats["eye_highlight"],
            nu=8, nv=6,
            allow_fuzz=False,
            displace_scale=0.0,
        )
        eye_builders[ename] = eb

    # 팔 둘 (3회차: 숄 아래 끝(z≈0.20m) 밑에서 나와 무릎 앞 뜨개바늘을 모으는 귀리빛 팔)
    arm_locs = {
        "arm_xpos": Vector((0.155, -0.255, 0.195)),
        "arm_xneg": Vector((-0.155, -0.255, 0.195)),
    }
    arm_builders = {}
    for sx, aname in ((1.0, "arm_xpos"), (-1.0, "arm_xneg")):
        ab = MeshBuilder(f"ricecake_{aname}")
        a_pts = [
            Vector((0.0, 0.0, 0.0)),
            Vector((-sx * 0.025, -0.026, -0.006)),
            Vector((-sx * 0.055, -0.048, -0.012)),
            Vector((-sx * 0.082, -0.062, -0.016)),
        ]
        ab.add_tube_along_curve(
            a_pts,
            [0.034, 0.040, 0.042, 0.036],
            mats["felt_ricecake_body"],
            nu=14,
            allow_fuzz=True,
            displace_scale=0.75,
        )
        arm_builders[aname] = ab

    # 발 둘
    foot_locs = {
        "foot_xpos": Vector((0.105, -0.175, 0.032)),
        "foot_xneg": Vector((-0.105, -0.175, 0.032)),
    }
    foot_builders = {}
    for fname in ("foot_xpos", "foot_xneg"):
        fb = MeshBuilder(f"ricecake_{fname}")
        fb.add_ellipsoid(
            Vector((0.0, 0.0, 0.0)),
            0.052, 0.068, 0.032,
            mats["felt_ricecake_body"],
            nu=14, nv=10,
            allow_fuzz=True,
            displace_scale=0.6,
            lump_seed=91.0,
            lump_amp=0.004,
        )
        foot_builders[fname] = fb

    # 소품: ricecake_knitting (부모 ricecake_body, 원점 = 손에 쥐는 자리, 숄 아래 무릎 앞)
    knit_loc_rel = Vector((0.0, -0.320, 0.175))
    mb_knit = MeshBuilder("ricecake_knitting")

    # 나무 뜨개바늘 두 개 (#b98b5b)
    n1_pts = [
        Vector((0.026, -0.006, 0.016)),
        Vector((-0.022, -0.004, -0.008)),
        Vector((-0.098, -0.002, -0.056)),
        Vector((-0.182, 0.002, -0.112)),
    ]
    n2_pts = [
        Vector((-0.026, -0.008, 0.016)),
        Vector((0.022, -0.005, -0.008)),
        Vector((0.098, -0.002, -0.056)),
        Vector((0.182, 0.002, -0.112)),
    ]
    for n_pts in (n1_pts, n2_pts):
        mb_knit.add_tube_along_curve(
            n_pts,
            [0.0030, 0.0048, 0.0055, 0.0060],
            mats["felt_ricecake_wood"],
            nu=8,
            allow_fuzz=False,
            displace_scale=0.10,
        )
        mb_knit.add_ellipsoid(
            n_pts[-1], 0.0085, 0.0085, 0.0085, mats["felt_ricecake_wood"], nu=8, nv=6, allow_fuzz=False, displace_scale=0.1
        )

    # 숄 아래 무릎 앞으로 내려오는 장밋빛 뜨개질 편물
    sw_nu, sw_nv = 10, 14
    sw_grid = []
    for r in range(sw_nv):
        vt = r / (sw_nv - 1)
        z_sw = -0.145 + 0.148 * vt
        y_sw = -0.014 - 0.010 * math.sin(vt * math.pi)
        row = []
        for c in range(sw_nu):
            ut = (c / (sw_nu - 1)) - 0.5
            x_sw = ut * (0.082 - 0.012 * vt)
            stitch_rib = 0.0036 * math.cos(ut * math.pi * 8.0) + 0.0024 * math.sin(vt * math.pi * 16.0)
            row.append(Vector((x_sw, y_sw - stitch_rib, z_sw)))
        sw_grid.append(row)
    mb_knit.add_grid_surface(sw_grid, mats["felt_ricecake_shawl"], closed_u=False, allow_fuzz=True, displace_scale=0.85)

    # 무릎 앞옆에 놓인 장밋빛 털실 뭉치 (시안처럼 오른쪽 +X 무릎 옆에 통통하게 배치)
    yarn_center = Vector((0.205, 0.040, -0.095))
    y_nu, y_nv = 22, 16
    yarn_grid = []
    for r in range(y_nv):
        phi = math.pi * (0.06 + 0.88 * (r / (y_nv - 1)))
        ring = []
        for c in range(y_nu):
            th = 2.0 * math.pi * (c / y_nu)
            wrap1 = math.sin(7.0 * th + 5.0 * phi)
            wrap2 = math.sin(5.0 * th - 8.0 * phi)
            rad = 0.076 + 0.0040 * wrap1 + 0.0030 * wrap2
            lp = Vector((
                rad * math.sin(phi) * math.cos(th),
                rad * math.sin(phi) * math.sin(th),
                -rad * 0.92 * math.cos(phi),
            ))
            ring.append(yarn_center + lp)
        yarn_grid.append(ring)
    mb_knit.add_grid_surface(
        yarn_grid,
        mats["felt_ricecake_shawl"],
        closed_u=True,
        cap_bottom=True,
        cap_top=True,
        allow_fuzz=True,
        displace_scale=0.85,
    )

    strand_pts = [
        yarn_center + Vector((-0.052, -0.040, -0.020)),
        Vector((0.115, -0.018, -0.112)),
        Vector((0.052, -0.018, -0.062)),
        Vector((0.015, -0.012, -0.008)),
    ]
    mb_knit.add_tube_along_curve(
        strand_pts, 0.0055, mats["felt_ricecake_shawl"], nu=7, allow_fuzz=True, displace_scale=0.35
    )

    low_objs = []
    high_objs = []
    for is_high in (False, True):
        sfx = "_high" if is_high else ""
        body_obj = mb_body.build_object(
            f"ricecake_body{sfx}", collection, location=base_loc, parent=None, is_high=is_high, high_seed=301.0
        )
        e_xp = eye_builders["eye_xpos"].build_object(
            f"ricecake_eye_xpos{sfx}", collection, location=eye_locs["eye_xpos"], parent=body_obj, is_high=is_high, high_seed=302.0
        )
        e_xn = eye_builders["eye_xneg"].build_object(
            f"ricecake_eye_xneg{sfx}", collection, location=eye_locs["eye_xneg"], parent=body_obj, is_high=is_high, high_seed=303.0
        )
        a_xp = arm_builders["arm_xpos"].build_object(
            f"ricecake_arm_xpos{sfx}", collection, location=arm_locs["arm_xpos"], parent=body_obj, is_high=is_high, high_seed=304.0
        )
        a_xn = arm_builders["arm_xneg"].build_object(
            f"ricecake_arm_xneg{sfx}", collection, location=arm_locs["arm_xneg"], parent=body_obj, is_high=is_high, high_seed=305.0
        )
        f_xp = foot_builders["foot_xpos"].build_object(
            f"ricecake_foot_xpos{sfx}", collection, location=foot_locs["foot_xpos"], parent=body_obj, is_high=is_high, high_seed=306.0
        )
        f_xn = foot_builders["foot_xneg"].build_object(
            f"ricecake_foot_xneg{sfx}", collection, location=foot_locs["foot_xneg"], parent=body_obj, is_high=is_high, high_seed=307.0
        )
        knit = mb_knit.build_object(
            f"ricecake_knitting{sfx}", collection, location=knit_loc_rel, parent=body_obj, is_high=is_high, high_seed=308.0
        )

        group = [body_obj, e_xp, e_xn, a_xp, a_xn, f_xp, f_xn, knit]
        if is_high:
            high_objs.extend(group)
        else:
            low_objs.extend(group)

    pack_resident_uv_atlas(low_objs)
    pack_resident_uv_atlas(high_objs)

    fuzz_objs = []
    # 팔의 털 밀도를 표면적에 맞게 낮추고 몸통과 동일한 재질을 써서 하얀 벙어리장갑처럼 보이지 않게 함
    fuzz_counts = {
        "ricecake_body_high": (6400, 5400),
        "ricecake_arm_xpos_high": (180, 140),
        "ricecake_arm_xneg_high": (180, 140),
        "ricecake_foot_xpos_high": (220, 180),
        "ricecake_foot_xneg_high": (220, 180),
        "ricecake_knitting_high": (850, 680),
    }
    for h_obj in high_objs:
        if h_obj.name in fuzz_counts:
            nc, hc = fuzz_counts[h_obj.name]
            fz = create_fuzz_for_high_object(
                h_obj, collection, mats, seed=len(fuzz_objs) + 70, nap_count=nc, halo_count=hc
            )
            if fz is not None:
                fuzz_objs.append(fz)

    return {"low": low_objs, "high": high_objs, "fuzz": fuzz_objs}


# ==============================================================================
# 9. Cycles GPU 설정 · 미리보기 조명/카메라 · 렌더
# ==============================================================================

def configure_cycles_gpu(scene):
    scene.render.engine = "CYCLES"
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"

    scene.cycles.samples = 256
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.012
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 3
    scene.cycles.transmission_bounces = 2
    scene.cycles.transparent_max_bounces = 8

    device_used = "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for dev_type in ("OPTIX", "CUDA"):
            try:
                prefs.compute_device_type = dev_type
                if hasattr(prefs, "refresh_devices"):
                    prefs.refresh_devices()
                else:
                    prefs.get_devices()
                gpu_found = False
                for d in prefs.devices:
                    if d.type in ("OPTIX", "CUDA"):
                        d.use = True
                        gpu_found = True
                    else:
                        d.use = False
                if gpu_found:
                    scene.cycles.device = "GPU"
                    device_used = dev_type
                    break
            except Exception:
                continue
    except Exception:
        pass

    return device_used


def create_preview_stage(scene):
    stage_col = bpy.data.collections.new("preview_stage")
    scene.collection.children.link(stage_col)

    world = bpy.data.worlds.new("PreviewWorld")
    scene.world = world
    world.use_nodes = True
    w_nt = world.node_tree
    bg = w_nt.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = hex_to_linear_rgba("#dcebff", 1.0)
        bg.inputs[1].default_value = 0.36

    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=6.0)
    ground_mesh = bpy.data.meshes.new("shadow_catcher_mesh")
    bm.to_mesh(ground_mesh)
    bm.free()
    ground_obj = bpy.data.objects.new("shadow_catcher", ground_mesh)
    stage_col.objects.link(ground_obj)
    ground_obj.location = (0.0, 0.0, 0.0)
    ground_obj.is_shadow_catcher = True

    ground_mat = create_felt_material("ground_bounce_mat", "#e5d5be", style="felt")
    ground_mesh.materials.append(ground_mat)

    def add_area_light(name, loc, rot_deg, energy, size, hex_col, glossy_visible=True):
        ldata = bpy.data.lights.new(name=name, type="AREA")
        ldata.energy = energy
        ldata.shape = "DISK"
        ldata.size = size
        c_lin = hex_to_linear_rgba(hex_col)
        ldata.color = (c_lin[0], c_lin[1], c_lin[2])
        lobj = bpy.data.objects.new(name, ldata)
        stage_col.objects.link(lobj)
        lobj.location = loc
        lobj.rotation_euler = Euler([math.radians(a) for a in rot_deg], "XYZ")
        if hasattr(lobj, "visible_glossy"):
            lobj.visible_glossy = glossy_visible
        return lobj

    # 1) 앞 왼쪽 위 주광 (양모의 잔 굴곡과 엉킨 털 결에 입체적인 음영이 지도록 크기와 각도 조절)
    add_area_light("KeyLight_Warm", (-2.4, -2.3, 3.2), (44.0, 0.0, -40.0), 210.0, 1.8, "#fff1db", glossy_visible=True)
    # 2) 오른쪽 위 하늘빛 보조광
    add_area_light("FillLight_Sky", (2.5, -2.0, 2.7), (48.0, 0.0, 42.0), 75.0, 3.4, "#cfe5ff", glossy_visible=False)
    # 3) 뒤쪽 위 보송한 털 테두리 역광 (윤곽 둘레 _fuzz를 밝게 살림)
    add_area_light("RimLight_Fuzzy", (0.2, 2.3, 2.6), (-46.0, 0.0, 175.0), 145.0, 2.4, "#fff7ea", glossy_visible=False)
    # 4) 바닥 반사광
    add_area_light("BounceLight_Floor", (0.0, -1.8, -0.65), (125.0, 0.0, 0.0), 42.0, 3.2, "#ffe6c4", glossy_visible=False)

    cam_data = bpy.data.cameras.new("PreviewCamera")
    cam_data.type = "ORTHO"
    cam_data.clip_start = 0.05
    cam_data.clip_end = 30.0
    cam_obj = bpy.data.objects.new("PreviewCamera", cam_data)
    stage_col.objects.link(cam_obj)
    scene.camera = cam_obj

    return stage_col, cam_obj


def position_ortho_camera(cam_obj, target_x, char_height, res_x=1024, res_y=1024, custom_ortho_scale=None):
    elev_rad = math.radians(22.0)
    rot_x = math.radians(90.0 - 22.0)
    cam_obj.rotation_euler = Euler((rot_x, 0.0, 0.0), "XYZ")

    proj_h = char_height * math.cos(elev_rad) + (char_height * 0.22) * math.sin(elev_rad)
    vert_span = proj_h / 0.70

    if custom_ortho_scale is not None:
        cam_obj.data.ortho_scale = custom_ortho_scale
    else:
        aspect = res_x / float(res_y)
        cam_obj.data.ortho_scale = vert_span * max(1.0, aspect)

    target_z = char_height * 0.48
    dist = 6.0
    cam_obj.location = Vector((
        target_x,
        -dist * math.cos(elev_rad),
        target_z + dist * math.sin(elev_rad),
    ))


def set_group_visibility(objs, visible):
    for o in objs:
        o.hide_render = not visible
        o.hide_viewport = not visible


def render_all_previews(scene, residents_data, out_dir):
    t_start = time.time()
    stage_col, cam_obj = create_preview_stage(scene)

    # 3회차 시안 규격 반영
    specs = {
        "bun": {"x": -1.5, "h": 0.780},
        "bean": {"x": 0.0, "h": 1.320},
        "ricecake": {"x": 1.5, "h": 0.620},
    }

    render_times = {}

    for rid in ("bun", "bean", "ricecake"):
        for other_id, rgroup in residents_data.items():
            set_group_visibility(rgroup["low"], False)
            set_group_visibility(rgroup["high"], False)
            set_group_visibility(rgroup["fuzz"], False)

        rgroup = residents_data[rid]
        rx = specs[rid]["x"]
        rh = specs[rid]["h"]

        scene.render.resolution_x = 1024
        scene.render.resolution_y = 1024
        position_ortho_camera(cam_obj, rx, rh, 1024, 1024)

        body_low = rgroup["low"][0]
        body_high = rgroup["high"][0]

        # 1) preview_<id>_front.png
        set_group_visibility(rgroup["high"], True)
        set_group_visibility(rgroup["fuzz"], True)
        set_group_visibility(rgroup["low"], False)
        body_high.rotation_euler = Euler((0.0, 0.0, 0.35), "XYZ")
        p_front = os.path.join(out_dir, f"preview_{rid}_front.png")
        scene.render.filepath = p_front
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        render_times[f"preview_{rid}_front.png"] = round(time.time() - t0, 2)

        # 2) preview_<id>_back.png
        body_high.rotation_euler = Euler((0.0, 0.0, math.pi + 0.4), "XYZ")
        p_back = os.path.join(out_dir, f"preview_{rid}_back.png")
        scene.render.filepath = p_back
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        render_times[f"preview_{rid}_back.png"] = round(time.time() - t0, 2)
        body_high.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")

        # 3) preview_<id>_low.png
        set_group_visibility(rgroup["high"], False)
        set_group_visibility(rgroup["fuzz"], False)
        set_group_visibility(rgroup["low"], True)
        body_low.rotation_euler = Euler((0.0, 0.0, 0.35), "XYZ")
        p_low = os.path.join(out_dir, f"preview_{rid}_low.png")
        scene.render.filepath = p_low
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        render_times[f"preview_{rid}_low.png"] = round(time.time() - t0, 2)
        body_low.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")

    # 4) preview_lineup.png
    for rid, rgroup in residents_data.items():
        set_group_visibility(rgroup["low"], False)
        set_group_visibility(rgroup["high"], True)
        set_group_visibility(rgroup["fuzz"], True)
        rgroup["high"][0].rotation_euler = Euler((0.0, 0.0, 0.35), "XYZ")

    scene.render.resolution_x = 2048
    scene.render.resolution_y = 1024
    position_ortho_camera(cam_obj, 0.0, 1.26, 2048, 1024, custom_ortho_scale=4.25)
    p_lineup = os.path.join(out_dir, "preview_lineup.png")
    scene.render.filepath = p_lineup
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    render_times["preview_lineup.png"] = round(time.time() - t0, 2)

    for rid, rgroup in residents_data.items():
        rgroup["low"][0].rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
        rgroup["high"][0].rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
        set_group_visibility(rgroup["low"], True)
        set_group_visibility(rgroup["high"], True)
        set_group_visibility(rgroup["fuzz"], True)

    for obj in list(stage_col.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(stage_col)

    render_times["total_seconds"] = round(time.time() - t_start, 2)
    return render_times


# ==============================================================================
# 10. 검증 및 out/report.json 생성
# ==============================================================================

def count_mesh_triangles(obj):
    if obj.type != "MESH" or obj.data is None:
        return 0
    mesh = obj.data
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def build_report(residents_data, mats, device_used, render_times):
    bpy.context.view_layer.update()

    residents_report = {}
    unmet_items = []

    for rid, rgroup in residents_data.items():
        part_tris = {}
        parts_info = []
        uv_bake_ok = True
        total_low_tris = 0

        for obj in rgroup["low"]:
            tris = count_mesh_triangles(obj)
            part_tris[obj.name] = tris
            total_low_tris += tris

            uv_names = [uv.name for uv in obj.data.uv_layers]
            has_bake = (uv_names == ["bake"])
            if not has_bake:
                uv_bake_ok = False
                unmet_items.append(f"{obj.name}: UV layers = {uv_names} (expected ['bake'])")

            world_origin = obj.matrix_world.translation
            parts_info.append({
                "name": obj.name,
                "triangles": tris,
                "origin_world": [round(world_origin.x, 4), round(world_origin.y, 4), round(world_origin.z, 4)],
                "origin_local": [round(obj.location.x, 4), round(obj.location.y, 4), round(obj.location.z, 4)],
                "parent": obj.parent.name if obj.parent else None,
                "uv_map_bake": has_bake,
            })

        if total_low_tris > 15000:
            unmet_items.append(f"{rid}: low-poly triangle total {total_low_tris} exceeds 15000")

        high_tris = {o.name: count_mesh_triangles(o) for o in rgroup["high"]}
        fuzz_names = [o.name for o in rgroup["fuzz"]]

        residents_report[rid] = {
            "collection": f"res_{rid}",
            "low_triangle_total": total_low_tris,
            "low_triangles_by_part": part_tris,
            "parts": parts_info,
            "uv_bake_shared_and_valid": uv_bake_ok,
            "high_triangles_by_part": high_tris,
            "fuzz_objects": fuzz_names,
        }

    materials_report = {}
    for mname, mat in sorted(mats.items()):
        materials_report[mname] = {
            "synk_color": mat.get("synk_color", ""),
            "single_principled_bsdf": (
                sum(1 for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED") == 1
            ),
        }

    return {
        "blender_version": bpy.app.version_string,
        "cycles_device": device_used,
        "residents": residents_report,
        "materials": materials_report,
        "render_times_seconds": render_times,
        "unmet_requirements": unmet_items,
    }


# ==============================================================================
# 11. 메인 실행부
# ==============================================================================

def main():
    base_dir = get_script_dir()
    args = parse_cli_args()

    work_dir = os.path.join(base_dir, "work")
    out_dir = os.path.join(base_dir, "out")
    os.makedirs(work_dir, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    device_used = configure_cycles_gpu(scene)
    mats = build_all_materials()

    col_bun = bpy.data.collections.new("res_bun")
    col_bean = bpy.data.collections.new("res_bean")
    col_ricecake = bpy.data.collections.new("res_ricecake")
    scene.collection.children.link(col_bun)
    scene.collection.children.link(col_bean)
    scene.collection.children.link(col_ricecake)

    residents_data = {
        "bun": build_bun_resident(mats, col_bun),
        "bean": build_bean_resident(mats, col_bean),
        "ricecake": build_ricecake_resident(mats, col_ricecake),
    }

    bpy.context.view_layer.update()

    render_times = {"skipped": not args["previews"]}
    if args["previews"]:
        render_times = render_all_previews(scene, residents_data, out_dir)

    blend_path = os.path.join(work_dir, "residents.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path, compress=True)

    report = build_report(residents_data, mats, device_used, render_times)
    report_path = os.path.join(out_dir, "report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"[SYNK-RESIDENTS-R3] Saved {blend_path} and {report_path}")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
