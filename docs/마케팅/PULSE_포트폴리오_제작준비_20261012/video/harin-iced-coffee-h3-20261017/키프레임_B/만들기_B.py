# 하린 아이스커피 콘티 v4 · B판(LoRA) 키프레임: 여름 기준 2장 + 하린 컷 6장(1·4a·4b·5a·5b·7).
#   지시문은 v4 4절 「판 B 지시문 서식」과 ⑦ 검증에서 더한 것(포니테일 높이·센 측광·빈 골목)을 따른다.
#   컷마다 시드 4개(LoRA 1.0), 측광이 중요한 컷 1·4b·5b는 LoRA 0.8도 시드 2개로 같이 뽑아 고른다.
# 순서(ComfyUI 127.0.0.1:8188이 켜져 있을 때):
#   1) python -X utf8 만들기_B.py jobs
#   2) C:\SYNK-LoRA\tools\ComfyUI\venv\Scripts\python.exe -X utf8 C:\SYNK-LoRA\tools\comfy_run.py B_jobs.json B_results.json
#   3) python -X utf8 만들기_B.py sheet   (컷마다 한 장 비교판, 얼굴 확대 줄 포함)
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
COMFY_OUTPUT = r"C:\SYNK-LoRA\tools\ComfyUI\output"
LORA = "f02_harin_v2\\f02_harin_v2.safetensors"
T = "pls_f02, a young Korean woman"
HAIR = "high ponytail tied at the crown with loose wisps at the temples and wispy see-through bangs, warm medium chestnut brown hair"
KNIT = "pale yellow short-sleeve fine-knit top"
PLACE = "small cafe terrace under a faded navy-and-white striped canvas awning in an empty Seoul residential alley, old oak table, hot July afternoon around 2 pm"
LIGHT = ("harsh direct sunlight from camera left, strong contrast, crisp shadow edge across her face, "
         "the camera-left side of her face brightly lit, deep shade on the camera-right half of her face, "
         "bright slightly overexposed empty alley behind")
SKIN = "unretouched skin with visible pores and fine vellus hair, slight natural asymmetry, a little shine on the nose from the heat"
CAM = "live-action film still, full-frame cinema camera"
WALL = "in front of a plain warm-grey plaster wall of a Seoul alley cafe, open shade, hard sun from camera left on one side of her face"

CUTS = [
    ("Ba", "여름 기준 ⓐ 45도 상반신", 960, 1280,
     f"{T}, chest-up, body turned 45 degrees to camera right, relaxed closed-mouth expression, looking slightly off camera, {HAIR}, {KNIT}, standing {WALL}, {SKIN}, {CAM}, 65mm, moderate depth of field"),
    ("Bb", "여름 기준 ⓑ 정면 전신", 768, 1344,
     f"{T}, full body shot from head to toe with space above her head and below her shoes, front view, standing naturally with her arms relaxed at her sides, camera at chest height, {HAIR}, {KNIT}, light-wash denim mini skirt, plain white low sneakers, standing {WALL}, {SKIN}, {CAM}, 50mm"),
    ("K1", "컷 1 · 차양 끝 햇빛, 찡그림", 768, 1344,
     f"{T}, chest-up, face turned 20 degrees to camera left, squinting against the glare, letting out a short breath, {HAIR}, {KNIT}, standing at the sunny edge of the awning, {PLACE}, {LIGHT}, {SKIN}, {CAM}, 65mm, moderate depth of field"),
    ("K4a", "컷 4a · 45도 한 모금", 768, 1344,
     f"{T}, chest-up, body turned 45 degrees to camera right, sitting at the old oak table at the sunny edge of the awning shade, holding a clear glass of iced coffee to her lips with both hands mid-sip, eyes half closed, {HAIR}, {KNIT}, {PLACE}, {LIGHT}, {SKIN}, {CAM}, 65mm, moderate depth of field"),
    ("K4b", "컷 4b · 정면 눈 감고 숨", 768, 1344,
     f"{T}, shoulders-up, front view, eyes closed, breathing out with relief, lips closed, shoulders dropping slightly, sitting in the awning shade, {HAIR}, {KNIT}, {PLACE}, {LIGHT}, {SKIN}, {CAM}, 65mm, moderate depth of field"),
    ("K5a", "컷 5a · 어깨 너머 뒤, 바람", 768, 1344,
     f"{T}, seen from slightly behind and above her shoulder, the back of her head, her face hidden, her high ponytail swept to one side by a gust of wind, the edge of the striped awning lifting in the wind, looking down the sunlit empty alley, {KNIT}, {PLACE}, harsh direct midday sunlight from camera left, strong contrast, {CAM}, 50mm, moderate depth of field"),
    ("K5b", "컷 5b · 골목을 보는 가슴 위", 768, 1344,
     f"{T}, chest-up at eye level, eyes open, looking off toward the sunlit alley at camera left, lips relaxed and closed, a breeze moving the loose wisps at her temples, wispy see-through bangs on her forehead, {HAIR}, {KNIT}, sitting in the awning shade, {PLACE}, {LIGHT}, {SKIN}, {CAM}, 50mm, moderate depth of field"),
    ("K7", "컷 7 · 엔드카드, 카메라 봄", 768, 1344,
     f"{T}, chest-up, body turned 45 degrees to camera right, sitting at the old oak table in the awning shade, a clear glass of iced coffee standing at the lower left of the frame, looking into the camera with a small friendly closed-mouth smile, plain shaded plaster wall in the upper left, {HAIR}, {KNIT}, {PLACE}, harsh direct sunlight from camera left lighting one side of her face, the other side in shade, {SKIN}, {CAM}, 65mm, moderate depth of field"),
]
SEEDS = [401, 402, 403, 404]
LOW = {"K1", "K4b", "K5b"}


def jobs():
    out = []
    for key, label, w, h, prompt in CUTS:
        for s in SEEDS:
            out.append({"name": f"{key}_{s}_s10", "row": label, "col": f"시드 {s} · LoRA 1.0", "seed": s,
                        "width": w, "height": h, "prompt": prompt, "lora": LORA, "lora_strength": 1.0})
        if key in LOW:
            for s in SEEDS[:2]:
                out.append({"name": f"{key}_{s}_s08", "row": label, "col": f"시드 {s} · LoRA 0.8", "seed": s,
                            "width": w, "height": h, "prompt": prompt, "lora": LORA, "lora_strength": 0.8})
    json.dump({"defaults": {"folder": "f02_harin_v2/keyframe_B"}, "jobs": out},
              open(os.path.join(HERE, "B_jobs.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(out)}장")


def sheet():
    res = json.load(open(os.path.join(HERE, "B_results.json"), encoding="utf-8"))
    font = lambda s: ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", s)
    os.makedirs(os.path.join(HERE, "비교판"), exist_ok=True)
    for key, label, w, h, _ in CUTS:
        part = [r for r in res if r["name"].startswith(key + "_")]
        cw = 300
        ch = int(cw * h / w)
        im = Image.new("RGB", (cw * len(part), ch + 70), "white")
        d = ImageDraw.Draw(im)
        d.text((8, 6), label, fill="black", font=font(18))
        for i, r in enumerate(part):
            t = Image.open(os.path.join(COMFY_OUTPUT, r["files"][0])).convert("RGB").resize((cw, ch), Image.LANCZOS)
            im.paste(t, (i * cw, 36))
            d.text((i * cw + 6, ch + 42), r["col"], fill=(70, 70, 70), font=font(14))
        path = os.path.join(HERE, "비교판", f"{key}.jpg")
        im.save(path, quality=88)
        print(path)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    {"jobs": jobs, "sheet": sheet}[sys.argv[1]]()
