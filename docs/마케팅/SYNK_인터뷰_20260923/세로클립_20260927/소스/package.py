# -*- coding: utf-8 -*-
"""완성 클립을 보관 폴더(Videos), 바탕화면, 저장소 문서 폴더로 복사하고 지문을 기록한다."""
import os, shutil, hashlib, json, sys
sys.stdout.reconfigure(encoding="utf-8")
WORK = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(WORK, "out"); QA = os.path.join(WORK, "qa")
VIDEOS = r"C:\Users\q1212\Videos\SYNK_Premium_Interview_20260925\shorts_v1"
DESKTOP = r"C:\Users\q1212\OneDrive\Desktop\SYNK_창업자_인터뷰_세로클립_v1"
REPO = r"C:\Users\q1212\Documents\SYNK-appsscript\docs\마케팅\SYNK_인터뷰_20260923\세로클립_20260927"
NAMES = {
    "A": "SYNK_인터뷰_세로_A_AI에_끌려간다_17s.mp4",
    "B": "SYNK_인터뷰_세로_B_TOPIK에_도움_안되면_쓰레기_41s.mp4",
    "C": "SYNK_인터뷰_세로_C_잘만들었다_했는데_평가는_33s.mp4",
    "D": "SYNK_인터뷰_세로_D_기술이_만들어준_시간_42s.mp4",
    "E": "SYNK_인터뷰_세로_E_한명한명_케어하고_싶은데_37s.mp4",
    "F": "SYNK_인터뷰_세로_F_조종하는건_AI가_아니라_사람_16s.mp4",
}
for d in (VIDEOS, DESKTOP, os.path.join(REPO, "검수"), os.path.join(REPO, "소스")):
    os.makedirs(d, exist_ok=True)
manifest = {}
for key, name in NAMES.items():
    src = os.path.join(OUT, f"clip_{key}.mp4")
    h = hashlib.sha256(open(src, "rb").read()).hexdigest()
    for dst_dir in (VIDEOS, DESKTOP):
        shutil.copy2(src, os.path.join(dst_dir, name))
    # 저장소에는 검수 시트·자막·측정값만 둔다(영상은 Videos 보관 폴더가 원본).
    shutil.copy2(os.path.join(QA, f"sheet_{key}.jpg"), os.path.join(REPO, "검수", f"{key}_프레임시트.jpg"))
    shutil.copy2(os.path.join(OUT, f"{key}.ass"), os.path.join(REPO, "소스", f"{key}.ass"))
    shutil.copy2(os.path.join(OUT, f"{key}_loudnorm_measured.json"), os.path.join(REPO, "소스", f"{key}_음량측정.json"))
    manifest[key] = {"file": name, "bytes": os.path.getsize(src), "sha256": h}
for fn in ("make_clips.py", "qa_clips.py", "package.py"):
    shutil.copy2(os.path.join(WORK, fn), os.path.join(REPO, "소스", fn))
shutil.copy2(os.path.join(QA, "qa_report.json"), os.path.join(REPO, "검수", "qa_report.json"))
json.dump(manifest, open(os.path.join(REPO, "검수", "파일지문.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(manifest, open(os.path.join(VIDEOS, "파일지문.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps(manifest, ensure_ascii=False, indent=1))
print("VIDEOS:", os.listdir(VIDEOS)); print("DESKTOP:", os.listdir(DESKTOP))
