"""편집 구간 [시작, 끝)의 실제 프레임을 골라 앞 컷 마지막과 현재 컷 처음·중간·끝을 한 줄로 놓는다."""
import io
import json
import math
import subprocess
import tempfile
from bisect import bisect_left
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def 장번호(영상, 시작, 끝, 마지막만):
    if not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in (시작, 끝)) or not 0 <= 시작 < 끝:
        raise ValueError("컷 연결에 쓸 실제 영상 구간이 올바르지 않다")
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_frames",
                        "-read_intervals", f"%+{끝 + 2:.6f}", "-show_entries", "frame=best_effort_timestamp_time,duration_time",
                        "-of", "json", str(영상)], capture_output=True, timeout=180, check=True)
    프레임 = json.loads(r.stdout)["frames"]
    if not 프레임:
        raise ValueError("컷 연결에 쓸 영상 프레임이 없다")
    시각 = [float(f["best_effort_timestamp_time"]) for f in 프레임]
    # 컷표는 24fps의 1/24초도 소수 넷째 자리로 적는다. 다음 컷 첫 장이 앞 컷 끝에 섞이지 않게 양쪽을 같은 정밀도로 비교한다.
    초 = [round(t - 시각[0], 4) for t in 시각]
    마지막길이 = float(프레임[-1].get("duration_time") or (초[-1] - 초[-2] if len(초) > 1 else 0))
    처음, 다음 = bisect_left(초, round(시작, 4)), bisect_left(초, round(끝, 4))
    if 다음 <= 처음 or round(끝, 4) > round(초[-1] + 마지막길이, 4) + 0.0001:
        raise ValueError("지정한 편집 구간을 실제 영상 프레임으로 채울 수 없다")
    중간초 = (시작 + 끝) / 2
    오른쪽 = min(다음 - 1, bisect_left(초, 중간초))
    중간 = min((max(처음, 오른쪽 - 1), 오른쪽), key=lambda n: abs(초[n] - 중간초))
    return [[n, 초[n]] for n in ([다음 - 1] if 마지막만 else [처음, 중간, 다음 - 1])]


def 그림칸(영상, 장들, 폴더, 뒤집기=False):
    번호 = sorted({n for n, _ in 장들})
    선택 = "+".join(f"eq(n,{n})" for n in 번호)
    필터 = (f"select='{선택}'," + ("hflip," if 뒤집기 else "")
          + "scale=w='max(1,round(640*min(1,dar)))':h='max(1,round(640*min(1,1/dar)))',setsar=1")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(영상), "-map", "0:v:0", "-vf", 필터,
                    "-fps_mode", "passthrough", "-frames:v", str(len(번호)), "-start_number", "0",
                    str(폴더 / "%d.png")], capture_output=True, timeout=180, check=True)
    칸 = {}
    for i, n in enumerate(번호):
        with Image.open(폴더 / f"{i}.png") as im:
            칸[n] = im.convert("RGB")
    return [칸[n] for n, _ in 장들]


def 비교판(앞영상, 앞시작, 앞끝, 뒤집기, 영상, 시작, 끝, 현재좌우=False):
    앞장 = 장번호(앞영상, 앞시작, 앞끝, True)
    현재장 = 장번호(영상, 시작, 끝, False)
    with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
        칸 = 그림칸(앞영상, 앞장, Path(a), 뒤집기) + 그림칸(영상, 현재장, Path(b), 현재좌우)
    너비, 높이 = max(im.width for im in 칸), max(im.height for im in 칸)
    판 = Image.new("RGB", ((너비 + 4) * 4 - 4, 높이 + 40), "#15191e")
    글 = ImageDraw.Draw(판)
    서체 = ImageFont.load_default(size=21)
    for i, (이름, (_, 초), im) in enumerate(zip(("PREV END", "START", "MIDDLE", "END"), 앞장 + 현재장, 칸)):
        x = i * (너비 + 4)
        글.text((x + 8, 8), f"{이름}   {초:.3f} s", font=서체, fill="white")
        판.paste(im, (x + (너비 - im.width) // 2, 40 + (높이 - im.height) // 2))
    저장 = io.BytesIO()
    판.save(저장, format="JPEG", quality=94, subsampling=0)
    return 저장.getvalue(), {"앞": 앞장[0], "현재": 현재장}
