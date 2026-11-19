"""공모 공고 첨부(PDF · HWP · HWPX · 그림)에서 글을 뽑는다(2026-11-20).

왜: 공모 공고는 본문이 포스터 그림 한 장이거나 자격 · 마감 · 제출물이 첨부 PDF · HWP에만 있는 경우가 많다.
  11-20 자격 확인에서 원문을 못 읽은 공고 33건 대부분이 그랬다(유호님 11-20 「다섯 개 다 해」 가운데 둘째).

  python -I -X utf8 tools/공고첨부글.py <파일> [--형식 pdf|hwp|hwpx|그림] [--최대쪽 8]

- PDF: 쪽마다 글을 뽑고, 글이 거의 없는 쪽(스캔 · 그림 공고)은 그림으로 그려 윈도우 글자 인식으로 읽는다.
- HWP · HWPX: tools/hwp읽기.py로 읽는다.
- 그림: 긴 그림은 겹치게 잘라 윈도우 글자 인식(tools/lib/글자인식.ps1, 한국어)으로 한 번에 읽는다. 작은 그림은 키워서 읽는다.
글은 표준 출력(UTF-8)으로 낸다. 바깥 AI로 보내지 않는다.
"""
import argparse, json, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OCR = ROOT / 'tools' / 'lib' / '글자인식.ps1'
HWP = ROOT / 'tools' / 'hwp읽기.py'
조각높이, 겹침 = 2200, 120


def 글자인식(폴더):
    """폴더 안 그림을 이름 차례로 읽어 줄 글을 잇는다(윈도우 파워셸 5.1에서만 된다)."""
    r = subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(OCR), '-Dir', str(폴더)],
                       capture_output=True, timeout=600)
    if r.returncode != 0:
        raise RuntimeError('글자 인식 실패: ' + r.stderr.decode('utf-8', 'replace')[-300:])
    결과 = json.loads(r.stdout.decode('utf-8-sig', 'replace') or '[]')
    if isinstance(결과, dict):
        결과 = [결과]
    줄 = []
    for 장 in sorted(결과, key=lambda x: x.get('name', '')):
        lines = 장.get('lines') or []
        if isinstance(lines, dict):
            lines = [lines]
        줄.extend(l.get('text', '') for l in lines)
    return '\n'.join(줄)


def 조각내기(경로, 폴더, 머리):
    """그림을 너비 1200~2400px로 맞추고 겹치게 잘라 폴더에 둔다."""
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = 80_000_000
    im = Image.open(경로).convert('RGB')
    if im.width < 1200:
        im = im.resize((1200, int(im.height * 1200 / im.width)), Image.LANCZOS)
    if im.width > 2400:
        im = im.resize((2400, int(im.height * 2400 / im.width)), Image.LANCZOS)
    위, n = 0, 0
    while 위 < im.height and n < 30:
        아래 = min(im.height, 위 + 조각높이)
        im.crop((0, 위, im.width, 아래)).save(Path(폴더) / f'{머리}_{n:02d}.png')
        if 아래 >= im.height:
            break
        위 = 아래 - 겹침
        n += 1


def 그림글(경로):
    with tempfile.TemporaryDirectory() as d:
        조각내기(경로, d, 'a')
        return 글자인식(d)


def pdf글(경로, 최대쪽):
    import pymupdf
    doc = pymupdf.open(경로)
    글 = []
    with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as 그림:
        for i, page in enumerate(doc):
            if i >= 최대쪽:
                break
            t = page.get_text()
            if len(t.strip()) >= 80:
                글.append(t)
                continue
            p = Path(그림) / f'p{i:02d}.png'
            page.get_pixmap(dpi=170).save(p)
            조각내기(p, d, f'p{i:02d}')
        if any(Path(d).iterdir()):
            글.append(글자인식(d))
    return '\n'.join(글)


def hwp글(경로):
    r = subprocess.run([sys.executable, '-I', '-X', 'utf8', str(HWP), str(경로), '--표없이'], capture_output=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError('HWP 읽기 실패: ' + r.stderr.decode('utf-8', 'replace')[-300:])
    return r.stdout.decode('utf-8', 'replace')


def 형식알기(경로, 형식):
    if 형식:
        return 형식
    머리 = Path(경로).read_bytes()[:8]
    if 머리.startswith(b'%PDF'):
        return 'pdf'
    if 머리.startswith(b'\xd0\xcf\x11\xe0'):
        return 'hwp'
    if 머리.startswith(b'PK'):
        return 'hwpx'
    return '그림'


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('파일')
    ap.add_argument('--형식', choices=['pdf', 'hwp', 'hwpx', '그림'])
    ap.add_argument('--최대쪽', type=int, default=8)
    a = ap.parse_args(argv)
    형식 = 형식알기(a.파일, a.형식)
    if 형식 == 'pdf':
        글 = pdf글(a.파일, a.최대쪽)
    elif 형식 in ('hwp', 'hwpx'):
        글 = hwp글(a.파일)
    else:
        글 = 그림글(a.파일)
    sys.stdout.buffer.write(글.encode('utf-8'))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
