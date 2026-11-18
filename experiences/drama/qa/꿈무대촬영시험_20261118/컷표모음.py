"""
꿈 무대 촬영 시험판(2026-11-18) — git이 무시하는 컷표.json과 이미지지시문/(.gitignore `**/qa/*/**/*.json` · `*.txt`)을
컷표_원문.md에 그대로 모은다. 다시 쓸 때는 아래 글을 같은 자리의 파일로 되살린다. 컷표나 지시문을 고치면 이 파일로 다시 만든다.

    python -I -X utf8 컷표모음.py          (이 폴더에서)
"""
import glob
import os

HERE = os.path.dirname(os.path.abspath(__file__))
글 = open(os.path.join(HERE, '컷표.json'), encoding='utf-8').read().strip()
머리 = ('# 컷표 원문\n\n이 폴더의 `컷표.json`과 `이미지지시문/`은 git이 무시한다(`.gitignore`의 `**/qa/*/**/*.json` · `*.txt`). '
      '그래서 원문을 이 파일에 그대로 둔다. 되살릴 때는 아래 글을 같은 자리의 파일로 쓴다. '
      '고치면 `python -I -X utf8 컷표모음.py`로 이 파일을 다시 만든다.\n\n## 컷표.json\n\n')
덧 = ''
지시문 = sorted(glob.glob(os.path.join(HERE, '이미지지시문', '*')))
for f in 지시문:
    덧 += f'\n## 이미지지시문/{os.path.basename(f)}\n\n```\n' + open(f, encoding='utf-8').read().strip() + '\n```\n'
open(os.path.join(HERE, '컷표_원문.md'), 'w', encoding='utf-8').write(머리 + '```json\n' + 글 + '\n```\n' + 덧)
print('컷표_원문.md', len(글), '자 · 이미지 지시문', len(지시문), '개')
