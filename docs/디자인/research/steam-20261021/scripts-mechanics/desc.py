# -*- coding: utf-8 -*-
"""상점 appdetails의 설명을 읽기 좋게 출력한다.
사용: python -I -X utf8 desc.py <raw_dir> <max_chars> <appid> [appid...]
"""
import json, sys, re, html, pathlib

def strip(h):
    h = re.sub(r"<br\s*/?>", "\n", h or "", flags=re.I)
    h = re.sub(r"</(p|li|h\d)>", "\n", h, flags=re.I)
    h = re.sub(r"<li>", "• ", h, flags=re.I)
    h = re.sub(r"<[^>]+>", "", h)
    h = html.unescape(h)
    h = re.sub(r"[ \t]+", " ", h)
    h = re.sub(r"\n\s*\n+", "\n", h)
    return h.strip()

def main():
    raw = pathlib.Path(sys.argv[1]); mx = int(sys.argv[2])
    for a in sys.argv[3:]:
        fp = raw / "details" / f"{a}.json"
        if not fp.exists():
            print(f"### {a}: (no details yet)"); continue
        d = json.loads(fp.read_text(encoding="utf-8")).get(a, {})
        if not d.get("success"):
            print(f"### {a}: success=false"); continue
        dd = d["data"]
        genres = ",".join(g.get("description", "") for g in dd.get("genres", []) or [])
        print(f"### {a} {dd.get('name')} | {dd.get('release_date')} | {genres} | dev={dd.get('developers')} | KO={'Korean' in (dd.get('supported_languages') or '')}")
        print("SHORT:", strip(dd.get("short_description")))
        print("ABOUT:", strip(dd.get("about_the_game"))[:mx])
        print()

if __name__ == "__main__":
    main()
