"""옷 조각의 빛을 몸에 맞춘다 — libcom 의 image harmonization 이 하는 일의 핵심만 (0원).

■ 왜 이렇게 하나
  아스트라 심문 P1: 「몸의 밝기에는 조명뿐 아니라 고유색·털결·형태가 섞여 있으므로,
  그 밝기를 곱하면 밝은 옷을 불필요하게 어둡게 하거나 이미 있는 그늘을 중복시킬 수 있다.」
  ⇒ 그래서 몸 밝기를 **크게 흐려** 저주파(큰 조명 흐름)만 남기고, 털결·고유색 세부는 버린다.
  ⇒ 그리고 옷이 덮은 자리의 **중간값으로 정규화**해서 전체가 어두워지지 않게 한다.
  ⇒ 세기를 1 미만으로 눌러 과교정을 막는다.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

루트 = Path(r'C:\Users\q1212\Documents\SYNK-appsscript')
층방 = 루트 / 'docs/Loom_자산/옷/층'
몸경로 = 루트 / 'docs/캐릭터/정본_4K/까몽_본체.png'
낼방 = 루트 / 'docs/Loom_자산/옷/편집시험'
낼방.mkdir(parents=True, exist_ok=True)


def 조명흐름(몸: Image.Image, 흐림비율=0.06) -> np.ndarray:
    """몸에서 «큰 조명 흐름»만 뽑는다. 털결·고유색은 흐림이 지운다."""
    rgb = np.asarray(몸.convert('RGB'), dtype=np.float32)
    a = np.asarray(몸.getchannel('A'), dtype=np.float32) / 255.0
    L = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    # 배경(투명)은 몸 평균으로 채운다. 안 그러면 가장자리가 검게 빨려 들어간다.
    있음 = a > 0.5
    L = np.where(있음, L, L[있음].mean() if 있음.any() else 128.0)
    반지름 = max(3, int(min(몸.size) * 흐림비율))
    흐린 = Image.fromarray(L.astype(np.uint8)).filter(ImageFilter.GaussianBlur(반지름))
    return np.asarray(흐린, dtype=np.float32)


def 빛맞춘옷(옷: Image.Image, 흐름: np.ndarray, 세기=0.6) -> Image.Image:
    rgba = np.asarray(옷.convert('RGBA'), dtype=np.float32)
    알파 = rgba[..., 3] / 255.0
    있음 = 알파 > 0.05
    if not 있음.any():
        return 옷
    기준 = float(np.median(흐름[있음]))
    if 기준 <= 1:
        return 옷
    비율 = 흐름 / 기준
    비율 = 1.0 + (비율 - 1.0) * 세기          # 과교정을 누른다
    비율 = np.clip(비율, 0.55, 1.45)          # 극단을 막는다
    새 = rgba.copy()
    새[..., :3] = np.clip(rgba[..., :3] * 비율[..., None], 0, 255)
    return Image.fromarray(새.astype(np.uint8), 'RGBA')


def 얹어(몸: Image.Image, 옷: Image.Image) -> Image.Image:
    판 = 몸.convert('RGBA').copy()
    if 옷.size != 판.size:
        옷 = 옷.resize(판.size, Image.LANCZOS)
    판.alpha_composite(옷)
    return 판


def 잘라흰바탕(판: Image.Image) -> Image.Image:
    b = 판.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    잘린 = 판.crop(b) if b else 판
    바탕 = Image.new('RGB', 잘린.size, (255, 255, 255))
    바탕.paste(잘린, (0, 0), 잘린)
    return 바탕


def main():
    것들 = sys.argv[1:] or ['겨울델', '1급배지코트', '앞치마']
    몸 = Image.open(몸경로).convert('RGBA')
    흐름 = 조명흐름(몸)
    칸 = []
    for 이름 in 것들:
        p = 층방 / f'옷_까몽_{이름}.png'
        if not p.exists():
            sys.exit(f'없다: {p}')
        옷 = Image.open(p).convert('RGBA')
        전 = 잘라흰바탕(얹어(몸, 옷))
        후 = 잘라흰바탕(얹어(몸, 빛맞춘옷(옷, 흐름)))
        칸.append((f'{이름} · 지금', 전))
        칸.append((f'{이름} · 빛 맞춤', 후))
        후.save(낼방 / f'까몽_{이름}_빛맞춤.png')

    # 판으로 묶는다 — 옷입혀보기.py 의 판만들기를 그대로 쓴다
    import importlib.util
    spec = importlib.util.spec_from_file_location('옷입혀보기', 루트 / 'tools/옷입혀보기.py')
    M = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(M)
    판 = M.판만들기(칸, 칸높=560, 줄당=2)
    낼곳 = 낼방 / '까몽_빛맞춤_견줌.png'
    판.save(낼곳)
    print(f'OK {낼곳} - {len(칸)}칸 {판.width}x{판.height}')


if __name__ == '__main__':
    main()
