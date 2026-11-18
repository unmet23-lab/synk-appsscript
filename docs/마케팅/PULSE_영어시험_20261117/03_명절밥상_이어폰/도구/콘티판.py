# 셋째 편 이미지 콘티 검수 판(2026-11-17) — 정지 그림 여덟 장을 컷 순서대로 한 장에 놓고, 검수용 컷 표(그림 번호 · 시각 · 화면 · 소리 · 글자)를 쓴다.
#   슬롭 점검표 「심사 지시문」 156줄: 꼬리표와 표에서 연기 칸 · 감정 낱말 · 기승전결 표시를 뺀다. 첫 질문은 그림만 보고 「무슨 이야기로 읽히나」.
#   python -X utf8 도구/콘티판.py  → 검수/콘티판.jpg · 검수/콘티표_검수용.md
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "검수")
FONT = "C:/Windows/Fonts/arial.ttf"

# 화면 · 소리 · 글자는 감정 낱말 없이 보이는 것과 들리는 것만 적는다(컷표의 구도 · 소리 칸에서 옮겨 적음).
ROWS = {
    "C1": ("A woman (28) at a crowded holiday table, chopsticks raised with a dumpling; an older woman's hand at the left edge places a piece of pancake on her plate.",
           "Table clatter. 0.6s, older woman off-screen left: \"So... any wedding plans?\"",
           "One-line speech caption: \"So... any wedding plans?\""),
    "C2": ("Across the table: an older man in a brown knit and a younger man in a blue shirt, both talking toward camera at once.",
           "Overlapping: \"You look thin. Eating okay?\" / \"I got promoted, you know.\" The older woman keeps talking off-screen.",
           "Two more speech captions stack above the first."),
    "C3": ("Close-up of the young woman's face, wireless earbuds in both ears; her left hand rises into frame toward her left ear.",
           "Three voices overlap and thicken. Off-screen: \"Seeing anyone yet?\"",
           "A fourth one-line caption stacks; four short lines on screen, below her chin."),
    "C3b": ("Macro from her left side: her left ear and the earbud in it; her index fingertip just above the earbud.",
            "0.6s: a small 'tap'. On that frame every voice cuts out; only a low hum remains.",
            "All stacked captions vanish on the tap frame."),
    "C4": ("Wide: the whole table. The relatives' mouths keep moving; the young woman eats a dumpling with her eyes closed. An older hand in a lilac sleeve rests on the table at the right edge. A small pale-green earbud case sits beside her rice bowl.",
           "Near silence: low hum and the small sound of her chewing.",
           "None."),
    "C5": ("From the grandmother's side: the lilac-sleeved hand, resting beside her arm, taps the young woman's left shoulder once; she turns and takes out her left earbud. The hand then pushes the dumpling plate toward her.",
           "Room sound returns. 1.8s, grandmother off-screen right, slow old voice: \"Eat more.\"",
           "Caption: \"Eat more.\""),
    "C6": ("Close: she answers the grandmother (blurred lilac shoulder in front), then turns her head toward the older woman and lifts the earbud toward her left ear.",
           "0.3s her: \"Okay, Grandma.\" 1.0s older woman off-screen left starts: \"Your boyfriend-\"",
           "Caption \"Okay, Grandma.\", then the older woman's line starts."),
    "C6b": ("Ear macro from her left side, the mirror of shot 4: her fingertips hold the earbud just in front of her empty left ear, then press it in.",
            "0.3s: a small click as it goes in; on that frame the older woman's line is cut off; low hum.",
            "The older woman's caption vanishes mid-word."),
    "C7": ("Low table-height shot: the small closed pale-green earbud case beside her rice bowl; behind, out of focus, the young woman chewing with eyes closed and the older woman still talking.",
           "Quiet hum. 20.6s: the same 'tap' once more.",
           "18.3-20.6s: brand name logotype on the wall above their heads, tagline \"Hear only what matters.\" 20.6s to the end (23.2s): end card - SYNK PULSE logo, synk.im/en/pulse, \"Directed by an actor.\" Small line at the lower right of the safe area (above the app buttons) from 18.0s: \"Fictional brand - Every person on screen is an AI model\"."),
}


def main():
    d = json.load(open(os.path.join(HERE, "컷표.json"), encoding="utf-8"))
    cuts = d["detail"]
    os.makedirs(OUT, exist_ok=True)
    tw, th, top = 405, 720, 44
    cols = 4
    rows = (len(cuts) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw + (cols + 1) * 12, rows * (th + top) + (rows + 1) * 12), (16, 16, 16))
    dr = ImageDraw.Draw(sheet)
    f = ImageFont.truetype(FONT, 26)
    lines = ["# 셋째 편 이미지 콘티 — 검수용 컷 표", "", "그림 판은 `검수/콘티판.jpg`이고, 번호는 판의 꼬리표와 같다. 9:16 세로, 23.2초, 화면 글과 말은 모두 영어다.", "",
             "| 번호 | 시각 | 화면 | 소리 | 글자 |", "|---|---|---|---|---|"]
    for i, c in enumerate(cuts):
        n = i + 1
        im = Image.open(os.path.join(HERE, c["시작그림"])).convert("RGB")
        s = max(tw / im.width, th / im.height)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        x0, y0 = (im.width - tw) // 2, (im.height - th) // 2
        im = im.crop((x0, y0, x0 + tw, y0 + th))
        x = 12 + (i % cols) * (tw + 12)
        y = 12 + (i // cols) * (th + top + 12)
        dr.text((x + 4, y + 8), f"{n}   {float(c['t']):.1f}s", font=f, fill=(240, 240, 240))
        sheet.paste(im, (x, y + top))
        scr, snd, txt = ROWS[c["cut"]]
        lines.append(f"| {n} | {float(c['t']):.1f}~{float(c['t']) + float(c['dur']):.1f}s | {scr} | {snd} | {txt} |")
    sheet.save(os.path.join(OUT, "콘티판.jpg"), quality=90)
    open(os.path.join(OUT, "콘티표_검수용.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("콘티판:", os.path.join(OUT, "콘티판.jpg"))


if __name__ == "__main__":
    main()
