# -*- coding: utf-8 -*-
"""v2 재현용 작업 폴더를 저장소 원본에서 다시 세운다.
쓰기: python 작업폴더_준비.py [작업폴더]   (기본: %TEMP%/lab_expr_ep01)
그다음 출력되는 명령을 차례로 실행하면 같은 영상이 다시 나온다(음성·음악은 저장소에 보관한 파일을 쓰므로 새로 생성하지 않는다)."""
import os, sys, shutil, glob, tempfile
sys.stdout.reconfigure(encoding="utf-8")
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))           # …/LAB표현소개_아맞다_20260927/소스/v2
EP = os.path.dirname(os.path.dirname(HERE))                  # 회차 폴더
REPO = os.path.abspath(os.path.join(EP, "..", "..", ".."))   # 저장소 뿌리
work = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), "lab_expr_ep01")
for d in ["fonts", "assets", "sounds", "veo", "v2/voice/lines", "v2/bgm", "v2/out", "v2/qa"]:
    os.makedirs(os.path.join(work, d), exist_ok=True)
for f in ["SUIT/SUIT-ExtraBold.otf", "SUIT/SUIT-SemiBold.otf", "SUIT/SUIT-Medium.otf", "InterTight/InterTight-Bold.ttf", "InterTight/InterTight-SemiBold.ttf", "InterTight/InterTight-Medium.ttf"]:
    shutil.copy(os.path.join(REPO, "docs", "브랜드_폰트", f), os.path.join(work, "fonts", os.path.basename(f)))
for c in ["본체", "놀람", "좌34", "응원", "눈웃음", "눈감음", "집중", "윙크"]:
    Image.open(os.path.join(REPO, "docs", "캐릭터", "정본_4K", f"몽글_{c}.png")).convert("RGBA").resize((1200, 1200), Image.LANCZOS).save(os.path.join(work, "assets", f"몽글_{c}.png"))
shutil.copy(os.path.join(REPO, "docs", "캐릭터", "오브공방_0821", "Paper.png"), os.path.join(work, "assets", "paper.png"))
shutil.copy(os.path.join(REPO, "docs", "홍보물", "마케팅실행_20260909", "브랜드킷", "배치용", "SYNK-LAB-Ink.png"), os.path.join(work, "assets", "lab_logo.png"))
for f in glob.glob(os.path.join(REPO, "docs", "브랜드_사운드킷", "synk-*.wav")): shutil.copy(f, os.path.join(work, "sounds"))
shutil.copy(os.path.join(EP, "소스", "veo_우산_장면_원본.mp4"), os.path.join(work, "veo", "umbrella.mp4"))
for f in glob.glob(os.path.join(HERE, "*.py")) + glob.glob(os.path.join(HERE, "*.js")): shutil.copy(f, os.path.join(work, "v2"))
for f in glob.glob(os.path.join(EP, "음성", "v2", "*__*.wav")): shutil.copy(f, os.path.join(work, "v2", "voice", "lines"))
shutil.copy(os.path.join(EP, "음악", "lyria3_b.mp3"), os.path.join(work, "v2", "bgm", "lyria3_b.mp3"))
v2 = os.path.join(work, "v2")
print("작업 폴더:", work)
print(f"""다음 순서로 실행:
cd "{v2}"
python prep_voice.py
ffmpeg -y -loglevel error -ss 2.40 -t 2.70 -i ../veo/umbrella.mp4 -vf "fps=30,scale=1080:1920:in_color_matrix=bt709:out_color_matrix=bt709:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int" -q:v 1 -start_number 0 veo_full/%04d.jpg   (먼저 mkdir veo_full)
python render_v2.py --lang en --check
python render_v2.py --lang en --out out/video_en.mp4 --export-table 장면표_v2.json
python mix_v2.py --video out/video_en.mp4 --out out/SYNK_LAB_아맞다_EP01_v2_EN.mp4
python qa_v2.py --file out/SYNK_LAB_아맞다_EP01_v2_EN.mp4 --lang en --outdir qa""")
