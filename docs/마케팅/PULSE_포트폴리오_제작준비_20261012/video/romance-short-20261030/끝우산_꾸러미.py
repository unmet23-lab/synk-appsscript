# 로맨스 「다 비침」 30초 판 끝 장면 다시 내기(2026-11-08, Claude) — 유호님 「끝 장면만 새로」(30초 판 맹검: Fable · 그록 「이야기 안에서 투명 우산을
#   한 번도 펴지 않아 표어 「비 오는 날, 서로가 보이게」와 끝 그림이 안 만난다」). 둘이 투명 우산 하나 아래 마주 선 판을 시작 그림(Gemini, 4 Argon 사고 최고 —
#   git 밖 콘티/romance/끝우산_20261108/ · 유호님이 배역별 얼굴판으로 고른 판)에서 시댄스 2.5로 한 판 낸다.
#   python -X utf8 끝우산_꾸러미.py <고른 시작 그림.png>   → git 밖 pulse-seedance-day-20261028/웹올리기_로맨스_끝우산1108/
#   그 뒤: python -X utf8 ../../시댄스무제한/꾸러미점검.py 웹올리기_로맨스_끝우산1108
#          python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미 폴더> --계정 ultra --상한 120 [--실행]   (울트라 720p 초당 18 — 5초 90)
# 지시문 머리 · 옷 · LOOK · 소리 줄은 다시_1107_꾸러미.py와 같다. 사람에게 정지 낱말을 쓰지 않고(결정 11-07 「사람이 굳는다」) 몇 초에 · 어느 몸이 · 얼마나를 적는다.
import json
import os
import shutil
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from 다시_1107_꾸러미 import DAY, FIRST, LOOK, ONE, SILENT, STATIC, T_SHIRT, Y_CARDIGAN   # noqa: E402

OUT = os.path.join(DAY, "웹올리기_로맨스_끝우산1108")
ID = "rs-C34u"
ACTION = ("ACTION: Night, heavy rain, in front of the corner shop: Taejun holds the open clear umbrella over both of them. The rain drums on the clear canopy and streams "
          "off its rim in a ring of bright drops all around them, and the drops on the canopy shimmer pink and teal. 0–1 s: Yuna looks up into his eyes and a small, shy "
          "smile reaches her eyes; Taejun's gaze softens and he lets out a slow breath. 1–2.5 s: his free hand moves gently from her arm to her back and draws her half a "
          "step closer under the umbrella; she lifts her free hand and lightly takes hold of the front of his shirt. 2.5–4.5 s: he slowly lowers his face toward hers "
          "while she lifts her chin and rises a little onto her toes; their faces come within a finger's breadth and their eyes half-close — the shot ends just before "
          "the kiss, lips not yet touching. The umbrella stays in his hand above both heads the whole time — the clear handle in his grip, the thin silver shaft behind "
          "their faces — and dips only very slightly as he leans in. His skin stays milk-white and clean, hers fair and clear; both faces stay exactly the faces of the "
          "first frame.")


def main():
    if len(sys.argv) < 2 or not os.path.isfile(sys.argv[1]):
        raise SystemExit("쓰는 법: python -X utf8 끝우산_꾸러미.py <고른 시작 그림.png>")
    src = sys.argv[1]
    w, h = Image.open(src).size
    if abs(w / h - 16 / 9) > 0.02:
        raise SystemExit(f"시작 그림 비율이 16:9가 아니다: {w}×{h}")
    d = os.path.join(OUT, f"001_{ID}")
    os.makedirs(d, exist_ok=True)
    shutil.copyfile(src, os.path.join(d, "1_시작.png"))
    prompt = "\n".join([FIRST, ONE, T_SHIRT, Y_CARDIGAN, ACTION, STATIC, LOOK, SILENT])
    open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(prompt + "\n")
    order = [{"순서": 1, "id": ID, "편": "rs", "컷": ["C34"], "폴더": f"001_{ID}", "길이": 5, "비율": "16:9", "소리": "끔", "묶음": False, "대안": False,
              "방식": None, "시험": False, "낱판": [], "파일": ["1_시작.png"], "빠진 파일": [], "지시문 글자 수": len(prompt), "판 수": 1,
              "메모": f"30초 판 끝 장면 — 둘이 투명 우산 하나 아래(시작 그림 {os.path.basename(src)}, Gemini)"}]
    json.dump(order, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(d, f"{w}×{h}", len(prompt), "자")


if __name__ == "__main__":
    main()
