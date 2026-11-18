"""실제 첫 시험 컷과 현재 제작 기준을 연결한다. 모델에 관계없이 제작자가 같은 명령을 쓴다.

python -X utf8 tools/첫컷검사.py <편폴더> <영상> [--시작 초 --끝 초] [--종류 LAB|그래픽|컷표영상] [--컷표 파일]
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


class 입력변경(ValueError):
    pass


def 변경재검(작업, *인자):
    try:
        return 작업(*인자)
    except 입력변경:
        # 동시 저장으로 읽기가 흔들릴 때만 로컬 검사를 한 번 새로 시작한다.
        return 작업(*인자)


class 입력창:
    """한 번의 검사에서 선택한 파일별 원본 SHA를 대조한다. 마지막 대조 뒤의 편집은 다음 호출에서 확인한다."""
    def __init__(self, 경로들):
        self.경로들 = list(dict.fromkeys(경로들))
        self.처음 = self.상태()
        self.글 = {p: p.read_bytes() for p, s in self.처음.items()
                  if s is not None and s[2] <= 1024 * 1024 and p.suffix.lower() in (".json", ".md", ".txt")}
        self.원본 = {p: hashlib.sha256(self.글[p]).hexdigest() if p in self.글 else 파일지문(p)
                   for p, s in self.처음.items() if s is not None}

    def 상태(self):
        상태 = {}
        for p in self.경로들:
            try:
                s = p.stat()
                # Windows의 ctime은 생성 시각일 수 있다. 파일 ID·크기·mtime과 함께 대조한다.
                상태[p] = (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
            except FileNotFoundError:
                상태[p] = None
        return 상태

    def 읽기(self, p):
        if p in self.글:
            return self.글[p]
        내용 = p.read_bytes()
        if hashlib.sha256(내용).hexdigest() != self.원본.get(p):
            raise 입력변경(f"원문을 읽는 동안 입력이 바뀌었다: {p.name}")
        return 내용

    def 지문(self, p):
        if p not in self.원본:
            raise FileNotFoundError(f"검사할 입력 파일이 없다: {p}")
        return self.원본[p]

    def 확인(self):
        try:
            같은내용 = all(파일지문(p) == 처음 for p, 처음 in self.원본.items())
        except FileNotFoundError:
            같은내용 = False
        if not 같은내용 or self.상태() != self.처음:
            raise 입력변경("검사하는 동안 컷 지시나 입력 파일이 바뀌었다. 현재 주문으로 다시 검사한다")


def 편입력(편, 컷표):
    현행 = 편 / "컷표.json"
    후보 = [컷표] if 컷표 else [현행] if 현행.is_file() else [현행, 편 / "컷순서.json"]
    return [*후보, 편 / "기획.md"]


def 편지시(편, 컷표, 창=None):
    """편 자체와 실제 제작 주문을 식별한다. 영상이나 확인 파일을 복사해도 다른 편의 승인이 되지 않는다."""
    자체검사 = 창 is None
    창 = 창 or 입력창(편입력(편, 컷표))
    원문 = {}
    for 표 in ([컷표] if 컷표 else [편 / "컷표.json", 편 / "컷순서.json"]):
        if 표 not in 창.처음:
            continue
        try:
            원문[표.relative_to(편).as_posix() if 표.is_relative_to(편) else str(표)] = json.loads(창.읽기(표).decode("utf-8-sig"))
            break
        except FileNotFoundError:
            if 표 == 컷표:
                raise ValueError(f"지정한 컷표를 찾을 수 없다: {표}")
            if 표.name == "컷표.json" and 편 / "컷순서.json" not in 창.처음:
                raise 입력변경("입력을 고르는 동안 컷표가 바뀌었다")
    인계가능 = any(원문.values())
    try:
        글 = 창.읽기(편 / "기획.md").decode("utf-8-sig")
    except FileNotFoundError:
        pass
    else:
        원문["기획.md"] = 창.지문(편 / "기획.md")
        인계가능 = 인계가능 or bool(글.strip())
    폴더 = 편.stat()
    위치 = [os.path.normcase(str(편)), 폴더.st_dev, 폴더.st_ino]
    if 인계가능:
        # 같은 저장소 안에서 작업 사본을 옮길 때는 편과 주문이 그대로면 같은 확인을 쓴다.
        환경 = {k: v for k, v in os.environ.items() if k.upper() not in {"GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR"}}
        try:
            git = subprocess.run(["git", "-C", str(편), "rev-parse", "--path-format=absolute",
                                  "--git-common-dir", "--show-toplevel"], env=환경, capture_output=True, timeout=30, check=True)
            공용, 뿌리 = map(Path, git.stdout.decode("utf-8").splitlines())
            상대편 = 편.relative_to(뿌리.resolve(strict=True))
            위치 = [os.path.normcase(str(공용.resolve(strict=True))), os.path.normcase(str(상대편))]
        except (OSError, ValueError, subprocess.SubprocessError):
            pass  # Git 정보를 확인할 수 없으면 이 폴더 안에서만 확인을 이어받는다.
    식별 = ["편 주문 3", 위치, 원문]
    지문 = hashlib.sha256(json.dumps(식별, sort_keys=True).encode()).hexdigest()
    if 자체검사:
        창.확인()
    return 지문, list(원문)


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
        raise ValueError("확인파일의 편과 컷 지시, 영상, 구간, 시트 또는 기준판이 지금과 다르다. 현재 시트를 다시 본다")
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


def 검사(편, 영상, 시작=0, 끝=None, 종류=None, 확인파일=None, 묶음="", 사람=False, 컷표=None, 예상편지시=None):
    편, 영상 = Path(편).resolve(), Path(영상).resolve()
    if not 편.is_dir() or not 영상.is_file():
        raise ValueError("편 폴더와 실제 받은 영상 파일이 있어야 한다")
    컷표 = Path(컷표).resolve() if 컷표 is not None else None
    창 = 입력창([*편입력(편, 컷표), 영상])
    편지문, 출처 = 편지시(편, 컷표, 창)
    if 예상편지시 is not None and 편지문 != 예상편지시:
        raise ValueError("꾸러미가 시작한 뒤 편의 주문이 바뀌었다. 현재 꾸러미로 다시 검사한다")
    처음상태 = 영상.stat()
    본 = 받은뒤검사.살피기(영상)
    if isinstance(본, str):
        raise ValueError(본)
    끝 = 본["초"] if 끝 is None else 끝
    if (not all(math.isfinite(x) for x in (시작, 끝)) or not 0 <= 시작 < 끝 <= 본["초"] + 0.005
            or 끝 - 시작 > 30):
        raise ValueError("영상 안에서 30초 이내의 실제 시험 컷을 --시작, --끝으로 지정한다")
    기준 = 기준읽기(컷표 or 편, 종류)
    기준판 = 기준["기준판"]
    주문 = ", ".join(출처) or "이번 편의 제작 요청"
    질문 = {"컷": f"{주문}에서 이 구간에 지시한 장면과 실제로 보인 행동을 시각과 함께 대조한다. 소리 지적은 원본을 듣고 적는다."}
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
    영상지문 = 창.지문(영상)
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
           "범위": 종류 or "편", "묶음": 묶음, "질문지문": 질문지문, "편지시지문": 편지문}
    열쇠 = hashlib.sha256(json.dumps(동일성, sort_keys=True).encode()).hexdigest()
    자리 = 편 / "첫컷검사" / 열쇠
    자리.mkdir(parents=True, exist_ok=True)
    시트, 양식, 기록 = (자리 / 이름 for 이름 in ("프레임.jpg", "확인용.json", "확인.json"))
    프레임 = 프레임시트(영상, 시작, 끝)
    동일성["시트지문"] = hashlib.sha256(프레임).hexdigest()
    if not 시트.is_file() or 파일지문(시트) != 동일성["시트지문"]:
        원자쓰기(시트, 프레임)
    답경로 = Path(확인파일) if 확인파일 is not None else 기록 if 기록.exists() else None
    if 답경로 is not None and 멎은때 is None:
        답 = json읽기(답경로)
        결과 = 확인결과(답, 동일성, 질문)
    지금상태 = 영상.stat()
    창.확인()
    if (처음상태.st_size, 처음상태.st_mtime_ns) != (지금상태.st_size, 지금상태.st_mtime_ns):
        raise ValueError("검사하는 동안 영상이 바뀌었다. 받은 뒤 다시 검사한다")
    if 멎은때 is not None:
        print(f"첫 컷 재제작: {멎은때:g}초 부근 인물이 멈춘다(사람 움직임 {측정['사람']}). "
              f"연기 박자를 고쳐 이 판만 다시 받는다. 실제 프레임: {시트}", flush=True)
        return 1
    if 확인파일 is not None:
        원자쓰기(기록, (json.dumps(답, ensure_ascii=False, indent=2) + "\n").encode())
    elif 답경로 is None:
        틀 = {**동일성, "영상": 영상.name, "질문": 질문,
             "판정안내": "질문 중 일부라도 해당하면 그 부분을 보고 충족 또는 다시를 고른다. 전부 해당하지 않을 때만 무관으로 적는다.",
             "판정": {k: {"결과": "", "관찰": ""} for k in 질문}}
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
    p.add_argument("--컷표", type=Path, help="정식 꾸러미 등에서 선택한 실제 컷표 파일")
    p.add_argument("--예상편지시", help="꾸러미가 모든 검사 구간에 공통으로 적용하는 주문 지문")
    p.add_argument("--사람", action="store_true", help="사람 컷의 전체 움직임과 1.5초 동안 굳은 구간을 잰다")
    p.add_argument("--묶음", default="", help="정식 내기에서 넘긴 꾸러미와 판 식별자")
    o = p.parse_args()
    try:
        return 변경재검(검사, o.편, o.영상, o.시작, o.끝, o.종류, o.확인파일, o.묶음, o.사람, o.컷표, o.예상편지시)
    except (OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError) as e:
        print(f"첫 컷 확인을 마치지 못했다: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
