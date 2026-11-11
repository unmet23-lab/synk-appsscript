# 블프 스나이퍼 전단 · 달력 컷 다시 굽기(2026-11-11, Claude) — 유호님 「추천대로」(슬롭 점검표 55번 훑기 · 02_콘티 9절).
# ※ 11-11 유호님 「제미나이로만 만들어. 드리미나 쓰지말고」 — 이 드리미나 꾸러미로는 내지 않는다. 소품 줄 · 시작 그림 짝(START)만
#   ../블프_작품글자_20261110/영상지시문.py(Gemini 앱 「동영상 만들기」)가 불러 쓴다.
# 10-31 무제한 날 판(웹올리기_여섯편)의 여섯 컷(2 · 5 · 13 · 15 · 18 달력, 7 전단)을 같은 지시문 · 같은 길이로 다시 내고,
# 바꾸는 것은 시작 그림(새 전단 A2 · 새 벽 달력에 Gemini가 손 · 펜을 얹은 판)과 CALENDAR · FLYER 소품 줄뿐이다(카메라 · 연기 · 초는 그대로).
#   python -X utf8 다시_1111_꾸러미.py  → git 밖 pulse-seedance-day-20261028/웹올리기_블프글자_1111/ (+ 시작 그림을 시댄스/S0x_1111.jpg로도 남김)
#   미리 보기: python -X utf8 ../../시댄스무제한/드리미나내기.py <그 폴더> s4-02 s4-05 s4-07 s4-13 s4-15 s4-18 --받을곳 <받음> --계정 ultra
#   크레딧(드리미나 울트라 77yuhbs, 720p 초당 18 — 4초 다섯 · 5초 하나 = 450)은 유호님 승인 뒤 --실행.
import glob
import json
import os
import shutil

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
OLD = os.path.join(DAY, "웹올리기_여섯편")
PACK = os.path.join(DAY, "웹올리기_블프글자_1111")
PIC = "C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper/시댄스"
BAKED = "C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper/글자1110/받음"

OLD_CAL = ("CALENDAR: the big white paper wall calendar exactly as in the first frame — large black printed day numbers in a thin blue-grey grid, "
           "the red marker X's already drawn on the earlier days, and '00:00' handwritten in red in the box for the 27th.")
NEW_CAL = ("CALENDAR: the paper wall calendar exactly as in the first frame — a big '11' and NOVEMBER at the top, black printed day numbers "
           "(Sundays red, Saturdays blue) with small lunar dates in a thin grey grid, small October and December calendars in the empty boxes at "
           "the bottom, the hand-drawn red marker X's already on the earlier days (each one a little different), and '00:00' handwritten in red "
           "in the box for the 27th.")
OLD_FLY = ("FLYER: the glossy sale flyer he holds open, exactly as printed in the first frame — the big TV photo, the amber-orange price blocks "
           "and every printed Korean letter and number stay exactly as they are and are never redrawn.")
NEW_FLY = ("FLYER: the matte cream sale flyer he holds open, exactly as printed in the first frame — the small black wordmark at the top, the big "
           "headline, the TV photo, the big price, the round orange stamp and the short line at the bottom, and every printed Korean letter and number stay exactly as they "
           "are and are never redrawn.")
# 컷 → 새 시작 그림(글자1110/받음의 작업 id)
START = {"s4-02": "C02n", "s4-05": "C05n", "s4-07": "F07A4", "s4-13": "C13n", "s4-15": "C15n", "s4-18": "C18n"}


def latest(job):
    got = sorted(glob.glob(os.path.join(BAKED, f"{job}_*.jpg")) + glob.glob(os.path.join(BAKED, f"{job}_*.png")), key=os.path.getmtime)
    if not got:
        raise SystemExit(f"시작 그림이 아직 없다: {job} — 굽기(글자1110/굽기.sh JOBS=jobs_1111.json)부터")
    return got[-1]


def main():
    order_old = {x["id"]: x for x in json.load(open(os.path.join(OLD, "_순서.json"), encoding="utf-8"))}
    if os.path.isdir(PACK):
        shutil.rmtree(PACK)
    os.makedirs(PACK)
    order = []
    for k, (pid, job) in enumerate(START.items(), 1):
        o = order_old[pid]
        text = open(os.path.join(OLD, o["폴더"], "지시문.txt"), encoding="utf-8").read()
        new = text.replace(OLD_CAL, NEW_CAL).replace(OLD_FLY, NEW_FLY)
        assert new != text, f"{pid}: 소품 줄을 못 찾음"
        folder = f"{k:03d}_{pid}"
        d = os.path.join(PACK, folder)
        os.makedirs(d)
        src = latest(job)
        shutil.copyfile(src, os.path.join(d, "1_시작.jpg"))
        shutil.copyfile(src, os.path.join(PIC, f"S{pid.split('-')[1]}_1111.jpg"))
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(new)
        order.append({**o, "순서": k, "폴더": folder, "지시문 머리": new[:120], "지시문 글자 수": len(new)})
        print(f"{pid}: {os.path.basename(src)} · {o['길이']}초 · 지시문 {len(text)} → {len(new)}자")
    json.dump(order, open(os.path.join(PACK, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(PACK, "· 합", sum(x["길이"] for x in order), "초")


if __name__ == "__main__":
    main()
