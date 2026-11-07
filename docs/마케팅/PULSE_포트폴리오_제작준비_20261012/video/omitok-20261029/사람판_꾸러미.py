# 오미톡 15초 사람판 굽기 꾸러미(2026-11-07 밤, Claude) — 치익톡 2판 기각(유호님 「사람은 자연스럽고 연기도 좋은데 cg나 이런게 너무 진짜 쓰레기급」) 뒤
# 효과 컷 없이 사람 반응 · 실제 물리로 다시 짠 콘티(01_새판_기획 11절)의 새 컷 셋. 유호님이 콘티를 고르신 뒤에만 낸다.
#   python -X utf8 사람판_꾸러미.py   → git 밖 pulse-seedance-day-20261028/웹올리기_om2사람판_1107/(_순서.json · 판 폴더)
#   python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미> om2-s1 om2-s1 om2-s2 om2-s2 om2-s4 om2-s4 --받을곳 <받음> --계정 ultra [--실행]
# 방법은 만족 사례 장부 S44 「아니, 잠깐」 — GPT 구독 시작 그림(한결 대표 사진 + 손님 캔 사진) → 시댄스 2.5 첫 프레임 한 테이크, 소리 켬(판이 낸 목소리 · 숨).
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
OUT = os.path.join(DAY, "웹올리기_om2사람판_1107")
START = "C:/Users/q1212/Documents/synk-vendor/pulse-rehearsal-20261029/새판/사람판_1107"


def prompt_of(name):
    return open(os.path.join(HERE, "지시문", name), encoding="utf-8").read().replace("\r\n", "\n").strip() + "\n"


# (id, 꾸러미 폴더, 시작 그림, 지시문, 길이, 소리, 쓰는초, 컷, 자를 때 위를 지키나)
JOBS = [
    ("om2-s1", "001_om2-s1", "S1.png", prompt_of("사람판_S1_볼에캔_영상.txt"), 4, "켬", 2.0, ["2"], False),
    ("om2-s2", "002_om2-s2", "S2.png", prompt_of("사람판_S2_치익꿀꺽_영상.txt"), 8, "켬", 4.5, ["3"], False),
    ("om2-s4", "003_om2-s4", "S4.png", prompt_of("사람판_S4_건배톡_영상.txt"), 6, "켬", 5.0, ["5"], True),   # 887×1774로 옴 — 위의 골대 · 조명을 살리고 아래 셔츠를 자른다
    # 11-07 밤 opus 볼 이유 2점 「다섯 가지 맛을 말로만」 → 유호님 「다섯 맛 표정 굽기」: 이미 딴 캔(따는 순간의 물안개를 피함)으로 한 모금 → 「새콤…」 「달고…」
    #   「끝은… 알싸해.」 세 박 표정 → 감탄 미소(장부 S44 「아니, 잠깐」의 말 · 표정 방식)
    ("om2-s2b", "004_om2-s2b", "S2b.png", prompt_of("사람판_S2b_다섯맛_영상.txt"), 8, "켬", 5.5, ["3"], True),   # 887×1774 — 머리를 지키고 아래(무릎 위 손)를 자른다
]


def to_916(im, keep_top=False):
    """구독 경로는 9:16 대신 1:2(887×1774) 따위로 올 때가 있다 — 9:16로 잘라(가운데, 또는 위를 지키고 아래만) 1152×2048로 맞춘다."""
    w, h = im.size
    if abs(w / h - 9 / 16) > 0.004:
        if w / h < 9 / 16:
            th = round(w * 16 / 9)
            y = 0 if keep_top else (h - th) // 2
            im = im.crop((0, y, w, y + th))
        else:
            tw = round(h * 9 / 16)
            x = (w - tw) // 2
            im = im.crop((x, 0, x + tw, h))
    return im.resize((1152, 2048), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    boards = []
    for k, (pid, folder, start, prompt, sec, sound, use, cuts, keep_top) in enumerate(JOBS, 1):
        d = os.path.join(OUT, folder)
        os.makedirs(d, exist_ok=True)
        src = os.path.join(START, start)
        if not os.path.exists(src):
            raise SystemExit(f"{pid}: {src} 가 없다")
        to_916(Image.open(src).convert("RGB"), keep_top).save(os.path.join(d, "1_시작.jpg"), quality=93)
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(prompt)
        boards.append({"순서": k, "id": pid, "편": "om2", "컷": cuts, "폴더": folder, "길이": sec, "비율": "9:16", "소리": sound, "묶음": False, "대안": False,
                       "방식": None, "시험": False, "낱판": [], "쓰는초": [use], "파일": ["1_시작.jpg"], "빠진 파일": [],
                       "지시문 머리": prompt[:150], "지시문 글자 수": len(prompt)})
        print(f"{pid}: {sec}초 · 소리 {sound} · 지시문 {len(prompt)}자")
    json.dump(boards, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(OUT)


if __name__ == "__main__":
    main()
