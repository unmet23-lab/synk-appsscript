"""HWP(5.x)·HWPX 문서의 글을 한컴오피스 없이 뽑는다.

왜 있나: 10-17 새 노트북에는 한컴오피스가 없고 유호님은 HWP를 쓰지 않는다. 지원사업 양식·공문처럼
HWP로 온 문서를 AI가 읽어야 할 때 이 도구로 글과 표를 꺼낸다(설치·창 없음, 원본은 읽기만).

  python -X utf8 tools/hwp읽기.py <파일.hwp|.hwpx> [--out <글.txt>] [--정보] [--표없이]

- .hwp: OLE 복합 파일(olefile) → BodyText/Section* 스트림(raw deflate) → 레코드 → 문단 글(PARA_TEXT).
- .hwpx: zip 안 Contents/section*.xml의 문단(hp:p)·표(hp:tbl)를 순서대로.
- 표는 「[표 행×열]」 아래 행마다 `| 칸 | 칸 |`로 적는다(칸 안 여러 문단은 ` / `로 잇는다). --표없이면 칸 글을 문단처럼 차례로 적는다.
- 배포용 문서(ViewText)는 머리 레코드의 열쇠로 AES-128을 풀어 읽는다(파이썬만으로, 추가 설치 없음).
  열쇠 꺼내기는 형식 문서대로 짰지만 10-17에는 시험할 배포용 파일이 없었다 — 풀기에 실패하면 zlib 오류로 멈춘다.
- 암호를 건 문서는 읽지 않고 그렇다고 알린다.
- 쓰기·그림으로 보기(쪽 모양 확인)는 하지 않는다 — docs/현장노트/한글_HWP.md 참고.
"""
import sys, struct, zlib, zipfile, re, argparse
import xml.etree.ElementTree as ET

# ── HWP 5.x ─────────────────────────────────────────────────────────────
TAG_BEGIN = 0x10
PARA_HEADER, PARA_TEXT, CTRL_HEADER, LIST_HEADER, TABLE = TAG_BEGIN + 50, TAG_BEGIN + 51, TAG_BEGIN + 55, TAG_BEGIN + 56, TAG_BEGIN + 61
# 글자 안 제어 문자: 하나짜리(char)와 8글자짜리(inline·extended)
CHAR_CTRL = {0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31}


class Rec:
    __slots__ = ('tag', 'level', 'data', 'kids')

    def __init__(self, tag, level, data):
        self.tag, self.level, self.data, self.kids = tag, level, data, []


def records(buf):
    out, i, n = [], 0, len(buf)
    while i + 4 <= n:
        h, = struct.unpack_from('<I', buf, i); i += 4
        tag, level, size = h & 0x3FF, (h >> 10) & 0x3FF, (h >> 20) & 0xFFF
        if size == 0xFFF:
            size, = struct.unpack_from('<I', buf, i); i += 4
        out.append(Rec(tag, level, buf[i:i + size])); i += size
    return out


def tree(recs):
    root = Rec(-1, -1, b''); stack = [root]
    for r in recs:
        while stack[-1].level >= r.level:
            stack.pop()
        stack[-1].kids.append(r); stack.append(r)
    return root.kids


def para_text(data):
    s, i, n = [], 0, len(data) // 2
    while i < n:
        c, = struct.unpack_from('<H', data, i * 2)
        if c < 32:
            if c in CHAR_CTRL:
                s.append({10: '\n', 24: '-', 30: ' ', 31: ' '}.get(c, ''))
                i += 1
            else:
                if c == 9: s.append('\t')
                i += 8
            continue
        s.append(chr(c)); i += 1
    return ''.join(s).rstrip('\r')


# ── 배포용 문서(ViewText): 머리 256바이트에서 열쇠를 꺼내 AES-128 ECB로 푼다 ──────────
# 한글 문서 파일 형식 5.0의 「배포용 문서 데이터」. 열쇠 꺼내기는 MSVC rand()로 만든 바이트와 XOR.
def _gmul(a, b):
    p = 0
    for _ in range(8):
        if b & 1: p ^= a
        hi = a & 0x80; a = (a << 1) & 0xFF
        if hi: a ^= 0x1B
        b >>= 1
    return p


def _sbox():
    inv = [0] * 256
    for x in range(1, 256):
        for y in range(1, 256):
            if _gmul(x, y) == 1: inv[x] = y; break
    rot = lambda v, k: ((v << k) | (v >> (8 - k))) & 0xFF
    s = [(v ^ rot(v, 1) ^ rot(v, 2) ^ rot(v, 3) ^ rot(v, 4) ^ 0x63) for v in inv]
    si = [0] * 256
    for i, v in enumerate(s): si[v] = i
    return s, si


_S = _SI = None


def aes128_ecb_decrypt(key, data):
    global _S, _SI
    if _S is None: _S, _SI = _sbox()
    w = [list(key[i:i + 4]) for i in range(0, 16, 4)]
    rcon = 1
    for i in range(4, 44):
        t = list(w[i - 1])
        if i % 4 == 0:
            t = [_S[b] for b in t[1:] + t[:1]]; t[0] ^= rcon; rcon = _gmul(rcon, 2)
        w.append([a ^ b for a, b in zip(w[i - 4], t)])
    rk = [sum(w[r * 4:r * 4 + 4], []) for r in range(11)]
    m = {k: [_gmul(x, k) for x in range(256)] for k in (9, 11, 13, 14)}
    out = bytearray()
    for o in range(0, len(data) - len(data) % 16, 16):
        s = [b ^ k for b, k in zip(data[o:o + 16], rk[10])]
        for rnd in range(9, -1, -1):
            s = [s[((c - r) % 4) * 4 + r] for c in range(4) for r in range(4)]  # 거꾸로 줄 밀기
            s = [_SI[b] for b in s]
            s = [b ^ k for b, k in zip(s, rk[rnd])]
            if rnd:
                t = []
                for c in range(4):
                    a0, a1, a2, a3 = s[c * 4:c * 4 + 4]
                    t += [m[14][a0] ^ m[11][a1] ^ m[13][a2] ^ m[9][a3], m[9][a0] ^ m[14][a1] ^ m[11][a2] ^ m[13][a3],
                          m[13][a0] ^ m[9][a1] ^ m[14][a2] ^ m[11][a3], m[11][a0] ^ m[13][a1] ^ m[9][a2] ^ m[14][a3]]
                s = t
        out += bytes(s)
    return bytes(out)


def distribute_key(payload):
    seed, = struct.unpack_from('<I', payload, 0)
    state, key, n, b = seed, bytearray(256), 0, 0

    def rand():
        nonlocal state
        state = (state * 214013 + 2531011) & 0xFFFFFFFF
        return (state >> 16) & 0x7FFF
    for i in range(256):
        if n == 0:
            b = rand() & 0xFF; n = (rand() & 0x0F) + 1
        key[i] = b; n -= 1
    dec = bytes(x ^ y for x, y in zip(payload, key))
    off = 4 + (seed & 0x0F)
    return dec[off:off + 16]


def view_text(buf):
    h, = struct.unpack_from('<I', buf, 0)
    tag, size = h & 0x3FF, (h >> 20) & 0xFFF
    if tag != TAG_BEGIN + 12 or size != 256:
        raise ValueError(f'배포용 머리 레코드가 아니다(tag {tag}, 크기 {size})')
    key = distribute_key(buf[4:260])
    return aes128_ecb_decrypt(key, buf[260:])


def ctrl_id(rec):
    return rec.data[:4][::-1].decode('latin-1') if len(rec.data) >= 4 else ''


class Out:
    def __init__(self, tables=True):
        self.lines, self.tables = [], tables


def render_paras(nodes, out, depth=0):
    """nodes: 같은 수준의 레코드들. 문단(PARA_HEADER)마다 글 → 그 문단에 든 컨트롤(표 등)."""
    for p in nodes:
        if p.tag != PARA_HEADER:
            continue
        text = ''.join(para_text(k.data) for k in p.kids if k.tag == PARA_TEXT)
        if text.strip():
            out.lines.append(('  ' * depth) + text)
        for k in p.kids:
            if k.tag == CTRL_HEADER:
                render_ctrl(k, out, depth)


def cell_groups(kids):
    """표·글상자 컨트롤의 자식에서 LIST_HEADER마다 그 뒤 문단들을 묶는다."""
    groups, cur = [], None
    for k in kids:
        if k.tag == LIST_HEADER:
            col = row = None
            if len(k.data) >= 12:
                col, row = struct.unpack_from('<HH', k.data, 8)
            cur = {'col': col, 'row': row, 'paras': []}; groups.append(cur)
        elif k.tag == PARA_HEADER and cur is not None:
            cur['paras'].append(k)
    return groups


def render_ctrl(c, out, depth):
    cid = ctrl_id(c)
    if cid == 'tbl ':
        t = next((k for k in c.kids if k.tag == TABLE), None)
        rows, cols = (struct.unpack_from('<HH', t.data, 4) if t is not None and len(t.data) >= 8 else (0, 0))
        groups = cell_groups(c.kids)
        if not out.tables:
            for g in groups: render_paras(g['paras'], out, depth + 1)
            return
        out.lines.append(('  ' * depth) + f'[표 {rows}×{cols}]')
        grid = {}
        for g in groups:
            sub = Out(out.tables); render_paras(g['paras'], sub, 0)
            grid.setdefault(g['row'], []).append((g['col'] or 0, ' / '.join(' '.join(l.split()) for l in sub.lines if l.strip())))
        for r in sorted(grid, key=lambda x: (x is None, x)):
            cells = [txt for _, txt in sorted(grid[r])]
            out.lines.append(('  ' * depth) + '| ' + ' | '.join(cells) + ' |')
        return
    # 머리말·꼬리말·각주·글상자 등: 안의 문단을 모두 차례로(한 칸 들여)
    def walk(nodes):
        for g in cell_groups(nodes):
            render_paras(g['paras'], out, depth + 1)
        for k in nodes:
            if k.tag not in (PARA_HEADER, LIST_HEADER):
                walk(k.kids)
    walk(c.kids)


def read_hwp(path, tables=True, info=False):
    import olefile
    o = olefile.OleFileIO(path)
    head = o.openstream('FileHeader').read()
    if not head.startswith(b'HWP Document File'):
        sys.exit('HWP 5.x 문서가 아니다(서명 없음). 옛 HWP 3.0 이하일 수 있다.')
    ver, = struct.unpack_from('<I', head, 32); flags, = struct.unpack_from('<I', head, 36)
    compressed, password, distribute = bool(flags & 1), bool(flags & 2), bool(flags & 4)
    store = 'ViewText' if distribute else 'BodyText'
    sections = sorted((e for e in o.listdir() if e[0] == store and len(e) == 2), key=lambda e: int(re.sub(r'\D', '', e[1]) or 0))
    meta = {'판': f'{ver >> 24}.{(ver >> 16) & 255}.{(ver >> 8) & 255}.{ver & 255}', '압축': compressed, '암호': password,
            '배포용': distribute, '구역': len(sections), '스트림': ['/'.join(e) for e in o.listdir()]}
    if info:
        return meta, []
    if password:
        sys.exit('암호가 걸린 문서다. 암호 없이는 읽을 수 없다.')
    if not sections:
        sys.exit(f'{store} 구역이 없다. 스트림: ' + ', '.join(meta['스트림']))
    out = Out(tables)
    for e in sections:
        buf = o.openstream(e).read()
        if distribute:
            buf = view_text(buf)
        if compressed:
            buf = zlib.decompressobj(-15).decompress(buf)  # 배포용은 뒤에 AES 채움 바이트가 붙는다
        render_paras(tree(records(buf)), out, 0)
    return meta, out.lines


# ── HWPX ────────────────────────────────────────────────────────────────
def local(tag): return tag.rsplit('}', 1)[-1]


def read_hwpx(path, tables=True, info=False):
    z = zipfile.ZipFile(path)
    names = sorted((n for n in z.namelist() if re.match(r'Contents/section\d+\.xml$', n)), key=lambda n: int(re.sub(r'\D', '', n)))
    meta = {'구역': len(names), '파일': z.namelist()}
    if info:
        return meta, []
    lines = []

    def ptext(p):
        parts = []
        for el in p.iter():
            ln = local(el.tag)
            if ln == 't':
                parts.append(el.text or '')
                for sub in el:  # 탭·줄바꿈 같은 안쪽 요소 뒤 글
                    if local(sub.tag) == 'tab': parts.append('\t')
                    elif local(sub.tag) == 'lineBreak': parts.append('\n')
                    parts.append(sub.tail or '')
            elif ln == 'tbl':
                break
        return ''.join(parts)

    def walk_p(p, depth):
        # 표 안 문단의 글은 표에서 따로 적으니, 이 문단 자체의 run 글만(표 앞까지) 모은다
        own = []
        for run in p:
            if local(run.tag) != 'run':
                continue
            for el in run:
                ln = local(el.tag)
                if ln == 't':
                    own.append(ptext(el) if len(el) else (el.text or ''))
                elif ln == 'tbl':
                    if own and ''.join(own).strip():
                        lines.append('  ' * depth + ''.join(own)); own = []
                    walk_tbl(el, depth)
                elif ln in ('rect', 'ellipse', 'polygon', 'container', 'textart', 'pic', 'header', 'footer', 'footNote', 'endNote'):
                    for sp in el.iter():
                        if local(sp.tag) == 'subList':
                            for q in sp:
                                if local(q.tag) == 'p': walk_p(q, depth + 1)
        if ''.join(own).strip():
            lines.append('  ' * depth + ''.join(own))

    def cell_text(tc):
        sub = []
        for sl in tc:
            if local(sl.tag) == 'subList':
                for q in sl:
                    if local(q.tag) == 'p':
                        before = len(lines); walk_p(q, 0)
                        sub.extend(l.strip() for l in lines[before:] if l.strip()); del lines[before:]
        return sub

    def walk_tbl(tbl, depth):
        rows = [tr for tr in tbl if local(tr.tag) == 'tr']
        if not tables:
            for tr in rows:
                for tc in tr:
                    if local(tc.tag) == 'tc':
                        for l in cell_text(tc): lines.append('  ' * (depth + 1) + l)
            return
        lines.append('  ' * depth + f"[표 {tbl.get('rowCnt', len(rows))}×{tbl.get('colCnt', '?')}]")
        for tr in rows:
            cells = [' / '.join(' '.join(l.split()) for l in cell_text(tc)) for tc in tr if local(tc.tag) == 'tc']
            lines.append('  ' * depth + '| ' + ' | '.join(cells) + ' |')

    for n in names:
        root = ET.fromstring(z.read(n))
        for p in root:
            if local(p.tag) == 'p':
                walk_p(p, 0)
    return meta, lines


def main():
    ap = argparse.ArgumentParser(description='HWP·HWPX 글 뽑기(한컴오피스 없이)')
    ap.add_argument('file'); ap.add_argument('--out'); ap.add_argument('--정보', action='store_true', dest='info')
    ap.add_argument('--표없이', action='store_true', dest='notables')
    a = ap.parse_args()
    with open(a.file, 'rb') as f:
        magic = f.read(8)
    reader = read_hwpx if magic.startswith(b'PK') else read_hwp
    meta, lines = reader(a.file, tables=not a.notables, info=a.info)
    if a.info:
        for k, v in meta.items():
            print(f'{k}: {v}')
        return
    text = '\n'.join(lines) + '\n'
    if a.out:
        with open(a.out, 'w', encoding='utf-8', newline='\n') as f:
            f.write(text)
        print(f'{len(lines)}줄 → {a.out}', file=sys.stderr)
    else:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stdout.write(text)


if __name__ == '__main__':
    main()
