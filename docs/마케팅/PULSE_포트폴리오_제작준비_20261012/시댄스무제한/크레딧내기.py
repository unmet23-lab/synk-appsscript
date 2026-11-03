# 시댄스 2.5 크레딧 길 — 급한 판을 CLI로 우선 대기열에 내고 받는다(2026-11-04, 유호님 「응, 그렇게 해」 — 새 계정 이벤트에 딸린 크레딧으로 급한 판부터).
#   python -X utf8 크레딧내기.py <꾸러미 폴더> [<판 id>…] [--계정 founder] [--상한 1000] [--동시 3] [--실행]
#   기본은 미리 보기(낼 판 · 초 · 크레딧 · 잔액)만 찍는다. --실행일 때만 낸다. 견적이 --상한(안 주면 잔액)을 넘으면 내지 않는다.
# 꾸러미: _순서.json이 있는 웹올리기 폴더, 또는 순서표.md만 있는 폴더(서울 자전거 「다녀왔어」 — 「판 수」만큼 같은 지시문으로 여러 번).
#   판을 안 주면 받을곳에 아직 없는 판 전부(판 수만큼), 판을 주면 받은 것이 있어도 다시 낸다. 빠진 파일이 있는 판은 건너뛰고 알린다.
# 무제한은 웹에서 사람만(결정 10-26) — 이 도구는 크레딧 생성만 낸다(약관 10.6의 자동화 제한은 무제한 몫).
# 웹과 같은 꼴로 낸다: 1_시작 → start_image, 2_끝 → end_image, 그 밖의 그림 → image_references, mp3 → audio_references,
#   지시문의 @이미지 N · @오디오 N은 웹이 서버에 보내는 <<<image_N>>> · <<<audio_N>>>로, 720p · bitrate high · 소리는 판대로.
#   첫 판은 혼자 내고 서버가 받은 참고 차례가 웹(시작 · 끝 · 그림 · 소리)과 같은지 본 뒤 나머지를 낸다 — 다르면 멈춘다.
# 받은 영상: 받을곳/<판>.mp4(같은 판 둘째부터 __2 …) — 받을곳은 DAY 아래 꾸러미면 DAY/받음, 아니면 꾸러미 옆 받음/.
#   기록은 받을곳/_받음.json(받기.py와 같은 꼴, 받은 판만)과 DAY/받음/_크레딧내기.json(실패 포함 — 받기.py가 이 판들을 건너뛰고 거래 내역에서 뺀다).
#   받기.py와 같은 때에 돌리지 않는다(둘 다 _받음.json을 통째로 다시 쓴다).
# nsfw · 실패는 다시 내지 않고 알린다(현장노트 higgsfield 「같은 장면이 nsfw로 두 번 막힌다」).
import json, os, re, shutil, subprocess, sys, threading
from concurrent.futures import ThreadPoolExecutor

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
LEDGER = os.path.join(DAY, "받음", "_크레딧내기.json")
PIC = (".jpg", ".jpeg", ".png", ".webp")
TAG = {"이미지": "image", "오디오": "audio", "영상": "video"}
lock = threading.Lock()


def home(acct):
    return os.path.join(os.path.expanduser("~"), ".ai-accounts", f"higgsfield-{acct}")


def hf(acct, *args):
    env = dict(os.environ, HOME=home(acct), USERPROFILE=home(acct))
    exe = shutil.which("higgsfield") or "higgsfield"
    r = subprocess.run([exe, *args, "--json"], env=env, capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        raise RuntimeError(f"higgsfield {' '.join(args[:2])} 실패: {(r.stderr or r.stdout).strip()[:300]}")
    return json.loads(r.stdout)


def boards(pack):   # _순서.json, 없으면 순서표.md의 표(| 순번 | 판 | 길이 | 판 수 | 그림 | 폴더 |)와 표 앞 머리의 비율 · 소리
    p = os.path.join(pack, "_순서.json")
    if os.path.exists(p):
        return [{**b, "판 수": b.get("판 수", 1)} for b in json.load(open(p, encoding="utf-8"))]
    md = open(os.path.join(pack, "순서표.md"), encoding="utf-8").read()
    head = md.split("|")[0]
    ratio, sound = ("9:16" if "9:16" in head else "16:9"), ("끔" if "소리 끔" in head else "켬")
    out = []
    for m in re.finditer(r"^\|\s*(\d+)\s*\|\s*(\S+)\s*\|\s*(\d+)초\s*\|\s*(\d+)\s*\|[^|]*\|\s*`?([^`|]+?)/?`?\s*\|$", md, re.M):
        folder = m.group(5).strip()
        files = sorted(f for f in os.listdir(os.path.join(pack, folder)) if f != "지시문.txt")
        out.append({"순서": int(m.group(1)), "id": m.group(2), "길이": int(m.group(3)), "판 수": int(m.group(4)),
                    "폴더": folder, "비율": ratio, "소리": sound, "파일": files, "빠진 파일": []})
    return out


def media(pack, b):   # 웹과 같은 차례 — 시작 · 끝 · 그 밖의 그림 · 소리
    files = sorted(b["파일"])
    start = [f for f in files if f.startswith("1_") and f.lower().endswith(PIC)]
    end = [f for f in files if "끝" in f and f.lower().endswith(PIC)]
    refs = [f for f in files if f.lower().endswith(PIC) and f not in start + end]
    audio = [f for f in files if f.lower().endswith((".mp3", ".wav"))]
    flag = lambda k, fs: [x for f in fs for x in (k, os.path.join(pack, b["폴더"], f))]
    args = flag("--start-image", start) + flag("--end-image", end) + flag("--image-references", refs) + flag("--audio-references", audio)
    return args, ["start_image"] * len(start) + ["end_image"] * len(end) + ["image"] * len(refs) + ["audio"] * len(audio)


def prompt(pack, b):
    t = open(os.path.join(pack, b["폴더"], "지시문.txt"), encoding="utf-8").read().strip()
    return re.sub(r"@\s*(이미지|오디오|영상)\s*(\d+)", lambda m: f"<<<{TAG[m.group(1)]}_{m.group(2)}>>>", t)


def have(out, pan):   # 받을곳에 이미 있는 그 판의 파일 수
    return sum(1 for f in os.listdir(out) if re.fullmatch(re.escape(pan) + r"(__\d+)?\.mp4", f)) if os.path.isdir(out) else 0


def save(path, key, row):
    led = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    led[key] = row
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(led, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def record(out, jid, b, name, job, roles, acct, cost):
    p = job.get("params") or {}
    with lock:
        save(LEDGER, jid, {"판": b["id"], "계정": acct, "받을곳": out, "파일": name, "상태": job.get("status"),
                           "만든때": job.get("created_at"), "크레딧": cost})
        if name:
            save(os.path.join(out, "_받음.json"), jid, {
                "판": b["id"], "순서": b["순서"], "파일": name, "비슷함": 1.0, "다음": None, "만든때": job.get("created_at"),
                "길이": p.get("duration"), "비율": p.get("aspect_ratio"), "화질": p.get("resolution"), "소리": p.get("generate_audio"),
                "모델": job.get("job_type"), "어긋남": [], "지시문": p.get("prompt"), "참고": roles, "길": "크레딧"})


def run_one(acct, pack, out, b, cost, check=False):
    margs, roles = media(pack, b)
    made = hf(acct, "generate", "create", "seedance_2_5", "--mode", "omni_reference" if margs else "t2v", "--prompt", prompt(pack, b),
              "--resolution", "720p", "--bitrate_mode", "high", "--aspect_ratio", b["비율"], "--duration", str(b["길이"]),
              "--generate_audio", "false" if b["소리"] == "끔" else "true", *margs)
    first = made[0] if isinstance(made, list) else made
    jid = first if isinstance(first, str) else first["id"]
    sent = [m.get("role") for m in (hf(acct, "generate", "get", jid).get("params") or {}).get("medias") or []]
    print(f"냄 {b['id']:<16} ← {jid[:8]} 참고 {sent}", flush=True)
    if check and sent != roles:
        raise SystemExit(f"멈춤: 서버가 받은 참고 차례 {sent}가 웹 차례 {roles}와 다르다 — <<<image_N>>> 번호가 어긋난다. 나머지는 내지 않았다.")
    try:
        job = hf(acct, "generate", "wait", jid, "--timeout", "60m", "--quiet")
    except RuntimeError:
        job = hf(acct, "generate", "get", jid)
    job = job[0] if isinstance(job, list) else job
    if job.get("status") != "completed":
        print(f"  ⚠ {b['id']} {jid[:8]} {job.get('status')} — 다시 내지 않음", flush=True)
        record(out, jid, b, None, job, sent, acct, cost)
        return
    with lock:   # 같은 판을 함께 받는 일꾼끼리 이름이 겹치지 않게 자리를 먼저 잡는다
        n = have(out, b["id"])
        name = f"{b['id']}.mp4" if not n else f"{b['id']}__{n + 1}.mp4"
        os.makedirs(out, exist_ok=True)
        open(os.path.join(out, name), "wb").close()
    try:
        subprocess.run(["curl", "-sS", "-L", "--fail", "-o", os.path.join(out, name), job["result_url"]], check=True)
    except subprocess.CalledProcessError:
        os.remove(os.path.join(out, name))
        raise
    record(out, jid, b, name, job, sent, acct, cost)
    print(f"받음 {b['id']:<16} → {name}", flush=True)


def safe(*a):
    try:
        run_one(*a)
    except Exception as e:   # 한 판이 막혀도 나머지는 낸다 — 끝에 모아 알린다
        print(f"  ⚠ {a[3]['id']} 못 냄: {e}", flush=True)
        return a[3]["id"]


def main():
    a = sys.argv[1:]
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d
    acct, cap, conc, go = opt("--계정", "founder"), opt("--상한", None), int(opt("--동시", "3")), "--실행" in a
    vals = {a.index(k) + 1 for k in ("--계정", "--상한", "--동시") if k in a}
    pos = [x for i, x in enumerate(a) if not x.startswith("--") and i not in vals]
    if not pos:
        raise SystemExit("쓰는 법: python -X utf8 크레딧내기.py <꾸러미> [<판>…] [--계정 이름] [--상한 크레딧] [--동시 3] [--실행]")
    pack, want = os.path.abspath(pos[0]), pos[1:]
    out = os.path.join(DAY, "받음") if pack.replace("\\", "/").startswith(DAY) else os.path.join(os.path.dirname(pack), "받음")
    bs = boards(pack)
    miss = [w for w in want if w not in {b["id"] for b in bs}]
    if miss:
        raise SystemExit(f"꾸러미에 없는 판: {miss}")
    todo, held = [], []
    for b in (bs if not want else [b for b in bs if b["id"] in want]):
        lost = list(b.get("빠진 파일") or []) + [f for f in b["파일"] if not os.path.exists(os.path.join(pack, b["폴더"], f))]
        if lost:
            held.append(f"{b['id']}(빠짐 {', '.join(sorted(set(lost)))})")
            continue
        todo += [b] * max(0, b["판 수"] - (0 if want else have(out, b["id"])))
    price = {}
    for b in todo:
        if b["길이"] not in price:
            price[b["길이"]] = hf(acct, "generate", "cost", "seedance_2_5", "--prompt", "cost", "--resolution", "720p", "--duration", str(b["길이"]))["credits"]
    total = sum(price[b["길이"]] for b in todo)
    st = hf(acct, "account", "status")
    bal = float(st.get("credits") or 0)
    print(f"계정 {st.get('email')} · 잔액 {bal} · 받을곳 {out}")
    for b in todo:
        print(f"  {b['순서']:03d} {b['id']:<16} {b['길이']}초 {b['비율']} 소리 {b['소리']} · {price[b['길이']]}크레딧 · 참고 {media(pack, b)[1]}")
    print(f"낼 것 {len(todo)}판 · {sum(b['길이'] for b in todo)}초 · {total}크레딧" + (f" · 건너뜀 {len(held)}: {' · '.join(held)}" if held else ""))
    limit = min(float(cap) if cap else bal, bal)
    if total > limit:
        raise SystemExit(f"멈춤: 견적 {total}크레딧이 상한 {cap or '-'} · 잔액 {bal}을 넘는다.")
    if not go or not todo:
        print("미리 보기만 했다 — 내려면 --실행" if todo else "낼 판이 없다")
        return
    run_one(acct, pack, out, todo[0], price[todo[0]["길이"]], check=True)
    with ThreadPoolExecutor(conc) as ex:
        bad = [x for x in ex.map(lambda b: safe(acct, pack, out, b, price[b["길이"]]), todo[1:]) if x]
    print(f"\n끝 · 잔액 {bal} → {hf(acct, 'account', 'status').get('credits')} (견적 {total})" + (f" · 못 낸 판 {bad}" if bad else ""))


if __name__ == "__main__":
    main()
