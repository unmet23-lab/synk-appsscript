# 한강2126 가편집 12판 다시 뽑기 2차(11-06) — 느린 대사 여섯 판 + 커피 쏟아지는 초근접 한 판.
#   python -X utf8 꾸러미2.py   → synk-vendor/pulse-seedance-day-20261028/웹올리기_한강다시_1106c/
# 유호님 11-06 「대사마다 (예를들어 수고하셨어요. 4층은 저 계단이요) 여기서 너무 늘어져 … 붕 뜨는느낌이 너무 많아」,
# 「맨 처음 만들었던 커피쏟는것 그리고 누워서 내가 한숨쉬는것 이런게 빠져서 좀 몰입감이 떨어지는 느낌」.
# 잰 값(가편집 11판): 이 여섯 줄이 초당 3.2~4.5자(v34는 같은 줄을 절반 시간에 — 「수고하셨어요. 4층은 저 계단이요」 4.0초 → v34 2.0초).
# 그래서 대사를 「몇 초 안에 끝냄」으로 못 박고, 대사 뒤 움직임도 그만큼 당긴다. 시작 그림 · 목소리 견본은 그대로.
import json, os, re, shutil

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
OLD = f"{DAY}/웹올리기_한강"
OLD2 = f"{DAY}/웹올리기_한강다시_1106"
NEW = f"{DAY}/웹올리기_한강다시_1106c"
G = "C:/Users/q1212/Videos/한강2126_새판_20261009/재촬영_v40/시댄스/다시_1106/gemini"
PACE = ("every Korean line is spoken at a brisk, natural conversational speed - about seven syllables per second, in one breath, "
        "with no drawn-out words and no long pauses inside the line; the line is finished by the time written in ACTION.")

JOBS = {
    "hg-S2a-S2b": dict(src=f"{OLD}/023_hg-S2a-S2b", ACTION=(
        "Wide in the berry-walled PULSE studio: from about 0.2 s the director turns to him and, with a brisk wave of her hand toward the white "
        "cyclorama, says in Korean, fast and businesslike, the whole line finished by 1.7 s: \"모델분, 늦으셨네요. 이쪽이요.\" He says nothing. "
        "Right after her line, at about 1.8 s, he walks toward the cyclorama at the right with his iced americano, expressionless - he keeps the cup "
        "in the same hand as he walks; it never changes hands - and Mongle follows him across the floor with the boom microphone; the crew keeps working."),
        CAMERA="handheld multicam-style wide at chest height, small constant jitters; from about 1.8 s it pans right with him as he walks, drifting slightly closer (about 8%)."),
    "hg-G1": dict(src=f"{OLD}/025_hg-G1", ACTION=(
        "Over his shoulder (the back of his head and cornrows, out of focus at the right): from about 0.2 s the director points toward the berry-framed "
        "doorway to the stairwell at the back and says in Korean, quick and offhand, already turning back to her work, the whole line finished by 1.9 s: "
        "\"수고하셨어요. 4층은 저 계단이요.\" He stays still and says nothing.")),
    "hg-2A-2B": dict(src=f"{OLD}/004_hg-2A-2B", SHOT1=(
        "SHOT 1 (0–2.4 s) begins exactly on @이미지 1 — same framing, light and colors. ACTION: Over his shoulder (the back of his head with cornrows at "
        "the left, his iced americano at the bottom): behind the deep-blue felt reception counter the receptionist looks up at him and, from about 0.2 s, "
        "says in Korean, polite, quick and without interest, the whole line finished by 2.0 s: \"면접이시죠? 14분 늦으셨네요.\" He stays still and says "
        "nothing. CAMERA: over his shoulder, handheld, with only a breath-like sway in place, drifting in by about 4%."),
        SHOT2_FROM="2.4"),
    "hg-2D": dict(src=f"{OLD}/029_hg-2D", ACTION=(
        "At her own desk, the red-haired colleague leans out of her chair toward him, sniffs the air at the iced americano he holds up between them and, "
        "from about 0.2 s, asks in Korean, curious and friendly, quick, the whole line finished by 1.6 s: \"음, 커피 어디서 샀어요?\" At about 1.8 s he "
        "turns his head toward her - we see him from behind and the side, his face stays mostly turned away - and says nothing. They never touch."),
        CAMERA="handheld at desk height, small breath-like sway, drifting in by about 5% over 3 s."),
    "hg-2G": dict(src=f"{OLD}/032_hg-2G", ACTION=(
        "Over his shoulder: from about 0.2 s the receptionist points one finger up at the ceiling and says in Korean, politely and quickly, the whole line "
        "finished by 1.6 s: \"4층이에요. 계속 올라가세요.\" He gives one small nod (about 1.8 s), says nothing, and walks off out of the frame by about "
        "2.9 s; she goes back to her screen.")),
    "hg-P8": dict(src=f"{OLD2}/005_hg-P8", ACTION=(
        "Low-angle two-shot in the sage lounge: the counselor in the sage cardigan stands in the left foreground, smiling warmly with his thumb up, and "
        "from about 0.2 s says in Korean, pleased and brisk, the whole line finished by 1.8 s: \"좋아요. 진짜는 4층이에요.\" His lips clearly form the "
        "Korean words. Behind him on the right, the man with the white VR headset pushed up on his forehead stares straight ahead past him, completely "
        "deadpan, lips closed, and never reacts.")),
}


def swap(text, key, value):
    pat = re.compile(rf"^{key}:.*$", re.M)
    if pat.search(text):
        return pat.sub(lambda m: f"{key}: {value}", text, count=1)
    return text.replace("\nLOOK:", f"\n{key}: {value}\nLOOK:", 1)


def main():
    os.makedirs(NEW, exist_ok=True)
    order = {b["id"]: b for b in json.load(open(f"{OLD}/_순서.json", encoding="utf-8"))}
    order.update({b["id"]: b for b in json.load(open(f"{OLD2}/_순서.json", encoding="utf-8"))})
    out = []
    for n, (pid, j) in enumerate(JOBS.items(), 1):
        b = dict(order[pid])
        folder = f"{n:03d}_{pid}"
        d = f"{NEW}/{folder}"
        os.makedirs(d, exist_ok=True)
        files = [f for f in os.listdir(j["src"]) if f != "지시문.txt"]
        for f in files:
            shutil.copy(f"{j['src']}/{f}", f"{d}/{f}")
        t = open(f"{j['src']}/지시문.txt", encoding="utf-8").read()
        if "SHOT1" in j:      # 두 샷 판: 샷 1 줄을 통째로, 샷 2 시작 초를 당김
            t = re.sub(r"^SHOT 1 \(.*$", j["SHOT1"].replace("\\", "\\\\"), t, count=1, flags=re.M)
            t = re.sub(r"SHOT 2 \(3\.2 s to the end\)", f"SHOT 2 ({j['SHOT2_FROM']} s to the end)", t)
            t = re.sub(r"hard cut[s]? at 3\.2 s", f"hard cut at {j['SHOT2_FROM']} s", t)
        for key in ("ACTION", "CAMERA"):
            if key in j:
                t = swap(t, key, j[key])
        t = swap(t, "PACE", PACE)
        open(f"{d}/지시문.txt", "w", encoding="utf-8").write(t)
        b.update({"순서": n, "폴더": folder, "파일": sorted(files), "빠진 파일": [], "지시문 글자 수": len(t)})
        out.append(b)
        print(pid, folder, sorted(files), len(t))
    json.dump(out, open(f"{NEW}/_순서.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
