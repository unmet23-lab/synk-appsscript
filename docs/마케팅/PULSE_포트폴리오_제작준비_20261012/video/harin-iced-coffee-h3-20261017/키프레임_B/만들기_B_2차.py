# B판 키프레임 2차: Fable 검수(10-18)로 컷 1·5a만 다시 뽑는다. 나머지는 1차(만들기_B.py) 고른 판 그대로, 4b는 시드 404로 바꿈.
#   컷 1: 해가 화면 오른쪽에서 오고 렌즈를 보며 입을 벌림(윗니) → 숨·찡그림 대신 가늘게 뜬 눈·다문 입·먼 곳 시선, 그림자 경계를 글로 못 박음
#   컷 5a: 포니테일이 귀 높이(HAIR 공통문이 빠졌음) → 정수리 포니테일, 빈 골목(차·간판 대신 맨 아스팔트·낮은 벽돌집)
#   햇빛 컷 머리가 기준보다 밝게 나와 이 두 컷은 dark chestnut brown으로 쓴다.
# 순서: python -X utf8 만들기_B_2차.py jobs → comfy_run.py B2_jobs.json B2_results.json → python -X utf8 만들기_B_2차.py sheet
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import 만들기_B as B  # noqa: E402

HAIR2 = "high ponytail tied at the crown with loose wisps at the temples and wispy see-through bangs, dark chestnut brown hair"
CUTS = [
    ("K1r", "컷 1 · 2차(빛 왼쪽, 입 다묾)", 768, 1344,
     f"{B.T}, chest-up, face turned 20 degrees to the left of the frame, eyes narrowed to thin slits against the glare, lips pressed together, "
     f"gazing far off to the left of the frame, {HAIR2}, {B.KNIT}, standing at the sunny edge of the awning, {B.PLACE}, "
     "harsh direct midday sun, the awning's hard shadow edge cutting diagonally across her face, the cheek on the left of the frame in blazing direct sun, "
     "the cheek on the right of the frame in deep shade, nose shadow falling to the right, bright slightly overexposed empty alley behind, "
     f"{B.SKIN}, {B.CAM}, 65mm, moderate depth of field"),
    ("K5ar", "컷 5a · 2차(정수리 포니테일, 빈 골목)", 768, 1344,
     f"{B.T}, seen from behind with the camera slightly above her shoulder, the back of her head, her face hidden, {HAIR2}, "
     "her ponytail swept to one side by a gust of wind, the edge of the striped awning lifting in the wind, "
     f"looking down an empty sunlit alley road ahead, bare asphalt, low brick houses, {B.KNIT}, sitting at the old oak table under a faded navy-and-white striped canvas awning, "
     f"hot July afternoon, harsh direct midday sunlight from the left of the frame, strong contrast, {B.CAM}, 50mm, moderate depth of field"),
]
SEEDS = [411, 412, 413, 414, 415, 416]


def jobs():
    out = []
    for key, label, w, h, prompt in CUTS:
        for s in SEEDS:
            out.append({"name": f"{key}_{s}", "row": label, "col": f"시드 {s}", "seed": s, "width": w, "height": h,
                        "prompt": prompt, "lora": B.LORA, "lora_strength": 1.0})
    json.dump({"defaults": {"folder": "f02_harin_v2/keyframe_B2"}, "jobs": out},
              open(os.path.join(HERE, "B2_jobs.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(out)}장")


def sheet():
    res = json.load(open(os.path.join(HERE, "B2_results.json"), encoding="utf-8"))
    font = lambda s: ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", s)
    for key, label, w, h, _ in CUTS:
        part = [r for r in res if r["name"].startswith(key + "_")]
        cw = 300
        ch = int(cw * h / w)
        im = Image.new("RGB", (cw * len(part), ch + 70), "white")
        d = ImageDraw.Draw(im)
        d.text((8, 6), label, fill="black", font=font(18))
        for i, r in enumerate(part):
            t = Image.open(os.path.join(B.COMFY_OUTPUT, r["files"][0])).convert("RGB").resize((cw, ch), Image.LANCZOS)
            im.paste(t, (i * cw, 36))
            d.text((i * cw + 6, ch + 42), r["col"], fill=(70, 70, 70), font=font(14))
        path = os.path.join(HERE, "비교판", f"{key}.jpg")
        im.save(path, quality=88)
        print(path)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    {"jobs": jobs, "sheet": sheet}[sys.argv[1]]()
