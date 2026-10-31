# 로맨스 단편 「다 비침」 태준 = 유호님(10-31 「후보 B로」, 결정 표 · 장부 S38) — 확정 구도는 그대로 두고 사람만 다시 굽는 두 단계.
#   1 바탕: 확정 정지컷에서 태준 머리만 흐린 판(구도 · 벽 색 · 빛, 장부 S33) + 고정 얼굴 세트 + 콘로우 머리로 장면을 새로 굽는다 → 콘티/romance/유호/바탕/<컷>.png
#   2 머리: 바탕을 Image 1로 두고 머리만 가르마로 한 번 편집한다(얼굴은 콘로우 판 그대로) → 콘티/romance/유호/머리/<컷>.png
#   python -X utf8 이미지콘티_태준.py 흐림 [컷…]              → 유호/구도/<컷>.png · 유호/구도_한눈.jpg
#   python -X utf8 이미지콘티_태준.py 작업                    → 유호/작업.json(바탕 · 뒷모습) · 지시문/이미지콘티_태준.json(저장소 사본, 참고는 이름만)
#   python -X utf8 이미지콘티_태준.py 굽기 바탕 [컷…] [--다시] → Codex 구독 경로(이미지콘티_구독굽기.cjs), 셋씩 동시에
#   python -X utf8 이미지콘티_태준.py 머리작업 [컷…]           → 바탕의 고개 방향을 재어 유호/머리작업.json
#   python -X utf8 이미지콘티_태준.py 굽기 머리 [컷…] [--다시]
#   python -X utf8 이미지콘티_태준.py 재기 [컷…]              → 유호/_재기.json · 실제 사진 · 승인 얼굴 · 콘로우 바탕과 닮음
#   python -X utf8 이미지콘티_태준.py 올리기 [컷…]            → 옛 판을 받음_M02 · 정지컷_M02에 두고 선버스트/받음 · 정지컷으로(그 뒤 이미지콘티_굽기.py 보드 · 가편집.py)
# 그대로 두는 컷: 아주 먼 컷(C01 · C01e · C26 · C62)과 손 인서트(C10 · C15 · C30 · C46 · C56 · C67), 태준이 흐린 어깨 · 뒤통수만인 유나 컷.
import json, shutil, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import cv2, numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 이미지콘티_지시문 as S
import 이미지콘티_닮음 as N

ROOT = HERE.parents[4]
V = S.V
OUT = V / "유호"
STILL = S.OUT / "정지컷"
FACE = Path(r"C:/Users/q1212/Videos/한강2126_새판_20261009/재촬영_v40/기준그림/얼굴세트")
HAIRSET = V / "유호머리"
YREF = [FACE / n for n in ("ref_Bface.png", "ref_Cface.png", "ref_pro02_face.png", "ref_V181_bright.png", "ref_V204_bright.png")]
YSIDE = {"L": [FACE / "옆얼굴_실제사진" / n for n in ("인터뷰_콘로우_L_52.5s.png", "인터뷰_콘로우_L_70.0s.png", "인터뷰_콘로우_L_101.5s.png")],
         "R": [FACE / "옆얼굴_실제사진" / n for n in ("인터뷰_콘로우_R_17.5s.png", "인터뷰_콘로우_R_137.0s.png", "인터뷰_콘로우_R_218.0s.png")]}

# 컷마다: wet = 비 맞은 뒤(결정 10-31 — 빗길 C18부터 시작 편 끝까지 · 밤 처마 밑 현재), soft = 시작 편 설렘(10-31 눈가림 — C05가 화난 사람 같다),
# side = 90°에 가까운 옆얼굴(실제 옆얼굴 사진을 그 방향으로 넣음, 장부 S33), back = 얼굴이 안 보이는 뒷모습이라 확정 판에서 머리만 편집,
# fg = 렌즈 앞에서 흐린 태준(흐림을 지키라고 따로 적는다 — 「흐림은 따라 하지 말 것」 줄이 C27을 또렷하게 그렸다)
T = {
    "C03": dict(wet=1, soft=1), "C05": dict(wet=1, soft=1), "C07": dict(soft=1), "C08": dict(soft=1), "C09": dict(soft=1), "C11": dict(soft=1),
    "C11e": dict(soft=1), "C12": dict(soft=1), "C13": dict(soft=1, side="L"), "C14": dict(soft=1), "C14e": dict(soft=1), "C17": dict(soft=1),
    "C18": dict(wet=1, back=1), "C18e": dict(wet=1, soft=1, side="R"), "C19": dict(wet=1, soft=1), "C20e": dict(wet=1, soft=1), "C22": dict(wet=1, soft=1, side="R"),
    "C23": dict(wet=1, soft=1, side="L"), "C25": dict(wet=1, soft=1), "C27": dict(wet=1, soft=1, side="L", fg=1), "C28": dict(wet=1, soft=1), "C31": dict(wet=1, soft=1),
    "C34": dict(wet=1, soft=1, side="R"),
    "C35": dict(back=1), "C37": {}, "C38": {}, "C39": {}, "C41": {}, "C42": {}, "C43": {}, "C43e": {}, "C45": {}, "C48": {}, "C49": dict(side="L"),
    "C50": dict(fg=1), "C50e": {}, "C51": {}, "C52": {}, "C53": {}, "C55": {}, "C58": {}, "C60": {}, "C63": {}, "C66": {},
    "C68": dict(side="R"), "C70": {},
}
# 웃음은 입 다문 미소까지(장부 공통 원칙 7, 웃는 얼굴은 아직 승인 컷이 없다)
TEXT = {"C14": ("Taejun laughs and raises one hand to wave it off", "Taejun gives a small awkward closed-lip smile and raises one hand to wave it off"),
        "C14e": ("Taejun (left) laughs and waves his raised LEFT hand in denial", "Taejun (left) gives a small awkward closed-lip smile and waves his raised LEFT hand in denial"),
        # 확정 C27은 뒤가 거리 · 가게 창이다(글의 흰 벽 줄을 따르지 않은 판을 유호님이 확정) — 첫 바탕이 글을 따라 분홍 벽으로 바꿔 버려 확정 판 쪽으로 맞춘다
        "C27": (S.NIGHT_WALL, "BACKGROUND (important): exactly as in the approved frame — behind her at the left the wet night street with the lit convenience-store "
                              "windows and the awning, softly out of focus, and a soft pink neon glow on the wall behind her at the right.")}

HIS_FACE = ("Images 1 and 2 show Taejun. HIS FACE: he is the exact same Korean man as in Images 1 and 2 — keep exactly that face in every detail. His skin is fair and "
            "bright with the natural warm undertone, not pale grey; a large soft light falls on his face from the front.")
HIS_HAIR = ("HAIR: exactly his own hair as in Images 1 and 2 — thin cornrow braids running straight back from the forehead, about ten rows, ending in short loose tails at the "
            "nape, not tied. No glasses.")
HIS_REAL = "{what} real photo{s} of him, for identity only — ignore {its} background and clothing."
HIS_SIDE = ("{what} real side-view photo{s} of him — follow {them} for the exact shape of his forehead, nose, lips and chin from the side, and ignore {its} background and "
            "clothing.")
FRAME = ("Image {n} is the approved frame of this exact shot: copy exactly its camera position, framing, the sizes and places of the people, their poses and hands, the "
         "clothes, every prop, the background, the wall color and the light. Taejun's head is blurred out on purpose — never copy that blur: his head goes exactly there, at "
         "the same size, with the same turn of the head and the same direction of the eyes. His body in Image {n} is a stand-in for the pose and the clothes only — he is "
         "slimmer and leaner. Do not zoom in, do not crop tighter and do not move the camera.")
FG = ("In this shot Taejun is very close to the lens and stays softly OUT OF FOCUS, like a real shallow-depth-of-field lens blur — his face is not sharp, "
      "and he stays exactly as big as in the approved frame; Yuna is the only sharp thing in the frame.")
SOFT = "His brows are relaxed and level, never furrowed or stern; his gaze is soft and a little shy — a quiet man who is trying not to show what he feels."
DAMP = "He has been in the rain: his skin is slightly damp, with a few fine raindrops on his temple and cheekbone."
REAL_Y = ("REAL PEOPLE, NOT MODELS: matte lips with natural lip texture — no gloss; natural real skin — not airbrushed, porcelain or plastic; natural eye size and real "
          "adult proportions. Keep every face exactly as in that person's identity reference photos.")
SIZE_Y = "Taejun is 180 cm with a slim lean build — not muscular — about 12 cm taller than Yuna (168 cm)."

CUT = "a classic side-part cut parted on his right side — short dark hair combed neatly across and slightly back with soft natural volume, short tapered sides"
WET = (" The hair is damp from the rain, slightly darker and a little flattened, and one clearly visible soft lock falls forward from the parting across his forehead, curving "
       "like a comma and ending just above his left eyebrow, exactly as in Image 2; the rest stays in place.")
WET_BACK = " The hair is damp from the rain, slightly darker and a little flattened."
FLAG = dict(H2=HAIRSET / "H2_가르마.png", B=HAIRSET / "세트" / "B가르마.png", R=HAIRSET / "세트" / "R45가르마.png", L=HAIRSET / "세트" / "L45가르마.png", W=HAIRSET / "세트" / "젖은쉼표.png")
# 손으로 잡은 머리 자리 — 정지컷 1920×1080에서 (가운데 x, 가운데 y, 반지름 x, 반지름 y)
HEAD = {"C07": (660, 510, 190, 170), "C18e": (765, 240, 170, 165), "C13": (900, 300, 570, 450), "C27": (1650, 300, 400, 520), "C68": (560, 280, 430, 350)}   # 옆 · 뒤로 돌아 YuNet 상자가 머리 뒤쪽을 못 덮거나(C07 · C13 · C18e · C68), 유나 얼굴까지 덮는 컷(C27)


def head(k):
    im = N.read(STILL / f"{k}.jpg")
    if k in HEAD:
        return HEAD[k]
    fs = N.faces(im)
    if not fs:
        return None
    s = 1200 / max(im.shape[:2])
    best = max(fs, key=lambda fe: N.sim(fe[1], "태준"))
    x, y, w, h = [float(v) / s for v in best[0][:4]]
    return (x + w / 2, y + h * 0.40, w * 1.02, h * 1.28)


def blur(k):
    im = N.read(STILL / f"{k}.jpg")
    b = head(k)
    if b is None:
        return False
    cx, cy, rx, ry = b
    mask = np.zeros(im.shape[:2], np.float32)
    cv2.ellipse(mask, (int(cx), int(cy)), (int(rx), int(ry)), 0, 0, 360, 1.0, -1)
    k1 = int(max(rx, ry) * 0.35) | 1
    mask = cv2.GaussianBlur(mask, (k1, k1), 0)[..., None]
    k2 = int(max(rx, ry) * 0.9) | 1
    soft = cv2.GaussianBlur(im, (k2, k2), 0)
    soft = cv2.GaussianBlur(soft, (k2, k2), 0)
    out = (im * (1 - mask) + soft * mask).astype(np.uint8)
    (OUT / "구도").mkdir(parents=True, exist_ok=True)
    cv2.imencode(".png", out)[1].tofile(str(OUT / "구도" / f"{k}.png"))
    return True


def base(k):
    c, o = S.C[k], T[k]
    # Codex 그림 도구는 참고를 5장까지만 받는다(넘기면 에이전트가 오류 뒤 제멋대로 빼서 Image 번호가 어긋난다) — 1 · 2 승인 얼굴, 3 · 4 실제 사진 · 옆얼굴 · 상대, 끝 구도
    other = [code for code in c["f"] if code != "T"]
    refs, parts = [str(YREF[0]), str(YREF[1])], [S.START, HIS_FACE, HIS_HAIR]
    n = 1 if other else 2
    real = [str(q) for q in (YSIDE[o["side"]] if o.get("side") else [YREF[3], YREF[4]])][:n]
    refs += real
    what = "Image 3 is a" if n == 1 else "Images 3 and 4 are"
    parts.append((HIS_SIDE if o.get("side") else HIS_REAL).format(what=what, s="" if n == 1 else "s", them="it" if n == 1 else "them", its="its" if n == 1 else "their"))
    for code in other:
        refs += S.person_refs(code, 2)[:1]
        parts.append(f"Image {len(refs)} is the identity reference for {S.P[code]['face']}.")
    parts.append(S.ID_TAIL)
    parts += [S.W[w] for w in c["w"]]
    t = c["t"]
    if k in TEXT:
        if TEXT[k][0] not in t:
            raise SystemExit(f"{k}: 바꿀 글이 없음")
        t = t.replace(*TEXT[k])
    parts.append(t)
    refs.append(str(OUT / "구도" / f"{k}.png"))
    parts.append(FRAME.format(n=len(refs)))
    if o.get("fg"):
        parts.append(FG)
    parts += [S.L[c["loc"]], S.LIGHT[c["light"]]]
    if o.get("soft"):
        parts.append(SOFT)
    if o.get("wet"):
        parts.append(DAMP)
    parts += [S.ACT, REAL_Y, SIZE_Y]
    if "umbrella" in c["t"].lower():
        parts.append(S.HOLD)
    parts += [S.BLUR, S.TAIL]
    return dict(id=k, prompt=" ".join(parts), refs=[S.small(r) if "/refs/" in r.replace("\\", "/") else r for r in refs])


def edit_prompt(n_hair, wet, other="", back=False):
    who = "Image 2 shows" if n_hair == 1 else f"Images 2 to {n_hair + 1} show"
    tail = (f" {who} only that haircut — do not copy any face, framing, clothes or light from {'it' if n_hair == 1 else 'them'}. The hairline stays his own natural hairline; "
            "natural black hair that looks real and freshly cut. No glasses. No text, no letters, no logos, no watermark. Photorealistic film still, slight film grain.")
    if back:
        return ("Edit Image 1, a film still. Keep EVERYTHING exactly as in Image 1: the same clothes, hands, umbrella, background, rain, light, framing and camera." + other +
                f" Change ONLY the hair of the man seen from behind: give him {CUT}, seen from the back — short and tapered at the nape.{WET_BACK if wet else ''}" + tail)
    return ("Edit Image 1, a film still. Keep EVERYTHING exactly as in Image 1. His face must stay EXACTLY the same: the same face shape, forehead, brows, eyes, eyelids, nose, "
            "lips, jaw, ears, skin and expression and the same turn of the head. Keep the same clothes, hands, watch, umbrella, background, light, framing and camera." + other +
            " Do not beautify him, do not slim or reshape his face and do not make him younger or more handsome. Change ONLY the man's hair: remove the cornrow braids and the "
            f"braided tails at his neck completely and give him {CUT}.{WET if wet else ''}" + tail)


def facing(p, k):
    """고개가 화면 어느 쪽을 보나 — YuNet 눈 · 코 자리(코가 두 눈 가운데보다 오른쪽이면 R). 얼굴을 못 찾으면 컷 표의 side."""
    fs = N.faces(N.read(p))
    if not fs:
        return T[k].get("side"), None
    f = max(fs, key=lambda fe: float(np.mean([N.FR.match(fe[1], r, cv2.FaceRecognizerSF_FR_COSINE) for r in YFEAT])))[0]
    d = (f[8] - (f[4] + f[6]) / 2) / f[2]
    return ("R" if d > 0.04 else "L" if d < -0.04 else None), round(float(d), 3)


def hair_job(k, base_png):
    o, c = T[k], S.C[k]
    other = ""
    if "Y" in c["f"]:
        other += " The woman stays exactly the same."
    if "M" in c["f"]:
        other += " The other man stays exactly the same."
    if any("h" in w[1:] for w in c["w"] if w.startswith("T")):
        other += " His over-ear headphones stay exactly as they are."
    if o.get("fg"):
        other += " He stays softly out of focus exactly as in Image 1, and so does his new hair."
    if o.get("back"):
        return dict(id=k, refs=[str(base_png), str(FLAG["H2"])], prompt=edit_prompt(1, o.get("wet"), other, back=True))
    side, d = facing(base_png, k)
    if o.get("wet"):
        refs = [FLAG["W"], FLAG[side or "R"]]
    else:
        refs = [FLAG["H2"], FLAG[side]] if side else [FLAG["H2"], FLAG["B"]]
    return dict(id=k, 방향=side, 코=d, refs=[str(base_png)] + [str(r) for r in refs], prompt=edit_prompt(2, o.get("wet"), other))


def bake(stage, keys, again):
    jobs = json.load(open(OUT / ("작업.json" if stage == "바탕" else "머리작업.json"), encoding="utf-8"))
    dst = OUT / stage
    dst.mkdir(parents=True, exist_ok=True)
    todo = [k for k in jobs if (not keys or k in keys) and (again or not (dst / f"{k}.png").exists())]
    miss = {k: [r for r in jobs[k]["refs"] if not Path(r).exists()] for k in todo}
    miss = {k: v for k, v in miss.items() if v}
    if miss:
        raise SystemExit("참고 없음: " + "; ".join(f"{k} {Path(v[0]).name}" for k, v in miss.items()))

    def one(k):
        r = subprocess.run(["node", str(HERE / "이미지콘티_구독굽기.cjs"), str(ROOT), str(OUT / ("작업.json" if stage == "바탕" else "머리작업.json")), k,
                            str(dst / f"{k}.png"), str(OUT / "기록" / stage)], capture_output=True, text=True, encoding="utf-8")
        return k, r.returncode, ((r.stdout or "") + (r.stderr or "")).strip().splitlines()[-1:] or [""]

    print(f"{stage} {len(todo)}장", flush=True)
    with ThreadPoolExecutor(3) as ex:
        for k, code, last in ex.map(one, todo):
            print(f"{k}: {'✓' if code == 0 else f'✗ 종료 {code}'} {last[0][-100:]}", flush=True)
            if code == 3:   # 쓸 수 있는 구독 계정이 없다 — 돈 드는 길로 돌리지 않는다
                raise SystemExit("구독 계정이 모두 막힘 — 멈춤")


YFEAT = []


def yfeat():
    names = ["ref_Bface.png", "ref_Cface.png", "ref_pro02_face.png", "ref_V181_bright.png", "ref_V204_bright.png", "각도_L45_B방식.png", "각도_R45_B방식_a.png", "각도_R45_B방식_b.png"]
    for n in names:
        fs = N.faces(N.read(FACE / n))
        if fs:
            YFEAT.append(fs[0][1])


def measure(keys):
    real = [N.faces(N.read(FACE / n))[0][1] for n in ("ref_pro01_face.png", "ref_pro02_face.png", "ref_pro11_face.png", "ref_V181_bright.png", "ref_V204_bright.png")]
    m = lambda f, st: float(np.mean([N.FR.match(f, r, cv2.FaceRecognizerSF_FR_COSINE) for r in st]))
    best = lambda im: max(N.faces(im), key=lambda fe: m(fe[1], YFEAT))[1] if N.faces(im) else None
    rec = {}
    for k in keys:
        p, b = OUT / "머리" / f"{k}.png", OUT / "바탕" / f"{k}.png"
        if not p.exists():
            continue
        f = best(N.read(p))
        fb = best(N.read(b)) if b.exists() else None
        rec[k] = dict(세트=None if f is None else round(m(f, YFEAT), 3), 실제=None if f is None else round(m(f, real), 3),
                      바탕=None if f is None or fb is None else round(float(N.FR.match(f, fb, cv2.FaceRecognizerSF_FR_COSINE)), 3))
        print(k, rec[k], flush=True)
    json.dump(rec, open(OUT / "_재기.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    args = [a for a in sys.argv[2:] if not a.startswith("--")]
    OUT.mkdir(exist_ok=True)
    if cmd == "흐림":
        keys = args or list(T)
        bad = [k for k in keys if not T[k].get("back") and not blur(k)]
        print("머리 자리를 못 찾음:", bad)
        return
    if cmd == "작업":
        jobs = {k: base(k) for k in T if not T[k].get("back")}
        for k, j in jobs.items():
            if len(j["prompt"]) > 6000 or len(j["refs"]) > 5:
                raise SystemExit(f"{k}: 지시문 {len(j['prompt'])}자 · 참고 {len(j['refs'])}장")
        json.dump(jobs, open(OUT / "작업.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        pub = {k: dict(v, refs=[Path(r).name for r in v["refs"]]) for k, v in jobs.items()}
        json.dump(pub, open(HERE / "지시문" / "이미지콘티_태준.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        mx = max(jobs.values(), key=lambda j: len(j["prompt"]))
        print(len(jobs), "컷 · 가장 긴 지시문", mx["id"], len(mx["prompt"]), "자 · 참고 가장 많은", max(len(j["refs"]) for j in jobs.values()))
        return
    if cmd == "굽기":
        return bake(args[0], args[1:], "--다시" in sys.argv)
    yfeat()
    if cmd == "머리작업":
        path = OUT / "머리작업.json"
        jobs = json.load(open(path, encoding="utf-8")) if path.exists() else {}
        for k in args or list(T):
            o = T[k]
            if o.get("nohair"):
                continue
            src = S.OUT / "받음" / f"{k}.png" if o.get("back") else OUT / "바탕" / f"{k}.png"
            if src.exists():
                jobs[k] = hair_job(k, src)
                print(k, jobs[k].get("방향"), jobs[k].get("코"), [Path(r).name for r in jobs[k]["refs"][1:]], flush=True)
        json.dump(jobs, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        pub = json.load(open(HERE / "지시문" / "이미지콘티_태준.json", encoding="utf-8"))
        pub["머리"] = {k: dict(v, refs=[Path(r).name for r in v["refs"]]) for k, v in jobs.items()}
        json.dump(pub, open(HERE / "지시문" / "이미지콘티_태준.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        return
    if cmd == "재기":
        return measure(args or list(T))
    if cmd == "올리기":
        for d in ("받음", "정지컷"):
            (S.OUT / f"{d}_M02").mkdir(exist_ok=True)
        for k in args or list(T):
            done = OUT / ("바탕" if T[k].get("nohair") else "머리") / f"{k}.png"
            if not done.exists():
                print("없음", k)
                continue
            old, still = S.OUT / "받음" / f"{k}.png", STILL / f"{k}.jpg"
            if not (S.OUT / "받음_M02" / f"{k}.png").exists():
                shutil.copy2(old, S.OUT / "받음_M02" / f"{k}.png")
                shutil.copy2(still, S.OUT / "정지컷_M02" / f"{k}.jpg")
            shutil.copy2(done, old)
            im = N.read(done)   # 구도가 이미 맞춘 정지컷이라 다시 자르지 않고 크기만 맞춘다(이미지콘티_굽기.py 맞춤을 또 돌리지 않는다)
            cv2.imencode(".jpg", cv2.resize(im, (1920, 1080), interpolation=cv2.INTER_CUBIC), [cv2.IMWRITE_JPEG_QUALITY, 93])[1].tofile(str(still))
        return
    raise SystemExit(__doc__ or "흐림 · 작업 · 굽기 · 머리작업 · 재기 · 올리기")


if __name__ == "__main__":
    main()
