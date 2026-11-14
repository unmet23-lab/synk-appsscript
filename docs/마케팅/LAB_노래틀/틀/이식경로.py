"""song.json 「_출처」에 남기는 바깥 파일 경로(2026-11-15 Claude) — 저장소가 공개라 사용자 폴더 경로를 적지 않는다.

  줄이기(경로) → synk-vendor 아래는 'synk-vendor/<나머지>', 사용자 폴더 아래는 '~/<나머지>', 그 밖의 절대 경로는 파일 이름만.
  풀기(적은 값) → 그 PC의 실제 경로. synk-vendor 뿌리는 환경 변수 SYNK_VENDOR · ~/Documents/synk-vendor · D:/synk-vendor 차례로 찾는다
                   (이 PC는 ~/Documents/synk-vendor가 D:/synk-vendor로 이어진 링크다).
편만들기.py가 검수 · 곡 · 손질 경로를, 움직임잇기.py가 클립 경로를 이 꼴로 적고 읽는다.
"""
import os
from pathlib import Path

HOME = Path.home()


def _vendor_roots():
    env = os.environ.get('SYNK_VENDOR')
    return ([Path(env)] if env else []) + [HOME / 'Documents' / 'synk-vendor', Path('D:/synk-vendor')]


def 줄이기(p):
    s = str(p).replace('\\', '/')
    if s.startswith('synk-vendor/') or s.startswith('~/'):
        return s
    i = s.lower().find('/synk-vendor/')
    if i >= 0:
        return 'synk-vendor/' + s[i + len('/synk-vendor/'):]
    h = str(HOME).replace('\\', '/').rstrip('/')
    if s.lower().startswith(h.lower() + '/'):
        return '~/' + s[len(h) + 1:]
    return Path(s).name if (Path(s).is_absolute() or s[1:3] == ':/') else s


def 풀기(s):
    s = str(s)
    if s.startswith('synk-vendor/'):
        rest = s[len('synk-vendor/'):]
        roots = _vendor_roots()
        for r in roots:
            if (r / rest).exists():
                return str(r / rest)
        return str(roots[0] / rest)
    if s.startswith('~/'):
        return str(HOME / s[2:])
    return s
