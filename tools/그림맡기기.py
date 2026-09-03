# -*- coding: utf-8 -*-
"""그림맡기기 — 그림 한 장을 «허깅페이스의 남의 기계»에 맡겨 고쳐 받는 통로 하나.

■ 왜 있나 (2026-09-03 · 유호 지시 「허깅페이스 space 이것저것 시도해보자」)
  누끼·확대·각도·펠트로 바꾸기는 그동안 손으로 하거나 블렌더로 구웠다. 남의 Space 가
  30초에 해 주는 것이 있으면 그걸 쓴다. 문제는 «어느 Space 가 살아 있고, 어떤 칸을
  받는가»가 매번 달라진다는 것 — 그 앎이 흩어지면 다음 세션이 처음부터 다시 찾는다.
  ⇒ 이 파일이 그 앎의 «한 곳»이다. 아래 일감표가 전부이고, 손으로 적는 값도 거기뿐이다.

■ 🔴 이 통로가 틀릴 때의 모습 = **Space 가 죽었는데 「기능이 없다」고 읽는 것.**
  Space 는 남의 것이라 예고 없이 멈춘다(오늘도 후보 넷 중 둘이 RUNTIME_ERROR 였다).
  그래서 실패를 «우리 쪽 결함»이 아니라 «남의 기계가 멈춤»으로 구별해 낸다.

■ ⚠ 나가는 것 — 그림 한 장이 남의 서버로 올라간다.
  🚫 학생을 식별하는 그림은 절대 넣지 않는다. 마스코트·부품·아이콘 같은 우리 자산만.
  🔑 열쇠는 ~/.cache/huggingface/token 에서 읽는다(화면에 안 찍는다 · git 에 안 넣는다).
  💳 유호님 PRO 의 무료 그래픽카드 시간에서 나간다 — 한도가 차면 기다렸다 다시 부른다.

■ 딸린 것: pip install gradio_client pillow

쓰는 법:
  python tools/그림맡기기.py --일감            일감표를 낸다(무엇이 되나)
  python tools/그림맡기기.py --살았나          Space 들이 지금 도는지만 잰다
  python tools/그림맡기기.py 누끼   <그림> [낼곳]
  python tools/그림맡기기.py 확대   <그림> [낼곳]          4배 · 털결 살린다
  python tools/그림맡기기.py 각도   <그림> [낼곳] --말 "Rotate the camera 90 degrees to the right."
  python tools/그림맡기기.py 펠트   <그림> [낼곳] --말 "<무엇으로 만들지>"
"""
import sys, os, io, json, base64, pathlib, shutil, argparse, traceback

방 = pathlib.Path(__file__).resolve().parent


def 토큰():
    p = pathlib.Path.home() / ".cache" / "huggingface" / "token"
    return p.read_text(encoding="utf-8").strip() if p.exists() else None


# ── 일감표 ────────────────────────────────────────────────────────────────
# 「잰 것」은 2026-09-03 에 실제로 돌려 보고 적은 것이다. 인상이 아니라 실측이다.
일감 = {
    "누끼": {
        "space": "not-lain/background-removal", "api": "/png", "칸": "그림하나",
        "설명": "배경을 지운다(투명하게)",
        "잰것": "9.2초. 지금 쓰는 누끼보다 «보풀»을 더 남긴다 — 펠트에는 그게 낫다.",
    },
    "확대": {
        "space": "Phips/Upscaler", "api": "/upscale_image", "칸": "확대",
        "설명": "4배로 키운다 — 털 결을 «지어내서» 채운다",
        "기본모델": "4xNomosWebPhoto_atd",
        "잰것": "256픽셀 아바타 → 1024픽셀. 그냥 늘린 것과 견주면 차이가 크다(털 올이 산다).",
    },
    "각도": {
        "space": "Qdpie/Qdpie-Qwen-Image-Editor", "api": "/infer", "칸": "b64묶음",
        "로라": "Multiple-Angles",
        "설명": "카메라를 돌린다 — 옆모습·뒷모습",
        "잰것": "90도는 진짜 옆얼굴이 나온다(눈 하나만 보인다). 45도는 약하고, 왼쪽 45도는 거의 안 돈다. "
                "🔴 색이 밀린다 — 90도에서 몸통 평균색이 기준에서 58만큼(어두워진다).",
    },
    "펠트": {
        "space": "Qdpie/Qdpie-Qwen-Image-Editor", "api": "/infer", "칸": "b64묶음",
        "로라": "none",
        "설명": "반드르르한 3D 물건을 «펠트»로 바꾼다",
        "잰것": "🔴 결 견본 그림을 «붙이면 오히려 망한다» — 내용 그림을 버리고 견본을 그린다. "
                "말로만 시키는 쪽이 이겼다(모양·꼬리표까지 지키고 보풀이 산다).",
    },
}

죽은것 = {
    "multimodalart/Apply-Texture-Qwen-Image-Edit": "2026-09-03 RUNTIME_ERROR",
    "akhaliq/extract_texture_qwen_image_edit_2509": "2026-09-03 RUNTIME_ERROR",
}


def 잇기(space):
    from gradio_client import Client
    return Client(space, token=토큰(), verbose=False)


def b64(경로, 최대=1024):
    from PIL import Image
    im = Image.open(경로).convert("RGB")
    im.thumbnail((최대, 최대))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def 훑기(x, 통):
    if isinstance(x, str) and os.path.isfile(x):
        통.append(x)
    elif isinstance(x, dict):
        for w in x.values():
            훑기(w, 통)
    elif isinstance(x, (list, tuple)):
        for w in x:
            훑기(w, 통)


def 한판(이름, 그림, 낼곳, 말, 모델):
    from gradio_client import handle_file
    j = 일감[이름]
    c = 잇기(j["space"])
    if j["칸"] == "그림하나":
        결과 = c.predict(handle_file(그림), api_name=j["api"])
    elif j["칸"] == "확대":
        결과 = c.predict(image=handle_file(그림),
                         model_selection=모델 or j["기본모델"], api_name=j["api"])
    else:
        결과 = c.predict(images_b64_json=json.dumps([b64(그림)]), prompt=말,
                         lora_adapter=j["로라"], seed=7, randomize_seed=False,
                         guidance_scale=1.0, steps=8, aspect_ratio="original",
                         image_size="original", prompt_pack="none", api_name=j["api"])
    통 = []
    훑기(결과, 통)
    if not 통:
        print("   ❌ 파일이 안 왔다 — 남의 기계가 답은 했는데 그림을 안 줬다.")
        return 1
    # 여러 장이 오면 «가장 큰 것»이 원본 화질이다(작은 것은 미리보기다).
    통.sort(key=os.path.getsize, reverse=True)
    낼곳 = 낼곳 or str(pathlib.Path(그림).with_name(pathlib.Path(그림).stem + "_" + 이름 + pathlib.Path(통[0]).suffix))
    shutil.copy(통[0], 낼곳)
    print("   ✅ %s  (%.0f KB · 받은 것 %d장 중 가장 큰 것)" % (낼곳, os.path.getsize(낼곳) / 1024, len(통)))
    return 0


def 살았나():
    """돈다/멈췄다를 «세어» 낸다 — 0건이 성공 얼굴로 지나가지 않게 분모를 함께 적는다."""
    본것 = sorted({j["space"] for j in 일감.values()})
    죽음 = 0
    print("■ 지금 도는가 — 남의 기계라 예고 없이 멈춘다\n")
    for s in 본것:
        try:
            잇기(s)
            print("  ✅ %s" % s)
        except Exception as e:
            죽음 += 1
            print("  🔴 %s\n       %s" % (s, str(e)[:120]))
    print("\n  분모 %d = 도는 것 %d + 멈춘 것 %d" % (len(본것), len(본것) - 죽음, 죽음))
    if 죽은것:
        print("\n  🪦 전에 쓰려다 멈춰 있던 것 — 다시 살아났는지 궁금하면 여기부터")
        for s, 언제 in 죽은것.items():
            print("     %s  (%s)" % (s, 언제))
    return 1 if 죽음 else 0


def 일감보기():
    print("■ 맡길 수 있는 일 — 「잰 것」은 실제로 돌려 보고 적은 것이다\n")
    for 이름, j in 일감.items():
        print("  %s — %s" % (이름, j["설명"]))
        print("     맡기는 곳: %s %s" % (j["space"], j["api"]))
        print("     잰 것: %s\n" % j["잰것"])
    print("  ⚠ 학생을 식별하는 그림은 넣지 않는다 — 그림이 남의 서버로 올라간다.")
    return 0


def 본다(argv):
    p = argparse.ArgumentParser(add_help=False)
    p.add_argument("일", nargs="?")
    p.add_argument("그림", nargs="?")
    p.add_argument("낼곳", nargs="?")
    p.add_argument("--말", default="Rotate the camera 90 degrees to the right.")
    p.add_argument("--모델", default=None)
    p.add_argument("--일감", action="store_true")
    p.add_argument("--살았나", action="store_true")
    a = p.parse_args(argv)

    if a.일감 or not argv:
        return 일감보기()
    if a.살았나:
        return 살았나()
    if a.일 not in 일감:
        print("모르는 일이다: %r — 있는 것: %s" % (a.일, ", ".join(일감))); return 2
    if not a.그림 or not os.path.exists(a.그림):
        print("그림이 없다: %r" % a.그림); return 2
    if 토큰() is None:
        print("🔑 허깅페이스 열쇠가 없다 — 유호님 손으로 huggingface-cli login 하셔야 한다."); return 2
    print("■ %s — %s" % (a.일, 일감[a.일]["설명"]))
    return 한판(a.일, a.그림, a.낼곳, a.말, a.모델)


if __name__ == "__main__":
    try:
        sys.exit(본다(sys.argv[1:]))
    except Exception:
        traceback.print_exc(limit=3)
        print("\n🔴 남의 기계 쪽에서 끊겼을 수 있다 — python tools/그림맡기기.py --살았나 로 갈라 본다.")
        sys.exit(1)
