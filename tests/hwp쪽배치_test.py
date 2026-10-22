"""HWP 쪽 배치 재기(tools/hwp쪽배치.py) 시험 — rhwp·Java·한컴 없이 돈다. 문서는 합성 레코드, 쪽 배치는 합성 dump-pages·render tree다.

실행: python -I -X utf8 tests/hwp쪽배치_test.py
실제 문서로 하는 확인(재기 수치·대조)은 로컬에서만 한다 — 공개 저장소라 계획서 HWP·글은 시험 자료로 쓰지 않는다.
"""
import importlib.util
import os
import struct
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('hwp_pages', ROOT / 'tools' / 'hwp쪽배치.py')
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)
H = M.H
TAB_DEF = 0x16  # 글자 모양 뒤에 오는 레코드(새 글자 모양이 그 앞에 끼는지 본다)


# ── 합성 HWP 레코드 ──────────────────────────────────────────────────────
def wtext(s):
    """글 → PARA_TEXT 바이트. 8글자짜리 제어(예: \\x0b 그리기 개체)는 코드·빈칸 6자·코드로 16바이트."""
    out = bytearray()
    for ch in s:
        c = ord(ch)
        out += struct.pack('<H', c) + bytes(12) + struct.pack('<H', c) if c in H.WIDE_CTRL else struct.pack('<H', c)
    return bytes(out)


def header(nchars, ncs=1, nls=1, divide=0):
    d = bytearray(24)
    struct.pack_into('<I', d, 0, nchars)
    struct.pack_into('<HBB', d, 8, 0, 0, divide)
    struct.pack_into('<HHH', d, 12, ncs, 0, nls)
    return bytes(d)


def runs_bytes(runs):
    return b''.join(struct.pack('<II', p, s) for p, s in runs)


def paragraph(level, text, runs, seg=True, divide=0):
    t = wtext(text + '\r')
    recs = [H.Rec(H.PARA_HEADER, level, header(M.text_positions(t)[1], len(runs), 1 if seg else 0, divide)),
            H.Rec(H.PARA_TEXT, level + 1, t), H.Rec(H.PARA_CHAR_SHAPE, level + 1, runs_bytes(runs))]
    if seg:
        recs.append(H.Rec(H.PARA_LINE_SEG, level + 1, bytes(36)))
    return recs


def face(name):
    return bytes([0]) + struct.pack('<H', len(name)) + name.encode('utf-16-le')


def char_shape(face_id, ratio=100):
    d = bytearray(72)
    for k in range(7):
        struct.pack_into('<H', d, 2 * k, face_id)
        d[M.RATIO_AT + k] = ratio
    struct.pack_into('<i', d, 42, 1200)
    return bytes(d)


def file_header(compressed=True, password=False):
    d = bytearray(256)
    d[:17] = b'HWP Document File'
    struct.pack_into('<I', d, 32, 0x05000300)
    struct.pack_into('<I', d, 36, (1 if compressed else 0) | (2 if password else 0))
    return bytes(d)


def streams(body, shapes=((0, 100), (1, 100)), faces=('휴먼명조', '맑은 고딕'), compressed=True, password=False):
    """shapes: (한글 글꼴 번호, 장평) — 글자 모양 0·1. body: 레코드 목록(구역 0)."""
    z = H.deflate if compressed else (lambda b: b)
    m = [0] * 18
    m[M.IDM_FACE_HANGUL] = len(faces)
    m[M.IDM_CHAR_SHAPE] = len(shapes)
    doc = [H.Rec(M.ID_MAPPINGS, 0, struct.pack('<18i', *m))] + [H.Rec(M.FACE_NAME, 0, face(f)) for f in faces]
    doc += [H.Rec(M.CHAR_SHAPE, 0, char_shape(f, r)) for f, r in shapes] + [H.Rec(TAB_DEF, 0, bytes(8))]
    return {'FileHeader': file_header(compressed, password), 'DocInfo': z(H.serialize(doc)), 'BodyText/Section0': z(H.serialize(body))}


def table_body():
    """본문 문단 둘(휴먼명조·맑은 고딕) + 표 칸 안 문단 하나(휴먼명조, 단계 2)."""
    body = paragraph(0, '가·나~다·', [(0, 0)])
    body += paragraph(0, '라·마', [(0, 1)])
    body += [H.Rec(H.CTRL_HEADER, 1, H.TBL_ID + bytes(4)), H.Rec(H.LIST_HEADER, 2, bytes(16))]
    body += paragraph(2, '칸·글', [(0, 0)])
    return body


def unpack(out, name, compressed=True):
    return H.parse(H.inflate(out[name]) if compressed else out[name])


def runs_of(recs, i):
    return [struct.unpack_from('<II', recs[i].data, o) for o in range(0, len(recs[i].data), 8)]


class 보정규칙(unittest.TestCase):
    def test_기본_규칙(self):
        r = M.parse_rules(M.DEFAULT_RULE)
        self.assertEqual(r, {'휴먼명조': {ord('·'): 152, ord('~'): 122, ord('₮'): 128}, '맑은 고딕': {ord('→'): 95, ord('₮'): 91}})
        self.assertEqual(M.rule_text(r), M.DEFAULT_RULE)

    def test_글꼴을_안_적으면_기본_글꼴이고_U표기와_빈칸을_받는다(self):
        self.assertEqual(M.parse_rules('·=152, ~=122'), {'휴먼명조': {ord('·'): 152, ord('~'): 122}})
        self.assertEqual(M.parse_rules('바탕:U+0020=110,U+003D=90;'), {'바탕': {32: 110, 61: 90}})
        self.assertEqual(M.rule_text({'바탕': {32: 110, ord(':'): 90}}), '바탕:U+0020=110,U+003A=90')
        self.assertEqual(M.parse_rules('휴먼명조::=120'), {'휴먼명조': {ord(':'): 120}})

    def test_잘못된_규칙은_멈춘다(self):
        for bad, why in [('·=1.52', '정수'), ('·=300', '50~200'), ('·=49', '50~200'), ('ab=120', '한 글자'),
                         ('휴먼명조:·=152;휴먼명조:·=150', '두 번'), (':·=150', '글꼴 이름'), ('·', '글자=퍼센트'), (' ; ', '비었다')]:
            with self.subTest(bad=bad), self.assertRaisesRegex(M.쪽배치오류, why):
                M.parse_rules(bad)


class 글자모양구간(unittest.TestCase):
    def test_글자_자리는_8글자_제어를_8칸으로_센다(self):
        codes, total = M.text_positions(wtext('가·\x0b~\r'))
        self.assertEqual(codes, [(0, ord('가')), (1, ord('·')), (2, 11), (10, ord('~')), (11, 13)])
        self.assertEqual(total, 12)

    def test_고친_글자만_새_모양이고_이웃은_원래_모양으로_돌아온다(self):
        codes, total = M.text_positions(wtext('가·\x0b~\r'))
        new, n = M.rewrite_runs(codes, total, [(0, 3)], lambda sid, c: {ord('·'): 10, ord('~'): 11}.get(c) if sid == 3 else None)
        self.assertEqual((new, n), ([(0, 3), (1, 10), (2, 3), (10, 11), (11, 3)], 2))

    def test_구간_경계와_다른_모양은_그대로다(self):
        codes, total = M.text_positions(wtext('가·나~\r'))
        new, n = M.rewrite_runs(codes, total, [(0, 3), (2, 4)], lambda sid, c: 9 if sid == 4 and c == ord('~') else None)
        self.assertEqual((new, n), ([(0, 3), (2, 4), (3, 9), (4, 4)], 1))

    def test_바뀐_것이_없으면_None(self):
        codes, total = M.text_positions(wtext('가나\r'))
        self.assertEqual(M.rewrite_runs(codes, total, [(0, 3)], lambda sid, c: None), (None, 0))

    def test_끝_자리_뒤에서_시작하는_구간은_남긴다(self):
        codes, total = M.text_positions(wtext('·\r'))
        new, _ = M.rewrite_runs(codes, total, [(0, 3), (2, 5)], lambda sid, c: 7 if c == ord('·') else None)
        self.assertEqual(new, [(0, 7), (1, 3), (2, 5)])


class 측정용사본(unittest.TestCase):
    def test_규칙_글꼴의_그_글자에만_복제_모양을_붙인다(self):
        out, st = M.calibrate(streams(table_body()), M.parse_rules('휴먼명조:·=152,~=122'))
        self.assertEqual(list(out), ['DocInfo', 'BodyText/Section0'])
        doc = unpack(out, 'DocInfo')
        shapes = [r for r in doc if r.tag == M.CHAR_SHAPE]
        self.assertEqual(len(shapes), 4)  # 원래 둘 + (휴먼명조 ·)(휴먼명조 ~) — 같은 짝은 한 번만 복제
        self.assertEqual([r.data[M.RATIO_AT:M.RATIO_AT + 7] for r in shapes[2:]], [bytes([152] * 7), bytes([122] * 7)])
        self.assertEqual(shapes[2].data[:M.RATIO_AT], shapes[0].data[:M.RATIO_AT])
        self.assertEqual(doc[-1].tag, TAB_DEF)  # 새 모양은 마지막 글자 모양 바로 뒤
        self.assertEqual(struct.unpack_from('<18i', doc[0].data)[M.IDM_CHAR_SHAPE], 4)
        body = unpack(out, 'BodyText/Section0')
        heads = [i for i, r in enumerate(body) if r.tag == H.PARA_HEADER]
        self.assertEqual(runs_of(body, heads[0] + 2), [(0, 0), (1, 2), (2, 0), (3, 3), (4, 0), (5, 2), (6, 0)])
        self.assertEqual(H.header_fields(body[heads[0]])['ncs'], 7)
        self.assertEqual(runs_of(body, heads[1] + 2), [(0, 1)])  # 맑은 고딕 ·은 규칙 밖
        self.assertEqual(runs_of(body, heads[2] + 2), [(0, 0), (1, 2), (2, 0)])  # 표 칸 안 문단도
        self.assertEqual(sum(r.tag == H.PARA_LINE_SEG for r in body), 3)  # 줄 배치는 그대로
        self.assertEqual((st['chars'], st['clones'], st['byChar']), (4, 2, {'휴먼명조 ·': 3, '휴먼명조 ~': 1}))

    def test_줄_배치_빼기는_표_칸_안까지_빼고_줄_정보_수를_0으로(self):
        out, st = M.calibrate(streams(table_body()), None, None, strip_line_seg=True)
        self.assertEqual(list(out), ['BodyText/Section0'])  # 글자 모양은 그대로라 DocInfo는 원본
        body = unpack(out, 'BodyText/Section0')
        self.assertFalse(any(r.tag == H.PARA_LINE_SEG for r in body))
        self.assertEqual({H.header_fields(r)['nls'] for r in body if r.tag == H.PARA_HEADER}, {0})
        self.assertEqual(st['lineSegsRemoved'], 3)

    def test_폭_흔들기는_그_글꼴_모양_전부에_곱하고_복제에도_실린다(self):
        out, st = M.calibrate(streams(table_body()), M.parse_rules('휴먼명조:·=152'), ('휴먼명조', 101))
        shapes = [r for r in unpack(out, 'DocInfo') if r.tag == M.CHAR_SHAPE]
        self.assertEqual([r.data[M.RATIO_AT] for r in shapes], [101, 100, 154])  # 101×1.52 = 153.52 → 154
        self.assertEqual(st['scaledShapes'], 1)
        out, _ = M.calibrate(streams(table_body(), shapes=((0, 150), (1, 100))), M.parse_rules('휴먼명조:·=152'))
        self.assertEqual([r for r in unpack(out, 'DocInfo') if r.tag == M.CHAR_SHAPE][2].data[M.RATIO_AT], 200)  # 200에서 자른다
        with self.assertRaisesRegex(M.쪽배치오류, '없는|쓰는 글자 모양이 없다'):
            M.calibrate(streams(table_body()), None, ('바탕', 101))

    def test_맞는_글자가_없으면_바꿀_스트림도_없다(self):
        out, st = M.calibrate(streams(table_body()), M.parse_rules('휴먼명조:₮=128'))
        self.assertEqual((out, st['chars']), ({}, 0))

    def test_눌리지_않은_문서는_눌리지_않은_채로(self):
        out, _ = M.calibrate(streams(table_body(), compressed=False), M.parse_rules('·=152'))
        self.assertEqual(len([r for r in H.parse(out['DocInfo']) if r.tag == M.CHAR_SHAPE]), 3)

    def test_암호_문서는_잴_수_없다(self):
        with self.assertRaisesRegex(M.쪽배치오류, '암호'):
            M.calibrate(streams(table_body(), password=True), M.parse_rules('·=152'))

    def test_HWP가_아닌_OLE_파일은_잴_수_없다(self):
        not_hwp = {k: v for k, v in streams(table_body()).items() if k != 'FileHeader'}  # .doc처럼 FileHeader가 없다
        with self.assertRaisesRegex(ValueError, 'HWP 5 파일이 아니다'):
            M.calibrate(not_hwp, M.parse_rules('·=152'))

    def test_문단_글과_쪽_나눔_줄_배치_없는_문단(self):
        body = paragraph(0, ' 1. 개요 ', [(0, 0)], divide=M.PAGE_BREAK) + paragraph(0, '본문', [(0, 0)], seg=False)
        st = streams(body)
        self.assertEqual(M.paragraphs(st), {0: [('1. 개요', True), ('본문', False)]})
        self.assertEqual(M.paragraphs_without_line_seg(st), (1, 2))


# ── 합성 쪽 배치 ─────────────────────────────────────────────────────────
def full(pi):
    return {'kind': 'fullParagraph', 'paraIndex': pi}


def part(pi, s, e):
    return {'kind': 'partialParagraph', 'paraIndex': pi, 'startLine': s, 'endLine': e}


def table(pi):
    return {'kind': 'table', 'paraIndex': pi}


def shape(pi):
    return {'kind': 'shape', 'paraIndex': pi}


def page(n, items, used, sec=0):
    return {'pageNumber': n, 'section': sec, 'bodyArea': {'y': 94.5, 'height': 952.0}, 'columns': [{'usedHeight': used, 'items': items}]}


def tree(*lines, cell=None):
    """render tree 한 쪽: 본문 줄 (pi, y, 글)… + 표 칸 줄(뺄 것)·머리말 줄(뺄 것)."""
    col = [{'type': 'TextLine', 'pi': pi, 'bbox': {'y': y}, 'children': [{'type': 'TextRun', 'text': t}]} for pi, y, t in lines]
    if cell:
        col.append({'type': 'Table', 'pi': 9, 'ci': 0, 'children': [{'type': 'Cell', 'row': 0, 'col': 0, 'children': [
            {'type': 'TextLine', 'pi': 0, 'bbox': {'y': 300.0}, 'children': [{'type': 'TextRun', 'text': cell}]}]}]})
    return {'type': 'Page', 'children': [
        {'type': 'Header', 'children': [{'type': 'TextLine', 'pi': 0, 'bbox': {'y': 60.0}, 'children': [{'type': 'TextRun', 'text': '머리말'}]}]},
        {'type': 'Body', 'children': [{'type': 'Column', 'children': col}]}]}


PARAS = {0: [('', False), ('1. 개요', True), ('본문 한 줄', False), ('◦ 소제목', False), ('', False), ('긴 문단', False),
             ('◦ 그림 제목', False), ('', False), ('첫 줄만 남는 문단', False), ('2. 다음', True), ('끝', False)]}
PAGES = {'pageCount': 6, 'pages': [
    page(1, [table(0)], 960.0),                                          # 표만 — 묶음 0
    page(2, [full(1), full(2), full(3), full(4)], 900.0),                # 끝에 제목만(빈 문단은 건너뜀)
    page(3, [part(5, 0, 6)], 952.0),
    page(4, [part(5, 6, 7), full(6), full(7), shape(7), part(8, 0, 1)], 950.0),  # 맨 위 외톨이 줄 · 끝에 첫 줄 하나
    page(5, [part(8, 1, 3)], 593.6),                                     # 두 줄 — 흠 아님
    page(6, [full(9), full(10)], 500.0)]}                                 # 쪽 나눔 — 묶음 2
TREES = [tree(), tree(), tree((5, 100.0, '줄1'), (5, 125.6, '줄2'), (5, 151.2, '줄3'), cell='칸'),
         tree((5, 94.5, '꼬리 한 줄.'), (6, 130.0, '◦ 그림 제목'), (8, 900.0, '첫 줄만 여기 ')), tree(), tree()]


class 묶음과_흠(unittest.TestCase):
    def setUp(self):
        self.res = M.analyze(PAGES, PARAS, TREES)

    def test_묶음마다_끝_쪽_여유(self):
        b = self.res['bundles']
        self.assertEqual([(x['firstPage'], x['lastPage']) for x in b], [(1, 1), (2, 5), (6, 6)])
        self.assertEqual([x['freePt'] for x in b], [-6.0, 268.8, 339.0])
        self.assertEqual([x['tableOnly'] for x in b], [True, False, False])
        self.assertEqual(self.res['linePitchPt'], 19.2)  # 25.6px
        self.assertEqual(b[1]['freeLines'], 14.0)
        self.assertEqual([x['startText'] for x in b], ['', '1. 개요', '2. 다음'])
        self.assertEqual(M.smallest_bundle(b)['index'], 1)  # 표만 있는 쪽(-6pt)은 뺀다

    def test_쪽_끝_흠(self):
        got = [(d['page'], d['kind'], d['severity'], d['paragraph'], d['line']) for d in self.res['defects']]
        self.assertEqual(got, [(2, 'heading', 'strong', 3, None), (4, 'widow', 'strong', 5, '꼬리 한 줄.'),
                               (4, 'orphan', 'weak', 8, '첫 줄만 여기')])
        self.assertEqual((self.res['strong'], self.res['weak']), (2, 1))

    def test_제목_뒤_그림_문단은_제목만_남은_것이_아니다(self):
        paras = {0: [('◦ 그림 제목', False), ('', False)]}
        with_picture = {'pages': [page(1, [full(0), full(1), shape(1)], 900.0)]}
        without = {'pages': [page(1, [full(0), full(1)], 900.0)]}
        self.assertEqual(M.analyze(with_picture, paras)['defects'], [])
        self.assertEqual([d['kind'] for d in M.analyze(without, paras)['defects']], ['heading'])

    def test_제목_꼴(self):
        head = __import__('re').compile(M.HEADING)
        for t in ['◦ 소제목', '□ 신청현황', '1. 문제인식', '3-3-2. 자금', '4-1. 기업']:
            self.assertTrue(head.match(t), t)
        for t in ['2026. 10. 기준', '- 항목', '1,000원', '(1) 괄호']:
            self.assertFalse(head.match(t), t)

    def test_쪽표(self):
        p = self.res['pages']
        self.assertEqual(p[3]['first'], {'paragraph': 5, 'kind': 'partialParagraph', 'span': '7번째 줄', 'text': '긴 문단'})
        self.assertEqual(p[2]['first']['span'], '1~6번째 줄')
        self.assertEqual(p[0]['first']['span'], '표')
        self.assertIsNone(p[0]['lastText'])
        self.assertEqual(p[1]['lastText']['text'], '◦ 소제목')

    def test_구역이_바뀌거나_쪽_나눔_문단의_처음이면_새_묶음(self):
        paras = {0: [('가', False), ('나', True)], 1: [('다', False)]}
        pages = [page(1, [part(0, 0, 3)], 900.0), page(2, [part(0, 3, 5), part(1, 0, 2)], 900.0),
                 page(3, [part(1, 2, 4)], 900.0), page(4, [full(0)], 900.0, sec=1)]
        breaks = {(0, 1)}
        self.assertEqual(M.make_bundles(pages, breaks), [(0, 2), (3, 3)])  # 2쪽은 쪽 나눔 문단 중간이 아니라 앞 문단 꼬리로 시작
        pages[1]['columns'][0]['items'] = [part(1, 0, 2)]
        self.assertEqual(M.make_bundles(pages, breaks), [(0, 0), (1, 2), (3, 3)])
        pages[2]['columns'][0]['items'] = [part(1, 2, 4)]
        self.assertEqual(M.make_bundles([pages[2]], breaks), [(0, 0)])

    def test_쪽_번호를_새로_시작해도_실제_쪽으로_세고_트리와_짝짓는다(self):
        paras = {0: [('가', False), ('나', False)], 1: [('다', False)]}
        pages = {'pages': [dict(page(1, [full(0)], 900.0), pageIndex=0), dict(page(1, [full(1)], 900.0), pageIndex=1),
                           dict(page(1, [part(0, 0, 1)], 900.0, sec=1), pageIndex=2)]}
        res = M.analyze(pages, paras, [tree(), tree(), tree((0, 900.0, '첫 줄'))])
        self.assertEqual([(r['page'], r['printed']) for r in res['pages']], [(1, 1), (2, 1), (3, 1)])
        self.assertEqual([(d['page'], d['kind'], d['line']) for d in res['defects']], [(3, 'orphan', '첫 줄')])
        self.assertEqual([(b['firstPage'], b['lastPage']) for b in res['bundles']], [(1, 2), (3, 3)])  # 구역이 바뀌면 새 묶음
        self.assertEqual(M.trees_in_page_order(pages, [(3, 'c'), (1, 'a'), (2, 'b')]), ['a', 'b', 'c'])

    def test_쪽을_넘는_표_조각(self):
        def piece(pi, s, e, cont):
            return {'kind': 'partialTable', 'paraIndex': pi, 'startRow': s, 'endRow': e, 'isContinuation': cont}
        paras = {0: [('', True), ('본문', False)]}
        pages = [page(1, [piece(0, 0, 2, False)], 900.0), page(2, [piece(0, 1, 2, True), full(1)], 500.0)]
        self.assertEqual(M.make_bundles(pages, {(0, 0)}), [(0, 1)])  # 이어진 조각으로 시작하는 쪽은 새 묶음이 아니다
        res = M.analyze({'pages': pages}, paras)
        self.assertEqual([r['first']['span'] for r in res['pages']], ['표 1~2행', '표 2행 이어짐'])
        self.assertEqual(res['defects'], [])

    def test_본문_줄만_읽고_줄_간격이_없으면_None(self):
        self.assertEqual(M.tree_lines(TREES[2]), [(5, 100.0, '줄1'), (5, 125.6, '줄2'), (5, 151.2, '줄3')])
        self.assertIsNone(M.line_pitch_pt([M.tree_lines(t) for t in TREES[:2]]))

    def test_표_캡션_줄은_재기에서_빼고_대조에서는_옛_셈대로_문단_0에(self):
        t = tree((0, 90.0, '표 문단'), (5, 100.0, '줄1'))
        col = t['children'][1]['children'][0]['children']
        col.insert(1, {'type': 'TextLine', 'pi': 0, 'bbox': {'y': 95.0}, 'children': [{'type': 'TextRun', 'text': '< 매출 >'}],
                       'captionOwner': {'secIdx': 0, 'paraIdx': 4, 'controlIdx': 0, 'captionOrdinal': 0}})
        self.assertEqual([t2 for _, _, t2 in M.tree_lines(t)], ['표 문단', '줄1'])  # 흠의 줄 글·줄 간격을 흐리지 않는다
        paras, _ = M.tree_paragraph_lines([(1, t)])
        self.assertEqual(paras[(0, ('P', 0))], ['표문단', '<매출>'])  # 옛 rt_lines.py와 같다 — 10-21 기록과 견주려고

    def test_사람용_글이_깨지지_않는다(self):
        res = dict(self.res, file='x.hwp', rhwp={'version': M.RHWP_VERSION, 'pinned': True}, json='result.json',
                   calibration={'rule': M.DEFAULT_RULE, 'chars': 3, 'byChar': {'휴먼명조 ·': 3}, 'shapes': 2, 'clones': 1, 'scale': None},
                   shake=[{'font': '휴먼명조', 'percent': 101, 'pageCount': 6, 'strong': 2, 'smallest': self.res['bundles'][1]}],
                   warnings=['render tree 5쪽 · dump-pages 6쪽이 달라 쪽 끝 흠의 줄 글이 빌 수 있다'])
        text = M.format_measure(res)
        self.assertIn('⚠ render tree 5쪽', text)
        self.assertIn('묶음  1  2~5쪽', text)
        self.assertIn('268.8pt (14.0줄)', text)
        self.assertIn('강한 흠 2곳 · 약한 흠 1곳', text)
        self.assertIn('4쪽 쪽 맨 위에 앞 문단 꼬리 한 줄만 — 문단 5', text)
        self.assertIn('101%  6쪽', text)


# ── 대조 ────────────────────────────────────────────────────────────────
def line(pi, y, text):
    return {'type': 'TextLine', 'pi': pi, 'bbox': {'y': y}, 'children': [{'type': 'TextRun', 'text': text}]}


def body(*nodes):
    return {'type': 'Page', 'children': [{'type': 'Footer', 'children': [line(0, 1000.0, '- 1 -')]},
                                         {'type': 'Body', 'children': [{'type': 'Column', 'children': list(nodes)}]}]}


def cell_table(text):
    return {'type': 'Table', 'pi': 1, 'ci': 0, 'children': [{'type': 'Cell', 'row': 0, 'col': 0, 'children': [line(0, 300.0, text)]}]}


class 줄나눔대조(unittest.TestCase):
    def test_쪽을_넘는_문단은_이어_붙이고_표_칸은_따로(self):
        truth, first = M.tree_paragraph_lines([(1, body(line(0, 100, 'ab cd'), line(0, 125, 'ef'), cell_table('가나'))), (2, body(line(0, 100, 'gh')))])
        self.assertEqual(dict(truth), {(0, ('P', 0)): ['abcd', 'ef', 'gh'], (0, ('T', 1, 0), ('C', 0, 0), ('P', 0)): ['가나']})
        self.assertEqual(first[(0, ('P', 0))], 1)

    def test_일치_셈과_갈린_방향(self):
        truth = {(0, ('P', 0)): ['abcd', 'ef', 'gh'], (0, ('T', 1, 0), ('C', 0, 0), ('P', 0)): ['가나'], (0, ('P', 2)): ['']}
        test = {(0, ('P', 0)): ['abcde', 'f', 'gh'], (0, ('T', 1, 0), ('C', 0, 0), ('P', 0)): ['가나']}
        st, bad = M.line_break_stats(truth, test)
        self.assertEqual(st, {'paragraphs': 2, 'same': 1, 'sameCount': 2, 'multiLine': 1, 'multiSame': 0, 'multiSameCount': 1,
                              'lines': 4, 'linesSame': 2})
        self.assertEqual(M.break_direction(*bad[0][1:]), (1, 'abcd', 'abcde', 'narrow'))
        self.assertEqual(M.break_direction(['ab', 'cd'], ['a', 'bcd'])[3], 'wide')
        self.assertEqual(M.key_label((0, ('T', 1, 0), ('C', 2, 0), ('P', 0))), '문단 1 표 칸(2,0) 문단 0')
        self.assertEqual(M.key_label((1, ('P', 7)), many_sections=True), '구역 1 문단 7')


def pdf_page(*rows):
    chars = [(c, 10.0 * k, y) for y, t in rows for k, c in enumerate(t)]
    return {'chars': chars, 'rows': M.text_rows(chars)}


class 쪽끝대조(unittest.TestCase):
    def test_기준선으로_줄을_묶고_쪽_번호_줄은_뺀다(self):
        chars = [('나', 20.0, 100.4), ('가', 10.0, 100.0), ('다', 10.0, 120.0), ('-', 0.0, 780.0), ('3', 5.0, 780.0), ('-', 9.0, 780.0)]
        self.assertEqual(M.text_rows(chars), [(100.0, '가나'), (120.0, '다')])

    def test_끝_줄_글로_맞춰_대고_밀림을_찾는다(self):
        a = [[(700.0, 'A')], [(700.0, 'B')], [(700.0, 'C')], [(700.0, 'D')]]
        b = [[(500.0, 'x')], [(690.0, 'A')], [(700.0, 'B')], [(700.0, 'C')]]
        self.assertEqual(M.align_pages(a, b), [(0, 1), (1, 2), (2, 3), (3, None)])

    def test_끝_줄이_같은_쪽이_여럿이면_첫_줄도_같은_쪽(self):
        a = [[(100.0, '첫'), (700.0, '합계')]]
        b = [[(100.0, '다른'), (700.0, '합계')], [(100.0, '첫'), (700.0, '합계')]]
        self.assertEqual(M.align_pages(a, b), [(0, 1)])

    def test_쪽마다_높이_차와_밀림(self):
        hancom = [pdf_page((100.0, '첫'), (700.0, '끝일')), pdf_page((100.0, '둘'), (650.0, '끝이'))]
        rhwp = [pdf_page((100.0, '표')), pdf_page((100.0, '첫'), (700.05, '끝일')), pdf_page((100.0, '둘'), (641.0, '끝이'))]
        c = M.compare_pages(hancom, rhwp)
        self.assertEqual([(r['truthPage'], r['testPage'], r['dy']) for r in c['pages']], [(1, 2, 0.05), (2, 3, -9.0)])
        self.assertEqual((c['matched'], c['sameHeight'], c['maxAbsDy'], c['shifts']), (2, 1, 9.0, [{'truthPage': 1, 'shift': 1}]))
        self.assertTrue(c['pages'][0]['firstSame'])


class 글자폭대조(unittest.TestCase):
    def test_공백_없이_이웃한_짝만_줄_글자_크기로_나눠_잰다(self):
        lines = [[('가', 0.0, 0.0, 12), ('·', 12.0, 0.0, 12), ('나', 16.56, 0.0, 12), (' ', 28.56, 0.0, 12), ('→', 34.0, 0.0, 12)],
                 [('~', 0.0, 50.0, 13.3), ('다', 7.32, 50.0, 12), ('라', 19.32, 50.0, 12)]]
        t = M.advance_table(lines)
        self.assertEqual(t[('한글', 12)], (1.0, 2))
        self.assertEqual(t[('·', 12)], (0.38, 1))
        self.assertEqual(t[('~', 12)], (0.61, 1))  # 장평을 바꾼 글자는 다른 크기로 찍혀도 줄 크기(12)로 나눈다
        self.assertNotIn(('→', 12), t)  # 공백 앞뒤는 재지 않는다
        only = M.advance_table(lines, allowed={('·', '나')})
        self.assertEqual(list(only), [('·', 12)])

    def test_한컴과_다른_폭만_표시(self):
        rows = M.width_rows({('·', 12): (0.38, 117), ('가', 12): (1.0, 900), ('x', 12): (0.5, 1)},
                            {('·', 12): (0.25, 115), ('가', 12): (1.0, 880)}, {('·', 12): (0.38, 115)})
        self.assertEqual([(r['char'], r['differs']) for r in rows], [('가', False), ('·', True)])  # 한 번만 나온 x는 뺀다
        self.assertIsNone(rows[0]['cal'])
        self.assertEqual([(r['count'], r['rawCount'], r['calCount']) for r in rows], [(900, 880, 0), (117, 115, 115)])


class 실행준비(unittest.TestCase):
    def test_rhwp를_못_찾거나_판이_다르면_멈춘다(self):
        with tempfile.TemporaryDirectory() as d:
            with mock.patch.dict(os.environ, {'RHWP_EXE': os.path.join(d, 'none.exe')}), self.assertRaisesRegex(M.쪽배치오류, '못 찾았다'):
                M.find_rhwp()
            fake = Path(d) / 'rhwp.exe'
            fake.write_bytes(b'not rhwp')
            with mock.patch.dict(os.environ, {'RHWP_EXE': str(fake)}), self.assertRaisesRegex(M.쪽배치오류, '판이 고정한 v0.8.7이 아니다'):
                M.find_rhwp()

    def test_저장소의_hwplib_jar는_고정한_해시다(self):
        M.check_jar()
        with tempfile.TemporaryDirectory() as d:
            other = Path(d) / 'hwplib.jar'
            other.write_bytes(b'x')
            with mock.patch.object(M, 'HWPLIB_JAR', other), self.assertRaisesRegex(M.쪽배치오류, '바뀌었다'):
                M.check_jar()

    def test_작업_폴더는_없거나_빈_폴더만(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(M.make_work(os.path.join(d, 'new')), (Path(d) / 'new').resolve())
            (Path(d) / 'new' / 'x.txt').write_text('남의 것', encoding='utf-8')
            with self.assertRaisesRegex(M.쪽배치오류, '빈 폴더'):
                M.make_work(os.path.join(d, 'new'))
        tmp = M.make_work()
        try:
            self.assertTrue(tmp.is_dir() and tmp.name.startswith('hwp-pages-'))
        finally:
            tmp.rmdir()

    def test_olefile이_없으면_안내하고_멈춘다(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / 'x.hwp'
            f.write_bytes(b'x')
            with mock.patch.object(M.H, 'read_streams', side_effect=ImportError('olefile')), \
                    self.assertRaisesRegex(M.쪽배치오류, 'olefile'):
                M.start(str(f), os.path.join(d, 'w'))

    def test_흔들_글꼴이_없거나_파일이_깨졌거나_제목_꼴이_틀리면_재기_전에_종료_1(self):
        self.assertEqual(M.font_char_counts(streams(table_body())), {'휴먼명조': 9, '맑은 고딕': 3})  # 제어 글자(문단 끝) 뺌
        defined_only = streams(table_body(), shapes=((0, 100), (1, 100), (2, 100)), faces=('휴먼명조', '맑은 고딕', '바탕'))
        self.assertNotIn('바탕', M.font_char_counts(defined_only))  # 글자 모양에만 있고 쓰인 글자가 없다
        broken = dict(streams(table_body()), **{'BodyText/Section0': b'not deflate'})
        fake = {'exe': 'rhwp.exe', 'version': M.RHWP_VERSION, 'sha256': M.RHWP_SHA256, 'pinned': True}
        for args, source, why in [(['--흔들기', '바탕'], defined_only, '흔들 글꼴 「바탕」로 쓰인 글자가 없다 — .*휴먼명조 9자'),
                                  ([], broken, 'invalid|incorrect|Error'), (['--제목', '('], streams(table_body()), 'missing|unterminated')]:
            with self.subTest(args=args), tempfile.TemporaryDirectory() as d, \
                    mock.patch.object(M, 'find_rhwp', return_value=fake), mock.patch.object(M, 'check_jar'), \
                    mock.patch.object(M, 'read_source', return_value=(Path('x.hwp'), source)), \
                    mock.patch.object(M, 'prepare_work', return_value=Path(d)) as work, \
                    mock.patch('sys.stderr', new_callable=__import__('io').StringIO) as err:
                self.assertEqual(M.main(['재기', 'x.hwp', *args]), 1)
                self.assertRegex(err.getvalue(), why)
                if args:  # 흔들 글꼴·제목 꼴은 작업 폴더를 만들기 전에 멈춘다
                    work.assert_not_called()

    def test_사용법_오류는_종료_2_잴_수_없으면_1(self):
        with self.assertRaises(SystemExit) as e, mock.patch('sys.stderr'):
            M.main(['재기'])
        self.assertEqual(e.exception.code, 2)
        with mock.patch.dict(os.environ, {'RHWP_EXE': os.path.join(tempfile.gettempdir(), 'no-such-rhwp.exe')}), mock.patch('sys.stderr'):
            self.assertEqual(M.main(['재기', 'x.hwp']), 1)


if __name__ == '__main__':
    unittest.main()
