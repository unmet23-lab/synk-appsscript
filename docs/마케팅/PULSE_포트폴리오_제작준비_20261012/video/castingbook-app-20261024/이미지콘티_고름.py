# 8번 이미지 콘티 — 컷마다 고른 판을 정지컷/<컷>.png로 옮긴다(2026-10-26). 합성(이미지콘티_합성.py) · 글자 · 보드 · 가편집은 정지컷을 먼저 쓴다.
#   python -X utf8 이미지콘티_고름.py            → 아래 PICKS대로 정지컷/C??.png · 정지컷/_고름.json
#   PICKS: 컷 → (받은 판 이름 앞부분, 180° 돌릴지, 고른 까닭). 받은 판은 받음/<앞부분>_*.jpg 가운데 가장 최근 것.
#   위에서 굽고 돌리는 길(C01r · C04r)과 카메라를 거꾸로 든 길(C01u)은 돌려서 옮긴다. 옮기기만 하고 색 · 자리는 손대지 않는다(10-24 결정).
import glob, json, os, sys
from pathlib import Path
from PIL import Image

P8 = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8")

PICKS = {
    # 컷: (받은 판, 돌림, 까닭)
    "C01": ("C01e", True, "위에서 내려다본 바로 선 얼굴로 굽고 180° 돌림 — 닮음 0.46(C01 0.309 · C01c 0.261 · C01d 0.327 · C01u 실패), 거꾸로 얼굴이 아래 가운데 · 손과 폰이 턱 바로 위(원본 1번 자리). 뒤는 4번과 같은 흐린 회청 바닥 — 원본 1번 뒤도 알아볼 수 없게 흐리고, 카페는 1.4초 뒤 2번 와이드가 보여 준다"),
    "C02": ("C02b", False, "다시 판도 소연을 카운터 앞 손님 자리에 앉혔다(두 번 다) — 7 · 9 · 14 · 16번 배경도 모두 카운터 앞 자리라 콘티 글을 「카운터 앞 자리」로 맞추고(Fable 2차 P2 7의 대안), 참조 명판을 지운 뒤라 머신에 상표꼴 글자가 없는 C02b를 쓴다"),
    "C03": ("C03c", False, "폰 크기를 가장자리(위아래 손가락 한 마디 틈)로 적어 화면 높이 79%(C03b 73~76%, 원본 9할 남짓 — Fable 3차 P2 3), 배경은 더 흐려졌지만 탁자 · 창이 아직 어렴풋이 보인다"),
    "C04": ("C04s", True, "위에서 내려다본 바로 선 얼굴로 굽고 180° 돌림 — 닮음 0.47. C04r(0.498)보다 얼굴이 원본 자리에 가깝다(돌린 판 턱 18% → 25%, 원본 약 27% — Fable 3차 P2 2), 위 가장자리에 팔뚝 · 폰이 걸려 원본(손 · 소매 · 폰)과 같은 짜임. 폰은 위 가장자리에서 잘리고 눈동자는 폰 쪽, 뒤는 흐린 회청 바닥"),
    "C07": ("C07b", False, "몸은 거의 프레임 아래, 손 · 폰 · 젖힌 턱만 — 원본 첫 프레임에 가깝고 머신 글자가 없다(첫 판 C07은 어깨 · 얼굴까지 · 상표꼴 글자). 끝 그림은 C07e(바로 앉아 놀람, 닮음 0.489) — 영상 단계에서 첫 · 끝 그림으로, 두 판의 카메라 거리가 조금 달라 끝 그림은 첫 그림을 편집해 맞출 수 있다"),
    "C10": ("C10b", False, "위아래 끝이 프레임 밖인 극접사 · 왼쪽 테두리만 대각선 · 엄지가 오른쪽 아래 — 원본 10번 구도(첫 판 C10은 폰 전체가 보였다)"),
    "C15": ("C15b", False, "폰 크기를 숫자로 적어 화면 높이 40% → 81% · 폭 10% → 33%(원본은 위아래를 다 채움) — 어깨 너머 · 왼손 검지가 화면으로"),
    "C14": ("C14b", False, "입이 살짝 벌어지고 머리 위가 잘린 틀 — 원본 첫 프레임에 첫 판(C14, 입 다묾 · 넓은 틀)보다 가깝다. 닮음 0.481"),
    "C16": ("C16b", False, "머리 위가 잘리고 얼굴이 화면을 채움 · 둘레가 어둡고 얼굴은 아래에서 오는 폰 빛 쪽(Fable 2차 P2 11) — 닮음 0.416(첫 판 C16 0.453은 얼굴이 고르게 밝고 머리 위가 보였다)"),
    "C17": ("C17b", False, "폰 아래 왼쪽 귀퉁이 극접사 · 화면이 프레임 위쪽 대부분(첫 판 C17은 폰이 위쪽 띠로만, 아래가 손 · 팔) — 원본보다 화면이 조금 작지만(초록 46%) 1.4배 다가감으로 채워진다"),
    "C18": ("C18b", False, "손만 화면 가득한 클로즈업 — 원본 18번 크기(첫 판 C18은 상반신까지 보이는 미디엄)"),
    "C20": ("C20b", False, "천장 모서리 높은 앵글 · 카운터 뒤 소연 — 첫 판(C20)은 눈높이에 가깝고 소연이 손님 탁자 옆이었다"),
}


def latest(prefix):
    g = sorted(glob.glob(str(P8 / "받음" / f"{prefix}_*.jpg")), key=os.path.getmtime)
    return Path(g[-1]) if g else None


def main():
    out = P8 / "정지컷"; out.mkdir(exist_ok=True)
    log_p = out / "_고름.json"
    log = json.load(open(log_p, encoding="utf-8")) if log_p.exists() else {}
    for cut, (prefix, rot, why) in PICKS.items():
        src = latest(prefix)
        if not src:
            print(cut, "받은 판 없음", prefix); continue
        im = Image.open(src).convert("RGB")
        if rot:
            im = im.rotate(180)
        im.save(out / f"{cut}.png")
        log[cut] = {"판": src.name, "돌림": rot, "까닭": why}
        print(cut, "←", src.name, "(180° 돌림)" if rot else "")
    json.dump(log, open(log_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
