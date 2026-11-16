"""
꿈 무대(2026-11-17) — 지시문/**/*.txt를 지시문_모음.md 한 파일로 모은다.
qa 폴더의 .txt는 git이 무시하므로(.gitignore `**/qa/*/**/*.txt`) 원문을 저장소에 남기려고 쓴다.

    python -I -X utf8 지시문모음.py          (이 폴더에서)
"""
import glob
import io
import os

머리 = (
    "이 폴더의 `지시문/**/*.txt`는 git이 무시한다(`.gitignore`의 `**/qa/*/**/*.txt`). "
    "그래서 원문을 이 파일에 그대로 모아 둔다. 다시 쓸 때는 아래 글을 같은 경로의 `.txt`로 되살린다. "
    "지시문을 고치면 `python -I -X utf8 지시문모음.py`로 이 파일을 다시 만든다."
)
paths = sorted(glob.glob("지시문/**/*.txt", recursive=True))
out = ["# 꿈 무대 — 지시문 모음 (2026-11-17)", "", 머리, ""]
for p in paths:
    글 = io.open(p, encoding="utf-8").read().rstrip("\n")
    out += ["## " + p.replace(os.sep, "/"), "", "```text", 글, "```", ""]
io.open("지시문_모음.md", "w", encoding="utf-8", newline="\n").write("\n".join(out))
print(len(paths), "개")
