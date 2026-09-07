#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""얼굴사진뽑기 — 영상에서 얼굴 학습용 사진을 골라 뽑는다.

왜 있나:
  Higgsfield 의 Soul ID(얼굴 학습)는 «사진만» 받는다. 그런데 유호님이 출연한
  뮤직비디오는 학습 재료로 사진보다 낫다 — 카메라가 돌아 각도가 저절로 다양하고,
  조명이 전문가 것이고, 노래하는 입 모양이 통째로 들어 있다.
  이 도구가 영상과 사진 사이를 잇는다.

하는 일:
  1. ffmpeg 으로 <간격>초마다 프레임을 뽑는다
  2. 선명도를 재서 흐릿한 것(카메라가 돌 때 번진 것)을 버린다
  3. 남은 것을 «격자 한 장»으로 붙인다 — 사람이 눈으로 보고 고르라고
     (덩어리로 세지 않고 격자+번호로 가른다 · 기억 felt-parts-bake-as-one-sheet)

쓰는 법:
  python tools/얼굴사진뽑기.py --영상 "<폴더나 파일>"
  python tools/얼굴사진뽑기.py --영상 "..." --간격 2 --상한 80 --흐림컷 50

고른 뒤:
  python tools/얼굴사진뽑기.py --추리기 "<뽑은사진 폴더>" --고른번호 3,7,12,15
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageStat
except ImportError:
    sys.exit("Pillow 가 없다. `pip install pillow` 를 먼저.")

# 윈도 콘솔 기본이 cp949 라 한글·기호가 깨지고 ✅ 에서는 아예 죽는다.
for 통 in (sys.stdout, sys.stderr):
    try:
        if 통 and (통.encoding or "").lower().replace("-", "") != "utf8":
            통.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

영상확장자 = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v", ".wmv", ".flv"}


def 로그(*a):
    print(*a, flush=True)


def 영상목록(대상: Path):
    """폴더면 그 안의 영상 전부, 파일이면 그 하나."""
    if 대상.is_file():
        return [대상] if 대상.suffix.lower() in 영상확장자 else []
    if not 대상.is_dir():
        return []
    나온것 = [p for p in sorted(대상.iterdir())
              if p.is_file() and p.suffix.lower() in 영상확장자]
    return 나온것


def 길이재기(영상: Path) -> float:
    """영상이 몇 초인지. 못 재면 0."""
    try:
        결과 = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(영상)],
            capture_output=True, text=True, timeout=60)
        return float(결과.stdout.strip())
    except Exception:
        return 0.0


def 프레임뽑기(영상: Path, 나갈곳: Path, 간격: float, 상한: int) -> list:
    """ffmpeg 으로 <간격>초마다 한 장씩. 가로 1080 으로 맞춰 저장한다."""
    나갈곳.mkdir(parents=True, exist_ok=True)
    꼬리 = 나갈곳 / "%04d.jpg"
    명령 = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(영상),
        "-vf", f"fps=1/{간격},scale=1080:-2:flags=lanczos",
        "-frames:v", str(상한),
        "-q:v", "2",
        str(꼬리),
    ]
    subprocess.run(명령, check=True, timeout=1800)
    return sorted(나갈곳.glob("*.jpg"))


def 선명도(사진: Path) -> float:
    """가장자리가 얼마나 또렷한가. 흐릿할수록 낮다.

    라플라시안 분산의 대용이다 — opencv 없이 Pillow 만으로 같은 결을 낸다.
    """
    try:
        with Image.open(사진) as im:
            회색 = im.convert("L")
            회색.thumbnail((640, 640))
            가장자리 = 회색.filter(ImageFilter.FIND_EDGES)
            return ImageStat.Stat(가장자리).stddev[0]
    except Exception:
        return 0.0


def 격자시트(사진들: list, 나갈곳: Path, 칸가로: int = 6, 칸크기: int = 300):
    """뽑은 사진을 번호 붙여 격자 한 장으로. 사람이 이걸 보고 고른다."""
    if not 사진들:
        return None
    # 첫 장의 비율로 칸 높이를 잡는다. 가로 영상에 정사각 칸을 쓰면 아래가 텅 빈다.
    with Image.open(사진들[0]) as 첫장:
        비율 = 첫장.height / max(1, 첫장.width)
    칸높이 = int((칸크기 - 8) * 비율) + 8

    줄수 = (len(사진들) + 칸가로 - 1) // 칸가로
    시트 = Image.new("RGB", (칸가로 * 칸크기, 줄수 * 칸높이), (24, 24, 28))
    그리개 = ImageDraw.Draw(시트)

    for 순번, 사진 in enumerate(사진들):
        try:
            with Image.open(사진) as im:
                im = im.convert("RGB")
                im.thumbnail((칸크기 - 8, 칸높이 - 8))
                x = (순번 % 칸가로) * 칸크기 + 4
                y = (순번 // 칸가로) * 칸높이 + 4
                시트.paste(im, (x, y))
                표 = str(순번 + 1)
                그리개.rectangle([x, y, x + 14 + 7 * len(표), y + 20],
                                 fill=(0, 0, 0))
                그리개.text((x + 5, y + 4), 표, fill=(255, 220, 80))
        except Exception:
            continue

    나갈곳.parent.mkdir(parents=True, exist_ok=True)
    시트.save(나갈곳, quality=88)
    return 나갈곳


def 한영상처리(영상: Path, 바깥: Path, 간격: float, 상한: int, 흐림컷: int):
    이름 = 영상.stem
    로그(f"\n▶ {영상.name}")
    길이 = 길이재기(영상)
    if 길이:
        로그(f"   길이 {길이:.0f}초 · {간격}초마다 뽑으면 최대 {int(길이 / 간격)}장")

    날것 = 바깥 / 이름 / "_날것"
    if 날것.exists():
        shutil.rmtree(날것)
    뽑은것 = 프레임뽑기(영상, 날것, 간격, 상한)
    로그(f"   뽑았다: {len(뽑은것)}장")
    if not 뽑은것:
        return None

    점수 = [(선명도(p), p) for p in 뽑은것]
    점수.sort(key=lambda t: t[0], reverse=True)
    남길수 = max(1, int(len(점수) * (100 - 흐림컷) / 100))
    살아남음 = [p for _, p in 점수[:남길수]]
    살아남음.sort()
    로그(f"   흐린 것 {len(점수) - 남길수}장을 버렸다 → {len(살아남음)}장 남음")

    골라둠 = 바깥 / 이름 / "_선명한것"
    if 골라둠.exists():
        shutil.rmtree(골라둠)
    골라둠.mkdir(parents=True, exist_ok=True)
    자리표 = {}
    for 순번, p in enumerate(살아남음, start=1):
        새이름 = 골라둠 / f"{순번:03d}{p.suffix}"
        shutil.copy2(p, 새이름)
        자리표[순번] = 새이름.name

    시트경로 = 바깥 / 이름 / f"격자_{이름}.jpg"
    격자시트(sorted(골라둠.glob("*.jpg")), 시트경로)
    로그(f"   격자: {시트경로}")

    (바깥 / 이름 / "자리표.json").write_text(
        json.dumps(자리표, ensure_ascii=False, indent=2), encoding="utf-8")

    shutil.rmtree(날것, ignore_errors=True)
    return 시트경로


def 추리기(폴더: Path, 고른번호: str):
    """격자에서 고른 번호만 «최종» 폴더로 모은다."""
    선명한것 = 폴더 / "_선명한것"
    if not 선명한것.is_dir():
        sys.exit(f"«_선명한것» 이 없다: {선명한것}")
    번호들 = []
    for 조각 in 고른번호.replace(" ", "").split(","):
        if "-" in 조각:
            처음, 끝 = 조각.split("-")
            번호들.extend(range(int(처음), int(끝) + 1))
        elif 조각:
            번호들.append(int(조각))

    최종 = 폴더 / "_최종"
    최종.mkdir(parents=True, exist_ok=True)
    옮긴수 = 0
    for n in 번호들:
        후보 = list(선명한것.glob(f"{n:03d}.*"))
        if 후보:
            shutil.copy2(후보[0], 최종 / 후보[0].name)
            옮긴수 += 1
        else:
            로그(f"   ⚠ {n}번이 없다")
    로그(f"✅ {옮긴수}장을 {최종} 에 모았다")


def main():
    앞 = argparse.ArgumentParser(add_help=False)
    앞.add_argument("--영상")
    앞.add_argument("--내보낼곳")
    앞.add_argument("--간격", type=float, default=3.0)
    앞.add_argument("--상한", type=int, default=60)
    앞.add_argument("--흐림컷", type=int, default=40,
                    help="선명도 하위 몇 %%를 버릴지 (기본 40)")
    앞.add_argument("--추리기")
    앞.add_argument("--고른번호")
    앞.add_argument("-h", "--help", action="help")
    인자 = 앞.parse_args()

    if 인자.추리기:
        if not 인자.고른번호:
            sys.exit("--고른번호 도 같이 줘야 한다 (예: --고른번호 3,7,12-15)")
        추리기(Path(인자.추리기), 인자.고른번호)
        return

    if not 인자.영상:
        sys.exit("--영상 <폴더나 파일> 이 필요하다")

    대상 = Path(인자.영상)
    영상들 = 영상목록(대상)
    if not 영상들:
        sys.exit(f"영상이 없다: {대상}")

    바깥 = Path(인자.내보낼곳) if 인자.내보낼곳 else (
        (대상 if 대상.is_dir() else 대상.parent) / "_뽑은사진")
    바깥.mkdir(parents=True, exist_ok=True)

    로그(f"영상 {len(영상들)}편 · {인자.간격}초마다 · 편당 최대 {인자.상한}장")
    로그(f"내보낼 곳: {바깥}")

    시트들 = []
    for 영상 in 영상들:
        try:
            시트 = 한영상처리(영상, 바깥, 인자.간격, 인자.상한, 인자.흐림컷)
            if 시트:
                시트들.append(시트)
        except subprocess.CalledProcessError as e:
            로그(f"   ✗ ffmpeg 이 막혔다: {e}")
        except Exception as e:
            로그(f"   ✗ {type(e).__name__}: {e}")

    로그(f"\n✅ 격자 {len(시트들)}장이 섰다. 눈으로 보고 번호를 고른 뒤:")
    로그('   python tools/얼굴사진뽑기.py --추리기 "<영상이름 폴더>" --고른번호 3,7,12-15')


if __name__ == "__main__":
    main()
