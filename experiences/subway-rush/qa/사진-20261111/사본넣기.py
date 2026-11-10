"""시험 사본에 새 판 넣기: 게임 폴더를 .tmp 사본(시험판/experiences/subway-rush)으로 복사해 두고(코드는 매번 새로 덮음), 고른 판을 웹판.py와 같은 길로 webp + 깊이 지도로 넣는다(저장소 자산은 그대로).
  python -I -X utf8 사본넣기.py <게임 이름>=<판.png> …   예: fork=nb/out/fork-b_1.png exit-fork=nb/out/exit_2.png car-calm=nb/out/car-calm_1.png
9:16 판은 그대로(1024×1820), 그 밖은 2:3. 깊이 흐림은 웹판.py SOFT_DEPTH를 따른다.
"""
import shutil
import sys
from pathlib import Path

W = Path.home() / 'Documents' / 'SYNK-appsscript' / '.tmp' / 'subway-rush-20261111'   # 공용 작업본(git 밖)
ROOT = Path(__file__).resolve().parents[4]
GAME = ROOT / 'experiences' / 'subway-rush'
COPY = W / '시험판' / 'experiences' / 'subway-rush'
import importlib.util
spec = importlib.util.spec_from_file_location('webpan', GAME / 'qa' / '웹판.py')
webpan = importlib.util.module_from_spec(spec); spec.loader.exec_module(webpan)
import onnxruntime as ort
from PIL import Image

if not COPY.exists():
    shutil.copytree(GAME, COPY, ignore=shutil.ignore_patterns('qa', '*.test.mjs'))
for f in GAME.glob('*.*'):   # 코드 · 화면 파일은 저장소 작업본 것으로 늘 맞춘다(자산은 아래에서만 바꿈)
    if f.suffix in ('.mjs', '.js', '.css', '.html'):
        shutil.copy2(f, COPY / f.name)
session = ort.InferenceSession(str(webpan.MODEL), providers=['CPUExecutionProvider'])
for arg in sys.argv[1:]:
    name, src = arg.split('=', 1)
    im = webpan.fit_plate(Image.open(W / src if not Path(src).is_absolute() else src).convert('RGB'))
    im.save(COPY / 'assets' / 'world' / f'{name}.webp', quality=84, method=6)
    if not name.endswith(('-right', '-left')) and name != 'bus-stop':
        webpan.depth_map(session, im, soft=name in webpan.SOFT_DEPTH).save(COPY / 'assets' / 'world' / f'{name}.depth.png', optimize=True)
    print('넣음', name, '←', src, im.size)
