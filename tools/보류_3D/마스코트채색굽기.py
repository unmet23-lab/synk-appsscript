# 마스코트 채색 굽기 — TRELLIS.2 익명 gradio API 로 누끼 → «텍스처 입힌» 형상 GLB.
#
# 왜 있나: Hunyuan3D-2.1 의 텍스처(/generation_all)는 익명 GPU 한도(270s) 초과 = 로그인 층이라 막혔다.
#   microsoft/TRELLIS.2 는 형상+텍스처를 한 세션 통로(/start_session→/preprocess_image→/image_to_3d→
#   /extract_glb)로 굽고 익명 API 가 열려 있다(08-15 실측). 텍스처가 메시에 구워져 오면
#   투영 인형의 요 ±13° 한계(옆면 늘어짐)가 원리적으로 사라진다 — 큰 턴·제스처의 재료.
#
# 정본 통로: ①입력은 «누끼»(투명 배경 PNG — TRELLIS preprocess 는 기존 알파를 존중한다)
#   ②시드 고정(기본 1234 — 같은 입력이면 같은 결과) ③네 endpoint 를 «같은 Client»로 부른다
#   (형상→추출 사이 상태가 세션에 산다 — Client 를 새로 만들면 상태가 끊긴다).
# ⚠ 대가: 익명 GPU 한도에 걸리면 죽는다 — 그때는 시간을 두고 다시 부르거나 HF 로그인 층으로 간다.
#   큐에 밀리면 수 분이 통짜로 걸린다(predict 는 진행 표시를 안 준다). 실패는 폴백 없이 정지로.
#
# 사용법: python tools/마스코트채색굽기.py <누끼.png> <출력.glb> [시드] [--모델 trellis|hunyuan]
#         [--좌 <¾좌.png>] [--우 <¾우.png>]   ← hunyuan 전용 멀티뷰(모델이 옆면을 «상상» 대신 «본다»)
import json, shutil, sys, os
from gradio_client import Client, handle_file

argv = [a for a in sys.argv[1:]]
def 옵션(이름, 기본=None):
    if 이름 in argv:
        i = argv.index(이름)
        v = argv[i + 1]
        del argv[i:i + 2]
        return v
    return 기본
MODEL = (옵션("--모델", "trellis") or "trellis").lower()
MV = {k: 옵션(f"--{k}") for k in ("좌", "우", "뒤")}
if len(argv) < 2:
    sys.exit("사용법: python tools/마스코트채색굽기.py <누끼.png> <출력.glb> [시드] [--모델 trellis|hunyuan] [--좌 …] [--우 …]")
IMG, OUT = argv[0], argv[1]
SEED = int(argv[2]) if len(argv) > 2 else 1234

# 로그인 층 자동 감지 — env HF_TOKEN 이 먼저, 없으면 `hf auth login` 이 저장한 토큰.
# 익명은 GPU 몫 0 실측(08-15)이라 토큰이 서는 날 이 스크립트가 그대로 로그인 층을 탄다.
TOKEN = os.environ.get("HF_TOKEN")
if not TOKEN:
    try:
        from huggingface_hub import get_token
        TOKEN = get_token()
    except ImportError:
        pass
print(f"[채색굽기] HF 토큰: {'있음(로그인 층)' if TOKEN else '없음(익명 — GPU 몫 0이면 여기서 죽는다)'}")

# ⚠ 인자명은 `token` 이다 — `hf_token` 은 gradio_client 2.6.0 에서 TypeError(실측 08-15).
SPACE = {"trellis": "microsoft/TRELLIS.2", "hunyuan": "tencent/Hunyuan3D-2.1"}.get(MODEL)
if not SPACE:
    sys.exit(f"모르는 모델: {MODEL} (trellis|hunyuan)")
client = Client(SPACE, token=TOKEN)
api = client.view_api(return_format="dict", print_info=False)
eps = api.get("named_endpoints", {})
필수 = ("/generation_all",) if MODEL == "hunyuan" else ("/start_session", "/preprocess_image", "/image_to_3d", "/extract_glb")
for need in 필수:
    if need not in eps:
        sys.exit(f"Space API 가 바뀌었다 — {need} 가 없다. view_api 로 새 표면부터 잰다.")

def 기본채우기(name, override):
    """endpoint 파라미터를 API 명세의 기본값으로 채우고 override 만 바꾼다 — 명세가 바뀌면 여기가 따라간다."""
    kwargs = {}
    for p in eps[name]["parameters"]:
        pname = p.get("parameter_name")
        if pname is None:
            continue
        if pname in override:
            kwargs[pname] = override[pname]
        elif p.get("parameter_has_default"):
            kwargs[pname] = p.get("parameter_default")
    return kwargs

if MODEL == "hunyuan":
    # 🔑 rembg=False — True 면 우리 알파를 뭉개 배경 판이 메시에 통째 동봉된다(실증 ad6d9bf9).
    ov = {"image": handle_file(IMG), "seed": SEED, "check_box_rembg": False, "randomize_seed": False}
    for 슬롯, 키 in (("좌", "mv_image_left"), ("우", "mv_image_right"), ("뒤", "mv_image_back")):
        if MV.get(슬롯):
            ov[키] = handle_file(MV[슬롯])
            ov["mv_image_front"] = handle_file(IMG)
    쓴멀티뷰 = [k for k in ("mv_image_left", "mv_image_right", "mv_image_back") if k in ov]
    print(f"[채색굽기] {SPACE} /generation_all · 시드={SEED} · 멀티뷰={쓴멀티뷰 or '없음(단일)'} (수 분 걸린다)")
    res = client.predict(api_name="/generation_all", **기본채우기("/generation_all", ov))
else:
    client.predict(api_name="/start_session")
    pre = client.predict(api_name="/preprocess_image", **기본채우기("/preprocess_image", {"input": handle_file(IMG)}))
    pre_path = pre if isinstance(pre, str) else (pre.get("path") if isinstance(pre, dict) else None)
    if not pre_path or not os.path.exists(pre_path):
        print("preprocess 결과 원문:", json.dumps(pre, default=str)[:500])
        sys.exit("전처리 이미지를 못 받았다 — 0건이 아니라 못 잼이다")
    print(f"[채색굽기] 전처리 OK · 시드={SEED} · /image_to_3d 호출(수 분 걸릴 수 있다)")

    client.predict(api_name="/image_to_3d", **기본채우기("/image_to_3d", {
        "image": handle_file(pre_path), "seed": SEED,
    }))
    print("[채색굽기] 형상+텍스처 생성 OK · /extract_glb 호출")

    res = client.predict(api_name="/extract_glb", **기본채우기("/extract_glb", {}))

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
print(f"[채색굽기] 저장: {OUT}  {os.path.getsize(OUT)//1024}KB")
