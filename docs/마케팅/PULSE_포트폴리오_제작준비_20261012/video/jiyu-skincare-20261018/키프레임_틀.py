# 지유 스킨케어: Gemini 키프레임을 콘티의 틀(어깨 위·가슴 위)로 잘라 `<이름>_틀.jpg`로 저장한다.
#   python 키프레임_틀.py            → 키프레임_A/컷5_v2_틀.jpg 등
# 10-18: 「어깨 위」를 적어도 Gemini가 허리 위로 넓게 뽑는 일이 잦다. H3는 768×1344로 만들므로
# 원본(1536×2752)에서 9:16 창을 잘라도 짧은 변이 768보다 크면 화질이 남는다. 그래서 다시 뽑지 않고 자른다.
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
K = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "키프레임_A")

# 이름: (왼, 위, 폭) — 높이는 폭 × 16/9
BOXES = {
    # 컷 5 왼쪽 옆얼굴: 어깨 위. 코끝 앞(창 쪽)에 22% 여유, 헤어밴드 위 9% 여유
    "컷5_v2.jpg": (181, 250, 1238),
    # 컷 5 v3(Fable 2차: 코를 참조 02처럼 짧게, 70° 반옆얼굴): 같은 틀. v3b는 볼 점 셋을 지운 판(키프레임_지우기.py)
    "컷5_v3b.jpg": (210, 257, 1238),
    # 컷 4 화장솜: 가슴 위. 얼굴을 가운데, 헤어밴드 위 8% 여유
    "컷4_v2.jpg": (260, 308, 1125),
    # 훅 C 수건: 어깨 위. 「가까이」 판은 헤어밴드가 위 끝에 붙어, 처음 넓게 나온 판에서 위 여백 9%를 두고 자른다
    "훅C.jpg": (181, 238, 1181),
    # 컷 7 엔드카드: 1:1(2048²)로 뽑아 왼쪽에 치우친 9:16 창. 지유는 창 왼쪽 2/3, 오른쪽 1/3은 빈 그늘 벽(병·글자 자리)
    "컷7_v3.jpg": (280, 0, 1152),
}


def main():
    for name, (x, y, w) in BOXES.items():
        h = round(w * 16 / 9)
        im = Image.open(os.path.join(K, name)).convert("RGB")
        if x < 0 or y < 0 or x + w > im.width or y + h > im.height:
            raise SystemExit(f"{name}: 창 {x},{y},{w}x{h}가 그림 {im.size} 밖으로 나감")
        if w < 768:
            raise SystemExit(f"{name}: 폭 {w}가 H3 입력 768보다 작음")
        out = os.path.join(K, name.replace(".jpg", "_틀.jpg"))
        im.crop((x, y, x + w, y + h)).save(out, quality=95)
        print(f"{name} → {os.path.basename(out)} ({w}x{h})")


if __name__ == "__main__":
    main()
