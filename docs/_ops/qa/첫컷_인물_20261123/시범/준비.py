"""첫컷검사 「인물」 컷끼리 견주기 시범 재료(11-24) — 편마다 시범 컷표(틀 2)와 받음/<컷>.mp4(최종본에서 컷마다 자름)를 만든다.

python -X utf8 docs/_ops/qa/첫컷_인물_20261123/시범/준비.py [편 …] [--원본 <미디어가 있는 작업본>]
편: 수석합격 · 회의록 · 자소서 · 가짜쇼핑몰 · S55(없으면 모두). 결과는 이 작업본의 .tmp/첫컷컷끼리_시범/<편>/.
네 편은 SNS 틀 1이라 「인물」 표가 없어 뿌리 그림을 기준으로 둔다. 회의록은 뿌리 그림이 없어 19.6초 장의 대리 쪽(왼쪽)을 잘라 기준으로 쓴다.
컷 줄마다 「시간건너뜀」을 적어 앞 컷 이음 질문은 뺀다(시범 컷은 실제로 이어진 컷이 아니다).
"""
import argparse
import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image

뿌리 = Path(__file__).resolve().parents[5]
출력 = 뿌리 / ".tmp" / "첫컷컷끼리_시범"

편들 = {
    "수석합격": ("synkbrief_수석합격_20261121", "게시/b60_master.mp4", {"수석": "판/뿌리_수석_1.png"},
              {"c01": ["수석"], "c04": ["수석"], "c05": ["수석"], "c07": ["수석"], "c09": ["수석"]}),
    "회의록": ("synkbrief_회의록_20261109", "게시/b37_master.mp4", {"대리": "@19.6"},
            {"c10": ["대리", "과장"], "c16": ["대리", "과장"]}),
    "자소서": ("synkbrief_자소서_20261117", "게시/b49_master.mp4",
            {"지원자": "판/뿌리_지원자_074632.png", "팀장": "판/뿌리_팀장_074652.png", "대리": "판/뿌리_대리_074714.png"},
            {"c02": ["지원자"], "c04": ["지원자"], "c06": ["지원자"], "c08": ["대리", "팀장"], "c09": ["대리"], "c10": ["팀장"],
             "c11": ["대리"], "c12": ["팀장"], "c13": ["대리"], "c14": ["팀장"], "c16": ["팀장"], "c18": ["팀장"], "c20": ["팀장"]}),
    "가짜쇼핑몰": ("synkbrief_가짜쇼핑몰_20261116", "게시/b52_master.mp4", {"동생": "판/뿌리_동생_153516.png", "언니": "판/뿌리_언니_153536.png"},
              {"c01": ["동생"], "c03": ["언니", "동생"], "c04": ["동생"], "c06": ["언니"], "c07": ["동생"], "c08": ["언니", "동생"],
               "c12": ["언니", "동생"], "c13": ["언니", "동생"]}),
}
구간고침 = {("회의록", "c16"): (25.38, 2.9)}   # 지난 시범처럼 c14 · c16 두 토막(25.38~28.28초)을 한 줄로 본다


def 장수(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
                        "stream=nb_read_frames,r_frame_rate", "-of", "json", str(p)], capture_output=True, text=True, check=True)
    s = json.loads(r.stdout)["streams"][0]
    a, b = s["r_frame_rate"].split("/")
    return int(s["nb_read_frames"]), int(a) / int(b)


def SNS편(원본, 이름):
    폴더, 최종, 기준, 사람 = 편들[이름]
    편, 곳 = 원본 / "docs" / "마케팅" / 폴더, 출력 / 이름
    (곳 / "받음").mkdir(parents=True, exist_ok=True)
    (곳 / "ref").mkdir(exist_ok=True)
    인물표 = {}
    for 배역, 그림 in 기준.items():
        p = 편 / 그림
        if 그림.startswith("@"):
            p = 곳 / "ref" / f"{배역}_기준.png"
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", 그림[1:], "-i", str(편 / 최종), "-frames:v", "1", str(p)], check=True)
            Image.open(p).crop((0, 560, 640, 1460)).save(p)   # 과장과 함께 나오는 장이라 대리 쪽만
        인물표[배역] = {"묘사": f"{배역} — 뿌리 그림의 사람", "기준그림": str(p).replace("\\", "/")}
    for 배역 in {n for v in 사람.values() for n in v} - set(인물표):   # 표에 없는 이름은 얼굴판을 막으니 기준 없는 배역도 적는다
        인물표[배역] = {"묘사": f"{배역} — 기준 그림 없음"}
    줄 = []
    for d in json.loads((편 / "컷순서.json").read_text(encoding="utf-8-sig"))["detail"]:
        if d["cut"] not in 사람:
            continue
        t, dur = 구간고침.get((이름, d["cut"]), (d["t"], d["dur"]))
        파일 = 곳 / "받음" / f"{d['cut']}.mp4"
        if not 파일.exists():
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(편 / 최종), "-t", f"{dur:.3f}", "-c:v", "libx264",
                            "-crf", "14", "-preset", "fast", "-pix_fmt", "yuv420p", "-c:a", "aac", str(파일)], check=True)
        n, fps = 장수(파일)
        x = {k: v for k, v in d.items() if k not in ("t", "dur", "인물")}
        줄.append({**x, "in": 0, "out": min(round(dur, 3), round(n / fps - 0.5 / fps, 3)), "t": t, "dur": dur,
                  "인물": 사람[d["cut"]], "시간건너뜀": True})
    (곳 / "컷표.json").write_text(json.dumps({"틀": 2, "편": {"비율": "9:16"}, "인물": 인물표, "detail": 줄}, ensure_ascii=False, indent=1), encoding="utf-8")
    (곳 / "기획.md").write_text(f"# {이름} 시범(첫컷검사 인물 컷끼리)\n", encoding="utf-8")


def S55(원본):
    편, 곳 = 원본 / "docs/마케팅/PULSE_영어시험_20261117/02_다섯번의디렉션", 출력 / "S55"
    (곳 / "받음").mkdir(parents=True, exist_ok=True)
    표 = json.loads((편 / "컷표.json").read_text(encoding="utf-8-sig"))
    for v in 표["인물"].values():
        v["기준그림"] = str((편 / v["기준그림"]).resolve()).replace("\\", "/")
    for d in 표["detail"]:
        d["시간건너뜀"] = True
        shutil.copy2(원본.parent / "synk-vendor/pulse-en-ep2-20261117/받음_480p" / f"{d['cut']}.mp4", 곳 / "받음" / f"{d['cut']}.mp4")
    (곳 / "컷표.json").write_text(json.dumps(표, ensure_ascii=False, indent=1), encoding="utf-8")
    shutil.copy2(편 / "기획.md", 곳 / "기획.md")


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("편", nargs="*")
    a.add_argument("--원본", type=Path, default=None, help="최종본 · 뿌리 그림이 있는 작업본(D: 워크트리에는 미디어가 없다)")
    o = a.parse_args()
    원본 = o.원본 or (뿌리 if (뿌리 / "docs/마케팅/synkbrief_수석합격_20261121/게시/b60_master.mp4").exists()
                      else Path.home() / "Documents" / "SYNK-appsscript")
    for 이름 in o.편 or [*편들, "S55"]:
        S55(원본) if 이름 == "S55" else SNS편(원본, 이름)
        print("준비:", 출력 / 이름)
