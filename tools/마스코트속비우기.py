# -*- coding: utf-8 -*-
"""
마스코트 속 비우기 — 「안에 뭐가 들어있는 것 같다」를 없앤다 (유호 지시 2026-08-14).

무엇이 문제였나 (실측):
  채도로는 안 갈렸다 — 몸 안쪽 채도는 고르다. 문제는 **평평함**이다. 확정 렌더의 내부는
  거의 균일한 한 덩어리로 칠해져 있고, 그 바깥을 진한 유리 테가 또렷하게 두른다.
  그래서 「체리 유리」가 아니라 **「유리 안에 든 유백색 물체」**로 읽힌다.
  진짜 두꺼운 유리라면 빛이 «두께만큼» 줄어서 안쪽에 농담이 생긴다 — 그게 빠져 있다.

무엇을 하나:
  실루엣 가장자리로부터의 «거리»를 재서, 두꺼운 곳(중앙·아래)일수록 색이 깊어지게 한다.
  = 램버트-비어 흡수의 아주 단순한 형태. 새 색을 칠하는 게 «아니라» 정본 램프 안에서
  Core → Deep 쪽으로 내려보내는 것이라, 확정 hex 밖으로 나가지 않는다.

무엇을 안 하나:
  · 하이라이트·눈·유리 테는 안 건드린다(고주파 반사는 유리의 질감 그 자체다).
  · 색상(hue)을 안 돌린다 — 체리 고유색은 마스코트 IP 다.
  · 재생성 안 한다 — 그게 「AI티」의 원인이다(유호 판정 08-14).
"""
import argparse
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
누끼 = os.path.join(ROOT, "docs", "캐릭터", "마스코트_누끼")


def 두께장(al):
    """실루엣 안쪽으로 얼마나 «깊은가». 거리변환 대신 반복 축소로 만든다(의존성 0).
       가장자리 0 → 중앙 1 로 부드럽게 오르는 장."""
    m = (al > 128).astype(np.float32)
    누적 = np.zeros_like(m)
    현재 = m.copy()
    for _ in range(26):
        현재 = np.asarray(
            Image.fromarray((현재 * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(9)),
            np.float32) / 255.0
        누적 += 현재
    누적 /= max(누적.max(), 1e-6)
    return np.asarray(Image.fromarray((누적 * 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(18)), np.float32) / 255.0


def _가린흐림(x, m, sigma):
    """실루엣 «안쪽만» 흐린다. 그냥 흐리면 바깥의 투명 픽셀이 섞여 테두리가 뜬다."""
    num = np.asarray(Image.fromarray(np.clip(x * m, 0, 255).astype(np.uint8))
                     .filter(ImageFilter.GaussianBlur(sigma)), np.float32)
    den = np.asarray(Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8))
                     .filter(ImageFilter.GaussianBlur(sigma)), np.float32) / 255.0
    return num / np.maximum(den, 1e-3)


def 흡수(im, 세기=1.0, 아래무게=0.5):
    """두꺼운 곳을 «진하게» 만든다 — 젤리의 물리를 되돌려 놓는 쪽.

    이 렌더는 가운데가 «밝은» 유백이라 물리가 뒤집혀 있다(서브서피스 과다).
    진짜 두꺼운 체리 젤리는 가운데가 깊고 가장자리가 밝다 — 그래서 「든 것」이 아니라
    「한 덩어리」로 읽힌다. 채널별 흡수로 그 기울기만 되돌리고, **정규화로 밝기를 복원**한다
    (첫 판이 실패한 이유가 정규화 없이 그냥 어두워진 것이었다 — 코어가 IP 색 밖으로 나갔다)."""
    a = np.array(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    H = al.shape[0]

    깊이 = 두께장(al)
    ys = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    깊이 = 깊이 * ((1 - 아래무게) + 아래무게 * (0.4 + 0.6 * ys))

    L = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    저 = np.asarray(Image.fromarray(np.clip(L, 0, 255).astype(np.uint8))
                    .filter(ImageFilter.GaussianBlur(22)), np.float32)
    반사 = np.clip((L - 저) / 26.0, 0, 1)                  # 또렷한 반사 = 유리의 질감
    눈 = np.clip((60.0 - L) / 40.0, 0, 1)
    k = (깊이 * 세기 * (1 - np.clip(반사 + 눈, 0, 1)))[..., None]

    흡수계수 = np.array([0.10, 0.50, 0.46], np.float32)     # 적색은 덜 먹는다 = 붉게 깊어진다
    out = rgb * (1.0 - k * 흡수계수)

    # ── 정규화 — 안쪽 코어 밝기를 원본으로 되돌린다(색은 깊어지되 «어두워지지» 않게)
    안 = al > 250
    def 코어밝기(x):
        v = 0.299 * x[..., 0][안] + 0.587 * x[..., 1][안] + 0.114 * x[..., 2][안]
        lo, hi = np.percentile(v, 40), np.percentile(v, 60)
        return float(np.median(v[(v >= lo) & (v <= hi)]))
    g = 코어밝기(rgb) / max(코어밝기(out), 1e-3)
    out = out * g

    return Image.fromarray(np.clip(np.dstack([out, al]), 0, 255).astype(np.uint8), "RGBA")


def 속비우기(im, 세기=1.0, 시그마=64):
    """저주파 단차만 지운다 — 고주파(하이라이트·반사·눈)는 «비트 단위로» 그대로 남는다.

    첫 판(흡수 모델)은 실패했다: 코어가 #FD7787 → #E13F4B 로 밀려 IP 색이 죽었고,
    밝기 편차도 51.7 → 45.3 으로 «더 평평»해졌다(고치려던 것을 악화시켰다).
    진짜 원인은 평평함이 아니라 **유백 코어와 진한 껍질 사이의 끊김**이었다.
    그래서 그 «저주파 차이»만 상수장으로 끌어당긴다 — 더하는 것이 부드러운 장 하나뿐이라
    고주파는 정의상 보존되고, 목표값이 안쪽 «평균»이라 코어 hex 는 오히려 정본에 붙는다.
    """
    a = np.array(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]

    안 = (al > 200).astype(np.float32)
    if 안.sum() < 100:
        return im

    # 테두리 보호 — 유리 테는 이 캐릭터의 질감이라 손대지 않는다.
    w = 두께장(al)
    w = np.clip((w - 0.06) / 0.34, 0, 1)
    w = w * w * (3 - 2 * w)

    out = rgb.copy()
    for c in range(3):
        저 = _가린흐림(rgb[..., c], 안, 시그마)
        목표 = float((rgb[..., c] * 안).sum() / 안.sum())     # 안쪽 평균 = 정본 코어 근처
        out[..., c] = rgb[..., c] + w * 세기 * (목표 - 저)

    return Image.fromarray(
        np.clip(np.dstack([out, al]), 0, 255).astype(np.uint8), "RGBA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--컷", default="본체.png")
    ap.add_argument("--세기", type=float, default=None, help="한 장만 뽑을 때")
    ap.add_argument("--방식", default="흡수", choices=["흡수", "평탄"],
                    help="흡수=두꺼운 곳을 진하게(물리 복원) · 평탄=저주파 단차 제거")
    ap.add_argument("--나가는곳", default=os.path.join(ROOT, "docs", "캐릭터", "속비우기_0814"))
    a = ap.parse_args()
    os.makedirs(a.나가는곳, exist_ok=True)

    원본 = Image.open(os.path.join(누끼, a.컷)).convert("RGBA")
    세기들 = [a.세기] if a.세기 is not None else [0.0, 0.45, 0.75, 1.05]

    방식 = 흡수 if a.방식 == "흡수" else 속비우기
    for s in 세기들:
        img = 원본 if s == 0 else 방식(원본, 세기=s)
        이름 = "0_원본" if s == 0 else f"{a.방식}{s:.2f}".replace(".", "")
        img.save(os.path.join(a.나가는곳, f"{이름}.png"))

        b = np.array(img).astype(float)
        속 = b[..., 3] > 250
        r, g, bl = b[..., 0][속], b[..., 1][속], b[..., 2][속]
        L = 0.299 * r + 0.587 * g + 0.114 * bl
        mx = np.maximum(np.maximum(r, g), bl); mn = np.minimum(np.minimum(r, g), bl)
        S = (mx - mn) / np.maximum(mx, 1)
        lo, hi = np.percentile(L, 40), np.percentile(L, 60)
        sel = (L >= lo) & (L <= hi)
        코어 = (np.median(r[sel]), np.median(g[sel]), np.median(bl[sel]))
        print(f"{이름:10s} 코어 #{int(코어[0]):02X}{int(코어[1]):02X}{int(코어[2]):02X}"
              f" · 평균 채도 {S.mean():.3f} · 밝기 편차 {L.std():5.1f}"
              f" · 밝기 중앙 {np.median(L):5.1f}")

    print("\n밝기 «편차»가 클수록 안쪽에 농담이 있다 = 덜 평평하다 = 「든 것」으로 안 읽힌다.")


if __name__ == "__main__":
    main()
