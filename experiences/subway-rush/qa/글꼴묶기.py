"""환승 러시 글꼴 묶기(2026-11-04): 게임에 나오는 글자만 추려 assets/fonts에 낸다. 원본은 저장소 밖 Documents/synk-vendor/fonts.

표지 · 안내문 · 스티커 = Noto Sans KR(가변 · 본고딕 계열 · OFL), LED 전광판 = Neo둥근모(16도트 비트맵 · OFL, 도트로 찍어 씀).
OFL 예약 이름을 지키려고 이름 표를 비우고 파일도 sign · led로 부른다(라이선스 전문은 assets/fonts/ 안에 함께 둔다).
글을 고치면 다시 돌린다.
  python -I -X utf8 experiences/subway-rush/qa/글꼴묶기.py
"""
import re
import shutil
from pathlib import Path

from fontTools import subset

HERE = Path(__file__).resolve().parent
GAME = HERE.parent
VENDOR = Path.home() / 'Documents' / 'synk-vendor' / 'fonts'
OUT = GAME / 'assets' / 'fonts'
OUT.mkdir(parents=True, exist_ok=True)

text = set(' !?…·,.:;()[]/-+「」『』~%0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ←→↑↓')
for name in ['app.mjs', 'journeys.mjs', 'people.mjs', 'lines.mjs', 'index.html', 'core.mjs']:
    text |= set(re.findall(r'[가-힣]', (GAME / name).read_text(encoding='utf-8')))


def run(src, dest, extra=()):
    args = [str(src), f'--text={"".join(sorted(text))}', f'--output-file={dest}', '--flavor=woff2', '--layout-features=*', '--name-IDs=', '--notdef-outline', *extra]
    subset.main(args)
    print(dest.name, dest.stat().st_size // 1024, 'KB', len(text), '글자')


run(VENDOR / 'NotoSansKR.ttf', OUT / 'sign.woff2')
run(VENDOR / 'neodgm.ttf', OUT / 'led.woff2')
shutil.copy(VENDOR / 'OFL-notosanskr.txt', OUT / 'OFL-sign.txt')
shutil.copy(VENDOR / 'OFL-neodgm.txt', OUT / 'OFL-led.txt')
