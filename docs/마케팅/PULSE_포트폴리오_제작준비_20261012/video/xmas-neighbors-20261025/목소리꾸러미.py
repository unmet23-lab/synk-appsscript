# 옆집의 크리스마스 대사 목소리 판(2026-11-07, Claude) — 다섯 줄(엄마 · 민재 둘 · 하린 · 내레이터)을 시댄스 2.5가 처음 낸 목소리로 받는다.
#   python -X utf8 목소리꾸러미.py   → git 밖 synk-vendor/pulse-seedance-day-20261028/웹올리기_옆집목소리_1107/(_순서.json · 판 폴더)
#   내기: python -X utf8 ../../시댄스무제한/드리미나내기.py <그 폴더> s1-목소리-엄마 s1-목소리-엄마 … --받을곳 <받음> --계정 ultra [--실행]
# 결정 10-29 · 11-01(사람 목소리는 시댄스가 처음 낸 목소리 — 어색할 때만 일레븐 v4, 타입캐스트 안 씀)대로. 말은 모두 입이 안 보이는 자리라(02_콘티 11절 「소리」)
# 판의 소리만 쓰고 화면은 쓰지 않는다. 한 배역 한 판 — 민재는 두 줄(1 「응, 들어왔어.」 · 31 「응, 엄마. 들어왔어.」)을 한 판에 넣어 목소리가 같게 한다.
# 전화 · 벽 너머 · 거리감은 후반 몫이라 판 소리는 깨끗하게 받는다. 말 빠르기는 현장노트 영상 「시댄스(드리미나)가 낸 대사가 초당 3~4자로 늘어지고」대로 끝나는 초 + PACE.
import json, os, re, shutil

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
OUT = f"{DAY}/웹올리기_옆집목소리_1107"
PIC = "C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors/시댄스"
LOOK_FROM = f"{DAY}/웹올리기/136_s1-34/지시문.txt"   # 이 편 판과 같은 LOOK 줄
HEAD = ("@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white balance, "
        "same people, faces, hair and clothes.\n"
        "ONE SINGLE CONTINUOUS SHOT of a quiet, tender Korean Christmas brand film, shot like a cinematic short film, horizontal 16:9 — no cuts, "
        "no camera switch, no slow motion, no speed ramp, no end card.")
CAM = "CAMERA: the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake."
CLEAN = ("— clean, close and clear, as if recorded in a quiet room (any phone, wall or distance effect is added later), over very quiet room tone — "
         "no music, no other voices, no sound effects.")

JOBS = [
    # (판, 그림, 길이, ACTION, PACE, SOUND)
    ("s1-목소리-엄마", "C01.jpg", 4,
     "Late-autumn night in the long outdoor corridor. The young man stands small in the dark doorway with his back to the camera, holding his phone to "
     "his ear; he stays still and silent the whole time. From about 0.3 s his mother on the phone — a warm, kind Korean woman in her mid-fifties, "
     "a little worried, the way a mother checks on her grown son late at night — asks in Korean, gently, the whole line finished by 1.9 s: "
     "\"아들, 집엔 들어갔어?\" He says nothing.",
     "her line is spoken at a natural everyday speed — about six or seven syllables per second, in one breath, no drawn-out words.",
     "SOUND: only her voice saying this one Korean line "),
    ("s1-목소리-민재", "C30.jpg", 6,
     "The young man of the first frame looks just past the camera, as if talking to his mother on the phone. From about 0.3 s he answers in Korean, "
     "small, tired and flat — a quick white lie, he is not home yet — the whole line finished by 1.1 s: \"응, 들어왔어.\" Then he is silent for about "
     "one and a half seconds, and from about 2.8 s he says in Korean, softly and warmly, with a small smile in his voice — this time it is true — "
     "the whole line finished by 4.0 s: \"응, 엄마. 들어왔어.\" His lips clearly form the Korean words. He never shouts or laughs.",
     "every Korean line is spoken at a natural, quiet conversational speed — about six syllables per second, each line in one breath, no drawn-out words.",
     "SOUND: only his own natural speaking voice saying these two Korean lines "),
    ("s1-목소리-하린", "C34.jpg", 4,
     "The young woman of the first frame keeps her small closed-lip smile for a moment, then from about 0.5 s says in Korean, very softly and warmly, "
     "almost to herself, a little shy — a quiet wish to the neighbor on the other side of the wall — the whole line finished by 1.8 s: "
     "\"메리 크리스마스, 옆집.\" Her lips clearly form the Korean words. She never laughs or raises her voice.",
     "the line is spoken at a soft, natural speed — about six syllables per second, in one breath.",
     "SOUND: only her own natural voice saying this one Korean line "),
    ("s1-목소리-내레이터", "C36.jpg", 4,
     "The snowy night street stays exactly as it is; snow keeps falling gently and nobody appears. From about 0.3 s a voice-over narrator — a calm, "
     "warm Korean woman in her thirties, unhurried and intimate, the voice that closes a tender brand film — says in Korean, the whole line finished "
     "by 2.5 s: \"옆집까지, 늘 켜 둡니다. 늘켬.\" Nobody on screen speaks; it is only the narrator's voice.",
     "the line is spoken calmly but not slowly — about five or six syllables per second, with only a tiny breath at each comma and full stop.",
     "SOUND: only the narrator's voice-over saying this one Korean line "),
]


def main():
    look = next(l for l in open(LOOK_FROM, encoding="utf-8").read().splitlines() if l.startswith("LOOK:"))
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    order = []
    for n, (pid, pic, sec, action, pace, sound) in enumerate(JOBS, 1):
        folder = f"{n:03d}_{pid}"
        os.makedirs(f"{OUT}/{folder}")
        shutil.copy(f"{PIC}/{pic}", f"{OUT}/{folder}/1_시작.jpg")
        lines = re.findall(r'"([^"]*[가-힣][^"]*)"', action)
        text = "\n".join([HEAD, f"ACTION: {action}", f"PACE: {pace}", CAM, look, sound + CLEAN])
        open(f"{OUT}/{folder}/지시문.txt", "w", encoding="utf-8").write(text)
        order.append({"순서": n, "id": pid, "편": "s1", "컷": [], "폴더": folder, "길이": sec, "비율": "16:9", "소리": "켬", "묶음": False, "대안": False,
                      "방식": "목소리 판", "낱판": [], "쓰는초": [], "파일": ["1_시작.jpg"], "빠진 파일": [], "판 수": 2,
                      "설명": f"{pid.split('-')[-1]} 목소리 — " + " · ".join(f"「{x}」" for x in lines) + "(소리만 씀)", "지시문 글자 수": len(text)})
        print(folder, sec, "초", len(text), "자", lines)
    json.dump(order, open(f"{OUT}/_순서.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
