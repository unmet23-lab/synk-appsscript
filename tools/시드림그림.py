# 시드림 그림 — 영상 편의 그림(이미지 콘티 · 시작/끝 그림 · 정지컷 · 사람 없는 컷)을 Seedream 5.5로 굽는다.
#
# 왜: 2026-11-19 유호님 「앞으로 영상제작할때 시드림을 고정하자. 제미나이는 빼자」 — 색감 견본에서 같은 지시문을 Gemini 카본과
#   Seedream 5.5로 견주자 「전체적으로 확실히 시드림이 좋네」(만족 사례 S59 · 결정 11-19). 드리미나 CLI(dreamina-canvas)를 부른다.
#   굽는 법은 docs/마케팅/제작양식/영상양식/색감견본_유나_20261119/README.md 다섯째 판, 함정은 docs/현장노트/브라우저_게시.md
#   「unmet23의 Seedream 5.5 2K 30일 무제한은 웹에서만 된다」 절.
#
#   python -I -X utf8 tools/시드림그림.py <이름> <지시문.txt> --밖 <폴더> [--비율 3:4] [--장수 2] [--상한 <크레딧>]
#        [--참고 <그림> …] [--계정 unmet23] [--지시문만] [--해상도 1K|2K|4K]
#     · 시안(색감 견본 · 후보 · 콘티 확인용)은 --해상도 1K로 굽는다. 영상에 쓸 시작 그림만 2K(기본).
#     · 지시문의 「Images 1 to 4」 · 「Image N」은 참고 그림 순서대로 Seedream 참고 표기로 바꾼다(지시문 틀은 Gemini 때와 같다).
#     · --상한을 주지 않으면 장수 × 9(2K 한 장 9크레딧)로 낸다. 0이면 견적만 받고 내지 않는다.
#     · --지시문만: 드리미나를 부르지 않고 바꾼 지시문만 찍는다(시험 · 확인용).
#   받은 그림은 <폴더>/<이름>_<n>.png. 끝 코드 0 받음 · 1 못 받음 · 2 잘못 부름.
import argparse, json, os, re, subprocess, sys, time

HOME = os.path.join(os.path.expanduser("~"), ".ai-tools", "dreamina-canvas")
EXE = os.path.join(HOME, "dreamina-canvas.exe")
장당 = 9


def 참고표기(글, n):
    """「Images 1 to 4」 · 「Images 1 and 2」 · 「Image 5」를 [IMG1] … 로 바꾼다. n은 참고 그림 수."""
    def 여럿(m):
        a, b = int(m.group(1)), int(m.group(2))
        return ", ".join(f"[IMG{k}]" for k in range(a, b)) + f" and [IMG{b}]" if b > a else f"[IMG{a}]"
    글 = re.sub(r"\bImages (\d+) (?:to|and) (\d+)\b", 여럿, 글)
    글 = re.sub(r"\bImage (\d+)\b", lambda m: f"[IMG{m.group(1)}]", 글)
    없는 = sorted({int(k) for k in re.findall(r"\[IMG(\d+)\]", 글) if int(k) > n})
    if 없는:
        raise SystemExit(f"지시문이 참고 그림 {없는}번을 부르는데 참고는 {n}장이다")
    return 글


def cli(계정, *a, check=True, timeout=1800):
    r = subprocess.run([EXE, "--profile", 계정, "--format", "json", "--non-interactive", *a],
                       capture_output=True, text=True, encoding="utf-8", timeout=timeout)
    j = json.loads(r.stdout or r.stderr)
    if check and not j.get("ok"):
        raise RuntimeError(json.dumps(j.get("error") or j, ensure_ascii=False)[:800])
    return j


def 올림(계정, 캔버스, p, 이름, 임시):
    from PIL import Image
    if os.path.getsize(p) > 3_000_000 or p.lower().endswith(".png"):
        jpg = os.path.join(임시, os.path.splitext(os.path.basename(p))[0] + "_올림.jpg")
        im = Image.open(p).convert("RGB"); im.thumbnail((2048, 2048)); im.save(jpg, quality=93)
        p = jpg
    return cli(계정, "resource", "upload", "--file", p, "--project-id", 캔버스, "--name", 이름)["data"]["resourceId"]


def main():
    ap = argparse.ArgumentParser(description="Seedream 5.5 그림 굽기(드리미나 CLI)")
    ap.add_argument("이름"); ap.add_argument("지시문")
    ap.add_argument("--밖", required=True); ap.add_argument("--비율", default="3:4")
    ap.add_argument("--장수", type=int, default=2); ap.add_argument("--상한", type=int)
    ap.add_argument("--참고", nargs="*", default=[]); ap.add_argument("--계정", default="unmet23")
    ap.add_argument("--지시문만", action="store_true")
    # 시안(색감 견본 · 후보 고르기 · 콘티 확인용)은 1K로 굽는다 — 11-19 유호님 「이런 시안때는 2k로 쓸 필요 전혀 없어. 크레딧 아껴」. 영상에 쓸 시작 그림만 2K.
    ap.add_argument("--해상도", default="2K", choices=["1K", "2K", "4K"])
    a = ap.parse_args()
    글 = open(a.지시문, encoding="utf-8").read().replace("\r\n", "\n").strip()
    글 = 참고표기(글, len(a.참고))
    if a.지시문만:
        print(글); return 0
    상한 = a.장수 * 장당 if a.상한 is None else a.상한
    캔버스 = open(os.path.join(HOME, f"캔버스_{a.계정}.txt"), encoding="utf-8").read().strip()
    os.makedirs(a.밖, exist_ok=True); 임시 = os.path.join(a.밖, "_올림"); os.makedirs(임시, exist_ok=True)
    ids = [올림(a.계정, 캔버스, p, f"{a.이름}_ref{k}", 임시) for k, p in enumerate(a.참고, 1)]
    for k, rid in enumerate(ids, 1):
        글 = 글.replace(f"[IMG{k}]", "{{res:%s}}" % rid)
    args = ["node", "create", "image", "--model", "seedream_5.5", "--mode", "i2i" if ids else "t2i"]
    for rid in ids:
        args += ["--ref", f"res:{rid}"]
    args += ["--prompt", 글, "--ratio", a.비율, "--resolution", a.해상도, "--count", str(a.장수), "--title", a.이름,
             "--project-id", 캔버스, "--run", "--credit-ceiling", str(상한), "--wait", "--timeout", "20m"]
    print(a.이름, "참고", len(ids), "장 · 지시문", len(글), "자 · 상한", 상한, "크레딧", flush=True)
    rids = []
    for 번 in (1, 2, 3):
        made = cli(a.계정, *args, check=False)
        json.dump(made, open(os.path.join(임시, f"_{a.이름}_답{번}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        data = made.get("data") or made.get("partialData") or {}
        it = data.get("node") and data or ((data.get("items") or [{}])[0])
        sub = it.get("submission") or data.get("submission") or {}
        rids = [r.get("resourceId") for r in (sub.get("resources") or []) if r.get("state") == "succeeded"]
        if rids:
            break
        err = made.get("error") or {}
        print(a.이름, "못 받음", 번, json.dumps(err, ensure_ascii=False)[:600], flush=True)
        if not err.get("retryable") or 상한 == 0:
            break
        time.sleep(45)
    for k, rid in enumerate(rids, 1):
        dst = os.path.join(a.밖, f"{a.이름}_{k}.png")
        cli(a.계정, "resource", "download", rid, "--project-id", 캔버스, "-o", dst, timeout=300)
        print(a.이름, dst, flush=True)
    return 0 if rids else 1


if __name__ == "__main__":
    sys.exit(main())
