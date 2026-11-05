# 한강2126 가편집 11판 다시 뽑기 꾸러미(11-06) — 드리미나내기.py가 읽는 꼴(_순서.json + 판 폴더)로 만든다.
#   python -X utf8 꾸러미.py   → synk-vendor/pulse-seedance-day-20261028/웹올리기_한강다시_1106/
# T4b 시작 그림: Gemini가 가방 지우기를 거절해(11-06 「도와주도록 설계되지 않았습니다」) K39를 가방이 빠지게 위 왼쪽 80%로 잘라 키웠다.
# 판 id를 주면(예: hg-T4b) 그 판만 웹올리기_한강다시_1106b/에 만든다.
# 옛 판 지시문을 그대로 두고 바뀐 곳(ACTION · CAMERA · HIM · KKAMONG 줄)만 갈아 끼운다. 판 이름은 옛 판과 같게(hg-2E 등) — 받을곳에 __2로 쌓인다.
import json, os, re, shutil
from PIL import Image

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
OLD = f"{DAY}/웹올리기_한강"
NEW = f"{DAY}/웹올리기_한강다시_1106"
G = "C:/Users/q1212/Videos/한강2126_새판_20261009/재촬영_v40/시댄스/다시_1106/gemini"

HIM_FULL = ("HIM: the same man as in the first frame, exactly as he looks there - an East Asian man in his early thirties with broad shoulders on a lean, "
            "fit frame (flat stomach, visible waist taper, narrow hips, long slim legs); about ten thin, tight cornrows braided straight back with short "
            "loose tails at the nape, never tied; a charcoal-grey cotton work jacket worn open over a plain white crew-neck tee, slim black trousers, white "
            "leather low-top sneakers and a black nylon backpack on both shoulders.")
KK = ("KKAMONG: a fist-sized dark charcoal-brown fluffy felt kitten with two small pointed ears and two round green eyes, hanging on a 10 cm silver ball "
      "chain clipped to the top of his LEFT backpack shoulder strap just below the collarbone - exactly one, never anywhere else.")

JOBS = {
    "hg-O2-O3": dict(old="012_hg-O2-O3", start=None, ACTION=(
        "Side two-shot at shoulder height, the river and the black railing behind them: in the first frame they are already within one step of each "
        "other, both looking down - he at the iced americano in his right hand, the shark at the phone in its fin - and neither ever looks up. At about "
        "0.4 s they collide head-on, shoulder to shoulder, right in the middle of the frame - a hard, heavy hit at full walking speed: the shark's big "
        "padded head and shoulder slam into him and knock his whole upper body back and sideways, his feet slip on the stone, the iced americano jumps up "
        "out of his hand into the air, and he lets out one short, choked grunt: \"읍!\" The shark stumbles a step too, still staring at its phone. "
        "By the end of the shot he is tipping over backwards, off balance, arms flung out. Real speed - no slow motion.")),
    "hg-2E": dict(old="030_hg-2E", start="2E_g1.png", ACTION=(
        "Over the red-haired woman's shoulder - her long wavy red hair soft and close to the lens in the lower-left corner: he stands beside her desk on "
        "the right, completely expressionless, looking down at her; after a short pause (at about 0.6 s) he says the Korean words, flat and "
        "expressionless, his lips moving clearly but only a little: \"…모악산 배네치아요.\" Then he holds still and keeps looking at her. "
        "The red-haired woman never turns to the camera."),
        CAMERA="50 mm from her seated eye level, looking up at him a little, handheld with only a breath-like sway, drifting in by about 3%; no rack focus."),
    "hg-L3": dict(old="039_hg-L3", start="L3_g1.png", ACTION=(
        "Low angle in the coral LAB: in the lower-left foreground the teacher's hands, in coral cardigan sleeves, hold the big coral felt steering wheel out "
        "to him and give it a little push toward him; at about 0.8 s he takes the rim with his free left hand, completely deadpan, looking down at the "
        "wheel - his right hand keeps holding the iced americano; the teacher's hands let go and slide out of the bottom-left of the frame by about 1.6 s. "
        "Only the teacher's hands and sleeves are ever in frame - never her face."),
        CAMERA="35 mm low angle, handheld with only a breath-like sway, drifting in by about 4%."),
    "hg-L6": dict(old="042_hg-L6", start="L6_g1.png", ACTION=(
        "Over the teacher's shoulder - the back of her dark hair bun and her coral cardigan shoulder soft and close to the lens at the left: he stands still "
        "on the right, three-quarters turned toward her, expressionless, eyes on her; at about 0.4 s he says one flat Korean word, his lips barely moving: "
        "\"네.\" Then he stays still. The teacher stays still with her back to the camera."),
        CAMERA="85 mm, handheld, with only a breath-like sway in place; it stays where it is."),
    "hg-P8": dict(old="051_hg-P8", start="P8_g1.png", voice=f"{OLD}/066_hg-말-상담사/3_목소리견본.mp3", ACTION=(
        "Low-angle two-shot in the sage lounge: the counselor in the sage cardigan stands in the left foreground, smiling warmly with his thumb up, and says "
        "in Korean, pleased: \"좋아요. 진짜는 4층이에요.\" His lips clearly form the Korean words. Behind him on the right, the man with the white VR headset "
        "pushed up on his forehead stares straight ahead past him, completely deadpan, lips closed, and never reacts."),
        CAMERA="35 mm low angle, handheld with only a breath-like sway, drifting in by about 3%.",
        SOUND="only the counselor's voice saying the Korean line written above, over quiet room tone - no music, no narration, no other voices.",
        VOICE=("@오디오 1 is a sample of the counselor's own voice from earlier takes - copy its timbre, age, pitch, pace and Korean accent exactly, but never "
               "play the sample itself; perform only the Korean words written above, once, live in this shot, in sync with the counselor's lips.")),
    "hg-T4b": dict(old="053_hg-T4b", start="T4b_g1.png", HIM=HIM_FULL, KKAMONG=KK, ACTION=(
        "The fourth-floor interview room: under the glowing round felt pendant lamp, the chrome coat rack by the door stands empty; the wooden door opens at "
        "about 1.0 s and he steps in wearing his black backpack on both shoulders, fully inside the room by about 2.0 s, his iced americano in his right "
        "hand - he is the only person who enters. He wears exactly the clothes written in HIM: charcoal-grey open jacket, white tee, slim black trousers, "
        "white low-top sneakers.")),
}


def swap(text, key, value):
    pat = re.compile(rf"^{key}:.*$", re.M)
    if pat.search(text):
        return pat.sub(lambda m: f"{key}: {value}".replace(f"{key}: {key}: ", f"{key}: "), text, count=1)
    return text.replace("\nLOOK:", f"\n{key}: {value}\nLOOK:", 1)


def main():
    import sys
    global NEW
    only = [a for a in sys.argv[1:] if a.startswith("hg-")]
    if only:
        NEW = NEW + "b"
    os.makedirs(NEW, exist_ok=True)
    order = {b["id"]: b for b in json.load(open(f"{OLD}/_순서.json", encoding="utf-8"))}
    out = []
    for n, (pid, j) in enumerate(JOBS.items(), 1):
        if only and pid not in only:
            continue
        if j["start"] and not os.path.exists(f"{G}/{j['start']}"):
            print("그림 아직 없음 — 건너뜀", pid)
            continue
        b = dict(order[pid])
        folder = f"{n:03d}_{pid}"
        d = f"{NEW}/{folder}"
        os.makedirs(d, exist_ok=True)
        if j["start"]:
            Image.open(f"{G}/{j['start']}").convert("RGB").save(f"{d}/1_시작.jpg", quality=95)
        else:
            shutil.copy(f"{OLD}/{j['old']}/1_시작.jpg", f"{d}/1_시작.jpg")
        files = ["1_시작.jpg"]
        snd = j.get("voice") or (f"{OLD}/{j['old']}/3_목소리견본.mp3" if os.path.exists(f"{OLD}/{j['old']}/3_목소리견본.mp3") else None)
        if snd:
            shutil.copy(snd, f"{d}/3_목소리견본.mp3")
            files.append("3_목소리견본.mp3")
        t = open(f"{OLD}/{j['old']}/지시문.txt", encoding="utf-8").read()
        for key in ("HIM", "KKAMONG", "ACTION", "CAMERA", "SOUND", "VOICE"):
            if key in j:
                t = swap(t, key, j[key])
        if j.get("voice") and "@오디오 1" not in t:
            t = t.rstrip() + "\nVOICE: " + j["VOICE"] + "\n"
        open(f"{d}/지시문.txt", "w", encoding="utf-8").write(t)
        b.update({"순서": n, "폴더": folder, "파일": files, "빠진 파일": [], "지시문 글자 수": len(t), "소리": "켬" if snd else "끔"})
        out.append(b)
        print(pid, folder, files, len(t))
    json.dump(out, open(f"{NEW}/_순서.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
