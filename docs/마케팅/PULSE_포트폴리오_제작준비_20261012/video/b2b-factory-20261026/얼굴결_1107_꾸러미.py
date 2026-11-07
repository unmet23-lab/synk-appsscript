# 10번 도담중공업 — 준호 얼굴 넷(18 · 31 · 34 · 36) 다시 뽑기 꾸러미(2026-11-07 밤, Claude · 유호님 「네, 다시 뽑아」)
#   python -X utf8 얼굴결_1107_꾸러미.py   → git 밖 pulse-seedance-day-20261028/웹올리기_p10얼굴결_1107/(_순서.json · 판 폴더)
#   python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미> p10-18t p10-31t p10-34t p10-36t --받을곳 <받음> --계정 ultra [--실행]
# 까닭: 엔진을 알리지 않은 Fable 완성본 맹검에서 이 넷이 「소프트 · 왁스 비디오」(모공 없음 · 고주파 잔차 낮음)로 1 · 25 · 27의 필름 결 얼굴과 갈렸다.
#   넷 다 얼굴이 작게 잡힌 중간 크기 컷에 밝고 평평한 빛이라 시작 그림부터 매끈했고(얼굴 둘레 고주파 3.0 안팎), 시댄스가 한 번 더 뭉갰다(판 2.3 안팎).
# 고침: 이 편의 얼굴 엔진(Gemini 나노바나나 2.1, p10/ego 11 · 12차 — 실행기는 11-07 재설치 뒤 Profile 2 공간 `pulse-p10-conti-p2`)으로 고른 판 하나만 Image 1로 「빛만 바꿔라」 — 한쪽 빛 · 모공 · 잔주름 · 필름 입자, 구도 · 얼굴 · 옷 그대로
#   — 11차(반 스톱 어둡게)는 얼굴결이 그대로라(고주파 3.21 → 3.23) 12차로 빛을 분명하게: 한 스톱 어둡고 따뜻하게 · 한쪽 키 라이트 · 날아간 곳 0 · 들린 검정
#   (git 밖 `콘티/p10/고름/S18u · S31u · S34u · S36u.jpg`, 원래 얼굴과 SFace 0.921~0.964). 영상 지시문은 원래 판의 것 그대로에 LOOK 끝 한 줄(첫 장의 피부결을 끝까지)만 더한다.
import json
import os
import shutil

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
SRC = os.path.join(DAY, "웹올리기_여섯편")
OUT = os.path.join(DAY, "웹올리기_p10얼굴결_1107")
PICK = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p10/고름"
SKIN = (" His skin keeps the real texture of the first frame to the very end — visible pores, fine lines at the eyes and the few small freckles — "
        "never smoothed, waxy or plastic.")

JOBS = [  # (id, 꾸러미 폴더, 원래 판 폴더, 시작 그림, 쓰는초, 컷)
    ("p10-18t", "001_p10-18t", "097_p10-18", "S18u.jpg", 1.0, ["18"]),
    ("p10-31t", "002_p10-31t", "109_p10-31", "S31u.jpg", 1.0, ["31"]),
    ("p10-34t", "003_p10-34t", "112_p10-34", "S34u.jpg", 1.42, ["34"]),
    ("p10-36t", "004_p10-36t", "114_p10-36", "S36u.jpg", 1.25, ["36"]),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    boards = []
    for k, (pid, folder, src, img, use, cuts) in enumerate(JOBS, 1):
        prompt = open(os.path.join(SRC, src, "지시문.txt"), encoding="utf-8").read()
        lines = prompt.splitlines()
        i = [n for n, l in enumerate(lines) if l.startswith("LOOK:")]
        assert len(i) == 1, pid
        lines[i[0]] = lines[i[0]].rstrip() + SKIN
        prompt = "\n".join(lines) + "\n"
        d = os.path.join(OUT, folder)
        os.makedirs(d, exist_ok=True)
        s = os.path.join(PICK, img)
        if not os.path.exists(s):
            raise SystemExit(f"{pid}: {s} 가 없다")
        shutil.copyfile(s, os.path.join(d, "1_시작.jpg"))
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(prompt)
        boards.append({"순서": k, "id": pid, "편": "p10", "컷": cuts, "폴더": folder, "길이": 4, "비율": "16:9", "소리": "끔", "묶음": False, "대안": False,
                       "방식": None, "시험": False, "낱판": [], "쓰는초": [use], "파일": ["1_시작.jpg"], "빠진 파일": [],
                       "지시문 머리": prompt[:150], "지시문 글자 수": len(prompt)})
        print(f"{pid}: 4초 · 지시문 {len(prompt)}자")
    json.dump(boards, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(OUT)


if __name__ == "__main__":
    main()
