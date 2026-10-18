# 지유 스킨케어 광고: Downloads에 막 받은 Gemini 원본을 Documents/synk-vendor/jiyu-skincare-20261018/키프레임_A/<이름>.jpg로 옮긴다.
# 쓰기: python 키프레임_받기.py mark           ← 「원본 크기 이미지 다운로드」를 누르기 직전에 지금 있는 파일 목록을 적는다
#       python 키프레임_받기.py 컷1 9:16        ← 그 뒤 새로 생긴 파일 가운데 비율 크기가 맞는 것 하나만 옮긴다
# 지유 LoRA의 take.py와 같은 방식(10-18: 다른 세션이 같은 시각에 받은 Gemini 그림을 집은 일이 있어 「가장 최근 파일」로 고르지 않는다).
import glob
import json
import os
import shutil
import sys
import time

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
DL = os.path.join(os.environ["USERPROFILE"], "Downloads")
OUT = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "키프레임_A")
MARK = os.path.join(OUT, ".mark.json")
SIZE = {"9:16": (1536, 2752), "3:4": (1792, 2400), "4:3": (2400, 1792), "1:1": (2048, 2048)}


def gemini_files():
    return {f for f in glob.glob(os.path.join(DL, "Gemini_Generated_Image_*")) if not f.endswith(".crdownload")}


os.makedirs(OUT, exist_ok=True)
if sys.argv[1] == "mark":
    json.dump(sorted(gemini_files()), open(MARK, "w", encoding="utf-8"))
    print(f"표시함: {len(gemini_files())}개")
    sys.exit()

name, ratio = sys.argv[1], sys.argv[2]
before = set(json.load(open(MARK, encoding="utf-8")))
dst = os.path.join(OUT, f"{name}.jpg")
if os.path.exists(dst):
    sys.exit(f"이미 있음: {dst}")
end = time.time() + 60
while True:
    new = sorted(gemini_files() - before)
    mine = [f for f in new if Image.open(f).size == SIZE[ratio]]
    if mine and not glob.glob(os.path.join(DL, "*.crdownload")):
        if len(mine) > 1:
            sys.exit(f"새 파일이 둘 이상이라 고르지 않음: {mine}")
        src = mine[0]
        s1 = os.path.getsize(src)
        time.sleep(1)
        if os.path.getsize(src) == s1:
            break
    if time.time() > end:
        sys.exit(f"60초 안에 {ratio} 크기 새 파일이 오지 않았다(새 파일: {new})")
    time.sleep(2)
shutil.move(src, dst)
os.remove(MARK)
print(f"{os.path.basename(src)} -> {dst} ({os.path.getsize(dst)//1024} KB, {SIZE[ratio]})")
