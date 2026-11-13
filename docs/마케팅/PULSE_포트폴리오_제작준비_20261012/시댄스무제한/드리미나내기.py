# 드리미나 시댄스 2.5 — 꾸러미 판을 공식 CLI(dreamina-canvas)로 내고 받는다(2026-11-04, 유호님 「필요하면 cli 설치하고 진행해도돼」).
#   python -X utf8 드리미나내기.py <꾸러미 폴더> [<판 id>…] [--받을곳 <폴더>] [--상한 크레딧] [--동시 3] [--계정 ultra] [--컷표 <컷순서.json>] [--걸림무시 "<판 id>,…: <까닭>"] [--실행]
#   내기 전에 낼 판의 지시문을 스스로 검사한다(11-10, 크레딧내기.py의 굽기전) — 사람을 굳히는 낱말 · 손 없이 움직이는 물건 · 실내의 눈이 걸리면 --실행이어도 내지 않는다.
#   컷표(--컷표, 안 주면 꾸러미 폴더나 그 한 층 위의 컷표.json)가 있으면 표 검사 · 빛 문장 대조도 돈다. 그래도 내야 하면 --걸림무시 "<판 id>,<판 id>: <까닭>"(그 판만) · "모두: <까닭>"
#   — _드리미나.json 그 판 줄의 「걸림무시」 칸에 남는다. _순서.json 판의 "컷" · "소리만" · "인물" 칸은 크레딧내기.py 머리 설명과 같다.
#   --계정은 CLI 로그인 칸(--profile)이다. 안 주면 기본 칸(옛 기본 요금제 계정), ultra는 11-05 울트라를 결제한 계정 — 캔버스 id는 칸마다 캔버스_<칸>.txt(git 밖).
#   기본은 미리 보기(낼 판 · 초 · 크레딧 · 잔액)만 찍는다. --실행일 때만 낸다. 견적이 --상한(안 주면 잔액)을 넘으면 내지 않는다.
# 판 읽기는 크레딧내기.py의 boards()와 같다(_순서.json 또는 순서표.md). 판을 안 주면 받을곳에 아직 없는 판 전부(판 수만큼), 판을 주면 판마다 한 번씩만 낸다.
# 입력: 소리 · 끝 외 참고 · 두 샷이 없으면 first_last_frame(시작 · 끝 프레임을 서버가 프레임으로 받음),
#   소리나 참고 그림이 있으면 m2v(옴니 레퍼런스) — 이때 시작 그림은 참고일 뿐 프레임으로 고정되지 않는다(CLI · 웹 모두 첫 프레임과 소리를 함께 받는 칸이 없다).
#   지시문의 @이미지 N · @오디오 N은 올린 파일의 {{res:<id>}}로 바꾼다. 비율은 판대로(CLI 필수), 720p, 소리 끄는 칸은 없다 — 소리 끔 판도 소리가 붙어 나오면 쓸 때 뺀다.
# 받은 파일: 계정 설정 「AI 워터마크 삭제」가 꺼져 있으면 왼쪽 위에 「AI」 표시가 박힌다 — 11-04 켰고, 이미 구운 판도 같은 resourceId로 다시 받으면 표시 없는 파일이 온다(크레딧 0, README 「드리미나 비교(11-04)」). 첫 프레임 판은 크기가 시작 그림 비율을 따른다(2752x1536 → 1284x716).
#   이 설정은 계정마다 따로다 — 11-05 울트라 계정에서도 켰다(그 전에 받은 첫 판은 표시가 있어 같은 resourceId로 다시 받았다).
#   파일 머리의 프레임률이 60으로 적혀 재기.py 등이 장을 겹쳐 읽는다 — 실제 97장 · 24fps라 잴 때는 fps=24로 옮겨 잰다.
# 값: 720p 초당 37크레딧(11-04 기본 요금제 화면 · 실제 차감), 울트라 칸은 초당 18(11-05 실측 — 5초 90 · 13초 234). 견적 · 상한은 칸마다 PER_SEC_OF(울트라는 요금표 값 19로 조금 넉넉히).
#   받은 뒤 잔액으로 다시 잰다. 영상 받은 것은 받을곳/<판>.mp4(둘째부터 __2), 기록은 받을곳/_드리미나.json.
#   받은 판은 받을곳/_받음.json(받기.py와 같은 꼴)에도 적는다(11-05) — 견본떼기.py · 웹꾸러미.py의 끝 프레임(rs-C53b · hg-F6) · 재기.py가 그 장부로 판을 찾는다.
# 받은 파일마다 왼쪽 위 「AI」 표시를 잰다(11-05, 유호님 「표시 지우긱는 꼭 지워줘」) — 장 평균 높은 결을 표시 견본과 견줌, 표시 있음 0.86~1.00 · 없음 0.09~0.22로
#   갈려 0.5 넘으면 같은 resourceId로 두 번까지 다시 받고, 그래도 있으면 알린다. 견본은 받음/_드리미나비교/hs-S07-B_dr.mp4(표시 있는 판)에서 한 번 떠 둔다.
# 끊기면 다시 내지 않는다 — 기록에 submitId가 있으니 그 id로 `dreamina-canvas operation wait <submitId> --project-id <캔버스>`를 본다.
import json, os, re, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from 크레딧내기 import boards, PIC, 굽기전, 받은뒤, 인자값, 무시쓰는법

IGNORED = {}   # 판 id → 까닭 — --걸림무시로 지시문 걸림을 넘겨 낸 판(장부의 「걸림무시」 칸)
HOME = os.path.join(os.path.expanduser("~"), ".ai-tools", "dreamina-canvas")
EXE = os.path.join(HOME, "dreamina-canvas.exe")
DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
PROFILE = None   # CLI 로그인 칸 — main()의 --계정이 정한다
PROJECT = open(os.path.join(HOME, "캔버스.txt"), encoding="utf-8").read().strip()   # 내는 캔버스 id — 공개 저장소라 git 밖에 둔다(칸이 있으면 캔버스_<칸>.txt)
PER_SEC_OF = {None: 37, "ultra": 19}
PER_SEC = 37   # main()이 칸에 맞춰 PER_SEC_OF에서 고른다
lock = threading.Lock()
TAKEN = []   # 이번 실행에서 받으려고 잡아 둔 파일 이름


def cli(*args, check=True, timeout=3000):
    prof = ["--profile", PROFILE] if PROFILE else []
    r = subprocess.run([EXE, *prof, "--format", "json", "--non-interactive", *args], capture_output=True, text=True, encoding="utf-8", timeout=timeout)
    try:
        j = json.loads(r.stdout or r.stderr)
    except ValueError:
        raise RuntimeError(f"CLI 답을 못 읽음: {(r.stdout or r.stderr)[:300]}")
    if check and not j.get("ok"):
        raise RuntimeError(json.dumps(j.get("error") or j, ensure_ascii=False)[:600])
    return j


def balance():
    return int(float(cli("auth", "account")["data"]["availableCredits"]))


def split_media(pack, b):   # 크레딧내기와 같은 차례 — 시작 · 끝 · 그 밖의 그림 · 소리
    files = sorted(b["파일"])
    start = [f for f in files if f.startswith("1_") and f.lower().endswith(PIC)]
    end = [f for f in files if "끝" in f and f.lower().endswith(PIC)]
    refs = [f for f in files if f.lower().endswith(PIC) and f not in start + end]
    audio = [f for f in files if f.lower().endswith((".mp3", ".wav"))]
    return start, end, refs, audio


def mode_of(start, end, refs, audio):
    return "m2v" if (audio or refs or not start) else "first_last_frame"


def upload(pack, b, name):
    made = cli("resource", "upload", "--file", os.path.join(pack, b["폴더"], name), "--project-id", PROJECT, "--name", f"{b['id']}_{os.path.splitext(name)[0]}")
    return made["data"]["resourceId"]


def build_prompt(pack, b, images, audios):
    t = open(os.path.join(pack, b["폴더"], "지시문.txt"), encoding="utf-8").read().replace("\r\n", "\n").strip()
    def sub(m):
        kinds = {"이미지": images, "오디오": audios}.get(m.group(1))
        n = int(m.group(2))
        if not kinds or n > len(kinds):
            raise RuntimeError(f"{b['id']} 지시문의 {m.group(0)}에 맞는 파일이 없다")
        return "{{res:%s}}" % kinds[n - 1]
    return re.sub(r"@\s*(이미지|오디오)\s*(\d+)", sub, t)


def have(out, pan):
    return sum(1 for f in os.listdir(out) if re.fullmatch(re.escape(pan) + r"(__\d+)?\.mp4", f)) if os.path.isdir(out) else 0


def pick_name(out, pid):
    """디스크에도 없고 이번 실행에서 잡지도 않은 첫 이름 — CLI는 있는 파일에 받지 않으니 빈 파일로 자리를 잡지 않고 이름만 메모리에 잡는다.
    예전엔 판 수(파일 + 잡은 수)로 셌더니 먼저 받은 판이 두 번 세어져 __2 대신 __3이 붙었다(11-05)."""
    with lock:
        k = 1
        while True:
            name = f"{pid}.mp4" if k == 1 else f"{pid}__{k}.mp4"
            if name not in TAKEN and not os.path.exists(os.path.join(out, name)):
                TAKEN.append(name)
                return name
            k += 1


def save(out, key, row, name="_드리미나.json"):
    # 다른 세션도 같은 장부에 쓴다(11-05 — 1번 오미톡 판) — 잠금 파일로 프로세스 사이도 막고, 쓰기 직전에 다시 읽어 바꿔치기한다. 30초 넘게 남은 잠금은 주인이 죽은 것으로 본다.
    p = os.path.join(out, name)
    os.makedirs(out, exist_ok=True)
    guard = p + ".잠금"
    with lock:
        t0 = time.time()
        while True:
            try:
                os.close(os.open(guard, os.O_CREAT | os.O_EXCL | os.O_WRONLY))
                break
            except FileExistsError:
                try:
                    if time.time() - os.path.getmtime(guard) > 30:
                        os.remove(guard)
                except OSError:
                    pass
                if time.time() - t0 > 120:
                    raise RuntimeError(f"장부 잠금을 못 잡음: {guard}")
                time.sleep(0.2)
        try:
            led = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
            led[key] = row
            tmp = f"{p}.{os.getpid()}.tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(led, f, ensure_ascii=False, indent=1)
            for k in range(10):   # 윈도우에서 다른 프로세스가 읽는 중이면 바꿔치기가 잠깐 막힌다
                try:
                    os.replace(tmp, p)
                    break
                except PermissionError:
                    if k == 9:
                        raise
                    time.sleep(0.3)
        finally:
            os.remove(guard)


MARK_SRC = os.path.join(DAY, "받음", "_드리미나비교", "hs-S07-B_dr.mp4")   # 표시가 박힌 판(11-04 기본 계정)
MARK_TPL = os.path.join(DAY, "받음", "_표시견본.npy")
MARK_AT = 0.5


def corner_hp(path, n=16):
    """왼쪽 위 200×140의 장 평균 높은 결 — 겹쳐 박힌 표시는 같은 자리에 쌓이고 움직이는 화면은 흐려진다."""
    import numpy as np, cv2
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path], capture_output=True, text=True, encoding="utf-8")
    dur = float(json.loads(r.stdout)["format"]["duration"])
    acc = []
    for k in range(n):
        rr = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{dur * (k + 0.5) / n:.3f}", "-i", path, "-frames:v", "1", "-vf", "crop=200:140:0:0",
                             "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True)
        a = np.frombuffer(rr.stdout, np.uint8)
        if a.size >= 200 * 140:
            f = a[:200 * 140].reshape(140, 200).astype(np.float32)
            acc.append(f - cv2.GaussianBlur(f, (0, 0), 6))
    return np.mean(acc, axis=0)


def mark_score(path):
    import numpy as np, cv2
    with lock:
        if not os.path.exists(MARK_TPL):
            np.save(MARK_TPL, corner_hp(MARK_SRC, 24)[6:48, 6:58].copy())
        tpl = np.load(MARK_TPL)
    r = cv2.matchTemplate(corner_hp(path).astype(np.float32), tpl.astype(np.float32), cv2.TM_CCOEFF_NORMED)
    return round(float(r[:40, :40].max()), 3)   # 표시는 6~58px 자리 — 조금 어긋나도 잡게 40px 안을 찾는다


def result_of(data):   # 정상 답은 data.node · data.submission, 끊긴 답은 partialData.items[0]
    it = (data.get("items") or [data])[0]
    sub = it.get("submission") or it
    res = sub.get("resources") or []
    rid = next((r.get("resourceId") for r in res if r.get("state") == "succeeded"), None)
    return (it.get("node") or {}).get("nodeId") or it.get("nodeId"), sub.get("submitId"), rid, sub.get("state"), it


def run_one(pack, out, b):
    t0 = time.time()
    start, end, refs, audio = split_media(pack, b)
    mode = mode_of(start, end, refs, audio)
    ceiling = PER_SEC * b["길이"]
    with lock:
        print(f"냄 {b['id']:<14} {mode} {b['길이']}초 상한 {ceiling}", flush=True)
    for k_try in range(3):   # 올린 그림의 크기를 서버가 아직 못 읽으면 견적 단계에서 끝난다(11-05 p7-1-32-새로 VIDEO_FIRST_FRAME_UNAVAILABLE, 차감 없음) — 잠시 뒤 다시 올려 다시 낸다
        image_ids = [upload(pack, b, f) for f in start + end + refs]
        audio_ids = [upload(pack, b, f) for f in audio]
        prompt = build_prompt(pack, b, image_ids, audio_ids)
        ref_args = [x for i in image_ids + audio_ids for x in ("--ref", f"res:{i}")]
        made = cli("node", "create", "video", "--model", "seedance_2.5", "--mode", mode, *ref_args, "--prompt", prompt, "--ratio", b["비율"],
                   "--resolution", "720p", "--duration", str(b["길이"]), "--title", b["id"], "--project-id", PROJECT,
                   "--run", "--credit-ceiling", str(ceiling), "--wait", "--timeout", "45m", check=False)
        data = made.get("data") or made.get("partialData") or {}
        node, submit, rid, state, raw = result_of(data)
        if not ((raw.get("validation") or {}).get("reasonCode") == "VIDEO_FIRST_FRAME_UNAVAILABLE" and k_try < 2):
            break
        time.sleep(60)
    row = {"판": b["id"], "길": "드리미나 CLI", "모드": mode, "길이": b["길이"], "비율": b["비율"], "nodeId": node, "submitId": submit, "resourceId": rid,
           "상태": state, "상한": ceiling, "걸린초": round(time.time() - t0), "지시문": prompt, "오류": made.get("error"), "답": raw if not rid else None}
    if b["id"] in IGNORED:   # 지시문 걸림을 --걸림무시로 넘겨 낸 판 — 까닭을 그 판 줄에 남긴다(11-10)
        row["걸림무시"] = IGNORED[b["id"]]
    key = submit or f"{b['id']}-{int(t0)}"
    if state == "failed" and submit:   # 실패 코드(11-05 20114 등)를 기록에 남긴다
        try:
            st = cli("operation", "wait", submit, "--project-id", PROJECT, "--timeout", "20s", check=False, timeout=60)
            row["실패코드"] = [r.get("serviceCode") for r in ((st.get("data") or {}).get("resources") or [])]
        except Exception:
            pass
    if not made.get("ok") or not rid:
        save(out, key, row)
        with lock:
            print(f"  ⚠ {b['id']} 안 끝남: {json.dumps(made.get('error') or state, ensure_ascii=False)[:300]} — 다시 내지 않음(기록의 submitId로 확인)", flush=True)
        return b["id"]
    save(out, key, row)   # 받기가 막혀도 구운 판의 id는 남긴다
    name = pick_name(out, b["id"])
    os.makedirs(out, exist_ok=True)
    dst = os.path.join(out, name)
    for mark_try in range(3):   # 표시가 있으면 같은 resourceId로 다시 받는다(크레딧 0)
        if os.path.exists(dst):
            os.remove(dst)
        for n_try in range(3):   # 11-04 일곱 판 동시 받기에서 한 번이 30분 넘게 멈췄다 — 끊고 다시 받는다(다시 받기는 크레딧이 나가지 않는다)
            try:
                cli("resource", "download", rid, "--project-id", PROJECT, "-o", dst, timeout=180)
                break
            except subprocess.TimeoutExpired:
                if n_try == 2:
                    raise
        try:
            row["표시"] = mark_score(dst)
        except Exception as e:   # 재기가 막혀도 받은 파일은 남기고 알린다
            row["표시"] = f"못 잼: {e}"[:200]
            break
        if row["표시"] < MARK_AT:
            break
        time.sleep(20)
    row["파일"], row["걸린초"] = name, round(time.time() - t0)
    save(out, key, row)
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    save(out, key, {"판": b["id"], "순서": b.get("순서", 0), "파일": name, "만든때": now, "받은때": now, "길이": b["길이"], "비율": b["비율"], "화질": "720p",
                    "소리": True, "모델": "dreamina seedance_2.5", "길": f"드리미나 CLI({PROFILE or '기본'})", "지시문": prompt}, "_받음.json")
    mark = row["표시"]
    warn = f"  ⚠ 표시가 남음({mark}) — 계정 설정 「워터마크 삭제」를 보고 같은 resourceId로 다시 받는다" if not isinstance(mark, float) or mark >= MARK_AT else ""
    with lock:
        print(f"받음 {b['id']:<14} → {name} · {row['걸린초']}초 걸림 · 표시 {mark}{warn}", flush=True)


def safe(*a):
    try:
        return run_one(*a)
    except Exception as e:
        print(f"  ⚠ {a[2]['id']} 못 냄: {e}", flush=True)
        return a[2]["id"]


def main():
    a = sys.argv[1:]
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d
    global PROFILE, PROJECT, PER_SEC
    cap, conc, go, out = opt("--상한", None), int(opt("--동시", "3")), "--실행" in a, opt("--받을곳", None)
    PROFILE = opt("--계정", None)
    PER_SEC = PER_SEC_OF.get(PROFILE, PER_SEC_OF[None])
    if PROFILE:
        PROJECT = open(os.path.join(HOME, f"캔버스_{PROFILE}.txt"), encoding="utf-8").read().strip()
    ignore, table = 인자값(a, "--걸림무시"), 인자값(a, "--컷표")
    if ignore is not None and not ignore.strip():
        raise SystemExit(f"--걸림무시에는 까닭을 적는다: {무시쓰는법}")
    if table is not None and not (table and os.path.exists(table)):
        raise SystemExit(f"--컷표 파일이 없다: {table or '(경로 없음)'}")
    vals = {a.index(k) + 1 for k in ("--상한", "--동시", "--받을곳", "--계정", "--걸림무시", "--컷표") if k in a}
    pos = [x for i, x in enumerate(a) if not x.startswith("--") and i not in vals]
    if not pos:
        raise SystemExit('쓰는 법: python -X utf8 드리미나내기.py <꾸러미> [<꾸러미>…] [<판>…] [--받을곳 폴더] [--상한 크레딧] [--동시 3] [--계정 ultra] [--컷표 컷순서.json] [--걸림무시 "판 id,…: 까닭"] [--실행]')
    # 꾸러미를 여럿 줄 수 있다(11-05) — 폴더인 인자는 꾸러미, 나머지는 판 id. 한 프로세스로 내야 장부(_드리미나.json · _받음.json)를 두 프로세스가 덮어쓰지 않는다
    packs = [os.path.abspath(x) for x in pos if os.path.isdir(x)]
    want = [x for x in pos if not os.path.isdir(x)]
    if not packs:
        raise SystemExit(f"꾸러미 폴더가 없다: {pos[0]}")
    pack0 = packs[0]
    out = out or (os.path.join(DAY, "받음", "_드리미나비교") if pack0.replace("\\", "/").startswith(DAY) else os.path.join(os.path.dirname(pack0), "받음"))
    bs = [(p, b) for p in packs for b in boards(p)]
    ids = {b["id"] for _, b in bs}
    miss = [w for w in want if w not in ids]
    if miss:
        raise SystemExit(f"꾸러미에 없는 판: {miss}")
    todo, held = [], []
    for p, b in (bs if not want else [next(x for x in bs if x[1]["id"] == w) for w in want]):
        lost = list(b.get("빠진 파일") or []) + [f for f in b["파일"] if not os.path.exists(os.path.join(p, b["폴더"], f))]
        if lost:
            held.append(f"{b['id']}(빠짐 {', '.join(sorted(set(lost)))})")
            continue
        todo += [(p, b)] if want else [(p, b)] * max(0, b["판 수"] - have(out, b["id"]))
    total = sum(PER_SEC * b["길이"] for _, b in todo)
    bal = balance()
    print(f"잔액 {bal} · 칸 {PROFILE or '기본'} · 받을곳 {out}")
    for p, b in todo:
        s, e, r, au = split_media(p, b)
        print(f"  {b['id']:<18} {b['길이']}초 {b['비율']} · {PER_SEC * b['길이']}크레딧 · {mode_of(s, e, r, au)} · 시작 {len(s)} 끝 {len(e)} 참고 {len(r)} 소리 {len(au)} · {os.path.basename(p)}")
    print(f"낼 것 {len(todo)}판 · {sum(b['길이'] for _, b in todo)}초 · {total}크레딧" + (f" · 건너뜀 {len(held)}: {' · '.join(held)}" if held else ""))
    if todo:   # 지시문 검사 — 미리 보기에서도 찍고, 걸림이면 --실행이어도 여기서 멈춘다(--걸림무시 "<판 id>,…: <까닭>"이면 그 판만 지나가고 장부에 남는다)
        IGNORED.update(굽기전(todo, ignore, table))
    limit = min(float(cap) if cap else bal, bal)
    if total > limit:
        raise SystemExit(f"멈춤: 견적 {total}크레딧이 상한 {cap or '-'} · 잔액 {bal}을 넘는다.")
    if not go or not todo:
        print("미리 보기만 했다 — 내려면 --실행" if todo else "낼 판이 없다")
        return
    with ThreadPoolExecutor(conc) as ex:
        bad = [x for x in ex.map(lambda pb: safe(pb[0], out, pb[1]), todo) if x]
    print(f"\n끝 · 잔액 {bal} → {balance()} (견적 {total})" + (f" · 못 낸 판 {bad}" if bad else ""))
    for p in dict.fromkeys(p for p, _ in todo):   # 받은 판을 바로 잰다(크레딧내기.받은뒤 — 컷표 틀 2가 있는 꾸러미만)
        받은뒤(p, out, table, [b["id"] for q, b in todo if q == p and not b.get("소리만") and b.get("방식") != "목소리 판"])


if __name__ == "__main__":
    main()
