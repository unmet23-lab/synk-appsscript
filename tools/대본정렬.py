# 대본 정렬 공용 도구 — 대본을 이미 아는 말소리에 대본 낱말의 시작 · 끝 시각을 붙인다(2026-11-11, 유료 호출 없음).
#   받아쓰기(faster-whisper) 낱말 시각 대신 쓴다. 11-11 드라마 1화 36줄 실측: 첫소리 · 말끝 절대 가운데 오차 30ms(받아쓰기 100 · 190ms).
#   모델 Qwen3-ForcedAligner-0.6B(Apache-2.0, qwen-asr 0.0.6). 시각은 80ms 칸이다. 웃음 같은 낱말 아닌 소리와 노래는 못 맞춘다.
#   한국어 낱말은 soynlp 조각(「편하 · 게」)이라 음절 시각은 안 나온다. 한 번에 5분까지.
#   언어: ko en ja zh yue fr de it pt ru es(몽골어 · 베트남어 · 동남아 말은 없다).
#
#   python -X utf8 tools/대본정렬.py 설치 [--큰받기]
#       따로 환경(ASCII 경로)과 모델을 깐다 — uv가 있어야 한다. 이미 맞게 받은 모델 파일은 sha256만 대조하고 건너뛴다.
#       받을 양이 1GB를 넘으면(모델 1.84GB · torch는 uv 캐시에 없을 때 약 2.5GB) --큰받기 없이는 멈춘다 — 핫스팟인지 먼저 본다.
#   python -X utf8 tools/대본정렬.py 정렬 <소리> (--글 "<대본>" | --글파일 <대본.txt>) [--언어 ko] [--장치 cpu] [-o 결과.json]
#   python -X utf8 tools/대본정렬.py 묶음 <요청.json> -o <결과.json> [--장치 cpu]
#       요청: [{"소리": 경로, "글": 대본, "언어": "ko"}, …] — 모델을 한 번 싣고 차례로 맞춘다.
#   다른 파이썬 도구에서: import 대본정렬; 대본정렬.맞추기([{"소리": …, "글": …}]) → [{"낱말": [{"글", "시작", "끝"}], …}]
#
# 어느 파이썬으로 불러도 된다 — qwen_asr가 없는 파이썬이면 따로 환경의 파이썬으로 다시 띄운다.
# 기본 장치는 CPU다(40초 소리 2.3초 · 싣기 3초, GPU를 쓰는 작업과 부딪히지 않음). --장치 cuda는 GPU 줄(차례.py gpu 돌리기) 안에서만.
# 깔린 곳(Windows에서는 한글 경로에 깔면 못 싣는다 — 이슈 QwenLM/Qwen3-ASR#214):
#   환경 SYNK_ALIGN_PY(기본 D:\SYNK-LoRA\tools\qwen-align\venv\Scripts\python.exe) · 모델 SYNK_ALIGN_MODEL(기본 D:\SYNK-LoRA\models\Qwen3-ForcedAligner-0.6B)
import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ENV_DIR = os.environ.get('SYNK_ALIGN_HOME', r'D:\SYNK-LoRA\tools\qwen-align')
PY = os.environ.get('SYNK_ALIGN_PY', os.path.join(ENV_DIR, 'venv', 'Scripts', 'python.exe'))
MODEL = os.environ.get('SYNK_ALIGN_MODEL', r'D:\SYNK-LoRA\models\Qwen3-ForcedAligner-0.6B')
REPO, REV = 'Qwen/Qwen3-ForcedAligner-0.6B', 'c7cbfc2048c462b0d63a45797104fc9db3ad62b7'
PKGS = ['torch==2.10.0', 'torchaudio==2.10.0']
TORCH_INDEX = 'https://download.pytorch.org/whl/cu128'
QWEN_ASR = 'qwen-asr==0.0.6'
LANGS = {'ko': 'Korean', 'en': 'English', 'ja': 'Japanese', 'zh': 'Chinese', 'yue': 'Cantonese', 'fr': 'French',
         'de': 'German', 'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'es': 'Spanish'}
MAX_SECONDS = 300.0
SR = 16000
FFMPEG = os.environ.get('SYNK_FFMPEG_EXE', 'ffmpeg')


class 정렬오류(Exception):
    pass


def 언어이름(code):
    c = (code or 'ko').split('-')[0].lower()
    if c in LANGS:
        return LANGS[c]
    if (code or '').capitalize() in LANGS.values():
        return code.capitalize()
    raise 정렬오류(f'정렬기가 모르는 언어다: {code} (되는 것: {" ".join(LANGS)})')


def 깔렸나():
    return os.path.exists(PY) and os.path.exists(os.path.join(MODEL, 'model.safetensors'))


# ── 바깥 파이썬에서 부르기 ───────────────────────────────────────────────
def 맞추기(requests, device='cpu'):
    """[{소리, 글, 언어?}] → [{낱말: [{글, 시작, 끝}], 소리초, 언어, …}]. 따로 환경의 파이썬을 한 번 띄워 모두 맞춘다."""
    if not 깔렸나():
        raise 정렬오류(f'정렬기가 안 깔렸다 — python -X utf8 tools/대본정렬.py 설치 (환경 {PY} · 모델 {MODEL})')
    with tempfile.TemporaryDirectory() as d:
        req, out = os.path.join(d, 'req.json'), os.path.join(d, 'out.json')
        with open(req, 'w', encoding='utf-8') as fh:
            json.dump(requests, fh, ensure_ascii=False)
        r = subprocess.run([PY, '-X', 'utf8', os.path.abspath(__file__), '묶음', req, '-o', out, '--장치', device],
                           capture_output=True, text=True, encoding='utf-8', errors='replace', stdin=subprocess.DEVNULL)
        if r.returncode != 0 or not os.path.exists(out):
            raise 정렬오류('정렬기 실행 실패: ' + (r.stderr or r.stdout)[-800:])
        with open(out, encoding='utf-8') as fh:
            return json.load(fh)


# ── 따로 환경 안에서 맞추기 ─────────────────────────────────────────────
def _decode(path):
    import numpy as np
    r = subprocess.run([FFMPEG, '-v', 'error', '-nostdin', '-i', path, '-vn', '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                       capture_output=True, stdin=subprocess.DEVNULL)
    if r.returncode != 0:
        raise 정렬오류('소리를 읽지 못했다: ' + path + ' ' + r.stderr.decode('utf-8', 'replace')[-300:])
    return np.frombuffer(r.stdout, np.int16).astype(np.float32) / 32768


def _run_inside(requests, device):
    import warnings
    warnings.filterwarnings('ignore')
    import torch
    from qwen_asr import Qwen3ForcedAligner
    t0 = time.time()
    dtype = torch.bfloat16 if device.startswith('cuda') else torch.float32
    al = Qwen3ForcedAligner.from_pretrained(MODEL, dtype=dtype, device_map=device)
    load_s = time.time() - t0
    results = []
    for q in requests:
        x = _decode(q['소리'])
        sec = len(x) / SR
        if sec > MAX_SECONDS:
            raise 정렬오류(f'{q["소리"]}: {sec:.0f}초 — 한 번에 {MAX_SECONDS:.0f}초까지다. 쉼에서 나눠 넣는다')
        text = str(q['글']).strip()
        if not text:
            raise 정렬오류(f'{q["소리"]}: 대본이 비었다')
        t = time.time()
        r = al.align(audio=(x, SR), text=text, language=언어이름(q.get('언어')))[0]
        items = [{'글': it.text, '시작': round(float(it.start_time), 3), '끝': round(float(it.end_time), 3)} for it in r]
        results.append({'소리': q['소리'], '소리초': round(sec, 3), '언어': 언어이름(q.get('언어')), '낱말': items,
                        '길이0': sum(1 for it in items if it['끝'] <= it['시작']), '걸림초': round(time.time() - t, 2),
                        '장치': device, '모델': f'{REPO}@{REV[:7]}', '칸초': 0.08})
    if results:
        results[0]['싣기초'] = round(load_s, 1)
    return results


def _need_reexec():
    try:
        import qwen_asr  # noqa: F401
        return False
    except ImportError:
        return True


# ── 설치 ────────────────────────────────────────────────────────────────
def _sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for b in iter(lambda: fh.read(1 << 24), b''):
            h.update(b)
    return h.hexdigest()


def _fetch(url, out, size):
    """이어 받기(Range) — 끊기면 받은 데까지 두고 다시 잇는다."""
    part = out + '.part'
    for attempt in range(20):
        have = os.path.getsize(part) if os.path.exists(part) else 0
        if have >= size:
            break
        try:
            req = urllib.request.Request(url, headers={'Range': f'bytes={have}-'} if have else {})
            with urllib.request.urlopen(req, timeout=60) as r, open(part, 'ab' if have else 'wb') as fo:
                while True:
                    b = r.read(1 << 20)
                    if not b:
                        break
                    fo.write(b)
        except Exception as e:  # noqa: BLE001
            print(f'  끊김 {attempt + 1}: {e!r} — {have}바이트에서 잇는다', flush=True)
            time.sleep(min(30, 3 + attempt * 2))
    if not os.path.exists(part) or os.path.getsize(part) != size:
        raise 정렬오류(f'받기 실패: {url}')
    os.replace(part, out)


def 설치(big_ok=False):
    if not os.path.exists(PY):
        for cmd in (['uv', 'venv', '--python', '3.12', os.path.join(ENV_DIR, 'venv')],
                    ['uv', 'pip', 'install', '--python', PY] + PKGS + ['--index-url', TORCH_INDEX],
                    ['uv', 'pip', 'install', '--python', PY, QWEN_ASR]):
            print('>', ' '.join(cmd), flush=True)
            subprocess.run(cmd, check=True)
    else:
        print('환경 있음:', PY)
    os.makedirs(MODEL, exist_ok=True)
    tree = json.load(urllib.request.urlopen(f'https://huggingface.co/api/models/{REPO}/tree/{REV}?recursive=true', timeout=60))
    todo = []
    for f in tree:
        if f.get('type') != 'file':
            continue
        p = f['path']
        if not p.endswith(('.safetensors', '.json', '.txt', '.md', '.gitattributes')):
            print('건너뜀(허용 밖 꼴):', p)
            continue
        out = os.path.join(MODEL, *p.split('/'))
        want = (f.get('lfs') or {}).get('oid')
        if os.path.exists(out) and os.path.getsize(out) == f.get('size') and (not want or _sha256(out) == want):
            print('있음', p)
            continue
        todo.append((p, out, f.get('size') or 0, want))
    total = sum(t[2] for t in todo)
    if total > 1_000_000_000 and not big_ok:
        raise 정렬오류(f'받을 양이 {total / 1e9:.2f}GB다 — 핫스팟이 아닌지 보고 --큰받기로 다시 부른다')
    for p, out, size, want in todo:
        print('받기', p, size, '바이트', flush=True)
        _fetch(f'https://huggingface.co/{REPO}/resolve/{REV}/{p}', out, size)
        if want and _sha256(out) != want:
            os.remove(out)
            raise 정렬오류(f'해시 불일치: {p}')
    print('설치 끝 — 확인: python -X utf8 tools/대본정렬.py 정렬 <소리> --글 "<대본>"')


# ── 명령 ────────────────────────────────────────────────────────────────
def main(argv=None):
    ap = argparse.ArgumentParser(description='대본 정렬(Qwen3-ForcedAligner)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    i = sub.add_parser('설치')
    i.add_argument('--큰받기', action='store_true')
    a = sub.add_parser('정렬')
    a.add_argument('소리')
    a.add_argument('--글')
    a.add_argument('--글파일')
    a.add_argument('--언어', default='ko')
    a.add_argument('--장치', default='cpu')
    a.add_argument('-o', '--out')
    b = sub.add_parser('묶음')
    b.add_argument('요청')
    b.add_argument('-o', '--out', required=True)
    b.add_argument('--장치', default='cpu')
    args = ap.parse_args(argv)
    if args.cmd == '설치':
        설치(args.큰받기)
        return 0
    if _need_reexec():
        if not 깔렸나():
            print(f'정렬기가 안 깔렸다 — python -X utf8 tools/대본정렬.py 설치 (환경 {PY} · 모델 {MODEL})', file=sys.stderr)
            return 2
        return subprocess.run([PY, '-X', 'utf8', os.path.abspath(__file__)] + (argv if argv is not None else sys.argv[1:]), stdin=subprocess.DEVNULL).returncode
    if args.cmd == '정렬':
        if bool(args.글) == bool(args.글파일):
            print('--글이나 --글파일 하나를 준다', file=sys.stderr)
            return 2
        text = args.글 if args.글 else open(args.글파일, encoding='utf-8-sig').read()
        res = _run_inside([{'소리': args.소리, '글': text, '언어': args.언어}], args.장치)[0]
        s = json.dumps(res, ensure_ascii=False, indent=1)
        if args.out:
            with open(args.out, 'w', encoding='utf-8') as fh:
                fh.write(s)
        print(s if not args.out else f"{args.out} · 낱말 {len(res['낱말'])} · 길이0 {res['길이0']} · {res['걸림초']}초")
        return 0
    with open(args.요청, encoding='utf-8-sig') as fh:
        reqs = json.load(fh)
    res = _run_inside(reqs, args.장치)
    with open(args.out, 'w', encoding='utf-8') as fh:
        json.dump(res, fh, ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except 정렬오류 as e:
        print('대본정렬:', e, file=sys.stderr)
        sys.exit(1)
