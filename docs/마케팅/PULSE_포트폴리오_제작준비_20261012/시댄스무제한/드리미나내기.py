# 드리미나 시댄스 2.5 — 꾸러미 판을 공식 CLI(dreamina-canvas)로 내고 받는다(2026-11-04, 유호님 「필요하면 cli 설치하고 진행해도돼」).
#   python -X utf8 드리미나내기.py <꾸러미 폴더> [<판 id>…] [--받을곳 <폴더>] [--상한 크레딧] [--동시 3] [--실행]
#   기본은 미리 보기(낼 판 · 초 · 크레딧 · 잔액)만 찍는다. --실행일 때만 낸다. 견적이 --상한(안 주면 잔액)을 넘으면 내지 않는다.
# 판 읽기는 크레딧내기.py의 boards()와 같다(_순서.json 또는 순서표.md). 판을 안 주면 받을곳에 아직 없는 판 전부(판 수만큼), 판을 주면 판마다 한 번씩만 낸다.
# 입력: 소리 · 끝 외 참고 · 두 샷이 없으면 first_last_frame(시작 · 끝 프레임을 서버가 프레임으로 받음),
#   소리나 참고 그림이 있으면 m2v(옴니 레퍼런스) — 이때 시작 그림은 참고일 뿐 프레임으로 고정되지 않는다(CLI · 웹 모두 첫 프레임과 소리를 함께 받는 칸이 없다).
#   지시문의 @이미지 N · @오디오 N은 올린 파일의 {{res:<id>}}로 바꾼다. 비율은 판대로(CLI 필수), 720p, 소리 끄는 칸은 없다 — 소리 끔 판도 소리가 붙어 나오면 쓸 때 뺀다.
# 받은 파일: 계정 설정 「AI 워터마크 삭제」가 꺼져 있으면 왼쪽 위에 「AI」 표시가 박힌다 — 11-04 켰고, 이미 구운 판도 같은 resourceId로 다시 받으면 표시 없는 파일이 온다(크레딧 0, README 「드리미나 비교(11-04)」). 첫 프레임 판은 크기가 시작 그림 비율을 따른다(2752x1536 → 1284x716).
#   파일 머리의 프레임률이 60으로 적혀 재기.py 등이 장을 겹쳐 읽는다 — 실제 97장 · 24fps라 잴 때는 fps=24로 옮겨 잰다.
# 값: 720p 초당 37크레딧(11-04 기본 요금제 화면 · 실제 차감, 받은 뒤 잔액으로 다시 잰다). 영상 받은 것은 받을곳/<판>.mp4(둘째부터 __2), 기록은 받을곳/_드리미나.json.
# 끊기면 다시 내지 않는다 — 기록에 submitId가 있으니 그 id로 `dreamina-canvas operation wait <submitId> --project-id <캔버스>`를 본다.
import json, os, re, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from 크레딧내기 import boards, PIC

HOME = os.path.join(os.path.expanduser("~"), ".ai-tools", "dreamina-canvas")
EXE = os.path.join(HOME, "dreamina-canvas.exe")
DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
PROJECT = open(os.path.join(HOME, "캔버스.txt"), encoding="utf-8").read().strip()   # 내는 캔버스 id — 공개 저장소라 git 밖에 둔다
PER_SEC = 37
lock = threading.Lock()
TAKEN = []


def cli(*args, check=True, timeout=3000):
    r = subprocess.run([EXE, "--format", "json", "--non-interactive", *args], capture_output=True, text=True, encoding="utf-8", timeout=timeout)
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


def save(out, key, row):
    p = os.path.join(out, "_드리미나.json")
    with lock:
        led = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
        led[key] = row
        os.makedirs(out, exist_ok=True)
        json.dump(led, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


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
    image_ids = [upload(pack, b, f) for f in start + end + refs]
    audio_ids = [upload(pack, b, f) for f in audio]
    prompt = build_prompt(pack, b, image_ids, audio_ids)
    ref_args = [x for i in image_ids + audio_ids for x in ("--ref", f"res:{i}")]
    ceiling = PER_SEC * b["길이"]
    with lock:
        print(f"냄 {b['id']:<14} {mode} {b['길이']}초 상한 {ceiling}", flush=True)
    made = cli("node", "create", "video", "--model", "seedance_2.5", "--mode", mode, *ref_args, "--prompt", prompt, "--ratio", b["비율"],
               "--resolution", "720p", "--duration", str(b["길이"]), "--title", b["id"], "--project-id", PROJECT,
               "--run", "--credit-ceiling", str(ceiling), "--wait", "--timeout", "45m", check=False)
    data = made.get("data") or made.get("partialData") or {}
    node, submit, rid, state, raw = result_of(data)
    row = {"판": b["id"], "길": "드리미나 CLI", "모드": mode, "길이": b["길이"], "비율": b["비율"], "nodeId": node, "submitId": submit, "resourceId": rid,
           "상태": state, "상한": ceiling, "걸린초": round(time.time() - t0), "지시문": prompt, "오류": made.get("error"), "답": raw if not rid else None}
    key = submit or f"{b['id']}-{int(t0)}"
    if not made.get("ok") or not rid:
        save(out, key, row)
        with lock:
            print(f"  ⚠ {b['id']} 안 끝남: {json.dumps(made.get('error') or state, ensure_ascii=False)[:300]} — 다시 내지 않음(기록의 submitId로 확인)", flush=True)
        return b["id"]
    save(out, key, row)   # 받기가 막혀도 구운 판의 id는 남긴다
    with lock:   # CLI는 있는 파일에 받지 않는다 — 빈 파일로 자리를 잡지 않고 이름만 메모리에 잡는다
        n = have(out, b["id"]) + sum(1 for x in TAKEN if x == b["id"])
        TAKEN.append(b["id"])
    name = f"{b['id']}.mp4" if not n else f"{b['id']}__{n + 1}.mp4"
    os.makedirs(out, exist_ok=True)
    for n_try in range(3):   # 11-04 일곱 판 동시 받기에서 한 번이 30분 넘게 멈췄다 — 끊고 다시 받는다(다시 받기는 크레딧이 나가지 않는다)
        try:
            cli("resource", "download", rid, "--project-id", PROJECT, "-o", os.path.join(out, name), timeout=180)
            break
        except subprocess.TimeoutExpired:
            if n_try == 2:
                raise
    row["파일"], row["걸린초"] = name, round(time.time() - t0)
    save(out, key, row)
    with lock:
        print(f"받음 {b['id']:<14} → {name} · {row['걸린초']}초 걸림", flush=True)


def safe(*a):
    try:
        return run_one(*a)
    except Exception as e:
        print(f"  ⚠ {a[2]['id']} 못 냄: {e}", flush=True)
        return a[2]["id"]


def main():
    a = sys.argv[1:]
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d
    cap, conc, go, out = opt("--상한", None), int(opt("--동시", "3")), "--실행" in a, opt("--받을곳", None)
    vals = {a.index(k) + 1 for k in ("--상한", "--동시", "--받을곳") if k in a}
    pos = [x for i, x in enumerate(a) if not x.startswith("--") and i not in vals]
    if not pos:
        raise SystemExit("쓰는 법: python -X utf8 드리미나내기.py <꾸러미> [<판>…] [--받을곳 폴더] [--상한 크레딧] [--동시 3] [--실행]")
    pack, want = os.path.abspath(pos[0]), pos[1:]
    out = out or (os.path.join(DAY, "받음", "_드리미나비교") if pack.replace("\\", "/").startswith(DAY) else os.path.join(os.path.dirname(pack), "받음"))
    bs = boards(pack)
    miss = [w for w in want if w not in {b["id"] for b in bs}]
    if miss:
        raise SystemExit(f"꾸러미에 없는 판: {miss}")
    todo, held = [], []
    for b in (bs if not want else [b for w in want for b in bs if b["id"] == w]):
        lost = list(b.get("빠진 파일") or []) + [f for f in b["파일"] if not os.path.exists(os.path.join(pack, b["폴더"], f))]
        if lost:
            held.append(f"{b['id']}(빠짐 {', '.join(sorted(set(lost)))})")
            continue
        todo += [b] if want else [b] * max(0, b["판 수"] - have(out, b["id"]))
    total = sum(PER_SEC * b["길이"] for b in todo)
    bal = balance()
    print(f"잔액 {bal} · 받을곳 {out}")
    for b in todo:
        s, e, r, au = split_media(pack, b)
        print(f"  {b['id']:<14} {b['길이']}초 {b['비율']} · {PER_SEC * b['길이']}크레딧 · {mode_of(s, e, r, au)} · 시작 {len(s)} 끝 {len(e)} 참고 {len(r)} 소리 {len(au)}")
    print(f"낼 것 {len(todo)}판 · {sum(b['길이'] for b in todo)}초 · {total}크레딧" + (f" · 건너뜀 {len(held)}: {' · '.join(held)}" if held else ""))
    limit = min(float(cap) if cap else bal, bal)
    if total > limit:
        raise SystemExit(f"멈춤: 견적 {total}크레딧이 상한 {cap or '-'} · 잔액 {bal}을 넘는다.")
    if not go or not todo:
        print("미리 보기만 했다 — 내려면 --실행" if todo else "낼 판이 없다")
        return
    with ThreadPoolExecutor(conc) as ex:
        bad = [x for x in ex.map(lambda b: safe(pack, out, b), todo) if x]
    print(f"\n끝 · 잔액 {bal} → {balance()} (견적 {total})" + (f" · 못 낸 판 {bad}" if bad else ""))


if __name__ == "__main__":
    main()
