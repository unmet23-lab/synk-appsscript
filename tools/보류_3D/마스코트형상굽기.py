# 마스코트 형상 굽기 — Hunyuan3D-2.1 익명 gradio API 로 누끼 → 형상 GLB (0원 · 실증 ad6d9bf9).
#
# 정본 통로: ①입력은 «누끼»(투명 배경 PNG — 회색 판이 메시에 동봉되는 실측) ②check_box_rembg=False
# (True 면 우리 알파를 뭉갠다) ③시드 고정(기본 1234 — 같은 입력이면 같은 형상).
# ⚠ 대가: 익명 GPU 한도에 걸리면 죽는다(로그인 층은 텍스처 API 쪽) — 그때는 시간을 두고 다시 부른다.
#
# 사용법: python tools/마스코트형상굽기.py <누끼.png> <출력.glb> [시드]
import json, shutil, sys, os
from gradio_client import Client, handle_file

if len(sys.argv) < 3:
    sys.exit("사용법: python tools/마스코트형상굽기.py <누끼.png> <출력.glb> [시드]")
IMG, OUT = sys.argv[1], sys.argv[2]
SEED = int(sys.argv[3]) if len(sys.argv) > 3 else 1234

client = Client("tencent/Hunyuan3D-2.1")
api = client.view_api(return_format="dict", print_info=False)
eps = api.get("named_endpoints", {})
name = "/shape_generation" if "/shape_generation" in eps else next(iter(eps))
params = eps[name]["parameters"]

kwargs = {}
img_slot = None
for p in params:
    pname = p.get("parameter_name")
    if pname is None:
        continue
    low = pname.lower()
    if "image" in low and "mv" not in low and img_slot is None and p.get("parameter_default") is None:
        kwargs[pname] = handle_file(IMG)
        img_slot = pname
    elif low == "seed":
        kwargs[pname] = SEED
    elif "rembg" in low:
        kwargs[pname] = False
    elif "randomize" in low:
        kwargs[pname] = False
    elif p.get("parameter_has_default"):
        kwargs[pname] = p.get("parameter_default")
print(f"[형상굽기] {name} · 이미지 슬롯={img_slot} · 시드={SEED}")

res = client.predict(api_name=name, **kwargs)

def glb찾기(o):
    if isinstance(o, str) and o.lower().endswith(".glb"):
        return o
    if isinstance(o, dict):
        for v in o.values():
            r = glb찾기(v)
            if r: return r
    if isinstance(o, (list, tuple)):
        for v in o:
            r = glb찾기(v)
            if r: return r
    return None

glb = glb찾기(res)
if not glb:
    print("결과 원문:", json.dumps(res, default=str)[:2000])
    sys.exit("GLB 경로를 결과에서 못 찾았다 — 0건이 아니라 못 잼이다")
shutil.copy(glb, OUT)
print(f"[형상굽기] 저장: {OUT}  {os.path.getsize(OUT)//1024}KB")
