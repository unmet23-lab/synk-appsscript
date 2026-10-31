# 시댄스 2.5 무제한 날 — 유호님이 웹에서 낸 판을 founder 계정 기록에서 찾아 판 이름으로 받는다(2026-10-29).
#   python -X utf8 받기.py [--크기 100] [--부터 2026-10-29T11:00Z]   → synk-vendor/pulse-seedance-day-20261028/받음/<판>.mp4 · _받음.json
# 받기만 한다 — 생성 단추는 누르지 않는다(무제한은 사람만, 결정 10-26). 계정 기록은 CLI를 founder 홈으로 불러 읽는다(현장노트 higgsfield).
# 판 찾기: 기록의 지시문을 웹올리기 · 웹올리기_둘째날(7번) · 7번비교 · 프리비즈 · 로맨스/<폴더>/지시문.txt와 견준다(꼬리표 @이미지 · @오디오 · 띄어쓰기를 빼고).
# 비율 · 길이 · 소리도 함께 본다. 로맨스 rs-C53a를 받으면 웹꾸러미.py --로맨스를 다시 돌려 rs-C53b 첫 그림(그 영상의 끝 프레임)을 채운다.
# 같은 판을 다시 냈으면 먼저 낸 것이 <판>.mp4, 뒤의 것이 <판>__2.mp4 … 이다(고르는 것은 검수에서).
# 크레딧: 거래 내역에서 시댄스 2.5 줄을 세어 0크레딧이 아닌 것이 있으면 크게 알린다(무제한으로 안 나간 것 — 웹의 Unlimited 스위치).
import difflib, json, os, re, shutil, subprocess, sys

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
WEBS = [os.path.join(DAY, d) for d in ("웹올리기", "웹올리기_둘째날", "웹올리기_7번비교", "웹올리기_프리비즈", "웹올리기_로맨스")]   # 첫날 · 둘째 날 · 7번 그림 비교(10-30) · 5번 프리비즈 시험 · 로맨스(10-31) — 판 id는 서로 겹치지 않는다
OUT = os.path.join(DAY, "받음")
HOME = os.path.join(os.path.expanduser("~"), ".ai-accounts", "higgsfield-founder")
MATCH = 0.85   # 이보다 낮으면 판을 정하지 않고 「못 찾음」으로 둔다


def hf(*args):
    env = dict(os.environ, HOME=HOME, USERPROFILE=HOME)
    exe = shutil.which("higgsfield") or "higgsfield"
    r = subprocess.run([exe, *args, "--json"], env=env, capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        raise SystemExit(f"higgsfield {' '.join(args)} 실패: {r.stderr.strip()[:300]}")
    return json.loads(r.stdout)


def norm(s):
    s = re.sub(r"@\s*(이미지|오디오|영상|image|audio|video)\s*\d+", " ", s, flags=re.I)
    s = re.sub(r"<<<[^>]*>>>", " ", s)
    return re.sub(r"\s+", " ", s).strip().lower()


def boards():
    out = []
    for web in WEBS:
        if not os.path.exists(os.path.join(web, "_순서.json")):
            continue
        for b in json.load(open(os.path.join(web, "_순서.json"), encoding="utf-8")):
            t = norm(open(os.path.join(web, b["폴더"], "지시문.txt"), encoding="utf-8").read())
            out.append({**b, "꾸러미": web, "글": t, "낱말": set(t.split())})
    return out


def gray(path, w=72, h=128):   # 영상은 첫 장, 그림은 그대로 — 작은 회색 판
    import numpy as np
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-frames:v", "1", "-vf", f"scale={w}:{h},format=gray", "-f", "rawvideo", "-"],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.uint8)[: w * h].astype(np.float32)


def first_match(clip, board):   # 받은 영상 첫 장과 그 판 첫 그림의 상관(1에 가까울수록 같음)
    pic = next(f for f in board["파일"] if f.lower().endswith((".jpg", ".png")))
    a, b = gray(clip), gray(os.path.join(board["꾸러미"], board["폴더"], pic))
    a, b = a - a.mean(), b - b.mean()
    return float((a * b).sum() / ((a * a).sum() * (b * b).sum()) ** 0.5)


def best(job_text, cands):
    # 글이 같으면 바로, 아니면 낱말이 많이 겹치는 다섯 판만 글자 단위로 견준다(185판을 다 견주면 판마다 18초)
    same = [b for b in cands if b["글"] == job_text]
    if len(same) > 1:   # 글이 똑같은 판(7번 비교의 두 길 — 그림만 다름)은 모두 돌려주고 main이 첫 장으로 가린다
        return [(1.0, b) for b in same]
    if same:
        rest = sorted(cands, key=lambda b: -len(b["낱말"] & same[0]["낱말"]) / max(1, len(b["낱말"] | same[0]["낱말"])))
        nxt = next((b for b in rest if b is not same[0]), None)
        return [(1.0, same[0])] + ([(difflib.SequenceMatcher(None, job_text, nxt["글"], autojunk=False).ratio(), nxt)] if nxt else [])
    words = set(job_text.split())
    near = sorted(cands, key=lambda b: -len(b["낱말"] & words) / max(1, len(b["낱말"] | words)))[:5]
    scored = sorted(((difflib.SequenceMatcher(None, job_text, b["글"], autojunk=False).ratio(), b) for b in near), key=lambda x: -x[0])
    return scored[:2]


def main():
    size = int(sys.argv[sys.argv.index("--크기") + 1]) if "--크기" in sys.argv else 100
    since = sys.argv[sys.argv.index("--부터") + 1] if "--부터" in sys.argv else "2026-10-29T00:00Z"
    os.makedirs(OUT, exist_ok=True)
    led_path = os.path.join(OUT, "_받음.json")
    ledger = json.load(open(led_path, encoding="utf-8")) if os.path.exists(led_path) else {}
    cands = boards()
    jobs = [j for j in hf("generate", "list", "--video", "--size", str(size))
            if "seedance" in (j.get("job_type") or "") and "2_0" not in j.get("job_type", "") and j.get("created_at", "") >= since.rstrip("Z")]
    jobs.sort(key=lambda j: j["created_at"])
    new, waiting, lost = 0, [], []
    for j in jobs:
        jid, p = j["id"], j.get("params") or {}
        if j.get("status") != "completed":
            waiting.append(f"{j['created_at'][11:19]} {j.get('status')} {jid[:8]}")
            continue
        if jid in ledger and os.path.exists(os.path.join(OUT, ledger[jid]["파일"])):
            continue
        top = best(norm(p.get("prompt") or ""), cands)
        if not top or top[0][0] < MATCH:
            lost.append(f"{j['created_at'][11:19]} {jid[:8]} 비슷함 {top[0][0]:.2f} {top[0][1]['id'] if top else '-'}")
            continue
        r, b = top[0]
        twins = [c for s, c in top if s >= 0.999]
        tmp, pick = None, None
        if len(twins) > 1:   # 글이 똑같은 판은 받은 영상의 첫 장을 판마다 시작 그림과 견줘 가장 닮은 판으로
            tmp = os.path.join(OUT, f"_가림_{jid[:8]}.mp4")
            subprocess.run(["curl", "-sS", "-L", "--fail", "-o", tmp, j["result_url"]], check=True)
            pick = {c["id"]: round(first_match(tmp, c), 3) for c in twins}
            b = next(c for c in twins if c["id"] == max(pick, key=pick.get))
            top = [(1.0, b)] + [(1.0, c) for c in twins if c is not b]
        same = sorted(v["파일"] for v in ledger.values() if v["판"] == b["id"])
        name = f"{b['id']}.mp4" if not same else f"{b['id']}__{len(same) + 1}.mp4"
        dst = os.path.join(OUT, name)
        if tmp:
            os.replace(tmp, dst)
        else:
            subprocess.run(["curl", "-sS", "-L", "--fail", "-o", dst, j["result_url"]], check=True)
        warn = []
        if pick and sorted(pick.values())[-1] - sorted(pick.values())[-2] < 0.05:
            warn.append(f"첫 장으로 가림이 애매함 {pick}")
        if p.get("aspect_ratio") and p["aspect_ratio"] != b["비율"]:
            warn.append(f"비율 {p['aspect_ratio']}(판 {b['비율']})")
        if p.get("duration") and int(p["duration"]) != int(b["길이"]):
            warn.append(f"길이 {p['duration']}초(판 {b['길이']}초)")
        if "generate_audio" in p and bool(p["generate_audio"]) != (b["소리"] != "끔"):
            warn.append(f"소리 {'켬' if p['generate_audio'] else '끔'}(판 {b['소리']})")
        if p.get("resolution") and p["resolution"] != "720p":
            warn.append(f"화질 {p['resolution']}")
        if r < 0.99 and len(top) > 1 and r - top[1][0] < 0.03:   # 지금 방식 · 새 방식(A · B)처럼 거의 같은 판끼리 헷갈릴 때
            warn.append(f"판이 애매함({top[1][1]['id']} {top[1][0]:.2f})")
        ledger[jid] = {"판": b["id"], "순서": b["순서"], "파일": name, "비슷함": round(r, 3), "다음": round(top[1][0], 3) if len(top) > 1 else None,
                       "만든때": j["created_at"], "길이": p.get("duration"), "비율": p.get("aspect_ratio"), "화질": p.get("resolution"),
                       "소리": p.get("generate_audio"), "모델": j.get("job_type"), "어긋남": warn, "지시문": p.get("prompt"),
                       "참고": [m.get("role") for m in p.get("medias") or []], **({"첫장가림": pick} if pick else {})}
        new += 1
        print(f"받음 {b['순서']:03d} {b['id']:<14} ← {jid[:8]} 비슷함 {r:.3f}" + (f" · 다음 {top[1][0]:.2f} {top[1][1]['id']}" if len(top) > 1 else "")
              + (f" · ⚠ {' · '.join(warn)}" if warn else ""))
    json.dump(ledger, open(led_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    tx = [t for t in hf("account", "transactions", "--size", "100").get("items", [])
          if "2.5" in (t.get("display_name") or "") and "seedance" in (t.get("display_name") or "").lower() and t.get("created_at", "") >= since.rstrip("Z")]
    paid = [t for t in tx if float(t.get("credits") or 0) != 0]
    got = sorted({v["판"] for v in ledger.values()})
    print(f"\n새로 받음 {new} · 받은 판 {len(got)} / {len(cands)} · 아직 도는 것 {len(waiting)} · 못 찾음 {len(lost)}")
    for w in waiting:
        print("  도는 중", w)
    for w in lost:
        print("  못 찾음", w)
    print(f"거래 내역 시댄스 2.5 {len(tx)}줄 · 0크레딧 아닌 것 {len(paid)}" + (f"  ⚠ 무제한으로 안 나감: {[(t['created_at'][11:19], t['credits']) for t in paid]}" if paid else ""))


if __name__ == "__main__":
    main()
