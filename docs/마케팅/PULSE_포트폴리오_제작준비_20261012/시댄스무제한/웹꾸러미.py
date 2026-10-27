# PULSE 포트폴리오 시댄스 2.5 1일 무제한 — 여러 편을 한 순서표로 묶는 웹 꾸러미(2026-10-28).
#   python -X utf8 웹꾸러미.py          → synk-vendor/pulse-seedance-day-20261028/웹올리기/<순번>_<판>/ · 순서표.html · _순서.json
#   python -X utf8 웹꾸러미.py --보기 p11-07-08   → 그 판의 지시문만 찍는다
# 편마다 지시문 원천은 video/<편>/지시문/영상_시댄스웹.json(아래 「편」 표). 매진 임박은 이미 만든 웹올리기_v5 폴더를 그대로 옮긴다.
# 무제한은 웹에서 사람이 한 판씩 누르는 것만 허용된다(자동화 금지 — 결정 10-26) — 이 도구는 폴더와 순서표만 만들고 누르지 않는다.
import html, json, os, re, shutil, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.join(os.path.dirname(HERE), "video")
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/웹올리기"
HS = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/영상/웹올리기_v5"
TOKEN1, TOKEN2 = "@이미지 1", "@이미지 2"   # 한국어 화면의 업로드 이름(영어 화면은 @Image 1) — LAB 굽기 시트와 같다

# 굽는 차례 — 짧은 편부터 끝까지 마쳐 하루가 모자라도 완성 편이 남게 한다. 「시험」은 맨 앞에서 길을 확인하는 판.
PIECES = [  # (편, 원천 폴더) — 매진 임박(hs)은 따로
    ("p11", "pet-ad-20261026"),
    ("p2", "mens-fragrance-20261026"),
    ("p12", "comedy-montage-20261026"),
    ("p5", "sports-manifesto-20261026"),
    ("p4", "fashion-film-20261026"),
]
# 첫 판: 매진 임박 대사 컷 · 두 샷 묶음 · 끝 그림 판 · 첫 화면 뒤 비켜 돌았다 찾는 카메라(12번) · 거꾸로 뒤집힌 얼굴(5번 9행)
TESTS = ["hs-S07", "p11-07-08", "p11-09", "p12-10", "p5-09"]

RATIO_EN = {"9:16": "vertical 9:16", "16:9": "horizontal 16:9"}


def first_line(has_end):
    s = (f"{TOKEN1} is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and "
         "white balance, same people and animals, faces, hair and clothes.")
    if has_end:
        s += f" {TOKEN2} is the exact last frame: the camera arrives at exactly that framing at the very end."
    return s


def who_lines(spec, keys):
    return [f"{k}: {spec['공통']['누구'][k]}" for k in keys]


def prompt(spec, p):
    c = spec["공통"]
    ratio = RATIO_EN[spec["비율"]]
    shots = p["샷"]
    L = []
    if len(shots) == 1:
        s = shots[0]
        L.append(first_line(bool(s.get("끝그림"))))
        slow = s.get("슬로")
        L.append(f"ONE SINGLE CONTINUOUS SHOT of {c['장르']}, {ratio} — no cuts, no camera switch, "
                 + ("in smooth slow motion for the whole shot, no speed ramp, no end card." if slow else "no slow motion, no speed ramp, no end card."))
        L += who_lines(spec, s.get("누구", []))
        L.append("ACTION: " + s["동작"])
        L.append("CAMERA: " + s["카메라"])
        if s.get("기운"):
            L.append("ENERGY: " + s["기운"])
    else:
        t = p["자르는초"]
        L.append(f"This video is TWO SHOTS of {c['장르']}, {ratio}, joined by ONE hard cut at {t:g} s — the same moment in the same place "
                 "under the same light; any person or object seen in both shots looks exactly the same in both; nobody is added who is not "
                 "described for that shot; no other cuts, no slow motion, no speed ramp, no end card.")
        keys = []
        for s in shots:
            for k in s.get("누구", []):
                if k not in keys:
                    keys.append(k)
        L += who_lines(spec, keys)
        for i, s in enumerate(shots):
            a, b = (0, t) if i == 0 else (t, None)
            tok = TOKEN1 if i == 0 else TOKEN2
            span = f"{a:g}–{b:g} s" if b else f"{a:g} s to the end"
            L.append(f"SHOT {i + 1} ({span}) begins exactly on {tok} — same framing, light and colors. ACTION: {s['동작']} CAMERA: {s['카메라']}")
    L.append(c["보기"])
    L.append(c["소리"])
    return "\n".join(L)


def load_specs():
    specs = {}
    for key, folder in PIECES:
        f = os.path.join(VIDEO, folder, "지시문", "영상_시댄스웹.json")
        if os.path.exists(f):
            specs[key] = json.load(open(f, encoding="utf-8"))
    return specs


def save_jpg(src, dst):
    im = Image.open(src).convert("RGB")
    im.save(dst, quality=95)
    return im.size


def build():
    specs = load_specs()
    items = []   # 순서표 한 줄 = 한 판
    # 매진 임박 — 이미 만든 웹올리기_v5를 그대로(첫 줄만 웹 꼬리표로)
    hs = json.load(open(os.path.join(HS, "_순서.json"), encoding="utf-8"))
    for r in hs:
        d = os.path.join(HS, r["폴더"])
        body = open(os.path.join(d, "지시문.txt"), encoding="utf-8").read().strip()
        items.append({"id": f"hs-{r['id']}", "편": "hs", "편이름": "매진 임박", "컷": [str(r["컷"])], "길이": r["길이"], "비율": "16:9",
                      "소리": "켬" if r["소리 생성"] else "끔", "설명": f"매진 임박 #{r['컷']}",
                      "파일": [("1_시작.jpg", os.path.join(d, "1_시작.jpg"), "시작")]
                      + ([("2_끝.jpg", os.path.join(d, "2_끝.jpg"), "끝")] if r["끝 그림"] else [])
                      + ([("3_소리.mp3", os.path.join(d, "3_소리.mp3"), "소리")] if r["소리 참고"] else []),
                      "지시문": first_line(r["끝 그림"]) + "\n" + body, "묶음": False, "대안": False})
    for key, folder in PIECES:
        spec = specs.get(key)
        if not spec:
            continue
        for p in spec["판"]:
            shots = p["샷"]
            files = []
            if len(shots) == 1:
                files.append(("1_시작.jpg", os.path.join(spec["그림"], shots[0]["그림"]), "시작"))
                if shots[0].get("끝그림"):
                    files.append(("2_끝.jpg", os.path.join(spec["그림"], shots[0]["끝그림"]), "끝"))
            else:
                for i, s in enumerate(shots):
                    files.append((f"{i + 1}_샷{i + 1}.jpg", os.path.join(spec["그림"], s["그림"]), f"샷{i + 1}"))
            items.append({"id": p["id"], "편": key, "편이름": spec["이름"], "컷": p["컷"], "길이": p["길이"], "비율": spec["비율"],
                          "소리": "끔", "설명": p["설명"], "파일": files, "지시문": prompt(spec, p),
                          "묶음": len(shots) > 1, "대안": bool(p.get("대안")), "낱판": p.get("낱판", []), "쓰는초": [s.get("쓰는초") for s in shots]})
    # 차례: 시험 → 편 차례(대안 판은 맨 뒤 — 묶음이 안 될 때만)
    by_id = {it["id"]: it for it in items}
    order = [by_id[i] for i in TESTS if i in by_id]
    order += [it for it in items if it["id"] not in TESTS and not it["대안"]]
    order += [it for it in items if it["대안"]]
    if "--보기" in sys.argv:
        k = sys.argv[sys.argv.index("--보기") + 1]
        print(by_id[k]["지시문"])
        print(f"\n({len(by_id[k]['지시문'])}자)")
        return
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    rows = []
    for n, it in enumerate(order, 1):
        d = os.path.join(OUT, f"{n:03d}_{it['id']}")
        os.makedirs(d)
        for name, src, _ in it["파일"]:
            if name.endswith(".mp3"):
                shutil.copy2(src, os.path.join(d, name))
            else:
                save_jpg(src, os.path.join(d, name))
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(it["지시문"])
        rows.append({"순서": n, "id": it["id"], "편": it["편"], "컷": it["컷"], "폴더": os.path.basename(d), "길이": it["길이"], "비율": it["비율"],
                     "소리": it["소리"], "묶음": it["묶음"], "대안": it["대안"], "낱판": it.get("낱판", []), "쓰는초": it.get("쓰는초"),
                     "파일": [f[0] for f in it["파일"]], "지시문 머리": it["지시문"][:160], "지시문 글자 수": len(it["지시문"])})
    json.dump(rows, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(os.path.join(OUT, "순서표.html"), "w", encoding="utf-8").write(page(order))
    n_main = sum(1 for it in order if not it["대안"])
    print(f"판 {len(order)}개(대안 {len(order) - n_main}) → {OUT}")
    for key in ["hs"] + [k for k, _ in PIECES]:
        sel = [it for it in order if it["편"] == key and not it["대안"]]
        if sel:
            print(f"  {key}: 판 {len(sel)} · 컷 {sum(len(it['컷']) for it in sel)} · 묶음 {sum(it['묶음'] for it in sel)}")
    too_long = [it["id"] for it in order if len(it["지시문"]) > 3800]
    if too_long:
        print("지시문이 3,800자를 넘는 판:", too_long)


def page(order):
    def esc(s):
        return html.escape(s)
    head = """<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>PULSE 시댄스 순서표</title><style>
:root{--bg:#f6f4ef;--card:#fff;--ink:#1d1c1a;--mute:#6b6760;--line:#e2ddd3;--acc:#2f5bd3;--warn:#b4532a}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#17171a;--card:#212125;--ink:#ecebe8;--mute:#a19d95;--line:#33333a;--acc:#8aa6ff;--warn:#f0a07a}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,'Malgun Gothic',sans-serif}
main{max-width:980px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0}.note{color:var(--mute)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:10px 0}
.card.done{opacity:.45}.row{display:flex;gap:10px;align-items:flex-start}
.n{font-weight:700;min-width:44px}.tag{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:6px;padding:0 6px;margin-right:4px}
.tag.b{border-color:var(--acc);color:var(--acc)}.tag.w{border-color:var(--warn);color:var(--warn)}
pre{white-space:pre-wrap;word-break:break-word;background:var(--bg);border-radius:8px;padding:8px;font-size:12.5px;max-height:220px;overflow:auto}
button{font:inherit;padding:4px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
h2{font-size:18px;margin:24px 0 6px}
</style></head><body><main>
<h1>PULSE 포트폴리오 · 시댄스 2.5 무제한 순서표</h1>
<div class="card"><b>시작 전에</b><ol>
<li>사기 전에 상품 카드에서 모델(Seedance 2.5) · 화질(720p) · 한 판 길이 상한 · 동시에 돌릴 수 있는 수를 봐 주세요. Claude가 받을 수 있게 MCP가 붙은 계정에서 삽니다.</li>
<li>higgsfield.ai → 비디오 만들기 → 모델 Seedance 2.5 · <b>Unlimited 스위치 켬</b>(생성 단추에 「Unlimited」가 보여야 크레딧이 안 나갑니다) · 화질 720p · 소리는 판마다 적힌 대로 · 비율은 판마다 적힌 대로.</li>
<li>판마다 앞 판에서 올린 그림을 지우고 미디어 칸을 비운 뒤, 판 폴더의 그림을 <b>파일 이름 차례대로</b> 올립니다.
 <br>· 그림 칸이 「시작 프레임 / 끝 프레임」으로 나뉘면: 1_시작 → 시작, 2_끝 → 끝.
 <br>· 칸이 하나(「미디어 업로드」)뿐이면: 올린 차례대로 「@이미지 1」 · 「@이미지 2」가 됩니다. 지시문을 붙여 넣은 뒤 글자 「@이미지 1」이 꼬리표로 안 바뀌면 그 글자를 지우고 @를 쳐서 올린 그림을 고릅니다.</li>
<li><b>「두 샷」 판</b>(파란 표시)은 <b>옴니 레퍼런스(참조) 모드</b>에서 그림 둘을 참조로 올려 한 판에 두 컷을 냅니다 — 시댄스 2.5에는 이 모드가 있습니다(10-28 MCP 모델 정보: 문장만 · 옴니 레퍼런스 · 시작/끝 프레임 · 한 판 4~30초). 화면이 두 그림을 시작 · 끝 프레임으로만 받으면 이 판은 내지 말고 아래 「대안」의 낱판 둘로 냅니다.</li>
<li>「지시문 복사」로 글을 붙여 넣고 생성합니다. 프리셋을 권하면 거절합니다. 앞 판이 다 만들어진 뒤 다음 판을 냅니다. 처음 보는 동의 창은 직접 읽고 눌러 주세요.</li>
<li>맨 앞 시험 다섯을 내면 Claude에게 「시험 냈어」라고만 해 주세요 — 기다리지 말고 이어서 내셔도 됩니다. Claude가 받아 보고 묶음 · 끝 그림 · 카메라 길이 되는지 알려 드립니다.</li>
</ol></div>
"""
    out = [head]
    cur = None
    for n, it in enumerate(order, 1):
        sec = "시험" if it["id"] in TESTS else ("대안 — 묶음 판이 안 될 때만" if it["대안"] else it["편이름"])
        if sec != cur:
            out.append(f"<h2>{esc(sec)}</h2>")
            cur = sec
        tags = f'<span class="tag">{esc(it["비율"])}</span><span class="tag">{it["길이"]}초</span><span class="tag">소리 {esc(it["소리"])}</span>'
        if it["묶음"]:
            tags += '<span class="tag b">두 샷</span>'
        if it["대안"]:
            tags += '<span class="tag w">대안</span>'
        files = " · ".join(f"{esc(f[0])}" for f in it["파일"])
        out.append(f'<div class="card" id="c{n}"><div class="row"><input type="checkbox" data-k="{esc(it["id"])}"><div class="n">{n}</div><div>'
                   f'<b>{esc(it["편이름"])}</b> 컷 {esc(", ".join(it["컷"]))} — {esc(it["설명"])}<br>{tags}<br>'
                   f'<span class="note">폴더 {n:03d}_{esc(it["id"])} · 올릴 것: {files}</span>'
                   f'<pre id="p{n}">{esc(it["지시문"])}</pre><button data-p="p{n}">지시문 복사</button></div></div></div>')
    out.append("""<script>
const K='pulse-seedance-day-20261028';let s={};try{s=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}
document.querySelectorAll('input[type=checkbox]').forEach(b=>{const c=b.closest('.card');if(s[b.dataset.k]){b.checked=true;c.classList.add('done')}
b.onchange=()=>{s[b.dataset.k]=b.checked;c.classList.toggle('done',b.checked);try{localStorage.setItem(K,JSON.stringify(s))}catch(e){}}});
document.querySelectorAll('button[data-p]').forEach(x=>x.onclick=()=>{const t=document.getElementById(x.dataset.p).innerText;
navigator.clipboard.writeText(t).then(()=>{x.textContent='복사함';setTimeout(()=>x.textContent='지시문 복사',1200)})});
</script></main></body></html>""")
    return "\n".join(out)


if __name__ == "__main__":
    build()
