"""HWP 쪽 배치 재기 — 한컴 없이 rhwp v0.8.7로 쪽 수·묶음 끝 여유·쪽 끝 흠을 잰다(2026-10-21 결정, 현장 노트 한글_HWP).

  python -I -X utf8 tools/hwp쪽배치.py 재기 <파일.hwp> [--규칙 R | --보정없이] [--흔들기 [글꼴]] [--pdf] [--작업 폴더] [--json 파일|-]
  python -I -X utf8 tools/hwp쪽배치.py 대조 <한컴이 저장한 파일.hwp> <그 파일의 한컴 PDF> [--규칙 R] [--보기 N] [--작업 폴더] [--json 파일|-]

재기 — 측정용 사본을 rhwp로 짜서 읽는다.
  1. 사본: 규칙의 글자에만 장평을 곱한 글자 모양을 붙인다(기본 휴먼명조 ·~₮, 맑은 고딕 →₮ — rhwp가 한컴과 다르게 재는 폭).
     글자는 그대로라 줄 나눔 규칙(금칙·낱말 묶음)은 그대로고 폭만 한컴에 맞는다. 저장된 줄 배치(LINE_SEG)는 건드리지 않는다 —
     rhwp는 있는 줄 배치를 그대로 쓰고 없는 문단만 다시 짠다. 다시 묶기는 tools/lib/hwp/RepackMulti.java(hwplib의 POIFS)가
     바꾼 스트림 말고는 원본 바이트를 그대로 옮긴다. 사본은 재기만 위한 것이라 내지 않는다.
  2. rhwp dump-pages --compat 2024 --json(쪽 배치)·export-render-tree(줄 글). --pdf면 export-pdf도(20초쯤).
  3. 쪽 수, 강제 쪽 나눔 묶음마다 끝 쪽 남은 높이(pt·줄, 마지막 줄 뒤 간격까지 센다), 쪽 끝 흠 — 강한 흠: 쪽 끝에 ◦·□·번호
     제목만 남음, 쪽 맨 위에 앞 문단 꼬리 한 줄만 넘어감 · 약한 흠: 쪽 끝에 문단 첫 줄 하나. 이 양식 문단 모양은 외톨이줄 보호·
     다음 문단과 함께가 모두 꺼져 있어 이런 자리를 한컴도 그대로 둔다.
  --흔들기: 그 글꼴(기본 휴먼명조) 글자 모양 전부의 폭을 98·99·101·102%로 바꿔 다시 재고 쪽 수·강한 흠·가장 작은 여유를 견준다.
대조 — 보정이 맞는지 다시 잰다. 한컴이 저장해 모든 문단에 줄 배치가 있는 파일과 그 파일을 한컴이 찍은 PDF를 준다.
  저장 배치 그대로(= 한컴 줄 나눔) · 줄 배치를 모두 뺀 사본(보정 전) · 같은 사본에 보정(보정 뒤)을 rhwp로 짜서 문단별 줄 나눔 일치,
  쪽마다 끝 줄 글·높이(한컴 PDF 대 rhwp PDF, 쪽이 밀리면 끝 줄 글로 맞춰 댄다), 글자별 전진폭(한컴 대 rhwp)을 낸다. PDF 세 벌이라 40초쯤.

rhwp: 환경 변수 RHWP_EXE, 없으면 %USERPROFILE%\\tools\\rhwp-0.8.7\\rhwp\\rhwp.exe. v0.8.7 고정 — 릴리스 zip SHA256 f7ac326e…73ec6f,
  그 안 rhwp.exe 1e1b7ae6…41bb62. 판이 다르면 재기는 멈춘다(빌드마다 조판이 움직인다, rhwp #5941). 새 판은 대조로 먼저 다시 재고
  고정값을 고친 뒤 쓰며, 그래도 재려면 --다른판. RHWP_FONT_PATH는 C:\\Windows\\Fonts로 넣는다(이 PC에는 휴먼명조가 없어 rhwp 내장 폭을 쓴다).
그 밖: Java 17 이상(JAVA_HOME 또는 PATH), hwplib 1.1.9(tools/lib/hwp/, Apache-2.0), 파이썬 olefile, 대조는 PyMuPDF.
작업 폴더는 새로 만든다(기본 %TEMP%\\hwp-pages-*, --작업은 없거나 빈 폴더만). 원본은 읽기만 하고 rhwp·Java에는 영문 이름 사본을 준다.
결과: 사람용 글은 표준 출력, 기계용 JSON은 <작업 폴더>/result.json(--json 파일로 따로 쓰고, `--json -`면 JSON만 표준 출력에·글은 표준 오류로).
종료 코드: 0 잰 것(흠이 있어도), 1 잴 수 없음, 2 사용법. 시험: python -I -X utf8 tests/hwp쪽배치_test.py
"""
import argparse
import collections
import concurrent.futures
import hashlib
import json
import os
import re
import shutil
import statistics
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

LIB = Path(__file__).resolve().parent / 'lib' / 'hwp'
sys.path.insert(0, str(LIB))  # -I로 돌면 이 폴더가 sys.path에 없다
import hwprec as H  # noqa: E402

# 10-21에 10-14 한컴 PDF와 rhwp를 대 보고 잡은 폭(현장 노트 한글_HWP). 맑은 고딕 →는 63%로 잡았다가 10-22 95%로 고쳤다 —
# rhwp PDF가 공백을 찍지 않아 「→ 」 폭(1.52em)을 → 폭으로 잘못 읽었다. render tree로 rhwp → 1.0em, 한컴 0.95em.
DEFAULT_RULE = '휴먼명조:·=152,~=122,₮=128;맑은 고딕:→=95,₮=91'
DEFAULT_FONT = '휴먼명조'
RHWP_VERSION = 'rhwp v0.8.7'
RHWP_SHA256 = '1e1b7ae6c9ffd895e1a330a191666a2629cc7eba2fc9e37442e9f1755741bb62'
RHWP_HOME = ('tools', 'rhwp-0.8.7', 'rhwp', 'rhwp.exe')  # %USERPROFILE% 아래
RHWP_FONT_PATH = r'C:\Windows\Fonts'
COMPAT = '2024'  # 10-14 한컴 PDF·뷰어가 한글 2024 — rhwp 10k 대조에서 2020↔2024만 조판이 갈린다
HWPLIB_JAR = LIB / 'hwplib-1.1.9.jar'
HWPLIB_SHA256 = 'aa14757394c6db60b2c5e0ebf4d43fcc28069161afaa9f03a0386524169bd1ac'  # Maven Central SHA-1 a185d550…496a
REPACK = LIB / 'RepackMulti.java'
HEADING = r'^(◦|□|\d{1,2}(-\d{1,2}){0,2}\.)'
SHAKE = (98, 99, 101, 102)
PX_PT = 0.75  # rhwp 좌표는 96dpi px
SAME_DY = 0.1  # 대조에서 끝 줄 높이가 같다고 보는 차(pt)
WIDE_EM = 0.03  # 대조에서 폭이 다르다고 보는 차(em)

ID_MAPPINGS, FACE_NAME, CHAR_SHAPE = 0x11, 0x13, 0x15
IDM_FACE_HANGUL, IDM_CHAR_SHAPE = 1, 9
RATIO_AT = 14  # 글자 모양: 언어별 글꼴 ID 7개(WORD) 다음 장평 7개(BYTE, 50~200%)
PAGE_BREAK = 0x04  # 문단 머리 「나눔」의 쪽 나누기
SECTION = 'BodyText/Section'
FOOT = re.compile(r'^-\d+-$')  # PDF 쪽 번호 줄


class 쪽배치오류(Exception):
    pass


# ── 보정 규칙 ────────────────────────────────────────────────────────────
def parse_rules(text, default_font=DEFAULT_FONT):
    """「휴먼명조:·=152,~=122;맑은 고딕:→=95」 → {글꼴: {글자 코드: 장평 %}}. 글꼴을 안 적은 묶음은 default_font.
    글자는 한 글자이거나 U+XXXX(쉼표·쌍반점·등호·공백 같은 글자)다."""
    rules = {}
    for part in text.split(';'):
        if not part.strip():
            continue
        head, sep, body = part.partition(':')
        if sep and '=' not in head:
            font = head.strip()
        else:
            font, body = default_font, part
        if not font:
            raise 쪽배치오류(f'규칙의 글꼴 이름이 비었다: {part!r}')
        table = rules.setdefault(font, {})
        for item in body.split(','):
            if not item.strip():
                continue
            ch, sep, num = item.rpartition('=')
            ch, num = ch.strip(), num.strip()
            if not sep:
                raise 쪽배치오류(f'규칙은 「글자=퍼센트」꼴이다: {item.strip()!r}')
            if re.fullmatch(r'[Uu]\+[0-9A-Fa-f]{4,6}', ch):
                code = int(ch[2:], 16)
            elif len(ch) == 1:
                code = ord(ch)
            else:
                raise 쪽배치오류(f'규칙의 글자는 한 글자나 U+XXXX다: {ch!r}')
            if not re.fullmatch(r'\d+', num) or not 50 <= int(num) <= 200:
                raise 쪽배치오류(f'장평은 50~200 사이 정수 퍼센트다: {item.strip()!r}')
            if code in table:
                raise 쪽배치오류(f'같은 글자를 두 번 적었다: {font} {chr(code)}')
            table[code] = int(num)
    if not any(rules.values()):
        raise 쪽배치오류('규칙이 비었다 — 보정하지 않으려면 --보정없이')
    return {f: t for f, t in rules.items() if t}


def rule_text(rules):
    """규칙을 다시 글로. 쉼표·쌍반점·등호·쌍점·공백 글자는 U+XXXX로 적는다."""
    def one(c):
        s = chr(c)
        return f'U+{c:04X}' if s in ',;=:' or s.isspace() else s
    return ';'.join(f'{font}:' + ','.join(f'{one(c)}={p}' for c, p in table.items()) for font, table in rules.items())


# ── 측정용 사본 ──────────────────────────────────────────────────────────
def face_name(rec):
    n = struct.unpack_from('<H', rec.data, 1)[0]
    return rec.data[3:3 + 2 * n].decode('utf-16-le')


def scale_ratio(data, pct):
    """글자 모양 레코드의 언어별 장평 7개에 pct %를 곱한다(50~200으로 자른다)."""
    d = bytearray(data)
    for k in range(7):
        d[RATIO_AT + k] = max(50, min(200, round(d[RATIO_AT + k] * pct / 100)))
    return bytes(d)


def text_positions(data):
    """PARA_TEXT 바이트 → ([(자리, 코드)], 전체 길이). 자리는 WCHAR 단위이고 8글자짜리 제어는 한 자리에서 8칸을 쓴다."""
    out, pos, q = [], 0, 0
    while q < len(data):
        c = struct.unpack_from('<H', data, q)[0]
        w = 8 if c in H.WIDE_CTRL else 1
        out.append((pos, c))
        pos += w
        q += 2 * w
    return out, pos


def rewrite_runs(codes, total, runs, pick):
    """글자 모양 구간 [(시작 자리, 모양)]을 글자마다 펼쳐 pick(모양, 코드)이 준 새 모양으로 바꾸고 다시 접는다.
    pick이 None이면 그 글자는 그대로다. → (새 구간, 바꾼 글자 수), 바꾼 것이 없으면 (None, 0).
    끝 자리 뒤에서 시작하는 구간(글자가 없는 구간)은 그대로 남긴다."""
    ids = [None] * total
    for k, (p0, sid) in enumerate(runs):
        p1 = runs[k + 1][0] if k + 1 < len(runs) else total
        for p in range(p0, min(p1, total)):
            ids[p] = sid
    changed = 0
    for p, c in codes:
        if ids[p] is None:
            continue
        new = pick(ids[p], c)
        if new is not None:
            ids[p] = new
            changed += 1
    if not changed:
        return None, 0
    out = []
    for p, sid in enumerate(ids):
        if sid is not None and (not out or out[-1][1] != sid):
            out.append((p, sid))
    for p0, sid in runs:
        if p0 >= total and (not out or out[-1][1] != sid):
            out.append((p0, sid))
    return out, changed


def _codec(streams):
    flags = H.file_flags(streams)
    if flags['password'] or flags['distribution']:
        raise 쪽배치오류('암호를 건 문서·배포용 문서는 잴 수 없다')
    if flags['compressed']:
        return H.inflate, H.deflate
    return (lambda b: b), (lambda b: b)


def section_names(streams):
    names = [n for n in streams if re.fullmatch(re.escape(SECTION) + r'\d+', n)]
    if not names:
        raise 쪽배치오류('본문 스트림(BodyText/Section*)이 없다')
    return sorted(names, key=lambda n: int(n[len(SECTION):]))


def calibrate(streams, rules=None, scale=None, strip_line_seg=False):
    """측정용 사본에서 바꿀 스트림 {경로: 원본처럼 눌린 바이트}과 셈. 바꿀 것이 없으면 빈 사전이다.
    rules {글꼴: {코드: %}} — 그 글꼴(글자 모양의 한글 글꼴) 글자에만 장평을 곱한 글자 모양을 새로 붙인다.
    scale (글꼴, %) — 그 글꼴 글자 모양 전부의 장평을 곱한다(흔들기). strip_line_seg — 모든 문단의 줄 배치를 뺀다(대조)."""
    rules = rules or {}
    unz, zz = _codec(streams)
    doc = H.parse(unz(streams['DocInfo']))
    idm_i = next((i for i, r in enumerate(doc) if r.tag == ID_MAPPINGS), None)
    cs_idx = [i for i, r in enumerate(doc) if r.tag == CHAR_SHAPE]
    if idm_i is None or not cs_idx or idm_i > cs_idx[0]:
        raise 쪽배치오류('DocInfo에서 ID_MAPPINGS·글자 모양을 못 찾았다')
    idm = list(struct.unpack_from(f'<{len(doc[idm_i].data) // 4}i', doc[idm_i].data, 0))
    if len(cs_idx) != idm[IDM_CHAR_SHAPE]:
        raise 쪽배치오류('글자 모양 수가 ID_MAPPINGS와 다르다')
    faces = [face_name(r) for r in doc if r.tag == FACE_NAME][:idm[IDM_FACE_HANGUL]]
    cs_data = [doc[i].data for i in cs_idx]
    shape_font = []
    for d in cs_data:
        f = struct.unpack_from('<H', d, 0)[0]
        shape_font.append(faces[f] if f < len(faces) else '')
    scaled = 0
    if scale:
        for n, d in enumerate(cs_data):
            if shape_font[n] == scale[0]:
                cs_data[n] = scale_ratio(d, scale[1])
                scaled += 1
        if not scaled:
            raise 쪽배치오류(f'글꼴 「{scale[0]}」을 쓰는 글자 모양이 없다')
    shape_rules = [rules.get(f, {}) for f in shape_font]
    clones, new_cs, by_char = {}, [], collections.Counter()

    def pick(sid, code):
        if sid >= len(shape_rules) or code not in shape_rules[sid]:
            return None
        if (sid, code) not in clones:
            clones[(sid, code)] = len(cs_data) + len(new_cs)
            new_cs.append(scale_ratio(cs_data[sid], shape_rules[sid][code]))
        by_char[f'{shape_font[sid]} {chr(code)}'] += 1
        return clones[(sid, code)]

    kids_tags = (H.PARA_TEXT, H.PARA_CHAR_SHAPE, H.PARA_LINE_SEG, H.PARA_RANGE_TAG)
    out_streams, n_chars, n_seg = {}, 0, 0
    for name in section_names(streams):
        recs = H.parse(unz(streams[name]))
        out, i, touched = [], 0, False
        while i < len(recs):
            r = recs[i]
            if r.tag != H.PARA_HEADER:
                if strip_line_seg and r.tag == H.PARA_LINE_SEG:
                    n_seg += 1
                    touched = True
                else:
                    out.append(r)
                i += 1
                continue
            # 문단 머리에 바로 딸린 글·글자 모양·줄 배치·범위 태그(같은 단계+1, 컨트롤 머리 전까지)
            j, kids = i + 1, {}
            while j < len(recs) and recs[j].level == r.level + 1 and recs[j].tag in kids_tags:
                kids.setdefault(recs[j].tag, j)
                j += 1
            hd = bytearray(r.data)
            if strip_line_seg:
                struct.pack_into('<H', hd, 16, 0)
            new_runs = None
            if H.PARA_TEXT in kids and H.PARA_CHAR_SHAPE in kids:
                codes, total = text_positions(recs[kids[H.PARA_TEXT]].data)
                d = recs[kids[H.PARA_CHAR_SHAPE]].data
                runs = [struct.unpack_from('<II', d, o) for o in range(0, len(d) - 7, 8)]
                new_runs, changed = rewrite_runs(codes, total, runs, pick)
                n_chars += changed
                if new_runs is not None:
                    struct.pack_into('<H', hd, 12, len(new_runs))
                    touched = True
            out.append(r.copy(bytes(hd)))
            for k in range(i + 1, j):
                x = recs[k]
                if strip_line_seg and x.tag == H.PARA_LINE_SEG:
                    n_seg += 1
                    touched = True
                    continue
                if new_runs is not None and k == kids[H.PARA_CHAR_SHAPE]:
                    x = x.copy(b''.join(struct.pack('<II', p, s) for p, s in new_runs))
                out.append(x)
            i = j
        if touched:
            out_streams[name] = zz(H.serialize(out))
    if new_cs or scaled:
        last = cs_idx[-1]
        m = list(idm)
        m[IDM_CHAR_SHAPE] += len(new_cs)
        for n, i in enumerate(cs_idx):
            doc[i] = doc[i].copy(cs_data[n])
        doc = (doc[:idm_i] + [doc[idm_i].copy(struct.pack(f'<{len(m)}i', *m))] + doc[idm_i + 1:last + 1]
               + [H.Rec(CHAR_SHAPE, doc[last].level, d) for d in new_cs] + doc[last + 1:])
        out_streams = {'DocInfo': zz(H.serialize(doc)), **out_streams}
    stats = {'rule': rule_text(rules) if rules else None, 'chars': n_chars, 'byChar': dict(by_char),
             'shapes': len(cs_data), 'clones': len(new_cs), 'scale': list(scale) if scale else None,
             'scaledShapes': scaled, 'lineSegsRemoved': n_seg}
    return out_streams, stats


# ── 문서 글(쪽 배치와 짝짓기) ────────────────────────────────────────────
def paragraphs(streams):
    """구역마다 최상위 문단의 (글, 강제 쪽 나눔인가): {구역 번호: [...]}. 글은 제어 글자를 뺀 것."""
    unz, _ = _codec(streams)
    out = {}
    for name in section_names(streams):
        recs = H.parse(unz(streams[name]))
        out[int(name[len(SECTION):])] = [(H.para_text(recs, h).strip(), bool(H.header_fields(recs[h])['divide'] & PAGE_BREAK))
                                         for h in H.top_paragraphs(recs)]
    return out


def paragraphs_without_line_seg(streams):
    """(줄 배치가 없는 문단 수, 모든 문단 수) — 표 칸 안 문단까지 센다."""
    unz, _ = _codec(streams)
    missing = total = 0
    for name in section_names(streams):
        for r in H.parse(unz(streams[name])):
            if r.tag == H.PARA_HEADER:
                total += 1
                missing += H.header_fields(r)['nls'] == 0
    return missing, total


# ── rhwp 쪽 배치 읽기 ────────────────────────────────────────────────────
def run_text(node):
    return ''.join(c.get('text', '') for c in node.get('children') or [] if c.get('type') == 'TextRun')


def tree_lines(tree):
    """render tree 한 쪽의 본문 줄(단에 바로 놓인 줄 — 표·머리말·꼬리말 줄은 뺀다): [(문단, y px, 글)]."""
    out = []
    for body in tree.get('children') or []:
        if body.get('type') != 'Body':
            continue
        for col in body.get('children') or []:
            if col.get('type') != 'Column':
                continue
            for ln in col.get('children') or []:
                if ln.get('type') == 'TextLine':
                    out.append((ln.get('pi'), (ln.get('bbox') or {}).get('y', 0.0), run_text(ln)))
    return out


def line_pitch_pt(page_lines):
    """한 문단 안 이웃 줄 사이 거리의 최빈값(pt) — 「줄」로 셀 때의 한 줄. 여러 줄 문단이 없으면 None."""
    gaps = collections.Counter()
    for lines in page_lines:
        for (pa, ya, _), (pb, yb, _) in zip(lines, lines[1:]):
            if pa is not None and pa == pb and yb > ya:
                gaps[round(yb - ya, 1)] += 1
    return round(gaps.most_common(1)[0][0] * PX_PT, 2) if gaps else None


def page_no(pg, idx):
    """문서 처음부터 센 실제 쪽(pageIndex+1) — render tree 파일 번호와 같다. pageNumber는 찍히는 쪽 번호라
    쪽 번호를 새로 시작하는 문서에서는 1부터 다시 센다(10-22 Fable 검수, 구역 셋인 활동보고서 양식)."""
    i = pg.get('pageIndex')
    return i + 1 if isinstance(i, int) else idx + 1


def page_items(pg):
    return [it for col in pg.get('columns') or [] for it in col.get('items') or []]


def free_pt(pg):
    """쪽 본문 높이에서 마지막 단이 쓴 높이를 뺀 것(pt). 마지막 줄 뒤 줄 간격까지 쓴 것으로 센다."""
    cols = [c for c in pg.get('columns') or [] if c.get('items')] or (pg.get('columns') or [])
    if not cols or 'bodyArea' not in pg:
        return None
    return (pg['bodyArea']['height'] - cols[-1].get('usedHeight', 0.0)) * PX_PT


def _r1(x):
    return None if x is None else round(x, 1)


def _clip(text, n=38):
    return text.replace('\r', ' ').replace('\n', ' ')[:n]


def make_bundles(pages, breaks):
    """강제 쪽 나눔 문단(또는 새 구역)으로 시작하는 쪽마다 묶음을 연다: [(첫 쪽 자리, 끝 쪽 자리)].
    쪽 첫 항목이 쪽 나눔 문단의 처음(전체·첫 줄부터·표의 첫 조각)이면 그 쪽에서 새 묶음이 시작한다."""
    starts, prev = [], None
    for i, pg in enumerate(pages):
        sec = pg.get('section', 0)
        items = page_items(pg)
        first = items[0] if items else {}
        at_start = not (first.get('kind') == 'partialParagraph' and first.get('startLine', 0) > 0
                        or first.get('kind') == 'partialTable' and first.get('isContinuation'))
        starts.append(i == 0 or sec != prev or ((sec, first.get('paraIndex')) in breaks and at_start))
        prev = sec
    heads = [i for i, s in enumerate(starts) if s]
    return [(a, (heads[k + 1] - 1) if k + 1 < len(heads) else len(pages) - 1) for k, a in enumerate(heads)]


def analyze(pages_json, paras, trees=None, heading=HEADING):
    """dump-pages JSON·문서 글·쪽별 render tree로 쪽표·묶음·흠을 낸다."""
    pages = pages_json.get('pages') or []
    head = re.compile(heading)
    lines_by_page = [tree_lines(t) for t in trees] if trees else []
    line_pt = line_pitch_pt(lines_by_page)
    breaks = {(s, i) for s, ps in paras.items() for i, (_, brk) in enumerate(ps) if brk}
    rows, defects = [], []
    for idx, pg in enumerate(pages):
        sec = pg.get('section', 0)
        ps = paras.get(sec, [])

        def text(pi):
            return ps[pi][0] if isinstance(pi, int) and 0 <= pi < len(ps) else ''

        def where(it):
            kind, pi = it.get('kind'), it.get('paraIndex')
            if kind == 'partialParagraph':
                s, e = it.get('startLine', 0), it.get('endLine')
                span = f'{s + 1}~{e}번째 줄' if isinstance(e, int) and e - s > 1 else f'{e}번째 줄'
            elif kind == 'partialTable':  # 쪽을 넘는 표의 한 조각(행은 0부터, endRow는 그 행 앞까지)
                s, e = it.get('startRow', 0), it.get('endRow')
                rows = f'{s + 1}~{e}행' if isinstance(e, int) and e - s > 1 else f'{s + 1}행'
                span = f"표 {rows}{' 이어짐' if it.get('isContinuation') else ''}"
            else:
                span = '표' if kind == 'table' else '전체'
            return {'paragraph': pi, 'kind': kind, 'span': span, 'text': _clip(text(pi))}

        items = [it for it in page_items(pg) if it.get('kind') != 'shape']
        shapes = {it.get('paraIndex') for it in page_items(pg) if it.get('kind') == 'shape'}
        # 빈 문단(간격용)은 빼고, 그림만 든 문단은 남긴다(제목 뒤 그림은 제목만 남은 것이 아니다).
        real = [it for it in items if it.get('kind') != 'fullParagraph' or text(it.get('paraIndex')) or it.get('paraIndex') in shapes]
        with_text = [it for it in real if it.get('kind') in ('fullParagraph', 'partialParagraph') and text(it.get('paraIndex'))]
        lines = lines_by_page[idx] if idx < len(lines_by_page) else []
        n = page_no(pg, idx)
        rows.append({'page': n, 'printed': pg.get('pageNumber'), 'section': sec, 'freePt': _r1(free_pt(pg)), 'textual': bool(with_text),
                     'first': where(real[0]) if real else None, 'firstText': where(with_text[0]) if with_text else None,
                     'lastText': where(with_text[-1]) if with_text else None})
        if not real:
            continue
        first, last = real[0], real[-1]

        def line_of(pi, which):
            got = [t for p, _, t in lines if p == pi]
            return got[which].strip() if got else None

        def add(it, kind, severity, line=None):
            defects.append({'page': n, 'kind': kind, 'severity': severity, 'section': sec, 'paragraph': it.get('paraIndex'),
                            'text': _clip(text(it.get('paraIndex')), 30), 'line': line})

        if last.get('kind') == 'fullParagraph' and head.match(text(last.get('paraIndex'))):
            add(last, 'heading', 'strong')
        if (first.get('kind') == 'partialParagraph' and first.get('startLine', 0) > 0
                and first.get('endLine', 0) - first.get('startLine', 0) == 1):
            add(first, 'widow', 'strong', line_of(first.get('paraIndex'), 0))
        if last.get('kind') == 'partialParagraph' and last.get('startLine', 0) == 0 and last.get('endLine') == 1:
            add(last, 'orphan', 'weak', line_of(last.get('paraIndex'), -1))
    bundles = []
    for k, (a, b) in enumerate(make_bundles(pages, breaks)):
        end = rows[b]
        start_text = rows[a]['firstText']['text'] if rows[a]['firstText'] else ''
        free = end['freePt']
        bundles.append({'index': k, 'firstPage': rows[a]['page'], 'lastPage': end['page'], 'freePt': free,
                        'freeLines': round(free / line_pt, 1) if free is not None and line_pt else None,
                        'tableOnly': not end['textual'], 'startText': _clip(start_text, 24)})
    strong = sum(d['severity'] == 'strong' for d in defects)
    return {'pageCount': pages_json.get('pageCount', len(pages)), 'linePitchPt': line_pt, 'bundles': bundles,
            'defects': defects, 'strong': strong, 'weak': len(defects) - strong, 'pages': rows}


def smallest_bundle(bundles):
    """글이 있는 끝 쪽 가운데 여유가 가장 작은 묶음(표만 있는 쪽은 뺀다)."""
    cands = [b for b in bundles if not b['tableOnly'] and b['freePt'] is not None]
    return min(cands, key=lambda b: b['freePt']) if cands else None


# ── 대조: 줄 나눔·쪽 끝·글자 폭 ─────────────────────────────────────────
def tree_paragraph_lines(trees, sections=None):
    """쪽별 render tree [(쪽 번호, 트리)] → 문단마다 줄 글(공백 뺌) {열쇠: [글…]}, 처음 나온 쪽 {열쇠: 쪽}.
    열쇠는 (구역, (T, 문단, 컨트롤), (C, 행, 열)…, (P, 문단)) — 쪽을 넘는 문단은 한 열쇠에 이어 붙는다. 머리말·꼬리말은 뺀다."""
    paras, first_page = collections.OrderedDict(), {}
    for page_no, tree in trees:
        sec = (sections or {}).get(page_no, 0)

        def walk(node, path):
            ty = node.get('type')
            if ty in ('Header', 'Footer'):
                return
            if ty == 'Table':
                path = path + (('T', node.get('pi'), node.get('ci')),)
            elif ty == 'Cell':
                path = path + (('C', node.get('row'), node.get('col')),)
            elif ty == 'TextLine':
                key = (sec,) + path + (('P', node.get('pi')),)
                paras.setdefault(key, []).append(re.sub(r'\s+', '', run_text(node)))
                first_page.setdefault(key, page_no)
                return
            for c in node.get('children') or []:
                walk(c, path)

        walk(tree, ())
    return paras, first_page


def line_break_stats(truth, test):
    """문단별 줄 나눔 일치(빈 줄·빈 문단 뺌) → (셈, [(열쇠, 정답 줄, 시험 줄)…] 다른 문단)."""
    st = collections.Counter()
    bad = []
    for key, la in truth.items():
        la = [x for x in la if x]
        if not la:
            continue
        lb = [x for x in test.get(key, []) if x]
        multi = len(la) >= 2
        same = la == lb
        st['paragraphs'] += 1
        st['same'] += same
        st['sameCount'] += len(la) == len(lb)
        st['multiLine'] += multi
        st['multiSame'] += multi and same
        st['multiSameCount'] += multi and len(la) == len(lb)
        st['lines'] += len(la)
        st['linesSame'] += sum(1 for x, y in zip(la, lb) if x == y)
        if not same:
            bad.append((key, la, lb))
    return {k: st[k] for k in ('paragraphs', 'same', 'sameCount', 'multiLine', 'multiSame', 'multiSameCount', 'lines', 'linesSame')}, bad


def break_direction(la, lb):
    """처음 갈린 줄과 방향: (줄 번호, 정답 줄, 시험 줄, 'narrow'(rhwp가 더 넣음 = 좁게 잼) | 'wide')."""
    i = next(i for i in range(max(len(la), len(lb))) if (la[i] if i < len(la) else None) != (lb[i] if i < len(lb) else None))
    x = la[i] if i < len(la) else ''
    y = lb[i] if i < len(lb) else ''
    return i + 1, x, y, 'narrow' if len(y) > len(x) else 'wide'


def key_label(key, many_sections=False):
    sec, *path = key
    parts = [f'구역 {sec}'] if many_sections else []
    for p in path:
        if p[0] == 'T':
            parts.append(f'문단 {p[1]} 표')
        elif p[0] == 'C':
            parts.append(f'칸({p[1]},{p[2]})')
        else:
            parts.append(f'문단 {p[1]}')
    return ' '.join(parts)


def text_rows(chars, tol=1.0):
    """글자 [(글자, x, y)]를 기준선(tol pt 안)으로 묶은 줄 [(y, 글)]. 쪽 번호 줄(-3-)은 뺀다."""
    rows = []
    for c, x, y in sorted(chars, key=lambda t: (t[2], t[1])):
        if rows and abs(rows[-1][0] - y) <= tol:
            rows[-1][1].append((x, c))
        else:
            rows.append([y, [(x, c)]])
    out = []
    for y, cs in rows:
        t = ''.join(c for _, c in sorted(cs))
        if not FOOT.match(t):
            out.append((y, t))
    return out


def align_pages(a_rows, b_rows, reach=2):
    """정답 쪽마다 끝 줄 글이 같은 시험 쪽을 앞에서 찾은 밀림 근처(±reach)에서 찾는다 → [(정답 쪽 자리, 시험 쪽 자리 | None)]."""
    last_b = [r[-1][1] if r else None for r in b_rows]
    out, shift = [], 0
    for i, ra in enumerate(a_rows):
        want = ra[-1][1] if ra else None
        j = None
        if want:
            for d in sorted(range(-reach, reach + 1), key=abs):
                k = i + shift + d
                if 0 <= k < len(b_rows) and last_b[k] == want:
                    j = k
                    break
        if j is not None:
            shift = j - i
        out.append((i, j))
    return out


def near_count(truth, test, tol):
    idx = collections.defaultdict(list)
    for c, x, y in test:
        idx[c].append((x, y))
    return sum(1 for c, x, y in truth if any(abs(x - a) <= tol and abs(y - b) <= tol for a, b in idx.get(c, ())))


def compare_pages(a, b):
    """PDF 두 벌의 쪽(각 {'chars', 'rows'})을 끝 줄 글로 맞춰 대고 쪽마다 끝 줄 높이 차·첫 줄·글자 자리를 낸다."""
    pairs = align_pages([p['rows'] for p in a], [p['rows'] for p in b])
    out, hits, chars = [], 0, 0
    for i, j in pairs:
        ra = a[i]['rows']
        row = {'truthPage': i + 1, 'testPage': None if j is None else j + 1, 'last': ra[-1][1][-24:] if ra else ''}
        if j is not None:
            rb = b[j]['rows']
            ka = collections.Counter(c for c, *_ in a[i]['chars'])
            kb = collections.Counter(c for c, *_ in b[j]['chars'])
            h = near_count(a[i]['chars'], b[j]['chars'], 1.5)
            hits += h
            chars += len(a[i]['chars'])
            row.update(dy=round(rb[-1][0] - ra[-1][0], 2), firstSame=bool(ra and rb and ra[0][1] == rb[0][1]),
                       moved=sum(((ka - kb) + (kb - ka)).values()), within15=round(h / len(a[i]['chars']), 3) if a[i]['chars'] else None)
        out.append(row)
    matched = [r for r in out if r['testPage'] is not None]
    shifts, prev = [], 0
    for r in matched:
        s = r['testPage'] - r['truthPage']
        if s != prev:
            shifts.append({'truthPage': r['truthPage'], 'shift': s})
            prev = s
    return {'pages': out, 'matched': len(matched), 'total': len(out),
            'sameHeight': sum(abs(r['dy']) <= SAME_DY for r in matched),
            'maxAbsDy': max((abs(r['dy']) for r in matched), default=None), 'shifts': shifts,
            'within15': round(hits / chars, 3) if chars else None}


def adjacent_pairs(lines):
    """줄마다 [(글자, x, y, 글자 크기)]에서 공백 없이 이웃한 글자 짝 → (글자, 다음 글자, 거리 em, 줄 글자 크기).
    거리는 그 줄에 가장 많은 글자 크기로 나눈다 — rhwp PDF는 장평을 바꾼 글자를 다른 크기로 찍는다."""
    for cs in lines:
        if not cs:
            continue
        size = collections.Counter(round(s, 1) for *_, s in cs).most_common(1)[0][0]
        if size <= 0:
            continue
        for (c, x, y, _), (c2, x2, y2, _) in zip(cs, cs[1:]):
            if c.isspace() or c2.isspace() or abs(y - y2) >= 0.3 or not 0 < x2 - x < 3 * size:
                continue
            yield c, c2, (x2 - x) / size, size


def advance_table(lines, allowed=None):
    """(글자, 줄 글자 크기)별 전진폭 중앙값과 개수. 한글은 한 묶음.
    allowed를 주면 그 짝만 센다 — rhwp PDF는 공백 글자를 찍지 않아 「→ 상」의 →와 상이 붙어 나오고 거리에 공백 폭이 섞인다.
    한컴 PDF는 공백을 대개 찍으므로 거기서 붙어 나온 짝(= 글 사이에 공백 없음)만 rhwp 쪽에서 센다(10-21 맑은 고딕 → 1.52em이
    이 착시였다). 다만 한컴도 대체 글꼴로 찍은 글자 뒤 공백은 안 찍을 때가 있어(휴먼명조 12pt →), 그 줄은 양쪽 다 「글자+공백」이다."""
    adv = collections.defaultdict(list)
    for c, c2, a, size in adjacent_pairs(lines):
        if allowed is None or (c, c2) in allowed:
            adv[('한글' if '가' <= c <= '힣' else c, size)].append(a)
    return {k: (round(statistics.median(v), 3), len(v)) for k, v in adv.items()}


def width_rows(hancom, raw, cal, min_count=2):
    """한컴과 rhwp(보정 전·뒤) 전진폭 표. 한컴에 min_count 번 넘게 나온 (글자, 크기)만, 한컴 개수 많은 차례."""
    rows = []
    for key, (h, n) in sorted(hancom.items(), key=lambda kv: -kv[1][1]):
        if n < min_count:
            continue
        r = raw.get(key, (None, 0))[0]
        c = cal.get(key, (None, 0))[0]
        flag = any(v is not None and abs(v - h) >= WIDE_EM for v in (r, c))
        rows.append({'char': key[0], 'size': key[1], 'hancom': h, 'raw': r, 'cal': c, 'count': n, 'differs': flag})
    return rows


def pdf_pages(path, areas):
    """PDF 쪽마다 본문 글자 [(글자, x, y)]·줄 [(y, 글)]·줄별 글자(전진폭용). areas: 쪽마다 (본문 위, 아래) pt."""
    import pymupdf
    out = []
    with pymupdf.open(str(path)) as doc:
        for i, page in enumerate(doc):
            top, bottom = areas[min(i, len(areas) - 1)] if areas else (0.0, page.rect.height)
            chars, lines = [], []
            for b in page.get_text('rawdict')['blocks']:
                for line in b.get('lines', []):
                    lines.append([(ch['c'], ch['origin'][0], ch['origin'][1], sp['size']) for sp in line['spans'] for ch in sp['chars']])
                    for sp in line['spans']:
                        for ch in sp['chars']:
                            c = ch['c']
                            if c and not c.isspace() and top < ch['origin'][1] < bottom:
                                chars.append((c, ch['origin'][0], ch['origin'][1]))
            out.append({'chars': chars, 'rows': text_rows(chars), 'lines': lines})
    return out


def body_areas(pages_json):
    """dump-pages의 쪽 본문 영역 → [(위 -1pt, 아래 +2pt)] — 기준선이 본문 안에 있는 글자만 본다."""
    out = []
    for pg in pages_json.get('pages') or []:
        a = pg.get('bodyArea') or {}
        out.append((a.get('y', 0.0) * PX_PT - 1.0, (a.get('y', 0.0) + a.get('height', 0.0)) * PX_PT + 2.0))
    return out


# ── 실행: rhwp·Java·작업 폴더 ───────────────────────────────────────────
def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def run(cmd, cwd=None, env=None, timeout=300):
    cmd = [str(c) for c in cmd]
    name = f'{Path(cmd[0]).name} {cmd[1] if len(cmd) > 1 else ""}'.strip()
    try:
        p = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, timeout=timeout)
    except FileNotFoundError as e:
        raise 쪽배치오류(f'실행 파일이 없다: {cmd[0]}') from e
    except subprocess.TimeoutExpired as e:
        raise 쪽배치오류(f'{timeout}초 안에 끝나지 않았다: {name}') from e
    if p.returncode != 0:
        tail = (p.stderr or p.stdout).decode('utf-8', 'replace').strip()[-800:]
        raise 쪽배치오류(f'{name} 실패(종료 {p.returncode}): {tail}')
    return p.stdout


def find_rhwp(allow_other=False):
    """rhwp.exe를 찾아 판을 확인한다 → {'exe', 'version', 'sha256', 'pinned'}."""
    exe = Path(os.environ.get('RHWP_EXE') or Path.home().joinpath(*RHWP_HOME))
    if not exe.is_file():
        raise 쪽배치오류(f'rhwp를 못 찾았다: {exe} — 환경 변수 RHWP_EXE에 rhwp.exe 경로를 주거나, '
                       'rhwp v0.8.7 릴리스 zip(rhwp-v0.8.7-windows-x86_64.zip)을 %USERPROFILE%\\tools\\rhwp-0.8.7\\에 푼다')
    digest = sha256_file(exe)
    if digest != RHWP_SHA256 and not allow_other:
        raise 쪽배치오류(f'rhwp 판이 고정한 v0.8.7이 아니다(SHA256 {digest[:12]}…): 판마다 조판이 움직인다 — '
                       '대조로 보정을 다시 재고 이 도구의 고정값을 고친 뒤 쓴다. 그래도 재려면 --다른판')
    version = run([exe, '--version'], timeout=60).decode('utf-8', 'replace').strip()
    return {'exe': str(exe), 'version': version, 'sha256': digest, 'pinned': digest == RHWP_SHA256 and version == RHWP_VERSION}


def java_exe():
    home = os.environ.get('JAVA_HOME')
    if home:
        for name in ('java.exe', 'java'):
            p = Path(home) / 'bin' / name
            if p.is_file():
                return str(p)
    found = shutil.which('java')
    if not found:
        raise 쪽배치오류('Java 17 이상이 필요하다(JAVA_HOME 또는 PATH의 java) — 측정용 사본을 다시 묶는 데 쓴다')
    return found


def check_jar():
    if not HWPLIB_JAR.is_file() or sha256_file(HWPLIB_JAR) != HWPLIB_SHA256:
        raise 쪽배치오류(f'hwplib jar가 없거나 바뀌었다: {HWPLIB_JAR} (SHA256 {HWPLIB_SHA256[:12]}…이어야 한다)')


def rhwp_env():
    return dict(os.environ, RHWP_FONT_PATH=RHWP_FONT_PATH)


def make_work(path=None):
    if path is None:
        return Path(tempfile.mkdtemp(prefix='hwp-pages-'))
    work = Path(path)
    if work.exists() and (not work.is_dir() or any(work.iterdir())):
        raise 쪽배치오류(f'작업 폴더는 없거나 빈 폴더여야 한다(남의 파일을 덮지 않는다): {work}')
    work.mkdir(parents=True, exist_ok=True)
    return work.resolve()


def build_copy(out_streams, folder):
    """folder/doc.hwp를 만든다 — 바꿀 스트림이 있으면 RepackMulti로, 없으면 원본 사본 그대로. 원본 사본은 folder/../source.hwp."""
    source = folder.parent / 'source.hwp'
    if not out_streams:
        shutil.copyfile(source, folder / 'doc.hwp')
        return
    (folder / 'streams').mkdir()
    lines = []
    for name, data in out_streams.items():
        rel = Path('streams') / (name.replace('/', '_') + '.bin')
        (folder / rel).write_bytes(data)
        lines.append(f'REPLACE\t{name}\t{rel.as_posix()}')
    (folder / 'repack.tsv').write_bytes(('\n'.join(lines) + '\n').encode('utf-8'))
    # 인자는 영문 상대 경로만 준다 — 윈도우 Java는 명령줄을 시스템 코드 페이지로 받는다.
    run([java_exe(), '-Dfile.encoding=UTF-8', '-Dstdout.encoding=UTF-8', '-Dstderr.encoding=UTF-8', '-cp', HWPLIB_JAR, REPACK,
         os.path.join('..', 'source.hwp'), 'repack.tsv', 'doc.hwp'], cwd=folder, timeout=300)


def dump_pages(rhwp, folder):
    raw = run([rhwp['exe'], 'dump-pages', 'doc.hwp', '--compat', COMPAT, '--json'], cwd=folder, env=rhwp_env(), timeout=300)
    (folder / 'pages.json').write_bytes(raw)
    try:
        return json.loads(raw.decode('utf-8'))
    except ValueError as e:
        raise 쪽배치오류(f'rhwp dump-pages가 JSON을 내지 않았다: {raw[:200]!r}') from e


def export_tree(rhwp, folder):
    """쪽별 render tree [(쪽 번호, 트리)]."""
    run([rhwp['exe'], 'export-render-tree', 'doc.hwp', '-o', 'tree', '--compat', COMPAT], cwd=folder, env=rhwp_env(), timeout=300)
    out = []
    for fn in (folder / 'tree').glob('render_tree_*.json'):
        m = re.search(r'(\d+)\.json$', fn.name)
        if m:
            out.append((int(m.group(1)), json.loads(fn.read_text(encoding='utf-8'))))
    return sorted(out, key=lambda t: t[0])


def export_pdf(rhwp, folder):
    run([rhwp['exe'], 'export-pdf', 'doc.hwp', '-o', 'doc.pdf', '--compat', COMPAT], cwd=folder, env=rhwp_env(), timeout=900)
    return folder / 'doc.pdf'


def trees_in_page_order(pages_json, trees):
    by_no = dict(trees)  # render_tree_NNN.json의 NNN은 실제 쪽(1부터)
    return [by_no.get(page_no(pg, i), {}) for i, pg in enumerate(pages_json.get('pages') or [])]


def measure_once(folder, streams, paras, rhwp, rules=None, scale=None, heading=HEADING, pdf=False):
    folder.mkdir(parents=True)
    out, stats = calibrate(streams, rules, scale)
    build_copy(out, folder)
    pages_json = dump_pages(rhwp, folder)
    trees = export_tree(rhwp, folder)
    res = analyze(pages_json, paras, trees_in_page_order(pages_json, trees), heading)
    res['calibration'] = stats
    if pdf:
        res['pdf'] = str(export_pdf(rhwp, folder))
    return res


# ── 사람용 글 ───────────────────────────────────────────────────────────
KIND = {'heading': '쪽 끝에 제목만 남음', 'widow': '쪽 맨 위에 앞 문단 꼬리 한 줄만', 'orphan': '쪽 끝에 문단 첫 줄 하나'}


def calibration_line(stats):
    if not stats.get('rule') and not stats.get('scale'):
        return '보정 없음(rhwp 내장 폭 그대로)'
    parts = []
    if stats.get('rule'):
        by = ', '.join(f'{k} {v}' for k, v in stats['byChar'].items())
        parts.append(f"규칙 {stats['rule']} — 글자 {stats['chars']}개({by or '맞는 글자 없음'}), "
                     f"글자 모양 {stats['shapes']} → {stats['shapes'] + stats['clones']}개")
    if stats.get('scale'):
        parts.append(f"{stats['scale'][0]} 폭 전체 {stats['scale'][1]}%(글자 모양 {stats['scaledShapes']}개)")
    return '보정: ' + ' · '.join(parts)


def format_measure(res):
    out = [f"{Path(res['file']).name} — {res['pageCount']}쪽 ({res['rhwp']['version']} --compat {COMPAT}"
           + ('' if res['rhwp']['pinned'] else ', 고정 판 아님') + ')',
           calibration_line(res['calibration'])]
    pitch = res['linePitchPt']
    out.append('묶음(강제 쪽 나눔)마다 끝 쪽 여유' + (f' — 한 줄 {pitch:g}pt' if pitch else '') + ', 마지막 줄 뒤 간격까지 센 값:')
    for b in res['bundles']:
        span = f"{b['firstPage']}쪽" if b['firstPage'] == b['lastPage'] else f"{b['firstPage']}~{b['lastPage']}쪽"
        lines = f" ({b['freeLines']:.1f}줄)" if b['freeLines'] is not None else ''
        note = '  표만 있는 쪽' if b['tableOnly'] else (f"  「{b['startText']}」" if b['startText'] else '')
        free = '—' if b['freePt'] is None else f"{b['freePt']:.1f}pt"
        out.append(f"  묶음 {b['index']:>2}  {span:<8} {free:>8}{lines}{note}")
    out.append(f"쪽 끝 흠: 강한 흠 {res['strong']}곳 · 약한 흠 {res['weak']}곳")
    for d in res['defects']:
        line = f" · 그 줄 「{d['line']}」({len(d['line'])}자)" if d.get('line') else ''
        out.append(f"  {'강함' if d['severity'] == 'strong' else '약함'}  {d['page']}쪽 {KIND[d['kind']]} — 문단 {d['paragraph']} 「{d['text']}」{line}")
    out.append('쪽표:')

    def item(x):
        return f"문단 {x['paragraph']} {x['span']}" + (f" 「{x['text'][:24]}」" if x['text'] else '') if x else '—'

    for r in res['pages']:
        first, last = item(r['first']), item(r['lastText'])
        free = '—' if r['freePt'] is None else f"{r['freePt']:.1f}pt"
        out.append(f"  {r['page']:>3}쪽 여유 {free:>8} | 처음 {first} | 끝 글 {last}")
    if res.get('shake'):
        out.append(f"흔들기({res['shake'][0]['font']} 폭 전체):")
        for s in res['shake']:
            small = s['smallest']
            tail = f" · 가장 작은 묶음 여유 {small['freePt']:.1f}pt(묶음 {small['index']})" if small else ''
            out.append(f"  {s['percent']:>4}%  {s['pageCount']}쪽 · 강한 흠 {s['strong']}곳{tail}")
    if res.get('pdf'):
        out.append(f"PDF: {res['pdf']}")
    out.append(f"결과 JSON: {res['json']}")
    return '\n'.join(out)


def _pct(a, b):
    return f'{a}/{b} ({100 * a / b:.1f}%)' if b else f'{a}/{b}'


def format_compare(res):
    pc = res['pageCount']
    out = [f"대조 — {Path(res['file']).name} ↔ {Path(res['pdf']).name} ({res['rhwp']['version']} --compat {COMPAT}"
           + ('' if res['rhwp']['pinned'] else ', 고정 판 아님') + ')',
           f"보정 규칙: {res['rule']}"]
    miss, total = res['paragraphsWithoutLineSeg']
    if miss:
        out.append(f"⚠ 줄 배치가 없는 문단 {miss}/{total} — 그 문단은 정답이 한컴 배치가 아니다. 한컴이 저장한 파일로 대조한다.")
    out.append(f"쪽 수: 한컴 PDF {pc['hancom']} · 저장 배치 {pc['saved']} · 다시 짬(보정 전) {pc['raw']} · 다시 짬(보정 뒤) {pc['cal']}")
    out.append('줄 나눔(한컴 저장 배치 = 정답, 빈 문단 뺌):')
    for name, label in (('raw', '보정 전'), ('cal', '보정 뒤')):
        s = res['lineBreaks'][name]
        out.append(f"  {label}  문단 {_pct(s['same'], s['paragraphs'])} · 두 줄 이상 {_pct(s['multiSame'], s['multiLine'])}"
                   f" · 줄 {_pct(s['linesSame'], s['lines'])}")
    bad = res['lineBreaks']['calMismatches']
    if bad:
        out.append(f"  보정 뒤에도 다른 문단 {res['lineBreaks']['cal']['paragraphs'] - res['lineBreaks']['cal']['same']}곳"
                   + (f'(앞 {len(bad)}곳)' if len(bad) < res['lineBreaks']['cal']['paragraphs'] - res['lineBreaks']['cal']['same'] else '') + ':')
        for m in bad:
            way = 'rhwp가 더 넣음(좁게 잼)' if m['direction'] == 'narrow' else 'rhwp가 덜 넣음(넓게 잼)'
            out.append(f"    {m['page']}쪽 {m['where']} — {m['truthLines']}→{m['testLines']}줄, {m['line']}번째 줄 {way}:"
                       f" 한컴 「{m['truth']}」 rhwp 「{m['test']}」")
    out.append('쪽 끝(한컴 PDF 쪽마다 끝 줄 글이 같은 rhwp 쪽을 찾아 댐):')
    for name, label in (('saved', '저장 배치'), ('cal', '보정 뒤')):
        c = res['pageEnds'][name]
        shifts = ', '.join(f"{s['truthPage']}쪽부터 {s['shift']:+d}쪽" for s in c['shifts'])
        over = ', '.join(f"{r['truthPage']}쪽 {r['dy']:+.2f}pt" for r in c['pages'] if r['testPage'] and abs(r['dy']) > SAME_DY)
        mx = '—' if c['maxAbsDy'] is None else f"{c['maxAbsDy']:.2f}pt"
        w15 = '' if c['within15'] is None else f" · 글자 자리 1.5pt 안 {100 * c['within15']:.1f}%"
        out.append(f"  {label:<5} 끝 줄 같음 {c['matched']}/{c['total']}" + (f'({shifts})' if shifts else '')
                   + f" · 끝 줄 높이 {SAME_DY}pt 안 {c['sameHeight']}/{c['matched']}(가장 큰 차 {mx}){w15}"
                   + (f' · 넘는 쪽 {over}' if over else ''))
    flagged = [w for w in res['widths'] if w['differs']]
    out.append(f'글자 폭(em, 줄 글자 크기로 나눈 이웃 글자까지 거리의 중앙값) — 한컴과 {WIDE_EM}em 넘게 다른 것 {len(flagged)}줄:')
    if flagged:
        out.append('  글자   크기    한컴   보정 전  보정 뒤  개수')

        def f3(v):
            return '   —  ' if v is None else f'{v:6.3f}'

        for w in flagged:
            out.append(f"  {w['char']:<4} {w['size']:>5g}pt {w['hancom']:6.3f}  {f3(w['raw'])}  {f3(w['cal'])}  {w['count']:>4}")
    out.append(f"결과 JSON: {res['json']}")
    return '\n'.join(out)


# ── 명령 ────────────────────────────────────────────────────────────────
def start(hwp, work_arg):
    src = Path(hwp)
    if not src.is_file():
        raise 쪽배치오류(f'파일이 없다: {src}')
    try:
        streams = H.read_streams(str(src))
    except ImportError as e:
        raise 쪽배치오류('파이썬 olefile이 필요하다(python -m pip install olefile)') from e
    work = make_work(work_arg)
    shutil.copyfile(src, work / 'source.hwp')
    return src.resolve(), streams, work


def cmd_measure(o):
    rhwp = find_rhwp(o.다른판)
    check_jar()
    rules = None if o.보정없이 else parse_rules(o.규칙)
    src, streams, work = start(o.hwp, o.작업)
    paras = paragraphs(streams)
    res = measure_once(work / 'measure', streams, paras, rhwp, rules, None, o.제목, o.pdf)
    if o.흔들기:
        res['shake'] = []
        for pct in SHAKE:
            r = measure_once(work / f'shake{pct}', streams, paras, rhwp, rules, (o.흔들기, pct), o.제목)
            res['shake'].append({'font': o.흔들기, 'percent': pct, 'pageCount': r['pageCount'], 'strong': r['strong'],
                                 'weak': r['weak'], 'smallest': smallest_bundle(r['bundles'])})
    res.update(tool='hwp쪽배치', command='재기', file=str(src), sha256=sha256_file(src), rhwp=rhwp, compat=COMPAT, work=str(work))
    return res, format_measure


def cmd_compare(o):
    rhwp = find_rhwp(True)
    check_jar()
    try:
        import pymupdf  # noqa: F401 — 대조에만 필요하다. 없으면 PDF를 만들기 전에 멈춘다.
    except ImportError as e:
        raise 쪽배치오류('대조에는 파이썬 PyMuPDF가 필요하다(python -m pip install pymupdf)') from e
    rules = parse_rules(o.규칙)
    pdf = Path(o.pdf)
    if not pdf.is_file():
        raise 쪽배치오류(f'PDF가 없다: {pdf}')
    src, streams, work = start(o.hwp, o.작업)
    built = {}
    for name, r, strip in (('saved', None, False), ('raw', None, True), ('cal', rules, True)):
        folder = work / name
        folder.mkdir()
        out, stats = calibrate(streams, r, None, strip)
        build_copy(out, folder)
        built[name] = {'stats': stats, 'pages': dump_pages(rhwp, folder), 'trees': export_tree(rhwp, folder)}
    print('rhwp로 PDF 세 벌을 만드는 중…', file=sys.stderr, flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        pdfs = dict(zip(built, ex.map(lambda n: export_pdf(rhwp, work / n), built)))
    sections = {name: {page_no(p, i): p.get('section', 0) for i, p in enumerate(b['pages'].get('pages') or [])} for name, b in built.items()}
    many = len(set(sections['saved'].values())) > 1
    lines = {name: tree_paragraph_lines(b['trees'], sections[name]) for name, b in built.items()}
    truth = lines['saved'][0]
    stats = {}
    for name in ('raw', 'cal'):
        stats[name], bad = line_break_stats(truth, lines[name][0])
        if name == 'cal':
            mism = []
            for key, la, lb in bad[:o.보기]:
                no, x, y, way = break_direction(la, lb)
                mism.append({'page': lines['saved'][1].get(key), 'where': key_label(key, many), 'truthLines': len(la),
                             'testLines': len(lb), 'line': no, 'truth': x[-30:], 'test': y[-30:], 'direction': way})
            stats['calMismatches'] = mism
    hancom = pdf_pages(pdf, body_areas(built['saved']['pages']))
    rh = {name: pdf_pages(pdfs[name], body_areas(built[name]['pages'])) for name in built}
    hancom_lines = [ln for p in hancom for ln in p['lines']]
    allowed = {(c, c2) for c, c2, *_ in adjacent_pairs(hancom_lines)}
    adv = {'hancom': advance_table(hancom_lines),
           **{name: advance_table([ln for p in pages for ln in p['lines']], allowed) for name, pages in rh.items()}}
    res = {'tool': 'hwp쪽배치', 'command': '대조', 'file': str(src), 'sha256': sha256_file(src), 'pdf': str(pdf.resolve()),
           'pdfSha256': sha256_file(pdf), 'rhwp': rhwp, 'compat': COMPAT, 'rule': rule_text(rules),
           'paragraphsWithoutLineSeg': list(paragraphs_without_line_seg(streams)),
           'pageCount': {'hancom': len(hancom), **{n: b['pages'].get('pageCount') for n, b in built.items()}},
           'calibration': built['cal']['stats'], 'lineBreaks': stats,
           'pageEnds': {'saved': compare_pages(hancom, rh['saved']), 'cal': compare_pages(hancom, rh['cal'])},
           'widths': width_rows(adv['hancom'], adv['raw'], adv['cal']), 'work': str(work)}
    return res, format_compare


def main(argv=None):
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, 'reconfigure'):
            s.reconfigure(encoding='utf-8')
    p = argparse.ArgumentParser(prog='hwp쪽배치.py', description='한컴 없이 rhwp v0.8.7로 HWP 쪽 배치를 잰다(파일 머리 설명 참고)')
    sub = p.add_subparsers(dest='cmd', required=True)
    m = sub.add_parser('재기', help='쪽 수·묶음 끝 여유·쪽 끝 흠')
    m.add_argument('hwp')
    g = m.add_mutually_exclusive_group()
    g.add_argument('--규칙', default=DEFAULT_RULE, help=f'글꼴:글자=장평%%,…;… (기본 {DEFAULT_RULE})')
    g.add_argument('--보정없이', action='store_true', help='rhwp 내장 폭 그대로 잰다')
    m.add_argument('--흔들기', nargs='?', const=DEFAULT_FONT, metavar='글꼴', help='그 글꼴 폭 전체를 98·99·101·102%%로 바꿔 다시 잰다')
    m.add_argument('--제목', default=HEADING, help='쪽 끝에 홀로 남으면 흠으로 보는 제목 꼴(정규식)')
    m.add_argument('--pdf', action='store_true', help='측정용 사본을 PDF로도 뽑는다(눈으로 볼 때)')
    c = sub.add_parser('대조', help='한컴 PDF로 보정을 다시 잰다')
    c.add_argument('hwp')
    c.add_argument('pdf')
    c.add_argument('--규칙', default=DEFAULT_RULE)
    c.add_argument('--보기', type=int, default=12, help='보정 뒤에도 다른 문단을 몇 곳까지 적을지')
    for q in (m, c):
        q.add_argument('--작업', help='작업 폴더(없거나 빈 폴더). 기본은 %%TEMP%%에 새로')
        q.add_argument('--json', help='결과 JSON을 이 파일에도 쓴다. -면 JSON만 표준 출력에')
    m.add_argument('--다른판', action='store_true', help='고정 판이 아닌 rhwp로도 잰다')
    o = p.parse_args(argv)
    try:
        res, fmt = (cmd_measure if o.cmd == '재기' else cmd_compare)(o)
        res['json'] = str(Path(res['work']) / 'result.json')
        blob = (json.dumps(res, ensure_ascii=False, indent=1) + '\n').encode('utf-8')
        Path(res['json']).write_bytes(blob)
        if o.json and o.json != '-':
            Path(o.json).write_bytes(blob)
        if o.json == '-':
            print(fmt(res), file=sys.stderr)
            sys.stdout.write(blob.decode('utf-8'))
        else:
            print(fmt(res))
    except (쪽배치오류, ValueError, OSError) as e:
        print(f'hwp쪽배치: {e}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
