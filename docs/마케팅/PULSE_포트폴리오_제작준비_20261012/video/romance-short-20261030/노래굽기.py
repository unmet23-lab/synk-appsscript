# 로맨스 「다 비침」 노래(2026-11-07, Claude) — 한 곡을 남자 · 여자 목소리로(02_콘티 5절 「노래 한 곡을 세 목소리로」 남 → 여 → 남).
#   python -X utf8 노래굽기.py 남자 [--씨앗 N]          → git 밖 최종/rs/소리/노래/남자_<씨앗>_<k>.flac(두 벌) · _<씨앗>.json(가사 시각 · 설정)
#   python -X utf8 노래굽기.py 여자 <남자 판.flac>       → 같은 곡을 여자 목소리 · 여자 가사로 다시 부른 판(cover — 원곡의 짜임 · 가락을 지킴)
# 길: 허깅페이스 PRO ZeroGPU의 공식 ACE-Step/Ace-Step-v1.5 Space(모델 MIT — 상업 사용 가능, 11-07 모델 카드 확인)를 tools/허깅페이스.py의 지키며_부르기로만 부른다
#   (한도를 넘기기 전에 멈춤 · 돈 안 나감). 일레븐 음악 · Suno는 11-07 ego 로그인이 풀려 못 쓰고, 옆집 · 6번이 쓴 stable-audio-3는 연주곡만 낸다 —
#   이 편은 노래가 거울 짝(같은 노래를 남 → 여 → 남)이라 한국어로 부르는 모델이 필요했다.
# 노랫말(메모 song-lyrics-concept-hook-not-slop): 한 낱말 훅 「투명해」 + 이 편에만 있는 일 — 다시 연 엘리베이터 문, 「아직은」, 손목 위 하트, 기운 우산,
#   젖은 왼쪽 어깨, 빨개진 귀 / 검은 우산, 피한 손, 처음 그 얼굴. 노을 · 바람 · 함께 · 꿈 · 빛 같은 감성 낱말과 「비침」 말놀이(제목 · 끝 카드 몫)는 쓰지 않는다.
import json
import os
import sys

REPO = "C:/Users/q1212/Documents/SYNK-appsscript"
sys.path.insert(0, os.path.join(REPO, "tools"))
from 허깅페이스 import 지키며_부르기  # noqa: E402

SPACE = "ACE-Step/Ace-Step-v1.5"
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/rs/소리/노래"
NEG = "trot, ppongjjak, cheesy, children's song, EDM, dance beat, autotune, rap, shouting, belting, choir, church organ"

STYLE = ("A tender Korean drama OST ballad for a romance web-drama advert. {voice}, close-miked and intimate, breathy and warm, never belting. "
         "Felt piano and soft nylon-string guitar, warm cello and soft strings that swell only in the chorus, light brushed drums from the second verse. "
         "74 BPM, D major, 4/4. Cinematic, restrained, rainy-night mood, clean modern Korean ballad production, like a real Korean drama OST.")
MALE = STYLE.format(voice="A soft young Korean male vocal (light, airy tenor)")
FEMALE = STYLE.format(voice="A soft young Korean female vocal (gentle, clear, airy)")

LYRICS_M = """[Intro]

[Verse 1]
닫히던 문을 다시 열었어
아직은, 그 말만 해 놓고
네가 앞을 지나갈 때면
눈이 먼저 너를 따라가

[Pre-Chorus]
아니라고 손을 저어도
손목 위에 뜬 작은 하트

[Chorus]
투명해
감춘다고 감췄는데
네 쪽으로 기운 우산 끝에
젖어 버린 내 왼쪽 어깨에
다 보였나 봐
투명해

[Verse 2]
거기, 투명한 거
괜히 한마디 건네 놓고
빨개진 귀 끝을 만지다
네 웃음에 또 들켜

[Chorus]
투명해
감춘다고 감췄는데
네 쪽으로 기운 우산 끝에
젖어 버린 내 왼쪽 어깨에
다 보였나 봐
투명해

[Outro]
투명해
"""

LYRICS_F = """[Intro]

[Verse 1]
검은 우산을 펴고 걸었어
아무렇지 않은 얼굴로
손잡이 위에 놓인 네 손
모른 척 피해 버렸지

[Pre-Chorus]
아니라고 고개 저어도
넌 처음 그 얼굴 그대로

[Chorus]
투명해
감춘다고 감췄는데
내 손에 쥐여 준 우산 끝에
젖어 있는 네 왼쪽 어깨에
다 보였나 봐
투명해

[Verse 2]
이런 거 챙기지 마
괜히 한마디 던져 놓고
빨개진 눈 끝을 감추다
네 얼굴에 또 들켜

[Chorus]
투명해
감춘다고 감췄는데
내 손에 쥐여 준 우산 끝에
젖어 있는 네 왼쪽 어깨에
다 보였나 봐
투명해

[Outro]
투명해
"""


def args(caption, lyrics, seed, seconds, mode="text2music", source=None, cover_strength=1.0, batch=1, think=False):
    # 11-07 첫 시도(160초 · 두 벌 · 생각하기 켬)는 ZeroGPU 236초를 쓰고 「GPU task aborted」 — 생각하기(5Hz LM이 소리 코드를 짬)가 오래 걸린다.
    #   기본은 한 벌 · 생각하기 끔으로 소리 결부터 보고, 필요할 때만 켠다
    gen = "custom" if mode == "text2music" else "cover"
    a = [
        "acestep-v15-xl-turbo",   # 0 모델
        gen,                      # 1 생성 방식
        None,                     # 2 간단 설명
        "unknown",                # 3
        caption,                  # 4 지시문(설명)
        lyrics,                   # 5 노랫말
        74,                       # 6 BPM
        "D major",                # 7 조
        "4",                      # 8 박자
        "ko",                     # 9 노래 말
        8,                        # 10 DiT 단계
        7.0,                      # 11 안내 세기
        False,                    # 12 씨앗을 무작위로
        str(seed),                # 13 씨앗
        None,                     # 14 참고 소리
        seconds,                  # 15 길이(초)
        batch,                    # 16 한 번에 몇 벌
        {"$파일": source} if source else None,   # 17 원곡(cover)
        None,                     # 18 소리 코드
        0.0,                      # 19 시작
        -1,                       # 20 끝
        "Fill the audio semantic mask based on the given conditions:",   # 21
        cover_strength,           # 22 원곡을 따르는 세기(cover)
        mode,                     # 23 일 종류
        False, 0.0, 1.0,          # 24 · 25 · 26
        3.0,                      # 27 shift
        "ode",                    # 28
        "",                       # 29
        "flac",                   # 30 소리 꼴
        0.85,                     # 31 LM 온도
        think,                    # 32 생각하기
        2.0,                      # 33 LM CFG
        0, 0.9,                   # 34 · 35 top-k · top-p
        NEG,                      # 36 LM에서 빼는 것
        True, True, True,         # 37 · 38 · 39
        False, True,              # 40 · 41
        False,                    # 42 점수
        True,                     # 43 가사 시각(LRC)
        0.5, 8,                   # 44 · 45
        None, [],                 # 46 · 47
        False,                    # 48
    ]
    return a


def main():
    a = sys.argv[1:]
    who = a[0]
    seed = int(a[a.index("--씨앗") + 1]) if "--씨앗" in a else 2711
    sec = float(a[a.index("--길이") + 1]) if "--길이" in a else 160
    think = "--생각" in a
    os.makedirs(OUT, exist_ok=True)
    if who == "남자":
        cap, lyr, mode, src = MALE, LYRICS_M, "text2music", None
    elif who == "여자":
        cap, lyr, mode, src = FEMALE, LYRICS_F, "cover", a[1]
    else:
        raise SystemExit("남자 | 여자 <원곡>")
    send = bool(src)   # 원곡을 보낸다 — 우리가 만든 노래(얼굴 · 고객 자료 아님)
    out = 지키며_부르기(SPACE, 인자=args(cap, lyr, seed, sec, mode, src, think=think), api="/generation_wrapper", 예상초=240, 받을곳=os.path.join(OUT, f"_받음_{who}_{seed}"),
                    남에게보내도됨=send, 메모=f"로맨스 노래 {who} {seed}")
    res = out["결과"]
    files = [r for r in res[:8] if isinstance(r, str) and os.path.exists(r)]
    saved = []
    for k, f in enumerate(files, 1):
        dst = os.path.join(OUT, f"{who}_{seed}_{k}{os.path.splitext(f)[1]}")
        os.replace(f, dst)
        saved.append(dst)
    meta = {"누구": who, "씨앗": seed, "설명": cap, "노랫말": lyr, "방식": mode, "원곡": src, "파일": saved,
            "상태": res[10] if len(res) > 10 else None, "자세히": res[9] if len(res) > 9 else None,
            "가사시각": [res[28 + i] if len(res) > 28 + i else None for i in range(len(saved))],
            "쓴초": out.get("쓴초"), "남은초": out.get("남은초")}
    json.dump(meta, open(os.path.join(OUT, f"_{who}_{seed}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(saved, out.get("쓴초"), out.get("남은초"))


if __name__ == "__main__":
    main()
