# 인스타 올리기(연습용) — 사용: python 인스타_올리기.py <글 파일>
import sys, pathlib, datetime

if len(sys.argv) < 2 or not pathlib.Path(sys.argv[1]).exists():
    print("사용: python 인스타_올리기.py <글 파일>")
    sys.exit(2)
글 = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
기록 = pathlib.Path.cwd() / "올린기록.txt"
with 기록.open("a", encoding="utf-8") as f:
    f.write(f"[{datetime.datetime.now().isoformat(timespec='seconds')}] 올림\n{글}\n---\n")
print("인스타에 올렸어요:", pathlib.Path(sys.argv[1]).name)
