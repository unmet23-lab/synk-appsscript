"""HWP 5 본문 레코드 다루기(읽기·쓰기). tools/hwp쪽배치.py가 쓴다(재도전 사업계획서 작업 .tmp의 patch_section.py·살피기 스크립트에서 옮김, 2026-10-21).

레코드 머리: 32비트 = 태그(10) | 단계(10) | 크기(12, 0xFFF면 뒤 4바이트가 크기).
문단 머리(PARA_HEADER, 24바이트): 글자 수(4, 맨 윗비트는 목록의 마지막 문단 표시) · 제어 마스크(4) · 문단 모양(2) · 스타일(1)
· 나눔(1) · 글자 모양 수(2) · 범위 태그 수(2) · 줄 정보 수(2) · 문단 ID(4) · 변경 추적 병합(2).
olefile은 read_streams에서만 불러온다(레코드 셈만 쓰는 시험은 olefile 없이 돈다).
"""
import struct
import zlib

PARA_HEADER, PARA_TEXT, PARA_CHAR_SHAPE, PARA_LINE_SEG, PARA_RANGE_TAG = 0x42, 0x43, 0x44, 0x45, 0x46
CTRL_HEADER, LIST_HEADER, TABLE = 0x47, 0x48, 0x4d
TBL_ID = b' lbt'  # 'tbl ' 네 글자 ID를 작은 끝으로 적은 것

# hwplib HWPChar.type과 같은 나눔: 1글자짜리 제어와 8글자짜리 제어
CHAR_CTRL = {0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31}
WIDE_CTRL = set(range(32)) - CHAR_CTRL


class Rec:
    __slots__ = ('tag', 'level', 'data')

    def __init__(self, tag, level, data):
        self.tag, self.level, self.data = tag, level, bytes(data)

    def copy(self, data=None):
        return Rec(self.tag, self.level, self.data if data is None else data)


def parse(raw):
    recs, i = [], 0
    while i < len(raw):
        h = struct.unpack_from('<I', raw, i)[0]
        tag, level, size = h & 0x3ff, (h >> 10) & 0x3ff, h >> 20
        i += 4
        if size == 0xfff:
            size = struct.unpack_from('<I', raw, i)[0]
            i += 4
        recs.append(Rec(tag, level, raw[i:i + size]))
        i += size
    if i != len(raw):
        raise ValueError('레코드 끝이 스트림 끝과 맞지 않는다')
    return recs


def serialize(recs):
    out = bytearray()
    for r in recs:
        n = len(r.data)
        if n >= 0xfff:
            out += struct.pack('<II', r.tag | (r.level << 10) | (0xfff << 20), n)
        else:
            out += struct.pack('<I', r.tag | (r.level << 10) | (n << 20))
        out += r.data
    return bytes(out)


def read_streams(path):
    import olefile
    ole = olefile.OleFileIO(path)
    try:
        return {'/'.join(p): ole.openstream(p).read() for p in ole.listdir(streams=True, storages=False)}
    finally:
        ole.close()


def file_flags(streams):
    fh = streams['FileHeader']
    if not fh.startswith(b'HWP Document File'):
        raise ValueError('HWP 5 파일이 아니다')
    flags = struct.unpack_from('<I', fh, 36)[0]
    return {'compressed': bool(flags & 1), 'password': bool(flags & 2), 'distribution': bool(flags & 4)}


def inflate(data):
    return zlib.decompress(data, -15)


def deflate(data):
    c = zlib.compressobj(9, zlib.DEFLATED, -15)
    return c.compress(data) + c.flush()


def group_end(recs, i):
    """i번 레코드(문단 머리 등) 아래 딸린 레코드가 끝나는 자리(다음 같은·윗 단계 레코드)."""
    lv = recs[i].level
    j = i + 1
    while j < len(recs) and recs[j].level > lv:
        j += 1
    return j


def chars(text_rec):
    """PARA_TEXT를 (코드, 글자 수) 목록으로. 8글자 제어는 한 덩이로 센다."""
    d = text_rec.data
    out, i = [], 0
    while i < len(d):
        code = struct.unpack_from('<H', d, i)[0]
        if code in WIDE_CTRL:
            out.append((code, 8))
            i += 16
        else:
            out.append((code, 1))
            i += 2
    return out


def para_text(recs, i):
    """i번 문단 머리의 보통 글자만(제어 글자 뺌)."""
    j = group_end(recs, i)
    for k in range(i + 1, j):
        if recs[k].tag == PARA_TEXT and recs[k].level == recs[i].level + 1:
            return ''.join(chr(c) for c, n in chars(recs[k]) if c > 31)
    return ''


def header_fields(rec):
    d = rec.data
    n, mask = struct.unpack_from('<II', d, 0)
    ps, style, divide = struct.unpack_from('<HBB', d, 8)
    ncs, nrt, nls = struct.unpack_from('<HHH', d, 12)
    inst = struct.unpack_from('<I', d, 18)[0]
    return {'nchars': n & 0x7fffffff, 'last': bool(n & 0x80000000), 'mask': mask, 'ps': ps, 'style': style,
            'divide': divide, 'ncs': ncs, 'nrt': nrt, 'nls': nls, 'inst': inst, 'len': len(d)}


def char_shapes(recs, i):
    j = group_end(recs, i)
    for k in range(i + 1, j):
        if recs[k].tag == PARA_CHAR_SHAPE and recs[k].level == recs[i].level + 1:
            d = recs[k].data
            return [struct.unpack_from('<II', d, o) for o in range(0, len(d), 8)]
    return []


def top_paragraphs(recs):
    return [i for i, r in enumerate(recs) if r.tag == PARA_HEADER and r.level == 0]


def cell_address(lh):
    """셀 LIST_HEADER에서 (행, 열, 문단 수). 문단 수(2)·속성(4)·빈칸(2) 다음에 열·행 주소가 온다."""
    nparas = struct.unpack_from('<h', lh.data, 0)[0]
    col, row = struct.unpack_from('<HH', lh.data, 8)
    return row, col, nparas


def tables(recs):
    """본문 바로 아래 표들: [(표를 품은 문단 머리 자리, 표 CTRL_HEADER 자리, {(행, 열): [셀 문단 머리 자리…]})]."""
    out = []
    tops = top_paragraphs(recs)
    for p in tops:
        end = group_end(recs, p)
        for k in range(p + 1, end):
            r = recs[k]
            if r.tag == CTRL_HEADER and r.level == 1 and r.data[:4] == TBL_ID:
                # 표 캡션(「< 매출 실적 >」 같은 것)은 TABLE 레코드 앞의 LIST_HEADER에 들어 있다. 칸은 TABLE 뒤부터.
                cells, cur, seen_table = {}, None, False
                cend = group_end(recs, k)
                for m in range(k + 1, cend):
                    x = recs[m]
                    if x.level != 2:
                        continue
                    if x.tag == TABLE:
                        seen_table = True
                    elif not seen_table:
                        continue
                    elif x.tag == LIST_HEADER:
                        row, col, n = cell_address(x)
                        if (row, col) in cells:
                            raise ValueError(f'칸 주소가 두 번 나온다: {row},{col}')
                        cur = cells[(row, col)] = []
                    elif x.tag == PARA_HEADER:
                        cur.append(m)
                out.append((p, k, cells))
    return out
