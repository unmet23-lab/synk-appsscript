#!/usr/bin/env python3
"""회사 DB 빈 칸 잔여 재기와 한 번 정리 — 쓰기 노드에서 root로 돈다(README).

scan   : 읽기 전용. DB 주인(uid)으로 낮춘 자식 프로세스가 읽는다(root가 -wal·-shm을 만들지 않게). 자식은 권한을 낮추기 전에
         자기만의 마운트 이름공간에서 DB 폴더를 /mnt에 다시 붙이고 그 경로로 읽는다 — 운영 DB 폴더의 위가 root 전용이다(owner_view).
         ① mode=ro 연결의 읽기 트랜잭션 하나에서 수·산 값·논리 스냅샷(serialize), ② 연결을 닫고 실제 DB·WAL 파일 바이트,
         ③ 새 연결에서 산 값 한 번 더. 빈 페이지·페이지 안 빈 칸·실제 파일의 페이지마다 문의 줄 표식("payload":" ·
         "replyDraft":")을 찾아 ①·③의 산 값과 대조한다. 숫자만 낸다(고객 글·초안·암호문·해시를 내지 않는다).
vacuum : 승인 뒤에만(scan.cjs가 승인 파일을 요구한다). 막는 조건을 본 뒤 컨테이너 안 node로 vacuum.mjs를 돌린다.
         vacuum.mjs가 VACUUM 바로 앞에서 READY를 내면 잠금·서비스를 다시 보고 GO나 STOP을 보낸다. 앞뒤로 scan을 낸다.
로컬: python3 free-space-node.py --db <company.sqlite>  (scan만, 호스트 정보·권한 낮추기 없이)
"""
import errno, json, os, posixpath, re, sqlite3, struct, subprocess, sys, threading, time

VACUUM_JS = None  # scan.cjs가 vacuum.mjs 내용으로 바꿔 보낸다
VIEW = '/mnt'  # 재는 자식만의 마운트 이름공간에서 DB 폴더를 붙이는 자리(호스트의 /mnt는 그대로다)
CLONE_NEWNS = 0x00020000
RELEASE_LOCKS = ('/run/lock/synk-ha-deploy.lock', '/var/lib/synk-company-ops/operations.lock')
BUSY = re.compile(r'backup|restore|dr|rearm|release|deploy|maintenance|disarm')
ONLINE_LIMIT = 120 << 20  # 이보다 큰 DB는 온라인 VACUUM을 하지 않는다(vacuum 참고)
B64 = set(b'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=')
PAYLOAD, DRAFT = b'"payload":"', b'"replyDraft":"'
WAL_MAGIC = (0x377f0682, 0x377f0683)


def sh(args, timeout=20, **kw):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, **kw)


def size(path):
    try:
        return os.path.getsize(path)
    except OSError:
        return None


READER = ("import sys\n"
          "for path in sys.argv[1:]:\n"
          "    try:\n"
          "        data = open(path, 'rb').read()\n"
          "    except FileNotFoundError:\n"
          "        data = b''\n"
          "    sys.stdout.buffer.write(len(data).to_bytes(8, 'big') + data)\n")


def read_files(paths):
    """파일 바이트를 다른 파이썬 프로세스가 읽어 넘긴다. 이 프로세스가 DB 파일을 따로 열었다 닫으면 열어 둔 SQLite 연결의
    POSIX 잠금이 같이 풀리기 때문이다(SQLite 「How To Corrupt」 2.2)."""
    run = subprocess.run([sys.executable, '-c', READER, *paths], capture_output=True, timeout=120)
    if run.returncode != 0:
        raise RuntimeError('RAW_READ_FAILED')
    chunks, pos = [], 0
    for _ in paths:
        length = int.from_bytes(run.stdout[pos:pos + 8], 'big')
        chunks.append(run.stdout[pos + 8:pos + 8 + length])
        pos += 8 + length
    return chunks


def file_marks(db):
    """DB·WAL 파일의 (크기, 수정 시각 ns). 커밋은 WAL에 프레임을 붙이고 체크포인트는 DB 파일을 쓴다."""
    found = []
    for path in (db, db + '-wal'):
        try:
            st = os.stat(path)
            found.append((st.st_size, st.st_mtime_ns))
        except FileNotFoundError:
            found.append(None)
    return found


def held_locks():
    """/proc/locks로만 본다 — 잠금을 잡지 않아 릴리스와 부딪히지 않는다(restore-drill.py와 같은 방법). 못 읽으면 None."""
    devices = {}
    for path in RELEASE_LOCKS:
        try:
            st = os.stat(path, follow_symlinks=False)
        except FileNotFoundError:
            continue
        devices[(os.major(st.st_dev), os.minor(st.st_dev), st.st_ino)] = os.path.basename(path)
    try:
        text = open('/proc/locks').read()
    except OSError:
        return None
    held = set()
    for line in text.splitlines():
        for token in line.split():
            m = re.fullmatch(r'([0-9a-f]+):([0-9a-f]+):([0-9]+)', token)
            key = m and (int(m.group(1), 16), int(m.group(2), 16), int(m.group(3)))
            if key in devices:
                held.add(devices[key])
    return sorted(held)


def busy_services():
    """이름에 backup·restore… 가 든 synk-* 서비스 가운데 도는 것. systemctl을 못 읽으면 None."""
    run = sh(['systemctl', 'list-units', 'synk-*', '--type=service', '--state=active,activating', '--no-legend', '--plain'])
    if run.returncode != 0:
        return None
    return sorted(name for name in (line.split()[0] for line in run.stdout.splitlines() if line.strip()) if BUSY.search(name))


def mem_available():
    try:
        for line in open('/proc/meminfo'):
            if line.startswith('MemAvailable:'):
                return int(line.split()[1]) * 1024
    except OSError:
        pass
    return None


def find_company():
    for name in sh(['docker', 'ps', '--format', '{{.Names}}']).stdout.split():
        try:
            info = json.loads(sh(['docker', 'inspect', name]).stdout)[0]
        except (ValueError, IndexError):
            continue
        for m in info.get('Mounts') or []:
            path = os.path.join(m.get('Source') or '', 'company.sqlite')
            if m.get('Destination') == '/data' and os.path.exists(path):
                env = (info.get('Config') or {}).get('Env') or []
                state = info.get('State') or {}
                return path, {'name': name, 'nodeVersion': next((e.split('=', 1)[1] for e in env if e.startswith('NODE_VERSION=')), None),
                              'running': state.get('Running'), 'health': (state.get('Health') or {}).get('Status'), 'startedAt': state.get('StartedAt')}
    return None, None


def last_backup():
    """정기 백업(synk-company-backup.service)의 마지막 결과와 끝난 시각(유닉스 초)."""
    out = sh(['systemctl', 'show', 'synk-company-backup.service', '--timestamp=unix', '-p', 'Result', '-p', 'ExecMainExitTimestamp']).stdout
    values = dict(x.split('=', 1) for x in out.splitlines() if '=' in x)
    stamp = values.get('ExecMainExitTimestamp', '')
    return {'result': values.get('Result'), 'endedAt': int(stamp[1:]) if stamp.startswith('@') and stamp[1:].isdigit() else None}


def host_facts(db):
    def free(path):
        try:
            v = os.statvfs(path)
            return {'free': v.f_bavail * v.f_frsize, 'total': v.f_blocks * v.f_frsize}
        except OSError:
            return None
    mem = {}
    for line in open('/proc/meminfo'):
        key, value = line.split(':', 1)
        if key in ('MemTotal', 'MemAvailable'):
            mem[key] = int(value.split()[0]) * 1024
    timer = sh(['systemctl', 'show', 'synk-company-backup.timer', '-p', 'NextElapseUSecRealtime', '-p', 'LastTriggerUSec']).stdout
    return {'locksHeld': held_locks(), 'busyServices': busy_services(), 'disk': {'data': free(os.path.dirname(db)), 'docker': free('/var/lib/docker')},
            'mem': mem, 'backupTimer': dict(x.split('=', 1) for x in timer.splitlines() if '=' in x), 'lastBackup': last_backup()}


def release_busy(locks, services):
    """못 읽은 것(None)도 막는다 — 모르는 채로 다시 쓰지 않는다."""
    if locks is None or locks:
        return 'RELEASE_LOCK_HELD'
    if services is None or services:
        return 'BACKGROUND_OPERATION_BUSY'
    return None


def string_end(seg, start):
    """start에서 시작한 JSON 문자열 값의 닫는 따옴표 자리. 역슬래시 다음 글자는 건너뛴다. 구역 안에 없으면(잘린 값) -1.
    길이 한도를 두지 않는다 — 초안은 6,000자(한글이면 18KB)까지라, 한도에서 끊으면 닫힌 값을 앞부분으로만 견주게 된다."""
    k, end = start, len(seg)
    while k < end:
        if seg[k] == 0x5c:
            k += 2
        elif seg[k] == 0x22:
            return k
        else:
            k += 1
    return -1


def page_regions(length, page):
    """(시작, 끝, 페이지 번호) — 파일을 페이지마다 자른다."""
    return [(a, min(a + page, length), a // page + 1) for a in range(0, length, page)]


def wal_regions(buf):
    """WAL 파일을 프레임의 페이지 그림 단위로 자른다(머리 32바이트, 프레임마다 머리 24바이트 + 페이지). 모르는 꼴이면 통째로."""
    if len(buf) < 32 or struct.unpack('>I', buf[:4])[0] not in WAL_MAGIC:
        return [(0, len(buf), 0)] if buf else []
    page = struct.unpack('>I', buf[8:12])[0]
    if page < 512 or page & (page - 1):
        return [(0, len(buf), 0)]
    regions, off = [], 32
    while off + 24 + page <= len(buf):
        regions.append((off + 24, off + 24 + page, struct.unpack('>I', buf[off:off + 4])[0]))
        off += 24 + page
    return regions


def wal_tail(buf):
    """마지막 완전한 프레임 뒤의 바이트(끊긴 쓰기의 덜 쓴 프레임). 칸 경계를 믿을 수 없어 따로 센다 — 표식이 하나라도 있으면
    정리가 끝났다고 보지 않는다(scan.cjs). 모르는 꼴의 WAL은 wal_regions가 통째로 세므로 꼬리가 없다."""
    if len(buf) < 32 or struct.unpack('>I', buf[:4])[0] not in WAL_MAGIC:
        return []
    page = struct.unpack('>I', buf[8:12])[0]
    if page < 512 or page & (page - 1):
        return []
    whole = 32 + (len(buf) - 32) // (24 + page) * (24 + page)
    return [(whole, len(buf))] if whole < len(buf) else []


def varint(buf, p):
    value = 0
    for i in range(8):
        byte = buf[p + i]
        value = (value << 7) | (byte & 0x7f)
        if byte < 0x80:
            return value, i + 1
    return (value << 8) | buf[p + 8], 9


def local_ranges(buf, a, b, number, usable):
    """테이블 잎 페이지(13)의 칸마다 본문이 이 페이지에 놓인 범위. 넘치는 칸은 넘침 페이지 번호(4바이트) 앞까지다 —
    산 긴 초안이 그 번호·다른 칸 바이트와 붙어 산 값과 어긋나지 않게."""
    head = a + (100 if number == 1 else 0)
    if b - a < 512 or head + 8 > b or buf[head] != 13:
        return []
    cells = struct.unpack('>H', buf[head + 3:head + 5])[0]
    most, least = usable - 35, ((usable - 12) * 32 // 255) - 23
    ranges = []
    for c in range(min(cells, (b - head - 8) // 2)):
        pointer = struct.unpack('>H', buf[head + 8 + 2 * c:head + 10 + 2 * c])[0]
        if pointer < 8 or a + pointer + 18 > b:
            continue
        payload, n1 = varint(buf, a + pointer)
        _, n2 = varint(buf, a + pointer + n1)
        start = a + pointer + n1 + n2
        if payload <= most:
            local = payload
        else:
            spill = least + (payload - least) % (usable - 4)
            local = spill if spill <= most else least
        ranges.append((start, min(start + local, b)))
    return ranges


def count(buf, regions, live_payload, live_draft, usable=None):
    """구역마다 문의 표식을 찾아 산 값과 대조한다. 닫힌 초안은 길이와 상관없이 그대로, 끝에서 잘린 초안은 앞부분으로 견준다.
    usable을 주면(페이지 단위 구역) 테이블 잎 페이지의 칸을 풀어, 칸 안의 초안은 그 칸이 이 페이지에 둔 본문 끝까지만 본다."""
    s = {'regions': 0, 'bytes': 0, 'nonzeroBytes': 0, 'markedRegions': 0, 'payloadLive': 0, 'payloadShort': 0, 'draftLive': 0, 'draftShort': 0}
    payload_residue, draft_residue = set(), set()
    for region in regions:
        a, b = region[0], region[1]
        seg = buf[a:b]
        s['regions'] += 1
        s['bytes'] += b - a
        nonzero = len(seg) - seg.count(0)
        s['nonzeroBytes'] += nonzero
        if not nonzero:
            continue
        cells = [(x - a, y - a) for (x, y) in local_ranges(buf, a, b, region[2], usable)] if usable and len(region) > 2 else []
        marked = seg.find(b'websiteInquiries') >= 0
        i = seg.find(PAYLOAD)
        while i >= 0:
            marked = True
            prefix = seg[i + len(PAYLOAD):i + len(PAYLOAD) + 24]
            if len(prefix) < 24 or any(c not in B64 for c in prefix):
                s['payloadShort'] += 1
            elif prefix in live_payload:
                s['payloadLive'] += 1
            else:
                payload_residue.add(prefix)
            i = seg.find(PAYLOAD, i + 1)
        i = seg.find(DRAFT)
        while i >= 0:
            marked = True
            j = i + len(DRAFT)
            # 산 칸 안이면 그 칸이 이 페이지에 둔 본문 끝까지만 본다(그 뒤는 넘침 번호·다른 칸).
            limit = next((y for (x, y) in cells if x <= i < y), len(seg))
            k = string_end(seg[:limit], j)
            if k >= 0:
                value = seg[j:k]
                if value in live_draft:
                    s['draftLive'] += 1
                elif value:
                    draft_residue.add(value)
            else:
                value = seg[j:limit]
                if len(value) < 12:
                    s['draftShort'] += 1
                elif any(d.startswith(value) for d in live_draft):
                    s['draftLive'] += 1
                else:
                    draft_residue.add(value)
            i = seg.find(DRAFT, i + 1)
        s['markedRegions'] += marked
    s['payloadResidue'], s['draftResidue'] = len(payload_residue), len(draft_residue)
    return s


def live_values(con):
    """지금 살아 있는 payload 앞 24자와 replyDraft(본문 JSON에 쓰인 꼴). 문의 줄에 한정하지 않는다 — 다른 종류(socialInbox 등)의
    같은 이름 칸이 잔여로 잘못 세지지 않게."""
    payload = {v[:24].encode() for (v,) in con.execute("select json_extract(body,'$.payload') from documents where json_type(body,'$.payload')='text'")}
    draft = {json.dumps(v, ensure_ascii=False)[1:-1].encode() for (v,) in con.execute("select json_extract(body,'$.replyDraft') from documents where json_type(body,'$.replyDraft')='text'")}
    return payload, draft


def free_and_inpage(data, page):
    """논리 스냅샷에서 빈 목록 페이지(트렁크의 남는 칸 + 잎 페이지 전체)와 b-tree 페이지 안 빈 칸(gap·freeblock)."""
    pages = len(data) // page
    free_pages, free_regions, trunk, guard = set(), [], struct.unpack('>I', data[32:36])[0], 0
    while trunk and guard <= pages and 1 <= trunk <= pages:
        off = (trunk - 1) * page
        nxt, leaves = struct.unpack('>II', data[off:off + 8])
        leaves = min(leaves, (page - 8) // 4)
        free_pages.add(trunk)
        free_regions.append((off + 8 + 4 * leaves, off + page))
        for k in range(leaves):
            leaf = struct.unpack('>I', data[off + 8 + 4 * k:off + 12 + 4 * k])[0]
            if 1 <= leaf <= pages:
                free_pages.add(leaf)
                free_regions.append(((leaf - 1) * page, leaf * page))
        trunk, guard = nxt, guard + 1
    in_page = []
    for number in range(1, pages + 1):
        if number in free_pages:
            continue
        off = (number - 1) * page
        head = off + (100 if number == 1 else 0)
        kind = data[head]
        if kind not in (2, 5, 10, 13):  # b-tree 페이지만(넘침 페이지는 산 칸의 일부)
            continue
        block, cells, content = struct.unpack('>HHH', data[head + 1:head + 7])
        gap = (head + (12 if kind in (2, 5) else 8) + 2 * cells, off + (content or 65536))
        if gap[1] > gap[0]:
            in_page.append(gap)
        seen = 0
        while block and seen < 1000 and block + 4 <= page:
            nxt, length = struct.unpack('>HH', data[off + block:off + block + 4])
            if length > 4 and block + length <= page:
                in_page.append((off + block + 4, off + block + length))
            block, seen = nxt, seen + 1
    return free_pages, free_regions, in_page


def scan(db, local=False):
    """한 시점의 논리 스냅샷과 실제 DB·WAL 파일에서 잔여를 센다. 운영에서는 as_owner로 DB 주인 권한으로 부른다."""
    started = time.time()
    # 앱이 DB를 열고 있을 때만 읽는다. 없는 -wal·-shm을 이 읽기가 만들지 않게(로컬 시험은 닫힌 DB도 읽는다).
    if not local and not (os.path.exists(db + '-wal') and os.path.exists(db + '-shm')):
        return {'error': 'WAL_SIDECARS_MISSING'}
    available = mem_available()
    heavy = 3 * ((size(db) or 0) + (size(db + '-wal') or 0))
    skip = sys.version_info < (3, 11) or (available is not None and heavy > available // 2)
    # 「조용한 한 번」을 다섯 번까지 기다린다. 연결 하나를 열어 둔 채 앞 읽기 트랜잭션(수·산 값·스냅숏)과 뒤 읽기 트랜잭션
    # (산 값) 사이에 실제 파일을 읽고, 그사이 다른 연결의 커밋이 없어야 한다(같은 연결의 data_version이 그대로 — WAL에 프레임을
    # 다 쓴 뒤 커밋을 공개하는 순간이 앞 스냅숏 뒤에 와도 잡힌다). DB·WAL 파일의 크기·수정 시각(체크포인트 포함)과 산 값도 같아야
    # 한다. 그사이 쓰기가 있으면 지워진 값이 산 값으로 숨거나, 다른 종류 쓰기가 페이지를 나눠 스냅숏에 없는 사본을 남길 수 있다.
    # 끝내 조용하지 않으면 changedDuringScan(판정 못 함).
    con = sqlite3.connect('file:' + db + '?mode=ro', uri=True, timeout=5, isolation_level=None)
    try:
        q = lambda sql: con.execute(sql).fetchone()[0]
        for attempt in range(1, 6):
            if attempt > 1:
                time.sleep(0.5)
            start_marks = file_marks(db)
            out = {'sqlite': sqlite3.sqlite_version, 'files': {'db': size(db), 'wal': size(db + '-wal')}}
            con.execute('BEGIN')  # 아래 수·산 값·스냅샷이 모두 한 읽기 트랜잭션에서
            version = q('PRAGMA data_version')
            out['pragma'] = {k: q('PRAGMA ' + k) for k in ('page_size', 'page_count', 'freelist_count', 'auto_vacuum', 'journal_mode')}
            out['rows'] = {'documents': q('select count(*) from documents'), 'kinds': q('select count(distinct kind) from documents')}
            out['inquiries'] = {'rows': q("select count(*) from documents where kind='websiteInquiries'"),
                                'test': q("select count(*) from documents where kind='websiteInquiries' and json_extract(body,'$.classification.isTest')=1"),
                                'erasures': q("select count(*) from documents where kind='websiteInquiryErasures'"),
                                'socialInboxWebsite': q("select count(*) from documents where kind='socialInbox' and json_extract(body,'$.source')='website-inquiry'")}
            if not skip:
                live = live_values(con)
                data = con.serialize()
            con.execute('COMMIT')
            if skip:
                out['residue'] = {'skipped': 'python<3.11 or memory'}
                return out
            # 실제 파일: 체크포인트 전에 DB 파일에 남은 옛 페이지와 WAL 프레임. 다른 프로세스가 읽는다 — 이 프로세스가 DB 파일을
            # 따로 열었다 닫으면 열어 둔 연결의 POSIX 잠금이 풀린다.
            raw_db, raw_wal = read_files([db, db + '-wal'])
            con.execute('BEGIN')
            later_version = q('PRAGMA data_version')
            later = live_values(con)
            con.execute('COMMIT')
            quiet = later_version == version and live == later and file_marks(db) == start_marks
            if quiet:
                break
    finally:
        con.close()
    page = struct.unpack('>H', data[16:18])[0]
    page = 65536 if page == 1 else page
    usable = page - data[20]
    free_pages, free_regions, in_page = free_and_inpage(data, page)
    # 논리 스냅샷의 구역은 그때(앞)의 산 값과, 실제 파일은 읽은 다음(뒤)의 산 값과 견준다.
    # freelist·inPage(빈 칸)의 Live는 산 줄의 사본이다 — 그 줄을 지우면 잔여가 된다. logical·dbFile·walFile은 페이지마다 잘라
    # 셈하고(넘침으로 이어지는 산 초안이 다른 페이지 바이트와 붙지 않게), Live는 산 칸 자체다.
    out['residue'] = {'pageSize': page, 'pages': len(data) // page, 'freePages': len(free_pages), 'attempts': attempt, 'changedDuringScan': not quiet,
                      'freelist': count(data, free_regions, *live),
                      'inPage': count(data, in_page, *live),
                      'logical': count(data, page_regions(len(data), page), *live, usable),
                      'dbFile': count(raw_db, page_regions(len(raw_db), page), *later, usable),
                      'walFile': count(raw_wal, wal_regions(raw_wal), *later, usable),
                      'walTorn': count(raw_wal, wal_tail(raw_wal), *later)}
    out['seconds'] = round(time.time() - started, 2)
    return out


def shared_mounts():
    """이 프로세스의 마운트 이름공간에서 전파 표시(shared:N·master:N)가 남은 마운트 자리. 모두 private이면 빈 목록, 못 읽으면 None.
    / 하나만 보지 않는다 — /mnt가 따로 마운트된 호스트에서는 그 마운트의 전파가 붙인 자리를 호스트로 퍼뜨린다."""
    try:
        found, seen = [], False
        for line in open('/proc/self/mountinfo'):
            fields = line.split()
            if len(fields) < 7 or '-' not in fields[6:]:
                continue
            seen = True
            if any(mark.startswith(('shared:', 'master:')) for mark in fields[6:fields.index('-', 6)]):
                found.append(fields[4])
        return found if seen else None
    except OSError:
        return None


def unshare_mounts():
    """이 프로세스만의 마운트 이름공간을 만든다(root). 운영 노드의 파이썬 3.11에는 os.unshare가 없어 libc를 부른다."""
    if hasattr(os, 'unshare'):
        os.unshare(os.CLONE_NEWNS)
        return
    import ctypes
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.unshare(CLONE_NEWNS) != 0:
        code = ctypes.get_errno()
        raise OSError(code, os.strerror(code))


def owner_view(db):
    """권한을 낮추기 전에(root) DB 폴더를 이 프로세스만의 마운트 이름공간에서 VIEW에 다시 붙이고, 낮춘 uid가 읽을 경로를 돌려준다.
    운영 DB 폴더는 위 두 마디(/srv/synk/recovery-final-…/prepared)가 root 전용(0700)이라 낮춘 uid는 원래 경로를 지나지 못한다.
    폴더를 열어 두고 fchdir로 상대 경로를 주는 것으로는 모자라다 — 파이썬 파일 읽기는 되지만 SQLite가 getcwd로 절대 경로를 만들어
    마디마다 lstat하므로(os_unix.c unixFullPathname, 3.40.1) 같은 자리에서 막힌다. 전파가 private이 된 것을 본 뒤에만 붙여 호스트
    마운트 표에는 아무것도 생기지 않고, 붙인 자리는 이 프로세스와 그 자식이 끝나면 이름공간과 함께 사라진다."""
    unshare_mounts()
    if sh(['mount', '--make-rprivate', '/']).returncode != 0:
        raise RuntimeError('MOUNT_PRIVATE_FAILED')
    # 한 마운트라도 아직 shared(또는 master)면 아래 bind가 호스트 이름공간으로 퍼지거나 받는다 — 붙이지 않고 멈춘다. 못 읽어도 멈춘다.
    still = shared_mounts()
    if still is None or still:
        raise RuntimeError('MOUNT_STILL_SHARED')
    # 노드의 리눅스 경로라 posixpath로 다룬다(윈도에서 도는 시험도 같은 값을 보게).
    if sh(['mount', '--bind', posixpath.dirname(db), VIEW]).returncode != 0:
        raise RuntimeError('VIEW_BIND_FAILED')
    return posixpath.join(VIEW, posixpath.basename(db))


def failure_code(error):
    """자식이 실패한 까닭 — 이 파일이 정한 이름(MOUNT_PRIVATE_FAILED 등)이나 errno 이름만 낸다(경로·글은 내지 않는다)."""
    if isinstance(error, RuntimeError) and error.args and re.fullmatch(r'[A-Z_]+', str(error.args[0])):
        return error.args[0]
    if isinstance(error, OSError) and error.errno:
        return errno.errorcode.get(error.errno)
    return None


def as_owner(fn, db):
    """fn(경로)을 DB 파일 주인(uid·gid)으로 낮춘 자식 프로세스에서 돌려 결과를 받는다. 자식은 권한을 낮추기 전에 owner_view로
    DB 폴더를 다시 붙이고 그 경로를 fn에 준다. fork가 없으면(로컬) fn(db) 그대로."""
    if not hasattr(os, 'fork'):
        return fn(db)
    st = os.stat(db)
    read_end, write_end = os.pipe()
    pid = os.fork()
    if pid == 0:
        code = 0
        try:
            os.close(read_end)
            view = owner_view(db)
            os.setgroups([])
            os.setgid(st.st_gid)
            os.setuid(st.st_uid)
            payload = json.dumps(fn(view), default=str).encode()
        except BaseException as error:
            payload, code = json.dumps({'error': 'SCAN_FAILED', 'type': type(error).__name__, 'code': failure_code(error)}).encode(), 1
        view = memoryview(payload)
        while view:
            view = view[os.write(write_end, view):]
        os._exit(code)
    os.close(write_end)
    chunks = []
    while True:
        chunk = os.read(read_end, 1 << 16)
        if not chunk:
            break
        chunks.append(chunk)
    os.close(read_end)
    os.waitpid(pid, 0)
    try:
        return json.loads(b''.join(chunks))
    except ValueError:
        return {'error': 'SCAN_OUTPUT_UNREADABLE'}


def json_line(stream):
    """'{'로 시작하는 다음 줄을 JSON으로. 끝이면 None."""
    for line in stream:
        if line.startswith('{'):
            try:
                return json.loads(line)
            except ValueError:
                return {'error': 'GARBLED_LINE'}
    return None


def vacuum(container, db):
    """막는 조건을 본 뒤 컨테이너 안 node로 vacuum.mjs를 돌린다. VACUUM 바로 앞 READY에서 잠금·서비스를 다시 본다."""
    if not VACUUM_JS:
        return {'error': 'VACUUM_SCRIPT_MISSING'}
    facts = host_facts(db)
    blocked = release_busy(facts['locksHeld'], facts['busyServices'])
    if blocked:
        return {'error': blocked, 'facts': facts}
    # 따로 사본을 만들지 않는다(사본도 빈 칸까지 담는다). 26시간 안에 끝난 정기 백업이 되돌릴 자리다.
    backup = facts['lastBackup']
    if backup['result'] != 'success' or not backup['endedAt'] or time.time() - backup['endedAt'] > 26 * 3600:
        return {'error': 'NO_RECENT_BACKUP', 'facts': facts}
    if not container.get('running') or container.get('health') != 'healthy':
        return {'error': 'COMPANY_NOT_HEALTHY', 'container': container}
    before = as_owner(scan, db)
    if before.get('error') or not before.get('pragma'):
        return {'error': 'SCAN_BEFORE_FAILED', 'facts': facts, 'before': before}
    # 크기는 논리 크기(page_count × page_size)로 잰다 — 체크포인트가 막혀 새 페이지가 WAL에 쌓이면 DB 파일보다 크다.
    # 앱 쓰기는 busy_timeout 5초까지 기다린다. 45MB가 0.5초였고 vacuum.mjs는 4초에서 끊는다. 120MB를 넘으면 따로 창을 잡는다.
    need = max(size(db) or 0, before['pragma']['page_count'] * before['pragma']['page_size']) + (size(db + '-wal') or 0)
    if need > ONLINE_LIMIT:
        return {'error': 'TOO_LARGE_FOR_ONLINE_VACUUM', 'needBytes': need, 'before': before}
    if (facts['disk']['data'] or {}).get('free', 0) < 3 * need + (64 << 20) or facts['mem'].get('MemAvailable', 0) < 4 * need + (256 << 20):
        return {'error': 'SPACE_LOW', 'facts': facts, 'needBytes': need}
    # vacuum.mjs도 앞 WAL을 비운 뒤(DB 파일이 논리 크기로 자란 뒤) 같은 상한을 다시 본다.
    proc = subprocess.Popen(['docker', 'exec', '-i', '-u', 'node', '-e', 'SYNK_FREE_SPACE_MAX_BYTES=' + str(ONLINE_LIMIT), container['name'],
                             'node', '--input-type=module', '-e', VACUUM_JS],
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    guard = threading.Timer(300, proc.kill)  # vacuum.mjs 자신이 단계마다 끝을 두지만, 부르는 쪽도 끝없이 기다리지 않는다
    guard.start()
    try:
        ready = json_line(proc.stdout)
        stop = None
        if ready and ready.get('ready'):
            # VACUUM 바로 앞에서 다시 본다 — 이 사이에 릴리스·백업이 시작했으면 STOP.
            stop = release_busy(held_locks(), busy_services())
            proc.stdin.write('STOP\n' if stop else 'GO\n')
            proc.stdin.flush()
            result = json_line(proc.stdout) or {'error': 'NO_RESULT'}
        else:
            result = ready or {'error': 'NO_READY'}
        proc.stdin.close()
        proc.wait(timeout=60)
        result = {**result, 'exit': proc.returncode, 'stoppedBy': stop, 'stderr': proc.stderr.read()[-300:]}
    except subprocess.TimeoutExpired:
        proc.kill()
        result = {'error': 'VACUUM_TIMEOUT', 'exit': None}
    finally:
        guard.cancel()
    return {'facts': facts, 'before': before, 'vacuum': result, 'after': as_owner(scan, db)}


def main(argv):
    if len(argv) >= 2 and argv[0] == '--db':
        return {'mode': 'local', **scan(argv[1], local=True)}
    mode = argv[0] if argv else 'scan'
    if mode not in ('scan', 'vacuum'):
        return {'error': 'USAGE'}
    if hasattr(os, 'nice'):
        os.nice(10)
    db, container = find_company()
    if not db:
        return {'mode': mode, 'hasDb': False}
    if mode == 'scan':
        return {'mode': mode, 'hasDb': True, 'container': container, 'facts': host_facts(db), **as_owner(scan, db)}
    return {'mode': mode, 'hasDb': True, 'container': container, **vacuum(container, db)}


if __name__ == '__main__':
    print(json.dumps(main([a for a in sys.argv[1:] if a != '-']), default=str))
