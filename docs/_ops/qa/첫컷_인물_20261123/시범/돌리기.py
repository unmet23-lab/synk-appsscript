"""시범 한 판 — 받은 뒤 검사의 눈일감 · 눈하나로 컷 하나의 첫컷검사를 부른다(다른 판은 모두 걸림 없는 것으로 둔다). GPT 한 판에 5~14분.

python -X utf8 docs/_ops/qa/첫컷_인물_20261123/시범/돌리기.py <.tmp/첫컷컷끼리_시범/편> <컷>
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "tools"))
import 받은뒤검사 as R  # noqa: E402

편 = Path(sys.argv[1]).resolve()
seq = json.loads((편 / "컷표.json").read_text(encoding="utf-8"))
받음 = 편 / "받음"
모든판, _ = R.판표(seq, 편 / "꾸러미")
판찾기 = {p["id"]: p for p in 모든판}
결과판 = {p["id"]: {"컷": p["컷"], "파일": [{"파일": f'{p["id"]}.mp4', "걸림": [], "확인": [], "주의": []}]}
         for p in 모든판 if (받음 / f'{p["id"]}.mp4').exists()}
for x in R.눈일감(편, seq, 받음, 결과판, sys.argv[2].split(","), 판찾기):
    print("일:", x["줄"]["cut"], {k: Path(v).name for k, v in x["배역판"].items()}, flush=True)
    print(json.dumps(R.눈하나(편, 편 / "컷표.json", 받음, x), ensure_ascii=False, indent=1), flush=True)
