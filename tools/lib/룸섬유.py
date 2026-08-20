# Loom 섬유 — 「펠트↔털」 축의 **레시피 한 벌** (Blender 안에서만 돈다 · 2026-08-19)
#
# ■ 왜 떼어냈나
#   유호 지시 08-18 「재질 넷을 섬유 하나로 좁힌다」의 집행에는 굽는 자리가 둘이다:
#     · `tools/룸털.py`   — 축을 재는 «시험대»(덩어리 하나를 여러 값으로 굽는다)
#     · `tools/룸장면.py` — 지면이 쓰는 «부품»을 굽는다(원판·판·칩 …)
#   레시피를 두 벌로 적으면 그 순간 갈라지고, **갈라지는 방향은 언제나 「통과」**다 —
#   한쪽만 고친 날 시험대는 좋아 보이는데 지면의 부품은 그대로다(F517 계보).
#   ⇒ 값과 판정은 여기 하나에 둔다. 두 스크립트는 «부르기만» 한다.
#
# ■ 축 다섯 — 양쪽 끝이 다 실패한다(한쪽만 적으면 다음 사람이 그쪽으로 민다)
#   ① 길이  길면 털이 형태를 먹는다 / 짧으면 실루엣에만 남는다
#   ② 굵기  🔑 **손대지 않는다.** 끝을 뾰족하게 두는 것이 기본값이고, 두께를 주면 «뭉툭한 막대»가
#           수십만 개 모여 생물이 아니라 구조물로 읽힌다(유호 판정 08-18 「기하학적이고 징그럽다」).
#   ③ 광원  작으면 자체 그림자가 딱딱하다 / 크면 명암이 통째로 사라진다(반경의 2~3배가 자리)
#   ④ 변이  크면 헝클어진 양털 / 작으면 매끈한 면. ⚠엔진마다 반대다 — Cycles 는 실제 기하라
#           Canvas(획을 긋는 판)와 같은 값을 주면 그대로 «헝클어짐»이 된다.
#   ⑤ 눕힘  크면 표면에 붙어 결이 사라진다 / 작으면 정면에서 끝만 보인다
#
# ■ ⚠ 이 모듈이 틀릴 때의 모습
#   `bpy` 가 없는 자리에서 import 하면 그 자리에서 죽는다 — **일부러 그렇게 둔다.**
#   조용히 no-op 으로 넘기면 「털을 입혔다」고 믿은 채 맨 메시가 구워진다(초록 얼굴의 오류).
import bpy


def 털층들(ob, 이름, 뭉치수, 자식수, 길이):
    """겉털 + 속털 **두 층**. 🔴 한 층만 쓰면 아무리 심어도 «면»이 된다(실측) —
    실루엣에서 털로 읽히게 만드는 것은 길고 성긴 «겉털»이다."""
    def 층(층이름, 개수, 자식, 길, 뭉침, 거칠, 반경):
        ob.modifiers.new(층이름, 'PARTICLE_SYSTEM')
        st = ob.particle_systems[-1].settings
        st.name = 이름 + "_" + 층이름
        st.type = 'HAIR'
        st.count = 개수
        st.hair_length = 길
        st.hair_step = 5
        st.render_type = 'PATH'
        st.use_advanced_hair = True
        st.distribution = 'RAND'          # JIT 는 격자라 곡면에서 쏠린다
        st.use_even_distribution = True   # 면적 가중 — 꺼져 있으면 큰 면이 굶는다
        st.userjit = 0
        st.child_type = 'INTERPOLATED'
        st.rendered_child_count = 자식
        st.child_percent = 자식
        st.child_radius = 반경
        st.child_roundness = 0.6
        st.child_length = 1.0
        st.child_length_threshold = 0.30
        st.clump_factor = 뭉침
        st.clump_shape = 0.22
        st.roughness_1 = 거칠
        st.roughness_1_size = 0.20
        st.roughness_2 = 거칠 * 1.5
        st.roughness_2_size = 0.55
        st.roughness_endpoint = 거칠 * 1.3
        st.kink = 'NO'
        st.effector_weights.gravity = 0.145
        st.brownian_factor = 0.0
        # 🔑 굵기는 «건드리지 않는다» — 축 ② 참조.

    층("undercoat", int(뭉치수 * 0.86), 자식수, 길이 * 0.58, 0.26, 0.008, 0.030)
    층("guard", int(뭉치수 * 0.14), max(6, 자식수 // 5), 길이 * 1.65, 0.18, 0.018, 0.062)
    ob.show_instancer_for_render = False


def 털재질(이름, 밝기, 코랄=False):
    """Principled Hair BSDF. 밝기는 «가닥의 색»이지 조명이 아니다 —
    조명으로 어둡게 하면 그림자까지 죽고, 색으로 어둡게 해야 두 덩어리가 갈린다."""
    mat = bpy.data.materials.new("fur_" + 이름)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    hair = nt.nodes.new('ShaderNodeBsdfHairPrincipled')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    try:
        hair.parametrization = 'COLOR'
    except Exception:
        pass

    def 넣(키, 값):
        if 키 in hair.inputs:
            hair.inputs[키].default_value = 값

    if 코랄:
        넣("Color", (0.72 * 밝기 / 0.875, 0.30 * 밝기 / 0.875, 0.26 * 밝기 / 0.875, 1.0))
    else:
        넣("Color", (밝기, 밝기, 밝기, 1.0))
    넣("Roughness", 0.44)
    넣("Radial Roughness", 0.36)
    넣("Coat", 0.20)
    넣("Random Color", 0.055)     # 가닥마다 미세하게 다른 색 — 균일함을 깨는 자리
    넣("Random Roughness", 0.10)
    nt.links.new(hair.outputs[0], out.inputs[0])
    return mat


def 털입히기(ob, 이름, 밝기, 뭉치수, 자식수, 길이, 코랄=False):
    """메시 하나를 섬유로 만든다 — 두 층 + 재질. 그리고 **심긴 가닥 수를 되읽어 찍는다.**
    🔴 「돌았다」가 아니라 «결과»를 본다: 파티클 0 이면 위의 값이 전부 무의미한데
    렌더는 멀쩡히 나온다(맨 메시가 나올 뿐이다)."""
    털층들(ob, 이름, 뭉치수, 자식수, 길이)
    ob.data.materials.append(털재질(이름, 밝기, 코랄))
    return ob


def 가닥진단(ob, 라벨=None):
    """이 메시에 실제로 평가된 가닥 수 — 렌더 «전»에 찍는다. 0 이면 그대로 드러난다."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    총 = 0
    try:
        for ps in ev.particle_systems:
            n = len(ps.particles)
            총 += n
            print("DIAG %s particles=%d child=%d len=%.3f" % (
                ps.settings.name, n, ps.settings.rendered_child_count, ps.settings.hair_length))
    except Exception as e:
        print("DIAG 가닥진단 FAIL", 라벨 or ob.name, e)
    if 총 == 0:
        print("DIAG 🔴 %s — 심긴 가닥이 **0** 이다. 맨 메시가 구워진다." % (라벨 or ob.name))
    return 총
