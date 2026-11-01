# TOPIK 3→4급 뼈대(docs/TOPIK_3to4급_뼈대_시안_20261102.md)의 문형 층 strata/topik-ii.grammar.json을 만든다.
# 원천은 국립국어원 「2017년 국제 통용 한국어 표준 교육과정 적용 연구(4단계) 어휘·문법 등급 목록」
# (2020-11-17 수정판 엑셀, 누리집 보고서 932)의 둘째 시트(문법) 3급 · 4급 행 그대로다. 엑셀은 저장소에 넣지 않는다.
#   python -I tools/build-topik-ii-grammar.py <엑셀 경로>            층을 다시 쓴다
#   python -I tools/build-topik-ii-grammar.py <엑셀 경로> --check    층과 단원(strata/topik-ii.units.json)의 등급 · 번호가 원자료와 같은지만 본다
# id는 S + 등급 + 등급별 번호 두 자리다(S301 = 3급 1번). TOPIK I 층(topik-i.grammar.json)의 S1xx · S2xx는 차례 번호라 뜻이 다르다.
# 문법 은행(strata/grammar-bank.json)과의 짝은 손으로 맞췄다(아래 BANK) — 은행 문형의 뜻이 그 공식 항목과 같을 때만 잇는다.
import hashlib
import json
import pathlib
import sys

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'strata' / 'topik-ii.grammar.json'
UNITS = ROOT / 'strata' / 'topik-ii.units.json'
SOURCE_SHA256 = '2cde28ab90e04728513e65ef5df4baaa400a4055fe2abd1856889cb983c4c3ac'

# 은행 문형 → 공식 3 · 4급 항목(S id). 뜻이 다르면 잇지 않는다(예: 하고/와/과 ≠ 이며, -고 나열 ≠ -고4 종결).
BANK = {
    'S367': 'G512',  # -는다고3 인용 ← -다고/-냐고/-라고/-자고 하다
    'S328': 'G601',  # -거든2 종결 ← -거든요
    'S332': 'G602',  # -잖아 ← -잖아요
    'S327': 'G604',  # -던- 관형사형 ← -던
    'S356': 'G605',  # -어지다 ← -아/어지다
    'S335': 'G606',  # -게 하다
    'S317': 'G607',  # -도록
    'S324': 'G611',  # -다가1(2) 중단 ← -다가 동작 전환(원자료는 2급 -다가1(1)도 뜻을 「중단」으로 적는다 — 보고서 본문으로 갈래를 다시 볼 것)
    'S323': 'G701',  # -자마자
    'S316': 'G702',  # -느라고
    'S344': 'G705',  # -나 보다
    'S341': 'G708',  # -는 대신에
    'S343': 'G713',  # -는 반면 ← -는 반면에
    'S466': 'G609',  # -는대2 인용 ← -대(요)/-래(요)/-냬(요)
    'S408': 'G617',  # 치고 ← -치고
    'S454': 'G703',  # -는 바람에
    'S429': 'G704',  # -을수록 ← -(으)ㄹ수록
    'S465': 'G706',  # -을 뻔하다
    'S420': 'G714',  # -더라도
    'S417': 'G722',  # -기에
    'S419': 'G723',  # -다시피
    'S426': 'G724',  # -더니
}
# 은행이 3~5단계에 두었지만 공식 3 · 4급이 아닌 것 — 단원에 걸 때 급을 착각하지 않도록 함께 적는다.
BANK_ELSEWHERE = [
    ['G502', '-(으)면서', '2급', '-으면서'],
    ['G503', '-기 때문에', '2급', '-기 때문에'],
    ['G504', '-게 되다', '2급', '-게 되다'],
    ['G507', '-아/어 있다', '2급', '-어 있다'],
    ['G508', '-기로 하다', '2급', '-기로 하다'],
    ['G510', '-는 게 좋겠다', None, '목록에 없음'],
    ['G511', '-군요', '2급', '-는군'],
    ['G613', '-이/히/리/기-(피동 접미사)', None, '문법 목록에 없음(접사)'],
    ['G614', '-이/히/리/기/우-(사동 접미사)', None, '문법 목록에 없음(접사)'],
    ['G615', '-더라고요', '5급', '-더라고'],
    ['G616', '-(으)ㄹ 수밖에 없다', '2급', '-을 수밖에 없다'],
    ['G707', '-기/-게 마련이다', '5급', '-게 마련이다'],
    ['G709', '-(으)ㄴ 지', '2급', '-은 지2'],
    ['G710', '-을/를 통해', None, '목록에 없음'],
    ['G711', '-곤 하다', '5급', '-고는'],
    ['G712', '-(으)면서도', None, '목록에 없음'],
    ['G715', '-음에도 불구하고', '5급', '에도 불구하고'],
    ['G716', '-는 셈이다', None, '목록에 없음'],
    ['G725', '-았/었더라면', None, '목록에 없음'],
    ['G717', '-(으)ㅁ', '2급', '-음'],
    ['G718', '-기', '2급', '-기'],
    ['G719', '-(으)ㄴ/는 바', None, '목록에 없음'],
    ['G720', '-느니', '5급', '-느니1'],
    ['G721', '-을망정', '6급', '-을망정'],
]


def text(value):
    return None if value is None else str(value).strip() or None


def related(value):
    return [part.strip() for part in str(value or '').split(',') if part.strip()]


def read(path):
    data = pathlib.Path(path).read_bytes()
    if hashlib.sha256(data).hexdigest() != SOURCE_SHA256:
        sys.exit('원자료 엑셀의 sha256이 기록과 다르다 — 수정판이 바뀌었으면 SOURCE_SHA256과 BANK를 다시 맞춘다')
    book = openpyxl.load_workbook(path, read_only=True)
    vocab = [list(row) for row in book.worksheets[0].iter_rows(values_only=True)][1:]
    grammar = [list(row) for row in book.worksheets[1].iter_rows(values_only=True)][1:]
    return vocab, grammar


def build(grammar):
    points = []
    for row in grammar:
        level = text(row[2])
        if level not in ('3급', '4급'):
            continue
        sid = f'S{level[0]}{int(row[1]):02d}'
        points.append([sid, text(row[4]), related(row[5]), int(level[0]), text(row[3]), text(row[6]), BANK.get(sid)])
    ids = {p[0] for p in points}
    # 손으로 적은 「공식 급」도 원자료에서 다시 찾는다 — 그 급의 대표형이나 관련형에 있어야 한다.
    for bank_id, label, level, form in BANK_ELSEWHERE:
        if level is None:
            continue
        # 원자료 대표형 끝에 쉼표가 붙은 오타(6급 「-을망정,」)는 대조할 때만 뗀다.
        forms = [f.rstrip(',') for row in grammar if text(row[2]) == level for f in [text(row[4])] + related(row[5])]
        if form not in forms:
            sys.exit(f'BANK_ELSEWHERE {bank_id} {label}: {level}에 {form}이(가) 없다')
    missing = sorted(set(BANK) - ids)
    if missing or len(points) != 134:
        sys.exit(f'원자료 3 · 4급이 134개가 아니거나 BANK의 id가 없다: {len(points)} {missing}')
    return {
        'version': 'topik-ii-grammar-1',
        'note': 'TOPIK 3→4급 준비용 문형 층(제작용 초안, 2026-11-02). 국립국어원 국제 통용 한국어 표준 교육과정 등급 목록의 문법 3급 67 · 4급 67을 그대로 옮겼다. id는 S + 등급 + 등급별 번호(S301 = 3급 1번)이고, TOPIK I 층(topik-i.grammar.json)의 S1xx · S2xx 차례 번호와 뜻이 다르다. bank는 같은 뜻의 문법 은행(strata/grammar-bank.json) 문형이며 손으로 맞췄다. 등급은 표준 교육과정의 등급이고 TOPIK 급수 판정이 아니다. 단원 배정과 능력 연결은 교원 검수 전이다. 원자료의 표기(예: S449 관련형의 쉼표 빠짐, S365 「려다」)도 고치지 않고 그대로 옮겼다. 국립국어원 누리집의 공공누리 제1유형(출처표시) 안내에 따라 출처를 적는다.',
        'standard': {
            'title': '국립국어원 2017년 국제 통용 한국어 표준 교육과정 적용 연구(4단계) 어휘·문법 등급 목록(2020-11-17 수정)',
            'url': 'https://www.korean.go.kr/front/reportData/reportDataView.do?mn_id=45&report_seq=932',
            'selector': '둘째 시트(문법) 등급 3급 · 4급',
            'sha256': SOURCE_SHA256,
        },
        'built_by': 'tools/build-topik-ii-grammar.py',
        'fields': ['id', 'form', 'related', 'level', 'category', 'meaning', 'bank'],
        'points': points,
        'bank_elsewhere_fields': ['bank', 'label', 'official_level', 'official_form'],
        'bank_elsewhere': BANK_ELSEWHERE,
    }


def check_units(vocab, layer):
    if not UNITS.exists():
        return []
    units = json.loads(UNITS.read_text(encoding='utf-8'))
    grade = {}
    for row in vocab:
        # 원자료는 같은 꼴의 낱말을 「회의01」처럼 번호로 가른다 — 단원에는 번호 없는 꼴과 등급별 번호로 적는다.
        grade.setdefault(''.join(ch for ch in text(row[3]) if not ch.isdigit()), []).append((text(row[2]), int(row[1])))
    by_id = {p[0]: p for p in layer['points']}
    problems = []
    for unit in units['units']:
        for item in unit['grammar']:
            if item['id'] not in by_id:
                problems.append(f"{unit['id']} 문형 {item['id']}가 층에 없다")
            elif by_id[item['id']][1] != item['form']:
                problems.append(f"{unit['id']} {item['id']}의 대표형이 {by_id[item['id']][1]}인데 {item['form']}로 적혔다")
        for word in unit['words']:
            hits = grade.get(word['word'], [])
            if (word['level'] + '급', word['no']) not in [(g, n) for g, n in hits]:
                problems.append(f"{unit['id']} 낱말 {word['word']}의 등급 · 번호가 원자료({hits})와 다르다")
    return problems


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__ or '엑셀 경로를 준다')
    vocab, grammar = read(sys.argv[1])
    layer = build(grammar)
    body = json.dumps(layer, ensure_ascii=False, indent=1) + '\n'
    if '--check' in sys.argv:
        stale = not OUT.exists() or OUT.read_text(encoding='utf-8').replace('\r\n', '\n') != body
        problems = (['strata/topik-ii.grammar.json이 원자료로 만든 것과 다르다'] if stale else []) + check_units(vocab, layer)
        if problems:
            sys.exit('\n'.join(problems))
        print('TOPIK II 문형 층과 단원의 등급 · 번호가 원자료와 같다.')
        return
    OUT.write_bytes(body.encode('utf-8'))
    print(f'wrote {OUT.relative_to(ROOT)} ({len(layer["points"])} points)')


if __name__ == '__main__':
    main()
