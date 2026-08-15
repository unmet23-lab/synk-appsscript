# 마스코트 눈 평탄화 — 형상 GLB 의 «눈 돌기»를 주변 돔 곡률로 메운다. (블렌더 헤드리스 · 결정론 · 0원)
#
# 왜 (유호 신고 2026-08-15 「눈이 2개 겹쳐졌어 · 웃을 때 눈에 자국」):
#   Hunyuan 형상은 사진 속 «단추 눈»을 **기하 돌기**로 복원했다. 눈은 사진이 그리는데 메시에도
#   눈이 있으니 눈이 둘이다. 실측된 증상 셋이 전부 이 하나에서 나온다 —
#     ① 큰 턴(+75°)에서 먼 쪽 눈 돌기가 실루엣에 남아 가까운 눈과 «겹친 두 눈»으로 읽힌다.
#     ② 눈웃음은 텍스처만 자수 「^」로 바뀌고 돌기는 그대로라 웃는 눈 밑에 «둥근 자국»이 남는다.
#     ③ 사진에 이미 구워진 단추 하이라이트 위에 돌기의 하이라이트가 겹쳐 눈이 젖어 보인다.
#   (v3 에서 생긴 게 아니다 — v1·v2 프레임에서도 같은 자국을 실측했다. 큰 턴이 눈에 띄게 만들었을 뿐.
#    사진 쪽은 결백하다: 눈웃음 사진의 그 자리 섬유 결 31·41 = 주변 펠트와 같다.)
#
# 통로: 리깅과 «같은 식»의 정면 투영 UV 로 본체 사진 밝기를 정점마다 찍어 「어두운 = 눈」을 고르고,
#   그 자리를 **주변 얼굴 곡률의 연장(접평면 이차곡면)으로** 메운다.
#   🔑 라플라시안 평활 단독은 기각(1차 실측 08-15) — 경계를 못박고 평활하면 조화곡면으로 수렴해
#      돔보다 평평해진다 = 돌기가 **웅덩이**로 바뀐다(무지 렌더에 테두리까지 또렷한 접시가 남았다).
#      그래서 평활이 아니라 «주변 곡률의 연장»으로 메운다.
#
# 대가(틀릴 때의 모습):
#   · 문턱을 넘기면 눈이 아닌 어두운 자리까지 먹는다 → 「고른 정점 수·최대 이동량」을 늘 찍는다.
#   · 고리가 너무 좁으면 구 맞춤이 불안정해 반지름이 튄다 → 「맞춤 반지름·잔차」를 늘 찍는다.
#     반지름이 몸 높이(1.0)의 몇 배로 나오면 그건 «거의 평면»이라는 뜻이고, 그 자리에선 이 도구를 쓰지 않는다.
#   · 뒤통수에도 같은 UV 가 걸리므로 «정면 법선»으로 가른다. 그 판정이 무너지면 뒤통수가 패인다.
#   · 눈의 3D 부피는 사라진다 — 그게 목적이다(유호 확정 08-15 「그동안 썼던 눈이 더 좋아」
#     = 사진이 그린 납작한 단추 눈).
#
# 사용:
#   blender -b -P tools/마스코트눈평탄화.py -- <입력.glb> <본체사진.png> <출력.glb> [문턱=0.06] [넓힘=4] [고리=10]
import bpy, sys
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, 본체, 출력 = argv[0], argv[1], argv[2]
문턱 = float(argv[3]) if len(argv) > 3 else 0.06
넓힘배 = float(argv[4]) if len(argv) > 4 else 1.35   # 메울 반지름 = 단추 반지름 × 이 값(테두리까지)
고리안 = float(argv[5]) if len(argv) > 5 else 2.6    # 곡률을 읽을 고리 안쪽(돌기 치마 «바깥»이어야 한다)
고리밖 = float(argv[6]) if len(argv) > 6 else 4.0    # 그 고리의 바깥쪽
사진물체분수 = 597.0 / 1024.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
obj = max(meshes, key=lambda o: len(o.data.vertices))
for o in list(bpy.context.scene.objects):
    if o.type == "MESH" and o is not obj:
        bpy.data.objects.remove(o, do_unlink=True)

# 리깅(build_scene→normalize)과 같은 정규화 — UV 식이 같아야 눈 자리가 어긋나지 않는다
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
obj.location = (0, 0, 0)
s = 1.0 / max(obj.dimensions.z, 1e-6)
obj.scale = (s, s, s)
bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)

me = obj.data
n = len(me.vertices)
co = np.empty(n * 3, dtype=np.float64)
me.vertices.foreach_get("co", co)
co = co.reshape(n, 3)
nrm = np.empty(n * 3, dtype=np.float64)
me.vertices.foreach_get("normal", nrm)
nrm = nrm.reshape(n, 3)

W = (max(obj.dimensions.x, 1.0) * 1.03) / 사진물체분수   # 리깅 make_material 과 같은 값
u = 0.5 + co[:, 0] / W
v = 0.5 + co[:, 2] / W

img = bpy.data.images.load(본체)
w, h = img.size
buf = np.empty(w * h * 4, dtype=np.float32)
img.pixels.foreach_get(buf)
px = buf.reshape(h, w, 4)          # 행은 아래→위 — UV v 와 방향이 같다
xi = np.clip((u * w).astype(np.int64), 0, w - 1)
yi = np.clip((v * h).astype(np.int64), 0, h - 1)
# 블렌더는 PNG 를 선형으로 올린다 — 단추 눈은 선형 0.01 아래, 코랄 펠트는 0.15~0.3 이라 잘 갈린다
luma = px[yi, xi, 0] * 0.2126 + px[yi, xi, 1] * 0.7152 + px[yi, xi, 2] * 0.0722
앞면 = nrm[:, 1] < -0.2            # 같은 UV 가 뒤통수에도 걸린다 — 정면만 고른다
마스크 = (luma < 문턱) & 앞면
print(f"[눈 고르기] 어두운 정면 정점 {int(마스크.sum())} / 전체 {n} (문턱 {문턱})")

원래전체 = co.copy()
움직인전체 = np.zeros(n, dtype=bool)
# 눈은 둘이다 — 좌우를 갈라 각자 메운다(한 벌로 두 눈을 덮으면 곡률이 평균돼 둘 다 틀린다).
# 🔑 «구 맞춤»은 기각(2차 실측 08-15): 좁은 고리에 구를 맞추면 반지름이 0.17~0.25 로 튀어
#    (머리 반지름은 0.5) 절반이 도로 안으로 파였다. 접평면에서 «이차곡면»을 맞추면 조건수가 좋다.
for 쪽, 고름 in (("왼", co[:, 0] < 0), ("오른", co[:, 0] >= 0)):
    씨 = np.nonzero(마스크 & 고름)[0]
    if len(씨) < 20:
        continue
    c0 = co[씨].mean(axis=0)
    n0 = nrm[씨].mean(axis=0)
    n0 /= np.linalg.norm(n0)
    t1 = np.cross(n0, [0.0, 0.0, 1.0])
    t1 /= np.linalg.norm(t1)
    t2 = np.cross(n0, t1)
    q = co - c0
    aa, bb, dd = q @ t1, q @ t2, q @ n0
    ρ = np.hypot(aa, bb)
    R = float(np.percentile(ρ[씨], 95))          # 단추 반지름(정점 밀도와 무관한 «길이» 자)
    # ⚠ 접평면 반지름 ρ 만으로 고르면 «돌아 들어간 표면»(옆·아래)이 작은 ρ 로 딸려 온다 —
    #   3차원 거리와 법선 각으로 «이 눈 언저리»만 남긴다(1차 실측: 안 그러면 잔차 0.19 로 터진다).
    근처 = (np.linalg.norm(q, axis=1) < R * 4.2) & ((nrm @ n0) > 0.4)
    링 = 근처 & (ρ > R * 고리안) & (ρ < R * 고리밖)  # 곡률을 읽을 «성한» 고리(돌기 치마 바깥)
    if 링.sum() < 100:
        print(f"  🔴 {쪽}: 고리 정점 {int(링.sum())} — 너무 적다, 건너뛴다")
        continue
    def 곡면(sel, kk):
        return np.column_stack([np.ones(int(np.count_nonzero(sel))), aa[sel], bb[sel],
                                aa[sel] ** 2, aa[sel] * bb[sel], bb[sel] ** 2]) @ kk
    M = np.column_stack([np.ones(int(링.sum())), aa[링], bb[링], aa[링] ** 2, aa[링] * bb[링], bb[링] ** 2])
    k, *_ = np.linalg.lstsq(M, dd[링], rcond=None)
    잔차 = np.abs(M @ k - dd[링])
    # 돌기 «치마»가 어디까지인지 잰다 — 자리를 짐작해 자르면 경계에 턱이 남는다(2차 실측: 테두리 크랙).
    높이 = dd - 곡면(np.ones(n, dtype=bool), k)   # 성한 곡면 위로 얼마나 솟았나
    R치마 = R * 넓힘배
    for 배 in np.arange(넓힘배, 3.0, 0.05):
        띠 = 근처 & (ρ > R * 배) & (ρ < R * (배 + 0.15))
        if 띠.sum() >= 30 and 높이[띠].mean() > 0.0015:
            R치마 = R * (배 + 0.15)
    # ⚠ 채울 자리엔 법선 조건을 걸지 «않는다» — 단추 «옆벽»은 법선이 옆을 보므로 조건을 걸면
    #   벽만 남아 테두리에 크랙이 생긴다(3차 실측 08-15: 무지 렌더에 또렷한 고리 자국).
    안 = 고름 & (np.linalg.norm(q, axis=1) < R * 4.2) & (ρ < R치마 * 1.25)
    i안 = np.nonzero(안)[0]
    새d = 곡면(안, k)
    # 경계는 «갈아 끼우지» 말고 녹여 잇는다 — 안쪽 1.0 → 바깥 0.0 으로 부드럽게(턱 0)
    x = np.clip((ρ[i안] - R치마) / max(R치마 * 0.25, 1e-6), 0.0, 1.0)
    가중 = 1.0 - (x * x * (3.0 - 2.0 * x))
    d새 = dd[i안] * (1.0 - 가중) + 새d * 가중
    # 법선 방향으로만 옮긴다 — 접선 성분(a·b)은 그대로라 UV·사진 자리가 안 밀린다
    co[i안] = c0 + aa[i안, None] * t1 + bb[i안, None] * t2 + d새[:, None] * n0
    움직인전체[i안] = True
    print(f"  [{쪽}눈] 단추 반지름 {R:.4f} · 돌기 치마 {R치마:.4f} · 솟음 최대 {높이[안].max():.4f} · "
          f"메운 정점 {len(i안)} · 고리 {int(링.sum())} · 곡면 잔차 평균 {잔차.mean():.4f}·최대 {잔차.max():.4f}")

움직임 = np.nonzero(움직인전체)[0]
if not len(움직임):
    raise SystemExit("🔴 메운 정점이 0 — 문턱·사진을 확인한다(평탄화 안 함)")

# 마무리 다림질 — 단추 자리의 «접힘·겹침»(마칭큐브가 남긴 얇은 주름)은 위치를 옮겨도 안 펴진다.
# 곡면이 이미 모양을 정했으니 몇 번만 돌린다(많이 돌리면 1차 실측의 웅덩이로 되돌아간다).
edges = np.empty(len(me.edges) * 2, dtype=np.int64)
me.edges.foreach_get("vertices", edges)
edges = edges.reshape(-1, 2)
ea = np.concatenate([edges[:, 0], edges[:, 1]])
eb = np.concatenate([edges[:, 1], edges[:, 0]])
o = np.argsort(ea, kind="stable")
ea, eb = ea[o], eb[o]
시 = np.searchsorted(ea, np.arange(n), side="left")
끗 = np.searchsorted(ea, np.arange(n), side="right")
이웃목록 = np.concatenate([eb[시[i]:끗[i]] for i in 움직임])
차수 = (끗[움직임] - 시[움직임]).astype(np.float64)
주인 = np.repeat(np.arange(len(움직임)), (끗[움직임] - 시[움직임]))
합 = np.empty((len(움직임), 3))
for _ in range(6):
    for ax in range(3):
        합[:, ax] = np.bincount(주인, weights=co[이웃목록, ax], minlength=len(움직임))
    co[움직임] = 0.6 * co[움직임] + 0.4 * (합 / 차수[:, None])
이동 = np.linalg.norm(co[움직임] - 원래전체[움직임], axis=1)
안쪽 = np.einsum("ij,ij->i", co[움직임] - 원래전체[움직임], nrm[움직임])
print(f"[메움] 최대 이동 {이동.max():.4f} · 평균 {이동.mean():.4f} (= 돌기 높이) · "
      f"안으로 {(안쪽 < -0.004).sum()}정점 파임 (웅덩이 재발 감시 — 크게 나오면 고리를 넓힌다)")

me.vertices.foreach_set("co", co.astype(np.float32).ravel())
me.update()
# 커스텀 스플릿 노멀은 정점을 옮겨도 «옛 모양»을 그대로 들고 있다 — 지우지 않으면 메운 자리가
# 여전히 돌기처럼 셰이딩되고, 내보낼 때 정점이 코너마다 쪼개져 6배로 분다(실측 316k→1.89M).
try:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
except Exception as e:
    print("  (스플릿 노멀 지우기 건너뜀:", e, ")")
bpy.ops.object.shade_smooth()

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(filepath=출력, export_format="GLB", use_selection=True)
print("평탄 OK →", 출력)
