# 6번 12번 시작 그림 다시(2026-11-07, Claude · 유호님 「12번 다시 내기」) — 원본처럼 밤 거실에서 엄마가 보이게.
#   python -X utf8 다시_12_그림.py [--벌 2] [--실행]   → git 밖 콘티/p6/다시굽기_1107/S12w_<n>.png
# 까닭: 영상 시작 그림 S12v3는 콘티 때 「스탠드만 빛 · 얼굴은 그늘」로 일부러 어둡게 편집한 판이라, 편집본에서 엄마가 거의 실루엣이었다.
#   원본 첫 장과 재 보니 엄마 자리 밝기는 거의 같고(L 4.9 ↔ 5.0) 차이는 옷 색이었다 — 원본은 채도 높은 빨간 윗옷(채도 8.9), 우리는 어두운 자줏빛(1.9).
#   그래서 밝기를 통째로 올리지 않고 카디건만 짙은 빨강으로, 스탠드 빛이 얼굴 · 손에 조금 더 닿게 한다(밤 어둠 · 문 밑 불빛 · 구도는 그대로).
# 모델: 이 편 그림을 구운 나노바나나 2.1(드리미나 울트라 칸 — `jm_image_model_gg_bp_21`, i2i), 한 번에 한 가지씩 바꾸게 쓰던 콘티 방식 그대로.
import json
import os
import subprocess
import sys

HOME = os.path.join(os.path.expanduser("~"), ".ai-tools", "dreamina-canvas")
EXE = os.path.join(HOME, "dreamina-canvas.exe")
PROFILE = "ultra"
PROJECT = open(os.path.join(HOME, f"캔버스_{PROFILE}.txt"), encoding="utf-8").read().strip()   # 공개 저장소라 캔버스 id는 git 밖
ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p6"
SRC = os.path.join(ROOT, "컷", "S12.jpg")            # 지금 영상 시작 그림(S12v3를 16:9로 자른 판)
OUT = os.path.join(ROOT, "다시굽기_1107")
MODEL = "jm_image_model_gg_bp_21"
CEILING = 40

PROMPT = ("Edit {{IMG}} and keep everything else exactly as it is — the same framing and camera, the same dark night living room, the same furniture, piano, "
          "photo frames, plant, sofa, door and wall picture, the same warm table lamp on the right and the same thin line of warm light under the closed bedroom door, "
          "and the same Korean woman in her forties sitting on the piano bench at the left in the same pose, turned toward the closed door, hands on her knees.\n"
          "Change only two things:\n"
          "1. Her cardigan becomes a deep, rich red knit cardigan — a warm crimson-red that clearly stands out against the dark piano behind her, "
          "like a red top seen in a dim room at night (not neon, not glowing).\n"
          "2. A little more of the table lamp's warm light reaches her, so her face, the red cardigan and her hands are softly readable — "
          "it is still a dim, quiet night: the rest of the room stays as dark as it is now, no new lights, no brightening of the walls or the ceiling.\n"
          "Do not change her face, hair, age or body; do not add any person, object, text or logo; keep the photo's natural film grain and colors.")


def cli(*args, check=True, timeout=1800):
    r = subprocess.run([EXE, "--profile", PROFILE, "--format", "json", "--non-interactive", *args], capture_output=True, text=True, encoding="utf-8", timeout=timeout)
    try:
        j = json.loads(r.stdout or r.stderr)
    except ValueError:
        raise RuntimeError(f"CLI 답을 못 읽음: {(r.stdout or r.stderr)[:300]}")
    if check and not j.get("ok"):
        raise RuntimeError(json.dumps(j.get("error") or j, ensure_ascii=False)[:600])
    return j


def result_of(data):   # 드리미나내기.py result_of와 같은 꼴
    it = data.get("node") and data or ((data.get("items") or [{}])[0])
    sub = it.get("submission") or data.get("submission") or {}
    res = sub.get("resources") or []
    rid = next((r.get("resourceId") for r in res if r.get("state") == "succeeded"), None)
    return sub.get("submitId"), rid, sub.get("state"), it


def main():
    a = sys.argv[1:]
    n = int(a[a.index("--벌") + 1]) if "--벌" in a else 2
    os.makedirs(OUT, exist_ok=True)
    print(f"시작 그림 {SRC} · 모델 {MODEL} · {n}벌 · 벌마다 상한 {CEILING}크레딧")
    if "--실행" not in a:
        print("미리 보기만 했다 — 내려면 --실행\n" + PROMPT)
        return
    rid_src = cli("resource", "upload", "--file", SRC, "--project-id", PROJECT, "--name", "p6_S12_시작")["data"]["resourceId"]
    prompt = PROMPT.replace("{{IMG}}", "{{res:%s}}" % rid_src)
    for k in range(1, n + 1):
        made = cli("node", "create", "image", "--model", MODEL, "--mode", "i2i", "--ref", f"res:{rid_src}", "--prompt", prompt, "--ratio", "16:9",
                   "--resolution", "2K", "--title", f"p6-S12w-{k}", "--project-id", PROJECT, "--run", "--credit-ceiling", str(CEILING), "--wait", "--timeout", "20m", check=False)
        submit, rid, state, raw = result_of(made.get("data") or made.get("partialData") or {})
        if not rid:
            print(f"벌 {k}: 못 받음 · {state} · {json.dumps(made.get('error') or raw, ensure_ascii=False)[:300]}")
            continue
        dst = os.path.join(OUT, f"S12w_{k}.png")
        cli("resource", "download", rid, "--project-id", PROJECT, "-o", dst, timeout=300)
        print(f"벌 {k}: {dst} · submit {submit}")


if __name__ == "__main__":
    main()
