# -*- coding: utf-8 -*-
"""마스코트 속 «유령 윤곽» 국소 제거 — 이방성 확산(Perona-Malik) (2026-08-14 · ㉢ 실물).

정체 (재검증 08-14 · 독립 3자 — 윤곽장·단면 프로파일·컷 간 대조 r=0.867):
  속 유백은 «형상»이다 — 속 빈 유리껍질의 뒷벽이 앞면으로 비쳐, 몸통 중앙에
  바깥과 같은 모양의 «작은 유령» 윤곽이 선다. 가로 단면은 부드러운 돔이 아니라
  「평평한 대지 + 양끝 절벽」 — 그래서 「빛 번짐」이 아니라 「안에 든 물체」로 읽힌다.

왜 확산인가 (같은 날 1판 실패의 기록):
  1판 = 주파수 대역 수술(약한 |mid| 대역만 빼기) → **불합격**. 대역 마스크의 경계가
  스스로 새 단차를 만들었고(3.5배 증폭에서 오각형 이음매), 눈 둘레 중간주파가
  대역에 걸려 번졌다. 마스크 경계가 있는 방법은 이 자리에서 원리상 같은 흉터를 남긴다.
  확산은 경계 마스크가 없다 — 약한 그래디언트는 스스로 퍼져 사라지고,
  강한 그래디언트(광택·눈·유리 테)는 g(|∇|)≈0 이라 안 움직인다.

지키는 것 (실측 — 본체 기준):
  · 코어 hex #FD7787 → #FD7786 (IP 색 보존 · 아래 «색 가드»가 어긋나면 소리친다)
  · 보정은 저해상(1/4) 저주파층에만 — 원본의 잔결·광택은 비트 단위 보존
  · 실루엣(알파) 무변경 · 재생성 0 (유호 판정 08-14: 재생성=AI티)

틀릴 때의 모습: 확산이 과하면(반복↑·K↑) 안쪽 명암이 전부 녹아 무광 플라스틱으로
  기운다 — ⓑ 저주파 평탄화가 실패한 그 자리다. 손잡이는 K(4.5)·반복(420)이고,
  기본값은 «유령 윤곽은 지워지고 상하 그라데이션은 남는» 실측 지점이다.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # cp949 콘솔에서 — · ⚠ 가 죽는다

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
누끼 = os.path.join(ROOT, "docs", "캐릭터", "마스코트_누끼")
격자 = 256  # 확산 격자 크기 — 입력 해상과 무관하게 고정해야 1024든 2048이든 같은 수술이 된다


def 코어hex(rgb, al):
    속 = al > 250
    r, g, b = rgb[..., 0][속], rgb[..., 1][속], rgb[..., 2][속]
    L = 0.299 * r + 0.587 * g + 0.114 * b
    lo, hi = np.percentile(L, 40), np.percentile(L, 60)
    sel = (L >= lo) & (L <= hi)
    return (int(np.median(r[sel])), int(np.median(g[sel])), int(np.median(b[sel])))


def 속수리(im, K=4.5, lam=0.22, 반복=420):
    a = np.array(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    W, H = im.size
    S = max(1, round(W / 격자))

    small = np.asarray(im.resize((W // S, H // S), Image.LANCZOS), np.float32)
    srgb, sal = small[..., :3].copy(), small[..., 3]

    # 확산 허용 = 몸 안쪽(침식)만 · 눈(어두운 원)은 제외 — 눈 경계는 원본 그대로 둔다
    m = Image.fromarray(((sal > 250) * 255).astype(np.uint8))
    for _ in range(3):
        m = m.filter(ImageFilter.MinFilter(5))
    inner = np.asarray(m, np.float32) / 255.0
    sL = 0.299 * srgb[..., 0] + 0.587 * srgb[..., 1] + 0.114 * srgb[..., 2]
    눈 = Image.fromarray(((sL < 70) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
    inner = inner * (1.0 - np.asarray(눈, np.float32) / 255.0)

    # Perona-Malik: x += λ·Σ g(Δ밝기)·Δ — 밝기 하나로 g 를 공유해 색상(hue)이 안 갈라진다
    x = srgb.copy()
    for _ in range(반복):
        xL = 0.299 * x[..., 0] + 0.587 * x[..., 1] + 0.114 * x[..., 2]
        upd = np.zeros_like(x)
        for axis, sign in ((0, 1), (0, -1), (1, 1), (1, -1)):
            dL = np.roll(xL, sign, axis=axis) - xL
            g = np.exp(-(dL / K) ** 2) * np.roll(inner, sign, axis=axis) * inner
            for c in range(3):
                upd[..., c] += g * (np.roll(x[..., c], sign, axis=axis) - x[..., c])
        x += lam * upd

    # 보정장(확산 − 원본 저주파)만 원해상으로 올려 더한다 — 원본 잔결·광택은 그대로
    corr = np.stack([
        np.asarray(Image.fromarray(np.clip(x[..., c] - srgb[..., c] + 128, 0, 255).astype(np.uint8))
                   .resize((W, H), Image.LANCZOS), np.float32) - 128
        for c in range(3)], axis=-1)

    mf = Image.fromarray(((al > 250) * 255).astype(np.uint8))
    for _ in range(4):
        mf = mf.filter(ImageFilter.MinFilter(9))
    w = np.asarray(mf.filter(ImageFilter.GaussianBlur(10)), np.float32) / 255.0
    out = rgb + corr * w[..., None]

    # ── 색 가드: 코어 hex 가 채널당 3 이상 밀리면 이 수술은 실패다(과교정을 초록으로 못 부른다)
    før, efter = 코어hex(rgb, al), 코어hex(out, al)
    drift = max(abs(a1 - a2) for a1, a2 in zip(før, efter))
    상태 = "OK" if drift <= 3 else "⚠ 코어 밀림 — K·반복을 줄여라"
    print(f"  코어 #{før[0]:02X}{før[1]:02X}{før[2]:02X} → #{efter[0]:02X}{efter[1]:02X}{efter[2]:02X}"
          f" (최대 채널 Δ{drift}) {상태}")
    return Image.fromarray(np.clip(np.dstack([out, al]), 0, 255).astype(np.uint8), "RGBA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--컷", default="본체.png")
    ap.add_argument("--전컷", action="store_true", help="누끼 폴더의 모든 컷에 적용(확정 후 전량 일괄용)")
    ap.add_argument("--나가는곳", default=os.path.join(ROOT, "docs", "캐릭터", "속수리안_0814"))
    a = ap.parse_args()
    os.makedirs(a.나가는곳, exist_ok=True)

    컷들 = sorted(f for f in os.listdir(누끼) if f.endswith(".png")) if a.전컷 else [a.컷]
    for 컷 in 컷들:
        print(컷)
        im = Image.open(os.path.join(누끼, 컷)).convert("RGBA")
        속수리(im).save(os.path.join(a.나가는곳, 컷))
    print(f"\n{len(컷들)}컷 → {a.나가는곳}  (산출 PNG 는 git 에 안 담는다 — 이 도구가 언제든 다시 만든다)")


if __name__ == "__main__":
    main()
