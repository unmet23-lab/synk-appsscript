"""
꿈 무대 촬영 시험판(2026-11-18) — git이 무시하는 컷표.json(.gitignore `**/qa/*/**/*.json`)을 컷표_원문.md에 그대로 모은다.
다시 쓸 때는 아래 글을 같은 자리의 컷표.json으로 되살린다. 컷표를 고치면 이 파일로 다시 만든다.

    python -I -X utf8 컷표모음.py          (이 폴더에서)
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
글 = open(os.path.join(HERE, '컷표.json'), encoding='utf-8').read().strip()
머리 = ('# 컷표 원문\n\n이 폴더의 `컷표.json`은 git이 무시한다(`.gitignore`의 `**/qa/*/**/*.json`). '
      '그래서 원문을 이 파일에 그대로 둔다. 되살릴 때는 아래 글을 `컷표.json`으로 쓴다. '
      '컷표를 고치면 `python -I -X utf8 컷표모음.py`로 이 파일을 다시 만든다.\n\n')
open(os.path.join(HERE, '컷표_원문.md'), 'w', encoding='utf-8').write(머리 + '```json\n' + 글 + '\n```\n')
print('컷표_원문.md', len(글), '자')
