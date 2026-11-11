# 사본 변이 시험 — 검사 도구(tools/컷연속성검사.py · 크레딧내기.py)를 사본에서 한 군데씩 되돌려 보고, 시험(tests/컷연속성검사.test.js)이 그 되돌림을 잡는지 본다.
#   사람 연기 규칙의 「풀어 주는 갈래」를 더하거나 걷을 때 함께 돌린다(영상작업_진단_20261110.md). 저장소 파일은 건드리지 않는다 — 사본은 임시 폴더에 만든다.
#   python -I -B -X utf8 tests/fixtures/컷연속성검사/변이시험.py [--찾기만] [--묶음=a:1-9] [이름 앞머리 …]
#     --찾기만      변이마다 바꿀 자리를 꼭 한 번 찾는지만 본다(몇 초). 도구를 고친 뒤 「못 찾은 자리」가 나오면 그 변이의 글을 새 코드에 맞춘다
#     --묶음=a:1-9  사본 이름과 돌릴 번호 범위 — 여럿을 함께 돌릴 때(변이 하나에 시험 한 번, 약 1분). 「못 잡은 변이」가 나오면 그 갈래를 고정하는 시험 문장을 더한다
import os, re, shutil, subprocess, sys, tempfile

저장소 = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
묶음 = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--묶음=")), "")
묶음이름, _, 범위 = 묶음.partition(":")
처음, 끝번 = (int(x) for x in 범위.split("-")) if 범위 else (1, 9999)
여기 = os.path.join(tempfile.gettempdir(), "synk-컷검사-변이")
미러 = os.path.join(여기, "사본" + 묶음이름)
os.makedirs(여기, exist_ok=True)
담을것 = ["tools/컷연속성검사.py", "tests/컷연속성검사.test.js", "docs/마케팅/제작양식/영상양식/컷표_틀.json", "docs/마케팅/제작양식/영상양식/빛이름.json"]
for 폴더 in ("tests/fixtures/컷연속성검사", "docs/마케팅/PULSE_포트폴리오_제작준비_20261012/시댄스무제한"):
    for f in os.listdir(os.path.join(저장소, 폴더)):
        if f.endswith((".py", ".json")): 담을것.append(f"{폴더}/{f}")
if os.path.isdir(미러): shutil.rmtree(미러)
for 길 in 담을것:
    os.makedirs(os.path.dirname(os.path.join(미러, 길)), exist_ok=True)
    shutil.copyfile(os.path.join(저장소, 길), os.path.join(미러, 길))
도구 = os.path.join(미러, "tools", "컷연속성검사.py")
내기 = os.path.join(미러, "docs", "마케팅", "PULSE_포트폴리오_제작준비_20261012", "시댄스무제한", "크레딧내기.py")
원본 = {p: open(p, encoding="utf-8", newline="").read() for p in (도구, 내기)}

변이 = [
    ("V01 사람 없는 판이 아니어도 주어 없는 절이 앞 절의 물건을 따라감", 도구,
     r'''        return "물건" if 연기 and 사람없음 and _앞주어([이문장, 앞문장]) == "물건" else "빈"''', r'''        return "물건" if 연기 and _앞주어([이문장, 앞문장]) == "물건" else "빈"'''),
    ("V02 연기 글의 they를 늘 앞 절로 풂", 도구,
     r'''        return "물건" if (사람없음 or not 연기) and _앞주어([이문장, 앞문장], 여럿만=True) == "물건" else "그들"''', r'''        return "물건" if _앞주어([이문장, 앞문장], 여럿만=True) == "물건" else "그들"'''),
    ("V03 they가 단수 물건도 받음", 도구, r'''            if 머리: return "물건" if not 여럿만 or 머리 == "복" else None''', r'''            if 머리: return "물건"'''),
    ("V04 곁 칸의 주어 없는 정지 말을 넘김", 도구,
     r'''        if 주어 == "빈" and (종류 == "카메라" or (종류 == "곁" and 사람없음)): continue''', r'''        if 주어 == "빈" and 종류 != "연기": continue'''),
    ("V05 장면 전체 말을 어느 판에서나 넘김", 도구, r'''        if 주어 == "장면" and (사람없음 or 종류 == "카메라"): continue''', r'''        if 주어 == "장면": continue'''),
    ("V06 카메라 칸의 no other movement를 걺", 도구, r'''        if 주어 == "장면" and (사람없음 or 종류 == "카메라"): continue''', r'''        if 주어 == "장면" and 사람없음: continue'''),
    ("V07 카메라 칸의 주어 없는 정지 말을 걺", 도구,
     r'''        if 주어 == "빈" and (종류 == "카메라" or (종류 == "곁" and 사람없음)): continue''', r'''        if 주어 == "빈" and 종류 == "곁" and 사람없음: continue'''),
    ("V08 곁 칸의 드러난 모르는 주어를 걺", 도구, r'''        if 주어 == "모름" and 종류 != "연기": continue''', r'''        pass'''),
    ("V09 문장 끝 뒤의 소문자 라벨을 읽음", 도구,
     r'''|(ACTION|CAMERA|LOOK|SOUND|VOICE|WHO|PHYSICS|PROPS|NOTE|INDOORS|Indoors)[ \t]*:)")''',
     r'''|(ACTION|CAMERA|LOOK|SOUND|VOICE|WHO|PHYSICS|PROPS|NOTE|INDOORS|Indoors|(?<=[.;!?][ \t])(?:Action|Camera|Look|Sound|Voice|Physics|Note))[ \t]*:)")'''),
    ("V10 too를 부정으로", 도구, r'''|avoid(?:s|ing)?|cannot)\b|n[’']t\b)" + _부정뒤, re.I)''', r'''|avoid(?:s|ing)?|cannot|too\s+[a-z]+)\b|n[’']t\b)" + _부정뒤, re.I)'''),
    ("V11 부정 주어 뒤에 아무 낱말이나 받음", 도구,
     r'''정지부정_주어 = re.compile(r"\b(?:nobody|no one|no-one|nothing|none|neither)\b(?:\s+(?:of them|else|at all|in the [a-z]+|on (?:the|her|his|its) [a-z]+))*" + _부정뒤, re.I)''',
     r'''정지부정_주어 = re.compile(r"\b(?:nobody|no one|no-one|nothing|none|neither)\b(?:\s+[a-z'’-]+){0,6}\s*$", re.I)'''),
    ("V12 사람에게만 쓰는 꾸밈말(expressionless)을 물건 앞에서 넘김", 도구, r'''    if w in _늘사람꾸밈 or any(t in _사람것''', r'''    if any(t in _사람것'''),
    ("V13 꾸밈받는 이름씨 뒤의 「of + 사람」을 안 봄", 도구,
     r'''    if 나머지[:1] == ["of"] and (생물낱말.search(" ".join(나머지[1:5])) or (set(나머지[1:5]) & 이름들)): return "사람"''', r'''    pass'''),
    ("V14 장면 낱말 주어(the whole scene)를 물건으로", 도구,
     r'''        return len(u) == 1 and u[0] in _장면낱말 and (온통 or u[0] not in _카메라낱말)''', r'''        return False'''),
    ("V15 「the frame holds still」을 장면 전체로", 도구,
     r'''        return len(u) == 1 and u[0] in _장면낱말 and (온통 or u[0] not in _카메라낱말)''', r'''        return len(u) == 1 and u[0] in _장면낱말'''),
    ("V16 쉼표 나열의 사람을 안 봄", 도구, r'''        return "사람" if 쉼표뒤 and _나열에사람(이문장) else "물건"''', r'''        return "물건"'''),
    ("V17 모르는 꾸밈말의 사람 꼴(janitor)을 받음", 도구,
     r'''or t.endswith(("s", "ing", "ed")) or _사람꼴뒤.search(t)): return False''', r'''or t.endswith(("s", "ing", "ed"))): return False'''),
    ("V18 표 없는 판의 약한 증거(model · speaker)를 안 봄", 도구, r'''    있음 = 센 or _낱말증거(연기, 약한=True) or _이름연기(연기)''', r'''    있음 = 센 or _이름연기(연기)'''),
    ("V19 인물 []에 약한 증거로도 어긋남을 걺", 도구,
     r'''    if isinstance(인물, (list, tuple)): return 센, 센, not 센 and not _낱말증거(연기, 약한=True)''',
     r'''    if isinstance(인물, (list, tuple)): 센 = 센 or _낱말증거(연기, 약한=True); return 센, 센, not 센'''),
    ("V20 인물 [] + the model을 사람 없는 판으로 믿음", 도구,
     r'''    if isinstance(인물, (list, tuple)): return 센, 센, not 센 and not _낱말증거(연기, 약한=True)''', r'''    if isinstance(인물, (list, tuple)): return 센, 센, not 센'''),
    ("V21 증거만 없으면 사람 없는 판(기척을 안 봄)", 도구,
     r'''    return 있음, False, not 있음 and not _기척(" ".join((연기, who, 이름줄)))''', r'''    return 있음, False, not 있음'''),
    ("V22 기척에서 이름을 안 봄", 도구,
     r'''    return bool(_기척말.search(t)) or _낱말증거(t) or _낱말증거(t, 약한=True) or _이름있음(t)''', r'''    return bool(_기척말.search(t)) or _낱말증거(t) or _낱말증거(t, 약한=True)'''),
    ("V23 they + 산 동사 증거를 뺌", 도구,
     r'''    return bool((_센주어 if 주어만 else _센대명사).search(t)) or _낱말증거(t) or bool(_산주어.search(t))''', r'''    return bool((_센주어 if 주어만 else _센대명사).search(t)) or _낱말증거(t)'''),
    ("V24 소유격 + 몸 증거를 뺌", 도구, r'''            if re.match(r"[’']s?\s+(?:[a-z-]+\s+){0,2}?" + _몸명사 + r"\b", 뒤, re.I): return True''', r'''            pass'''),
    ("V25 인쇄물 속 사람을 증거로", 도구, r''' or _그림속.search(t[max(0, m.start() - 140):m.start()]): continue''', r''': continue'''),
    ("V26 화면 속 사람을 인쇄물로 넘김", 도구,
     r'''    r"|\b(?:sticker|poster|sign|billboard|print|label|card|page|magazine|cover|banner|mural|painting|portrait)s?\b"''',
     r'''    r"|\b(?:phone|sticker|poster|sign|billboard|print|label|card|page|magazine|cover|banner|mural|painting|portrait)s?\b"'''),
    ("V27 「A photo of a woman」을 인쇄물로 넘김", 도구,
     r'''    r"\b(?:(?:printed|framed|taped|pinned|pasted|hanging)\s+(?:photo|photograph|picture|image)|poster|''', r'''    r"\b(?:(?:(?:printed|framed|taped|pinned|pasted|hanging)\s+)?(?:photo|photograph|picture|image)|poster|'''),
    ("V28 twin 홑꼴을 증거로", 도구, r'''        if m.group(0).lower() == "twin": continue''', r'''        if False: continue'''),
    ("V29 「friends side by side」를 꾸밈 자리로 넘김", 도구, r'''\s+(?:of|seat|neck)\b|\s+side\b(?!\s+by\b)", 뒤)''', r'''\s+(?:of|seat|neck|side)\b", 뒤)'''),
    ("V30 이름 + 겹치는 꼴(Sua steps forward)을 늘 버림", 도구,
     r'''        if 끝 in _겹치는꼴 and not _동사꼬리.match(t[m.end():m.end() + 16]): continue''', r'''        if 끝 in _겹치는꼴: continue'''),
    ("V31 겹치는 꼴을 늘 동사로(Energy drinks line)", 도구, r'''        if 끝 in _겹치는꼴 and not _동사꼬리.match(t[m.end():m.end() + 16]): continue''', r'''        pass'''),
    ("V32 이름 + 기본형(lets Sua smile)을 늘 버림", 도구,
     r'''        if 끝 in _연기기본 and 이름.endswith("s") and not re.search(r"\sand\s", m.group(0)): continue''', r'''        if 끝 in _연기기본 and not re.search(r"\sand\s", m.group(0)): continue'''),
    ("V33 물건의 박자도 사람 박자로 셈", 도구, r'''            if _물건으로시작(_낱말들(_머리말뗌(맨))): k = 0''', r'''            pass'''),
    ("V34 「behind her」가 있으면 물건의 박자도 셈", 도구,
     r'''        if k and not _주체말.search(조각) and not _이름꼴(조각):''', r'''        if k and not 생물낱말.search(조각) and not _이름꼴(조각):'''),
    ("V35 범위를 두 박자로 셈", 도구, r'''    for 조각 in re.split(r"[;!?\n]|\.(?!\d)", _박자범위.sub(" § ", 글)):''', r'''    for 조각 in re.split(r"[;!?\n]|\.(?!\d)", 글):'''),
    ("V36 「over the 4 s of the take」를 박자로 셈", 도구, r'''nearly|almost|just|exactly|only)\s+)*(?:t\s?=\s?)?[~≈]?''', r'''nearly|almost|just|exactly|only|the)\s+)*(?:t\s?=\s?)?[~≈]?'''),
    ("V37 길이 낱말(cut · edit)을 박자로 셈", 도구, r'''(?:long|clip|shot|video|take|loop|film|spot|ad|reel|cut|version|edit)\b)"''', r'''(?:long|clip|shot|video|take|loop)\b)"'''),
    ("V38 「at the 2-second mark」를 안 셈", 도구, r'''the\s+" + _초 + r"\s+(?:mark|point)\b"''', r'''the\s+" + _초 + r"\s+(?:xxmarkxx)\b"'''),
    ("V39 길이(for about 2 s)를 박자로 셈", 도구, r'''_박자점 = re.compile(r"(?<!\bfor\s)(?:''', r'''_박자점 = re.compile(r"(?:'''),
    ("V40 한국어 — 모르는 주어도 물건으로 넘김", 도구,
     r'''            if 낱들 and all(re.sub(r"들$", "", x) in _한물건 and x not in 이름들 and re.sub(r"들$", "", x) not in 이름들 for x in 낱들): continue''',
     r'''            if 낱들 and all(x not in 이름들 for x in 낱들): continue'''),
    ("V41 한국어 — 딴 절의 주어도 받음", 도구, r'''|[가-힣A-Za-z]+에서)\s+)*$")''', r'''|[가-힣A-Za-z]+에서|[가-힣]+)\s+)*$")'''),
    ("V42 한국어 — 나란히 놓인 낱말을 안 봄", 도구, r'''+ [주어.group(2)]) if 주어 else []''', r'''+ [주어.group(2)])[-1:] if 주어 else []'''),
    ("V43 탭 · 줄바꿈으로 띄운 말을 안 잡음", 도구, r'''    r"\b" + _세게 + r"(?:[\s-]+" + _세게 + r")*[\s-]+still\b",''', r'''    r"\b" + _세게 + r"(?:[ -]+" + _세게 + r")*[ -]+still\b",'''),
    ("V44 goes still을 뺌", 도구, r'''    r"\b(?:goes|go|went|going|becomes?|falls?|fell)\s+still\b",''', r'''    r"\bxxgoesxx\b",'''),
    ("V45 nothing at all · not a thing을 뺌", 도구,
     r'''    r"\bnothing(?: else| at all)?(?: in the (?:frame|shot|room|scene|picture|background))? (?:moves|stirs)\b|\bnot a (?:single )?thing (?:moves|stirs)\b",''',
     r'''    r"\bnothing(?: else)?(?: in the (?:frame|shot|room|scene|picture|background))? (?:moves|stirs)\b",'''),
    ("V46 「exactly as she is」를 뺌", 도구, r'''(?:exactly\s+)?as (?:she|he) is|as they are)''', r'''as (?:she|he) is|as they are)'''),
    ("V47 짝이 어긋난 따옴표 안을 비움", 도구,
     r'''_대사 = re.compile(r"\"[^\"\n;]{0,300}\"|“[^”\n;]{0,300}”|「[^」\n;]{0,300}」")''', r'''_대사 = re.compile(r"\"[^\"\n]{0,300}\"|“[^”\n]{0,300}”|「[^」\n]{0,300}」")'''),
    ("V48 frozen + 모르는 음식 이름을 주어 판정으로", 도구,
     r'''    return "물건" if w == "frozen" and 머리 and not any(_사람꼴뒤.search(t) for t in 머리) else None''', r'''    return None'''),
    ("V49 frozen + 사람 꼴(cellist)을 물건으로", 도구,
     r'''    return "물건" if w == "frozen" and 머리 and not any(_사람꼴뒤.search(t) for t in 머리) else None''', r'''    return "물건" if w == "frozen" and 머리 else None'''),
    ("V50 장면 낱말을 꾸미는 frozen(a frozen scene)을 물건으로", 도구, r'''    if any(t in _장면낱말 for t in 머리): return "장면"''', r'''    pass'''),
    ("V51 캐릭터가 가까이 있어도 it을 물건으로", 도구, r'''|mascots?|creatures?|characters?|robots?|puppets?|sharks?|magpies?|monsters?)\b", re.I)''', r''')\b", re.I)'''),
    ("V52 CAMERA 칸을 곁 칸으로", 도구, r'''        elif l in ("CAMERA", "FRAME"): out.append((l, t, "카메라"))''', r'''        elif l in ("FRAME",): out.append((l, t, "카메라"))'''),
    ("V53 ACTION 칸이 있는 글의 머리 글을 안 봄", 도구,
     r'''        if not l: out.append(("본문", t, "곁" if act.strip() else "연기"))''', r'''        if not l: out.append(("본문", t if not act.strip() else "", "연기"))'''),
    ("V54 전치사 토막(Beside the woman,)도 나열로 봄", 도구,
     r'''        if len(toks) > 4 or any(t in _전치사 or t in _물건동사 or t in _이음동사 or t in _연기동사집 for t in toks): return False''',
     r'''        if len(toks) > 4 or any(t in _물건동사 or t in _이음동사 or t in _연기동사집 for t in toks): return False'''),
    ("V55 그림자가 사람의 것이어도 물건으로", 도구,
     r'''        if 먹음[-1] in _딸린것 and (소유 or any(생물낱말.fullmatch(t) or t in 이름꼴 for t in toks[j:i])): return False''', r'''        if False: return False'''),
    ("V56 and 갈래에서 앞쪽의 동사를 안 봄", 도구,
     r'''        if 동사있음 and 사이 != "with" and any(t in _물건동사 or t in _이음동사 or t in _연기동사집 for t in 앞쪽): return "물건"''', r'''        if 동사있음 and 사이 != "with": return "물건"'''),
    ("V57 모르는 꾸밈말 뒤에 낱말을 몇 개든 받음", 도구, r'''            elif 모름뒤 > 1: return False''', r'''            elif False: return False'''),
    ("V58 검사기를 못 불러도 판 이름 무시로 지나감", 내기, r'''        if 무시까닭 is None or 넘김 is not None:''', r'''        if 무시까닭 is None:'''),
    ("V59 폴더를 함께 쓰는 뒷줄을 건너뜀", 내기, r'''        if (pack, 폴더, 판id) in 본:''', r'''        if any(a == pack and b == 폴더 for a, b, _ in 본):'''),
    ("V60 겹친 판 id를 알리지 않음", 내기, r'''        if 본id.setdefault((pack, 판id), 폴더) != 폴더:''', r'''        if False:'''),
    ("V61 pv로 시작하면 무엇이든 프리비즈", 도구, r'''프리비즈=bool(re.match(r"pv[\d-]", str(판id or "")))''', r'''프리비즈=str(판id or "").startswith("pv")'''),
    ("V62 열린 쪽 — 자세 · 표정 · her가 든 말을 주어 판정에 맡김", 도구,
     r'''        elif 꾸밈 == "사람" or _늘사람.match(w) or _사람말.search(w): 주어 = "사람"''', r'''        elif 꾸밈 == "사람" or _늘사람.match(w): 주어 = "사람"'''),
    ("V63 「, still.」 문장 끝을 안 잡음", 도구, r'''    r"(?<=[,—–])\s*still\s*(?=[,.;—–]|$)",''', r'''    r"(?<=,)\s*still\s*(?=,)",'''),
    ("V64 사람 판의 박자최소를 무시", 도구, r'''        elif n < 박자최소:''', r'''        elif False:'''),
    ("V65 him · herself · everyone을 바로 멈추는 말을 안 잡음", 도구,
     r'''    r"\b" + _자세잡기 + r"\s+(?:him|herself|himself|themselves|everyone|everybody)\s+''', r'''    r"\b" + _자세잡기 + r"\s+(?:himm|herselff)\s+'''),
    ("V66 her를 바로 멈추는 말을 안 잡음", 도구, r'''    r"\b" + _자세잡기 + r"\s+her\s+still(?=''', r'''    r"\b" + _자세잡기 + r"\s+herr\s+still(?='''),
    ("V67 her 바로 뒤의 still을 뒤를 안 보고 잡음", 도구,
     r'''r"\s+her\s+still(?=\s*(?:[.,;:!?—–)\n]|$|(?:for|until|throughout|to|the whole|while|as|and|or|but|in|on|at|by|so|then|with)\b))",''', r'''r"\s+her\s+still\b",'''),
    ("V68 herself · everyone이 든 말을 주어 판정에 맡김", 도구, r'''|her|him|his|herself|himself|themselves|everyone|everybody)\b", re.I)''', r'''|her|him|his)\b", re.I)'''),
    # 빛 이름(11-11 · 점검표 60)
    ("V69 앞빛 이름을 고른 장면도 앞빛 낱말을 걺", 도구, r'''        if 앞 and not 허용:''', r'''        if 앞:'''),
    ("V70 표의 빛 문장에 든 앞빛 낱말을 넘김", 도구, r'''        if 앞 and not 허용:''', r'''        if False:'''),
    ("V71 옆빛 이름인데 쪽이 없는 빛 문장을 넘김", 도구,
     r'''        if 방향 and not 허용 and not (_빛쪽.search(문장) or _빛뒤위.search(문장)):''', r'''        if False:'''),
    ("V72 뒤 · 위에서 오는 빛을 쪽으로 안 침", 도구,
     r'''        if 방향 and not 허용 and not (_빛쪽.search(문장) or _빛뒤위.search(문장)):''', r'''        if 방향 and not 허용 and not _빛쪽.search(문장):'''),
    ("V73 사람이 나오는 장면의 빈 빛이름을 주의로", 도구, r'''        out.append(("걸림" if 사람있음 else "주의", f"장면 「{이름}」의 「빛이름」 칸이 비었다''', r'''        out.append(("주의", f"장면 「{이름}」의 「빛이름」 칸이 비었다'''),
    ("V74 사람 없는 장면의 빈 빛이름도 걸림으로", 도구, r'''        out.append(("걸림" if 사람있음 else "주의", f"장면 「{이름}」의 「빛이름」 칸이 비었다''', r'''        out.append(("걸림", f"장면 「{이름}」의 「빛이름」 칸이 비었다'''),
    ("V75 사람 없는 컷이 쓰는 빛 줄의 사람 낱말을 넘김", 도구, r'''    if 사람없는컷:
        m = _빛사람말.search(문장)''', r'''    if False:
        m = _빛사람말.search(문장)'''),
    ("V76 쓰지 않는 이름(Day for night)을 받음", 도구, r'''        elif 줄.get("대신"):''', r'''        elif False:'''),
    ("V77 지시문의 표 밖 앞빛을 안 봄", 도구,
     r'''        if 표 and 사람 and 이름들 and not any(n.lower() in 표["앞빛허용"] for n in 이름들):''', r'''        if False:'''),
    ("V78 사람 없는 판에도 표 밖 앞빛을 걺", 도구,
     r'''        if 표 and 사람 and 이름들 and not any(n.lower() in 표["앞빛허용"] for n in 이름들):''', r'''        if 표 and 이름들 and not any(n.lower() in 표["앞빛허용"] for n in 이름들):'''),
    ("V79 앞빛 이름 장면의 지시문에도 표 밖 앞빛을 걺", 도구,
     r'''        if 표 and 사람 and 이름들 and not any(n.lower() in 표["앞빛허용"] for n in 이름들):''', r'''        if 표 and 사람 and 이름들:'''),
    ("V80 초록 판(chroma-green)의 evenly lit을 걺", 도구,
     r'''            m = next((x for x in _앞빛_글.finditer(나머지) if not _크로마뒤.match(나머지[x.end():])), None)''', r'''            m = _앞빛_글.search(나머지)'''),
    ("V81 초록 판 예외가 아무 앞빛이나 넘김", 도구, r'''_크로마뒤 = re.compile(r"[^.;:\n]{0,30}?\b(?:chroma|green[- ]?screen)", re.I)''', r'''_크로마뒤 = re.compile(r"", re.I)'''),
    ("V82 앞옆 빛(from the front-left)을 정면 빛으로 걺(지시문)", 도구,
     r'''(?:in\s+)?front\b(?![- ](?:left|right))", re.I)
# 다시 얹을''', r'''(?:in\s+)?front\b", re.I)
# 다시 얹을'''),
    ("V83 앞옆 빛(from the front-left)을 정면 빛으로 걺(표)", 도구,
     r'''(?:in\s+)?front\b(?![- ](?:left|right))|\bfront(?:al)?[- ]?(?:light(?:ing|s)?|lit|fill|key)\b''', r'''(?:in\s+)?front\b|\bfront(?:al)?[- ]?(?:light(?:ing|s)?|lit|fill|key)\b'''),
    ("V84 카메라 자리 「seen from the front」를 앞빛으로 걺", 도구,
     r'''r"|\b(?:lights?|lighting|lit)\b[^.;:\n]{0,40}?\bfrom\s+''', r'''r"|\bfrom\s+'''),
    ("V85 얼굴 빛 판정 — 문턱 아래도 통과", 도구, r'''        if 값["좌우"] < 표["좌우문턱"]:''', r'''        if False:'''),
    ("V86 얼굴 빛 판정 — 앞빛 이름 장면도 좌우로 판정", 도구,
     r'''    if 옆 and not 허용 and _빛쪽.search(str(문장 or "")):''', r'''    if 옆 and _빛쪽.search(str(문장 or "")):'''),
    ("V87 얼굴 빛 판정 — 뒤에서 오는 빛도 좌우로 판정", 도구,
     r'''    if 옆 and not 허용 and _빛쪽.search(str(문장 or "")):''', r'''    if 옆 and not 허용:'''),
]
찾기만 = "--찾기만" in sys.argv
고른 = [a for a in sys.argv[1:] if not a.startswith("--")]
못잡음, 못찾음 = [], []
for 번호, (이름, 파일, 옛, 새) in enumerate(변이, 1):
    if 고른 and not any(이름.startswith(g) for g in 고른): continue
    if not 처음 <= 번호 <= 끝번: continue
    글 = 원본[파일]
    옛2, 새2 = (옛.replace("\n", "\r\n"), 새.replace("\n", "\r\n")) if "\r\n" in 글 else (옛, 새)
    if 글.count(옛2) != 1:
        못찾음.append(이름); print(f"?? {이름}: 바꿀 자리를 {글.count(옛2)}번 찾음 — 건너뜀", flush=True); continue
    if 찾기만: continue
    try:
        open(파일, "w", encoding="utf-8", newline="").write(글.replace(옛2, 새2))
        tap = os.path.join(여기, f"변이5_tap{묶음이름}.txt")
        subprocess.run(["node", "--test", "--test-name-pattern=지시문 — |내기 도구 — |컷표 없는 편|틀 2 — 사람이|틀 2 — 대안|깨뜨린|걸면 안 되는|--지시문 — |빛 이름 — ", "--test-reporter=tap", f"--test-reporter-destination={tap}", "tests/컷연속성검사.test.js"],
                       cwd=미러, capture_output=True, text=True, encoding="utf-8")
        t = open(tap, encoding="utf-8").read()
        실패 = re.findall(r"^not ok \d+ - (.*)$", t, re.M)
        n = re.search(r"^# fail (\d+)", t, re.M)
        if not 실패: 못잡음.append(이름)
        print(f"{'잡음' if 실패 else '못잡음'} {이름}: 실패 {n.group(1) if n else '?'}", flush=True)
    finally:
        open(파일, "w", encoding="utf-8", newline="").write(글)
for 파일, 글 in 원본.items():
    assert open(파일, encoding="utf-8", newline="").read() == 글
print(f"미러 되돌림 확인 · 변이 {len(변이)} · 못 찾은 자리 {len(못찾음)}: {못찾음} · 못 잡은 변이 {len(못잡음)}: {못잡음}", flush=True)
