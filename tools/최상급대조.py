#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""최상급 대조 — 우리 편을 같은 분야 실제 최상급 광고 사이에 섞어 눈가림으로 줄 세운다(2026-11-18).

왜: 유호님 11-18 「최상급과 겨룰만한지 검수도 추가하자」. 슬롭 점검표 3번(「비싸 보이나, 이야기가 있나. 명품 광고 사이에 끼운 눈가림 시험으로 잰다」)에
    적혀만 있고 도구 · 비교 광고가 없었다. 지금까지의 검수는 거의 모두 「지적받은 흠을 다시 내지 않기」라서 흠이 없는 광고까지만 데려갔다.
    이 시험은 기준을 「최상급과 나란히 놓아도 꼴찌가 아닌가 · 우리만 AI로 보이지 않는가」로 올린다.

    python -I -X utf8 tools/최상급대조.py 판 <편 폴더> --우리 <최종.mp4 | 그림…> [--기준 <영상 | 그림>]… [--장 8] [--출력 <폴더>] [--씨 <수>]
    python -I -X utf8 tools/최상급대조.py 적기 <회차 폴더> --누가 <눈 이름> (--답 <답.md> | --비싸 C,A,B --다시 A,C,B --AI B|없음)
    python -I -X utf8 tools/최상급대조.py 보기 <편 폴더> [--최종 <최종.mp4>]

판: 우리와 기준 광고(최대 셋)를 한 편에 한 장씩 — 영상은 5%~95% 사이에서 고르게 --장 장(기본 8)을 뽑아 시간 순서로 4칸씩 묶고, 그림은 그대로 묶는다.
    판 이름(A · B · C · D)은 섞어서 붙이고 파일 이름 · 크기 표시 · 메타데이터는 남기지 않는다. 판 넷 = 카본(Gemini 웹) 한 대화 그림 넷 한도.
    --기준을 안 주면 컷표 「최상급」 줄의 「파일」을 쓴다(편 폴더 기준 · 절대 경로). 기준 광고 파일은 저장소 밖에 둔다(공개 저장소 — 남의 광고를 올리지 않는다).
    만드는 것(<출력>, 기본 <편>/검수/최상급_<YYYYMMDD-HHMM>): 판_A.jpg … · 질문.md(눈에게 그대로 줄 글) · 카본작업.json(아르곤웹.js 보내기 작업 파일) ·
    정답.json(어느 판이 우리인가 — 눈에게 주지 않는다).
적기: 눈 하나의 답을 받아 우리 판의 순위를 정답과 맞춰 기록.json에 더한다. --답을 주면 답 끝의 「순위: 비싸=…; 다시=…; AI=…」 줄을 읽는다.
    통과(눈 하나) = 비싸 보이는 순서와 다시 보고 싶은 순서에서 우리가 꼴찌가 아니고, 「AI · CG로 보이는 판」에 우리만 홀로 꼽히지 않았다.
    회차 통과 = 서로 답을 모르는 눈 둘 이상이 모두 통과. 못 넘으면 답의 4번(가장 모자란 것)을 고칠 것 후보로 유호님께 보인다.
보기: 편의 회차마다 눈 · 순위 · 통과를 적고, --최종을 주면 그 파일(해시)로 만든 회차가 통과했는지 끝 코드로 돌려준다(0 통과 · 1 못 넘음 · 2 기록 없음).
시점: 이미지 콘티 대표 장(그림 판 — 영상 크레딧 전에 가장 싸게 막는다)과 최종본(영상 판) 두 번. 광고 · 공모전 · 포트폴리오는 /마감작업이 최종본 회차를 본다.
"""
import hashlib, json, random, re, subprocess, sys, time
from pathlib import Path

영상꼴 = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
그림꼴 = {".png", ".jpg", ".jpeg", ".webp"}
판한도 = 4          # 카본(Gemini 웹) 한 대화 그림 넷(아르곤웹.js 머리 — 8장 대화는 두 번 다 남지 않았다)
칸폭 = 360          # 판 한 칸 긴 변 — 4칸 × 2줄이면 한 장이 1440 안팎(그림을 읽는 쪽이 줄이지 않는 크기)
질문글 = """너는 광고 회사의 크리에이티브 디렉터다. 판 {n}장({판들})은 서로 다른 광고 {n}편에서 고른 장면이다 — 판 하나가 광고 한 편이고, 한 판 안은 왼쪽 위부터 시간 순서다.
어느 판이 어느 회사 것인지는 모른다. 판만 보고, 겉치레 칭찬 없이 답해라. 판에 보이는 글자 · 로고로 회사를 짐작하지 말고 화면의 만듦새만 본다.

1. 비싸 보이는 순서 — 판 이름을 1등부터 줄 세우고, 판마다 한 줄 까닭(빛 · 색 · 구도 · 연기 · 미술 · 글자 가운데 무엇 때문인지).
2. 다시 보고 싶은 순서 — 1번과 따로 줄 세우고 판마다 한 줄 까닭.
3. 실제로 찍지 않고 AI · CG로 만든 것 같은 판 — 판 이름과 그렇게 보인 자리(몇째 칸, 무엇이). 없으면 「없음」.
4. 꼴찌 판이 1등 판을 따라가려면 가장 모자란 것 한 가지와 무엇을 바꾸면 되는지 한 줄.

답 맨 끝에는 아래 꼴 한 줄을 그대로 쓴다(판 이름만, 쉼표로):
순위: 비싸=<1등>,<2등>,…; 다시=<1등>,<2등>,…; AI=<판 이름들 또는 없음>
"""


def 오류(글):
    print(f"최상급대조: {글}", file=sys.stderr); sys.exit(3)


def 해시(p):
    h = hashlib.sha1()
    with open(p, "rb") as f:
        for 덩이 in iter(lambda: f.read(1 << 20), b""): h.update(덩이)
    return h.hexdigest()


def 길이(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except ValueError: 오류(f"영상 길이를 못 읽음: {p}")


def 영상장들(p, n):
    from PIL import Image
    import io
    d = 길이(p); 장들 = []
    for i in range(n):
        t = d * (0.05 + 0.90 * i / max(1, n - 1))
        r = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-ss", f"{t:.3f}", "-i", str(p), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
        if r.stdout: 장들.append(Image.open(io.BytesIO(r.stdout)).convert("RGB"))
    if not 장들: 오류(f"장면을 못 뽑음: {p}")
    return 장들


def 판짓기(장들, 이름, 밖):
    """장들을 4칸씩 줄로 묶고 위에 판 이름만 적는다(파일 이름 · 크기는 적지 않는다)."""
    from PIL import Image, ImageDraw, ImageFont
    칸들 = []
    for im in 장들:
        im = im.copy(); im.thumbnail((칸폭, 칸폭)); 칸들.append(im)
    w = max(c.width for c in 칸들); h = max(c.height for c in 칸들); 열 = min(4, len(칸들)); 행 = -(-len(칸들) // 열)
    머리 = 56; 틈 = 8
    판 = Image.new("RGB", (열 * w + (열 + 1) * 틈, 머리 + 행 * h + (행 + 1) * 틈), (32, 32, 32))
    for i, c in enumerate(칸들):
        x = 틈 + (i % 열) * (w + 틈) + (w - c.width) // 2; y = 머리 + 틈 + (i // 열) * (h + 틈) + (h - c.height) // 2
        판.paste(c, (x, y))
    try: 글꼴 = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 36)
    except OSError: 글꼴 = ImageFont.load_default()
    ImageDraw.Draw(판).text((틈 + 4, 10), f"{이름}", fill=(240, 240, 240), font=글꼴)
    판.save(밖, quality=90)   # PIL은 원본 EXIF를 옮기지 않는다


def 재료(인자, 이름):
    """한 편의 재료 → (종류, 장들, 출처 목록)."""
    from PIL import Image
    ps = [Path(x) for x in 인자]
    for p in ps:
        if not p.exists(): 오류(f"{이름} 파일이 없다: {p}")
    영상 = [p for p in ps if p.suffix.lower() in 영상꼴]; 그림 = [p for p in ps if p.suffix.lower() in 그림꼴]
    if 영상 and 그림 or len(영상) > 1: 오류(f"{이름}은 영상 하나 또는 그림 여럿이다: {' · '.join(map(str, ps))}")
    if not 영상 and not 그림: 오류(f"{이름}에 영상 · 그림이 없다")
    return ("영상", 영상[0]) if 영상 else ("그림", 그림)


def 판(argv):
    a = 인자들(argv, 여럿={"--우리", "--기준"})
    if not a["_"]: 오류("판 <편 폴더> --우리 <최종.mp4 | 그림…> [--기준 <영상 | 그림>]…")
    편 = Path(a["_"][0]).resolve()
    if not 편.is_dir(): 오류(f"편 폴더가 아니다: {편}")
    if not a.get("--우리"): 오류("--우리가 없다")
    n = int(a.get("--장", 8)); 씨 = int(a.get("--씨", int(time.time())))
    기준들 = a.get("--기준") or []
    if not 기준들:
        표경로 = 편 / "컷표.json"
        표 = json.loads(표경로.read_text(encoding="utf-8")) if 표경로.exists() else {}
        for x in 표.get("최상급") or []:
            if isinstance(x, dict) and x.get("파일"):
                p = Path(x["파일"]); 기준들.append(str(p if p.is_absolute() else 편 / p))
    if len(기준들) < 2: 오류(f"기준 광고가 {len(기준들)}편이다 — 둘 이상(--기준 또는 컷표 「최상급」의 「파일」). 받기 전에 파일 이름 · 출처 · 크기를 유호님께 여쭙는다")
    if 1 + len(기준들) > 판한도: 오류(f"판은 {판한도}장까지다(카본 한 대화 그림 넷) — 기준은 {판한도 - 1}편까지")
    우리 = 재료(a["--우리"], "우리")
    편들 = [("우리", 우리)] + [(f"기준{i + 1}", 재료([x], f"기준{i + 1}")) for i, x in enumerate(기준들)]
    random.Random(씨).shuffle(편들)
    밖 = Path(a.get("--출력") or 편 / "검수" / f"최상급_{time.strftime('%Y%m%d-%H%M')}"); 밖.mkdir(parents=True, exist_ok=True)
    정답 = {"편": str(편), "만든때": time.strftime("%Y-%m-%d %H:%M"), "씨": 씨, "장": n, "판": {}}
    판들 = []
    for i, (누구, (종류, 것)) in enumerate(편들):
        이름 = "ABCD"[i]
        if 종류 == "영상": 장들 = 영상장들(것, n); 출처 = [str(것)]
        else:
            from PIL import Image
            장들 = [Image.open(p).convert("RGB") for p in 것]; 출처 = [str(p) for p in 것]
        파일 = 밖 / f"판_{이름}.jpg"; 판짓기(장들, 이름, 파일); 판들.append(파일.name)
        정답["판"][이름] = {"누구": 누구, "종류": 종류, "출처": 출처, "해시": [해시(p) for p in 출처]}
    (밖 / "정답.json").write_text(json.dumps(정답, ensure_ascii=False, indent=1), encoding="utf-8")
    (밖 / "질문.md").write_text(질문글.format(n=len(판들), 판들=" · ".join(판들)), encoding="utf-8")
    (밖 / "카본작업.json").write_text(json.dumps({"files": 판들, "promptFile": "질문.md", "out": "답_카본.md"}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"판 {len(판들)}장 → {밖}")
    print(f"  눈 하나: node tools/아르곤웹.js 보내기 \"{밖 / '카본작업.json'}\" --여러줄  → 답_카본.md")
    print(f"  눈 둘: 이 대화 맥락이 없는 새 하위 에이전트에게 질문.md와 판_*.jpg만 주고(정답.json은 주지 않는다) 답을 답_<눈>.md로")
    print(f"  적기: python -I -X utf8 tools/최상급대조.py 적기 \"{밖}\" --누가 카본 --답 \"{밖 / '답_카본.md'}\"")
    return 0


_순위줄 = re.compile(r"순위\s*[:：]\s*비싸\s*=\s*([A-D ,·]+?)\s*[;；]\s*다시\s*=\s*([A-D ,·]+?)\s*[;；]\s*AI\s*=\s*([A-D ,·]+|없음)", re.I)


def 줄세움(글):
    return [x for x in re.split(r"[\s,·]+", 글.strip().upper()) if x]


def 판정(정답, 비싸, 다시, ai):
    우리 = next(k for k, v in 정답["판"].items() if v["누구"] == "우리"); n = len(정답["판"])
    for 이름, 줄 in (("비싸", 비싸), ("다시", 다시)):
        if sorted(줄) != sorted(정답["판"]): 오류(f"{이름} 순서가 판 {n}장을 한 번씩 다 세우지 않았다: {','.join(줄)}")
    등비싸 = 비싸.index(우리) + 1; 등다시 = 다시.index(우리) + 1
    우리만AI = ai == [우리]
    통과 = 등비싸 < n and 등다시 < n and not 우리만AI
    까닭 = [글 for 글, 걸 in ((f"비싸 보이는 순서 꼴찌({등비싸}/{n})", 등비싸 == n), (f"다시 보고 싶은 순서 꼴찌({등다시}/{n})", 등다시 == n),
                              ("우리 판만 AI · CG로 꼽힘", 우리만AI)) if 걸]
    return dict(우리=우리, 비싸=f"{등비싸}/{n}", 다시=f"{등다시}/{n}", AI=ai or ["없음"], 통과=통과, 까닭=까닭)


def 적기(argv):
    a = 인자들(argv)
    if not a["_"] or not a.get("--누가"): 오류("적기 <회차 폴더> --누가 <눈 이름> (--답 <답.md> | --비싸 … --다시 … --AI …)")
    회차 = Path(a["_"][0]); 정답 = json.loads((회차 / "정답.json").read_text(encoding="utf-8"))
    if a.get("--답"):
        글 = Path(a["--답"]).read_text(encoding="utf-8"); m = None
        for m in _순위줄.finditer(글): pass   # 마지막 순위 줄
        if not m: 오류(f"답에 「순위: 비싸=…; 다시=…; AI=…」 줄이 없다 — 답을 읽고 --비싸 · --다시 · --AI로 적는다: {a['--답']}")
        비싸, 다시, ai = 줄세움(m.group(1)), 줄세움(m.group(2)), ([] if m.group(3).strip() == "없음" else 줄세움(m.group(3)))
    else:
        if not (a.get("--비싸") and a.get("--다시") and a.get("--AI")): 오류("--답이 없으면 --비싸 · --다시 · --AI를 다 준다")
        비싸, 다시 = 줄세움(a["--비싸"]), 줄세움(a["--다시"]); ai = [] if a["--AI"].strip() == "없음" else 줄세움(a["--AI"])
    결과 = 판정(정답, 비싸, 다시, ai)
    기록경로 = 회차 / "기록.json"
    기록 = json.loads(기록경로.read_text(encoding="utf-8")) if 기록경로.exists() else {"눈": []}
    기록["눈"] = [x for x in 기록["눈"] if x.get("누가") != a["--누가"]] + [dict(누가=a["--누가"], 때=time.strftime("%Y-%m-%d %H:%M"), 답=a.get("--답"), **결과)]
    기록["통과"] = len(기록["눈"]) >= 2 and all(x["통과"] for x in 기록["눈"])
    기록경로.write_text(json.dumps(기록, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{a['--누가']}: 비싸 {결과['비싸']} · 다시 {결과['다시']} · AI {'·'.join(결과['AI'])} → {'통과' if 결과['통과'] else '못 넘음 — ' + ' · '.join(결과['까닭'])}")
    print(f"회차: 눈 {len(기록['눈'])} · {'통과' if 기록['통과'] else ('눈이 둘 이상 필요' if len(기록['눈']) < 2 else '못 넘음')}")
    return 0 if 결과["통과"] else 1


def 보기(argv):
    a = 인자들(argv)
    if not a["_"]: 오류("보기 <편 폴더> [--최종 <최종.mp4>]")
    편 = Path(a["_"][0]); 찾을 = 해시(a["--최종"]) if a.get("--최종") else None; 맞은 = []
    for 회차 in sorted((편 / "검수").glob("최상급_*")):
        정답경로 = 회차 / "정답.json"
        if not 정답경로.exists(): continue
        정답 = json.loads(정답경로.read_text(encoding="utf-8")); 우리 = next(v for v in 정답["판"].values() if v["누구"] == "우리")
        기록 = json.loads((회차 / "기록.json").read_text(encoding="utf-8")) if (회차 / "기록.json").exists() else {"눈": [], "통과": False}
        눈 = " / ".join(f"{x['누가']} 비싸 {x['비싸']} 다시 {x['다시']}{' ✓' if x['통과'] else ' ✗'}" for x in 기록["눈"]) or "답 없음"
        print(f"{회차.name} · {우리['종류']} · {눈} → {'통과' if 기록.get('통과') else '아직'}")
        if 찾을 and 찾을 in 우리["해시"]: 맞은.append(기록.get("통과", False))
    if not 찾을: return 0
    if not 맞은: print("이 최종본으로 만든 최상급 대조 회차가 없다"); return 2
    return 0 if any(맞은) else 1


def 인자들(argv, 여럿=frozenset()):
    o = {"_": []}; i = 0
    while i < len(argv):
        x = argv[i]
        if x.startswith("--"):
            값들 = []
            while i + 1 < len(argv) and not argv[i + 1].startswith("--"): 값들.append(argv[i + 1]); i += 1
            if x in 여럿: o.setdefault(x, []).extend(값들)
            else: o[x] = " ".join(값들)
        else: o["_"].append(x)
        i += 1
    return o


def main(argv):
    if not argv or argv[0] not in ("판", "적기", "보기"): print(__doc__); return 3
    return {"판": 판, "적기": 적기, "보기": 보기}[argv[0]](argv[1:])


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
