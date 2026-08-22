# -*- coding: utf-8 -*-
"""앱 아이콘 세트 — 확정 몽글 배지 렌더판 하나에서 전 플랫폼 크기를 낸다.

왜 도구로 두나: 아이콘은 «한 번 만들고 끝»이 아니라 배지를 다시 구울 때마다 같이 갱신돼야 한다.
손으로 자르면 다음 사람이 옛 배지로 만든 아이콘을 그대로 쓰게 되고, 그 순간 앱 아이콘만
로고 정본에서 뒤처진다(마스코트 10벌이 공존하던 그 통로다).

규율 둘:
 ① **투명 판과 불투명 판을 둘 다 낸다.** iOS 는 알파가 있으면 스토어에서 반려하고(검게 합성된다),
    안드로이드 adaptive 와 웹 favicon 은 반대로 투명이 필요하다. 한 벌만 내면 반드시 한쪽이 깨진다.
 ② **여백은 크기가 아니라 «시각 무게»로 준다.** 배지는 옆모습이라 좌우 무게가 다르다 —
    알파 bbox 를 재서 실제 그림의 중심을 잡고, 그 중심을 정사각 한가운데에 놓는다.

통로: python tools/아이콘굽기.py    (배지를 먼저 구워야 한다 — node tools/룸굽기.js --굽기 로고배지)
"""
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow 가 없다: pip install Pillow")

루트 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
구움 = os.path.join(루트, "docs", "Loom_자산", "구움")
나갈곳 = os.path.join(루트, "docs", "Loom_자산", "아이콘")
원본 = os.path.join(구움, "로고배지_몸.png")

밤 = (8, 6, 5)              # Ink Deep #080605 — 불투명 판의 바탕(다크 팔레트 «양모 밤»)
여백비 = 0.085              # 그림이 정사각 변의 83% 를 차지한다(아이콘은 꽉 차면 답답하다)

# 크기표 — 이름에 쓰임을 박아 둔다. 「512 가 뭐였지」를 다음 사람이 안 묻게.
크기표 = [
    (1024, "appstore",     False),
    (512,  "play",         False),
    (512,  "pwa",          True),
    (256,  "desktop",      True),
    (192,  "pwa",          True),
    (180,  "apple-touch",  False),
    (128,  "desktop",      True),
    (96,   "android",      True),
    (64,   "web",          True),
    (48,   "android",      True),
    (32,   "favicon",      True),
    (16,   "favicon",      True),
]


def 다듬기(im):
    """알파 bbox 로 실제 그림을 잡아 정사각 한가운데에 여백과 함께 앉힌다."""
    bbox = im.split()[3].getbbox()
    if not bbox:
        sys.exit("🔴 원본이 통째로 투명하다 — 배지를 먼저 구워야 한다")
    잘림 = im.crop(bbox)
    변 = max(잘림.size)
    칸 = int(round(변 / (1.0 - 2 * 여백비)))
    판 = Image.new("RGBA", (칸, 칸), (0, 0, 0, 0))
    판.alpha_composite(잘림, ((칸 - 잘림.width) // 2, (칸 - 잘림.height) // 2))
    return 판, bbox


def main():
    if not os.path.exists(원본):
        sys.exit("🔴 배지 렌더판이 없다: %s\n   먼저: node tools/룸굽기.js --굽기 로고배지" % 원본)
    os.makedirs(나갈곳, exist_ok=True)
    im = Image.open(원본).convert("RGBA")
    판, bbox = 다듬기(im)
    print("원본 %s · 그림 bbox %s · 정사각 %d" % (im.size, bbox, 판.width))

    낸것 = []
    for 크기, 쓰임, 투명 in 크기표:
        작 = 판.resize((크기, 크기), Image.LANCZOS)
        if not 투명:
            바닥 = Image.new("RGBA", 작.size, 밤 + (255,))
            바닥.alpha_composite(작)
            작 = 바닥.convert("RGB")
        이름 = "synk-%s-%d.png" % (쓰임, 크기)
        경로 = os.path.join(나갈곳, 이름)
        작.save(경로, optimize=True)
        낸것.append((이름, os.path.getsize(경로)))

    # ICO — 윈도·브라우저 탭이 아직 쓴다. 여러 크기를 한 파일에 담는 형식이다.
    ico = os.path.join(나갈곳, "synk.ico")
    판.resize((256, 256), Image.LANCZOS).save(
        ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    낸것.append(("synk.ico", os.path.getsize(ico)))

    print("\n■ 아이콘 %d개 — %s" % (len(낸것), 나갈곳))
    for 이름, 바이트 in 낸것:
        print("  %-26s %6.1f KB" % (이름, 바이트 / 1024))
    print("\n  투명 = PWA·안드로이드·favicon · 불투명(양모 밤) = App Store·Play·apple-touch")


if __name__ == "__main__":
    main()
