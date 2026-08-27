# -*- coding: utf-8 -*-
"""가이드 아바타 굽기 — 학생 홈 「우리」 카드의 40px 원형 얼굴을 만든다.

왜 «따로» 굽나: 정본 컷(1024²)은 몸이 가운데 작게 앉고 여백이 넓다.
그걸 40px 원형에 `object-fit:cover` 로 넣으면 얼굴이 점이 된다 —
학생이 매일 보는 유일한 가이드 얼굴이 알아볼 수 없는 얼룩이 되는 자리다.
그래서 알파(또는 배경 대비)로 몸을 찾아 **꽉 차게 잘라** 굽는다.

정본 경로는 손으로 안 적는다 — `tools/lib/마스코트자산.js` 가 주인이고
여기서는 그 모듈을 node 로 물어본다(주인이 둘이 되면 마스코트 10벌 사고가 재현된다).

바탕: 킷 Paper(#FBF7F0) — 카드 배경과 같은 색이라 원형이 카드에 자연스레 앉고,
      브랜드렌더린트 「허용바닥」 넷에 들어 있다(코랄 몸이 코랄 면에서 뭉개지는 것을 피한다).

쓰기: python tools/가이드아바타굽기.py
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image
import numpy as np

루트 = Path(__file__).resolve().parent.parent
날것 = 루트 / 'docs' / '캐릭터' / '가이드_아바타'
크기 = 256          # 저장소 정본 — 다른 지면(필름스트립·연재)에서 더 크게 쓸 여유
배포크기 = 160      # 드라이브로 나가는 판 — 표시 40px 의 4배(고밀도 화면까지 덮는다)
여백 = 0.06         # 몸 bbox 바깥으로 두는 숨 — 원형에 잘려도 몸이 안 닿게
바탕 = (251, 247, 240)   # 킷 Paper #FBF7F0


def 정본경로(표현: str) -> Path:
    """마스코트자산 모듈에 «어느 파일인가»를 묻는다 — 경로를 여기 적지 않는다."""
    js = ("const a=require('./tools/lib/마스코트자산.js');"
          f"process.stdout.write(a.{표현});")
    out = subprocess.run([r'C:\Program Files\nodejs\node.exe', '-e', js],
                         cwd=str(루트), capture_output=True, text=True, encoding='utf-8')
    if out.returncode != 0:
        raise SystemExit(f'마스코트자산 모듈이 경로를 안 준다: {out.stderr.strip()}')
    p = 루트 / out.stdout.strip()
    if not p.exists():
        raise SystemExit(f'모듈이 준 경로에 파일이 없다: {p}')
    return p


def 몸마스크(im: Image.Image):
    """몸이 있는 픽셀. 알파가 있으면 알파로, 없으면 «모서리 색»과 다른 픽셀로 찾는다.
    조용한 폴백을 안 만든다 — 못 찾으면 그 자리에서 깨진다(빈 아바타가 라이브에 서는 것보다 낫다)."""
    a = np.array(im.convert('RGBA'))
    알파 = a[:, :, 3]
    if 알파.min() < 250:                      # 투명판
        return a, 알파 > 24
    rgb = a[:, :, :3].astype(np.int16)        # 배경이 박힌 판 — 네 모서리 평균색과의 거리로
    모서리 = np.concatenate([rgb[:8, :8].reshape(-1, 3), rgb[:8, -8:].reshape(-1, 3),
                            rgb[-8:, :8].reshape(-1, 3), rgb[-8:, -8:].reshape(-1, 3)])
    return a, np.abs(rgb - 모서리.mean(axis=0)).sum(axis=2) > 40


def 코어상자(마스크):
    """«몸통»만의 사각형 — 뻗은 팔·곁의 소품을 걷어낸다.

    🔑 왜 이 자인가(08-27 실측): 그냥 bbox 를 쓰면 까몽이 x 83~984 로 잡힌다 — 뻗은 팔과
    곁에 둔 코랄 알까지 문 값이다. 그 자로 자르니 몽글은 얼굴이 꽉 차는데 까몽만 얼굴이
    점이 됐다(셋이 나란히 설 때 «얼굴 크기가 서로 다른» 아바타가 된다).
    행마다 몸 픽셀을 세면 몸통·머리는 넓고 팔·소품은 얇다 — 최대 폭의 40% 선으로 갈린다.
    실측: 까몽 x 83~984 → **213~850** · 몽글 219~805 → 265~758(통짜라 거의 그대로).

    ⚠ 눈을 찾아 얼굴 크기를 재는 길을 먼저 갔다가 버렸다 — 몽글은 눈 «하나»를 좌우로
    갈랐고(눈간 76px 오판 → 얼굴 하나가 화면을 채웠다) 까몽은 귀 하이라이트가 섞였다.
    「자동 추적 휴리스틱은 이 몸들에서 배신한다」가 마린 트랙에서도 같은 결론이었다."""
    행 = 마스크.sum(axis=1)
    코어행 = np.where(행 >= 행.max() * 0.40)[0]
    if not len(코어행):
        raise SystemExit('몸통을 못 찾았다 — 코어 행이 0이다')
    m2 = 마스크.copy()
    밖 = np.ones(마스크.shape[0], bool)
    밖[코어행] = False
    m2[밖, :] = False
    열 = m2.sum(axis=0)
    코어열 = np.where(열 >= 열.max() * 0.40)[0]
    return 코어열.min(), 코어행.min(), 코어열.max() + 1, 코어행.max() + 1


def 굽기(이름: str, 원본: Path, 나갈이름: str, 조임=1.0, 밀기=(0.0, -0.04)):
    """조임·밀기는 «눈으로만 갈리는» 미세조정이다(→ 색·미학 판정은 숫자가 못 가른다).
    자동 상자가 몸통을 정확히 물어도 «얼굴이 차지하는 비율»은 캐릭터마다 다르다 —
    까몽은 털이 부풀어 몸통 상자가 얼굴의 1.6배로 잡히고, 뻗은 팔 한쪽이 40% 선을 넘어 든다.
    원형으로 잘린 꼴을 나란히 놓고 «얼굴 크기가 같아 보일 때»를 값으로 굳혔다(08-27)."""
    im = Image.open(원본).convert('RGBA')
    _a, 마스크 = 몸마스크(im)
    x0, y0, x1, y1 = 코어상자(마스크)
    w, h = x1 - x0, y1 - y0
    변 = int(max(w, h) * (1 + 여백 * 2) * 조임)
    cx = x0 + w / 2 + 변 * 밀기[0]
    cy = y0 + h / 2 + 변 * 밀기[1]   # 얼굴 쪽으로 — 원형에 잘려도 눈이 가운데 남게
    상자 = (int(cx - 변 / 2), int(cy - 변 / 2), int(cx + 변 / 2), int(cy + 변 / 2))
    잘린 = im.crop(상자)  # 원본 밖으로 나가는 몫은 투명으로 오고, 아래에서 Paper 가 메운다
    바닥 = Image.new('RGBA', 잘린.size, 바탕 + (255,))
    바닥.alpha_composite(잘린)
    나온 = 바닥.convert('RGB').resize((크기, 크기), Image.LANCZOS)
    날것.mkdir(parents=True, exist_ok=True)
    경로 = 날것 / 나갈이름
    나온.save(경로, 'PNG', optimize=True)
    # 배포판 — 드라이브에 올려 카드가 실제로 부르는 파일. 펠트 털은 PNG 압축이 안 먹어(128px 도 27KB)
    # 40px 원형 하나에 그 무게를 지우지 않는다. 바탕이 불투명 Paper 라 JPEG 로 잃는 게 없다.
    배포 = 날것 / (나갈이름[:-4] + '_배포.jpg')
    나온.resize((배포크기, 배포크기), Image.LANCZOS).save(배포, 'JPEG', quality=92, optimize=True)
    return {'이름': 이름, '원본': str(원본.relative_to(루트)).replace('\\', '/'),
            '원본크기': f'{im.width}x{im.height}', '몸통': f'{w}x{h}', '자른변': 변,
            '나온파일': 나갈이름, 'KB': round(경로.stat().st_size / 1024, 1),
            '배포판': 배포.name, '배포KB': round(배포.stat().st_size / 1024, 1)}


def main():
    보고 = []
    보고.append(굽기('몽글', 정본경로("경로('눈웃음',{누끼:true})"), '몽글_아바타.png'))
    보고.append(굽기('까몽', 정본경로("까몽경로('눈웃음',{누끼:true})"), '까몽_아바타.png',
                    조임=0.98, 밀기=(-0.07, -0.035)))
    # ⚠ 까몽 귀는 «코어 상자 밖»이다 — 얇아서 40% 선을 못 넘는다(실측: 코어 y0=156, 귀 꼭대기 y≈100).
    #   상자를 위로 올려 담는다. 귀가 잘리면 고양이 실루엣이 죽고 「검은 덩어리 + 연두 눈」이 된다.
    print(json.dumps(보고, ensure_ascii=False, indent=2))
    print('\n[마린] 안 구웠다 — 현재 렌더 전량이 총·해골 문장을 정면에 든다(아바타 부적합).')
    print('       유호님 판정 셋(몸·색·각)이 열려 있는 자리이기도 하다 — 지면 = docs/마린_시안.html')


if __name__ == '__main__':
    sys.exit(main())
