"""허깅페이스 PRO 감싸개 — ZeroGPU Space를 부르기 전에 남은 한도를 보고, 모자라면 크레딧으로 넘어가지 않게 부르지 않는다
(2026-11-02, 유호님 「허깅페이스 매월 결제하고 있는데 기능을 하나도 이용 안 하고 있어 … 최대한 잘 이용하고 싶어」).

왜 있나:
  ZeroGPU는 PRO 계정(q121235) 하루 2,400초(40분)다. 다 쓰면 선불 잔액(PRO에 딸린 월 $2)에서 10분에 $1씩 빠지고,
  같은 잔액을 Inference Providers · Jobs가 같이 쓴다. 차감은 실제 GPU 초 × 크기 배수(xlarge 2배)지만, 서버는 부를 때
  함수가 적어 둔 duration만큼 남았는지 본다 — 그래서 「예상초」는 그 Space의 `@spaces.GPU(duration=…)` 최댓값으로 잡는다.
  여러 세션이 한꺼번에 부르면 각자 「남았다」고 보고 같이 넘칠 수 있어, 부르는 동안 쓸 초를 예약 장부에 잡아 둔다.
  부른 뒤 넘친 초(overquotaUsed)가 늘었으면 멈춤 파일을 남겨 사람이 확인하고 풀 때까지 모든 호출을 막는다.

무엇을 안 하나:
  유료 Jobs · 크레딧 충전 · Space 하드웨어 바꾸기는 하지 않는다(돈이 나가므로 유호님 승인 — docs/AI_계정과_크레딧.md 「허깅페이스」).
  남의 Space에 파일을 보낼 때는 `--남에게보내도됨`을 받아야 보낸다 — 유호님 얼굴 · 고객 · 학생 자료는 남의 Space에 올리지 않는다.

사용:
  python -X utf8 tools/허깅페이스.py 한도 [--json]
  python -X utf8 tools/허깅페이스.py 목록
  python -X utf8 tools/허깅페이스.py 살펴보기 <space>
  python -X utf8 tools/허깅페이스.py 부르기 <space> [--api /이름] [--인자 '<JSON 배열>'] [--이름인자 '<JSON 객체>']
         [--예상초 N] [--배수 1|2] [--여유 30] [--받을곳 폴더] [--남에게보내도됨] [--메모 글] [--json]
         (파일은 JSON 안에 {"$파일": "경로"}로 적는다)
  허깅페이스 먼저 · 남은 것만 로컬(결과가 같은 일 — 11-02 유호님 「가능한것들은 전부 먼저 허깅페이스 gpu 먼저」):
  python -X utf8 tools/허깅페이스.py 목소리떼기 <출력폴더> <입력…> --남에게보내도됨 [--로컬만] [--cpu]
         → <이름>_목소리.wav · <이름>_바탕.wav(로컬 Demucs 목소리떼기.py와 같은 이름), 엔진은 떼기기록.json
  python -X utf8 tools/허깅페이스.py 받아쓰기 <파일…> --남에게보내도됨 [--로컬만] [--언어 ko] [--json]
         (--남에게보내도됨이 없으면 모두 로컬. 몫 밖 · 멈춤 · Space 두 번 잇단 실패면 남은 것만 로컬 — 떼기는 공용 GPU 줄로)
  python -X utf8 tools/허깅페이스.py 기록 [--날 2026-11-02]
  python -X utf8 tools/허깅페이스.py 풀기 --확인
  (모듈로) sys.path에 tools를 넣고 from 허깅페이스 import 지키며_부르기, 한도지키기, 한도읽기
         — 자기 gradio 호출이 있는 스크립트는 `with 한도지키기(space, 필요초) as 셈: client.predict(…)`로 감싼다

끝 코드: 0 됨 · 2 막음(한도 모자람 · 멈춤 · 남의 Space에 파일 확인 없음) · 3 불렀는데 넘친 초가 늘었다(멈춤을 걸었다)
        · 1 인자 틀림 · 그 밖의 오류.
상태(예약 · 사용 기록 · 멈춤)는 저장소 밖 %LOCALAPPDATA%/synk/허깅페이스/(시험은 SYNK_HF_STATE로 바꾼다).
쓸 Space와 예상초는 tools/lib/허깅페이스_space.json, 함정은 docs/현장노트/허깅페이스.md. 시험: python -X utf8 tests/허깅페이스.test.py
"""
import argparse
import contextlib
import datetime as dt
import json
import os
import re
import sys
import time
import uuid
from pathlib import Path

os.environ.setdefault('HF_HUB_DISABLE_SYMLINKS_WARNING', '1')   # 이 PC는 심볼릭 링크가 없어 받을 때마다 경고가 찍힌다

여기 = Path(__file__).resolve().parent
목록파일 = 여기 / 'lib' / '허깅페이스_space.json'
끝점 = 'https://huggingface.co'
KST = dt.timezone(dt.timedelta(hours=9))
기본여유초 = 30          # 남은 초에서 늘 남겨 둘 몫(재는 사이 다른 세션이 쓴 것 · 차감 늦음)
예약덤초 = 900           # 예약이 저절로 풀리는 때 = 필요초 + 대기열 몫(부른 쪽이 죽어도 장부가 막히지 않게)


class 한도모자람(Exception):
    """남은 초가 이번 호출에 모자라거나, 서버가 GPU 한도로 거절했다."""


class 멈춰있음(Exception):
    """넘친 초를 본 뒤 걸린 멈춤이 아직 풀리지 않았다."""


# ── 상태 폴더 ──────────────────────────────────────────────────────────

def 상태폴더() -> Path:
    덮어쓰기 = os.environ.get('SYNK_HF_STATE')
    바탕 = Path(os.environ.get('LOCALAPPDATA') or Path.home() / 'AppData' / 'Local') / 'synk' / '허깅페이스'
    폴더 = Path(덮어쓰기) if 덮어쓰기 else 바탕
    폴더.mkdir(parents=True, exist_ok=True)
    return 폴더


def _json쓰기(경로: Path, 값) -> None:
    임시 = 경로.with_name(f'{경로.name}.{os.getpid()}.tmp')
    with open(임시, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(값, f, ensure_ascii=False, indent=1)
    os.replace(임시, 경로)


def _기록남기기(줄: dict) -> None:
    with open(상태폴더() / '사용기록.jsonl', 'a', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(줄, ensure_ascii=False) + '\n')


# ── 한도 ───────────────────────────────────────────────────────────────

def _토큰() -> str:
    from huggingface_hub import get_token
    토큰 = get_token()
    if not 토큰:
        raise SystemExit('허깅페이스 로그인이 없다 — hf auth login')
    return 토큰


def _한도원본(토큰: str) -> dict:
    """GET /api/spaces/zero-gpu/quota — huggingface_hub 2.4의 get_zero_gpu_quota와 같은 끝점(1.x에도 열려 있다)."""
    from huggingface_hub.utils import get_session
    r = get_session().get(f'{끝점}/api/spaces/zero-gpu/quota', headers={'authorization': f'Bearer {토큰}'})
    if r.status_code == 401:
        raise PermissionError('ZeroGPU 한도를 못 읽었다(401) — 토큰에 결제 읽기 권한(read-billing)이 있어야 한다')
    r.raise_for_status()
    return r.json()


def 한도풀기(원본: dict) -> dict:
    초기화 = 원본.get('resetsAt')
    return {
        '기본': float(원본['base']),
        '남은': float(원본['current']),
        '초기화': dt.datetime.fromisoformat(초기화.replace('Z', '+00:00')) if 초기화 else None,
        '넘친': float(원본.get('overquotaUsed') or 0),
    }


def 한도읽기(토큰: str | None = None) -> dict:
    return 한도풀기(_한도원본(토큰 or _토큰()))


def _시각(때: dt.datetime | None) -> str:
    return 때.astimezone(KST).strftime('%m-%d %H:%M KST') if 때 else '아직 안 씀'


# ── 예약 장부 ──────────────────────────────────────────────────────────

@contextlib.contextmanager
def _잠금(폴더: Path, 기다릴초: float = 15):
    자물쇠 = 폴더 / '예약.lock'
    끝 = time.time() + 기다릴초
    while True:
        try:
            os.close(os.open(자물쇠, os.O_CREAT | os.O_EXCL | os.O_WRONLY))
            break
        except FileExistsError:
            try:
                if time.time() - 자물쇠.stat().st_mtime > 60:   # 잠근 쪽이 죽었다
                    자물쇠.unlink(missing_ok=True)
                    continue
            except FileNotFoundError:
                continue
            if time.time() > 끝:
                raise TimeoutError(f'예약 장부 잠금을 {기다릴초:.0f}초 안에 못 얻었다: {자물쇠}')
            time.sleep(0.1)
    try:
        yield
    finally:
        자물쇠.unlink(missing_ok=True)


def _예약읽기(폴더: Path, 지금: float) -> list:
    try:
        줄 = json.loads((폴더 / '예약.json').read_text(encoding='utf-8'))
    except (FileNotFoundError, json.JSONDecodeError):
        줄 = []
    return [x for x in 줄 if x.get('만료', 0) > 지금]


def 예약하기(필요초: float, 이름: str, 한도: dict, 여유초: float = 기본여유초, 지금: float | None = None) -> str:
    """남은 초 − 남들이 잡아 둔 초 − 여유 안에 들면 잡고 예약 id를 준다. 안 들면 한도모자람."""
    지금 = time.time() if 지금 is None else 지금
    폴더 = 상태폴더()
    with _잠금(폴더):
        남들 = _예약읽기(폴더, 지금)
        잡힌 = sum(x['초'] for x in 남들)
        쓸수있는 = 한도['남은'] - 잡힌 - 여유초
        if 필요초 > 쓸수있는:
            raise 한도모자람(
                f'ZeroGPU 한도 모자람 — 이번 호출 {필요초:.0f}초, 남은 {한도["남은"]:.0f}초 − 다른 세션 예약 {잡힌:.0f}초'
                f' − 여유 {여유초:.0f}초 = {쓸수있는:.0f}초. 초기화 {_시각(한도["초기화"])} 뒤에 다시(크레딧으로 넘기지 않는다)')
        예약id = uuid.uuid4().hex[:12]
        남들.append({'id': 예약id, '이름': 이름, '초': 필요초, 'pid': os.getpid(), '만료': 지금 + 필요초 + 예약덤초})
        _json쓰기(폴더 / '예약.json', 남들)
    return 예약id


def 예약풀기(예약id: str) -> None:
    폴더 = 상태폴더()
    with _잠금(폴더):
        _json쓰기(폴더 / '예약.json', [x for x in _예약읽기(폴더, time.time()) if x['id'] != 예약id])


# ── 멈춤 ───────────────────────────────────────────────────────────────

def 멈춤보기() -> dict | None:
    try:
        return json.loads((상태폴더() / '멈춤.json').read_text(encoding='utf-8'))
    except FileNotFoundError:
        return None


def 멈추기(까닭: str, **덧) -> None:
    _json쓰기(상태폴더() / '멈춤.json', {'까닭': 까닭, '때': dt.datetime.now(KST).isoformat(timespec='seconds'), **덧})


# ── Space 목록 ─────────────────────────────────────────────────────────

def 목록읽기() -> dict:
    return {x['id']: x for x in json.loads(목록파일.read_text(encoding='utf-8'))['space']}


def 파일풀기(값):
    """JSON 안의 {"$파일": 경로}를 gradio handle_file로 바꾼다. 그 밖의 값은 그대로."""
    if isinstance(값, dict):
        if set(값) == {'$파일'}:
            from gradio_client import handle_file
            경로 = str(값['$파일'])
            if not 경로.startswith(('http://', 'https://')) and not Path(경로).is_file():
                raise FileNotFoundError(f'보낼 파일이 없다: {경로}')
            return handle_file(경로)
        return {k: 파일풀기(v) for k, v in 값.items()}
    if isinstance(값, list):
        return [파일풀기(v) for v in 값]
    return 값


def 파일이있나(값) -> bool:
    if isinstance(값, dict):
        return set(값) == {'$파일'} or any(파일이있나(v) for v in 값.values())
    if isinstance(값, list):
        return any(파일이있나(v) for v in 값)
    return False


def _내이름(토큰: str) -> str:
    from huggingface_hub import whoami
    return whoami(token=토큰)['name']


def _클라이언트만들기(space: str, 토큰: str, 받을곳: Path):
    import httpx
    from gradio_client import Client
    return Client(space, token=토큰, verbose=False, download_files=str(받을곳),
                  httpx_kwargs={'timeout': httpx.Timeout(600)})


def _한도거절인가(오류: Exception) -> bool:
    return bool(re.search(r'GPU quota|ZeroGPU quota|exceeded your .*quota|quota exceeded', str(오류), re.I))


# ── 부르기 ─────────────────────────────────────────────────────────────

@contextlib.contextmanager
def 한도지키기(space: str, 필요초: float, 이름: str = '', 여유초: float = 기본여유초, 메모: str = '', 토큰: str | None = None):
    """다른 스크립트가 자기 gradio 호출을 감쌀 때 쓴다 — 멈춤 · 넘침을 보고, 남은 초 안에 들면 예약하고,
    끝나면 한도를 다시 읽어 기록한다. with 블록 안에서 돌려받는 dict에 '쓴초' · '남은초' · '넘침'이 끝난 뒤 채워진다.
        with 한도지키기('q121235/pulse-lora-render', 170) as 셈:
            client.predict(..., api_name='/render')
        if 셈['넘침']: ...   # 멈춤이 걸렸다
    """
    멈춤 = 멈춤보기()
    if 멈춤:
        raise 멈춰있음(f'멈춰 있다({멈춤.get("때")}): {멈춤.get("까닭")} — 확인한 뒤 `풀기 --확인`')
    토큰 = 토큰 or _토큰()
    전 = 한도읽기(토큰)
    if 전['넘친'] > 0:
        멈추기(f'부르기 전에 이미 넘친 초 {전["넘친"]:.1f}가 있다(이 도구 밖에서 쓴 것)', 넘친초=전['넘친'])
        raise 멈춰있음(f'이미 넘친 초 {전["넘친"]:.1f}가 있어 멈췄다 — 결제 화면에서 누가 썼는지 보고 `풀기 --확인`')
    이름 = 이름 or space
    예약id = 예약하기(필요초, 이름, 전, 여유초)
    셈 = {'쓴초': None, '남은초': None, '넘침': False, '왕복초': None}
    시작 = time.time()
    오류 = None
    try:
        yield 셈
    except BaseException as e:  # noqa: BLE001 — 끊김(Ctrl+C)도 기록을 남긴 뒤 다시 던진다
        오류 = e
    finally:
        셈['왕복초'] = round(time.time() - 시작, 1)
        후 = None
        try:
            후 = 한도읽기(토큰)
            if 오류 is None and 후['남은'] >= 전['남은']:   # 차감이 늦게 붙는 때가 있다
                time.sleep(3)
                후 = 한도읽기(토큰)
        except Exception:  # noqa: BLE001
            후 = None
        예약풀기(예약id)
        if 후:
            셈.update(쓴초=round(전['남은'] - 후['남은'], 1), 남은초=후['남은'], 넘침=후['넘친'] > 전['넘친'])
        else:
            print('부른 뒤 ZeroGPU 한도를 다시 못 읽었다 — 넘쳤는지 모르니 `한도`로 넘친 초를 본다', file=sys.stderr)
        if 셈['넘침']:
            멈추기(f'{이름}를 부른 뒤 넘친 초가 {전["넘친"]:.1f} → {후["넘친"]:.1f}로 늘었다(크레딧이 나갔을 수 있다)',
                 space=space, 넘친초=후['넘친'])
        _기록남기기({
            '때': dt.datetime.now(KST).isoformat(timespec='seconds'), 'space': space, '이름': 이름, '필요초': float(필요초),
            '전남은초': 전['남은'], '후남은초': 후['남은'] if 후 else None, '쓴초': 셈['쓴초'],
            '넘친초': 후['넘친'] if 후 else None, '넘침': 셈['넘침'], '왕복초': 셈['왕복초'],
            '결과': '됨' if 오류 is None else f'실패: {type(오류).__name__}: {str(오류)[:300]}', '메모': 메모,
        })
    if 오류 is not None:
        if _한도거절인가(오류):
            raise 한도모자람(f'서버가 GPU 한도로 거절했다: {오류}') from 오류
        raise 오류


def 지키며_부르기(space: str, api: str | None = None, 인자: list | None = None, 이름인자: dict | None = None,
               예상초: float | None = None, 배수: float | None = None, 여유초: float = 기본여유초,
               받을곳: str | Path | None = None, 남에게보내도됨: bool = False, 메모: str = '') -> dict:
    """목록(또는 인자)에서 api · 예상초 · 배수를 찾아, 한도지키기 안에서 gradio로 한 번 부른다.
    돌려주는 것: {'결과', '쓴초', '남은초', '넘침', '왕복초', '받을곳'}. 넘침이 참이면 멈춤을 걸었다."""
    인자, 이름인자 = list(인자 or []), dict(이름인자 or {})
    항목 = 목록읽기().get(space, {})
    api = api or 항목.get('api')
    예상초 = 예상초 or 항목.get('예상초')
    배수 = 배수 or 항목.get('배수') or 1
    if not api:
        raise ValueError(f'{space}의 api 이름을 모른다 — `살펴보기 {space}`로 보고 --api로 준다')
    if not 예상초:
        raise ValueError(f'{space}의 예상초를 모른다 — `살펴보기 {space}`로 @spaces.GPU duration을 보고 --예상초로 준다')

    토큰 = _토큰()
    if 파일이있나([인자, 이름인자]) and not 남에게보내도됨 and space.split('/')[0] != _내이름(토큰):
        raise PermissionError(f'남의 Space({space})에 파일을 보낸다 — 유호님 얼굴 · 고객 · 학생 자료가 아닌지 보고 --남에게보내도됨을 준다')
    차례인자, 이름인자 = 파일풀기(인자), 파일풀기(이름인자)   # 없는 파일은 예약 전에 걸러 낸다

    받을곳 = Path(받을곳) if 받을곳 else Path.cwd() / '.tmp' / '허깅페이스' / dt.datetime.now(KST).strftime('%Y%m%d-%H%M%S')
    받을곳.mkdir(parents=True, exist_ok=True)
    with 한도지키기(space, float(예상초) * float(배수), f'{space}{api}', 여유초, 메모, 토큰) as 셈:
        결과 = _클라이언트만들기(space, 토큰, 받을곳).predict(*차례인자, api_name=api, **이름인자)
    return {'결과': 결과, **셈, '받을곳': str(받을곳)}


# ── 살펴보기 ───────────────────────────────────────────────────────────

def duration찾기(이름: str, 글: str) -> list:
    """@spaces.GPU 줄과, duration이 함수 이름이면 그 함수 몸(앞 25줄)까지 뽑는다 — 예상초는 사람이 읽고 정한다."""
    줄 = []
    for m in re.finditer(r'(@?spaces\.GPU)(?:\(([^\n]*)\))?', 글):
        if m.group(2) is None:
            줄.append(f'{이름}: {m.group(1)} — 괄호 없음 = 기본 60초')
            continue
        줄.append(f'{이름}: {m.group(1)}({m.group(2)})')
        함수 = re.search(r'duration\s*=\s*([A-Za-z_]\w*)', m.group(2))
        몸 = 함수 and re.search(rf'^def {함수.group(1)}\(.*?(?=^\S)', 글 + '\nEND', re.S | re.M)
        if 몸:
            줄.append('\n'.join(몸.group(0).rstrip().splitlines()[:25]))
    return 줄


def 살펴보기(space: str) -> dict:
    from huggingface_hub import HfApi, hf_hub_download
    토큰 = _토큰()
    정보 = HfApi().space_info(space, token=토큰, files_metadata=False)
    rt = 정보.runtime
    duration줄 = []
    py파일 = [x.rfilename for x in (정보.siblings or []) if x.rfilename.endswith('.py')][:15]
    for 이름 in py파일:
        try:
            글 = Path(hf_hub_download(space, 이름, repo_type='space', token=토큰)).read_text(encoding='utf-8', errors='replace')
        except Exception:  # noqa: BLE001
            continue
        duration줄 += duration찾기(이름, 글)
    try:
        api목록 = sorted((_클라이언트만들기(space, 토큰, 상태폴더() / '살펴보기').view_api(print_info=False, return_format='dict')
                        or {}).get('named_endpoints', {}))
    except Exception as e:  # noqa: BLE001
        api목록 = [f'(못 읽음: {type(e).__name__}: {str(e)[:200]})']
    return {'space': space, '하드웨어': getattr(rt, 'hardware', None), '상태': getattr(rt, 'stage', None),
            '비공개': 정보.private, 'duration': duration줄[:20], 'api': api목록}


# ── 허깅페이스 먼저 · 남은 것만 로컬 ──────────────────────────────────────
# 11-02 유호님 「가능한것들은 전부 먼저 허깅페이스 gpu 먼저 사용하고나서 남은걸 로컬로」. 허깅페이스로 해도 결과가 같은
# 일만 여기 둔다(목소리 떼기 · 받아쓰기 확인). 결과가 달라지는 일(얼굴 업스케일 · 그림 생성)은 로컬이 주력이다.
# 몫이 모자라거나 · 멈춤이거나 · Space가 두 번 잇달아 실패하면(실패도 몫을 깎는다) 남은 것을 로컬로 돌린다.

def _경로(환경, 기본) -> Path:
    return Path(os.environ.get(환경) or 기본)


로컬 = {
    'demucs파이썬': _경로('SYNK_DEMUCS_PY', r'C:\SYNK-LoRA\tools\demucs\venv\Scripts\python.exe'),
    'demucs떼기': _경로('SYNK_DEMUCS_SCRIPT', r'C:\SYNK-LoRA\tools\demucs\목소리떼기.py'),
    '차례': _경로('SYNK_GPU_QUEUE', Path.home() / 'Documents' / 'synk-vendor' / '_공용차례' / '차례.py'),
}
떼기space = 'hugging-apps/bs-roformer-leap-audio-separator'
받아쓰기space = 'hf-audio/whisper-large-v3'


def _소리맞추기(입력, 출력, 표본율=44100, 채널=2) -> None:
    """로컬 목소리떼기.py와 같은 꼴(44.1kHz 스테레오 16비트 wav)로 — 영상 파일도 소리만 뽑는다."""
    import subprocess
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(입력), '-vn', '-ac', str(채널), '-ar', str(표본율),
                    '-c:a', 'pcm_s16le', str(출력)], check=True, stdin=subprocess.DEVNULL)


def _낮게돌리기(명령: list) -> int:
    """CPU로 돌 때 다른 세션 브라우저가 멈추지 않게 가장 낮은 우선순위로(현장노트 영상 「Demucs CPU」)."""
    import subprocess
    return subprocess.run(명령, stdin=subprocess.DEVNULL, creationflags=getattr(subprocess, 'IDLE_PRIORITY_CLASS', 0)).returncode


def _줄서서돌리기(이름: str, 할일: str, 상한분: int, 명령: list) -> int:
    """공용 GPU 줄(synk-vendor/_공용차례/차례.py gpu 돌리기)에 서서 돌린다 — 차례가 오면 돌고 끝나면 결과 코드를 준다."""
    import subprocess
    return subprocess.run([sys.executable, '-X', 'utf8', str(로컬['차례']), 'gpu', '돌리기', 이름, 할일,
                           '--상한', str(max(1, min(240, 상한분))), '--', *명령], stdin=subprocess.DEVNULL).returncode


def _허깅페이스먼저(입력들: list, 한개: callable, 로컬만: bool, 남에게보내도됨: bool, 일이름: str):
    """입력마다 허깅페이스로 해 보고 (해낸 것, 남은 것, 까닭)을 준다. 한개(입력)는 해낸 결과를 돌려준다."""
    if 로컬만:
        return [], list(입력들), '--로컬만'
    if not 남에게보내도됨:
        return [], list(입력들), '남의 Space에 보내도 되는 자료라는 --남에게보내도됨이 없어 로컬로(얼굴 · 고객 · 학생 자료는 보내지 않는다)'
    해냄, 남음, 까닭, 잇단실패 = [], [], '', 0
    for i, 입력 in enumerate(입력들):
        if 까닭:
            남음.append(입력)
            continue
        try:
            해냄.append(한개(입력))
            잇단실패 = 0
        except (한도모자람, 멈춰있음) as e:
            까닭 = f'허깅페이스 몫 밖: {e}'
            남음.append(입력)
        except Exception as e:  # noqa: BLE001 — Space 쪽 실패는 로컬로 넘긴다
            잇단실패 += 1
            남음.append(입력)
            print(f'{일이름} 허깅페이스 실패({Path(str(입력)).name}): {type(e).__name__}: {str(e)[:200]}', file=sys.stderr)
            if 잇단실패 >= 2:
                까닭 = 'Space가 두 번 잇달아 실패해 나머지는 로컬로(실패한 호출도 몫을 깎는다)'
    return 해냄, 남음, 까닭


def 목소리떼기(출력폴더, 입력들: list, 로컬만=False, cpu=False, 남에게보내도됨=False, 메모='') -> dict:
    """허깅페이스 BS-RoFormer 먼저, 남은 것만 로컬 Demucs(공용 GPU 줄 · --cpu면 낮은 우선순위 CPU).
    결과는 로컬 목소리떼기.py와 같은 이름 `<이름>_목소리.wav` · `<이름>_바탕.wav`, 엔진은 `떼기기록.json`에 남긴다."""
    import tempfile
    출력폴더 = Path(출력폴더)
    출력폴더.mkdir(parents=True, exist_ok=True)
    for x in 입력들:
        if not Path(x).is_file():
            raise FileNotFoundError(f'뗄 파일이 없다: {x}')

    def 한개(입력):
        이름 = Path(입력).stem
        with tempfile.TemporaryDirectory() as 임시:
            wav = Path(임시) / f'{이름}.wav'
            _소리맞추기(입력, wav)
            out = 지키며_부르기(떼기space, 인자=[{'$파일': str(wav)}, 'Standard — Vocals'], 받을곳=Path(임시) / '받음',
                            남에게보내도됨=True, 메모=메모 or f'목소리떼기 {이름}')
            목소리, 바탕 = out['결과']
            _소리맞추기(목소리, 출력폴더 / f'{이름}_목소리.wav')
            _소리맞추기(바탕, 출력폴더 / f'{이름}_바탕.wav')
        return {'파일': str(입력), '엔진': '허깅페이스 BS-RoFormer', '왕복초': out['왕복초'], '쓴초': out['쓴초']}

    해냄, 남음, 까닭 = _허깅페이스먼저(입력들, 한개, 로컬만, 남에게보내도됨, '목소리떼기')
    코드 = 0
    if 남음:
        print(f'로컬 Demucs로 {len(남음)}개 — {까닭 or "허깅페이스 실패"}', file=sys.stderr)
        명령 = [str(로컬['demucs파이썬']), '-X', 'utf8', str(로컬['demucs떼기']), str(출력폴더), *map(str, 남음)]
        if cpu:
            코드 = _낮게돌리기(명령)
        else:
            코드 = _줄서서돌리기('목소리떼기-허깅페이스밖', f'목소리 떼기 {len(남음)}개(허깅페이스 몫 밖)', 10 + 2 * len(남음),
                           [*명령, '--gpu'])
        엔진 = '로컬 Demucs htdemucs_ft' + (' CPU' if cpu else ' GPU')
        해냄 += [{'파일': str(x), '엔진': 엔진 if 코드 == 0 else f'{엔진} 실패(코드 {코드})'} for x in 남음]
    기록파일 = 출력폴더 / '떼기기록.json'
    try:
        옛 = json.loads(기록파일.read_text(encoding='utf-8'))
    except (FileNotFoundError, json.JSONDecodeError):
        옛 = []
    _json쓰기(기록파일, 옛 + [{**x, '때': dt.datetime.now(KST).isoformat(timespec='seconds')} for x in 해냄])
    return {'결과': 해냄, '로컬로간까닭': 까닭 if 남음 else '', '코드': 코드}


def _로컬받아쓰기(파일들: list, 언어: str | None, 모델: str = 'large-v3') -> list:
    """faster-whisper CPU int8(이 PC는 CUDA 12 dll이 없어 GPU로 못 돈다 — 현장노트 영상) · 이 프로세스를 낮은 우선순위로."""
    if sys.platform == 'win32':
        import ctypes
        ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x40)   # IDLE_PRIORITY_CLASS
    from faster_whisper import WhisperModel
    m = WhisperModel(모델, device='cpu', compute_type='int8')
    out = []
    for f in 파일들:
        시작 = time.time()
        조각, _ = m.transcribe(str(f), language=언어, beam_size=5)
        out.append({'파일': str(f), '글': ' '.join(s.text.strip() for s in 조각).strip(),
                    '엔진': f'로컬 faster-whisper {모델} CPU', '왕복초': round(time.time() - 시작, 1)})
    return out


def 받아쓰기(파일들: list, 로컬만=False, 남에게보내도됨=False, 언어: str | None = None, 메모='') -> dict:
    """허깅페이스 whisper-large-v3 먼저, 남은 것만 로컬 faster-whisper large-v3. 글만(낱말 시각 없음)."""
    import tempfile
    for x in 파일들:
        if not Path(x).is_file():
            raise FileNotFoundError(f'받아쓸 파일이 없다: {x}')

    def 한개(입력):
        with tempfile.TemporaryDirectory() as 임시:
            wav = Path(임시) / f'{Path(입력).stem}.wav'
            _소리맞추기(입력, wav, 16000, 1)   # 올리는 양을 줄인다(whisper는 16kHz 모노로 듣는다)
            out = 지키며_부르기(받아쓰기space, 인자=[{'$파일': str(wav)}, 'transcribe'], 받을곳=Path(임시) / '받음',
                            남에게보내도됨=True, 메모=메모 or f'받아쓰기 {Path(입력).name}')
        return {'파일': str(입력), '글': str(out['결과']).strip(), '엔진': '허깅페이스 whisper-large-v3',
                '왕복초': out['왕복초'], '쓴초': out['쓴초']}

    해냄, 남음, 까닭 = _허깅페이스먼저(파일들, 한개, 로컬만, 남에게보내도됨, '받아쓰기')
    if 남음:
        print(f'로컬 받아쓰기로 {len(남음)}개 — {까닭 or "허깅페이스 실패"}', file=sys.stderr)
        해냄 += _로컬받아쓰기(남음, 언어)
    차례 = {str(x): i for i, x in enumerate(파일들)}
    return {'결과': sorted(해냄, key=lambda x: 차례[x['파일']]), '로컬로간까닭': 까닭 if 남음 else ''}


# ── 명령줄 ─────────────────────────────────────────────────────────────

def _명령_한도(a) -> int:
    한도 = 한도읽기()
    if a.json:
        print(json.dumps({**한도, '초기화': 한도['초기화'].isoformat() if 한도['초기화'] else None}, ensure_ascii=False))
        return 0
    with _잠금(상태폴더()):
        잡힌 = sum(x['초'] for x in _예약읽기(상태폴더(), time.time()))
    print(f'ZeroGPU 남은 {한도["남은"]:.0f}초 / {한도["기본"]:.0f}초({한도["남은"] / 60:.1f}분) · 다른 세션 예약 {잡힌:.0f}초'
          f' · 넘친 {한도["넘친"]:.1f}초 · 초기화 {_시각(한도["초기화"])}')
    멈춤 = 멈춤보기()
    if 멈춤:
        print(f'멈춤: {멈춤.get("까닭")} ({멈춤.get("때")})')
    return 0


def _명령_목록(a) -> int:
    for x in 목록읽기().values():
        print(f'{x["id"]}  {x["api"]}  예상 {x["예상초"]}초×{x.get("배수", 1)}  — {x["용도"]}')
    return 0


def _명령_살펴보기(a) -> int:
    print(json.dumps(살펴보기(a.space), ensure_ascii=False, indent=1))
    return 0


def _명령_부르기(a) -> int:
    out = 지키며_부르기(a.space, a.api, json.loads(a.인자) if a.인자 else None, json.loads(a.이름인자) if a.이름인자 else None,
                   a.예상초, a.배수, a.여유, a.받을곳, a.남에게보내도됨, a.메모)
    if a.json:
        print(json.dumps(out, ensure_ascii=False, default=str))
    else:
        print(f'됨 — 왕복 {out["왕복초"]}초 · 쓴 {out["쓴초"]}초 · 남은 {out["남은초"]}초 · 받을곳 {out["받을곳"]}')
        print(json.dumps(out['결과'], ensure_ascii=False, default=str)[:4000])
    if out['넘침']:
        print('넘친 초가 늘었다 — 멈춤을 걸었다. 결제 화면에서 크레딧이 나갔는지 보고 `풀기 --확인`', file=sys.stderr)
        return 3
    return 0


def _명령_목소리떼기(a) -> int:
    out = 목소리떼기(a.출력폴더, a.입력, a.로컬만, a.cpu, a.남에게보내도됨, a.메모)
    for x in out['결과']:
        print(f'{Path(x["파일"]).name}  {x["엔진"]}' + (f' · 왕복 {x["왕복초"]}초 · 쓴 {x["쓴초"]}초' if '왕복초' in x else ''))
    return out['코드']


def _명령_받아쓰기(a) -> int:
    out = 받아쓰기(a.파일, a.로컬만, a.남에게보내도됨, a.언어, a.메모)
    if a.json:
        print(json.dumps(out, ensure_ascii=False))
    else:
        for x in out['결과']:
            print(f'{Path(x["파일"]).name}  [{x["엔진"]} · {x["왕복초"]}초]  {x["글"]}')
    return 0


def _명령_기록(a) -> int:
    날 = a.날 or dt.datetime.now(KST).strftime('%Y-%m-%d')
    try:
        줄 = [json.loads(x) for x in (상태폴더() / '사용기록.jsonl').read_text(encoding='utf-8').splitlines() if x.strip()]
    except FileNotFoundError:
        줄 = []
    줄 = [x for x in 줄 if x['때'].startswith(날)]
    합 = {}
    for x in 줄:
        s = 합.setdefault(x['space'], {'번': 0, '쓴초': 0.0, '실패': 0})
        s['번'] += 1
        s['쓴초'] += x['쓴초'] or 0
        s['실패'] += x['결과'] != '됨'
    for space, s in 합.items():
        print(f'{날}  {space}  {s["번"]}번(실패 {s["실패"]}) · 쓴 {s["쓴초"]:.1f}초')
    if not 합:
        print(f'{날} 기록 없음')
    return 0


def _명령_풀기(a) -> int:
    멈춤 = 멈춤보기()
    if not 멈춤:
        print('멈춤 없음')
        return 0
    print(f'멈춤: {멈춤.get("까닭")} ({멈춤.get("때")})')
    if not a.확인:
        print('결제 화면(huggingface.co/settings/billing)에서 크레딧이 나갔는지 본 뒤 --확인을 붙여 다시 부른다')
        return 2
    (상태폴더() / '멈춤.json').unlink()
    print('풀었다')
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog='허깅페이스.py', description='ZeroGPU 한도를 지키며 Space를 부른다')
    sub = p.add_subparsers(dest='명령', required=True)
    s = sub.add_parser('한도'); s.add_argument('--json', action='store_true'); s.set_defaults(fn=_명령_한도)
    s = sub.add_parser('목록'); s.set_defaults(fn=_명령_목록)
    s = sub.add_parser('살펴보기'); s.add_argument('space'); s.set_defaults(fn=_명령_살펴보기)
    s = sub.add_parser('부르기')
    s.add_argument('space')
    s.add_argument('--api')
    s.add_argument('--인자', help='JSON 배열(차례 인자). 파일은 {"$파일": "경로"}')
    s.add_argument('--이름인자', help='JSON 객체(이름 인자)')
    s.add_argument('--예상초', type=float, help='그 Space의 @spaces.GPU duration 최댓값')
    s.add_argument('--배수', type=float, help='크기 배수(large 1 · xlarge 2)')
    s.add_argument('--여유', type=float, default=기본여유초)
    s.add_argument('--받을곳')
    s.add_argument('--남에게보내도됨', action='store_true')
    s.add_argument('--메모', default='')
    s.add_argument('--json', action='store_true')
    s.set_defaults(fn=_명령_부르기)
    s = sub.add_parser('목소리떼기', help='허깅페이스 먼저, 남은 것만 로컬 Demucs')
    s.add_argument('출력폴더')
    s.add_argument('입력', nargs='+')
    s.add_argument('--로컬만', action='store_true')
    s.add_argument('--cpu', action='store_true', help='로컬로 갈 때 공용 GPU 줄 대신 낮은 우선순위 CPU')
    s.add_argument('--남에게보내도됨', action='store_true', help='얼굴 · 고객 · 학생 자료가 아니라는 확인(없으면 모두 로컬)')
    s.add_argument('--메모', default='')
    s.set_defaults(fn=_명령_목소리떼기)
    s = sub.add_parser('받아쓰기', help='허깅페이스 먼저, 남은 것만 로컬 faster-whisper')
    s.add_argument('파일', nargs='+')
    s.add_argument('--로컬만', action='store_true')
    s.add_argument('--남에게보내도됨', action='store_true', help='얼굴 · 고객 · 학생 자료가 아니라는 확인(없으면 모두 로컬)')
    s.add_argument('--언어', help='로컬로 갈 때 언어(ko 등, 없으면 알아서)')
    s.add_argument('--메모', default='')
    s.add_argument('--json', action='store_true')
    s.set_defaults(fn=_명령_받아쓰기)
    s = sub.add_parser('기록'); s.add_argument('--날'); s.set_defaults(fn=_명령_기록)
    s = sub.add_parser('풀기'); s.add_argument('--확인', action='store_true'); s.set_defaults(fn=_명령_풀기)
    a = p.parse_args(argv)
    try:
        return a.fn(a)
    except (한도모자람, 멈춰있음, PermissionError) as e:   # 막은 것 — 부르지 않았다
        print(e, file=sys.stderr)
        return 2
    except (ValueError, FileNotFoundError) as e:         # 인자가 모자라거나 틀렸다
        print(e, file=sys.stderr)
        return 1


if __name__ == '__main__':
    for 줄 in (sys.stdout, sys.stderr):
        with contextlib.suppress(AttributeError):
            줄.reconfigure(encoding='utf-8')
    sys.exit(main())
