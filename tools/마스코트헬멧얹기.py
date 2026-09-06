"""숙인 컷의 «헬멧»을 정본 몸에 얹는다 — 동작은 구운 것, 옷은 원본 (2026-09-07).

왜 있나 (라디오 인계문 `docs/_ops/인계_라디오라이브_0906.md` §4-ⓑ):
  판1(컷을 통째로 굽기)은 동작이 좋은데 모델이 몸까지 새로 그려 옷이 컷마다 변했다
  (유호 09-06 「인사할때 마스코트 의상이 변하는게 보여」).
  판2(헬멧만 기울이기 · `마스코트고개숙이기.py`)는 옷이 안 변하는데 평면을 돌린 것이라 「까딱」으로
  보이고, 지운 자리를 회전본이 다 못 덮어 뒷배경이 비쳤다(유호 지적).
  ⇒ 굽은 컷에서 «헬멧만» 떼어 정본 몸에 얹으면 동작은 판1, 옷은 판2 다.

무엇을 하나:
  ⓐ 두 그림에서 헬멧을 잡는다 — 어두운 남색 덩어리 · 구멍(렌즈·꽃) 메움 · 제일 큰 덩어리. 판2 와 같은 자.
  ⓑ 숙인 컷을 정본 배율로 맞춘다 — √(불투명한 점의 수) 의 비. `마스코트틀맞추기.py` 와 같은 자다
     (테두리 상자는 숙이면 낮아져서 못 쓴다 · 넓이는 숙여도 거의 안 변한다).
  ⓒ 자리는 «몸»으로 맞춘다 — 헬멧을 뺀 몸의 상자 아래 가운데(발)를 정본 몸의 발에 포갠다.
     숙일 때 움직이는 것은 머리지 발이 아니다.
  ⓓ 정본에서 헬멧을 지우고(가장자리를 조금 넓혀 반투명 유령 윤곽까지), 그 위에 숙인 컷의 헬멧을 얹는다.
  ⓔ 🔑 «지웠는데 새 헬멧이 못 덮은 점»을 센다. 0 이 아니면 그만큼 뒷배경이 비친다 — --키움·--내림·--옆 으로
     잡는다. --검사 를 주면 그 자리를 자홍색으로 찍은 확인 그림을 함께 낸다(눈으로 0 을 믿지 않는다).

쓰기:
  python tools/마스코트헬멧얹기.py <정본.png> <숙인컷_누끼.png> <낼곳.png>
      [--어둠 120] [--넓힘 12] [--키움 1.0] [--내림 0] [--옆 0] [--검사] [--미리보기 1024]
  예: python tools/마스코트헬멧얹기.py docs/캐릭터/정본_4K/마린_본체.png \
          docs/캐릭터/정본_4K_후보/마린_인사1_누끼.png docs/캐릭터/정본_4K_후보/마린_인사1_얹음.png --검사
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import binary_closing, binary_dilation, binary_fill_holes, distance_transform_edt, label

for 흐름 in (sys.stdout, sys.stderr):
    try:
        흐름.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass


def 헬멧마스크(A, 어둠, 파랑):
    """어둡고 «파란» 덩어리 = 헬멧.
    🔴 판2 는 어두움만 봤다(밝기 < 120). 그러면 헬멧 밑 «가슴 그늘·가방 끈»까지 딸려 와서(09-07 실측 · 정본에서
       아래 끝이 3210 까지 내려온다 · 진짜 테두리는 2715) 그 자리를 지운 만큼 몸에 구멍이 났다.
       남색 펠트는 파랑이 빨강·초록보다 뚜렷이 높고, 가슴 그늘은 회갈색이라 셋이 비슷하다 — 그 차로 가른다."""
    알파 = A[..., 3] > 32
    rgb = A[..., :3].astype(np.int32)
    밝기 = rgb.mean(axis=2)
    파랑기 = rgb[..., 2] - np.maximum(rgb[..., 0], rgb[..., 1])
    m = 알파 & (밝기 < 어둠) & (파랑기 > 파랑)
    m = binary_closing(m, np.ones((9, 9)))
    m = binary_fill_holes(m)
    표, 수 = label(m)
    if 수 == 0:
        raise SystemExit('헬멧을 못 찾았다 — --어둠 을 올려 본다')
    if 수 > 1:
        큰 = 1 + int(np.argmax([(표 == i).sum() for i in range(1, 수 + 1)]))
        m = 표 == 큰
    return m


def 둥글게넓히다(m, r):
    """마스크를 반지름 r 만큼 둥글게 넓힌다 — 거리 변환으로 잰다.
    네모 커널은 털 가장자리를 계단처럼 자르고(09-07 실측), 큰 둥근 커널의 팽창은 4K 에서 몇 분이 걸린다.
    거리 변환은 크기와 무관하게 몇 초다."""
    if r <= 0:
        return m.copy()
    return distance_transform_edt(~m) <= r


def 상자(m):
    ys, xs = np.nonzero(m)
    return xs.min(), ys.min(), xs.max(), ys.max()


def 몸마스크(A, 헬멧):
    """헬멧(과 그 둘레 조금)을 뺀 나머지 불투명한 점 = 몸."""
    return (A[..., 3] > 32) & ~binary_dilation(헬멧, np.ones((7, 7)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('정본')
    ap.add_argument('숙인컷')
    ap.add_argument('낼곳')
    ap.add_argument('--어둠', type=int, default=120, help='이보다 어두우면 헬멧 후보(판2 와 같은 기본값)')
    ap.add_argument('--파랑', type=int, default=10, help='파랑 − max(빨강,초록) 이 이보다 커야 헬멧(가슴 그늘을 거른다)')
    ap.add_argument('--넓힘', type=int, default=12, help='정본 헬멧을 지울 때 가장자리를 넓히는 폭(px)')
    ap.add_argument('--테두리', type=int, default=160, help='헬멧 «위쪽» 둘레 이 폭(px) 안의 털을 옛 것은 지우고 새 것은 얹는다 · 0 이면 안 한다')
    ap.add_argument('--키움', type=float, default=1.0, help='얹는 헬멧을 목 자리 기준으로 키우는 배율')
    ap.add_argument('--내림', type=int, default=0, help='얹는 헬멧을 아래로 미는 px(음수면 위로)')
    ap.add_argument('--옆', type=int, default=0, help='얹는 헬멧을 오른쪽으로 미는 px(음수면 왼쪽)')
    ap.add_argument('--검사', action='store_true', help='못 덮은 점을 자홍색으로 찍은 확인 그림을 함께 낸다')
    ap.add_argument('--미리보기', type=int, default=1024, help='줄인 미리보기 한 변(px) · 0 이면 안 낸다')
    a = ap.parse_args()

    정본 = Image.open(a.정본).convert('RGBA')
    A0 = np.array(정본)
    H0 = 헬멧마스크(A0, a.어둠, a.파랑)
    B0 = 몸마스크(A0, H0)
    W, H = 정본.size

    숙 = Image.open(a.숙인컷).convert('RGBA')
    A1 = np.array(숙)
    # ⓑ 배율 — √(불투명 점 수) 의 비
    n0 = int((A0[..., 3] > 32).sum())
    n1 = int((A1[..., 3] > 32).sum())
    s = (n0 / n1) ** 0.5
    새w, 새h = max(1, round(숙.width * s)), max(1, round(숙.height * s))
    숙s = 숙.resize((새w, 새h), Image.LANCZOS)
    A1s = np.array(숙s)
    H1 = 헬멧마스크(A1s, a.어둠, a.파랑)
    B1 = 몸마스크(A1s, H1)

    # ⓒ 자리 — 몸의 발(상자 아래 가운데)을 포갠다
    x0a, y0a, x0b, y0b = 상자(B0)
    x1a, y1a, x1b, y1b = 상자(B1)
    발0 = ((x0a + x0b) / 2, y0b)
    발1 = ((x1a + x1b) / 2, y1b)
    dx = int(round(발0[0] - 발1[0])) + a.옆
    dy = int(round(발0[1] - 발1[1])) + a.내림

    # 헬멧 층 = 숙인 컷의 헬멧 점 + 헬멧 «위쪽 둘레»의 털(밝은 잔털은 헬멧 자에 안 잡히지만 그 자리엔 몸이 없다)
    hx_a, hy_a, hx_b, hy_b = 상자(H1)
    층마스크 = H1.copy()
    if a.테두리 > 0:
        위쪽1 = np.zeros_like(H1)
        위쪽1[: int(hy_b - (hy_b - hy_a) * 0.25), :] = True
        층마스크 |= 둥글게넓히다(H1, a.테두리 // 2) & 위쪽1 & (A1s[..., 3] > 0)
    층 = np.zeros_like(A1s)
    층[층마스크] = A1s[층마스크]
    층im = Image.fromarray(층, 'RGBA')
    목 = ((hx_a + hx_b) / 2, hy_b - (hy_b - hy_a) * 0.15)
    if a.키움 != 1.0:
        kw, kh = max(1, round(새w * a.키움)), max(1, round(새h * a.키움))
        큰 = 층im.resize((kw, kh), Image.LANCZOS)
        판 = Image.new('RGBA', (새w, 새h), (0, 0, 0, 0))
        # 목 자리가 제자리에 남게 붙인다
        ox = int(round(목[0] - 목[0] * a.키움))
        oy = int(round(목[1] - 목[1] * a.키움))
        판.paste(큰, (ox, oy))
        층im = 판

    헬멧판 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    헬멧판.paste(층im, (dx, dy))

    # ⓓ 정본에서 헬멧을 지운다(넓혀서) → 몸판
    지울것 = binary_dilation(H0, np.ones((a.넓힘, a.넓힘))) if a.넓힘 > 0 else H0
    # 🔴 잔털 — 헬멧 가장자리의 «밝은 털»은 어둡지 않아 헬멧 자에 안 잡히고 남는다. 검은 바탕에서 옛 헬멧 윤곽이
    #   희미한 테로 비친다(09-07 실측 · 알파도 높아 낮은-알파 규칙으로는 못 잡았다). 자리로 가른다:
    #   헬멧 높이의 위 3/4 구간 둘레 띠에는 몸이 없으니 거기 있는 점은 전부 옛 헬멧의 털이다 → 통째로 지운다.
    #   아래 1/4(어깨와 닿는 테두리)은 좁은 넓힘만 쓴다 — 넓히면 어깨를 먹는다(판2 의 「뒷배경 비침」이 그 자리였다).
    hy0_a, hy0_b = 상자(H0)[1], 상자(H0)[3]
    if a.테두리 > 0:
        띠 = 둥글게넓히다(H0, a.테두리 // 2)
        위쪽 = np.zeros_like(H0)
        위쪽[: int(hy0_b - (hy0_b - hy0_a) * 0.25), :] = True
        지울것 = 지울것 | (띠 & 위쪽 & (A0[..., 3] > 0))
    몸판 = A0.copy()
    몸판[지울것, 3] = 0
    낸것 = Image.fromarray(몸판, 'RGBA')
    낸것.alpha_composite(헬멧판)

    # ⓔ 못 덮은 점 세기 — 지운 자리 중 새 헬멧이 안 덮은 곳
    새알파 = np.array(헬멧판)[..., 3] > 128
    못덮음 = 지울것 & ~새알파
    # 헬멧 «바깥» 실루엣이 줄어 드러난 곳(위·옆 하늘)은 투명 층이라 배경이 비쳐도 사고가 아니다.
    # 사고 = 못 덮은 점 중 «몸에 닿은» 곳 — 목·어깨 이음새에 구멍이 난 자리다.
    # 🔴 B0 에는 옛 헬멧의 «밝은 털»도 들어 있어(어둡지 않아 헬멧 자 밖) 그대로 쓰면 헬멧 바깥 실루엣 전부가 «몸 곁»이 된다.
    #   몸은 헬멧 아래 1/4 보다 낮은 곳에만 있다 — 거기로 좁힌다.
    몸아래 = np.zeros_like(B0)
    몸아래[int(hy0_b - (hy0_b - hy0_a) * 0.25):, :] = True
    몸곁 = binary_dilation(B0 & 몸아래, np.ones((15, 15)))
    사고 = 못덮음 & 몸곁
    n사고 = int(사고.sum())

    os.makedirs(os.path.dirname(os.path.abspath(a.낼곳)), exist_ok=True)
    낸것.save(a.낼곳)
    print(f'■ 헬멧 얹기 → {a.낼곳}')
    print(f'   배율 {s:.4f}(정본 점 {n0:,} / 숙인 컷 점 {n1:,}) · 옮김 dx={dx} dy={dy} · 키움 {a.키움} · 넓힘 {a.넓힘}')
    print(f'   정본 헬멧 상자 {상자(H0)} · 얹은 헬멧 상자 {tuple(int(v) for v in np.array(상자(새알파)))}')
    print(f'   지운 점 {int(지울것.sum()):,} · 못 덮은 점 {int(못덮음.sum()):,} · 그중 몸 자리(사고) {n사고:,}'
          + ('  ✅' if n사고 == 0 else '  🔴 --키움 · --내림 · --옆 으로 잡는다'))

    if a.검사:
        검 = 낸것.convert('RGBA')
        회 = Image.new('RGBA', (W, H), (128, 128, 128, 255))
        회.alpha_composite(검)
        arr = np.array(회)
        arr[사고] = (255, 0, 255, 255)
        arr[못덮음 & ~몸곁] = (255, 200, 0, 255)
        검경로 = os.path.splitext(a.낼곳)[0] + '_검사.png'
        Image.fromarray(arr, 'RGBA').resize((1024, 1024), Image.LANCZOS).save(검경로)
        print(f'   검사 그림 → {검경로} (자홍 = 몸 자리 못 덮음 · 노랑 = 머리 위쪽 빈 자리)')
    if a.미리보기:
        미 = os.path.splitext(a.낼곳)[0] + f'_{a.미리보기}.png'
        낸것.resize((a.미리보기, a.미리보기), Image.LANCZOS).save(미)
        print(f'   미리보기 → {미}')


if __name__ == '__main__':
    main()
