# 한강2126 가편집 11판 — 다시 굽는 시작 그림(11-06 유호님 「걱정되는곳을 전부 보완해줘 · 필요한부분은 아예 다시 뽑아도」)
# 걱정: 2E · L3 · L6 · P8에서 그가 화면 한가운데 정면(로맨스 「앵글이 맹해」와 같은 짜임) → 비켜 선 구도 · 한쪽 빛 · 앞사람 흐림으로.
#       T4b는 그가 들어오기 전에 가방이 이미 코트걸이에 걸려 있음 → 걸이를 비운다(얼굴 없는 편집).
# 얼굴은 승인 세트(B · C + 실제 셋)로, 생김새 · 옷 · 세트는 지금 시작 그림으로. 후보정 없음.
import json, os
H = "C:/Users/q1212/Videos/한강2126_새판_20261009/재촬영_v40"
ROOT = f"{H}/시댄스/다시_1106"
FACE = "C:/Users/q1212/Documents/synk-vendor/korea-run-montage-20261021/참조_유호"
K = lambda k: f"{H}/시댄스/그림/{k}.jpg"
FACES = [f"{FACE}/1_B정면.jpg", f"{FACE}/2_C정면.jpg", f"{FACE}/3_실제_pro02.jpg", f"{FACE}/4_실제_V181.jpg", f"{FACE}/5_실제_V204.jpg"]

HEAD = ("Create one still photograph, vertical 9:16: a frame from a photoreal live-action deadpan-comedy brand film, shot on a 35mm cinema camera. "
        "HIS FACE: he is the exact same Korean man as in Images 1 and 2 — keep exactly that face in every detail. Images 3 to 5 are his real photos, "
        "for identity only (ignore their backgrounds and clothing). Show him at his best, as on a good shooting day: well-rested, clear skin, bright eyes "
        "with catchlights, a defined jawline. His skin is fair, bright and clear with a cool-neutral rosy undertone — never yellow, golden, olive, tan or "
        "sallow, and not grey or plastic; his face is the brightest, clearest thing in the frame. No moles, no marks, no stubble. "
        "HIS LOOK, exactly as in Image 6: about ten thin, tight cornrows braided straight back with short loose tails at the nape; thick black rectangular "
        "acetate glasses; a charcoal-grey cotton work jacket worn open over a plain white crew-neck tee; a black nylon backpack on both shoulders; "
        "a fist-sized dark charcoal-brown fluffy felt kitten with round green eyes hanging on a 10 cm silver ball chain from the top of his LEFT backpack "
        "strap, just below the collarbone; his dark iced americano in a clear plastic cup with a flat clear lid, a kraft paper sleeve and a black straw "
        "in his right hand. He is completely deadpan: a flat, calm, expressionless face, mouth closed, brows level. ")
TAIL = (" LIGHT: soft directional daylight from the tall windows falls across his face from one side, the other side in gentle shade, so his face "
        "has shape; his face stays bright and clear. Shallow depth of field, real 35mm film grain, faint halation, no retouching, no HDR, no teal. "
        "Keep the room's colours, felt materials and light from Image 6. Do not centre him: follow the frame numbers exactly. "
        "Add no text, letters, numbers or logos anywhere; felt 'synk' signs already in Image 6 may stay as they are.")

JOBS = [
    {"id": "2E", "refs": FACES + [K("K20"), K("K19")],
     "prompt": HEAD +
     "THE PLACE: the bright SHIFT office of Image 6 — long room, tall windows, blue felt desks. "
     "THE FRAME: over the shoulder of the red-haired woman of Image 7, who sits at her desk: her shoulder and long wavy red hair fill the lower-left "
     "corner of the frame, close to the lens and soft. The camera is at her seated eye level, so we look up at him a little (about 10 degrees), 50 mm. "
     "He stands beside her desk on the right: the centre of his face sits about 64% of the way across the frame and about 30% down from the top; "
     "his face and shoulders take about a third of the frame height. His body is turned three-quarters toward her (toward camera-left) and he looks "
     "down at her, about to answer. Behind him, small and out of focus at about 30% across and 55% down, the knee-high felt figure Marin from Image 6 "
     "(navy felt helmet, big round yellow eyes) stands on the blue felt reception counter. Window light comes from camera-left." + TAIL},
    {"id": "L3", "refs": FACES + [K("K28"), K("K29")],
     "prompt": HEAD +
     "THE PLACE: the coral-red LAB room of Image 6 — coral felt walls, rounded arches, tall windows, students sitting on coral benches. "
     "THE FRAME: a low angle from about chest height, 35 mm, from beside the teacher of Image 7 (a Korean woman in her forties, dark hair in a low bun, "
     "coral cardigan over a white tee): only her coral cardigan sleeve and both hands are in frame, in the lower-left foreground, holding out the big "
     "coral felt steering wheel of Image 6 toward him — the wheel large, close to the lens and slightly soft. He stands on the right: the centre of his "
     "face sits about 62% of the way across the frame and about 28% down; he looks down at the wheel, deadpan, coffee held near his chest. "
     "Behind him, soft: a coral arch and two seated students. Window light comes from camera-right." + TAIL},
    {"id": "L6", "refs": FACES + [K("K30"), K("K29")],
     "prompt": HEAD +
     "THE PLACE: the coral-red LAB room of Image 6. "
     "THE FRAME: over the teacher's shoulder, 85 mm: the back of the teacher's head (Image 7: dark hair in a low bun) and her coral cardigan shoulder fill "
     "the left third of the frame, close to the lens and completely out of focus. He is in a medium close-up on the right (head and the top of his "
     "shoulders): the centre of his face sits about 66% of the way across and about 36% down; his face is three-quarters turned toward her "
     "(toward camera-left), eyes on her, deadpan, mouth closed. Behind him, very soft: the coral wall and a tall window. Window light comes from camera-right." + TAIL},
    {"id": "P8", "refs": FACES + [K("K37"), K("K33")],
     "prompt": HEAD.replace("thick black rectangular acetate glasses;", "thick black rectangular acetate glasses, and a white VR headset pushed up onto his forehead above them;") +
     "THE PLACE: the sage-green PATH lounge of Image 6 — sage felt walls, tall windows, green armchairs. "
     "THE FRAME: a low-angle two-shot, 35 mm. The counsellor of Image 7 (a Korean man in his fifties, grey hair, thin glasses, a sage-green cardigan over "
     "a white shirt) stands in the left foreground, from the chest up, at about 28% across, sharp, smiling warmly and giving a thumbs-up toward the "
     "camera-right. He stands one step behind on the right: the centre of his face sits about 68% of the way across and about 30% down; the white VR "
     "headset sits pushed up on his forehead, and he stares straight ahead past the counsellor, completely deadpan. Window light from camera-right." + TAIL},
    {"id": "T4b", "refs": [K("K39")], "ratio": "9:16",
     "prompt": "Edit Image 1 and change only one thing: remove the black backpack and the felt kitten hanging from it on the coat rack by the door, so "
     "the rack's hooks are empty. Keep everything else exactly the same — the same framing, ceiling, felt pendant lamp and its glow, wall clock, felt "
     "panels, door, window, light and colours. Add no people, no text."},
]
out = []
for j in JOBS:
    out.append({"id": j["id"], "ratio": j.get("ratio", "9:16"), "refs": j["refs"], "prompt": j["prompt"], "out": f"{ROOT}/gemini/{j['id']}_g{{n}}.png"})
    assert all(os.path.exists(r) for r in j["refs"]), j["id"]
    print(j["id"], len(j["prompt"]))
json.dump(out, open(f"{ROOT}/jobs_gemini1.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
