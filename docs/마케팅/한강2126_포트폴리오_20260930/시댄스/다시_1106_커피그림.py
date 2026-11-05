# 커피 쏟아지는 초근접 시작 그림(11-06 유호님 「커피쏟는것 … 이런게 빠져서 몰입감이 떨어지는 느낌」) — 얼굴 없는 초근접이라 얼굴 세트 없이
import json
H = "C:/Users/q1212/Videos/한강2126_새판_20261009/재촬영_v40"
ROOT = f"{H}/시댄스/다시_1106"
K = lambda k: f"{H}/시댄스/그림/{k}.jpg"
job = {"id": "CUP", "ratio": "9:16", "refs": [K("K02"), K("K00b")], "out": f"{ROOT}/gemini/CUP_g{{n}}.png",
       "prompt": ("Create one still photograph, vertical 9:16: a frame from a photoreal live-action comedy film, shot with a real high-speed camera. "
                  "EXTREME CLOSE-UP, macro, in the middle of a fall: the clear plastic iced americano cup of Image 2 - flat clear lid, kraft paper sleeve, "
                  "black straw - tumbles upside-down in mid-air, its lid popping loose, and the dark iced coffee pours out in one glossy frozen arc across "
                  "the frame with ice cubes and fine droplets suspended in the air, catching bright low sunlight. Behind it, completely out of focus: the "
                  "pale blue sky and bare winter branches of Image 1. At the upper-left edge, soft and out of focus, a man's charcoal-grey jacket sleeve "
                  "and open hand reaching for the cup. No face in the frame. Real high-speed photography: crisp droplets, shallow depth of field, light 35mm "
                  "film grain, natural colours, no CGI look, no motion graphics. Do not centre the cup: it sits slightly right of centre, the coffee arc "
                  "sweeping down to the lower left. No text, letters or logos.")}
json.dump([job], open(f"{ROOT}/jobs_gemini2.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok")
