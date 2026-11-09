# 복원 묶음 — 노트북을 잃어도 되살릴 수 있게, 정기 백업이 없던 것을 유호님 공개키로 암호화해 구글 드라이브 두 계정에 둔다(2026-11-09 유호님 「이대로 만들어」).
# 평문은 디스크에 쓰지 않는다: tar → zstd → node 암호흐름.cjs(표준입력) → 임시 폴더의 .enc → 올리기 · 대조 → 임시 삭제. 비밀번호 · 토큰 값은 어디에도 찍지 않는다.
#
#   python -X utf8 -B tools/복원/암호묶음.py 전부                  매일 묶음 다섯(창고장부 · 비공개문서 · 작업기록 · 릴리스계보 · 대화기록)과 영수증
#   python -X utf8 -B tools/복원/암호묶음.py 열쇠                  열쇠만(바뀌었을 때만 실제로 만든다 — 30분 작업방식 회차가 부른다)
#   python -X utf8 -B tools/복원/암호묶음.py 작업방식 [--거울 <폴더>]  거울 저장소의 지금 판을 zip(unmet23) · 암호 zip(77yuhbs)으로
#   python -X utf8 -B tools/복원/암호묶음.py 목록 [<묶음>] [--이름]   올릴 양만 잰다(아무것도 올리지 않는다). --이름은 경로까지
#   python -X utf8 -B tools/복원/암호묶음.py 받기 <묶음…> --폴더 <곳>   77yuhbs에서 암호문을 받는다(새 노트북, 열쇠를 푼 뒤)
#   python -X utf8 -B tools/복원/암호묶음.py 풀기 <파일.tar.zst> --집 <폴더>   복호화된 묶음을 푼다. 이미 있는 파일은 건너뛴다(최신→과거 순으로 불러 최신이 이긴다)
#
# 목적지
#   unmet23  G:(구글 드라이브 데스크톱)로만 넣는다 — 서버의 clasp 열쇠가 읽지도 지우지도 못한다. 복사는 올라간 것이 아니다: 메타데이터(이름 · 크기 · md5)로
#            대조될 때까지 임시 조각과 장부를 그대로 두고, 48시간이 지나도 안 보이면 다시 넣고 알린다(11-09 GPT 설계 검토).
#   77yuhbs  API로 올리고 그 자리에서 md5를 대조한다. 11-08 사고(남의 전송 잠금을 기다리다 조용히 멈춤) 때문에 .drive-transfer.lock은 잡지 않는다.
# 휴대폰 핫스팟에서는 큰 올리기를 쉰다(열쇠만 작아서 그대로, 올리는 도중 옮겨 가면 그 자리에서 기다린다).
# 장부(상태/복원꾸러미/<묶음>/): 조각.jsonl(끝난 조각) · 파일상태.json(경로 → 크기 · 수정 시각 · 넣은 때 · 조각, 모든 목적지가 끝난 뒤에만 갱신) · 묶음.json.
# 열쇠 묶음은 온전한 판만 올린다: 읽지 못한 파일 · 못 걸은 폴더 · 필수 폴더 빔 · 20% 넘는 줄어듦이면 새 판을 만들지 않고 알린다(옛 판도 지우지 않는다). 새 판은 바뀌면 3시간 안에 만든다.
# 묶음마다 잠금을 잡아 겹치는 회차가 서로의 임시 조각을 지우지 않게 한다. 조각 끝에 파일별 sha256 목록을 넣어 풀 때 대조한다.
# 되살아난 옛 노트북: 작업방식.cjs가 push 거절을 보면 「다른PC가앞섬」 표식을 쓰고, 표식이 있으면 여기서는 아무것도 올리지 않는다.
# 시험: python -X utf8 -B tests/암호묶음.test.py
import argparse
import base64
import datetime as dt
import hashlib
import io
import json
import os
import re
import secrets
import shutil
import stat
import subprocess
import sys
import tarfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

CODE = Path(__file__).resolve().parent
sys.path.insert(0, str(CODE))
import 드라이브  # noqa: E402

REMOTE_ROOT = 'SYNK_복원'
EMAIL_5TB, EMAIL_20TB = 'unmet23@gmail.com', '77yuhbs@gmail.com'
PART_RAW_LIMIT = 4 << 30           # 조각 하나의 원문 상한(대화 기록 약 2.6GB 암호문)
KEYS_RAW_LIMIT = 300 << 20         # 열쇠 묶음이 이보다 크면 엉뚱한 것이 끌려온 것으로 본다
READ_WHOLE_LIMIT = 64 << 20        # 이보다 작은 파일은 먼저 다 읽어 머리에 실제 크기를 적는다(읽는 사이 바뀌어도 묶음이 안 깨진다)
G_MIN_FREE = 30 << 30              # 드라이브 데스크톱 캐시가 C:에 있다 — 이보다 빠듯하면 G: 복사를 미룬다
TEMP_MIN_FREE = 12 << 30
G_VERIFY_GRACE_HOURS = 48
G_WAIT_SMALL_BYTES = 64 << 20      # 작은 조각은 올라가기를 잠깐 기다려 본다
G_WAIT_TRIES, G_WAIT_SECONDS = 6, 20
SETTLE_TRIES, SETTLE_SECONDS = 15, 120  # 회차 끝에 G: 조각이 올라가기를 기다리는 시간(30분)
WHOLE_SHRINK_LIMIT = 0.2
WHOLE_DAILY_DAYS = 90
# 열쇠 새 판은 바뀌어도 3시간에 한 번만 만든다. `.claude.json` · 사용 기록처럼 몇 분마다 바뀌는 파일이 있어 첫 시간에 판이 셋 쌓였다(30판이 15시간치).
# 어떤 파일이 늘 바뀌는지 목록으로 가르면 진짜 열쇠를 빠뜨리게 되므로(11-09 GPT 검수) 시간으로만 막는다. 곧바로 올리려면 --지금.
WHOLE_MIN_HOURS = 3
OTHER_PC_MARKER = '다른PC가앞섬'
MANIFEST_DIR = '.synk-복원/조각목록/'
CREATE_NO_WINDOW = 0x08000000 if os.name == 'nt' else 0
# 뒤의 여섯 자리는 두 PC가 같은 초에 만들어도 이름이 안 겹치게 한다(11-09 첫 판 조각에는 없다).
PART_NAME = re.compile(r'^(?P<bundle>.+)-(?P<at>\d{8}T\d{6}Z)-(?P<seq>\d{3})(?:-[0-9a-f]{6})?\.tar\.zst\.enc$')
DATED_ZIP = re.compile(r'^작업방식-(\d{8})\.zip$')
DATED_ENC = re.compile(r'^작업방식-(\d{8})\.zip\.enc$')
SKIP_DIR_NAMES = {'node_modules', '__pycache__', '.venv', 'venv', '.git', 'cache', 'Cache'}
SKIP_NAMES = re.compile(r'(\.lock|\.tmp|\.part|\.pid)$', re.I)
SECRET_LIKE_GLOBS = ('**/.env', '**/.env.*', '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx', '**/.clasprc.json', '**/.clasp.json',
                     '**/drive-storage.json', '**/*credential*.json', '**/*secret*.json', '**/*token*.json')
SECRET_LIKE_SKIP = ('**/node_modules/**', '**/.git/**', '.tmp/**', '.claude/worktrees/**', '.codex/worktrees/**',
                    '**/dist/**', '**/build/**', '**/models/**', '**/*.example', '**/*tokenizer*')


def utcnow():
    return dt.datetime.now(dt.timezone.utc)


def stamp(moment=None):
    return (moment or utcnow()).isoformat(timespec='seconds').replace('+00:00', 'Z')


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f'{path.name}.{uuid.uuid4().hex}.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=1), encoding='utf-8', newline='\n')
    os.replace(tmp, path)


def read_json(path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8-sig'))
    except (OSError, ValueError):
        return default


def is_reparse(entry_stat):
    return bool(getattr(entry_stat, 'st_file_attributes', 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT)


def is_cloud_only(entry_stat):
    # OFFLINE · RECALL_ON_OPEN · RECALL_ON_DATA_ACCESS — 읽으면 내려받기가 시작된다.
    return bool(getattr(entry_stat, 'st_file_attributes', 0) & (0x1000 | 0x40000 | 0x400000))


def error_code(error):
    return str(error).split(':')[0] if isinstance(error, RuntimeError) else type(error).__name__


class BundleBusy(Exception):
    pass


class BundleLock:
    """묶음마다 한 회차만. 프로세스가 죽으면 운영체제가 풀어 주는 잠금이라 주인 없는 잠금이 안 남는다."""

    def __init__(self, path):
        self.path = Path(path)
        self.handle = None

    def __enter__(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.handle = open(self.path, 'a+b')
        try:
            if os.name == 'nt':
                import msvcrt
                self.handle.seek(0)
                msvcrt.locking(self.handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.handle.close()
            self.handle = None
            raise BundleBusy(str(self.path)) from None
        return self

    def __exit__(self, *_):
        if self.handle:
            try:
                if os.name == 'nt':
                    import msvcrt
                    self.handle.seek(0)
                    msvcrt.locking(self.handle.fileno(), msvcrt.LK_UNLCK, 1)
            except OSError:
                pass
            self.handle.close()
            self.handle = None


@dataclass
class Root:
    path: Path
    skip_dirs: tuple = ()       # 뿌리 기준 상대 경로 또는 어디서든 걸리는 폴더 이름
    skip_files: object = None   # 정규식
    only_files: object = None   # 정규식(이것만)
    max_file: int = 0           # 0이면 제한 없음
    follow_top: bool = False    # 뿌리 자체가 junction이어도 따라간다(그 아래 링크는 안 따라간다)
    required: bool = False      # 없거나 비면 문제로 친다(열쇠 묶음이 조용히 줄어들지 않게)


@dataclass
class Bundle:
    name: str
    mode: str                   # whole | incremental
    dests: tuple
    roots: list = field(default_factory=list)
    keep: int = 0               # whole: 남길 판 수
    quiet: int = 0              # incremental: 이 초 안에 바뀐 파일은 다음 회차로
    force_after: int = 0        # incremental: 조용하지 않아도 처음 본 때 · 마지막으로 넣은 때에서 이 초가 지나면 넣는다
    dynamic: object = None      # 집을 받아 더 넣을 Root 목록을 주는 함수
    generated: object = None    # 집을 받아 {arcname: bytes}를 주는 함수(파일로 안 쓴다)


def repo_secret_roots(home):
    """저장소 안 git 밖 비밀 꼴 파일(.env · 암호화 키 · Drive 연결). 이름만 보고 고른다. 값은 묶음으로 바로 암호화된다."""
    docs = home / 'Documents'
    found = []
    rg = shutil.which('rg')
    for repo in ('SYNK-appsscript', 'SYNK-talk', 'SYNK-website', 'synk-policy'):
        base = docs / repo
        if not base.is_dir() or not rg:
            continue
        args = [rg, '--files', '--hidden', '--no-ignore']
        for g in SECRET_LIKE_GLOBS:
            args += ['-g', g]
        for g in SECRET_LIKE_SKIP:
            args += ['-g', '!' + g]
        args.append('.')
        try:
            out = subprocess.run(args, cwd=base, capture_output=True, timeout=120, creationflags=CREATE_NO_WINDOW).stdout
        except (OSError, subprocess.SubprocessError):
            continue
        for line in out.decode('utf-8', 'replace').splitlines():
            found.append(Root(base / line.strip(), max_file=2 << 20))
    return found


def excluded_roots(home, kind):
    """작업방식.cjs가 평문에서 뺀 파일. 비밀 꼴은 열쇠로, 내장 미디어 등은 작업 기록으로 간다."""
    rows = read_json(state_root(home) / '작업방식_제외.json', {}) or {}
    return [Root(Path(row['source'])) for row in rows.get('파일', []) if row.get('갈곳') == kind and row.get('source')]


def lineage_roots(home):
    """.tmp/_정리제외.txt에 적힌 계보 폴더(tools/tmp정리목록.js가 지우지 않는 곳)."""
    tmp = home / 'Documents' / 'SYNK-appsscript' / '.tmp'
    try:
        names = (tmp / '_정리제외.txt').read_text(encoding='utf-8').splitlines()
    except OSError:
        return []
    roots = []
    for name in names:
        name = name.strip()
        if name and not name.startswith('#') and '/' not in name and '\\' not in name and name not in ('.', '..'):
            roots.append(Root(tmp / name))
    return roots


def user_environment(home):
    """사용자 환경 변수(값에 비밀이 있을 수 있어 열쇠 묶음에만). 파일로 쓰지 않는다."""
    if os.name != 'nt' or os.environ.get('SYNK_복원_집'):
        return {}
    import winreg
    values = {}
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment') as key:
        for i in range(winreg.QueryInfoKey(key)[1]):
            name, value, kind = winreg.EnumValue(key, i)
            values[name] = {'값': value, '종류': kind}
    return {'.synk-복원/환경변수.json': json.dumps(values, ensure_ascii=False, indent=1, sort_keys=True).encode('utf-8')}


def define_bundles(home):
    docs, local = home / 'Documents', home / 'AppData' / 'Local'
    vault = docs / 'SYNK_원본창고'
    onedrive = home / 'OneDrive' / 'SYNK' / '시스템'
    claude_data = local / 'Claude-Data' / 'claude_pzs8sxrjxfjjc'
    small = 2 << 20
    config_skip = ('node_modules', 'bin', 'bundled', 'logs', 'sessions', 'downloads', 'worktrees', 'installed-plugins')
    return {b.name: b for b in [
        Bundle('열쇠', 'whole', ('unmet23', '77yuhbs'), keep=30, roots=[
            Root(home / 'SYNK_보안', required=True), Root(home / '.ssh', required=True), Root(home / '.synk-backup-key', required=True),
            Root(home / '.synk-drive-77yuhbs', required=True), Root(home / '.synk-server-drive', max_file=small),
            Root(home / '.clasprc.json'), Root(home / '.synk-vertex-oauth.json'), Root(home / '.synk-vertex-oauth.77yuhbs.json'),
            Root(home / '.gitconfig'), Root(home / '.claude.json', max_file=16 << 20),
            Root(home / '.synk' / 'telegram-mtproto', max_file=small, skip_dirs=config_skip), Root(home / '.synk' / 'atlas-dating'),
            Root(home / '.config', max_file=small, skip_dirs=config_skip), Root(home / '.supabase', max_file=small, skip_dirs=('traces',)),
            Root(home / '.codex' / 'auth.json'), Root(home / '.codex' / 'config.toml'), Root(home / '.codex' / 'secrets'),
            Root(home / '.codex' / '.sandbox-secrets'),
            Root(home / '.codex-bake', max_file=small, follow_top=True, skip_dirs=config_skip + ('generated_images', 'skills', 'memories', 'archived_sessions', 'plugins', 'vendor_imports'), only_files=re.compile(r'(^|[\\/])(계정\.json|auth\.json|config\.toml)$')),
            Root(home / '.ai-accounts' / 'codex-synk.yuh', max_file=small, skip_dirs=config_skip, only_files=re.compile(r'(^|[\\/])(auth\.json|config\.toml)$')),
            Root(home / '.ai-accounts' / 'higgsfield-founder'), Root(home / '.ai-accounts' / 'higgsfield-unmet23'), Root(home / '.ai-accounts' / 'typecast-unmet23'),
            Root(home / '.ai-accounts' / 'claude-unmet23', max_file=small, skip_dirs=config_skip + ('projects', 'file-history', 'shell-snapshots', 'telemetry', 'plugins', 'skills', 'cache', 'statsig', 'todos', 'paste-cache'), only_files=re.compile(r'[^\\/]+\.json$')),
            Root(home / '.grok' / 'auth.json'), Root(home / '.grok' / 'config.toml'), Root(home / '.agy-77yuhbs', max_file=small),
            Root(home / '.gemini' / 'antigravity-cli', max_file=small, only_files=re.compile(r'(^|[\\/])(antigravity-oauth-token|settings\.json|installation_id)$')),
            Root(home / '.cache' / 'huggingface' / 'token'), Root(home / '.cache' / 'huggingface' / 'stored_tokens'),
            Root(home / '.hf77home', max_file=small, skip_dirs=config_skip + ('AppData',)), Root(home / '.hffounderhome', max_file=small, skip_dirs=config_skip + ('AppData',)),
            Root(local / 'Packages' / 'Claude_pzs8sxrjxfjjc' / 'LocalCache' / 'Roaming' / 'postgresql'), Root(home / 'AppData' / 'Roaming' / 'postgresql'),
            Root(state_root(home) / '보호'),
        ], dynamic=lambda h: repo_secret_roots(h) + excluded_roots(h, '열쇠'), generated=user_environment),
        Bundle('비공개문서', 'incremental', ('unmet23', '77yuhbs'), quiet=600, roots=[
            Root(docs / 'SYNK-보관함'), Root(docs / '메일정리'), Root(docs / '모두의창업_적격검토_20261001'), Root(docs / '본인서류_사본'),
            Root(docs / 'yuhobuilds-voice'), Root(docs / 'Last30Days'), Root(docs / 'Codex'), Root(docs / 'SYNK-backups'),
            Root(docs / 'SYNK이전_미커밋보존'), Root(home / 'SYNK이전_인계'),
        ]),
        Bundle('창고장부', 'incremental', ('unmet23', '77yuhbs'), quiet=600, roots=[
            # 복원꾸러미 장부도 넣는다: 파일상태.json이 「어느 파일이 어느 조각에 있나」의 색인이고, 새 노트북이 처음부터 다시 올리지 않게 한다.
            Root(vault / '상태', skip_dirs=('OneDrive', '예약실행', '보호'), skip_files=re.compile(r'(read-cache|\.tmp$|작업방식_캐시|' + OTHER_PC_MARKER + r'$)')),
            Root(vault, skip_dirs=tuple(p.name for p in vault.iterdir() if p.is_dir()) if vault.is_dir() else (),
                 only_files=re.compile(r'[^\\/]*(복원목록|-status|복원안전목록|backup-health)[^\\/]*\.json$')),
        ]),
        # 커밋 전 소스 · 작업트리에만 있는 고침: OneDrive 예약이 안전 검사를 거쳐 모아 둔 사본을 그대로 잠가 보낸다(평문 층은 md만이라 소스가 빠진다, 11-09 GPT 설계 검토).
        Bundle('작업기록', 'incremental', ('77yuhbs',), quiet=600, roots=[
            Root(vault / '작업문서_미통합_자동'), Root(vault / '작업문서_미통합_20261018'),
            Root(vault / '문서_안전사본_자동'), Root(vault / '문서_안전사본_20261018'),
            *[Root(onedrive / name) for name in ('SYNK-appsscript', 'SYNK-talk', 'SYNK-website', 'synk-tips', 'claude-session-share', 'SYNK-LoRA',
                                                 'SYNK-talk-judge7', 'talk-wt-path-20261019', 'Videos', '개인작업규칙')],
        ], dynamic=lambda h: excluded_roots(h, '작업기록')),
        # .tmp 전체(129GiB)는 안 넣지만, 회사 릴리스 사슬이 경로로 따라가는 계보 폴더만은 넣는다(11-09 실측 148곳 8.4GiB) — 없으면 새 노트북에서 다음 판을 못 만든다.
        Bundle('릴리스계보', 'incremental', ('77yuhbs',), quiet=3600, dynamic=lineage_roots),
        Bundle('대화기록', 'incremental', ('77yuhbs',), quiet=3 * 3600, force_after=72 * 3600, roots=[
            # 메모 폴더는 작업 방식 층이 맡고, memory_보관_*.zip은 평문 층에 안 올리므로 여기로 온다.
            Root(home / '.claude' / 'projects', skip_dirs=('memory',)),
            Root(home / '.claude' / 'history.jsonl'),
            Root(claude_data / 'claude-code-sessions'), Root(claude_data / 'side-session-notes'), Root(claude_data / 'local-agent-mode-sessions'),
            Root(claude_data / 'ccd-session-presets.json'), Root(claude_data / 'claude_desktop_config.json'), Root(claude_data / 'config.json'),
            Root(claude_data / 'git-worktrees.json'), Root(claude_data / 'ccd-ids.json'),
            Root(home / '.codex' / 'archived_sessions'), Root(home / '.codex' / 'sessions'), Root(home / '.codex' / 'session_index.jsonl'),
        ]),
    ]}


DAILY = ('창고장부', '비공개문서', '작업기록', '릴리스계보', '대화기록')  # 열쇠는 30분 회차가 맡는다(두 예약이 겹치지 않게)


def state_root(home):
    return home / 'Documents' / 'SYNK_원본창고' / '상태' / '복원꾸러미'


def walk_root(root, home, problems=None):
    """(절대 경로, arcname, 크기, 수정 시각 ns). junction · 심볼릭 링크 · 클라우드 자리표시자는 따라가지 않는다.
    사라진 파일은 정상이고, 그 밖에 못 읽은 곳은 problems에 센다(조용히 빠지면 줄어든 묶음을 온전한 판으로 치게 된다)."""
    def note(error):
        if problems is not None and not isinstance(error, FileNotFoundError):
            problems.append(type(error).__name__)

    base = Path(root.path)
    try:
        rel_base = base.relative_to(home)
    except ValueError:
        return  # 집 밖은 묶음에 넣지 않는다(풀 자리가 없다)
    try:
        top = os.stat(base, follow_symlinks=False)
    except OSError as error:
        note(error)
        return
    real = base
    if is_reparse(top):
        if not root.follow_top:
            return
        real = Path(os.path.realpath(base))  # D:로 옮긴 폴더(11-07 junction) — 맨 위만 따라가고 arcname은 원래 자리 그대로다
        try:
            top = os.stat(real, follow_symlinks=False)
        except OSError as error:
            note(error)
            return

    def accept(path, st):
        if root.max_file and st.st_size > root.max_file:
            return False
        name = path.name
        if SKIP_NAMES.search(name):
            return False
        if root.skip_files and root.skip_files.search(path.as_posix()):
            return False
        if root.only_files and not root.only_files.search(path.as_posix()):
            return False
        return not is_cloud_only(st)

    if stat.S_ISREG(top.st_mode):
        if accept(base, top):
            yield base, rel_base.as_posix(), top.st_size, top.st_mtime_ns
        return
    stack = [real]
    while stack:
        here = stack.pop()
        try:
            entries = list(os.scandir(here))
        except OSError as error:
            note(error)
            continue
        for entry in entries:
            path = Path(entry.path)
            try:
                st = entry.stat(follow_symlinks=False)
            except OSError as error:
                note(error)
                continue
            if is_reparse(st) or entry.is_symlink():
                continue
            if entry.is_dir(follow_symlinks=False):
                rel = path.relative_to(real).as_posix()
                if entry.name in SKIP_DIR_NAMES or entry.name in root.skip_dirs or rel in root.skip_dirs:
                    continue
                stack.append(path)
            elif entry.is_file(follow_symlinks=False) and accept(path, st):
                yield path, (rel_base / path.relative_to(real)).as_posix(), st.st_size, st.st_mtime_ns


def select(bundle, home, problems=None):
    seen = {}
    roots = list(bundle.roots) + (bundle.dynamic(home) if bundle.dynamic else [])
    for root in roots:
        count = 0
        for path, arc, size, mtime in walk_root(root, home, problems):
            seen.setdefault(arc, (path, arc, size, mtime))
            count += 1
        if root.required and not count and problems is not None:
            problems.append('REQUIRED_ROOT_EMPTY')
    return [seen[k] for k in sorted(seen)]


class Exact:
    """tar 머리에 적은 크기만큼 꼭 내주는 읽기. 큰 파일이 읽는 사이 줄어들면 0으로 채워 묶음이 깨지지 않게 하고 short를 세운다(그 파일은 장부에 안 적혀 다음 회차가 다시 넣는다)."""

    def __init__(self, fh, size):
        self.fh, self.left, self.short = fh, size, False
        self.hash = hashlib.sha256()

    def read(self, n=-1):
        n = self.left if n is None or n < 0 else min(n, self.left)
        if n <= 0:
            return b''
        block = self.fh.read(n) or b''
        while len(block) < n:  # tarfile은 요청한 만큼 안 오면 멈춘다 — 끝까지 채운다
            more = self.fh.read(n - len(block))
            if not more:
                self.short = True
                block += b'\0' * (n - len(block))
                break
            block += more
        self.left -= n
        self.hash.update(block)
        return block


class Temp:
    def __init__(self, home):
        self.home = home

    def root(self):
        override = os.environ.get('SYNK_복원_임시')
        candidates = [Path(override)] if override else [Path('D:/SYNK_복원대기'), self.home / 'AppData' / 'Local' / 'Temp' / 'SYNK_복원대기']
        for candidate in candidates:
            try:
                anchor = Path(candidate.anchor or candidate)
                if not anchor.exists():
                    continue
                if shutil.disk_usage(anchor).free >= TEMP_MIN_FREE or override:
                    candidate.mkdir(parents=True, exist_ok=True)
                    return candidate
            except OSError:
                continue
        raise RuntimeError('BUNDLE_TEMP_NO_SPACE')


class Ledger:
    def __init__(self, home, name):
        self.dir = state_root(home) / name
        self.dir.mkdir(parents=True, exist_ok=True)
        self.state_file, self.parts_file = self.dir / '파일상태.json', self.dir / '조각.jsonl'
        self.meta_file = self.dir / '묶음.json'
        self.files = read_json(self.state_file, {}) or {}
        self.meta = read_json(self.meta_file, {}) or {}

    def append(self, row):
        with self.parts_file.open('a', encoding='utf-8', newline='\n') as out:
            out.write(json.dumps(row, ensure_ascii=False) + '\n')

    def parts(self):
        try:
            return [json.loads(line) for line in self.parts_file.read_text(encoding='utf-8').splitlines() if line.strip()]
        except (OSError, ValueError):
            return []

    def commit(self, rows, now, part_name):
        seen = self.meta.get('처음본때') or {}
        for arc, size, mtime in rows:
            self.files[arc] = [size, mtime, now, part_name]
            seen.pop(arc, None)
        write_json(self.state_file, self.files)
        if seen or '처음본때' in self.meta:
            self.meta['처음본때'] = seen
            self.save_meta()

    def save_meta(self):
        write_json(self.meta_file, self.meta)


def changed_files(files, ledger, bundle, now):
    """장부와 다른 파일만. 조용한 시간 안에 바뀐 파일은 미루되, 처음 본 때 또는 마지막으로 넣은 때에서 force_after가 지났으면 넣는다."""
    picked, deferred = [], 0
    seen = ledger.meta.setdefault('처음본때', {})
    for row in files:
        _, arc, size, mtime = row
        known = ledger.files.get(arc)
        if known and known[0] == size and known[1] == mtime:
            continue
        age = now - mtime / 1e9
        if bundle.quiet and age < bundle.quiet:
            since = known[2] if known and len(known) > 2 else seen.setdefault(arc, now)
            if not (bundle.force_after and now - since >= bundle.force_after):
                deferred += 1
                continue
        picked.append(row)
    return picked, deferred


def batches(rows, limit=PART_RAW_LIMIT):
    batch, raw = [], 0
    for row in rows:
        if batch and raw + row[2] > limit:
            yield batch
            batch, raw = [], 0
        batch.append(row)
        raw += row[2]
    if batch:
        yield batch


def node_path():
    return shutil.which('node') or 'node'


def open_retry(path, tries=3, wait=0.5):
    for attempt in range(tries):
        try:
            return open(path, 'rb')
        except OSError:
            if attempt == tries - 1:
                raise
            time.sleep(wait)


def seal(rows, generated, out, public_key=None):
    """rows를 tar → zstd → 암호문으로. (암호화 결과, 온전히 담은 줄, 못 담은 이름들)을 준다. 조각 끝에 파일별 sha256 목록을 넣는다."""
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    args = [node_path(), str(CODE / '암호흐름.cjs'), str(out), out.name[:-4]]
    if public_key:
        args += ['--공개키', str(public_key)]
    proc = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=CREATE_NO_WINDOW)
    captured, skipped = [], []
    errors = []
    manifest = []

    def drain(stream, into):
        into.append(stream.read())
    outputs, error_output = [], []
    threads = [threading.Thread(target=drain, args=(proc.stdout, outputs), daemon=True),
               threading.Thread(target=drain, args=(proc.stderr, error_output), daemon=True)]
    for t in threads:
        t.start()
    try:
        with tarfile.open(fileobj=proc.stdin, mode='w|zst', format=tarfile.PAX_FORMAT) as tar:
            for arc, data in (generated or {}).items():
                info = tarfile.TarInfo(arc)
                info.size, info.mtime, info.mode = len(data), int(time.time()), 0o600
                tar.addfile(info, io.BytesIO(data))
                manifest.append([arc, len(data), hashlib.sha256(data).hexdigest()])
            for path, arc, size, mtime in rows:
                try:
                    fh = open_retry(path)
                except OSError:
                    skipped.append(arc)
                    continue
                with fh:
                    info = tarfile.TarInfo(arc)
                    info.mtime, info.mode = mtime / 1e9, 0o600
                    if size <= READ_WHOLE_LIMIT:
                        try:
                            data = fh.read()
                        except OSError:
                            skipped.append(arc)
                            continue
                        info.size = len(data)
                        tar.addfile(info, io.BytesIO(data))
                        digest, short = hashlib.sha256(data).hexdigest(), False
                        real_size = len(data)
                    else:
                        info.size = size
                        exact = Exact(fh, size)
                        tar.addfile(info, exact)
                        digest, short, real_size = exact.hash.hexdigest(), exact.short, size
                if short:
                    skipped.append(arc)
                    manifest.append([arc, real_size, None])  # 풀 때 이 파일은 버리고 더 옛 조각에서 찾는다
                else:
                    manifest.append([arc, real_size, digest])
                    captured.append((arc, size, mtime))
            body = json.dumps(manifest, ensure_ascii=False).encode('utf-8')
            info = tarfile.TarInfo(MANIFEST_DIR + out.name[:-len('.tar.zst.enc')] + '.json')
            info.size, info.mtime, info.mode = len(body), int(time.time()), 0o600
            tar.addfile(info, io.BytesIO(body))
    except (OSError, ValueError, tarfile.TarError) as error:
        errors.append(type(error).__name__)
    try:
        proc.stdin.close()
    except OSError:
        pass
    code = proc.wait()
    for t in threads:
        t.join(timeout=30)
    proc.stdout.close()
    proc.stderr.close()
    if code != 0 or errors:
        out.unlink(missing_ok=True)
        raise RuntimeError('BUNDLE_SEAL_FAILED')
    info = json.loads(outputs[0].decode('utf-8'))
    return info, captured, skipped


class UnmetG:
    """unmet23 — 구글 드라이브 데스크톱. 넣기만 G:로 하고 대조는 clasp 메타데이터로 한다. 복사만으로는 끝난 것이 아니다."""
    needs_confirm = True

    def __init__(self, root, drive_factory=None):
        self.root = Path(root)
        self.drive_factory = drive_factory
        self.drive = None

    def mounted(self):
        return self.root.parent.is_dir()

    def has_room(self):
        try:
            return shutil.disk_usage(Path(os.environ.get('SystemDrive', 'C:') + '\\')).free >= G_MIN_FREE
        except OSError:
            return False

    def put(self, path, folder, name=None):
        if not self.mounted():
            raise RuntimeError('UNMET23_G_NOT_MOUNTED')
        if not self.has_room():
            raise RuntimeError('UNMET23_G_LOW_SPACE')
        target = self.root / folder / (name or Path(path).name)
        target.parent.mkdir(parents=True, exist_ok=True)
        partial = target.with_name(target.name + '.part')
        shutil.copyfile(path, partial)
        os.replace(partial, target)
        return None

    def metadata(self, folder):
        if self.drive is None:
            self.drive = self.drive_factory() if self.drive_factory else None
        if self.drive is None:
            return None
        parent = self.drive.folder(REMOTE_ROOT, folder, make=False)
        return {f['name']: f for f in self.drive.children(parent)} if parent else {}

    def confirm(self, folder, name, md5, size):
        """올라갔으면 True, 아직이면 False, 잴 수 없으면 None."""
        try:
            remote = self.metadata(folder)
        except (OSError, RuntimeError):
            return None
        if remote is None:
            return None
        found = remote.get(name)
        return bool(found and int(found.get('size') or -1) == size and found.get('md5Checksum') == md5)

    def listing(self, folder):
        base = self.root / folder
        try:
            return sorted(p.name for p in base.iterdir() if p.is_file())
        except OSError:
            return []

    def remove(self, folder, name):
        (self.root / folder / name).unlink(missing_ok=True)  # 드라이브 데스크톱이 휴지통으로 보낸다


class Yuhbs:
    """77yuhbs — API. 올리면서 md5를 대조하므로 끝나면 끝난 것이다."""
    needs_confirm = False

    def __init__(self, drive):
        self.drive = drive
        self.checked = False

    def ready(self):
        if not self.checked:
            self.drive.check_account()
            self.checked = True

    def folder(self, name, make=True):
        self.ready()
        return self.drive.folder(REMOTE_ROOT, name, make=make)

    def put(self, path, folder, name=None):
        parent = self.folder(folder)
        name = name or Path(path).name
        same = self.drive.children(parent, name)
        md5, _ = 드라이브.file_hashes(path)
        for f in same:
            if f.get('md5Checksum') == md5:
                return f['id']  # 끊긴 뒤 다시 돌 때 같은 내용을 또 올리지 않는다
        finished, _, _ = self.drive.upload(path, parent, name)
        return finished['id']

    def replace(self, path, folder, name):
        parent = self.folder(folder)
        same = self.drive.children(parent, name)
        if len(same) > 1:
            raise RuntimeError('DRIVE_DUPLICATE_FILE')
        finished, _, _ = self.drive.upload(path, parent, name, file_id=same[0]['id'] if same else None)
        return finished['id']

    def listing(self, folder):
        parent = self.folder(folder, make=False)
        return sorted(f['name'] for f in self.drive.children(parent)) if parent else []

    def remove(self, folder, name):
        parent = self.folder(folder, make=False)
        if parent:
            for f in self.drive.children(parent, name):
                self.drive.trash(f['id'])


@dataclass
class Context:
    home: Path
    temp: Temp
    unmet23: object
    yuhbs: object
    stop_file: Path = None
    public_key: Path = None
    log: object = print
    sleep: object = time.sleep
    hold: object = None         # 참이면 새 조각을 만들지 않는다(휴대폰 핫스팟)
    allow_shrink: bool = False  # --줄어듦허용: 열쇠를 일부러 크게 줄였을 때만
    force_now: bool = False     # --지금: 열쇠를 막 바꿔 3시간을 안 기다리고 올릴 때

    def dest(self, name):
        return self.unmet23 if name == 'unmet23' else self.yuhbs

    def stopped(self):
        return bool((self.stop_file and self.stop_file.exists()) or (self.hold and self.hold()))


def deliver(ctx, bundle, part, sidecar):
    """임시 조각을 목적지마다 올린다. 사이드카에 목적지별 결과를 적어 끊겨도 이어 간다. 문제 목록을 준다(비면 모두 끝)."""
    errors = []
    for dest_name in bundle.dests:
        state = sidecar['dests'].get(dest_name) or {}
        if state.get('done'):
            continue
        dest = ctx.dest(dest_name)
        try:
            copied_at = state.get('copiedAt')
            late = False
            if copied_at:
                made = dt.datetime.strptime(copied_at, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=dt.timezone.utc)
                late = (utcnow() - made).total_seconds() > G_VERIFY_GRACE_HOURS * 3600
            if not copied_at or late:
                result = dest.put(part, bundle.name)
                state = {'copiedAt': stamp(), 'id': result}
                if late:
                    errors.append(f'{dest_name}:UNMET23_NOT_VERIFIED')
            if not getattr(dest, 'needs_confirm', False):
                state['done'] = True
            else:
                tries = G_WAIT_TRIES if sidecar['enc'] <= G_WAIT_SMALL_BYTES else 1
                answer = None
                for attempt in range(tries):
                    answer = dest.confirm(bundle.name, part.name, sidecar['md5'], sidecar['enc'])
                    if answer or answer is None:
                        break
                    if attempt < tries - 1:
                        ctx.sleep(G_WAIT_SECONDS)
                if answer:
                    state['done'], state['verifiedAt'] = True, stamp()
                elif answer is None:
                    errors.append(f'{dest_name}:UNMET23_METADATA_UNAVAILABLE')
                else:
                    state['waiting'] = True
            sidecar['dests'][dest_name] = state
        except (OSError, RuntimeError) as error:
            errors.append(f'{dest_name}:{error_code(error)}')
        write_json(Path(str(part) + '.json'), sidecar)
    return errors


def part_waiting(sidecar, bundle):
    return any(not (sidecar['dests'].get(d) or {}).get('done') for d in bundle.dests)


def finish_part(ctx, bundle, ledger, part, sidecar):
    ledger.append({'name': part.name, 'at': sidecar['at'], 'files': len(sidecar['rows']), 'raw': sidecar['raw'], 'enc': sidecar['enc'],
                   'md5': sidecar['md5'], 'sha256': sidecar['sha256'], 'keyId': sidecar.get('keyId'), 'dests': sidecar['dests']})
    ledger.commit([tuple(r) for r in sidecar['rows']], time.time(), part.name)
    if sidecar.get('fingerprint'):
        ledger.meta['fingerprint'] = sidecar['fingerprint']
        ledger.meta['wholeAt'] = stamp()
        if sidecar.get('fileCount'):
            ledger.meta['wholeFiles'] = sidecar['fileCount']
        ledger.save_meta()
    part.unlink(missing_ok=True)
    Path(str(part) + '.json').unlink(missing_ok=True)


def flush_leftovers(ctx, bundle, ledger, temp_dir):
    """지난 회차가 끊겨 남았거나 unmet23 대조를 기다리는 조각부터 처리한다. (문제 목록, 아직 기다리는 조각 수)."""
    for leftover in sorted(temp_dir.glob('*.part')):
        leftover.unlink(missing_ok=True)  # 암호화 도중 끊긴 것(복호화할 수 없다). 묶음 잠금 안이라 다른 회차의 것이 아니다
    errors, waiting = [], 0
    for part in sorted(temp_dir.glob('*.enc')):
        sidecar = read_json(Path(str(part) + '.json'))
        if not sidecar:
            part.unlink(missing_ok=True)  # 사이드카를 쓰기 전에 끊겼다 — 다음 회차가 다시 만든다
            continue
        problems = deliver(ctx, bundle, part, sidecar)
        errors += problems
        if part_waiting(sidecar, bundle):
            waiting += 1
        else:
            finish_part(ctx, bundle, ledger, part, sidecar)
    return errors, waiting


def make_and_send(ctx, bundle, ledger, rows, generated, temp_dir, seq, at, fingerprint=None):
    name = f'{bundle.name}-{at}-{seq:03}-{secrets.token_hex(3)}.tar.zst.enc'
    part = temp_dir / name
    info, captured, skipped = seal(rows, generated, part, ctx.public_key)
    if bundle.mode == 'whole' and skipped:
        # 온전하지 않은 열쇠 판은 올리지 않는다 — 복원은 가장 새 판 하나만 받으므로 빠진 열쇠가 그대로 빠진다. 옛 판은 그대로 둔다.
        part.unlink(missing_ok=True)
        return ['WHOLE_BUNDLE_INCOMPLETE'], len(skipped), None, False
    md5, _ = 드라이브.file_hashes(part)
    sidecar = {'at': at, 'rows': captured, 'raw': sum(r[1] for r in captured), 'zst': info['bytes'], 'enc': part.stat().st_size, 'md5': md5, 'sha256': info['sha256'],
               'keyId': info.get('keyId'), 'skipped': len(skipped), 'fingerprint': fingerprint, 'fileCount': len(rows) if bundle.mode == 'whole' else None, 'dests': {}}
    write_json(Path(str(part) + '.json'), sidecar)
    errors = deliver(ctx, bundle, part, sidecar)
    waiting = part_waiting(sidecar, bundle)
    if not waiting:
        finish_part(ctx, bundle, ledger, part, sidecar)
    return errors, len(skipped), sidecar, waiting


def fingerprint_of(rows, generated):
    digest = hashlib.sha256()
    for _, arc, size, mtime in rows:
        digest.update(f'{arc}\0{size}\0{mtime}\n'.encode('utf-8'))
    for arc in sorted(generated or {}):
        digest.update(arc.encode('utf-8') + b'\0' + hashlib.sha256(generated[arc]).digest())
    return digest.hexdigest()


def whole_keep(names, keep, days=WHOLE_DAILY_DAYS):
    """최근 keep판과, 최근 days일의 그날 첫 판을 남긴다(잘못된 열쇠를 며칠 뒤에 알아채도 되돌릴 판이 있게)."""
    kept = set(names[-keep:]) if keep else set(names)
    firsts = {}
    for name in names:
        firsts.setdefault(PART_NAME.match(name)['at'][:8], name)
    return kept | {firsts[day] for day in sorted(firsts)[-days:]}


def prune_whole(ctx, bundle):
    """whole 묶음의 옛 판을 치운다. 지우기는 휴지통으로 가고, 이름이 꼴에 맞는 것만 건드린다."""
    for dest in bundle.dests:
        names = sorted(n for n in ctx.dest(dest).listing(bundle.name) if PART_NAME.match(n) and PART_NAME.match(n)['bundle'] == bundle.name)
        keep = whole_keep(names, bundle.keep)
        for old in names:
            if old not in keep:
                ctx.dest(dest).remove(bundle.name, old)


def hours_since(moment):
    made = dt.datetime.strptime(moment, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=dt.timezone.utc)
    return (utcnow() - made).total_seconds() / 3600


def key_id_of(pem_text):
    body = ''.join(line for line in pem_text.splitlines() if line and not line.startswith('-----'))
    return hashlib.sha256(base64.b64decode(body)).hexdigest()[:16]


def publish_key_files(ctx, bundle, ledger):
    """복호화에 쓰는 공개키 · 잠긴 비밀키를 목적지에 둔다(잠긴 비밀키는 유호님 암호 없이는 못 쓴다). 열쇠 번호가 붙은 판은 지우지 않아, 열쇠를 바꿔도 옛 암호문을 풀 수 있다."""
    keys = ctx.home / '.synk-backup-key'
    issues = []
    done = ledger.meta.setdefault('keyFiles', {})     # API로 올려 대조까지 끝난 것(77yuhbs)
    copies = ledger.meta.setdefault('keyCopies', {})  # G:로 넣은 때. unmet23은 끝 표시를 두지 않고 회차마다 원격 메타데이터를 본다
    public = keys / '공개키.pem'
    try:
        key_id = key_id_of(public.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return ['KEY_FILE_MISSING']
    for source, names in ((public, ('공개키.pem', f'공개키-{key_id}.pem')), (keys / '비밀키_잠금.json', ('비밀키_잠금.json', f'비밀키_잠금-{key_id}.json'))):
        if not source.is_file():
            issues.append('KEY_FILE_MISSING')
            continue
        md5, digest = 드라이브.file_hashes(source)
        size = source.stat().st_size
        for name in names:
            for dest_name in bundle.dests:
                key = f'{dest_name}:{name}'
                dest = ctx.dest(dest_name)
                try:
                    if not getattr(dest, 'needs_confirm', False):
                        if done.get(key) != digest:
                            dest.put(source, bundle.name, name)
                            done[key] = digest
                        continue
                    answer = dest.confirm(bundle.name, name, md5, size)
                    if answer:
                        copies.pop(key, None)
                        continue
                    if answer is None:
                        issues.append(f'{dest_name}:UNMET23_METADATA_UNAVAILABLE')
                    copied = copies.get(key)
                    if copied and copied.get('sha') == digest:
                        if hours_since(copied['at']) <= G_VERIFY_GRACE_HOURS:
                            continue  # 아직 올라가는 중이다
                        if answer is not None:
                            issues.append(f'{dest_name}:UNMET23_NOT_VERIFIED')
                    dest.put(source, bundle.name, name)
                    copies[key] = {'sha': digest, 'at': stamp()}
                except (OSError, RuntimeError) as error:
                    issues.append(f'{dest_name}:{error_code(error)}')
    ledger.save_meta()
    return issues


def run_bundle(ctx, bundle, heartbeat=lambda: None):
    temp_dir = ctx.temp.root() / bundle.name
    temp_dir.mkdir(parents=True, exist_ok=True)
    report = {'bundle': bundle.name, 'mode': bundle.mode, 'made': 0, 'rawBytes': 0, 'encBytes': 0, 'files': 0, 'deferred': 0, 'skipped': 0,
              'issues': [], 'unchanged': False, 'waiting': 0}
    try:
        with BundleLock(temp_dir / '.묶음잠금'):
            _run_locked(ctx, bundle, heartbeat, temp_dir, report)
    except BundleBusy:
        report['busy'] = True  # 다른 회차가 이 묶음을 돌고 있다 — 그 회차가 끝낸다
    return report


def _add_part(report, sidecar, skipped):
    if sidecar is None:  # 온전하지 않아 버린 판
        report['skipped'] += skipped
        return
    report['made'] += 1
    report['rawBytes'] += sidecar['raw']
    report['encBytes'] += sidecar['enc']
    report['files'] += len(sidecar['rows'])
    report['skipped'] += skipped


def _run_locked(ctx, bundle, heartbeat, temp_dir, report):
    ledger = Ledger(ctx.home, bundle.name)
    errors, waiting = flush_leftovers(ctx, bundle, ledger, temp_dir)
    report['issues'] += errors
    report['waiting'] = waiting
    if errors or waiting:
        # 못 올린 조각이 있으면 새 조각을 만들지 않는다(쌓이지 않게). 대조를 기다리는 것은 문제가 아니라 다음 회차의 일이다.
        return
    now = time.time()
    list_problems = []
    rows = select(bundle, ctx.home, list_problems)
    report['selected'] = len(rows)
    report['listErrors'] = len(list_problems)
    generated = bundle.generated(ctx.home) if bundle.generated else {}
    at = utcnow().strftime('%Y%m%dT%H%M%SZ')
    if bundle.mode == 'whole':
        last_count = ledger.meta.get('wholeFiles')
        if sum(r[2] for r in rows) > KEYS_RAW_LIMIT:
            report['issues'].append('BUNDLE_WHOLE_TOO_BIG')
        elif list_problems:
            # 못 걸은 폴더 · 빈 필수 폴더가 있으면 줄어든 판을 온전한 판으로 치지 않는다.
            report['issues'].append('WHOLE_BUNDLE_LIST_ERROR')
        elif last_count and len(rows) < last_count * (1 - WHOLE_SHRINK_LIMIT) and not ctx.allow_shrink:
            report['issues'].append('WHOLE_BUNDLE_SHRANK')
        else:
            fingerprint = fingerprint_of(rows, generated)
            if ledger.meta.get('fingerprint') == fingerprint:
                report['unchanged'] = True
            elif ledger.meta.get('wholeAt') and hours_since(ledger.meta['wholeAt']) < WHOLE_MIN_HOURS and not ctx.force_now:
                report['notDue'] = True
            else:
                problems, skipped, sidecar, part_wait = make_and_send(ctx, bundle, ledger, rows, generated, temp_dir, 1, at, fingerprint)
                report['issues'] += problems
                _add_part(report, sidecar, skipped)
                report['waiting'] += int(part_wait)
                if sidecar is not None and not problems and not part_wait:
                    prune_whole(ctx, bundle)
        if bundle.name == '열쇠':
            report['issues'] += publish_key_files(ctx, bundle, ledger)
        return
    if list_problems:
        report['issues'].append('BUNDLE_LIST_ERROR')  # 올릴 수 있는 것은 올리고 알린다(못 걸은 곳은 다음 회차가 다시 본다)
    todo, deferred = changed_files(rows, ledger, bundle, now)
    report['deferred'] = deferred
    ledger.save_meta()
    for seq, batch in enumerate(batches(todo), 1):
        if ctx.stopped():
            report['issues'].append('BUNDLE_STOPPED')
            break
        problems, skipped, sidecar, part_wait = make_and_send(ctx, bundle, ledger, batch, None, temp_dir, seq, at)
        _add_part(report, sidecar, skipped)
        ctx.log(json.dumps({'묶음': bundle.name, '조각': seq, '원문MB': sidecar['raw'] >> 20, '암호문MB': sidecar['enc'] >> 20}, ensure_ascii=False))
        heartbeat()
        report['issues'] += problems
        report['waiting'] += int(part_wait)
        if problems:
            break


def settle(ctx, table, reports, tries=SETTLE_TRIES, wait=SETTLE_SECONDS):
    """회차 끝에 G:로 넣은 조각이 올라가기를 기다려 같은 회차에 끝낸다. 안 그러면 큰 조각은 다음 날까지 「대기」로 남아 영수증이 늘 대기다."""
    for _ in range(tries):
        names = [name for name, report in reports.items() if report.get('waiting')]
        if not names or ctx.stopped():
            return
        ctx.sleep(wait)
        for name in names:
            temp_dir = ctx.temp.root() / name
            try:
                with BundleLock(temp_dir / '.묶음잠금'):
                    errors, left = flush_leftovers(ctx, table[name], Ledger(ctx.home, name), temp_dir)
            except BundleBusy:
                continue
            except (OSError, RuntimeError, ValueError) as error:
                reports[name]['issues'] = list(dict.fromkeys(reports[name].get('issues', []) + [f'{name}:{error_code(error)}']))
                continue
            reports[name]['waiting'] = left
            reports[name]['issues'] = list(dict.fromkeys(reports[name].get('issues', []) + errors))


def confirm_zip(ctx, state, report):
    """지난 회차에 G:로 넣은 zip이 올라갔는지 본다. 올라가기 전에는 끝난 것으로 치지 않고, 48시간이 지나면 알리고 다시 넣는다."""
    pending = state.get('unmet23Pending')
    if not pending:
        return
    answer = ctx.unmet23.confirm('작업방식', '작업방식-최신.zip', pending['md5'], pending['size']) if getattr(ctx.unmet23, 'needs_confirm', False) else True
    if answer:
        state.setdefault('dests', {})['unmet23'] = stamp()
        state['unmet23Head'] = pending['head']
        state.pop('unmet23Pending', None)
        state.pop('unmet23PendingSince', None)
        return
    # 새 판이 3시간마다 나와 pending이 계속 바뀌어도, 대조가 한 번도 안 된 기간을 따로 잰다.
    if answer is None:
        report['issues'].append('unmet23:UNMET23_METADATA_UNAVAILABLE')
    elif hours_since(state.get('unmet23PendingSince') or pending['at']) > G_VERIFY_GRACE_HOURS:
        report['issues'].append('unmet23:UNMET23_NOT_VERIFIED')
    if hours_since(pending['at']) > G_VERIFY_GRACE_HOURS:
        state.pop('unmet23Pending', None)  # 같은 판이어도 다시 넣는다


def publish_workmethod(ctx, mirror, keep_daily=14, keep_monthly=12, run=subprocess.run, interval=3 * 3600):
    """거울 저장소의 지금 판을 unmet23(평문 zip)과 77yuhbs(암호 tar)에 둔다. 판이 그대로거나 지난 올림에서 interval이 안 지났으면 아무것도 안 한다."""
    mirror = Path(mirror)
    state_file = state_root(ctx.home) / '작업방식_드라이브.json'
    state = read_json(state_file, {}) or {}
    head = run(['git', '-C', str(mirror), 'rev-parse', 'HEAD'], capture_output=True, text=True, creationflags=CREATE_NO_WINDOW, check=True).stdout.strip()
    report = {'head': head, 'issues': [], 'unchanged': False, 'dests': {}}
    temp_dir = ctx.temp.root() / '작업방식'
    temp_dir.mkdir(parents=True, exist_ok=True)
    try:
        lock = BundleLock(temp_dir / '.묶음잠금')
        lock.__enter__()
    except BundleBusy:
        report['busy'] = True
        return report
    try:
        confirm_zip(ctx, state, report)
        same_head = state.get('head') == head
        dests = dict(state.get('dests', {})) if same_head else {}
        if state.get('unmet23Head') == head and state.get('dests', {}).get('unmet23'):
            dests['unmet23'] = state['dests']['unmet23']
        waiting_same_head = (state.get('unmet23Pending') or {}).get('head') == head
        if dests.get('unmet23') and dests.get('77yuhbs'):
            report['unchanged'] = True
            report['dests'] = dests
            write_json(state_file, {**state, 'dests': dests})
            return report
        last = state.get('at')
        since = (utcnow() - dt.datetime.strptime(last, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=dt.timezone.utc)).total_seconds() if last else None
        if not same_head and since is not None and since < interval:
            # 판은 30분마다 바뀌지만 드라이브에는 3시간마다만 보낸다(같은 판의 재시도는 바로 한다). GitHub에는 이미 올라갔다.
            report['notDue'] = True
            write_json(state_file, state)
            return report
        if same_head and waiting_same_head and dests.get('77yuhbs'):
            report['waiting'] = True  # 넣어 둔 zip이 올라가기를 기다린다
            write_json(state_file, state)
            return report
        day = utcnow().astimezone(dt.timezone(dt.timedelta(hours=9))).strftime('%Y%m%d')
        zip_file, zip_enc = temp_dir / '작업방식-최신.zip', temp_dir / '작업방식-최신.zip.enc'
        run(['git', '-C', str(mirror), '-c', 'core.quotepath=false', 'archive', '--format=zip', '--prefix=SYNK_복원시작/', '-o', str(zip_file), head],
            check=True, creationflags=CREATE_NO_WINDOW)
        report['zipBytes'] = zip_file.stat().st_size
        # unmet23 — 평문 zip. 암호를 잊어도 작업 방식은 여기와 GitHub에 남는다. 날짜 판은 그날 첫 올림에만 만든다(올리는 양을 줄인다).
        if not dests.get('unmet23') and not waiting_same_head:
            md5, _ = 드라이브.file_hashes(zip_file)
            try:
                ctx.unmet23.put(zip_file, '작업방식', '작업방식-최신.zip')
                if f'작업방식-{day}.zip' not in ctx.unmet23.listing('작업방식'):
                    ctx.unmet23.put(zip_file, '작업방식', f'작업방식-{day}.zip')
                prune_dated(ctx.unmet23, DATED_ZIP, keep_daily, keep_monthly)
                state['unmet23Pending'] = {'head': head, 'md5': md5, 'size': zip_file.stat().st_size, 'at': stamp()}
                state.setdefault('unmet23PendingSince', stamp())
                if not getattr(ctx.unmet23, 'needs_confirm', False):
                    confirm_zip(ctx, state, report)
                    if state.get('unmet23Head') == head:
                        dests['unmet23'] = state['dests']['unmet23']
            except (OSError, RuntimeError) as error:
                report['issues'].append(f'unmet23:{error_code(error)}')
        # 77yuhbs — 같은 zip을 잠근 것. 서버의 clasp 열쇠가 닿는 곳이라 평문으로 두지 않는다.
        if not dests.get('77yuhbs'):
            try:
                encrypt_file(zip_file, zip_enc, ctx.public_key, run)
                ctx.yuhbs.replace(zip_enc, '작업방식', '작업방식-최신.zip.enc')
                if f'작업방식-{day}.zip.enc' not in ctx.yuhbs.listing('작업방식'):
                    ctx.yuhbs.replace(zip_enc, '작업방식', f'작업방식-{day}.zip.enc')
                prune_dated(ctx.yuhbs, DATED_ENC, keep_daily, keep_monthly)
                dests['77yuhbs'] = stamp()
            except (OSError, RuntimeError, subprocess.SubprocessError) as error:
                report['issues'].append(f'77yuhbs:{error_code(error)}')
        zip_file.unlink(missing_ok=True)
        zip_enc.unlink(missing_ok=True)
        report['dests'] = dests
        write_json(state_file, {**state, 'head': head, 'dests': dests, 'at': stamp()})
        return report
    finally:
        lock.__exit__()


def encrypt_file(source, out, public_key, run=subprocess.run):
    out = Path(out)
    args = [node_path(), str(CODE / '암호흐름.cjs'), str(out), out.name[:-4]]
    if public_key:
        args += ['--공개키', str(public_key)]
    with open(source, 'rb') as stream:
        done = run(args, stdin=stream, capture_output=True, creationflags=CREATE_NO_WINDOW)
    if done.returncode != 0:
        out.unlink(missing_ok=True)
        raise RuntimeError('WORKMETHOD_ENCRYPT_FAILED')


def prune_dated(dest, pattern, keep_daily, keep_monthly):
    """일별 판은 최근 keep_daily개와 달마다 첫 판 keep_monthly개만 남긴다."""
    names = sorted(n for n in dest.listing('작업방식') if pattern.match(n))
    keep = set(names[-keep_daily:])
    months = {}
    for name in names:
        months.setdefault(pattern.match(name)[1][:6], name)
    keep |= set(months[m] for m in sorted(months)[-keep_monthly:])
    for name in names:
        if name not in keep:
            dest.remove('작업방식', name)


# 작업 기록 묶음의 OneDrive 사본(커밋 전 소스)은 새 노트북의 OneDrive 폴더에 풀지 않는다 — 풀면 OneDrive가 동기화를 시작한다.
RESTORE_REMAP = (('OneDrive/', 'SYNK복원_작업기록/'),)


def restore_name(name):
    for old, new in RESTORE_REMAP:
        if name.startswith(old):
            return new + name[len(old):]
    return name


def place_no_clobber(partial, target):
    """다 쓴 임시 파일을 제자리로. 그새 누가 만들었으면 FileExistsError다 — 윈도우 rename은 대상이 있으면 실패하고, 그 밖은 하드 링크로 같은 동작을 한다."""
    if os.name == 'nt':
        os.rename(partial, target)
    else:
        os.link(partial, target)
        os.unlink(partial)


def extract(archive, home):
    """복호화된 묶음을 집 아래에 푼다. 이미 있는 파일은 건너뛴다. 집 밖 경로 · 링크는 풀지 않는다.
    조각 끝의 sha256 목록과 다른 파일은 지워 더 옛 조각이 채우게 한다."""
    home = Path(home).resolve()
    counts = {'풀림': 0, '건너뜀': 0, '거절': 0, '실패': 0, '손상': 0, '바이트': 0}
    written, manifest = {}, None
    with tarfile.open(archive, mode='r:zst') as tar:
        for member in tar:
            if not member.isfile():
                if not member.isdir():
                    counts['거절'] += 1
                continue
            name = member.name.replace('\\', '/')
            parts = name.split('/')
            if name.startswith('/') or re.match(r'^[A-Za-z]:', name) or '..' in parts or '' in parts:
                counts['거절'] += 1
                continue
            if name.startswith(MANIFEST_DIR):
                manifest = json.load(tar.extractfile(member))
                continue
            target = home.joinpath(*restore_name(name).split('/'))
            try:
                target.resolve().relative_to(home)
            except ValueError:
                counts['거절'] += 1
                continue
            if os.path.lexists(target):
                counts['건너뜀'] += 1
                continue
            partial = target.with_name(target.name + f'.복원{os.getpid()}.part')
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
            except OSError:  # 폴더 자리에 파일이 있는 경우 등
                counts['실패'] += 1
                continue
            try:
                source = tar.extractfile(member)
                digest = hashlib.sha256()
                with open(partial, 'wb') as out:
                    while block := source.read(1 << 20):
                        digest.update(block)
                        out.write(block)
                os.utime(partial, (member.mtime, member.mtime))
                place_no_clobber(partial, target)
            except FileExistsError:
                partial.unlink(missing_ok=True)
                counts['건너뜀'] += 1
                continue
            except OSError:
                partial.unlink(missing_ok=True)
                counts['실패'] += 1
                continue
            written[name] = (target, digest.hexdigest(), member.size)
            counts['풀림'] += 1
            counts['바이트'] += member.size
    for row in manifest or []:
        arc, _, want = row
        got = written.get(arc)
        if got and got[1] != want:
            got[0].unlink(missing_ok=True)
            counts['풀림'] -= 1
            counts['바이트'] -= got[2]
            counts['손상'] += 1  # 묶을 때 줄어든 파일(want가 None)도 센다 — 더 옛 조각이 채웠는지는 사람이 본다
    return counts


def fetch(yuhbs, names, folder):
    """77yuhbs에서 묶음의 암호문을 받는다. 이미 받은 것(md5 같음)은 건너뛴다."""
    folder = Path(folder)
    got = {}
    for name in names:
        parent = yuhbs.folder(name, make=False)
        rows = yuhbs.drive.children(parent) if parent else []
        rows = [r for r in rows if PART_NAME.match(r['name'])]
        if name == '열쇠':
            rows = sorted(rows, key=lambda r: r['name'])[-1:]
        count = 0
        for row in rows:
            dest = folder / name / row['name']
            if dest.exists() and 드라이브.file_hashes(dest)[0] == row.get('md5Checksum'):
                count += 1
                continue
            yuhbs.drive.download(row['id'], dest, row.get('md5Checksum'))
            count += 1
        got[name] = count
    return got


def make_context(home, public_key=None, big=True):
    """big=False(열쇠 회차, 1MB 남짓)면 핫스팟에서도 그대로 올린다 — 10-21 기준은 1GB 넘는 일만 미룸."""
    vault = home / 'Documents' / 'SYNK_원본창고'
    hold = 드라이브.on_hotspot if big else None
    rate = 드라이브.Rate(vault / 'upload.mbps', hold=hold)
    rate.holding = bool(hold and hold())
    rate.start()

    def yuhbs_drive():
        return 드라이브.Drive(드라이브.read_clasp(home / '.synk-drive-77yuhbs' / '.clasprc.json'), EMAIL_20TB, rate=rate)

    def unmet_drive():
        try:
            drive = 드라이브.Drive(드라이브.read_clasp(home / '.clasprc.json'), EMAIL_5TB)
            drive.check_account()
            return drive
        except (OSError, ValueError, KeyError, RuntimeError):
            return None

    return Context(home=home, temp=Temp(home), unmet23=UnmetG(Path('G:/내 드라이브') / REMOTE_ROOT, unmet_drive), yuhbs=Yuhbs(yuhbs_drive()),
                   stop_file=vault / 'upload.stop', public_key=public_key, hold=hold)


class Receipt:
    """통합 감시(tools/backup-health.py)가 읽는 영수증. 도는 동안 30초마다 숨소리를 남긴다."""

    def __init__(self, path):
        self.path = Path(path)
        prior = read_json(self.path, {}) or {}
        self.body = {'schemaVersion': 1, 'status': 'running', 'pid': os.getpid(), 'startedAt': stamp(), 'heartbeatAt': stamp(),
                     'lastSuccessAt': prior.get('lastSuccessAt'), 'bundles': {}, 'issues': []}
        self.stop = threading.Event()
        self.lock = threading.Lock()
        self.save()
        self.thread = threading.Thread(target=self._beat, daemon=True)
        self.thread.start()

    def save(self):
        with self.lock:
            self.body['heartbeatAt'] = stamp()
            write_json(self.path, self.body)

    def _beat(self):
        while not self.stop.wait(30):
            self.save()

    def finish(self, issues, reports):
        self.stop.set()
        self.body['bundles'] = reports
        self.body['issues'] = [{'code': re.sub(r'[^A-Z0-9_]', '_', str(i).split(':')[-1].upper())[:90] or 'BUNDLE_FAILED'} for i in dict.fromkeys(issues)]
        unfinished = any(r.get('waiting') or r.get('busy') for r in reports.values())
        if issues and all('BUNDLE_STOPPED' in str(i) for i in issues):
            self.body['status'] = 'paused'
        elif issues:
            self.body['status'] = 'partial_failure'
        else:
            # 대조를 기다리거나 다른 회차가 잡은 묶음이 있으면 아직 끝이 아니다(장부도 아직 안 적었다).
            self.body['status'] = 'pending' if unfinished else 'success'
        self.body['finishedAt'] = self.body['checkedAt'] = stamp()
        if self.body['status'] == 'success':
            self.body['lastSuccessAt'] = self.body['finishedAt']
        self.save()


def keep_breathing(path, every=60):
    """부른 쪽(작업방식.cjs)이 기다리는 동안 그 영수증에 숨소리를 남긴다. 통합 감시는 15분 끊기면 중단으로 본다."""
    def loop():
        while True:
            time.sleep(every)
            body = read_json(path)
            if isinstance(body, dict) and body.get('status') == 'running':
                body['heartbeatAt'] = stamp()
                write_json(path, body)
    threading.Thread(target=loop, daemon=True).start()


def command_list(home, names, show_names):
    table = define_bundles(home)
    for name in names or table:
        bundle = table[name]
        rows = select(bundle, home)
        ledger = Ledger(home, name)
        todo, deferred = changed_files(rows, ledger, bundle, time.time()) if bundle.mode == 'incremental' else (rows, 0)
        print(json.dumps({'묶음': name, '파일': len(rows), '원문MB': round(sum(r[2] for r in rows) / (1 << 20), 1),
                          '올릴파일': len(todo), '올릴MB': round(sum(r[2] for r in todo) / (1 << 20), 1), '미룸': deferred, '목적지': bundle.dests}, ensure_ascii=False))
        if show_names:
            for row in rows:
                print(f'  {row[2]:>12} {row[1]}')
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('명령', choices=['전부', '열쇠', '작업방식', '목록', '받기', '풀기', '묶음'])
    parser.add_argument('대상', nargs='*')
    parser.add_argument('--거울')
    parser.add_argument('--이름', action='store_true')
    parser.add_argument('--폴더')
    parser.add_argument('--집')
    parser.add_argument('--숨소리')
    parser.add_argument('--줄어듦허용', action='store_true')
    parser.add_argument('--지금', action='store_true')
    args = parser.parse_args(argv)
    home = Path(args.집 or os.environ.get('SYNK_복원_집') or Path.home())
    if args.명령 == '목록':
        return command_list(home, args.대상, args.이름)
    if args.명령 == '풀기':
        print(json.dumps(extract(args.대상[0], home), ensure_ascii=False))
        return 0
    ctx = make_context(home, big=args.명령 != '열쇠')
    ctx.allow_shrink = args.줄어듦허용
    ctx.force_now = args.지금
    if args.숨소리:
        keep_breathing(args.숨소리)
    if args.명령 == '받기':
        print(json.dumps(fetch(ctx.yuhbs, args.대상, args.폴더), ensure_ascii=False))
        return 0
    table = define_bundles(home)
    root = state_root(home)
    if (root / OTHER_PC_MARKER).exists():
        # 다른 노트북이 작업 방식을 먼저 올렸다. 이 PC가 옛 노트북이면 드라이브를 덮으면 안 된다(작업방식.cjs가 push 거절 때 쓴다).
        print(json.dumps({'issues': ['ANOTHER_PC_AHEAD']}), flush=True)
        return 1
    if args.명령 == '작업방식':
        if ctx.stopped():
            print(json.dumps({'stopped': True, 'issues': []}), flush=True)  # GitHub에는 올라갔다. 드라이브는 와이파이로 돌아온 뒤에
            return 0
        mirror = Path(args.거울) if args.거울 else home / 'AppData' / 'Local' / 'synk' / '작업방식'
        report = publish_workmethod(ctx, mirror)
        print(json.dumps(report, ensure_ascii=False))
        return 1 if report['issues'] else 0
    names = ['열쇠'] if args.명령 == '열쇠' else (args.대상 or list(DAILY))
    # 열쇠만 도는 30분 회차는 매일 회차의 영수증을 덮지 않는다.
    receipt = Receipt(root / ('열쇠.json' if args.명령 == '열쇠' else '묶음.json'))
    issues, reports = [], {}
    for name in names:
        if ctx.stopped():
            issues.append('BUNDLE_STOPPED')
            break
        try:
            report = run_bundle(ctx, table[name], receipt.save)
        except (OSError, RuntimeError, ValueError, KeyError) as error:
            report = {'bundle': name, 'issues': [f'{name}:{error_code(error)}']}
        reports[name] = report
        print(json.dumps(report, ensure_ascii=False), flush=True)
    if args.명령 != '열쇠':  # 열쇠는 작업방식.cjs가 기다리는 회차다. 대조는 다음 30분 회차가 한다
        settle(ctx, table, reports)
    for report in reports.values():
        issues += report.get('issues', [])
    receipt.finish(issues, reports)
    return 1 if issues and not all('BUNDLE_STOPPED' in str(i) for i in issues) else 0


if __name__ == '__main__':
    sys.exit(main())
