"""
「제2의 나」 오픈 편집 모델 견주기 — 같은 잣대로 숫자 모으기 (2026-11-03).

사진시험의 `닮음.py`(YuNet + SFace, 큰 원본은 긴 변 1200)를 그대로 불러, 11-03 GPT 판과 오픈 모델 판을 같은 식으로 잰다.
- 기준 「강」 · 나이 「강+」: 올린 사진과의 닮음
- 옷장: 편집 전 기준(GPT 「강」 판 — 모두 같은 입력)과의 닮음
GPT 숫자도 여기서 다시 잰다(README 표와 같은 판 — 옷장은 지시문을 고쳐 다시 구운 셋은 wd2 판).
결과는 `.tmp/me2-20261102/photo-open/숫자.json`, 표는 화면에 찍는다.

    python -I -X utf8 experiences/drama/qa/제2의나-20261102/오픈모델/재기.py
"""
import glob
import json
import subprocess
import sys
from pathlib import Path

여기 = Path(__file__).resolve().parent
닮음 = 여기.parent / '사진시험' / '닮음.py'
sys.path.insert(0, str(여기))
from 굽기 import G, GPT기준, T, 올림  # noqa: E402

순서 = ['gpt', 'qwen2511', 'firered11', 'longcat', 'qwen2511-fast', 'firered11-fast', 'longcat_turbo']
모델 = [m for m in 순서 if m == 'gpt' or (T / 'photo-open' / m / '판').is_dir()]   # 구운 폴더가 있는 것만
첫 = lambda pat: (sorted(glob.glob(str(pat))) or [None])[0]  # noqa: E731


def gpt판(일: str):
    종류, 나머지 = 일.split('-', 1)
    if 종류 == 'base':
        return 첫(G / '판' / f'gpt2-{나머지}-강_*.png')
    if 종류 == 'age':
        return 첫(G / '나이판' / '판' / f'base-{나머지}-강플_*.png')
    # 옷장: 고쳐 다시 구운 판(wd2)이 있으면 그것 — 지금 지시문 파일이 고친 판의 글이다
    return 첫(G / '옷장판' / '판' / f'wd2-{나머지}_*.png') or 첫(G / '옷장판' / '판' / f'wd-{나머지}_*.png')


def 판(모델이름: str, 일: str):
    if 모델이름 == 'gpt':
        return gpt판(일)
    p = T / 'photo-open' / 모델이름 / '판' / f'{일}.png'
    return str(p) if p.exists() else None


def 재다(자: Path, 판들: list) -> dict:
    """닮음.py 기준 <자> <판…> — 판 경로마다 「올린사진」 값(여기서는 자와의 닮음).
    판 파일 이름이 모델마다 같아(base-yuho.png) 이름이 아니라 넣은 순서로 짝짓는다."""
    판들 = [p for p in 판들 if p]
    if not 판들:
        return {}
    r = subprocess.run([sys.executable, '-I', '-X', 'utf8', str(닮음), '기준', str(자), *판들],
                       capture_output=True, text=True, encoding='utf-8')
    글 = r.stdout[r.stdout.find('{'):]
    try:
        d = json.loads(글)
    except json.JSONDecodeError:
        return {p: f'못 잼: {(r.stderr or r.stdout).strip().splitlines()[-1][:120]}' for p in 판들}
    return {p: x['올린사진'] for p, x in zip(판들, d['판'])}


def main():
    일들 = ([f'base-{w}' for w in ('yuho', 'u1', 'u2')] + [f'age-{a}' for a in ('a36', 'a45', 'a52')]
           + [f'wd-{w}-{k}' for w in ('yuho', 'u1', 'u2') for k in ('hair1', 'hair2', 'outfit', 'acc')])
    표 = {}
    for 일 in 일들:
        if 일.startswith('wd-'):
            자 = GPT기준[일.split('-')[1]]
        else:
            자 = 올림[일.split('-', 1)[1]]
        판들 = {m: 판(m, 일) for m in 모델}
        값 = 재다(자, list(판들.values()))
        표[일] = {m: (값.get(p) if p else None) for m, p in 판들.items()}
        표[일]['_판'] = {m: p for m, p in 판들.items()}
    (T / 'photo-open').mkdir(parents=True, exist_ok=True)
    (T / 'photo-open' / '숫자.json').write_text(json.dumps(표, ensure_ascii=False, indent=1), encoding='utf-8')
    print('일'.ljust(18) + ''.join(m.rjust(15) for m in 모델))
    for 일, 줄 in 표.items():
        print(일.ljust(18) + ''.join((f'{줄[m]:.3f}' if isinstance(줄[m], float) else str(줄[m] or '-')).rjust(15) for m in 모델))
    # 한 장 시간(Space 안 GPU 초) · 한도 쓴 초 — 기록.jsonl에서
    for m in 모델[1:]:
        줄들 = [json.loads(x) for x in (T / 'photo-open' / m / '기록.jsonl').read_text(encoding='utf-8').splitlines() if x.strip()] \
            if (T / 'photo-open' / m / '기록.jsonl').exists() else []
        if 줄들:
            g = sorted(x['gpu_s'] for x in 줄들)
            print(f"{m}: {len(줄들)}장 · GPU {g[0]}~{g[-1]}초(가운데 {g[len(g) // 2]}) · 한도 합 {round(sum(x['한도쓴초'] or 0 for x in 줄들), 1)}초"
                  f" · 조각 {줄들[-1].get('gpu_size', 'large')}")


if __name__ == '__main__':
    main()
