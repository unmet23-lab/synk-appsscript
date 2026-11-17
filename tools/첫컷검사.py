"""실제 첫 시험 컷과 현재 제작 기준을 연결한다. 모델에 관계없이 제작자가 같은 명령을 쓴다.

python -X utf8 tools/첫컷검사.py <편폴더> <영상> [--시작 초 --끝 초] [--종류 LAB|그래픽|컷표영상]
같은 명령에 --확인파일 <작성한 JSON>을 더하면 시트를 본 결과를 기록한다.
0 = 지금 영상과 기준으로 확인함, 1 = 다시 만들어야 함, 2 = 확인 대기 또는 검사 실패.
"""
import argparse
import hashlib
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import 받은뒤검사


def json읽기(파일):
    return json.loads(파일.read_text(encoding="utf-8-sig"))


def 파일지문(파일):
    with 파일.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


def 원자쓰기(파일, 내용):
    with tempfile.NamedTemporaryFile(dir=파일.parent, delete=False) as f:
        임시 = Path(f.name)
    try:
        임시.write_bytes(내용)
        os.replace(임시, 파일)
    finally:
        임시.unlink(missing_ok=True)


def 기준읽기(대상, 종류=None):
    cli = Path(__file__).with_name("영상기준.js")
    명령 = ["node", str(cli), str(대상), "--json"]
    if 종류:
        명령.extend(["--종류", 종류])
    r = subprocess.run(명령, capture_output=True, text=True,
                       encoding="utf-8", timeout=240)
    if r.returncode:
        raise ValueError(f"현재 영상 기준을 읽지 못했다: {r.stderr.strip() or r.returncode}")
    자료 = json.loads(r.stdout)
    지문, 지적 = 자료["기준판"], 자료["최근지적"]
    if not isinstance(지문, str) or len(지문) != 64 or not isinstance(지적, list):
        raise ValueError("현재 제작 기준과 최근 지적을 읽지 못했다")
    return 자료


def 프레임시트(영상, 시작, 끝):
    # 1초가 한 줄이다. 옆으로 읽으면 각 칸이 0.125초씩 뒤로 간다.
    줄수 = max(1, math.ceil(끝 - 시작))
    필터 = (f"trim=start={시작:.6f}:end={끝:.6f},setpts=PTS-STARTPTS,fps=8:round=up,"
           f"scale=224:224:force_original_aspect_ratio=decrease,pad=224:224:(ow-iw)/2:(oh-ih)/2,"
           f"tile=8x{줄수}")
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(영상), "-an", "-vf", 필터,
                        "-frames:v", "1", "-q:v", "3", "-c:v", "mjpeg", "-f", "image2pipe", "-"],
                       capture_output=True, timeout=120, check=True)
    if not r.stdout:
        raise ValueError("지정한 구간에서 확인할 영상 프레임을 꺼내지 못했다")
    return r.stdout


def 확인결과(답, 동일성, 질문):
    if not isinstance(답, dict) or any(답.get(k) != v for k, v in 동일성.items()):
        raise ValueError("확인파일의 영상, 구간, 시트 또는 기준판이 지금과 다르다. 현재 시트를 다시 본다")
    항목 = 답.get("판정")
    if not isinstance(항목, dict) or set(항목) != set(질문):
        raise ValueError("지금 적용하는 질문 각각에 판정과 실제 관찰을 적어야 한다")
    재제작 = False
    for 번호, 값 in 항목.items():
        if not isinstance(값, dict) or 값.get("결과") not in ("충족", "무관", "다시"):
            raise ValueError(f"{번호} 결과는 충족, 무관, 다시 중 하나여야 한다")
        근거 = 값.get("관찰")
        if not isinstance(근거, str) or not 근거.strip():
            raise ValueError(f"{번호}에 실제 시각과 보인 동작 또는 이 컷에 해당하지 않는 이유를 적는다")
        if 번호 in ("컷", "연기", "LAB 뜻풀이") and 값["결과"] == "무관":
            raise ValueError("선택한 컷의 연출은 실제로 보고 판정한다")
        재제작 |= 값["결과"] == "다시"
    return 1 if 재제작 else 0


def 검사(편, 영상, 시작=0, 끝=None, 종류=None, 확인파일=None, 묶음="", 사람=False):
    편, 영상 = Path(편).resolve(), Path(영상).resolve()
    if not 편.is_dir() or not 영상.is_file():
        raise ValueError("편 폴더와 실제 받은 영상 파일이 있어야 한다")
    처음상태 = 영상.stat()
    본 = 받은뒤검사.살피기(영상)
    if isinstance(본, str):
        raise ValueError(본)
    끝 = 본["초"] if 끝 is None else 끝
    if (not all(math.isfinite(x) for x in (시작, 끝)) or not 0 <= 시작 < 끝 <= 본["초"] + 0.005
            or 끝 - 시작 > 30):
        raise ValueError("영상 안에서 30초 이내의 실제 시험 컷을 --시작, --끝으로 지정한다")
    기준 = 기준읽기(편, 종류)
    기준판 = 기준["기준판"]
    질문 = {"컷": "이 구간의 연기, 장면 연결, 전달하려는 뜻이 실제로 보이는가? 소리 지적은 원본을 들은 내용도 적는다."}
    for x in 기준["최근지적"]:
        질문[str(x["번호"])] = f'{x["이름"]} — {x["확인"]}'
    이전 = [f'#{x["번호"]} {x["이름"]}' for x in 기준.get("점검표", []) if str(x["번호"]) not in 질문]
    if 이전:
        질문["종전 지적"] = ("이전 지적 가운데 이 컷에 해당하는 번호와 화면이나 소리에서 확인한 시각을 적는다. "
                         "되풀이된 항목이 있으면 '다시'로 적는다. 해당하는 항목이 없으면 그 이유를 적는다.\n"
                         + "\n".join(이전))
    이력 = 기준.get("이력") or {}
    for x in 이력.get("줄", []) + 이력.get("넘김줄", []):
        질문[f'편별 {x["열쇠"]}'] = " ".join(x.get("할것") or [x["이름"]])
    if 종류 == "LAB" or 이력.get("길") == "LAB":
        질문["LAB 뜻풀이"] = "설명 글을 가리면 앞뒤 그림에서 인물의 행동이나 배울 뜻이 어떻게 달라지는가? 같은 그림에 글만 바뀌면 '다시'로 적는다."
        for x in (이력.get("LAB교훈") or {}).get("줄", [])[:3]:
            질문[x["id"]] = x["할것"]
    for x in 기준["만족사례"]["선택"]:
        질문[x["id"]] = f'승인한 범위와 실제 컷을 비교한다: {x["제목"]} ' + " ".join(x["적용"])
    영상지문 = 파일지문(영상)
    멎은때 = None
    if 사람:
        측정 = 받은뒤검사.사람재기(영상, 시작, 끝, 본["fps"])
        if 측정.get("사람검출") and (측정["멎은1.5초"] or 측정["판정"] not in ("-", "가까움 · 눈으로 판정")):
            멎은때 = (측정["멎은1.5초"] or [시작])[0]
        질문["연기"] = "카메라와 별개로 사람이 컷표에 적힌 행동을 하는가? 시각과 달라진 몸동작을 적는다."
        if not 측정.get("사람검출"):
            print("인물 위치나 움직임을 기계가 확정하지 못했다. 원본과 프레임 시트로 연기를 확인한다.", flush=True)
    질문지문 = hashlib.sha256(json.dumps(질문, sort_keys=True).encode()).hexdigest()
    동일성 = {"영상지문": 영상지문, "기준판": 기준판, "쓰는구간": [float(시작), float(끝)],
           "범위": 종류 or "편", "묶음": 묶음, "질문지문": 질문지문}
    열쇠 = hashlib.sha256(json.dumps(동일성, sort_keys=True).encode()).hexdigest()
    자리 = 편 / "첫컷검사" / 열쇠
    자리.mkdir(parents=True, exist_ok=True)
    시트, 양식, 기록 = (자리 / 이름 for 이름 in ("프레임.jpg", "확인용.json", "확인.json"))
    프레임 = 프레임시트(영상, 시작, 끝)
    동일성["시트지문"] = hashlib.sha256(프레임).hexdigest()
    if not 시트.is_file() or 파일지문(시트) != 동일성["시트지문"]:
        원자쓰기(시트, 프레임)
    지금상태 = 영상.stat()
    if (처음상태.st_size, 처음상태.st_mtime_ns) != (지금상태.st_size, 지금상태.st_mtime_ns):
        raise ValueError("검사하는 동안 영상이 바뀌었다. 받은 뒤 다시 검사한다")
    if 멎은때 is not None:
        print(f"첫 컷 재제작: {멎은때:g}초 부근 인물이 멈춘다(사람 움직임 {측정['사람']}). "
              f"연기 박자를 고쳐 이 판만 다시 받는다. 실제 프레임: {시트}", flush=True)
        return 1
    if 확인파일 is not None:
        답 = json읽기(Path(확인파일))
        결과 = 확인결과(답, 동일성, 질문)
        원자쓰기(기록, (json.dumps(답, ensure_ascii=False, indent=2) + "\n").encode())
    elif 기록.exists():
        결과 = 확인결과(json읽기(기록), 동일성, 질문)
    else:
        틀 = {**동일성, "영상": 영상.name, "질문": 질문, "판정": {k: {"결과": "", "관찰": ""} for k in 질문}}
        if not 양식.exists():
            원자쓰기(양식, (json.dumps(틀, ensure_ascii=False, indent=2) + "\n").encode())
        print(f"첫 컷 확인 대기. {시작:g}~{끝:g}초 시트(한 줄 1초, 왼쪽부터 1/8초 간격): {시트}", flush=True)
        print(f"실제로 시트와 원본을 보고 {양식}의 사본에 판정과 근거를 적는다. 같은 명령에 --확인파일 <사본>을 더한다.", flush=True)
        return 2
    print(f"첫 컷 {'재제작' if 결과 else '확인 완료'}: {영상.name} {시작:g}~{끝:g}초 · 기준 {기준판[:12]}", flush=True)
    return 결과


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("편", type=Path)
    p.add_argument("영상", type=Path)
    p.add_argument("--시작", type=float, default=0)
    p.add_argument("--끝", type=float)
    p.add_argument("--종류", choices=("LAB", "그래픽", "컷표영상"))
    p.add_argument("--확인파일", type=Path)
    p.add_argument("--사람", action="store_true", help="사람 컷의 전체 움직임과 1.5초 동안 굳은 구간을 잰다")
    p.add_argument("--묶음", default="", help="정식 내기에서 넘긴 꾸러미와 판 식별자")
    o = p.parse_args()
    try:
        return 검사(o.편, o.영상, o.시작, o.끝, o.종류, o.확인파일, o.묶음, o.사람)
    except (OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError) as e:
        print(f"첫 컷 확인을 마치지 못했다: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
