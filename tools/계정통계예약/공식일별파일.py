"""공식 통계 파일과 확인한 소유자 정보를 Workspace 수집용 JSON으로 변환한다.

python -X utf8 tools/계정통계예약/공식일별파일.py <확인.json>
출력 목록은 원본 파일과 같은 폴더에 둔다. 원격 요청은 계정통계수집.cjs가 맡는다.
"""
import csv
import hashlib
import io
import json
import re
import sys
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

SOURCES = {
    "substack-traffic": (
        ("Date", "Views"), {"Views": "views"}, "Substack 총 트래픽", "공식 파일의 일별 조회수(이메일 포함)"
    ),
    "douyin-posts": (
        ("日期", "投稿量", "总播放量", "总点赞量", "总分享量", "总评论量", "5秒完播率", "2秒跳出率", "封面点击率", "平均播放时长"),
        {"投稿量": "postsPublished", "总播放量": "views", "总点赞量": "likes", "总分享量": "shares", "总评论量": "comments"},
        "抖音创作者中心", "短视频 · 공식 일별 통계"
    ),
    "douyin-followers": (
        ("日期", "总粉丝量", "粉丝净增", "吸粉量", "脱粉量", "回访粉丝量"),
        {"吸粉量": "followersGained", "脱粉量": "followersLost"}, "抖音创作者中心", "공식 일별 팔로워 유입과 이탈"
    ),
}
MAX_FILE = 10 * 1024 * 1024
MAX_ROWS = 200


def day(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("날짜는 YYYY-MM-DD 형식이어야 합니다.")
    return date.fromisoformat(value)


def account_source(meta, registry):
    key = meta["format"]
    account = registry[meta["accountId"]]
    handle = account["handle"]
    if not handle or meta["observedHandle"] != handle:
        raise ValueError("화면에서 확인한 소유자가 원장과 다릅니다.")
    if key == "substack-traffic" and account["platform"] == "substack":
        route = urlsplit(account.get("publicUrl") or account["editorUrl"])
        host = route.hostname
        if route.scheme != "https" or host != handle or not host.endswith(".substack.com"):
            raise ValueError("발행물 주소와 소유자를 확인해 주세요.")
        url = f"https://{host}/publish/stats/traffic"
    elif key in ("douyin-posts", "douyin-followers") and account["platform"] == "douyin":
        url = "https://creator.douyin.com/creator-micro/data-center/operation"
    else:
        raise ValueError("이 계정에서 확인된 내보내기 형식이 아닙니다.")
    if meta["sourceUrl"] != url:
        raise ValueError("확인한 통계 화면의 주소가 다릅니다.")
    return key, handle


def file_rows(raw, kind):
    if kind == "substack-traffic":
        reader = csv.reader(io.StringIO(raw.decode("utf-8-sig"), newline=""), strict=True)
        return bounded_rows(reader)
    from openpyxl import load_workbook
    stream = io.BytesIO(raw)
    with zipfile.ZipFile(stream) as archive:
        if sum(part.file_size for part in archive.infolist()) > MAX_FILE * 4:
            raise ValueError("통계 파일을 펼친 크기가 한도를 넘습니다.")
    stream.seek(0)
    book = load_workbook(stream, read_only=True, data_only=False)
    try:
        if len(book.worksheets) != 1:
            raise ValueError("확인한 양식은 시트가 하나인 통계 파일입니다.")
        sheet = book.worksheets[0]
        sheet.reset_dimensions()
        return bounded_rows(sheet.values)
    finally:
        book.close()


def bounded_rows(reader):
    rows = []
    for row in reader:
        if not row or all(cell is None or cell == "" for cell in row):
            continue
        if len(rows) >= MAX_ROWS + 1 or len(row) > 32:
            raise ValueError("통계 파일의 행 또는 열 수가 확인한 범위를 넘습니다.")
        rows.append(row)
    return rows


def observations(rows, kind, start, end, through):
    header, columns, title, description = SOURCES[kind]
    if not rows or tuple(rows[0]) != header:
        raise ValueError("공식 파일의 열 이름과 순서가 달라졌습니다.")
    seen, result = set(), []
    for line in rows[1:]:
        if kind != "substack-traffic" and len(line) < len(header):
            # XLSX에서는 행 끝의 빈 셀이 파일에서 통째로 생략될 수 있다.
            line = list(line) + [None] * (len(header) - len(line))
        if len(line) != len(header):
            raise ValueError("날짜 행의 형식이 다릅니다.")
        raw_date = line[0]
        if kind != "substack-traffic" and isinstance(raw_date, date):
            if isinstance(raw_date, datetime) and (raw_date.hour or raw_date.minute or raw_date.second or raw_date.microsecond):
                raise ValueError("일별 통계에 날짜 이외의 시각이 있습니다.")
            raw_date = raw_date.strftime("%Y-%m-%d")
        elif kind == "substack-traffic" and isinstance(raw_date, str):
            raw_date = raw_date.replace("/", "-")
        current = day(raw_date)
        if current in seen or not start <= current <= end:
            raise ValueError("같은 날짜가 두 번 있거나 선택한 기간 밖의 날짜가 있습니다.")
        seen.add(current)
        metrics = {}
        for source, field in columns.items():
            value = line[header.index(source)]
            if value in (None, "", "-"):
                continue
            if not re.fullmatch(r"[0-9]{1,16}", str(value)) or int(value) > 2**53 - 1:
                raise ValueError(f"{source} 열에 정확한 정수가 필요합니다.")
            metrics[field] = int(value)
        if not metrics or current > through:
            continue
        labels = {"screenTitle": title, "periodLabel": description,
                  "metricLabels": {field: name for name, field in columns.items()}}
        if kind == "substack-traffic":
            labels["selectedRange"] = raw_date
        else:
            labels["timeZone"] = "Asia/Shanghai"
        result.append({"kind": "account-period", "period": {"start": raw_date, "end": raw_date},
                       "metrics": metrics, "labels": labels})
    if not result or len(result) > MAX_ROWS:
        raise ValueError("한 묶음에는 완료된 날짜의 관측이 1~200행 있어야 합니다.")
    return result


def convert(metadata_path):
    meta = json.loads(metadata_path.read_text(encoding="utf-8-sig"))
    registry = Path(__file__).resolve().parents[2] / "docs/마케팅/sns-계정.json"
    kind, handle = account_source(meta, json.loads(registry.read_bytes())["accounts"])
    name = meta["evidenceFile"]
    if not isinstance(name, str) or not name or name in (".", "..") or any(c in name for c in "/\\:"):
        raise ValueError("같은 폴더의 원본 파일 이름을 지정해 주세요.")
    base = metadata_path.resolve().parent
    source = (base / name).resolve(strict=True)
    if source.parent != base or source == metadata_path.resolve():
        raise ValueError("원본과 확인 파일의 위치를 다시 확인해 주세요.")
    with source.open("rb") as stream:
        raw = stream.read(MAX_FILE + 1)
    digest = hashlib.sha256(raw).hexdigest()
    if not 0 < len(raw) <= MAX_FILE or digest != meta["evidenceSha256"]:
        raise ValueError("원본 파일의 크기 또는 내려받을 때 기록한 SHA-256이 다릅니다.")
    observed = datetime.fromisoformat(meta["observedAt"].replace("Z", "+00:00"))
    if observed.utcoffset() is None:
        raise ValueError("확인 시각에는 시간대가 있어야 합니다.")
    start, end, through = (day(meta[k]) for k in ("start", "end", "completeThrough"))
    # 서브스택 CSV는 시간대를 표시하지 않는다. 별도로 확인한 마지막 완료일까지만 사용한다.
    observed_day = observed.date()
    if kind.startswith("douyin-"):
        observed_day = observed.astimezone(timezone(timedelta(hours=8))).date()
    if not start <= through <= end or through >= observed_day:
        raise ValueError("플랫폼에서 완료된 마지막 날짜를 다시 확인해 주세요.")
    envelope = {"sourceType": "official-export", "sourceUrl": meta["sourceUrl"],
                "observedAt": meta["observedAt"], "identity": {"accountId": meta["accountId"], "handle": handle},
                "evidenceSha256": digest, "exportFormat": "csv" if kind == "substack-traffic" else "xlsx",
                "observations": observations(file_rows(raw, kind), kind, start, end, through)}
    return {"version": 1, "batches": [{"accountId": meta["accountId"], "evidenceFile": name, "envelope": envelope}]}


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("확인 JSON 파일 하나를 지정해 주세요.")
        print(json.dumps(convert(Path(sys.argv[1])), ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError, TypeError, ImportError, zipfile.BadZipFile, csv.Error) as error:
        sys.exit(f"공식 파일을 변환하지 못했습니다. {error}")
