# 콘티 v5 Seedance 2.0 웹 무제한 순서표(2026-10-26) — higgsfield.ai 웹에서 사람이 한 컷씩 내도록 컷마다 폴더와 순서표를 만든다.
# 무제한은 웹에서만, 한 번에 하나씩, 자동화 금지(Higgsfield 도움말 · 이용약관 10.6)라 내기는 유호님 손, 받기 · 검수는 Claude(show_generations).
# 컷 폴더: 1_시작.jpg · 2_끝.jpg(#5 · #24 · #26) · 3_소리.mp3(대사 컷) · 지시문.txt(= 클립 prompt + 말없음 줄 + 공통, 영상_v5.json 그대로).
# 순서: 시험 넷(#7 · #3 · #26 · #5)을 앞에 두고 27컷을 차례로(시험 넷은 10-26 크레딧 시험 480p에서 통과 — 기다리지 않고 이어서 낸다).
#   python -X utf8 웹올리기_v5.py   → synk-vendor/…/영상/웹올리기_v5/NN_컷MM/ · 순서표.html(그림은 작게 줄여 안에 넣음)
import base64
import html
import io
import json
import os
import shutil

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021")
START = os.path.join(V, "영상", "시작_v5")
SOUND = os.path.join(V, "영상", "소리참고_v5")
OUT = os.path.join(V, "영상", "웹올리기_v5")
FIRST = ["S07", "S03", "S26", "S05"]


def text_of(spec, c):
    parts = [c["prompt"]]
    for key in ("공통_말없음", "공통_말없음_강도"):
        if c.get(key):
            parts.append(spec[key])
    parts.append(spec["공통"])
    return " ".join(parts)


def thumb(path, w=420):
    im = Image.open(path).convert("RGB")
    im = im.resize((w, round(im.height * w / im.width)))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=80)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def card(k, c, text, folder, web):
    e = html.escape
    imgs = f'<figure><img src="{thumb(os.path.join(START, c["시작 그림"]))}" alt=""><figcaption>시작 칸 · 1_시작.jpg</figcaption></figure>'
    if c.get("끝 그림"):
        imgs += f'<figure><img src="{thumb(os.path.join(START, c["끝 그림"]))}" alt=""><figcaption>끝 칸 · 2_끝.jpg</figcaption></figure>'
    files = ["1_시작.jpg → 시작 칸(Start frame)"]
    if c.get("끝 그림"):
        files.append("2_끝.jpg → 끝 칸(End frame)")
    if c.get("소리 참고"):
        files.append("3_소리.mp3 → 소리 참고(Audio)")
    sets = f'길이 {c["길이"]}초 · 화질 {web["화질"]} · 16:9 · 소리 {"켬" if c["generate_audio"] else "끔"}'
    first = ' first' if c["id"] in FIRST else ''
    copy = f'''<div class="copy"><textarea readonly rows="7">{e(text)}</textarea>
  <button type="button">지시문 복사</button><span class="done"></span></div>'''
    if c.get("소리 참고"):
        copy += f'''<div class="copy alt"><p class="altnote">소리 참고를 그림과 함께 못 넣을 때 — 소리 켬으로 이 글을 냅니다</p><textarea readonly rows="4">{e(no_ref(text))}</textarea>
  <button type="button">소리 참고 없이 지시문 복사</button><span class="done"></span></div>'''
    return f'''
<section class="cut{first}" id="{c["id"]}">
  <header><label><input type="checkbox" data-id="{c["id"]}"> <b>{k}.</b> 컷 #{c["컷"]}</label><span class="dir">폴더 {e(folder)}</span></header>
  <p class="sum">{e(c["요약"])}</p>
  <div class="imgs">{imgs}</div>
  <p class="set">{e(sets)}</p>
  <ul>{"".join(f"<li>{e(f)}</li>" for f in files)}</ul>
  {copy}
</section>'''


def no_ref(text):
    # 소리 참고를 못 넣을 때: 입은 지시문 속 한국어 대사대로 움직이게(목소리는 편집에서 바꾼다)
    out = text.replace("in sync with the reference audio", "clearly forming the Korean words")
    assert out != text, "대사 컷 지시문에 「in sync with the reference audio」가 없다"
    return out


def main():
    spec = json.load(open(os.path.join(HERE, "지시문", "영상_v5.json"), encoding="utf-8"))
    web = spec["웹 무제한(Seedance 2.0)"]
    clips = {c["id"]: c for c in spec["클립"]}
    order = FIRST + [c["id"] for c in spec["클립"] if c["id"] not in FIRST]
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    cards, rows = [], []
    for k, cid in enumerate(order, 1):
        c = clips[cid]
        folder = f"{k:02d}_컷{c['컷']:02d}"
        d = os.path.join(OUT, folder)
        os.makedirs(d)
        shutil.copy(os.path.join(START, c["시작 그림"]), os.path.join(d, "1_시작.jpg"))
        if c.get("끝 그림"):
            shutil.copy(os.path.join(START, c["끝 그림"]), os.path.join(d, "2_끝.jpg"))
        if c.get("소리 참고"):
            shutil.copy(os.path.join(SOUND, c["소리 참고"]["파일"]), os.path.join(d, "3_소리.mp3"))
        text = text_of(spec, c)
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(text)
        cards.append(card(k, c, text, folder, web))
        rows.append({"순서": k, "컷": c["컷"], "id": cid, "폴더": folder, "길이": c["길이"], "소리 생성": c["generate_audio"],
                     "끝 그림": bool(c.get("끝 그림")), "소리 참고": bool(c.get("소리 참고")), "지시문 글자 수": len(text)})
        if k == len(FIRST):
            cards.append('<h2 class="pause">시험 넷은 10-26 크레딧 시험(480p)에서 통과했어요 — 기다리지 말고 아래 23컷을 이어서 내 주세요</h2>')
    before = "".join(f"<li>{html.escape(s)}</li>" for s in web["시작 전에"])
    page = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>매진 임박 Seedance 순서표</title>
<style>
:root {{ --bg:#f6f3ee; --ink:#1d1b19; --dim:#6b645c; --line:#ddd5ca; --acc:#b4532a; --card:#fff; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#141210; --ink:#eee8e0; --dim:#a39a90; --line:#3a342e; --acc:#f0a36c; --card:#1d1a17; }} }}
body {{ margin:0; background:var(--bg); color:var(--ink); font:16px/1.6 "SUIT","Pretendard","Malgun Gothic",sans-serif; }}
main {{ max-width:980px; margin:0 auto; padding:24px 16px 80px; }}
h1 {{ font-size:26px; margin:0 0 6px; }} h2 {{ font-size:19px; margin:28px 0 10px; }}
.lead {{ color:var(--dim); margin:0 0 18px; }}
ol.before li {{ margin:4px 0; }}
.cut {{ background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; margin:14px 0; }}
.cut.first {{ border-color:var(--acc); }}
.cut header {{ display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; font-size:18px; }}
.dir {{ color:var(--dim); font-size:14px; }}
.sum {{ margin:6px 0 10px; }}
.imgs {{ display:flex; gap:10px; flex-wrap:wrap; }}
figure {{ margin:0; }} figure img {{ width:300px; max-width:100%; border-radius:6px; display:block; }}
figcaption {{ font-size:13px; color:var(--dim); }}
.set {{ font-weight:700; margin:10px 0 4px; }}
ul {{ margin:4px 0 10px; padding-left:20px; }}
textarea {{ width:100%; box-sizing:border-box; font:13px/1.5 Consolas,monospace; background:var(--bg); color:var(--ink); border:1px solid var(--line); border-radius:6px; padding:8px; }}
button {{ margin-top:6px; padding:8px 14px; border-radius:6px; border:1px solid var(--acc); background:var(--acc); color:#fff; font-weight:700; cursor:pointer; }}
.done {{ margin-left:10px; color:var(--acc); font-size:14px; }}
.copy.alt {{ margin-top:12px; padding-top:10px; border-top:1px dashed var(--line); }}
.altnote {{ margin:0 0 6px; color:var(--dim); font-size:14px; }}
.copy.alt button {{ background:transparent; color:var(--acc); }}
.pause {{ border-top:2px dashed var(--acc); padding-top:16px; color:var(--acc); }}
.cut:has(input:checked) {{ opacity:.55; }}
</style></head><body><main>
<h1>매진 임박 · Seedance 2.0 무제한 순서표</h1>
<p class="lead">공포 컷 27개(광고 카드 넷은 블렌더라 빠짐). 한 컷씩 내고, 앞 컷이 다 만들어진 뒤 다음 컷을 냅니다. 낸 컷은 왼쪽 네모에 표시해 두면 이 브라우저에 남습니다.</p>
<h2>시작 전에</h2><ol class="before">{before}</ol>
<h2>시험 넷(10-26 시험 통과) — 처음 #7만 눈으로 보고 이어서</h2>
{"".join(cards)}
</main>
<script>
const KEY = "매진임박_순서표_v5";
let saved = {{}};
try {{ saved = JSON.parse(localStorage.getItem(KEY) || "{{}}"); }} catch (e) {{}}
document.querySelectorAll("input[data-id]").forEach(box => {{
  box.checked = !!saved[box.dataset.id];
  box.addEventListener("change", () => {{ saved[box.dataset.id] = box.checked; try {{ localStorage.setItem(KEY, JSON.stringify(saved)); }} catch (e) {{}} }});
}});
document.querySelectorAll(".copy button").forEach(btn => btn.addEventListener("click", async () => {{
  const ta = btn.parentElement.querySelector("textarea");
  let ok = false;
  try {{ await navigator.clipboard.writeText(ta.value); ok = true; }} catch (e) {{ ta.select(); try {{ ok = document.execCommand("copy"); }} catch (e2) {{}} }}
  btn.parentElement.querySelector(".done").textContent = ok ? "복사했어요" : "복사가 안 돼요 — 칸을 눌러 전체 선택 후 복사";
}}));
</script></body></html>'''
    open(os.path.join(OUT, "순서표.html"), "w", encoding="utf-8").write(page)
    json.dump(rows, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(OUT, len(order), "컷")


if __name__ == "__main__":
    main()
