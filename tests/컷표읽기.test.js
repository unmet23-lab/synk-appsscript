'use strict';
// 컷표 꼴 관문(tools/lib/컷표읽기.py · 2026-11-20) — 컷연속성검사가 값 검사보다 먼저 칸의 꼴을 본다.
//   왜: 11-20 GPT 검수 네 회차에서 「글 칸에 빈 배열 · 객체를 넣으면 채운 칸으로 지나간다」가 칸을 바꿔 가며 되풀이됐다(타당성 · 감정자리 · 앵글.까닭).
//   칸 하나씩 고치는 대신, 꼴이 틀린 칸을 한 곳에서 걸고 값 검사에는 빈칸으로 넘긴다(.tmp/검수/설계검토_컷연속성검사_칸읽기_20261120.md의 「있어야 할 시험」 1~8).
//   내기 도구가 편 폴더를 넘기는 시험(9)은 tests/컷연속성검사.test.js에 있다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 도구 = path.join(__dirname, '..', 'tools', '컷연속성검사.py');
const 틀경로 = path.join(__dirname, '..', 'docs', '마케팅', '제작양식', '영상양식', '컷표_틀.json');
const 파이썬 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'import sys; print(sys.version_info[0])'], { encoding: 'utf8' }).status === 0;
const 건너뜀 = { skip: !파이썬 && '파이썬 없음' };
const 이력끔 = { ...process.env, SYNK_검사이력: '끔' };   // 시험 실행이 검사 이력 장부에 줄을 남기지 않게

// 검사 도구(m)와 읽기 모듈(k)을 불러 두고, 틀을 편 날짜 2026-11-20의 새 편으로 읽는다
const 머리 = String.raw`
import sys, json, copy, importlib.util
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("m", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
k = m.컷표읽기()
틀 = json.load(open(sys.argv[2], encoding="utf-8")); 틀["편"]["만든날"] = "2026-11-20"
빈꼴 = {"[]": [], "{}": {}, "0": 0, "false": False, '["글"]': ["글"], '{"k":"글"}': {"k": "글"}}
def 줄들(seq, 항목=None, 영상=None):
    """표 검사를 돌린 결과 줄 → [(항목, 컷, 등급, 글)]"""
    r = m.결과(); m.표검사(m.장면실내채움(seq), r, 항목 or m.기본항목, 영상=영상)
    return [(x["항목"], str(x["컷"]), x["등급"], x["글"]) for x in r.항목들]
def 걸림들(seq, **kw): return [x for x in 줄들(seq, **kw) if x[2] == "걸림"]
def 표(고침):
    s = copy.deepcopy(틀); c = {d["cut"]: d for d in s["detail"]}; 고침(c, s); return s
def 넣기(seq, 길, 값):
    s = copy.deepcopy(seq); o = s
    for x in 길[:-1]: o = o[x]
    o[길[-1]] = 값
    return s
def 글칸들(o, 길=()):
    """표 안의 모든 글 칸 → [길]"""
    if isinstance(o, dict):
        for x, v in o.items():
            if isinstance(v, str): yield 길 + (x,)
            else: yield from 글칸들(v, 길 + (x,))
    elif isinstance(o, list):
        for i, v in enumerate(o):
            if isinstance(v, (dict, list)): yield from 글칸들(v, 길 + (i,))
def 길글(길): return ".".join(str(x) for x in 길)
`;
function 파(본문, ...인자) {
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', 머리 + 본문, 도구, 틀경로, ...인자], { encoding: 'utf8', maxBuffer: 1 << 26 });
  assert.equal(r.status, 0, r.stderr.slice(-2000));
  return JSON.parse(r.stdout);
}

test('틀 — 예시 컷표의 모든 칸이 칸 사전에 있고, 꼴 걸림 · 뼈대 탈이 없다', 건너뜀, () => {
  const 값 = 파(String.raw`
def 모든길(o, 길=()):
    if isinstance(o, dict):
        for x, v in o.items(): yield 길 + (x,); yield from 모든길(v, 길 + (x,))
    elif isinstance(o, list):
        for i, v in enumerate(o): yield 길 + (i,); yield from 모든길(v, 길 + (i,))
# seq 줄 안의 값([컷, 초, 띠, 글])과 글 목록의 낱 글은 사전이 줄 · 목록째로 본다
없는 = sorted({길글(길) for 길 in 모든길(틀) if k.사전길찾기(길) is None and not (길[0] == "seq" and len(길) > 2) and not isinstance(길[-1], int)})
print(json.dumps({"없는": 없는, "꼴": k.꼴검사(copy.deepcopy(틀)), "뼈대": k.뼈대검사(틀), "사전": len(k.칸사전)}, ensure_ascii=False))
`);
  assert.deepEqual(값.없는, [], `틀에 있는데 칸 사전에 없는 칸: ${값.없는}`);
  assert.deepEqual(값.꼴, []); assert.deepEqual(값.뼈대, []);
  assert.ok(값.사전 >= 170, `칸 사전 ${값.사전}칸`);
});

test('빈 꼴 표 — 빈 글이면 걸리는 글 칸은 빈 배열 · 객체 · 0 · false · 글이 든 배열 · 객체로도 걸리고, 예외로 죽지 않는다', 건너뜀, () => {
  const 값 = 파(String.raw`
바탕 = 걸림들(copy.deepcopy(틀)); 본칸 = 0; 샌 = []; 예외 = []
for 길 in 글칸들(틀):
    try: 빈 = [x for x in 걸림들(넣기(틀, 길, "")) if x not in 바탕]
    except Exception as e: 예외.append([길글(길), '""', type(e).__name__]); continue
    if not 빈: continue                       # 빈 글이어도 걸리지 않는 칸(꼭 채울 칸이 아니다)
    본칸 += 1
    사전길 = k.사전길찾기(길)
    for 이름, v in 빈꼴.items():
        if 사전길 is not None and k.꼴맞나(v, k.칸사전[사전길]): continue      # 그 칸이 받는 꼴이면(인물 설정의 객체) 빈 꼴이 아니다
        try: 지금 = [x for x in 걸림들(넣기(틀, 길, v)) if x not in 바탕]
        except Exception as e: 예외.append([길글(길), 이름, type(e).__name__]); continue
        if not 지금: 샌.append([길글(길), 이름])
print(json.dumps({"본칸": 본칸, "샌": 샌, "예외": 예외}, ensure_ascii=False))
`);
  assert.ok(값.본칸 >= 60, `빈 글이면 걸리는 글 칸 ${값.본칸}곳`);
  assert.deepEqual(값.샌, [], `빈 꼴로 지나가는 칸: ${JSON.stringify(값.샌.slice(0, 8))}`);
  assert.deepEqual(값.예외, [], `예외로 죽는 칸: ${JSON.stringify(값.예외.slice(0, 8))}`);
});

test('칸 사전 — 사전의 모든 칸은 틀린 꼴을 넣으면 그 칸을 짚는 걸림이 나고, 비우면 다시 걸리지 않는다', 건너뜀, () => {
  const 값 = 파(String.raw`
견본값 = {k.글: "글", k.수: 1, k.참거짓: True, k.목록: [], k.객체: {}, k.글들: ["글"], k.빈목록: [], k.거짓: False}
틀린후보 = ["글", 3, True, [3], {"k": 3}, [], {}]
def 조각들(사전길):
    out = []
    for 낱 in 사전길.split("."):
        while 낱.endswith("[]") and 낱 != "[]": out.append(낱[:-2] if not out or out[-1] != 낱[:-2] else None); 낱 = "[]"
        out.append(낱)
    return [x for x in out if x is not None]
def 길로(사전길):
    """칸 사전의 길 → 견본 표 안의 길(이름 칸은 「이름」, 목록의 줄은 0)"""
    길 = []
    for 낱 in 사전길.split("."):
        n = 0
        while 낱.endswith("[]"): 낱 = 낱[:-2]; n += 1
        길.append("이름" if 낱 == "*" else 낱); 길 += [0] * n
    return 길
견본 = {}
for 사전길 in sorted(k.칸사전, key=lambda x: (x.count(".") + x.count("[]"), x)):
    길 = 길로(사전길); 꼴들 = k.칸사전[사전길]
    자식있음 = any(y != 사전길 and (y.startswith(사전길 + ".") or y.startswith(사전길 + "[]")) for y in k.칸사전)
    줄자식 = (사전길 + "[]") in k.칸사전
    if 자식있음: v = [] if 줄자식 else {}
    else: v = copy.deepcopy(견본값[꼴들[0]])
    o = 견본
    for i, x in enumerate(길[:-1]):
        if isinstance(x, int):
            while len(o) <= x: o.append(None)
        o = o[x]
    if isinstance(길[-1], int):
        while len(o) <= 길[-1]: o.append(None)
    o[길[-1]] = v
탈 = []
if k.꼴검사(copy.deepcopy(견본)): 탈.append(["견본", k.꼴검사(copy.deepcopy(견본))[:3]])
for 사전길, 꼴들 in k.칸사전.items():
    길 = 길로(사전길); 틀린 = next(c for c in 틀린후보 if not k.꼴맞나(c, 꼴들))
    s = 넣기(견본, 길, 틀린); 줄 = k.꼴검사(s, 비움=True)
    이름 = next((x for x in reversed(길) if isinstance(x, str) and x != "이름"), "")
    if len(줄) != 1 or (isinstance(길[-1], str) and 길[-1] != "이름" and f"{이름}」" not in 줄[0][1]): 탈.append([사전길, 줄[:2]])
    elif k.꼴검사(s): 탈.append([사전길, "비운 뒤에도 걸림"])
# null은 칸이 없는 것과 같고, NaN · Infinity와 그런 글은 수가 아니다
수 = [k.꼴맞나(v, (k.수,)) for v in (3, 2.5, "3.5", " 4 ", float("nan"), float("inf"), "nan", "inf", True, "", "세 번", None)]
print(json.dumps({"탈": 탈, "null": k.꼴검사(넣기(견본, ["이기는것"], None)), "수": 수, "칸": len(k.칸사전)}, ensure_ascii=False))
`);
  assert.deepEqual(값.탈, [], `사전대로 걸리지 않는 칸: ${JSON.stringify(값.탈.slice(0, 6))}`);
  assert.deepEqual(값.null, []);
  assert.deepEqual(값.수, [true, true, true, true, false, false, false, false, false, false, false, false]);
});

test('뜻이 있는 빈 목록과 null — 사람 없는 컷 · 시작 그림에 사람 없음 · 소품 · 사건 · 소리사건 · 글자의 []는 꼴 걸림이 없다', 건너뜀, () => {
  const 값 = 파(String.raw`
def 빈것(c, s):
    c["C4"]["인물"] = []; c["C1"]["그림인물"] = []; c["C2"]["끝그림인물"] = []; s["소품"] = []; s["사건"] = []; s["소리사건"] = []; s["글자"] = []
    c["C1"]["소품"] = []; c["C1"]["감정자리"] = False; c["C2"]["넘어옴"] = None; s["가까운사례"] = None; s["끝"]["로고멈춤초"] = None; s["소리"]["첫말초"] = None
    c["C3"]["메모"] = ["사전에 없는 칸은 걸지 않는다"]; s["검수범위"] = {"아무": 1}
print(json.dumps(k.꼴검사(표(빈것)), ensure_ascii=False))
`);
  assert.deepEqual(값, []);
});

test('표 검사 — 꼴이 틀린 칸은 「틀」 항목의 걸림이고 값 검사에는 빈칸으로 넘긴다(T27의 타당성 · 그림인물)', 건너뜀, () => {
  const 값 = 파(String.raw`
out = {}
def t27(v):
    def f(c, s): c["C3"]["타당성"] = v
    return f
out["타당성"] = {이름: [x[3][:40] for x in 걸림들(표(t27(v))) if x[1] == "C3"] for 이름, v in 빈꼴.items()}
def 그림인물글(c, s): c["C1"]["그림인물"] = "수아, 옆집"
out["그림인물"] = [x[3][:60] for x in 걸림들(표(그림인물글)) if x[1] == "C1"]
def 끝그림인물객체(c, s): c["C2"]["끝그림인물"] = {"수아": 1, "옆집": 1}
out["끝그림인물"] = [x[3][:40] for x in 걸림들(표(끝그림인물객체)) if x[1] == "C2"]
def 안쓰는칸(c, s): c["C1"]["연기세기"] = []
r = 줄들(표(안쓰는칸)); out["안쓰는칸"] = [[x[2], x[3].startswith("「연기세기」 칸은 글 꼴로 적는다 — 지금은 목록이다")] for x in r if x[0] == "틀"]
# 「틀」을 뺀 실행(받은 뒤 단계)에는 꼴 줄이 없고 표를 고치지 않는다
s = 표(t27([])); r = 줄들(s, 항목={"소품", "사건", "소리"}); out["틀뺌"] = [[x for x in r if x[0] == "틀"], s["detail"][2].get("타당성")]
s = 표(t27([])); 줄들(s); out["비움"] = "타당성" in s["detail"][2]
print(json.dumps(out, ensure_ascii=False))
`);
  for (const [이름, 줄] of Object.entries(값.타당성)) {
    assert.ok(줄.some((x) => /^「타당성」 칸은 글 꼴로 적는다 — 지금은 /.test(x)), `${이름}: 꼴 걸림 ${줄}`);
    assert.ok(줄.some((x) => /^두 사람 이상이 한 화면인데 「타당성」 칸이 비었다/.test(x)), `${이름}: T27 걸림 ${줄}`);
  }
  assert.deepEqual(값.그림인물, ['「그림인물」 칸은 글 목록 꼴로 적는다 — 지금은 글이다. 꼴이 틀린 칸은 빈칸으로 읽는다']);
  assert.match(값.끝그림인물[0], /^「끝그림인물」 칸은 글 목록 꼴로 적는다 — 지금은 객체이다/);
  assert.deepEqual(값.안쓰는칸, [['걸림', true]], '꼴이 틀린 칸이 있으면 「빈 칸 없음」 통과 줄을 내지 않는다');
  assert.deepEqual(값.틀뺌, [[], []]);
  assert.equal(값.비움, false, '꼴이 틀린 칸은 표에서 지워 값 검사가 빈칸으로 읽는다');
});

test('면제 칸 — 꼴이 틀리면 면제하지 않는다(한결 · 시안없음 · 키 · 차간격 · 압축 · 시간건너뜀 · 이어찍기 · 시늉까닭 · 같은판 · 로고멈춤초)', 건너뜀, () => {
  const 값 = 파(String.raw`
out = {}
def 탈것(s):
    s["소품"]["버스"] = {"종류": "탈것", "낱말": ["bus"], "색": "red", "생김새": "a red bus", "기준그림": "ref/bus.png"}
    s["소품"]["택시"] = {"종류": "탈것", "낱말": ["taxi"], "색": "yellow", "생김새": "a yellow taxi", "기준그림": "ref/taxi.png"}
    for d in s["detail"]: d["소품"]["버스"] = "길에"; d["소품"]["택시"] = "길에"
def 갈래같음(v):
    def f(c, s):
        for 띠 in "기승전결": s["감정흐름"][띠]["갈래"] = "애"
        if v is not ...: s["감정흐름"]["한결"] = v
    return f
out["한결"] = {str(v): [[x[2], "까닭" if "「한결」 까닭" in x[3] else "굴곡 없음"] for x in 줄들(표(갈래같음(v))) if "갈래가 모두" in x[3]] for v in (..., "여운으로만 간다", [], False, 0, {})}
def 시안(v):
    def f(c, s):
        g = {"글": "제목", "종류": "강조", "어디": "가운데", "만드는법": "그린 글자 — 장면과 한 장으로 굽는다"}
        if v is not ...: g["시안없음"] = v
        s["글자"] = [g]
    return f
out["시안없음"] = {str(v): [[x[2], "까닭" if "「시안없음」 까닭" in x[3] else "시안"] for x in 줄들(표(시안(v)), 영상="최종.mp4") if "「시안」에" in x[3]] for v in (..., "글자 없는 끝", False, [], 0)}
def 키(v):
    def f(c, s): 탈것(s); s["인물"]["수아"]["키"] = v; s["인물"]["옆집"]["키"] = "버스 창턱이 어깨에 온다"; s["장면"]["부엌밤"]["차간격"] = "차 길이 3분의 1"
    return f
out["키"] = {str(v): sum("「키」 칸이 없다" in x[3] for x in 걸림들(표(키(v)))) for v in ("버스 지붕이 어깨에 온다", [], {}, 0, False)}
def 차간격(v):
    def f(c, s):
        탈것(s)
        for p in s["인물"].values(): p["키"] = "버스 창턱이 어깨에 온다"
        s["장면"]["부엌밤"]["차간격"] = v
    return f
out["차간격"] = {str(v): sum("「차간격」 칸이 없다" in x[3] for x in 걸림들(표(차간격(v)))) for v in ("차 길이 3분의 1", {}, [], 0, False)}
def 압축(v):
    def f(c, s): s["사건"][0].pop("결과"); s["사건"][0]["압축"] = v
    return f
out["압축"] = {str(v): [[x[2], "압축" if "압축 몽타주" in x[3] else "네 박" if "네 박 가운데 결과" in x[3] else x[3][:12]] for x in 줄들(표(압축(v))) if x[0] == "사건"] for v in (True, "false", "true", 1)}
def 건너뜀(v):
    def f(c, s):
        for 컷, 상태 in (("C1", "식탁에"), ("C2", "식탁에"), ("C3", "식탁에"), ("C4", "없음")): c[컷]["소품"]["컵"] = 상태
        c["C4"]["시간건너뜀"] = v
    return f
out["시간건너뜀"] = {str(v): [[x[2], "건너뜀" if "(시간 건너뜀)" in x[3] else "동작 없음" if "동작 컷이 없다" in x[3] else x[3][-12:]] for x in 줄들(표(건너뜀(v))) if "「컵」 식탁에 → 없음" in x[3]] for v in (True, "false", "true", 1)}
def 이어(v):
    def f(c, s): c["C2"]["앵글"] = copy.deepcopy(c["C1"]["앵글"]); c["C2"]["이어찍기"] = v
    return f
out["이어찍기"] = {str(v): sum("크기 · 높이 · 방향 모두 같다" in x[3] for x in 걸림들(표(이어(v)))) for v in (True, "true", 1, [True])}
def 시늉(v):
    def f(c, s):
        c["C1"]["연기"][0]["무엇"] = "밥 먹는 시늉을 한다"
        if v is not ...: c["C1"]["시늉까닭"] = v
    return f
out["시늉까닭"] = {str(v): [[x[2], "까닭" if "「시늉까닭」:" in x[3] else "받침 없음"] for x in 줄들(표(시늉(v))) if "시늉에 뜻을 맡긴 박자" in x[3]] for v in (..., "누구나 읽는 손 흔들기", [], {}, 0, False)}
def 꼴만(칸, v):
    def f(c, s): (c["C2"] if 칸 == "같은판" else s["끝"] if 칸 == "로고멈춤초" else s["소리사건"][0])[칸] = v
    return f
out["꼴만"] = [[x[3].split(". 꼴이 틀린")[0] for x in 걸림들(표(꼴만(칸, v))) if f"「{칸}」 칸은" in x[3] or f".{칸}」 칸은" in x[3]] for 칸, v in (("같은판", True), ("로고멈춤초", float("nan")), ("소리없음", "true"))]
print(json.dumps(out, ensure_ascii=False))
`);
  // 한결: 칸이 없으면 걸림, 까닭을 글로 적으면 주의, 꼴이 틀리면 걸림 그대로
  assert.deepEqual(값.한결, { Ellipsis: [['걸림', '굴곡 없음']], '여운으로만 간다': [['주의', '까닭']], '[]': [['걸림', '굴곡 없음']], False: [['걸림', '굴곡 없음']], 0: [['걸림', '굴곡 없음']], '{}': [['걸림', '굴곡 없음']] });
  // 시안없음: --영상에서 시안이 없으면 걸림, 까닭을 글로 적으면 주의, 꼴이 틀리면 걸림 그대로
  assert.deepEqual(값.시안없음, { Ellipsis: [['걸림', '시안']], '글자 없는 끝': [['주의', '까닭']], False: [['걸림', '시안']], '[]': [['걸림', '시안']], 0: [['걸림', '시안']] });
  assert.deepEqual(값.키, { '버스 지붕이 어깨에 온다': 0, '[]': 1, '{}': 1, 0: 1, False: 1 });
  assert.deepEqual(값.차간격, { '차 길이 3분의 1': 0, '{}': 1, '[]': 1, 0: 1, False: 1 });
  // 압축: true만 네 박을 묻지 않는다 — 글 「false」 · 「true」 · 1은 꼴 걸림이고 네 박을 묻는다
  assert.deepEqual(값.압축.True, [['통과', '압축']]);
  for (const v of ['false', 'true', '1']) assert.deepEqual(값.압축[v], [['걸림', '네 박']], `압축 ${v}`);
  // 시간건너뜀: true만 동작 없는 소품 변화를 지나가게 한다
  assert.deepEqual(값.시간건너뜀.True, [['통과', '건너뜀']]);
  for (const v of ['false', 'true', '1']) assert.deepEqual(값.시간건너뜀[v], [['걸림', '동작 없음']], `시간건너뜀 ${v}`);
  assert.deepEqual(값.이어찍기, { True: 0, true: 1, 1: 1, '[True]': 1 });
  // 시늉까닭(T30): 받침 없는 시늉 박자는 걸림, 까닭을 글로 적으면 주의, 꼴이 틀리면 걸림 그대로
  assert.deepEqual(값.시늉까닭, { Ellipsis: [['걸림', '받침 없음']], '누구나 읽는 손 흔들기': [['주의', '까닭']], '[]': [['걸림', '받침 없음']], '{}': [['걸림', '받침 없음']], 0: [['걸림', '받침 없음']], False: [['걸림', '받침 없음']] });
  assert.deepEqual(값.꼴만, [['「같은판」 칸은 글 꼴로 적는다 — 지금은 true이다'], ['「로고멈춤초」 칸은 수 꼴로 적는다 — 지금은 수이다'], ['「소리사건 1번째 줄.소리없음」 칸은 true · false 꼴로 적는다 — 지금은 글이다']]);
});

test('읽는 칸 ⊆ 칸 사전 — 표 검사가 읽는 칸은 모두 사전에 있고, 사전에 없는 칸을 읽는 검사가 생기면 이 시험이 잡는다', 건너뜀, () => {
  const 값 = 파(String.raw`
읽힘 = set()
class D(dict):                      # 읽은 칸을 적는 dict — 표 검사가 .get · [] · in으로 읽는 칸을 모두 적는다
    def __init__(self, src, 길):
        super().__init__(); self._길 = 길
        for x, v in src.items(): dict.__setitem__(self, x, 싸기(v, 길 + (x,)))
    def _적음(self, x):
        if isinstance(x, str): 읽힘.add(self._길 + (x,))
    def get(self, x, d=None): self._적음(x); return dict.get(self, x, d)
    def __getitem__(self, x): self._적음(x); return dict.__getitem__(self, x)
    def __contains__(self, x): self._적음(x); return dict.__contains__(self, x)
    def setdefault(self, x, d=None): self._적음(x); return dict.setdefault(self, x, d)
def 싸기(v, 길):
    if isinstance(v, dict): return D(v, 길)
    if isinstance(v, list): return [싸기(x, 길 + (i,)) for i, x in enumerate(v)]
    return v
# 틀 + 탈것 둘 · 사람과 탈것(T20 · T25) · 원고(T21) · 창과 토막(T28) · 한결 · 시안없음 · 압축 · 같은판 · 이어찍기 · 끝그림인물을 읽게 하는 표
s = copy.deepcopy(틀); c = {d["cut"]: d for d in s["detail"]}
for 이름, 낱 in (("버스", "bus"), ("택시", "taxi")):
    s["소품"][이름] = {"종류": "탈것", "낱말": [낱], "색": "red", "생김새": f"a red {낱}", "기준그림": f"ref/{낱}.png"}
    for d in s["detail"]: d["소품"][이름] = "길에"
s["소리"]["원고"] = [["C1", 0.5, "혼자 먹는 밤이다"]]; s["소리"]["원고시험"] = {"누가": "눈", "날짜": "2026-11-20", "줄": [{"글": "혼자 먹는 밤이다", "판정": "바로", "뜻": "혼자 먹는다"}]}
for 띠 in "기승전결": s["감정흐름"][띠]["갈래"] = "애"
s["감정흐름"]["한결"] = "한 감정으로 간다"
s["글자"] += [{"글": "제목", "종류": "강조", "어디": "가운데", "만드는법": "그린 글자 — 장면과 한 장으로 굽는다", "시안없음": "까닭"}, {"글": "말", "종류": "말자막", "어디": "아래", "만드는법": "자막 도구", "크기": 72}]
s["사건"].append({"이름": "몽타주", "압축": True})
둘째 = copy.deepcopy(c["C2"]); 둘째.update({"창": {"세로": 0.62}, "같은판": "한 방을 둘로 자름", "이어찍기": True, "판": "C2", "끝그림인물": ["수아"], "그림인물": ["수아"]})
s["detail"].insert(s["detail"].index(c["C2"]) + 1, 둘째)
s["끝"].pop("로고멈춤초", None); s["끝"]["로고없음"] = "로고 없는 편"; s["끝"]["브랜드보임"] = True
s["소리사건"][0]["반응번째"] = 1; s["소리사건"].append({"이름": "문", "t": 1.0, "반응t": 1.8, "소리없음": True})
s["편"]["경계확인"] = "필수"
for seq in (틀, s):
    for 영상 in (None, "최종.mp4"):
        r = m.결과(); m.표검사(m.장면실내채움(싸기(copy.deepcopy(seq), ())), r, m.기본항목, 영상=영상)
없는 = sorted({길글(["[]" if isinstance(x, int) else x for x in 길]) for 길 in 읽힘 if k.사전길찾기(길) is None})
# 사전에 없는 칸을 읽는 검사가 생기면: 읽힌 칸에 그 길이 남고 사전에서 못 찾는다
읽힘.clear(); w = 싸기(copy.deepcopy(틀), ()); w["detail"][0].get("새로읽는칸"); w.get("새맨위칸")
새 = sorted(길글(길) for 길 in 읽힘 if k.사전길찾기(길) is None)
print(json.dumps({"없는": 없는, "새": 새}, ensure_ascii=False))
`);
  assert.deepEqual(값.없는, [], `표 검사가 읽는데 칸 사전에 없는 칸 — tools/lib/컷표읽기.py의 칸사전에 꼴과 함께 더한다: ${값.없는}`);
  assert.deepEqual(값.새, ['detail.0.새로읽는칸', '새맨위칸']);
});

test('뼈대 탈 — 「틀」이 수가 아니거나 detail이 목록이 아니거나 줄이 객체가 아니거나 cut이 글이 아니면 걸림만 내고 값 검사를 돌리지 않는다(예외로 죽지 않는다)', 건너뜀, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-cutshape-'));
  const 틀 = () => JSON.parse(fs.readFileSync(틀경로, 'utf8'));
  const 경우 = [
    ['detail이 객체', (s) => { s.detail = { C1: s.detail[0] }; }, /「detail」은 컷을 한 줄씩 적는 목록이다 — 지금은 객체이다/],
    ['detail이 글', (s) => { s.detail = 'C1, C2'; }, /「detail」은 컷을 한 줄씩 적는 목록이다 — 지금은 글이다/],
    ['detail이 수', (s) => { s.detail = 5; }, /지금은 수이다/],
    ['줄이 목록', (s) => { s.detail[2] = [s.detail[2]]; }, /detail 3번째 줄이 객체\(\{"cut": …\}\)가 아니다 — 지금은 목록이다/],
    ['줄이 글', (s) => { s.detail[1] = 'C2'; }, /detail 2번째 줄이 객체/],
    ['cut 없음', (s) => { delete s.detail[2].cut; }, /detail 3번째 줄의 「cut」\(컷 이름\)이 비었다/],
    ['cut이 null', (s) => { s.detail[2].cut = null; }, /detail 3번째 줄의 「cut」\(컷 이름\)이 비었다/],
    ['cut이 공백', (s) => { s.detail[0].cut = '  '; }, /detail 1번째 줄의 「cut」\(컷 이름\)이 비었다/],
    ['cut이 수', (s) => { s.detail[0].cut = 3; }, /detail 1번째 줄의 「cut」\(컷 이름\)이 글이 아니다 — 지금은 수이다/],
    ['cut이 목록', (s) => { s.detail[0].cut = ['C1']; }, /지금은 목록이다/],
    ['표가 목록', () => null, /컷표가 객체\(\{ … \}\)가 아니다 — 지금은 목록이다/],
    ['옛 틀의 줄이 글', (s) => { delete s.틀; s.detail[1] = 'C2'; }, /detail 2번째 줄이 객체/],
    ['틀이 목록', (s) => { s.틀 = [2]; }, /「틀」은 수로 적는다\(틀 2 표는 2\) — 지금은 목록이다/],
    ['틀이 글', (s) => { s.틀 = '둘'; }, /「틀」은 수로 적는다/],
    ['틀이 참거짓', (s) => { s.틀 = true; }, /「틀」은 수로 적는다\(틀 2 표는 2\) — 지금은 true이다/],
  ];
  for (const [이름, 고침, 기대] of 경우) {
    const s = 틀(); const 표 = 고침(s) === null ? [s] : s;
    const f = path.join(dir, `${경우.findIndex((x) => x[0] === 이름)}.json`); fs.writeFileSync(f, JSON.stringify(표), 'utf8');
    const r = spawnSync('python', ['-I', '-X', 'utf8', 도구, f, '--json'], { encoding: 'utf8', env: 이력끔 });
    assert.equal(r.status, 1, `${이름}: 끝 코드 ${r.status} ${r.stderr.slice(-400)}`);
    assert.ok(!/Traceback/.test(r.stderr), `${이름}: ${r.stderr.slice(-400)}`);
    const 항목들 = JSON.parse(r.stdout);
    assert.ok(항목들.length >= 1 && 항목들.every((x) => x.항목 === '틀' && x.등급 === '걸림' && x.컷 === '표'), `${이름}: ${JSON.stringify(항목들).slice(0, 300)}`);
    assert.ok(항목들.some((x) => 기대.test(x.글)), `${이름}: ${항목들.map((x) => x.글)}`);
  }
  // 그림 지시문 · 지시문 폴더를 함께 줘도 컷 줄을 읽는 나머지 항목은 돌지 않는다
  const s = 틀(); s.detail[1] = 'C2'; const f = path.join(dir, 'with.json'); fs.writeFileSync(f, JSON.stringify(s), 'utf8');
  const r = spawnSync('python', ['-I', '-X', 'utf8', 도구, f, '--그림지시문', dir, '--지시문', dir, '--json'], { encoding: 'utf8', env: 이력끔 });
  assert.equal(r.status, 1, r.stderr.slice(-400)); assert.ok(!/Traceback/.test(r.stderr), r.stderr.slice(-400));
  assert.ok(JSON.parse(r.stdout).every((x) => x.항목 === '틀' && x.등급 === '걸림'));
});

// ───────── 11-21 GPT 검수(영상컷표꼴관문-20261120 · 영상타당성검사-20261120-다시1)가 낸 자리 ─────────

// GA1 — 목록으로 적은 원고 줄은 줄 전체가 목록이라는 이유로 지나갔다(글 자리에 []를 넣으면 T21이 그 줄을 말없이 버렸다)
test('원고 줄 — 목록으로 적은 줄도 [컷 이름, 초, 원고 글] 꼴을 본다: 틀린 줄은 걸림이고 그 줄만 빼며, 남은 줄은 T21이 그대로 본다', 건너뜀, () => {
  const 값 = 파(String.raw`
def 원고(줄들_):
    def f(c, s): s["소리"]["원고"] = 줄들_
    return f
좋은 = ["C2", 1.0, "혼자 먹는 밤이다"]
out = {"나쁜": {}}
for 이름, 나쁜 in (("글 자리 목록", ["C1", 0.5, []]), ("글 자리 수", ["C1", 0.5, 3]), ("컷 자리 수", [1, 0.5, "글"]), ("한 칸", ["C1"]), ("가운데 글", ["C1", "곧", "글"]), ("빈 줄", [])):
    x = 줄들(표(원고([나쁜, 좋은])))
    out["나쁜"][이름] = [sum(y[2] == "걸림" and "「원고 1번째 줄」" in y[3] for y in x), sum(y[2] == "걸림" and "원고 1줄에 「원고시험」 칸이 없다" in y[3] for y in x)]
out["좋은"] = [y[3] for y in 줄들(표(원고([좋은, ["C1", "혼자 끓인다"], ["C3", "1.5", "둘이 먹는다"], {"컷": "C1", "글": "물이 끓는다"}]))) if "꼴로 적는다" in y[3]]
out["객체"] = [y[3].split(". 꼴이")[0] for y in 줄들(표(원고([{"컷": ["C1"], "글": "물이 끓는다"}, 좋은]))) if "꼴로 적는다" in y[3]]
print(json.dumps(out, ensure_ascii=False))
`);
  for (const [이름, 수] of Object.entries(값.나쁜)) assert.deepEqual(수, [1, 1], `${이름}: 꼴 걸림 한 줄 · 남은 한 줄의 T21 걸림`);
  assert.deepEqual(값.좋은, [], '컷 이름 · (초) · 글 차례의 줄과 객체 줄은 꼴 걸림이 없다');
  assert.deepEqual(값.객체, ['「원고 1번째 줄.컷」 칸은 글 꼴로 적는다 — 지금은 목록이다']);
});

// GA2 — 이름 목록에 글이 아닌 것이 섞였다고 목록을 통째로 지우면, 그 컷이 사람 컷이라는 사실까지 사라져 판 검사의 기준이 낮아졌다
test('이름 목록 — 글이 아닌 원소가 섞이면 걸림이고 읽을 수 있는 이름은 남긴다(사람 판의 박자 둘 기준이 그대로다), 남는 이름이 없으면 칸을 비운다', 건너뜀, () => {
  const 값 = 파(String.raw`
out = {}
for 이름, v in (("섞임", ["수아", None]), ("수 섞임", ["수아", 3, "옆집"]), ("모두 틀림", [None, 1]), ("글", "수아")):
    s = 표(lambda c, s_: c["C2"].__setitem__("인물", v)); x = 줄들(s)
    c2 = [d for d in s["detail"] if d["cut"] == "C2"][0]
    정보 = m.판정보({"id": "C2", "폴더": "002_C2"}, s)
    out[이름] = {"꼴": [y[3] for y in x if y[2] == "걸림" and y[1] == "C2" and "「인물」 칸은" in y[3]], "남은": c2.get("인물", "없음"), "박자최소": 정보["박자최소"], "인물": 정보["인물"]}
print(json.dumps(out, ensure_ascii=False))
`);
  assert.equal(값.섞임.꼴.length, 1); assert.match(값.섞임.꼴[0], /「인물」 칸은 글 목록 꼴로 적는다 — 지금은 목록이다 — 글이 아닌 것이 들어 있다\. 글이 아닌 것은 빼고 읽는다/);
  assert.deepEqual([값.섞임.남은, 값.섞임.박자최소, 값.섞임.인물], [['수아'], 2, ['수아']]);
  assert.deepEqual([값['수 섞임'].남은, 값['수 섞임'].박자최소], [['수아', '옆집'], 2]);
  assert.deepEqual([값['모두 틀림'].꼴.length, 값['모두 틀림'].남은], [1, '없음']);
  assert.deepEqual([값.글.꼴.length, 값.글.남은], [1, '없음']);
});

// GA3 — 컷의 「실내」를 null로 적으면 열쇠가 있다는 이유로 장면의 실내를 물려받지 않았다(꼴 관문은 null을 칸이 없는 것으로 읽는다)
test('장면실내채움 — 컷의 「실내」 · 「실외」가 null이면 칸이 없는 것과 같아 장면의 「실내」를 물려받는다', 건너뜀, () => {
  const 값 = 파(String.raw`
def 본(고침):
    s = 표(고침); m.장면실내채움(s)
    return [d.get("실내") for d in s["detail"] if d["cut"] == "C1"][0]
out = {
    "null": 본(lambda c, s: c["C1"].__setitem__("실내", None)),
    "없음": 본(lambda c, s: c["C1"].pop("실내")),
    "실외 null": 본(lambda c, s: (c["C1"].pop("실내"), c["C1"].__setitem__("실외", None))),
    "실외 true": 본(lambda c, s: (c["C1"].pop("실내"), c["C1"].__setitem__("실외", True))),
    "false": 본(lambda c, s: c["C1"].__setitem__("실내", False)),
}
print(json.dumps(out, ensure_ascii=False))
`);
  assert.deepEqual(값, { null: true, 없음: true, '실외 null': true, '실외 true': null, false: false });
});

// GA4 · GA5 — 수 칸은 숫자를 적은 글도 받는데 사건 검사가 날것을 견줘 글 순서로 정렬하거나 죽었고, 꼴이 틀려 지워진 시각 칸을 대괄호로 읽다 죽었다
test('시각 칸 — 숫자를 적은 글은 수로 읽어 수로 적은 표와 결과가 같고, 꼴이 틀려 지워진 시각은 그 줄의 걸림이 된다(예외로 죽지 않는다)', 건너뜀, () => {
  const 값 = 파(String.raw`
def 본(고침): return [list(y[:3]) for y in 줄들(표(고침)) if y[0] in ("사건", "소리")]
def 글로(c, s):
    for d in s["detail"]: d["t"] = str(float(d["t"])); d["dur"] = str(d["dur"])
    for ev in s["소리사건"]: ev["t"] = str(ev["t"])
out = {"수": 본(lambda c, s: None), "글": 본(글로), "하나만 글": 본(lambda c, s: c["C2"].__setitem__("t", "3.5"))}
def 걸림글(고침): return [y[3] for y in 줄들(표(고침)) if y[2] == "걸림" and y[0] in ("사건", "소리")]
out["컷 t false"] = 걸림글(lambda c, s: c["C1"].__setitem__("t", False))
out["소리 t true"] = 걸림글(lambda c, s: s["소리사건"][0].__setitem__("t", True))
out["반응t 목록"] = 걸림글(lambda c, s: s["소리사건"][0].__setitem__("반응t", [3.5]))
out["반응번째 글"] = 걸림글(lambda c, s: s["소리사건"][0].__setitem__("반응번째", "둘째"))
out["반응 컷 t 없음"] = 걸림글(lambda c, s: c["C2"].pop("t"))
print(json.dumps(out, ensure_ascii=False))
`);
  assert.deepEqual(값.글, 값.수, '숫자를 글로 적은 표');
  assert.deepEqual(값['하나만 글'], 값.수, '한 칸만 글로 적은 표');
  assert.ok(값.수.some((x) => x[0] === '사건' && x[2] === '통과') && 값.수.some((x) => x[0] === '소리' && x[2] === '통과'), JSON.stringify(값.수));
  assert.ok(값['컷 t false'].some((x) => /C1.*「t」/.test(x)), JSON.stringify(값['컷 t false']));
  assert.ok(값['소리 t true'].some((x) => /「t」/.test(x)), JSON.stringify(값['소리 t true']));
  assert.equal(값['반응t 목록'].length, 0, '반응t가 지워지면 반응 컷의 시작으로 잰다 — 꼴 걸림은 「틀」 항목에 있다');
  assert.equal(값['반응번째 글'].length, 0, '반응번째가 지워지면 첫 토막으로 잰다');
  assert.ok(값['반응 컷 t 없음'].some((x) => /C2.*「t」/.test(x)), JSON.stringify(값['반응 컷 t 없음']));
});

// GA5 · GA6 · GA7 — 틀 예시의 모든 칸에 틀린 값을 넣어도 표 검사와 판 대조(판정보 · 빛대조 · 시늉대조)가 예외로 죽지 않는다
test('전수 — 틀 예시의 모든 칸에 null · 빈 것 · 다른 꼴을 넣어도 표 검사와 판 대조가 예외로 죽지 않는다', 건너뜀, () => {
  const 값 = 파(String.raw`
def 길들(o, 길=()):
    if isinstance(o, dict):
        for x, v in o.items(): yield 길 + (x,); yield from 길들(v, 길 + (x,))
    elif isinstance(o, list):
        for i, v in enumerate(o): yield 길 + (i,); yield from 길들(v, 길 + (i,))
나쁜값 = [None, [], {}, 0, False, True, "", "글", ["글"], [None], {"k": "글"}, float("nan")]
판 = {"id": "C1", "폴더": "001_C1"}
죽음, 돌림 = [], 0
for 길 in 길들(틀):
    for v in 나쁜값:
        s = 넣기(틀, 길, v); 돌림 += 1
        try:
            r = m.결과(); m.표검사(m.장면실내채움(s), r, m.기본항목)
            if not k.뼈대검사(s):
                정보 = m.판정보(판, s); 컷들 = 정보["컷들"] or ["C1"]
                m.빛대조(s, 컷들, "LIGHT: warm"); m.시늉대조(s, 컷들, "ACTION: she mimes eating with an empty hand.")
        except Exception as e:
            죽음.append([길글(길), repr(v), type(e).__name__, str(e)[:70]])
print(json.dumps({"돌림": 돌림, "죽음수": len(죽음), "죽음": 죽음[:25]}, ensure_ascii=False))
`);
  assert.ok(값.돌림 > 2000, `돌린 수 ${값.돌림}`);
  assert.equal(값.죽음수, 0, `예외로 죽은 입력 ${값.죽음수}개 — ${JSON.stringify(값.죽음)}`);
});

// 타당성 다시 검수 GA1 — 세 목록을 합쳐 세면 시작 그림과 끝 그림에 따로 나오는 두 사람도 「한 화면」으로 걸리고, 한 목록에 같은 이름을 두 번 적어도 둘로 셌다
test('T27 — 한 목록(영상 · 시작 그림 · 끝 그림)에 서로 다른 사람이 둘 이상일 때만 타당성을 묻는다', 건너뜀, () => {
  const 값 = 파(String.raw`
def 본(인물, 그림=None, 끝=None):
    def f(c, s):
        c["C3"]["인물"] = 인물; c["C3"].pop("타당성", None)
        if 그림 is not None: c["C3"]["그림인물"] = 그림
        if 끝 is not None: c["C3"]["끝그림인물"] = 끝
    return sum(y[2] == "걸림" and y[1] == "C3" and "「타당성」 칸이 비었다" in y[3] for y in 줄들(표(f)))
out = {
    "영상에 둘": 본(["수아", "옆집"]),
    "시작 그림에 둘": 본(["수아"], ["수아", "옆집"]),
    "끝 그림에 둘": 본(["수아"], ["수아"], ["수아", "옆집"]),
    "따로 한 사람씩": 본(["수아"], ["수아"], ["옆집"]),
    "같은 이름 두 번": 본(["수아"], ["수아", "수아"]),
    "한 사람": 본(["수아"]),
}
print(json.dumps(out, ensure_ascii=False))
`);
  assert.deepEqual(값, { '영상에 둘': 1, '시작 그림에 둘': 1, '끝 그림에 둘': 1, '따로 한 사람씩': 0, '같은 이름 두 번': 0, '한 사람': 0 });
});

// 타당성 다시 검수 GA3 — T22는 영상의 「인물」만 봐서, 시작 · 끝 그림에만 나오는 사람의 빈 「옷」이 지나갔다
test('T22 옷 — 시작 그림 · 끝 그림에만 나오는 사람도 「옷」을 묻고, 공백뿐인 글은 빈칸이다', 건너뜀, () => {
  const 값 = 파(String.raw`
def 본(고침): return [y[1] for y in 줄들(표(고침)) if y[2] == "걸림" and "「옷」 칸이 비었다" in y[3]]
def 그림에만(칸):
    def f(c, s): c["C3"]["인물"] = ["수아"]; c["C3"][칸] = ["수아", "옆집"]; c["C3"]["타당성"] = "문 앞에서 그릇을 건네는 거리다"; s["인물"]["옆집"]["옷"] = ""
    return f
out = {"그림인물": 본(그림에만("그림인물")), "끝그림인물": 본(그림에만("끝그림인물")), "공백": 본(lambda c, s: s["인물"]["수아"].__setitem__("옷", "   ")),
       "안 나오는 사람": 본(lambda c, s: (c["C3"].__setitem__("인물", ["수아"]), s["인물"]["옆집"].__setitem__("옷", ""))), "그대로": 본(lambda c, s: None)}
print(json.dumps(out, ensure_ascii=False))
`);
  assert.deepEqual(값, { 그림인물: ['인물 옆집'], 끝그림인물: ['인물 옆집'], 공백: ['인물 수아'], '안 나오는 사람': [], 그대로: [] });
});
