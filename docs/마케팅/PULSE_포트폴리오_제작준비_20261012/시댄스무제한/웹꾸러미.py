# PULSE 포트폴리오 시댄스 2.5 1일 무제한 — 여러 편을 한 순서표로 묶는 웹 꾸러미(2026-10-28).
#   python -X utf8 웹꾸러미.py          → synk-vendor/pulse-seedance-day-20261028/웹올리기/<순번>_<판>/ · 순서표.html · _순서.json
#   python -X utf8 웹꾸러미.py --보기 p11-07-08   → 그 판의 지시문만 찍는다
#   python -X utf8 웹꾸러미.py --둘째날 <A|B> [--보기 <판>]   → 7번 숏드라마만 웹올리기_둘째날/에(첫날 폴더는 건드리지 않음, 방식은 목소리 시험에서 고른 것)
# 편마다 지시문 원천은 video/<편>/지시문/영상_시댄스웹.json(아래 「편」 표). 매진 임박은 이미 만든 웹올리기_v5 폴더를 그대로 옮긴다.
# 무제한은 웹에서 사람이 한 판씩 누르는 것만 허용된다(자동화 금지 — 결정 10-26) — 이 도구는 폴더와 순서표만 만들고 누르지 않는다.
import copy, html, json, os, re, shutil, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.join(os.path.dirname(HERE), "video")
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/웹올리기"
HS = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/영상/웹올리기_v5"
HS_PLAN = os.path.join(VIDEO, "homeshopping-horror-20261021", "목소리", "계획_v5.json")   # 대사 줄마다 배역(메모 「#컷 · …」)
TOKEN1, TOKEN2 = "@이미지 1", "@이미지 2"   # 한국어 화면의 업로드 이름(영어 화면은 @Image 1) — LAB 굽기 시트와 같다
AUDIO1 = "@오디오 1"   # 소리 꼬리표 — 화면에서 글자가 꼬리표로 안 바뀌면 지우고 @로 올린 소리를 고른다

# 대사 목소리(10-29 유호님 — 결정 표 10-29 두 행): 대사는 시댄스가 직접 연기한 목소리를 그대로 쓰고(「목소리는 일단 기본적으로 시댄스가 직접 연기한
#   목소리를 그대로 쓰자」), 목소리는 처음 시댄스가 내 준 것으로 정한다(「기본은 처음 시댄스가 제공해주는걸로」). 타입캐스트는 광고 배우 목소리에 쓰지 않고
#   (「너무 부자연스럽다」), 시댄스 목소리가 어색할 때의 대안은 일레븐 v4다.
#   그래서 배역마다 맨 앞에 「목소리 판」 하나 — 견본 없이 일상 문장 한 줄을 말하게 해 시댄스가 처음 낸 목소리를 그 배역 목소리로 삼고, 받은 판에서 소리를
#   떼어(견본떼기.py) 그 배역 대사 판마다 3_목소리견본.mp3로 넣는다(새 방식 B — 목소리 결만 따르고 대사는 지시문의 한국어를 시댄스가 연기).
#   견본은 목소리 판을 받은 뒤 생기므로 대사 판 폴더는 그때 이 도구를 다시 돌려 채운다. 목소리 시험(지유 #7 · #12의 B 둘)은 시험 여섯 뒤에 둬서
#   그동안 견본을 떼어 넣는다 — 같은 견본으로 낸 두 컷이 같은 사람으로 들리는지 · 입과 소리가 맞는지 먼저 본다.
SEED_SAMPLES = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/목소리/시댄스견본"   # 목소리 판에서 뗀 견본(견본떼기.py가 만듦)
SAMPLE_FILE = {"지유": "jiyu.mp3", "리4": "ri4.mp3", "통2": "tong2.mp3", "강도": "gangdo.mp3"}
HS_CASTING = [   # (배역, 시작 그림을 빌릴 컷, 화면 속 사람, 대명사, 말할 글 — 5~6초, 대사가 아닌 일상 말)
    ("지유", 7, "The young woman in the white lace veil", "her", "내일이 결혼식이라, 오늘은 친구들이랑 조촐하게 모였어요. 다들 와 줘서 고마워요."),
    ("리4", 8, "The young woman with round glasses, a black bob and red ribbon bows in her hair", "her", "이번에 나온 핑크 에디션, 제가 제일 먼저 샀어요. 색이 너무 예뻐서 매일 들고 다녀요."),
    ("통2", 16, "The curly-haired woman with the rose crown", "her", "오늘 저녁 메뉴는 제가 골랐어요. 치즈랑 계란은 꼭 넣어 달라고 했어요."),
    ("강도", 23, "The man in the black balaclava", "his", "택배는 문 앞에 두고 갈게요. 상자가 좀 무거우니까, 들 때 조심하세요."),
]
CASTING_LEN = 7   # 가장 긴 판(7초)과 같게 — 1일권 길이 상한을 넘지 않게
VOICE_TESTS = ["hs-S07-B", "hs-S12-B"]

# 굽는 차례 — 짧은 편부터 끝까지 마쳐 하루가 모자라도 완성 편이 남게 한다. 「시험」은 맨 앞에서 길을 확인하는 판.
PIECES = [  # (편, 원천 폴더) — 매진 임박(hs)은 따로
    ("p11", "pet-ad-20261026"),
    ("p2", "mens-fragrance-20261026"),
    ("p12", "comedy-montage-20261026"),
    ("p5", "sports-manifesto-20261026"),
    ("p4", "fashion-film-20261026"),
    ("s1", "xmas-neighbors-20261025"),   # 시즌1 옆집의 크리스마스(10-29 붙임) — 14 · 36은 옛 판 그대로(늘켬 글자는 후반), 고친 여섯 컷은 10-29 확정
    ("om", "omitok-20261029"),   # 오미톡 15초 · 리허설 포트폴리오판(10-29 밤 붙임 — Omni 1차본이 「너무 부자연스러워」) · 맨 끝이라 앞 편 판 번호는 그대로
]
# 목소리 시험 다음 판: 두 샷 묶음 · 끝 그림 판 · 첫 화면 뒤 비켜 돌았다 찾는 카메라(12번 2 — 10은 10-29부터 다가가기라 2로) · 거꾸로 뒤집힌 얼굴(5번 9행)
TESTS = ["p11-07-08", "p11-09", "p12-02", "p5-09", "s1-30", "s1-19"]   # 옆집 30 큰 아크 · 19 어깨 너머 느린 다가감(10-29 바꾼 카메라)

RATIO_EN = {"9:16": "vertical 9:16", "16:9": "horizontal 16:9"}

# 둘째 날 — 7번 숏드라마(다 붙이면 하루를 넘어 따로 낸다 — 굽기 시트 「둘째 날 전」 3번, 7번 콘티 8절, 곁 세션 인계 메모 p7_시댄스지시문_인계.md).
#   7번만의 칸: 판 「소리」 켬 · 「B만 켬」(방식 B일 때만 켬) · 끔, 「소리줄」 {A, B, 없음}은 prompt()의 마지막 SOUND 줄로, 「소리참고」(비었으면 아래
#   P7_SOUND 자리), 「B길이」(방식 B에서 말이 끝날 때까지 받는 길이). 7번에는 voice_b()를 걸지 않는다 — B 줄에 같은 VOICE 줄이 이미 있다.
#   「후보판」(첫 걸이 2-1p · 1-1p)은 쓰지 않기로 해서(10-29) 넣지 않는다.
DAY2 = ("p7", "short-drama-20261026")
OUT2 = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/웹올리기_둘째날"
P7_SOUND = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/소리/p7/소리참고"   # A/<판 id>.mp3(입 맞춤 대사) · B/<배역>.mp3(목소리 견본)
P7_ROLE = {"IAN": "ian", "SEOJIN": "seojin", "MINJAE": "minjae", "SOYEON": "soyeon"}
DAY2_BUFFER = ["p7-1-1", "p7-1-7", "p7-1-12", "p7-1-22", "p7-1-24", "p7-1-26-27"]   # 소리 끔 판 — 목소리 판 뒤 견본이 들어올 때까지(10-30)
DAY2_TESTS = ["p7-1-16", "p7-2-28"]   # 두 방식을 같은 컷으로(02_콘티 8-4) — 고른 방식 판이 그 컷의 주판을 겸한다
CAMERA_ALT = {   # 카메라 줄을 「기법 이름 + 끝 모습만」 꼴로 나란히(02_콘티 8-4 · 시댄스 도움말이 바로 알아듣는 낱말 「truck」)
    "p7-1-35": "slow truck right with a handheld feel, easing to a stop — it ends with Soyeon a little left of center.",
}
P7_CASTING = [   # 배역 목소리 판(위 매진 임박과 같은 길) — (견본 파일 이름, 그림을 빌릴 컷, 화면 속 이름, 대명사, 말할 글 5초 안팎)
    ("ian", "2-15", "Ian", "his", "퇴근길에 서점에 들렀어. 읽고 싶던 책이 있었거든. 오늘은 일찍 잘 것 같아."),
    ("seojin", "1-25", "Seojin", "her", "이번 주 일정은 제가 미리 정리해 뒀어요. 회의 끝나고 바로 자료 공유할게요."),
    ("minjae", "1-16", "Minjae", "his", "점심 뭐 먹을지 정했어? 회사 앞 국밥집 괜찮다던데. 오늘은 내가 살게."),
    ("soyeon", "1-32", "Soyeon", "her", "요즘은 애 재우고 나면 그제야 하루가 끝나. 그래도 주말엔 좀 쉬어."),
]


def first_line(has_end):
    s = (f"{TOKEN1} is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and "
         "white balance, same people and animals, faces, hair and clothes.")
    if has_end:
        s += f" {TOKEN2} is the exact last frame: the camera arrives at exactly that framing at the very end."
    return s


def who_lines(spec, keys):
    return [f"{k}: {spec['공통']['누구'][k]}" for k in keys]


def prompt(spec, p, mode=None):
    # mode: 7번의 목소리 방식(A · B · 없음) — 판에 「소리줄」이 있을 때만 끝 SOUND 줄을 바꾼다(다른 편은 그대로 공통 「소리」)
    c = spec["공통"]
    ratio = RATIO_EN[spec["비율"]]
    shots = p["샷"]
    L = []
    if len(shots) == 1:
        s = shots[0]
        L.append(first_line(bool(s.get("끝그림"))))
        slow = s.get("슬로")
        L.append(f"ONE SINGLE CONTINUOUS SHOT of {c['장르']}, {ratio} — no cuts, no camera switch, "
                 + ("in smooth slow motion for the whole shot, no speed ramp, no end card." if slow else "no slow motion, no speed ramp, no end card."))
        L += who_lines(spec, s.get("누구", []))
        L.append("ACTION: " + s["동작"])
        L.append("CAMERA: " + s["카메라"])
        if s.get("기운"):
            L.append("ENERGY: " + s["기운"])
    else:
        t = p["자르는초"]
        L.append(f"This video is TWO SHOTS of {c['장르']}, {ratio}, joined by ONE hard cut at {t:g} s — the same moment in the same place "
                 "under the same light; any person or object seen in both shots looks exactly the same in both; nobody is added who is not "
                 "described for that shot; no other cuts, no slow motion, no speed ramp, no end card.")
        keys = []
        for s in shots:
            for k in s.get("누구", []):
                if k not in keys:
                    keys.append(k)
        L += who_lines(spec, keys)
        for i, s in enumerate(shots):
            a, b = (0, t) if i == 0 else (t, None)
            tok = TOKEN1 if i == 0 else TOKEN2
            span = f"{a:g}–{b:g} s" if b else f"{a:g} s to the end"
            L.append(f"SHOT {i + 1} ({span}) begins exactly on {tok} — same framing, light and colors. ACTION: {s['동작']} CAMERA: {s['카메라']}")
    L.append(c["보기"])
    L.append((p.get("소리줄") or {}).get(mode) or c["소리"])
    return "\n".join(L)


def voice_b(text):
    # 새 방식: 입은 지시문 속 한국어 대사대로(웹올리기_v5의 「소리 참고 없이」와 같은 바꿈) + 목소리 견본은 결만
    out = text.replace("in sync with the reference audio", "clearly forming the Korean words")
    assert out != text, "대사 컷 지시문에 「in sync with the reference audio」가 없다"
    return out + (f"\nVOICE: {AUDIO1} is only a sample of the speaking person's voice — copy its timbre, age, pitch and Korean accent exactly, "
                  "but never play it and never say its words; perform only the Korean line written above, the way this moment demands. "
                  "Only that dialogue and quiet room sound — no music, no other voices.")


def hs_casting_prompt(who, pos, text):
    # 매진 임박 목소리 판 — 견본 없이 말하게 해 시댄스가 처음 내는 목소리를 받는다(입은 보여도 되지만 이 판은 소리만 쓴다)
    lips = "the lips seen through the mask opening" if "balaclava" in who else f"{pos} lips"
    return "\n".join([
        first_line(False),
        "ONE SINGLE CONTINUOUS SHOT of a live-action Korean horror-comedy short film, horizontal 16:9 — no cuts, no camera switch, no slow motion, "
        "no speed ramp, no end card.",
        # 시작 그림이 겁먹거나 우는 얼굴이라 울음 · 훌쩍임이 견본에 섞이지 않게 먼저 조용히 가라앉힌다(10-30 Fable — 견본떼기는 무음만 자른다)
        f"ACTION: {who} closes {pos} mouth, swallows and calms down in silence — no crying sound, no sob, no sniff — then looks just past the "
        f"camera and says in Korean, in {pos} own natural everyday speaking voice — relaxed and "
        f"conversational, as if chatting with a friend; not shouting, not crying, not whispering, not announcing: \"{text}\" {lips[0].upper() + lips[1:]} "
        "clearly form the Korean words. Everyone else in the frame keeps still with lips closed.",
        "CAMERA: the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake.",
        "LOOK: keep the first frame's faces, hair, outfits, the room and its dim, warm tungsten lamp light and colors to the very end; no new light, "
        "no color shift; no added on-screen text, captions or logos.",
        f"SOUND: only {pos} natural speaking voice saying this one Korean line, over quiet room tone — no music, no other voices, no sound effects, "
        "no crying or sobbing sounds at any point.",
    ])


def hs_roles():
    roles = {}
    for line in json.load(open(HS_PLAN, encoding="utf-8"))["lines"]:
        m = re.match(r"#(\d+)", line.get("메모", ""))
        if m:
            roles[int(m.group(1))] = line["role"]
    return roles


def load_specs():
    specs = {}
    for key, folder in PIECES:
        f = os.path.join(VIDEO, folder, "지시문", "영상_시댄스웹.json")
        if os.path.exists(f):
            specs[key] = json.load(open(f, encoding="utf-8"))
    return specs


def save_jpg(src, dst):
    im = Image.open(src).convert("RGB")
    im.save(dst, quality=95)
    return im.size


def p7_sound(p, mode):
    # 판의 소리 켬 · 끔과 올릴 소리 참고(방식 A = 그 판의 입 맞춤 대사 mp3, 방식 B = 말하는 배역의 목소리 견본)
    if not (p["소리"] == "켬" or (p["소리"] == "B만 켬" and mode == "B")):
        return "끔", None
    ref = (p.get("소리참고") or {}).get(mode)
    if not ref:
        if mode == "A":
            ref = os.path.join(P7_SOUND, "A", p["id"] + ".mp3")
        else:
            who = next(s["말"]["누가"] for s in p["샷"] if s.get("말"))
            ref = os.path.join(P7_SOUND, "B", P7_ROLE[who.split(" ")[0]] + ".mp3")
    return "켬", ref


def p7_item(spec, p, mode):
    shots = p["샷"]
    files = []
    if len(shots) == 1:
        files.append(("1_시작.jpg", os.path.join(spec["그림"], shots[0]["그림"]), "시작"))
        if shots[0].get("끝그림"):
            files.append(("2_끝.jpg", os.path.join(spec["그림"], shots[0]["끝그림"]), "끝"))
    else:
        for i, s in enumerate(shots):
            files.append((f"{i + 1}_샷{i + 1}.jpg", os.path.join(spec["그림"], s["그림"]), f"샷{i + 1}"))
    snd, ref = p7_sound(p, mode)
    if ref:
        files.append(("3_소리.mp3", ref, "소리") if mode == "A" else ("3_목소리견본.mp3", ref, "목소리 견본"))
    return {"id": p["id"], "편": DAY2[0], "편이름": spec["이름"], "컷": p["컷"], "길이": (p.get("B길이") if mode == "B" else None) or p["길이"],
            "비율": spec["비율"], "소리": snd, "설명": p["설명"], "파일": files, "지시문": prompt(spec, p, mode), "묶음": len(shots) > 1,
            "대안": bool(p.get("대안")), "낱판": p.get("낱판", []), "쓰는초": [s.get("쓰는초") for s in shots], "방식": mode if snd == "켬" else None}


def p7_casting(spec, role, cut, name, pos, text):
    shot = next(s for p in spec["판"] for s in p["샷"] if s["컷"] == cut)
    c = spec["공통"]
    L = [first_line(False), f"ONE SINGLE CONTINUOUS SHOT of {c['장르']}, vertical 9:16 — no cuts, no camera switch, no slow motion, no speed ramp, no end card."]
    L += who_lines(spec, [shot["말"]["누가"]])   # 말하는 사람만 — 화면 밖 사람 줄(「첫 프레임의 그 사람」)이 사람을 더하지 않게(10-30 Fable)
    L.append(f"ACTION: {name} looks just past the camera and says in Korean, in {pos} own natural everyday speaking voice — relaxed and conversational, "
             f"as if talking to a friend; not shouting, not whispering, not announcing: \"{text}\" {pos.capitalize()} lips clearly form the Korean words. "
             "No one else speaks; anyone else in the frame keeps still with lips closed.")
    L.append("CAMERA: static frame — the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake.")
    L.append(c["보기"])
    L.append(f"SOUND: only {name}'s natural speaking voice saying this one Korean line, over quiet room tone — no music, no narration, no other voices.")
    return {"id": f"p7-목소리-{role}", "편": DAY2[0], "편이름": spec["이름"], "컷": [cut], "길이": CASTING_LEN, "비율": spec["비율"], "소리": "켬",
            "설명": f"{name} 목소리 판 — 견본 없이 일상 문장 한 줄({cut} 그림), 시댄스가 처음 낸 목소리를 {name} 목소리로 삼는다",
            "파일": [("1_시작.jpg", os.path.join(spec["그림"], shot["그림"]), "시작")], "지시문": "\n".join(L), "묶음": False, "대안": False,
            "방식": "목소리 판"}


def build_day2(mode):
    assert mode in ("A", "B"), "--둘째날 다음에 목소리 방식 A 또는 B"
    spec = json.load(open(os.path.join(VIDEO, DAY2[1], "지시문", "영상_시댄스웹.json"), encoding="utf-8"))
    by = {p["id"]: p for p in spec["판"]}   # 「후보판」은 넣지 않는다
    tests = [p7_casting(spec, *row) for row in P7_CASTING] if mode == "B" else []   # 목소리 판이 맨 앞(견본은 받은 뒤 견본떼기.py로)
    for tid in DAY2_TESTS:   # 10-29 방식 B로 정함 — 고른 방식 한 판씩(두 방식 견주기는 매진 목소리 시험 몫)
        it = p7_item(spec, by[tid], mode)
        it.update({"id": f"{tid}-{mode}", "설명": it["설명"] + (" · 지금 방식" if mode == "A" else " · 새 방식(시댄스가 연기)"), "시험": True})
        tests.append(it)
    for tid, cam in CAMERA_ALT.items():
        now = p7_item(spec, by[tid], mode)
        now.update({"id": f"{tid}-지금꼴", "설명": now["설명"] + " · 카메라 줄 지금 꼴(원본 실측 숫자)", "시험": True})
        q = copy.deepcopy(by[tid])
        q["샷"][0]["카메라"] = cam
        alt = p7_item(spec, q, mode)
        alt.update({"id": f"{tid}-기법꼴", "설명": alt["설명"] + " · 카메라 줄 「기법 이름 + 끝 모습만」", "시험": True})
        tests += [now, alt]
    done = set(DAY2_TESTS) | set(CAMERA_ALT)
    n = len(P7_CASTING) if mode == "B" else 0
    buf = [p7_item(spec, by[k], mode) for k in DAY2_BUFFER] if n else []   # 목소리 판을 받아 견본을 떼는 동안 낼 소리 끔 판(10-30 Fable)
    done |= {it["id"] for it in buf}
    order = tests[:n] + buf + tests[n:] + [p7_item(spec, p, mode) for p in spec["판"] if p["id"] not in done and not p.get("대안")]
    order += [p7_item(spec, p, mode) for p in spec["판"] if p.get("대안")]
    by_item = {it["id"]: it for it in order}
    if "--보기" in sys.argv:
        k = sys.argv[sys.argv.index("--보기") + 1]
        print(by_item[k]["지시문"])
        print(f"\n({len(by_item[k]['지시문'])}자 · {by_item[k]['길이']}초 · 소리 {by_item[k]['소리']} · 올릴 것 {[f[0] for f in by_item[k]['파일']]})")
        return
    missing = sorted({src for it in order for _, src, _ in it["파일"] if not os.path.exists(src)})
    if os.path.isdir(OUT2):
        shutil.rmtree(OUT2)
    os.makedirs(OUT2)
    rows = []
    for n, it in enumerate(order, 1):
        d = os.path.join(OUT2, f"{n:03d}_{it['id']}")
        os.makedirs(d)
        for name, src, _ in it["파일"]:
            if not os.path.exists(src):
                continue
            if name.endswith(".mp3"):
                shutil.copy2(src, os.path.join(d, name))
            else:
                save_jpg(src, os.path.join(d, name))
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(it["지시문"])
        rows.append({"순서": n, "id": it["id"], "편": it["편"], "컷": it["컷"], "폴더": os.path.basename(d), "길이": it["길이"], "비율": it["비율"],
                     "소리": it["소리"], "묶음": it["묶음"], "대안": it["대안"], "방식": it.get("방식"), "시험": bool(it.get("시험")),
                     "낱판": it.get("낱판", []), "쓰는초": it.get("쓰는초"), "파일": [f[0] for f in it["파일"]],
                     "빠진 파일": [f[0] for f in it["파일"] if not os.path.exists(f[1])], "지시문 머리": it["지시문"][:160], "지시문 글자 수": len(it["지시문"])})
    json.dump(rows, open(os.path.join(OUT2, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(os.path.join(OUT2, "순서표.html"), "w", encoding="utf-8").write(page(order, day2=mode))
    n_test = sum(1 for it in order if it.get("시험"))
    n_alt = sum(1 for it in order if it["대안"])
    print(f"둘째 날 · 7번 · 방식 {mode}: 판 {len(order)}개(시험 {n_test} · 주판 {len(order) - n_test - n_alt} · 대안 {n_alt}) → {OUT2}")
    print(f"  길이 합 — 시험 · 주판 {sum(it['길이'] for it in order if not it['대안'])}초 · 소리 켬 {sum(1 for it in order if it['소리'] == '켬')}판")
    if missing:
        print(f"  ⚠ 아직 없는 파일 {len(missing)}개(그 판 폴더엔 빠짐 — 목소리를 고르고 굽은 뒤 다시 돌린다): {missing[:4]}{' …' if len(missing) > 4 else ''}")


def build():
    if "--둘째날" in sys.argv:
        return build_day2(sys.argv[sys.argv.index("--둘째날") + 1])
    specs = load_specs()
    items = []   # 순서표 한 줄 = 한 판
    # 매진 임박 — 이미 만든 웹올리기_v5를 그대로(첫 줄만 웹 꼬리표로)
    hs = json.load(open(os.path.join(HS, "_순서.json"), encoding="utf-8"))
    roles = hs_roles()
    by_cut = {r["컷"]: r for r in hs}
    for role, cut, who, pos, text in HS_CASTING:   # 배역 목소리 판 — 맨 앞
        d = os.path.join(HS, by_cut[cut]["폴더"])
        items.append({"id": f"hs-목소리-{role}", "편": "hs", "편이름": "매진 임박", "컷": [str(cut)], "길이": CASTING_LEN, "비율": "16:9", "소리": "켬",
                      "설명": f"{role} 목소리 판 — 견본 없이 일상 문장 한 줄(#{cut} 그림), 시댄스가 처음 낸 목소리를 {role} 목소리로 삼는다",
                      "파일": [("1_시작.jpg", os.path.join(d, "1_시작.jpg"), "시작")], "지시문": hs_casting_prompt(who, pos, text),
                      "묶음": False, "대안": False, "방식": "목소리 판"})
    for r in hs:
        d = os.path.join(HS, r["폴더"])
        body = open(os.path.join(d, "지시문.txt"), encoding="utf-8").read().strip()
        a = {"id": f"hs-{r['id']}", "편": "hs", "편이름": "매진 임박", "컷": [str(r["컷"])], "길이": r["길이"], "비율": "16:9",
             "소리": "켬" if r["소리 생성"] else "끔", "설명": f"매진 임박 #{r['컷']}",
             "파일": [("1_시작.jpg", os.path.join(d, "1_시작.jpg"), "시작")]
             + ([("2_끝.jpg", os.path.join(d, "2_끝.jpg"), "끝")] if r["끝 그림"] else [])
             + ([("3_소리.mp3", os.path.join(d, "3_소리.mp3"), "소리")] if r["소리 참고"] else []),
             "지시문": first_line(r["끝 그림"]) + "\n" + body, "묶음": False, "대안": False}
        if not r["소리 참고"]:
            items.append(a)
            continue
        # 대사 컷 — 새 방식(B)만: 목소리 판에서 뗀 시댄스 견본을 넣고 시댄스가 연기한다. 타입캐스트 대사를 넣던 지금 방식(A)은 10-29부터 내지 않는다
        role = roles[r["컷"]]
        items.append({**a, "id": f"{a['id']}-B", "방식": "B", "설명": f"매진 임박 #{r['컷']} · {role} 목소리(목소리 판에서 뗀 견본) — 시댄스가 연기",
                      "파일": a["파일"][:-1] + [("3_목소리견본.mp3", os.path.join(SEED_SAMPLES, SAMPLE_FILE[role]), "목소리 견본")],
                      "지시문": first_line(r["끝 그림"]) + "\n" + voice_b(body)})
    for key, folder in PIECES:
        spec = specs.get(key)
        if not spec:
            continue
        for p in spec["판"]:
            shots = p["샷"]
            files = []
            if len(shots) == 1:
                files.append(("1_시작.jpg", os.path.join(spec["그림"], shots[0]["그림"]), "시작"))
                if shots[0].get("끝그림"):
                    files.append(("2_끝.jpg", os.path.join(spec["그림"], shots[0]["끝그림"]), "끝"))
            else:
                for i, s in enumerate(shots):
                    files.append((f"{i + 1}_샷{i + 1}.jpg", os.path.join(spec["그림"], s["그림"]), f"샷{i + 1}"))
            items.append({"id": p["id"], "편": key, "편이름": spec["이름"], "컷": p["컷"], "길이": p["길이"], "비율": spec["비율"],
                          "소리": "끔", "설명": p["설명"], "파일": files, "지시문": prompt(spec, p),
                          "묶음": len(shots) > 1, "대안": bool(p.get("대안")), "낱판": p.get("낱판", []), "쓰는초": [s.get("쓰는초") for s in shots]})
    # 차례: 배역 목소리 판 → 시험 여섯(그동안 목소리 판에서 견본을 뗌) → 목소리 시험 → 매진 말 없는 판 → 매진 대사 판 → 다른 편 차례
    # (대안 판은 맨 뒤 — 묶음이 안 될 때만)
    by_id = {it["id"]: it for it in items}
    first = [it["id"] for it in items if it.get("방식") == "목소리 판"] + TESTS + VOICE_TESTS
    order = [by_id[i] for i in first if i in by_id]
    rest = [it for it in items if it["id"] not in first and not it["대안"]]
    # 목소리 시험 둘을 받아 판정할 틈 — 매진은 말 없는 판을 먼저, 대사(B) 판을 뒤에(10-30 Fable: 바로 뒤에 오면 시험이 틀릴 때 열한 판이 헛돈다)
    talk = [it for it in rest if it["편"] == "hs" and it.get("방식") == "B"]
    order += [it for it in rest if it["편"] == "hs" and it not in talk] + talk + [it for it in rest if it["편"] != "hs"]
    order += [it for it in items if it["대안"]]
    if "--보기" in sys.argv:
        k = sys.argv[sys.argv.index("--보기") + 1]
        print(by_id[k]["지시문"])
        print(f"\n({len(by_id[k]['지시문'])}자)")
        return
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    rows = []
    for n, it in enumerate(order, 1):
        d = os.path.join(OUT, f"{n:03d}_{it['id']}")
        os.makedirs(d)
        for name, src, _ in it["파일"]:
            if not os.path.exists(src):   # 목소리 판에서 뗄 견본 — 받은 뒤 다시 돌려 채운다
                continue
            if name.endswith(".mp3"):
                shutil.copy2(src, os.path.join(d, name))
            else:
                save_jpg(src, os.path.join(d, name))
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(it["지시문"])
        rows.append({"순서": n, "id": it["id"], "편": it["편"], "컷": it["컷"], "폴더": os.path.basename(d), "길이": it["길이"], "비율": it["비율"],
                     "소리": it["소리"], "묶음": it["묶음"], "대안": it["대안"], "방식": it.get("방식"), "낱판": it.get("낱판", []),
                     "쓰는초": it.get("쓰는초"), "파일": [f[0] for f in it["파일"]], "빠진 파일": [f[0] for f in it["파일"] if not os.path.exists(f[1])],
                     "지시문 머리": it["지시문"][:160], "지시문 글자 수": len(it["지시문"])})
    json.dump(rows, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(os.path.join(OUT, "순서표.html"), "w", encoding="utf-8").write(page(order))
    n_main = sum(1 for it in order if not it["대안"])
    n_cast = sum(1 for it in order if it.get("방식") == "목소리 판")
    missing = sorted({src for it in order for _, src, _ in it["파일"] if not os.path.exists(src)})
    print(f"판 {len(order)}개(주판 {n_main} — 목소리 판 {n_cast} 포함 · 대안 {len(order) - n_main}) → {OUT}")
    if missing:
        print(f"  아직 없는 견본 {len(missing)}개(목소리 판을 받아 견본떼기.py 뒤 다시 돌린다): {[os.path.basename(m) for m in missing]}")
    for key in ["hs"] + [k for k, _ in PIECES]:
        sel = [it for it in order if it["편"] == key and not it["대안"]]
        if sel:
            print(f"  {key}: 판 {len(sel)} · 컷 {sum(len(it['컷']) for it in sel)} · 묶음 {sum(it['묶음'] for it in sel)}")
    too_long = [it["id"] for it in order if len(it["지시문"]) > 3800]
    if too_long:
        print("지시문이 3,800자를 넘는 판:", too_long)


DAY2_HEAD = """<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>PULSE 시댄스 둘째 날 순서표</title><style>
:root{--bg:#f6f4ef;--card:#fff;--ink:#1d1c1a;--mute:#6b6760;--line:#e2ddd3;--acc:#2f5bd3;--warn:#b4532a}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#17171a;--card:#212125;--ink:#ecebe8;--mute:#a19d95;--line:#33333a;--acc:#8aa6ff;--warn:#f0a07a}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,'Malgun Gothic',sans-serif}
main{max-width:980px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0}.note{color:var(--mute)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:10px 0}
.card.done{opacity:.45}.row{display:flex;gap:10px;align-items:flex-start}
.n{font-weight:700;min-width:44px}.tag{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:6px;padding:0 6px;margin-right:4px}
.tag.b{border-color:var(--acc);color:var(--acc)}.tag.w{border-color:var(--warn);color:var(--warn)}
pre{white-space:pre-wrap;word-break:break-word;background:var(--bg);border-radius:8px;padding:8px;font-size:12.5px;max-height:220px;overflow:auto}
button{font:inherit;padding:4px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
h2{font-size:18px;margin:24px 0 6px}
</style></head><body><main>
<h1>PULSE 포트폴리오 · 시댄스 2.5 무제한 둘째 날 — 7번 숏드라마 「사랑 한 칸」</h1>
<div class="card"><b>시작 전에</b><ol>
<li>첫날과 같습니다 — 모델 Seedance 2.5 · <b>Unlimited 스위치 켬</b> · 화질 720p · 비율 9:16 · 소리는 판마다 적힌 대로(「소리 켬」 판만 켭니다).</li>
<li>판마다 미디어 칸을 비우고 폴더의 파일을 <b>이름 차례대로</b> 올립니다 — 그림(1_ · 2_) 다음에 소리(<b>3_소리.mp3</b> 지금 방식 · <b>3_목소리견본.mp3</b> 새 방식). 「@이미지 1」 · 「@오디오 1」 글자가 꼬리표로 안 바뀌면 지우고 @로 올린 파일을 고릅니다.</li>
<li>「두 샷」 판은 옴니 레퍼런스 모드에서 그림 둘을 참조로 올립니다 — 안 되면 맨 아래 「대안」의 낱판 둘로 냅니다.</li>
<li>맨 앞 <b>목소리 판 넷</b>(이안 · 서진 · 민재 · 소연 — 견본 없이 일상 문장 한 줄, 시댄스가 처음 낸 목소리를 그 배역 목소리로)을 내고 「목소리 판 냈어」라고 해 주세요. Claude가 목소리를 떼어 대사 판마다 <b>3_목소리견본.mp3</b>로 넣어 드립니다.</li>
<li>견본을 떼는 동안(20분쯤) 바로 뒤 <b>소리 끔 판 여섯</b>(1-1 · 1-7 · 1-12 · 1-22 · 1-24 · 1-26+27 — 견본이 필요 없는 판)을 이어서 내 주세요.</li>
<li>이어서 <b>7번 시험 넷</b>(1-16 민재 · 2-28 이안 — 견본이 들어온 뒤, 1-35를 카메라 줄 두 꼴로)을 내고 「7번 시험 냈어」 — 시험 판은 그 컷의 주판을 겸합니다. 「파일 아직」 표시가 있는 판은 순서표를 새로 고쳐 견본이 들어온 것을 보고 내 주세요.</li>
</ol></div>
"""


def page(order, day2=None):
    def esc(s):
        return html.escape(s)
    head = DAY2_HEAD if day2 else """<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>PULSE 시댄스 순서표</title><style>
:root{--bg:#f6f4ef;--card:#fff;--ink:#1d1c1a;--mute:#6b6760;--line:#e2ddd3;--acc:#2f5bd3;--warn:#b4532a}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#17171a;--card:#212125;--ink:#ecebe8;--mute:#a19d95;--line:#33333a;--acc:#8aa6ff;--warn:#f0a07a}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,'Malgun Gothic',sans-serif}
main{max-width:980px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0}.note{color:var(--mute)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:10px 0}
.card.done{opacity:.45}.row{display:flex;gap:10px;align-items:flex-start}
.n{font-weight:700;min-width:44px}.tag{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:6px;padding:0 6px;margin-right:4px}
.tag.b{border-color:var(--acc);color:var(--acc)}.tag.w{border-color:var(--warn);color:var(--warn)}
pre{white-space:pre-wrap;word-break:break-word;background:var(--bg);border-radius:8px;padding:8px;font-size:12.5px;max-height:220px;overflow:auto}
button{font:inherit;padding:4px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
h2{font-size:18px;margin:24px 0 6px}
</style></head><body><main>
<h1>PULSE 포트폴리오 · 시댄스 2.5 무제한 순서표</h1>
<div class="card"><b>시작 전에</b><ol>
<li>사기 전에 상품 카드에서 모델(Seedance 2.5) · 화질(720p) · 한 판 길이 상한 · 동시에 돌릴 수 있는 수를 봐 주세요. Claude가 받을 수 있게 MCP가 붙은 계정에서 삽니다. 그리고 만들기 칸에 가장 긴 지시문(110번 판 옆집 07+08, 3,685자)을 미디어 없이 붙여 넣어 끝 줄 「SOUND: silent clip …」까지 들어가는지 봐 주세요(생성은 누르지 않음) — 잘리면 사지 말고 Claude에게 알려 주세요.</li>
<li>higgsfield.ai → 비디오 만들기 → 모델 Seedance 2.5 · <b>Unlimited 스위치 켬</b>(생성 단추에 「Unlimited」가 보여야 크레딧이 안 나갑니다) · 화질 720p · 소리는 판마다 적힌 대로 · 비율은 판마다 적힌 대로.</li>
<li>판마다 앞 판에서 올린 그림을 지우고 미디어 칸을 비운 뒤, 판 폴더의 그림을 <b>파일 이름 차례대로</b> 올립니다.
 <br>· 그림 칸이 「시작 프레임 / 끝 프레임」으로 나뉘면: 1_시작 → 시작, 2_끝 → 끝.
 <br>· 칸이 하나(「미디어 업로드」)뿐이면: 올린 차례대로 「@이미지 1」 · 「@이미지 2」가 됩니다. 지시문을 붙여 넣은 뒤 글자 「@이미지 1」이 꼬리표로 안 바뀌면 그 글자를 지우고 @를 쳐서 올린 그림을 고릅니다.
 <br>· 소리 파일은 그림 다음에 올립니다 — <b>3_소리.mp3</b>(지금 방식) · <b>3_목소리견본.mp3</b>(새 방식). 새 방식 지시문의 글자 「@오디오 1」이 꼬리표로 안 바뀌면 지우고 @를 쳐서 올린 소리를 고릅니다.</li>
<li><b>「두 샷」 판</b>(파란 표시)은 <b>옴니 레퍼런스(참조) 모드</b>에서 그림 둘을 참조로 올려 한 판에 두 컷을 냅니다 — 시댄스 2.5에는 이 모드가 있습니다(10-28 MCP 모델 정보: 문장만 · 옴니 레퍼런스 · 시작/끝 프레임 · 한 판 4~30초). 화면이 두 그림을 시작 · 끝 프레임으로만 받으면 이 판은 내지 말고 아래 「대안」의 낱판 둘로 냅니다.</li>
<li>「지시문 복사」로 글을 붙여 넣고 생성합니다. 프리셋을 권하면 거절합니다. 앞 판이 다 만들어진 뒤 다음 판을 냅니다. 처음 보는 동의 창은 직접 읽고 눌러 주세요.</li>
<li>대사는 시댄스가 직접 연기한 목소리를 쓰고, 목소리는 처음 시댄스가 내 준 것으로 정합니다(10-29). 그래서 맨 앞 <b>목소리 판 넷</b>(매진 임박 지유 · 리4 · 통2 · 강도 — 소리 켬, 견본 없이 일상 문장 한 줄)을 먼저 내고 Claude에게 「목소리 판 냈어」라고 해 주세요. Claude가 그 목소리를 떼어 배역마다 대사 판에 <b>3_목소리견본.mp3</b>로 넣어 드립니다.</li>
<li>기다리지 말고 이어서 <b>시험 여섯</b>을 내시고 「시험 냈어」 — 묶음 · 끝 그림 · 카메라 길이 되는지 알려 드립니다. 그다음 <b>목소리 시험 둘</b>(지유 #7 · #12)은 순서표를 새로 고쳐 견본이 들어온 것(「파일 아직」 표시가 사라짐)을 보고 내 주세요 — 두 컷이 같은 사람 목소리로 들리는지 · 입과 소리가 맞는지 들어 보는 판을 만들어 드립니다. 목소리 시험 뒤에는 매진 <b>말 없는 판</b>부터 이어서 내 주시고, 매진 <b>대사 판</b>(새 방식 열한 판)은 목소리 시험 판정을 들은 뒤에 내 주세요 — 그 사이에 말 없는 판이 한 시간쯤 있습니다.</li>
</ol></div>
"""
    out = [head]
    cur = None
    for n, it in enumerate(order, 1):
        sec = ("목소리 판 — 배역마다 시댄스가 처음 내는 목소리" if it.get("방식") == "목소리 판"
               else "목소리 시험 — 시댄스가 연기한 목소리가 컷마다 같은가" if it["id"] in VOICE_TESTS else "시험" if it["id"] in TESTS or it.get("시험")
               else "대안 — 묶음 판 · 새 방식이 안 될 때만" if it["대안"] else it["편이름"])
        if sec != cur:
            out.append(f"<h2>{esc(sec)}</h2>")
            cur = sec
        tags = f'<span class="tag">{esc(it["비율"])}</span><span class="tag">{it["길이"]}초</span><span class="tag">소리 {esc(it["소리"])}</span>'
        if it.get("방식") == "A":
            tags += '<span class="tag">지금 방식</span>'
        if it.get("방식") == "B":
            tags += '<span class="tag b">새 방식</span>'
        if it["묶음"]:
            tags += '<span class="tag b">두 샷</span>'
        if it.get("방식") == "목소리 판":
            tags += '<span class="tag b">목소리 판</span>'
        if it["대안"]:
            tags += '<span class="tag w">대안</span>'
        if any(not os.path.exists(f[1]) for f in it["파일"]):
            tags += '<span class="tag w">파일 아직 — 목소리를 고른 뒤 다시 만듦</span>'
        files = " · ".join(f"{esc(f[0])}" for f in it["파일"])
        out.append(f'<div class="card" id="c{n}"><div class="row"><input type="checkbox" data-k="{esc(it["id"])}"><div class="n">{n}</div><div>'
                   f'<b>{esc(it["편이름"])}</b> 컷 {esc(", ".join(it["컷"]))} — {esc(it["설명"])}<br>{tags}<br>'
                   f'<span class="note">폴더 {n:03d}_{esc(it["id"])} · 올릴 것: {files}</span>'
                   f'<pre id="p{n}">{esc(it["지시문"])}</pre><button data-p="p{n}">지시문 복사</button></div></div></div>')
    out.append("""<script>
const K='pulse-seedance-day-20261028';let s={};try{s=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}
document.querySelectorAll('input[type=checkbox]').forEach(b=>{const c=b.closest('.card');if(s[b.dataset.k]){b.checked=true;c.classList.add('done')}
b.onchange=()=>{s[b.dataset.k]=b.checked;c.classList.toggle('done',b.checked);try{localStorage.setItem(K,JSON.stringify(s))}catch(e){}}});
document.querySelectorAll('button[data-p]').forEach(x=>x.onclick=()=>{const t=document.getElementById(x.dataset.p).innerText;
navigator.clipboard.writeText(t).then(()=>{x.textContent='복사함';setTimeout(()=>x.textContent='지시문 복사',1200)})});
</script></main></body></html>""")
    return "\n".join(out)


if __name__ == "__main__":
    build()
