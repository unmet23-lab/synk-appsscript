# 시댄스 2.5 크레딧 길 — 급한 판을 CLI로 우선 대기열에 내고 받는다(2026-11-04, 유호님 「응, 그렇게 해」 — 새 계정 이벤트에 딸린 크레딧으로 급한 판부터).
#   python -X utf8 크레딧내기.py <꾸러미 폴더> [<판 id>…] [--계정 founder] [--상한 1000] [--동시 3] [--컷표 <컷순서.json>] [--걸림무시 "<판 id>,…: <까닭>"] [--실행]
#   기본은 미리 보기(낼 판 · 초 · 크레딧 · 잔액)만 찍는다. --실행일 때만 낸다. 견적이 --상한(안 주면 잔액)을 넘으면 내지 않는다.
# 내기 전에 낼 판의 지시문을 스스로 검사한다(11-10, 굽기전 — tools/컷연속성검사.py의 굽기전검사): 사람을 굳히는 낱말 · 박자 없는 사람 연기 · 손 없이 움직이는 물건 ·
#   실내의 눈 · ACTION 칸 없는 사람 지시문이 걸리면 미리 보기에서도 찍고 --실행이어도 내지 않는다(검사를 사람이 기억해서 부르던 11-07~10에는 제출 115번 가운데 많아야 10번만 돌았다).
#   지시문 쓰는 법은 docs/마케팅/제작양식/영상양식/지시문_틀.md, 입구는 synk-video 스킬.
#   컷표(--컷표, 안 주면 꾸러미 폴더나 그 한 층 위의 컷표.json)가 있으면 표 검사와 판마다 장면의 빛 문장 대조도 함께 돌고, 그 컷의 「인물」에 이름이 있는 판은 ACTION 칸과 박자 둘 이상을 요구한다.
#   _순서.json 판에 더 적을 수 있는 칸: "컷": ["C2"](대안 판 C2b를 그 컷에 잇는다) · "소리만": true나 "방식": "목소리 판"(그림을 안 쓰는 판 — 컷표 대조 · 사람 연기 검사를 건너뛴다) ·
#     "인물": ["이름"](컷표 없는 편에서 사람이 나오는 판임을 밝힌다) · "실내": true.
#   그래도 내야 하면 --걸림무시 "<판 id>,<판 id>: <까닭>"(그 판의 걸림만 — 컷표의 걸림은 「컷표」) 또는 --걸림무시 "모두: <까닭>" — 까닭은 _크레딧내기.json 그 판 줄의 「걸림무시」 칸에 남는다.
#     그 밖의 꼴(판 이름 없는 까닭 · 낼 판에 없는 이름)은 거절한다 — 어긋난 값 하나로 걸린 판이 모두 넘어가지 않게.
# 꾸러미: _순서.json이 있는 웹올리기 폴더, 또는 순서표.md만 있는 폴더(서울 자전거 「다녀왔어」 — 「판 수」만큼 같은 지시문으로 여러 번).
#   판을 안 주면 받을곳에 아직 없는 판 전부(판 수만큼), 판을 주면 받은 것이 있어도 다시 낸다. 빠진 파일이 있는 판은 건너뛰고 알린다.
# 무제한은 웹에서 사람만(결정 10-26) — 이 도구는 크레딧 생성만 낸다(약관 10.6의 자동화 제한은 무제한 몫).
# 웹과 같은 꼴로 낸다: 1_시작 → start_image, 2_끝 → end_image, 그 밖의 그림 → image_references, mp3 → audio_references,
#   지시문의 @이미지 N · @오디오 N은 웹이 서버에 보내는 <<<image_N>>> · <<<audio_N>>>로, 720p · bitrate high · 소리는 판대로.
#   첫 판은 혼자 내고 서버가 받은 참고 차례가 웹(시작 · 끝 · 그림 · 소리)과 같은지 본 뒤 나머지를 낸다 — 다르면 멈춘다.
# 받은 영상: 받을곳/<판>.mp4(같은 판 둘째부터 __2 …) — 받을곳은 DAY 아래 꾸러미면 DAY/받음, 아니면 꾸러미 옆 받음/.
#   기록은 받을곳/_받음.json(받기.py와 같은 꼴, 받은 판만)과 DAY/받음/_크레딧내기.json(실패 포함 — 받기.py가 이 판들을 건너뛰고 거래 내역에서 뺀다).
#   받기.py와 같은 때에 돌리지 않는다(둘 다 _받음.json을 통째로 다시 쓴다).
# 받은 뒤(11-14): 컷표(틀 2)가 있는 편은 낸 판을 받자마자 tools/받은뒤검사.py로 잰다(길이 · 비율 · 소리 줄기 · 사람 굳음 + 컷표의 받음 검사) —
#   결과는 받을곳/_받은뒤검사.json과 화면의 「다시 낼 판」. 내기 결과는 바꾸지 않는다.
# nsfw · 실패는 다시 내지 않고 알린다(현장노트 higgsfield 「같은 장면이 nsfw로 두 번 막힌다」).
import json, os, re, shutil, subprocess, sys, threading
from concurrent.futures import ThreadPoolExecutor

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
LEDGER = os.path.join(DAY, "받음", "_크레딧내기.json")
PIC = (".jpg", ".jpeg", ".png", ".webp")
TAG = {"이미지": "image", "오디오": "audio", "영상": "video"}
lock = threading.Lock()
IGNORED = {}   # 판 id → 까닭 — --걸림무시로 지시문 걸림을 넘겨 낸 판(장부의 「걸림무시」 칸)


def 인자값(a, k):
    """값을 받는 인자 — 안 줬으면 None, 값 없이 끝났거나 다음이 --로 시작하면 빈 글(부른 쪽이 거절한다)"""
    if k not in a:
        return None
    i = a.index(k) + 1
    return a[i] if i < len(a) and not a[i].startswith("--") else ""


def 검사기():
    """tools/컷연속성검사.py — 꾸러미점검.py와 같은 길(저장소 뿌리/tools)로 부른다. 낼 때만 부르니 이 파일을 import하는 것만으로는 읽지 않는다."""
    from pathlib import Path
    tools = str(Path(__file__).resolve().parents[4] / "tools")
    if tools not in sys.path:
        sys.path.insert(0, tools)
    import 컷연속성검사
    return 컷연속성검사


def 컷표찾기(pack):
    """꾸러미 폴더나 그 한 층 위의 컷표.json(편 폴더 꼴: <편>/컷표.json · <편>/꾸러미/_순서.json)"""
    for d in (pack, os.path.dirname(pack)):
        p = os.path.join(d, "컷표.json")
        if os.path.exists(p):
            return p
    return None


무시쓰는법 = '--걸림무시는 "<판 id>,<판 id>: <까닭>"(그 판의 걸림만 — 컷표의 걸림은 「컷표」) 또는 "모두: <까닭>"으로 적는다'


def 무시풀기(무시까닭, 판ids):
    """--걸림무시 값 → (넘길 이름 집합 | None(걸린 것 모두), 까닭). 꼴은 둘뿐이다:
    "<판 id>[,<판 id>…]: <까닭>" — 그 판의 걸림만 넘긴다(컷표 표 검사의 걸림은 「컷표」). 다른 판의 걸림은 그대로 막는다. 판 이름 사이는 쉼표 · 빈칸 · 가운뎃점 어느 것이든.
    "모두: <까닭>" — 걸린 것 모두.
    그 밖의 값(쌍점이 없다 · 까닭이 비었다 · 쌍점 앞에 낼 판에 없는 이름이 있다)은 거절한다 — 어긋난 값 하나로 걸린 판이 모두 넘어가지 않게(11-10 검수)."""
    m = re.match(r"^\s*([^:：]*?)\s*[:：]\s*(\S.*?)\s*$", 무시까닭, re.S)
    이름 = [s for s in re.split(r"[,\s·、]+", m.group(1)) if s] if m else []
    if not 이름:
        raise SystemExit(f"{무시쓰는법} — 받은 값: {무시까닭!r}")
    if 이름 == ["모두"]:
        return None, m.group(2)
    없는 = [s for s in 이름 if s != "컷표" and s not in 판ids]
    if 없는:
        raise SystemExit(f'{무시쓰는법} — 낼 판에 없는 이름: {" · ".join(없는)}')
    return set(이름), m.group(2)


def 굽기전(판목록, 무시까닭=None, 컷표=None):
    """낼 판의 지시문을 내기 전에 스스로 검사한다(11-10) — 크레딧내기 · 드리미나내기가 함께 쓴다. 계정 · 잔액 · 네트워크를 부르지 않는다.
    판목록: [(꾸러미 폴더, 판)] — 판은 boards()의 한 줄(_순서.json의 그 줄: id · 폴더 · "실내" · "컷" · "인물" · "방식" · "소리만"). 같은 판(같은 꾸러미 · 같은 판 폴더 · 같은 id)이 여러 번 들어 있어도 한 번만 본다.
    한 꾸러미에 같은 id의 판이 둘이면 둘 다 검사하고 걸림으로 알린다.
    판마다 <꾸러미>/<판 폴더>/지시문.txt를 tools/컷연속성검사.py의 굽기전검사(물건 · 실내 + 사람 정지 낱말 · 박자 · ACTION 칸 · 시작 첫 줄)로 보고,
    컷표(안 주면 꾸러미 폴더나 그 한 층 위의 컷표.json)가 있으면 표 검사와 판마다 그 컷 장면의 빛 문장 대조를 더한다(없으면 알림 한 줄).
    판을 컷에 잇고 사람이 나오는 판인지 정하는 일은 검사 도구의 판정보()가 한다 — 판 id = 컷 이름 · <편>-<컷> · 컷의 「판」 · 판 폴더 이름 · 판의 "컷": ["C2"](대안 판).
    그 컷의 「인물」에 이름이 있으면 사람 판(ACTION 칸 · 박자 둘 이상), []여도 글에 사람이 나오면 「표 어긋남」으로 걸고, 정지 말은 어느 판에서든 본다.
    소리만 쓰는 판("방식": "목소리 판" · "소리만": true)은 컷표에 없어도 되고 사람 연기를 보지 않는다.
    걸림 · 주의를 판 id와 함께 찍고, 걸림이 하나라도 있으면 SystemExit — 무시까닭이 있으면 그 까닭이 넘기는 판만 지나가고 {판 id: 까닭}을 돌려준다(장부 「걸림무시」 칸).
    검사기를 못 불렀을 때는 「모두: <까닭>」일 때만 지나간다(판 이름을 골라 넘긴 값으로는 멈춘다).
    무시까닭: "<판 id>,<판 id>: <까닭>"은 그 판의 걸림만(컷표의 걸림은 「컷표」), "모두: <까닭>"은 걸린 것 모두 — 넘기지 않은 걸림이 남으면 멈추고, 그 밖의 꼴은 거절한다(무시풀기).
    프리비즈 판(id pv…, 움직임을 참고 영상에서 받는다)은 꾸러미점검.py처럼 건너뛴다."""
    if 무시까닭 is not None and not str(무시까닭).strip():
        raise SystemExit(f"--걸림무시에는 까닭을 적는다: {무시쓰는법}")
    if 컷표 and not os.path.exists(컷표):
        raise SystemExit(f"--컷표 파일이 없다: {컷표}")
    넘김, 까닭 = 무시풀기(str(무시까닭), {str(b["id"]) for _, b in 판목록}) if 무시까닭 is not None else (None, None)
    try:
        검사 = 검사기()
    except Exception as e:   # 검사기를 못 부르면 검사 없이 내지 않는다 — 판을 골라 넘긴 값으로도 못 지나간다(고른 판 밖의 판까지 검사 없이 나간다)
        if 무시까닭 is None or 넘김 is not None:
            raise SystemExit(f'멈춤: 검사기(tools/컷연속성검사.py)를 못 불러 지시문을 검사하지 못했다 — {e}. 그래도 내야 하면 --걸림무시 "모두: <까닭>"')
        print(f"  ⚠ 검사기를 못 불러 지시문을 검사하지 못했다({e}) — 까닭: {까닭}")
        return {b["id"]: f"{까닭} (검사기를 못 불러 검사 못 함)" for _, b in 판목록}
    줄 = []   # (등급, 어디, 글)
    읽은표, 걸린표, 걸린판 = {}, set(), set()

    def 표(pack):
        경로 = 컷표 or 컷표찾기(pack)
        if not 경로:
            줄.append(("알림", os.path.basename(pack), "컷표 없음 — 표 검사 건너뜀"))
            return None, None
        경로 = os.path.abspath(경로)
        if 경로 not in 읽은표:
            seq = 검사.장면실내채움(json.load(open(경로, encoding="utf-8")))
            r = 검사.결과()
            검사.표검사(seq, r)
            for x in r.항목들:
                if x["등급"] != "통과":
                    줄.append((x["등급"], f"컷표 {x['컷']}", f"[{x['항목']}] {x['글']}"))
                if x["등급"] == "걸림":
                    걸린표.add(경로)
            읽은표[경로] = seq
        return 경로, 읽은표[경로]

    본, 본id, 판의표 = set(), {}, {}
    for pack, b in 판목록:
        pack = os.path.abspath(pack)
        판id, 폴더 = str(b["id"]), str(b["폴더"])
        if (pack, 폴더, 판id) in 본:   # 같은 판을 판 수만큼 여러 번 내는 것 — 한 번만 본다(폴더를 함께 쓰는 다른 id의 줄은 따로 본다)
            continue
        본.add((pack, 폴더, 판id))
        if 본id.setdefault((pack, 판id), 폴더) != 폴더:   # 넘김 · 장부가 판 id로 가리니, 한 꾸러미에 같은 id가 둘이면 가를 수 없다 — 둘 다 검사하고 알린다
            줄.append(("걸림", 판id, f"한 꾸러미에 같은 판 id가 둘이다({본id[(pack, 판id)]} · {폴더}) — _순서.json에서 id를 고친다"))
        if pack not in 판의표:
            판의표[pack] = 표(pack)
        _, seq = 판의표[pack]
        정보 = 검사.판정보(b, seq)   # 그 판의 컷 · 인물 · 소리만 · 실내 · 프리비즈 — 검사 도구의 --지시문과 같은 함수
        if 정보["프리비즈"]:
            줄.append(("알림", 판id, "프리비즈 판 — 지시문 검사 건너뜀(움직임을 참고 영상에서 받는다, 꾸러미점검과 같다)"))
            continue
        f = os.path.join(pack, 폴더, "지시문.txt")
        if not os.path.exists(f):
            줄.append(("걸림", 판id, f"지시문.txt가 없다: {f}"))
            continue
        글 = open(f, encoding="utf-8").read()
        hits = list(검사.굽기전검사(글, 정보["실내"], 정보["인물"], 정보["소리만"], 정보["박자최소"]))
        if 정보["소리만"]:   # 그림을 쓰지 않는 판 — 컷표에 없어도 되고 빛 문장도 견주지 않는다
            hits.append(("알림", "소리만 쓰는 판 — 사람 연기 · 컷표 대조 건너뜀"))
        elif seq and 검사.틀둘(seq):
            if not 정보["컷들"]:   # 컷표(틀 2)가 있는 편은 표에 적힌 컷의 판만 낸다 — 표에 없는 판은 연기 · 구도 · 빛 검사를 하나도 안 거친 판이다(11-10)
                hits.append(("걸림", f"(컷표) 컷표에 없는 판 — {검사.컷표에없는판}"))
            else:
                hits += [(등급, f"(빛) {말}") for 등급, 말 in 검사.빛대조(seq, 정보["컷들"], 글)]
        for 등급, 말 in hits:
            줄.append((등급, 판id, 말))
    표시 = {"걸림": "✗", "확인": "?", "주의": "~", "알림": "·"}
    for 등급, 어디, 말 in 줄:
        print(f"  {표시.get(등급, '·')} {어디}: {말}")
        if 등급 == "걸림" and not 어디.startswith("컷표 "):
            걸린판.add(어디)
    n = {g: sum(1 for 등급, _, _ in 줄 if 등급 == g) for g in 표시}
    print(f"지시문 검사: 걸림 {n['걸림']} · 주의 {n['주의']}" + (f" · 확인 {n['확인']}" if n["확인"] else ""))
    if not n["걸림"]:
        return {}
    if 무시까닭 is None:
        raise SystemExit(f'멈춤: 지시문 걸림 {n["걸림"]} — 고친 뒤 다시 낸다(사람을 굳히는 낱말 · 손 없이 움직이는 물건 · 실내의 눈 · 컷표). 쓰는 법: docs/마케팅/제작양식/영상양식/지시문_틀.md. '
                         '그래도 내야 하면 --걸림무시 "<판 id>,<판 id>: <까닭>"(그 판만) · --걸림무시 "모두: <까닭>"')
    걸린이름 = set(걸린판) | ({"컷표"} if 걸린표 else set())
    남음 = sorted(걸린이름 - 넘김) if 넘김 is not None else []
    if 남음:   # 판을 골라 넘겼는데 다른 판의 걸림이 남았다 — 그 판은 고치거나 이름을 더 적는다
        raise SystemExit(f'멈춤: 지시문 걸림 {n["걸림"]} — --걸림무시가 넘기지 않은 걸림이 남았다: {" · ".join(남음)}. 고치거나 그 이름을 --걸림무시 "<판 id>,…: <까닭>"에 더한다')
    표넘김 = 넘김 is None or "컷표" in 넘김
    print(f"걸림 {n['걸림']}개를 넘겨 낸다 — 까닭: {까닭}(장부의 「걸림무시」 칸에 남긴다)")
    return {b["id"]: 까닭 for pack, b in 판목록 if str(b["id"]) in 걸린판 or (표넘김 and 판의표.get(os.path.abspath(pack), (None, None))[0] in 걸린표)}


def 받은뒤(pack, out, 컷표=None, 판ids=None, 더=None):
    """받은 판을 바로 잰다(tools/받은뒤검사.py, 11-14) — 길이 · 비율 · 소리 줄기 · 사람 굳음과 컷표의 받음 검사. 크레딧내기 · 드리미나내기가 받은 직후 함께 쓴다.
    컷표(틀 2)가 있는 편에서만 돈다(없으면 None). 판ids는 이번에 낸 판(소리만 쓰는 판은 빼고 준다) — 빈 목록이면 돌지 않는다.
    내기 결과는 바꾸지 않는다: 검사의 끝 코드(0 통과 · 1 다시 낼 판 · 2 확인)를 돌려주고, 못 돌리면 한 줄로 알리고 None."""
    경로 = 컷표 or 컷표찾기(pack)
    if not 경로 or (판ids is not None and not 판ids):
        return None
    try:
        if json.load(open(경로, encoding="utf-8-sig")).get("틀") != 2:
            return None
        from pathlib import Path
        도구 = Path(__file__).resolve().parents[4] / "tools" / "받은뒤검사.py"
        명령 = [sys.executable, "-X", "utf8", str(도구), os.path.dirname(os.path.abspath(경로)), "--컷표", 경로, "--꾸러미", pack, "--받음", out]
        if 판ids:
            명령 += ["--판", ",".join(dict.fromkeys(str(x) for x in 판ids))]
        r = subprocess.run(명령 + list(더 or []), capture_output=True, text=True, encoding="utf-8")
        print("\n" + (r.stdout.strip() or r.stderr.strip()[:400]), flush=True)
        return r.returncode
    except Exception as e:   # 받은 판은 이미 받았다 — 검사를 못 돌려도 내기를 깨뜨리지 않는다
        print(f"\n받은 뒤 검사를 못 돌렸다({type(e).__name__}: {e}) — python -X utf8 tools/받은뒤검사.py <편 폴더>를 따로 돌린다", flush=True)
        return None


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
        row = {"판": b["id"], "계정": acct, "받을곳": out, "파일": name, "상태": job.get("status"),
               "만든때": job.get("created_at"), "크레딧": cost}
        if b["id"] in IGNORED:   # 지시문 걸림을 --걸림무시로 넘겨 낸 판 — 까닭을 그 판 줄에 남긴다(11-10)
            row["걸림무시"] = IGNORED[b["id"]]
        save(LEDGER, jid, row)
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
    ignore, table = 인자값(a, "--걸림무시"), 인자값(a, "--컷표")
    if ignore is not None and not ignore.strip():
        raise SystemExit(f"--걸림무시에는 까닭을 적는다: {무시쓰는법}")
    if table is not None and not (table and os.path.exists(table)):
        raise SystemExit(f"--컷표 파일이 없다: {table or '(경로 없음)'}")
    vals = {a.index(k) + 1 for k in ("--계정", "--상한", "--동시", "--걸림무시", "--컷표") if k in a}
    pos = [x for i, x in enumerate(a) if not x.startswith("--") and i not in vals]
    if not pos:
        raise SystemExit('쓰는 법: python -X utf8 크레딧내기.py <꾸러미> [<판>…] [--계정 이름] [--상한 크레딧] [--동시 3] [--컷표 컷순서.json] [--걸림무시 "판 id,…: 까닭"] [--실행]')
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
    if todo:   # 지시문 검사 — 미리 보기에서도 찍고, 걸림이면 --실행이어도 여기서 멈춘다(--걸림무시 "<판 id>,…: <까닭>"이면 그 판만 지나가고 장부에 남는다)
        IGNORED.update(굽기전([(pack, b) for b in todo], ignore, table))
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
    받은뒤(pack, out, table, [b["id"] for b in todo if not b.get("소리만") and b.get("방식") != "목소리 판"])   # 받은 판을 바로 잰다 — 굳은 판은 여기서 「다시 낼 판」으로 나온다


if __name__ == "__main__":
    main()
