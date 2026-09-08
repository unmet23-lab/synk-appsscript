"""AI 누끼 — «무엇이 물건인지»를 보고 배경을 걷는다 (2026-09-07 · 유호 「배경이 왜 짤리는거야?」).

왜 있나 (09-07 실사고 두 번):
  `tools/흰배경걷기.py` 는 **색**으로 가른다 — 모서리에서 번져 들어가며 배경색과 가까운 픽셀을 지운다.
  그래서 크림 양모를 크림·흰 바탕에서 찍으면 물건의 밝은 쪽을 배경으로 오인해 파먹는다.
  09-07 새벽 판 42장 중 14장, 낮 판 28장 중 7장이 그렇게 뜯겼고(말풍선·녹음맺음은 산산조각),
  지시문에 「회색 바탕」을 적어도 모델이 27/28 장을 흰 바탕으로 냈다 — 바탕색을 «시켜서» 풀 수 없었다.
  이 도구는 색이 아니라 물건의 «형태»를 본다(rembg · isnet-general-use). 같은 28장을 걸어 보니
  뜯긴 곳이 0 이었다(실측 09-07 · 한 장 4~5초 · 2048px).

무엇을 하나:
  입력 PNG(흰 바탕이 붙은 제미나이 원본) → 알파 붙은 PNG. 크기는 그대로 둔다(자르기·정사각은 룸자산화.py 몫).
  🔑 알파 매팅(가장자리 재계산)은 **기본 끔** — 켜면 펠트 보풀이 흐릿한 후광이 된다(시침핀 실측).
  🔑 모델은 한 번만 올린다(`세션()`) — 스물여덟 장을 각각 띄우면 모델 올리기(38초)를 스물여덟 번 한다.

무엇을 안 하나:
  천·장면(바탕이 곧 그림인 것)에는 쓰지 않는다 — 그건 걷을 배경이 없다. 그 갈래는 공방뒤처리.py 가 가른다.
  ✅ **마스코트에도 09-08 에 쟀다** — 마린 34도 판으로 둘을 나란히 걸어 봤다.
     흰배경걷기는 마린의 «크림색 몸»을 통째로 파먹었고(구멍 775점 · 흰그림자 125,374점 ·
     떨어진 조각 1,755점 · 초록 바탕에 얹으니 몸과 꽃이 숭숭 뚫려 보였다), AI 누끼는 온전했다.
     🔑 까닭은 09-07 과 같다 — 크림은 흰 바탕과 색이 가까워 «색으로 가르는 자»가 물건을 배경으로 읽는다.
     ⇒ **마스코트 굽기의 뒤처리는 이 도구가 기본이다.** 흰배경걷기는 어두운 몸(까몽)에만 쓴다.

사용:
  python tools/AI누끼.py <원본.png> [--출력 <경로>] [--크기 4096]
  (모듈로) from AI누끼 import 세션, 걷기 ; im = 걷기(PIL이미지, 세션())
"""
import argparse
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow 가 없다 — python -m pip install pillow')

모델이름 = 'isnet-general-use'


def 세션():
    """모델을 한 번 올린다. rembg 가 없으면 이름째 알린다(조용히 빈손으로 돌아가지 않는다)."""
    try:
        from rembg import new_session
    except ImportError:
        sys.exit('rembg 가 없다 — python -m pip install "rembg[cpu]"  (모델 179MB 는 첫 실행에 내려받는다)')
    return new_session(모델이름)


def 걷기(im, 세션값, 긴변=0):
    """PIL 이미지 → RGBA. 긴변>0 이면 그 크기로 줄여 돌린다(0 = 원본 그대로)."""
    from rembg import remove
    im = im.convert('RGB')
    if 긴변 and max(im.size) > 긴변:
        im = im.copy()
        im.thumbnail((긴변, 긴변), Image.LANCZOS)
    return remove(im, session=세션값)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('입력')
    ap.add_argument('--출력', help='기본 = <이름>_누끼.png')
    ap.add_argument('--크기', type=int, default=0, help='긴 변 최대(px). 0 = 원본 그대로')
    a = ap.parse_args()
    출력 = a.출력 or (a.입력[:-4] + '_누끼.png')
    s = 세션()
    out = 걷기(Image.open(a.입력), s, a.크기)
    out.save(출력)
    import numpy as np
    물건몫 = (np.asarray(out.getchannel('A')) > 128).mean() * 100
    # 🔴 윈도 콘솔이 cp949 면 ✅ 같은 글자에서 UnicodeEncodeError 로 죽는다(09-08 실측 · 두 번 밟았다).
    #    파일은 이미 저장한 뒤라 «일은 됐는데 죽은 얼굴»이 된다. 그래서 인쇄만 감싼다.
    줄 = f'✅ {os.path.basename(출력)}  {out.size[0]}x{out.size[1]} · 물건 {물건몫:.1f}%'
    try:
        print(줄)
    except UnicodeEncodeError:
        print(줄.encode('utf-8', 'replace').decode('ascii', 'replace'))


if __name__ == '__main__':
    main()
