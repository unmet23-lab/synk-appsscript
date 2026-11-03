"""
「제2의 나」 오픈 편집 모델 견주기 — Fable 눈가림 검수용 모아보기 (2026-11-03).

줄마다 맨 왼쪽은 「올린 사진」(옷장은 편집 전 기준), 그 오른쪽은 GPT와 오픈 모델 판을 줄마다 섞어 A~D로만 적는다
(어느 것이 GPT인지 검수자가 모르게). 본판(공식 기본 스텝 · CFG)과 빠른판(8스텝 증류)을 따로 묶는다. 섞은 순서는 `시트/열쇠.json`에만 둔다.
유호님 사진이 들어가 git 밖(`.tmp/me2-20261102/photo-open/시트/`)에만 만든다.

    python -I -X utf8 experiences/drama/qa/제2의나-20261102/오픈모델/시트.py
"""
import json
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

여기 = Path(__file__).resolve().parent
sys.path.insert(0, str(여기))
from 굽기 import GPT기준, T, 올림  # noqa: E402
from 재기 import 판  # noqa: E402

묶음 = {'본판': ['gpt', 'qwen2511', 'firered11', 'longcat'],                 # 공식 기본 스텝 · CFG
        '빠른판': ['gpt', 'qwen2511-fast', 'firered11-fast', 'longcat_turbo']}   # 8스텝 증류 · CFG 1
칸w, 칸h, 글h = 300, 400, 34
밖 = T / 'photo-open' / '시트'


def 글꼴(크기):
    for f in (r'C:\Windows\Fonts\malgunbd.ttf', r'C:\Windows\Fonts\malgun.ttf'):
        if Path(f).exists():
            return ImageFont.truetype(f, 크기)
    return ImageFont.load_default()


def 칸(p):
    im = Image.open(p).convert('RGB')
    im.thumbnail((칸w, 칸h), Image.LANCZOS)
    바탕 = Image.new('RGB', (칸w, 칸h), (235, 235, 235))
    바탕.paste(im, ((칸w - im.width) // 2, (칸h - im.height) // 2))
    return 바탕


def 시트(이름: str, 일들: list, 열쇠: dict, rng: random.Random, 모델: list):
    줄들 = []
    for 일 in 일들:
        자 = GPT기준[일.split('-')[1]] if 일.startswith('wd-') else 올림[일.split('-', 1)[1]]
        판들 = [(m, 판(m, 일)) for m in 모델]
        판들 = [(m, p) for m, p in 판들 if p]
        if len(판들) < 2:   # 견줄 짝이 없는 줄(본판 옷장처럼 GPT만 있는 줄)은 넣지 않는다
            continue
        rng.shuffle(판들)
        열쇠[f'{이름}/{일}'] = {chr(65 + i): m for i, (m, _) in enumerate(판들)}
        줄들.append((일, 자, 판들))
    if not 줄들:
        return None
    W = 칸w * (1 + max(len(p) for _, _, p in 줄들))
    H = (칸h + 글h) * len(줄들)
    s = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(s)
    f = 글꼴(20)
    for r, (일, 자, 판들) in enumerate(줄들):
        y = r * (칸h + 글h)
        d.text((8, y + 6), f'{일} · 왼쪽 = {"편집 전 기준" if 일.startswith("wd-") else "올린 사진"}', fill='black', font=f)
        s.paste(칸(자), (0, y + 글h))
        for i, (_, p) in enumerate(판들):
            x = 칸w * (i + 1)
            s.paste(칸(p), (x, y + 글h))
            d.text((x + 8, y + 글h + 6), chr(65 + i), fill='white', font=글꼴(30), stroke_width=3, stroke_fill='black')
    밖.mkdir(parents=True, exist_ok=True)
    p = 밖 / f'{이름}.jpg'
    s.save(p, quality=90)
    # 줄마다 크게 한 장 더(칸 480×640) — 손가락 · 글자 · 피부 결을 볼 수 있게. 파일 이름에 모델 이름은 없다.
    for 일, 자, 판들 in 줄들:
        큰w, 큰h = 480, 640
        줄 = Image.new('RGB', (큰w * (1 + len(판들)), 큰h + 글h), 'white')
        dd = ImageDraw.Draw(줄)
        dd.text((8, 6), f'{일} · 왼쪽 = {"편집 전 기준" if 일.startswith("wd-") else "올린 사진"}', fill='black', font=f)
        for i, q in enumerate([자] + [x for _, x in 판들]):
            im = Image.open(q).convert('RGB')
            im.thumbnail((큰w, 큰h), Image.LANCZOS)
            줄.paste(im, (큰w * i + (큰w - im.width) // 2, 글h + (큰h - im.height) // 2))
            if i:
                dd.text((큰w * i + 10, 글h + 8), chr(64 + i), fill='white', font=글꼴(40), stroke_width=4, stroke_fill='black')
        줄.save(밖 / f'{이름}_{일}.jpg', quality=90)
    return p


def main():
    rng = random.Random(1103)
    열쇠 = {}
    만든 = []
    for 판이름, 모델 in 묶음.items():
        모델 = [m for m in 모델 if m == 'gpt' or (T / 'photo-open' / m / '판').is_dir()]
        if len(모델) < 2:
            continue
        만든 += [시트(f'{판이름}_기준_강', [f'base-{w}' for w in ('yuho', 'u1', 'u2')], 열쇠, rng, 모델),
                시트(f'{판이름}_나이_강플', [f'age-{a}' for a in ('a36', 'a45', 'a52')], 열쇠, rng, 모델)]
        for w in ('yuho', 'u1', 'u2'):
            만든.append(시트(f'{판이름}_옷장_{w}', [f'wd-{w}-{k}' for k in ('hair1', 'hair2', 'outfit', 'acc')], 열쇠, rng, 모델))
    (밖 / '열쇠.json').write_text(json.dumps(열쇠, ensure_ascii=False, indent=1), encoding='utf-8')
    for p in 만든:
        if p:
            print(p)


if __name__ == '__main__':
    main()
