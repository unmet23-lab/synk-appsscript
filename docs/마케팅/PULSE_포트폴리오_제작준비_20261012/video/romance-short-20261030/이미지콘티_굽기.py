# 로맨스 단편 「다 비침」 이미지 콘티 굽기 · 맞춤 · 재기 · 판(2026-10-30) — 7번 이미지콘티_선버스트.py · 이미지콘티_맞춤.py와 같은 길.
#   python -X utf8 이미지콘티_굽기.py 굽기 [L1 C02 …] [--다시]   → git 밖 콘티/romance/선버스트/받음/<컷>.png(기준 L* · P*는 기준/<키>.png)
#                                                                  tools/GPT콘티굽기.mjs(Sunburst · max · 2048×1152), 셋씩 동시에
#   python -X utf8 이미지콘티_굽기.py 맞춤 [컷…]   → 선버스트/정지컷/<컷>.jpg(1920×1080) · 정지컷/_맞춤.json — 원본 첫 프레임의 얼굴 자리 · 크기로 잘라 맞춤
#   python -X utf8 이미지콘티_굽기.py 재기         → 선버스트/_재기.json · 얼굴마다 가장 닮은 배역과 닮음(기준선 0.363)
#   python -X utf8 이미지콘티_굽기.py 판 [컷…]     → 선버스트/비교판/_<n>.jpg(원본 첫 프레임 | 우리 그림, 열두 컷씩 — 원본이 들어가 git 밖에만)
#   python -X utf8 이미지콘티_굽기.py 보드         → 선버스트/보드/다비침_이미지콘티_<n>.jpg(우리 그림 · 초 · 말, 열두 컷씩) · _한눈.jpg
#   python -X utf8 이미지콘티_굽기.py 전후 <날짜>   → 선버스트/전후_<날짜>/전후판_<n>.jpg(원본 | 고치기 전 전/<컷>.jpg | 고친 뒤 정지컷 + 메모.json의 한 줄, 여덟 컷씩)
# 지시문은 이미지콘티_지시문.py가 낸 선버스트/작업.json. 색 · 빛은 손대지 않는다(결정 10-24) — 맞춤은 자르기 · 크기만.
import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import cv2, numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]   # 저장소 뿌리(tools/GPT콘티굽기.mjs)
V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/romance")
OUT = V / "선버스트"
W, H = 1920, 1080
MAXS = 1.8     # 받은 판이 이보다 넓으면(얼굴이 작으면) 자르지 않고 다시 굽기 — 너무 키우면 화질이 무너진다
NEAR = 0.92    # 받은 판 얼굴이 원본의 1/이것보다 크면(너무 가까움) 다시 굽기 후보 — 자르기로는 못 넓힌다
# 눈 익스트림 클로즈업은 얼굴이 화면을 넘어 YuNet 상자가 없거나 틀린다(원본 60은 입을 0.695로 잡음) — 눈 · 입술 자리를 격자로 재어 손으로 적는다(10-30 연출 · 앵글 검수).
# (배율, 받은 판의 두 눈 가운데 x · y, 원본의 두 눈 가운데 x · y). 배율 = 원본 눈~입술 높이 ÷ 받은 판 눈~입술 높이(C59 0.54/0.49 · C60 0.53/0.45)
# C60은 10-31 유호님 얼굴 판(이미지콘티_태준.py — 맞춘 정지컷을 구도로 구움)이 옛 판보다 얼굴이 7% 작게 나와 눈~입술 높이(옛 0.601 · 새 0.559, MediaPipe)로 맞춘다
EYECROP = {"C59": (1.15, 0.58, 0.335, 0.655, 0.43), "C60": (1.075, 0.559, 0.340, 0.556, 0.327)}
sys.path.insert(0, str(HERE))


def jobs():
    return json.load(open(OUT / "작업.json", encoding="utf-8"))


def dst(k):
    return OUT / ("기준" if k[0] in "LP" else "받음") / f"{k}.png"


def bake(keys, again):
    js = jobs()
    todo = {k: j for k, j in js.items() if (not keys or k in keys) and (again or not dst(k).exists())}
    for p in ("받음", "기준", "지시문"):
        (OUT / p).mkdir(parents=True, exist_ok=True)
    missing = {k: [r for r in j["refs"] if r.startswith("(아직 없음)") or not Path(r).exists()] for k, j in todo.items()}
    missing = {k: v for k, v in missing.items() if v}
    if missing:   # 참고가 없으면 참고 없이 조용히 구워지는 일을 막는다(현장 노트 10-30)
        raise SystemExit("참고 그림이 없음: " + "; ".join(f"{k} {Path(v[0]).name}" for k, v in missing.items()))

    def one(item):
        k, j = item
        txt = OUT / "지시문" / f"{k}.txt"
        txt.write_text(j["prompt"], encoding="utf-8")
        r = subprocess.run(["node", str(ROOT / "tools" / "GPT콘티굽기.mjs"), str(txt), str(dst(k)), *j["refs"], "--크기", "2048x1152", "--덮어쓰기"],
                           capture_output=True, text=True, encoding="utf-8")
        return k, r.returncode, ((r.stdout or "") + (r.stderr or "")).strip().splitlines()[-1:] or [""]

    print(f"굽기 {len(todo)}장", flush=True)
    with ThreadPoolExecutor(3) as ex:
        for k, code, last in ex.map(one, sorted(todo.items())):
            print(f"{k}: {'✓' if code == 0 else f'✗ 종료 {code}'} {last[0][-90:]}", flush=True)
            if code == 3:   # 마지막 키까지 크레딧 바닥 — 돈 드는 길로 돌리지 않는다(결정 10-29)
                raise SystemExit("API 크레딧 바닥 — 멈춤")


def target(k):   # (원본 얼굴 상자, 배역) — 지시문의 fx 순번 · 소유격으로 누구 얼굴인지 정한다
    import 이미지콘티_지시문 as 지시
    import 이미지콘티_닮음 as 닮음
    c = 지시.C.get(k, {})
    fx = c.get("fx")
    if not fx:
        return None, None
    fk = c.get("fk") or k[1:].zfill(2)
    fs = (지시.facebox.get(fk) or {}).get("얼굴") or []
    if len(fs) <= fx[0]:
        return None, None
    name = fx[1].lower()
    who = "유나" if ("her" in name and "his" not in name) or "yuna" in name else "민재" if "minjae" in name else "태준"
    return fs[fx[0]], who


def fit(k):
    import 이미지콘티_닮음 as 닮음
    src = dst(k)
    im = cv2.imdecode(np.fromfile(str(src), np.uint8), cv2.IMREAD_COLOR)
    h0, w0 = im.shape[:2]
    rec = {}
    o, who = target(k)
    if o is not None:
        fs = 닮음.faces(im)
        if fs:
            s = 1200 / max(h0, w0)
            best = max(fs, key=lambda fe: 닮음.sim(fe[1], who))
            f = best[0] / s
            fh, fcx, fcy = float(f[3]) / h0, float(f[0] + f[2] / 2) / w0, float(f[1] + f[3] / 2) / h0
            scale = o["h"] / fh
            rec.update({"배역": who, "닮음": round(닮음.sim(best[1], who), 3), "우리얼굴높이": round(fh, 3), "원본얼굴높이": o["h"], "배율": round(scale, 2)})
            if scale > MAXS:
                rec["판정"] = "다시 굽기(너무 넓음)"
            elif scale > 1.04:
                cw, chh = w0 / scale, h0 / scale
                ocx, ocy = o["x"] + o["w"] / 2, o["y"] + o["h"] / 2
                x0, y0 = fcx * w0 - ocx * cw, fcy * h0 - ocy * chh
                x0c, y0c = min(max(x0, 0), w0 - cw), min(max(y0, 0), h0 - chh)
                rec["밀림"] = [round((x0c - x0) / cw, 3), round((y0c - y0) / chh, 3)]
                im = im[int(y0c):int(y0c + chh), int(x0c):int(x0c + cw)]
                rec["판정"] = "잘라 맞춤"
            elif scale < NEAR:
                rec["판정"] = "다시 굽기 후보(원본보다 가까움)"
            else:
                rec["판정"] = "그대로"
        else:
            rec["판정"] = "얼굴 못 찾음 — 그대로"
    elif k in EYECROP:
        scale, ex, ey, ox, oy = EYECROP[k]
        cw, chh = w0 / scale, h0 / scale
        x0, y0 = ex * w0 - ox * cw, ey * h0 - oy * chh
        x0c, y0c = min(max(x0, 0), w0 - cw), min(max(y0, 0), h0 - chh)
        im = im[int(y0c):int(y0c + chh), int(x0c):int(x0c + cw)]
        rec.update({"배율": scale, "밀림": [round((x0c - x0) / cw, 3), round((y0c - y0) / chh, 3)], "판정": "잘라 맞춤(눈 · 손으로 잰 자리)"})
    out = cv2.resize(im, (W, H), interpolation=cv2.INTER_CUBIC if im.shape[1] < W else cv2.INTER_AREA)
    (OUT / "정지컷").mkdir(parents=True, exist_ok=True)
    cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 93])[1].tofile(str(OUT / "정지컷" / f"{k}.jpg"))
    return rec


def fit_all(keys):
    log_p = OUT / "정지컷" / "_맞춤.json"
    log = json.load(open(log_p, encoding="utf-8")) if log_p.exists() else {}
    for k in keys or [k for k in jobs() if k[0] == "C"]:
        if not dst(k).exists():
            continue
        log[k] = fit(k)
        print(k, log[k], flush=True)
    json.dump(log, open(log_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def measure():
    import 이미지콘티_닮음 as 닮음
    res = {}
    for k, j in jobs().items():
        p = OUT / "정지컷" / f"{k}.jpg"
        if k[0] != "C" or not p.exists():
            continue
        want = [닮음.CODE[c] for c in j["who"] if c in 닮음.CODE]
        got = 닮음.score(p)
        res[k] = {"배역": want, "얼굴": got}
        bad = [w for w in want if not any(g[0] == w and g[1] >= 닮음.LINE for g in got)]
        if bad and got:
            res[k]["알림"] = f"닮음 기준선 아래 또는 못 찾음: {bad}"
        print(k, want, got, res[k].get("알림", ""), flush=True)
    json.dump(res, open(OUT / "_재기.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def _font(sz, bold=True):
    from PIL import ImageFont
    return ImageFont.truetype(str(ROOT / "docs/브랜드_폰트/SUIT" / f"SUIT-{'ExtraBold' if bold else 'Medium'}.otf"), sz)


def compare(keys):   # 원본 첫 프레임 | 우리 그림
    from PIL import Image, ImageDraw
    fits = json.load(open(OUT / "정지컷" / "_맞춤.json", encoding="utf-8")) if (OUT / "정지컷" / "_맞춤.json").exists() else {}
    ks = [k for k in jobs() if k[0] == "C" and (not keys or k in keys) and (OUT / "정지컷" / f"{k}.jpg").exists()]
    tw, th, per, cols = 480, 270, 12, 2
    f1, f2 = _font(26), _font(19, False)
    (OUT / "비교판").mkdir(parents=True, exist_ok=True)
    for n in range(0, len(ks), per):
        part = ks[n:n + per]
        rows = (len(part) + cols - 1) // cols
        b = Image.new("RGB", (cols * (2 * tw + 30) + 10, rows * (th + 52) + 10), (18, 18, 20))
        d = ImageDraw.Draw(b)
        for i, k in enumerate(part):
            x0, y0 = 10 + (i % cols) * (2 * tw + 30), 10 + (i // cols) * (th + 52)
            src = V / "원본첫프레임" / f"{orig_key(k)}.jpg"
            if src.exists():
                b.paste(Image.open(src).convert("RGB").resize((tw, th)), (x0, y0 + 46))
            b.paste(Image.open(OUT / "정지컷" / f"{k}.jpg").convert("RGB").resize((tw, th)), (x0 + tw + 6, y0 + 46))
            r = fits.get(k, {})
            d.text((x0, y0 + 4), k, font=f1, fill=(255, 205, 110) if "다시" in r.get("판정", "") else (240, 240, 240))
            tag = " · ".join(x for x in (r.get("판정", ""), f"배율 {r['배율']}" if "배율" in r else "", f"{r.get('배역', '')} 닮음 {r['닮음']}" if "닮음" in r else "") if x)
            d.text((x0 + 90, y0 + 12), tag, font=f2, fill=(190, 200, 210))
        b.save(OUT / "비교판" / f"_{n // per + 1:02d}.jpg", quality=84)
    print("비교판 →", OUT / "비교판")


def board():   # 우리 그림 · 초 · 말(유호님 · 이해 시험용, 원본 없음)
    from PIL import Image, ImageDraw
    cs = {c["컷"]: c for c in json.load(open(V / "컷목록.json", encoding="utf-8"))}
    order = []
    for k in cs:
        order.append(k)
        if k + "e" in jobs():
            order.append(k + "e")
    tw, th, per, cols = 640, 360, 12, 3
    f1, f2 = _font(28), _font(21, False)
    (OUT / "보드").mkdir(parents=True, exist_ok=True)
    for n in range(0, len(order), per):
        part = order[n:n + per]
        rows = (len(part) + cols - 1) // cols
        b = Image.new("RGB", (cols * (tw + 14) + 14, rows * (th + 112) + 14), (16, 16, 18))
        d = ImageDraw.Draw(b)
        for i, k in enumerate(part):
            x0, y0 = 14 + (i % cols) * (tw + 14), 14 + (i // cols) * (th + 112)
            c = cs[k.rstrip("e")]
            p = OUT / "정지컷" / f"{k}.jpg"
            if p.exists():
                b.paste(Image.open(p).convert("RGB").resize((tw, th)), (x0, y0 + 40))
            elif k == "C65":
                d.rectangle([x0, y0 + 40, x0 + tw, y0 + 40 + th], fill=(0, 0, 0))
            else:
                d.rectangle([x0, y0 + 40, x0 + tw, y0 + 40 + th], fill=(40, 40, 44))
                d.text((x0 + 20, y0 + 60), "아직 없음", font=f2, fill=(160, 160, 160))
            head = f"{k}{' 끝 그림' if k.endswith('e') else ''} · {c['우리초'][0]:.1f}~{c['우리초'][1]:.1f}초" + (" · 회상" if c["회상"] else "")
            d.text((x0, y0 + 4), head, font=f1, fill=(255, 215, 120))
            say = " / ".join(f"{m['누가']} 「{m['대사']}」" for m in c["말"]) or c["소리"]
            for li, line in enumerate(_wrap(d, say, f2, tw)[:3]):
                d.text((x0, y0 + 44 + th + li * 24), line, font=f2, fill=(225, 225, 230))
        b.save(OUT / "보드" / f"다비침_이미지콘티_{n // per + 1:02d}.jpg", quality=86)
    print("보드 →", OUT / "보드")


def before_after(tag):   # 원본 첫 프레임 | 고치기 전 | 고친 뒤 + 무엇을 고쳤나(유호님 확인용 — 원본이 들어가 git 밖에만)
    from PIL import Image, ImageDraw
    base = OUT / f"전후_{tag}"
    memo = json.load(open(base / "메모.json", encoding="utf-8"))   # {컷: "고친 것"}
    ks = [k for k in memo if (OUT / "정지컷" / f"{k}.jpg").exists()]
    tw, th, per = 520, 293, 8
    f1, f2 = _font(26), _font(22, False)
    for n in range(0, len(ks), per):
        part = ks[n:n + per]
        b = Image.new("RGB", (3 * tw + 40, len(part) * (th + 58) + 50), (16, 16, 18))
        d = ImageDraw.Draw(b)
        for c, head in enumerate(("원본", "고치기 전", "고친 뒤")):
            d.text((10 + c * (tw + 10), 12), head, font=f1, fill=(150, 150, 160))
        for i, k in enumerate(part):
            y0 = 50 + i * (th + 58)
            fk = orig_key(k)
            for c, p in enumerate((V / "원본첫프레임" / f"{fk}.jpg", base / "전" / f"{k}.jpg", OUT / "정지컷" / f"{k}.jpg")):
                if p.exists():
                    b.paste(Image.open(p).convert("RGB").resize((tw, th)), (10 + c * (tw + 10), y0 + 46))
                else:
                    d.rectangle([10 + c * (tw + 10), y0 + 46, 10 + c * (tw + 10) + tw, y0 + 46 + th], fill=(40, 40, 44))
                    d.text((20 + c * (tw + 10), y0 + 60), "새로 굽은 그림" if c == 1 else "없음", font=f2, fill=(160, 160, 160))
            d.text((10, y0 + 8), k, font=f1, fill=(255, 215, 120))
            d.text((90, y0 + 12), _wrap(d, memo[k], f2, 3 * tw - 60)[0], font=f2, fill=(225, 225, 230))
        b.save(base / f"전후판_{n // per + 1:02d}.jpg", quality=86)
    print("전후판 →", base, f"({len(ks)}컷)")


def orig_key(k):   # 원본 첫 프레임 이름 — 끝 그림(…e)은 원본 끝 프레임과 견준다
    import 이미지콘티_지시문 as 지시
    c = 지시.C.get(k, {})
    return c.get("fk") or (k[1:-1] + "_끝" if k.endswith("e") else k[1:].zfill(2))


def _wrap(d, text, font, width):
    out, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=font) > width:
            out.append(cur)
            cur = ch
        else:
            cur += ch
    return out + [cur] if cur else out


if __name__ == "__main__":
    cmd, rest = sys.argv[1], [a for a in sys.argv[2:] if not a.startswith("--")]
    if cmd == "굽기":
        bake(rest, "--다시" in sys.argv)
    elif cmd == "맞춤":
        fit_all(rest)
    elif cmd == "재기":
        measure()
    elif cmd == "판":
        compare(rest)
    elif cmd == "보드":
        board()
    elif cmd == "전후":
        before_after(rest[0])
