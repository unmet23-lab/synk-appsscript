# 10번 도담중공업 터빈을 발전용으로 다시 뽑는 꾸러미(2026-11-07, Claude) — 드리미나 울트라로 낸다(시댄스무제한/드리미나내기.py).
#   python -X utf8 발전_1107_꾸러미.py [id…]   → git 밖 pulse-seedance-day-20261028/웹올리기_p10발전_1107/(_순서.json · 판 폴더)
#   python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미> p10-16e … --받을곳 <받음> --계정 ultra [--실행]
# 유호님 11-07 「발전용으로 다시」: 완성본의 터빈이 큰 팬 날개 · 스피너 콘을 단 터보팬이라 항공 엔진으로 읽혔다(Fable 1 · 2차도 같은 지적).
# 1판(R1발전: 크롬 나팔 · 버팀대 넷 · 축 토막 · 얇은 날개 한 평면)은 유호님이 모음을 보시고 「그림부터 고쳐」 → Fable 심사(환풍기 · 스피커 · 제트 흡입구로 읽힘,
#   어두운 컷의 얼굴이 2~3배 밝아져 초점이 사라짐, 크롬 · 한쪽에만 붙은 연소기 · 뚱뚱한 비율 · 대포 같은 배기)로 기준부터 다시 짰다.
# 기준 3판(GPT 이미지 2.5, 굽기_gpt.cjs 발전 — 고름/R3a · R3b · R3c):
#   R3a 앞 열린 판: 크림 무광 주강 흡입 케이싱 · 어둡고 깊은 고리 목 · 굵은 버팀대 여섯이 가운데 큰 베어링 하우징으로(축 없음) · 연소기 열여섯 360° ·
#        관측창 · 연료 고리관 · 가로 분할 플랜지 너트 줄 · 회색 트러니언 · 회색 스키드 · 크림 원뿔 배기, 크롬 없음.
#   R3b 운송 덮개판: R3a의 흡입구를 회색 볼트 덮개로 막음(19 · 21 · 22 · 23 — 운송 · 시험장 도착 컷).
#   R3c 배기 쪽 판: 고리 배기 통로 · 가운데 허브 · 버팀대 여덟 · 안쪽 마지막 단 날개 · 열 변색(33).
# 원래 시작 그림 열한 장에서 기계만 이 설계로 바꿔 구웠다(고름/<컷>발전.png). 넓적한 버팀대 여섯도 얼굴이 크게 잡히면 「여섯 날 환풍기」로 읽혀서
#   열린 흡입구는 어느 컷에도 정면으로 두지 않았다 — 16 · 17 · 30(출하 전) · 19 · 21 · 22 · 23(운송 · 도착)은 운송 덮개(16은 준호가 덮개 쓴 「얼굴」을
#   비스듬히 봄, 17은 덮개가 짧아 보이게 더 비낌), 24 · 26은 시험동 천장 흡기 덕트 · 벽 배기 덕트에 물린 채 20° 비껴, 28은 옆 낮은 각도(연소기 관측창이
#   켜지며 시동 — 첫 장의 경광등은 꺼짐), 33은 발전소 기초 위 3/4 뒤옆에서 노을빛이 몸통을 훑음(정면 원판은 「맨홀 뚜껑」이라 뺌, Fable 2차).
# 지시문은 원래 판(웹올리기_여섯편 · 다시_1107)의 것을 그대로 쓰되 TURBINE 줄과 기계 생김새를 말하는 구절만 바꾼다.
# 얼굴 컷 16 · 30은 GPT 편집이 얼굴까지 다시 그려서, Gemini로 만든 원래 그림의 준호 화소를 되돌려 얹은 판을 쓴다(얼굴되돌림.py — 30은 원래와 SFace 0.94).
# 19는 다시_1107과 같은 길: 새 끝 그림(E19발전)의 흙받이 자리 1/4을 잘라 4배로 키워 GPT로 선명하게 다시 그린 시작 그림(S19b발전)으로 첫 · 끝 프레임.
# 소리는 모두 끈다 — 편집 소리는 받은 19d · 24b 판의 소리(엔진 · 에어브레이크 · 방 울림)를 그대로 쓴다(최종소리.py).
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import 다시_1107_꾸러미 as 앞  # noqa: E402  (HEAD · LOOK · P19C · P24B를 그대로 쓴다)

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
SRC = os.path.join(DAY, "웹올리기_여섯편")
OUT = os.path.join(DAY, "웹올리기_p10발전_1107")
PICK = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p10/고름"

OLD_T = 앞.TURBINE.strip()
BODY = ("TURBINE: the same huge heavy-duty power-plant gas turbine in every shot — never an aircraft jet engine, a fan or a wheel: a long cream-white cast "
        "casing in one matte industrial paint, split along its middle by a thick flange with a dense row of big nuts, with heavy bolted flanges and cast ribs, "
        "a ring of short painted combustor cans with small round glass viewing ports all around its middle, grey trunnions and a heavy grey steel skid")
T_COVER = (BODY + "; its front inlet is closed for transport by a flat round grey steel cover bolted around its rim; it keeps exactly the shape and parts "
           "of the first frame; no logo, letters or numbers anywhere on it.")
T_SIDE = BODY + "; it keeps exactly the shape and parts of the first frame; no logo, letters or numbers anywhere on it."
T_TEST = (BODY + "; in the test cell its front inlet is joined to a huge square air-intake duct from the ceiling and its back end to a big round "
          "exhaust duct in the wall; it keeps exactly the shape and parts of the first frame; no logo, letters or numbers anywhere on it.")


def 원래(folder):
    return open(os.path.join(SRC, folder, "지시문.txt"), encoding="utf-8").read()


def 바꿈(text, turbine, pairs):
    assert OLD_T in text, "TURBINE 줄이 없다"
    text = text.replace(OLD_T, turbine)
    for a, b in pairs:
        assert a in text, f"바꿀 구절이 없다: {a[:60]}"
        text = text.replace(a, b)
    for bad in ("black cone", "bladed intake", "into the blades", "blade ring", "bellmouth", "strapped down"):
        assert bad not in text, f"옛 터빈 말이 남았다: {bad}"
    return text


P19E = 바꿈(앞.P19C.replace("It is the SAME mud flap", "The first frame is simply a close, tight view of the same scene as the last frame — it is the SAME mud flap"), T_COVER, [
    ("the huge cream-white gas turbine, strapped down,", "the huge cream-white gas turbine, chained down,"),
    ("its black bladed intake facing the camera — exactly as in the last frame.",
     "its front end facing the camera, closed by the grey bolted transport cover — exactly as in the last frame."),
])
P24E = 바꿈(앞.P24B, T_TEST, [
    ("the turbine faces the camera head-on at the end of the long room, its blades completely still.",
     "the turbine stands at the end of the long room, turned a little to the left and joined to its intake and exhaust ducts, completely still; "
     "two amber warning beacons on the side walls stay off."),
])
P28E = 바꿈(원래("105_p10-28"), T_TEST, [
    ("ACTION: The test cell again, head-on: the turbine at the end of the room between the walls of square panels. Its bladed intake turns slowly and steadily from the first frame to the last — about a quarter turn every second — every blade staying sharp, separate and the same shape, never blurring; the casing and the room stay perfectly still.",
     "ACTION: The dark test cell again, low and close beside the turbine: the ring of combustor cans with their small round glass viewing ports, the bolted split flange running into depth, the exhaust end at the far right leading into the exhaust duct. "
     "The turbine is starting: from about 0.3 s the small viewing ports on the combustor cans light up with a warm orange glow, one after another around the ring, until all of them glow steadily by about 1.6 s; "
     "at the same time the two amber warning beacons on the wall behind start turning, sweeping slow amber light over the panels, and a faint heat shimmer begins to rise above the exhaust end. "
     "Nothing else moves: the casing, the pipes and the room keep exactly their shape and place."),
])

JOBS = [  # (id, 꾸러미 폴더, [(가져올 곳, 넣을 이름)], 지시문, 길이, 쓰는초, 컷)
    ("p10-16e", "001_p10-16e", [(f"{PICK}/S16발전.png", "1_시작.jpg")], 바꿈(원래("095_p10-16"), T_COVER, [
        ("the turbine's front fills the left: the round black bladed intake with its black cone, inside the cream-white casing.",
         "the turbine's covered front fills the left, seen close at an angle: the grey bolted transport cover with its ring of bolts and two small lifting "
         "eyes inside the cream rim of the inlet casing, and beyond it its long side with the bolted split flange."),
        ("Junho in profile looks into the blades", "Junho in profile looks at the cover, as if at a face"),
        ("only his eyes follow the blades slowly", "only his eyes move slowly over it"),
        ("the blade ring and its cone slide to the left", "the cover and the casing slide to the left")]), 4, 1.13, ["16"]),
    ("p10-17e", "002_p10-17e", [(f"{PICK}/S17발전.png", "1_시작.jpg")], 바꿈(원래("096_p10-17"), T_COVER, [
        ("A wide, head-on view in the white-lit assembly hall: the turbine stands on its stand with the casing panels around its front opened up, showing the round black bladed intake and its cone;",
         "A wide view in the white-lit assembly hall: the turbine stands on its heavy steel skid, turned well to the left, showing its front closed by "
         "the grey bolted transport cover at a steep angle and its long side with the bolted split flange and the combustor cans;")]),
     4, 1.67, ["17"]),
    ("p10-19e", "003_p10-19e", [(f"{PICK}/S19b발전.png", "1_시작.jpg"), (f"{PICK}/E19발전.png", "2_끝.jpg")], P19E, 6, 5.0, ["19"]),
    ("p10-21e", "004_p10-21e", [(f"{PICK}/S21발전.png", "1_시작.jpg")], 바꿈(원래("099_p10-21"), T_COVER, []), 4, 1.04, ["21"]),
    ("p10-22e", "005_p10-22e", [(f"{PICK}/S22발전.png", "1_시작.jpg")], 바꿈(원래("138_p10-22"), T_COVER, [
        ("the turbine hangs in a big steel test-stand frame under a steel roof, its black bladed intake toward the left;",
         "the turbine stands in a big steel test-stand frame under a steel roof, its covered front end toward the left;")]), 4, 1.08, ["22"]),
    ("p10-23e", "006_p10-23e", [(f"{PICK}/S23발전.png", "1_시작.jpg")], 바꿈(원래("139_p10-23"), T_COVER, []), 4, 1.58, ["23"]),
    ("p10-24e", "007_p10-24e", [(f"{PICK}/S24발전.png", "1_시작.jpg")], P24E, 4, 2.09, ["24"]),
    ("p10-26e", "008_p10-26e", [(f"{PICK}/S26발전.png", "1_시작.jpg")], 바꿈(원래("103_p10-26"), T_TEST, []), 4, 1.54, ["26"]),
    ("p10-28e", "009_p10-28e", [(f"{PICK}/S28발전.png", "1_시작.jpg")], P28E, 4, 1.96, ["28"]),
    ("p10-30e", "010_p10-30e", [(f"{PICK}/S30발전.png", "1_시작.jpg")], 바꿈(원래("108_p10-30"), T_COVER, [
        ("Junho stands small beside it with his hand on the casing.", "Junho stands small beside it with his hand flat on a cast rib of the casing.")]),
     4, 1.83, ["30"]),
    ("p10-33e", "011_p10-33e", [(f"{PICK}/S33발전.png", "1_시작.jpg")], 바꿈(원래("111_p10-33"), T_SIDE, [
        ("the cream-white turbine seen from behind — its big round exhaust end toward the camera — stands in the middle of the wet, mirror-like floor, "
         "facing the huge open doorway where the orange-pink sunset sky glows;",
         "the cream-white turbine stands on a raised concrete foundation in the middle of the wet, mirror-like floor, seen at a three-quarter angle from "
         "behind and to the side, its long side running toward the huge open doorway where the orange-pink sunset sky glows, the warm sunset light raking "
         "along its casing;")]),
     4, 1.84, ["33"]),
]

# 받은 판 점검(11-07): p10-23e는 다가가는 내내 4장마다 같은 장(겹친장.py 창 6/6, 움직임 1.5~1.7 — 눈에 보이는 멈칫), p10-22e는 1.1초에 5.7% 다가가
# 원본(1.1초에 2%)의 세 배 — 시댄스가 「2%」를 늘 넘겨 그리므로 판 전체를 3%로만 적어 한 벌씩 다시 낸다(같은 시작 그림).
_느린 = "the camera physically moves forward so gently that the picture grows by only about 3% over the whole 4 seconds — barely noticeable; no shake."
_밀기22 = "the camera physically moves forward, the picture grows by about 2% in 1.1 s; no shake."
_밀기23 = "the camera physically moves forward, the picture grows by about 2% by 1.6 s; no shake."
assert _밀기22 in JOBS[4][3] and _밀기23 in JOBS[5][3]
JOBS += [
    ("p10-22f", "012_p10-22f", JOBS[4][2], JOBS[4][3].replace(_밀기22, _느린), 4, 1.08, ["22"]),
    ("p10-23f", "013_p10-23f", JOBS[5][2], JOBS[5][3].replace(_밀기23, _느린), 4, 1.58, ["23"]),
]
# p10-23f도 다가가며 4장마다 멈칫(창 6/6)하고 오히려 빨라졌다(1.6초에 8%) — 같은 시작 그림에서 두 번 연달아라 원본(1.6초에 2%)에 가까운 고정 컷으로:
# 카메라는 그 자리, 작은 작업자가 몇 걸음 · 앞 잔디가 바람에 — 움직임이 작은 자리뿐이면 겹친 장이 있어도 눈에 안 띈다(겹친장.py 문턱 0.5).
_고정 = ("CAMERA: the frame stays exactly where it is from the first frame to the last — no push-in, no zoom, no drift, no shake; "
         "only the small worker and the grass move.")
_23camera = [l for l in JOBS[5][3].splitlines() if l.startswith("CAMERA:")][0]
assert "Nothing moves." in JOBS[5][3]
JOBS += [
    ("p10-23g", "014_p10-23g", JOBS[5][2], JOBS[5][3].replace(_23camera, _고정).replace(
        "Nothing moves.", "The small worker walks a few slow steps toward the turbine; the strip of grass in front sways gently in a light breeze."),
     4, 1.58, ["23"]),
]


def main():
    want = set(sys.argv[1:])
    os.makedirs(OUT, exist_ok=True)
    boards = []
    for k, (pid, folder, files, prompt, sec, use, cuts) in enumerate(JOBS, 1):
        assert "@이미지 2" not in prompt or any(n.startswith("2_끝") for _, n in files)
        if not want or pid in want:   # 고를 때는 그 판 폴더만 다시 쓰고, _순서.json에는 늘 모든 판을 적는다
            d = os.path.join(OUT, folder)
            os.makedirs(d, exist_ok=True)
            for src, name in files:
                if not os.path.exists(src):
                    raise SystemExit(f"{pid}: {src} 가 없다")
                shutil.copyfile(src, os.path.join(d, name))
            open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(prompt)
            print(f"{pid}: {sec}초 · 지시문 {len(prompt)}자 · {[n for _, n in files]}")
        boards.append({"순서": k, "id": pid, "편": "p10", "컷": cuts, "폴더": folder, "길이": sec, "비율": "16:9", "소리": "끔", "묶음": False, "대안": False,
                       "방식": None, "시험": False, "낱판": [], "쓰는초": [use], "파일": [n for _, n in files], "빠진 파일": [],
                       "지시문 머리": prompt[:150], "지시문 글자 수": len(prompt)})
    json.dump(boards, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(OUT)


if __name__ == "__main__":
    main()
